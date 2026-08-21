"""TikTok adapter via TikTokLive python client (unofficial, disclosed).

Two modes:
- fetch_once(): sync one-shot window collect used by POST /analyze when handle is provided.
  Connects, collects for N seconds, disconnects. No background hold.
- stream(): long-lived async generator, only for legacy /api/live/* dev routes.

Enabled ONLY when TRY_TIKTOK=1 - judges never touch this by default.
Production roadmap is official TikTok Shop Partner API access.
"""
from __future__ import annotations

import asyncio
import contextlib
from typing import AsyncIterator

from ..config import settings
from ..aggregator import BufferedComment
from .base import BaseAdapter


class TikTokAdapter(BaseAdapter):
    name = "tiktok"

    def __init__(self, username: str, demo_speed: float = 1.0):
        self.username = username.lstrip("@")
        self.demo_speed = demo_speed

    def _enabled(self) -> bool:
        return settings.try_tiktok

    @staticmethod
    async def fetch_once(handle: str, collect_seconds: int = 8) -> list[dict]:
        """Sync one-shot window collect. Returns normalized comments. Never raises."""
        collected: list[dict] = []
        try:
            from TikTokLive import TikTokLiveClient
            from TikTokLive.events import CommentEvent

            client = TikTokLiveClient(unique_id=handle.lstrip("@"))

            @client.on(CommentEvent)
            async def on_comment(event) -> None:
                try:
                    user = getattr(event.user, "nickname", None) or getattr(event.user, "unique_id", "viewer")
                    collected.append({"user": user, "text": event.comment or "", "platform": "tiktok"})
                except Exception:
                    pass

            task = asyncio.create_task(client.start())
            # give the connection a moment to establish, then collect the rest of the window
            await asyncio.sleep(max(2, min(collect_seconds, 12)))
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        except Exception as exc:
            reason = str(exc)
            if "not live" in reason.lower() or "offline" in reason.lower():
                print(f"[tiktok] {handle} is not live right now -> empty window")
            else:
                print(f"[tiktok] fetch failed for {handle}: {reason}")
        return collected

    async def stream(self) -> AsyncIterator[BufferedComment]:
        try:
            from TikTokLive import TikTokLiveClient  # type: ignore
            from TikTokLive.events import CommentEvent  # type: ignore
        except ImportError:
            print("[tiktok] pip install TikTokLive to enable this adapter")
            return

        client = TikTokLiveClient(unique_id=self.username)
        queue: asyncio.Queue[BufferedComment] = asyncio.Queue()
        seq = 0

        @client.on(CommentEvent)
        async def on_comment(event: CommentEvent) -> None:
            nonlocal seq
            seq += 1
            await queue.put(
                BufferedComment(
                    comment_id=f"tiktok-{seq}-{getattr(event.user, 'unique_id', 'viewer')}",
                    user=getattr(event.user, "nickname", None) or "viewer",
                    text=event.comment,
                    platform="tiktok",
                )
            )

        task = asyncio.create_task(client.start())
        try:
            while True:
                yield await queue.get()
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
