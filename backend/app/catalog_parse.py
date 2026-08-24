"""Seller Catalog parsing: product share links and share-sheet text into catalog fields.

Plain httpx inside the setup request (rulebook: sync-only, stateless, stores nothing).
No browsers, no proxies, no scraping infra dependencies.

Verified live on 24 Aug 2026 against real seller links:
- TikTok Shop ID rides Tokopedia: vt.tokopedia.com/t/<slug> redirects to
  shop-id.tokopedia.com/view/product/<id> and the Location URL carries an og_info
  JSON param with title + image. Price is hydrated client-side, so it needs manual fill.
- Shopee: id.shp.ee/<slug> resolves to shopee.co.id/product/<shop>/<item>. The server
  rendered HTML embeds og:title (name), an Rp price string, and promo keywords inside
  og:description. Stock stays client-side: needs manual fill.

Any failure degrades to parse_source="manual" with every field in needs_manual.
"""
from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx

from .schemas import CatalogParseResponse

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126 Safari/537.36"
)
TIMEOUT = httpx.Timeout(5.0)
MAX_REDIRECTS = 5

_PRICE_RE = re.compile(r"Rp\.?\s*([\d.,]+)", re.IGNORECASE)
_URL_RE = re.compile(r"https?://\S+")
_PROMO_KEYWORDS = ("gratis ongkir", "free ongkir", "cod", "cashback", "diskon")
_MANUAL_FIELDS = ("name", "price", "promo", "stock")


def normalize_price(raw: str) -> str:
    """Trim trailing punctuation from an Rp price match, keep seller-friendly string."""
    return raw.strip().strip(",.;:)")


def extract_first_price(text: str) -> Optional[str]:
    m = _PRICE_RE.search(text or "")
    return normalize_price(m.group(0)) if m else None


def promo_from_description(description: str) -> Optional[str]:
    low = (description or "").lower()
    hits = [kw for kw in _PROMO_KEYWORDS if kw in low]
    if not hits:
        return None
    return ", ".join(hits[:3])


def clean_name(raw: str) -> str:
    """og:title cleanup: drop 'Jual ' prefix, collapse whitespace."""
    name = re.sub(r"\s+", " ", raw or "").strip()
    name = re.sub(r"^jual\s+", "", name, flags=re.IGNORECASE)
    return name.strip()


def parse_share_text(text: str) -> dict:
    """Deterministic offline parse of a pasted share-sheet blob.

    Shape: name ... Rp99.000 ... https://...
    Returns dict with optional name/price/url keys.
    """
    out: dict = {}
    if not text:
        return out
    url_match = _URL_RE.search(text)
    if url_match:
        out["url"] = url_match.group(0).rstrip(").,]")
    price = extract_first_price(text)
    if price:
        out["price"] = price
    # name = text minus the URL and the price chunk
    candidate = text
    if url_match:
        candidate = candidate.replace(url_match.group(0), " ")
    candidate = _PRICE_RE.sub(" ", candidate)
    candidate = re.sub(r"[\-\u2013\u2014|,;\u2022]+", " ", candidate)  # separators only
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if len(candidate) >= 3:
        out["name"] = candidate
    return out


def _needs_manual(name, price, promo, stock) -> list[str]:
    values = {"name": name, "price": price, "promo": promo, "stock": stock}
    return [field for field in _MANUAL_FIELDS if values.get(field) in (None, "")]


def _manual_response() -> CatalogParseResponse:
    return CatalogParseResponse(
        name=None,
        price=None,
        promo=None,
        stock=None,
        image_url=None,
        parse_source="manual",
        needs_manual=list(_MANUAL_FIELDS),
    )


def _extract_og(html: str, prop: str) -> Optional[str]:
    m = re.search(rf'property="{prop}" content="([^"]*)"', html or "")
    return m.group(1) if m else None


def _fields_from_tokopedia(final_url: str, html: str) -> dict:
    """TikTok Shop ID via Tokopedia: prefer og_info redirect param, fall back to og:title."""
    fields: dict = {}
    try:
        qs = parse_qs(urlparse(final_url).query)
        og_raw = (qs.get("og_info") or [None])[0]
        if og_raw:
            og = json.loads(og_raw)
            title = og.get("title")
            if title:
                fields["name"] = clean_name(str(title))
            image = og.get("image")
            if image:
                fields["image_url"] = str(image)
    except Exception:  # noqa: BLE001 - malformed og_info just falls through
        pass
    if not fields.get("name"):
        og_title = _extract_og(html, "og:title")
        if og_title:
            fields["name"] = clean_name(og_title)
    if not fields.get("image_url"):
        og_image = _extract_og(html, "og:image")
        if og_image:
            fields["image_url"] = og_image
    return fields


def _fields_from_shopee(html: str) -> dict:
    """Shopee PDP: server HTML carries og:title name, Rp price, promo words in description."""
    fields: dict = {}
    og_title = _extract_og(html, "og:title")
    if og_title:
        name = clean_name(og_title)
        if name:
            fields["name"] = name
    price = extract_first_price(html)
    if price:
        fields["price"] = price
    og_desc = _extract_og(html, "og:description") or ""
    promo = promo_from_description(og_desc)
    if promo:
        fields["promo"] = promo
    return fields


def _is_shopee(host: str) -> bool:
    return "shopee" in host


def _is_tokopedia(host: str) -> bool:
    return "tokopedia" in host


async def parse_catalog(url: Optional[str], text: Optional[str]) -> CatalogParseResponse:
    """Entry point used by POST /catalog/parse. Never raises."""
    url = (url or "").strip() or None
    text = (text or "").strip() or None

    if not url and not text:
        return _manual_response()

    merged: dict = {"parse_source": "manual"}
    if text:
        blob = parse_share_text(text)
        contributed = {k: v for k, v in blob.items() if k != "url"}
        if contributed:
            merged.update(contributed)
            merged["parse_source"] = "text"
        url = url or blob.get("url")

    if url and url.lower().startswith(("http://", "https://")):
        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT, follow_redirects=True, max_redirects=MAX_REDIRECTS, headers=_headers()
            ) as client:
                resp = await client.get(url)
            resp.raise_for_status()
            host = urlparse(str(resp.url)).hostname or ""
            if _is_shopee(host):
                fields = _fields_from_shopee(resp.text)
                fields.pop("image_url", None)
                merged.update(fields)
                merged["parse_source"] = "link"
            elif _is_tokopedia(host):
                merged.update(_fields_from_tokopedia(str(resp.url), resp.text))
                merged["parse_source"] = "link"
            else:
                og_title = _extract_og(resp.text, "og:title")
                if og_title:
                    merged["name"] = clean_name(og_title)
                    merged["parse_source"] = "link"
        except Exception as exc:  # noqa: BLE001 - degrade to manual, never crash setup
            print(f"[catalog-parse] fetch failed for {url}: {exc}")

    name = merged.get("name")
    price = merged.get("price")
    promo = merged.get("promo")
    stock = merged.get("stock")
    return CatalogParseResponse(
        name=name,
        price=price,
        promo=promo,
        stock=stock,
        image_url=merged.get("image_url"),
        parse_source=merged.get("parse_source", "manual"),
        needs_manual=_needs_manual(name, price, promo, stock),
    )


def _headers() -> dict:
    return {"User-Agent": USER_AGENT, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8"}
