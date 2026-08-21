"""Shopee Open Platform adapter (OFFICIAL API).

Uses v2.livestream.get_latest_comment_list polling (~3s), HMAC-SHA256 signed.

Status: SKELETON - signing format must be verified against the partner console
for your app type before production use. Enabled only when SHOPEE_* env vars
are present and MODE=shopee. Never enabled by default => judges unaffected.

Docs: https://open.shopee.com/documents/v2/v2.livestream.get_latest_comment_list
Region note: Livestream APIs only exist for TW / ID / TH.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time
from typing import AsyncIterator

import httpx

from ..config import settings
from .base import BaseAdapter, sleep_scaled

BASE_URL = "https://partner.shopeemobile.com"
API_PATH = "/api/v2/livestream/get_latest_comment_list"
POLL_SECONDS = 3.0


def _sign(path: str, timestamp: int, access_token: str, partner_key: str) -> str:
    """Shopee sign base string: partner_id + path + timestamp + access_token."""
    raw = f"{settings.shopee_partner_id}{path}{timestamp}{access_token}"
    return hmac.new(partner_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


class ShopeeAdapter(BaseAdapter):
    name = "shopee"

    def __init__(self, demo_speed: float = 1.0, session_id: str | None = None):
        self.demo_speed = demo_speed
        self._seen: set[str] = set()
        self._session_id = session_id or settings.shopee_session_id

    @property
    def configured(self) -> bool:
        return bool(
            settings.shopee_partner_id
            and settings.shopee_partner_key
            and settings.shopee_access_token
            and self._session_id
        )

    async def _fetch_page(self, offset: int, client: httpx.AsyncClient) -> dict:
        ts = int(time.time())
        params = {
            "partner_id": settings.shopee_partner_id,
            "timestamp": ts,
            "access_token": settings.shopee_access_token,
            "sign": _sign(API_PATH, ts, settings.shopee_access_token, settings.shopee_partner_key),
            "session_id": self._session_id,
            "offset": offset,
            "page_size": 50,
        }
        r = await client.get(f"{BASE_URL}{API_PATH}", params=params, timeout=10)
        r.raise_for_status()
        return r.json()

    async def fetch_once(self) -> list[dict]:
        """One-shot poll returning raw normalized comments (for sync /analyze path)."""
        if not self.configured:
            return []
        async with httpx.AsyncClient() as client:
            data = await self._fetch_page(offset=0, client=client)
            out: list[dict] = []
            for c in (data.get("response") or {}).get("list") or []:
                out.append(
                    {
                        "user": str(c.get("username") or c.get("nickname") or "viewer"),
                        "text": str(c.get("comment") or ""),
                        "platform": "shopee",
                    }
                )
            return out

    async def stream(self) -> AsyncIterator[BufferedComment]:
        from ..aggregator import BufferedComment

        if not self.configured:
            raise RuntimeError("SHOPEE_* env vars missing; adapter disabled")

        seq = 0
        async with httpx.AsyncClient() as client:
            while True:
                try:
                    data = await self._fetch_page(offset=0, client=client)
                    for c in (data.get("response") or {}).get("list") or []:
                        cid = str(c.get("comment_id") or c.get("id"))
                        if cid in self._seen:
                            continue
                        self._seen.add(cid)
                        seq += 1
                        yield BufferedComment(
                            comment_id=f"shopee-{cid}",
                            user=str(c.get("username") or c.get("nickname") or "viewer"),
                            text=str(c.get("comment") or ""),
                            platform="shopee",
                        )
                except Exception as exc:  # noqa: BLE001 - never kill the stream
                    print(f"[shopee] poll error: {exc}")
                await sleep_scaled(POLL_SECONDS, self.demo_speed)
