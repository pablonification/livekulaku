"""Tier-2 coach: turns a window summary into ONE priority card.

Providers:
- api  : Meta Muse Spark 1.2 (contributor tier), OpenAI-compatible, structured JSON,
         grounded on the Seller Catalog sent inline with the request when present.
- mock : deterministic template cards grounded in the Seller Catalog (products param),
         or in data/catalog.json when no catalog was sent (judge-safe demo mode).

META_API_KEY present selects Muse Spark, otherwise the deterministic templates are used.
API failures always fall back to the deterministic templates and never crash.
Returned dicts carry an extra "engine" key: "llm" or "template".
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).resolve()
DATA_DIR_CANDIDATES = (
    MODULE_PATH.parents[2] / "data",
    MODULE_PATH.parents[1] / "data",
)
DATA_DIR = next(
    (candidate for candidate in DATA_DIR_CANDIDATES if candidate.is_dir()),
    DATA_DIR_CANDIDATES[-1],
)
CATALOG_PATH = DATA_DIR / "catalog.json"
PLAYBOOK_PATH = DATA_DIR / "playbook.json"
MUSE_MODEL = "muse-spark-1.2-contributor"

# intents whose reply leans on price facts vs stock facts
PRICE_LABELS = frozenset({"harga", "bandingkan_harga", "promo"})
STOCK_LABELS = frozenset({"stok"})

CARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["suggested_reply", "why_now", "tone"],
    "properties": {
        "suggested_reply": {"type": "string", "description": "1-2 kalimat bahasa Indonesia santai siap diucapkan host"},
        "why_now": {
            "type": "string",
            "description": (
                "1 kalimat bahasa Indonesia sehari-hari untuk host, sebut jumlah komentarnya "
                "(contoh: 3 dari 7 komentar nanya harga). Dilarang pakai istilah teknis "
                "seperti intent, cluster, urgency, closing, atau conversion."
            ),
        },
        "tone": {"type": "string", "enum": ["closing", "reassure", "inform", "upsell"]},
    },
}
CARD_FIELDS = frozenset(CARD_SCHEMA["required"])
CARD_TONES = frozenset(CARD_SCHEMA["properties"]["tone"]["enum"])


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except Exception:  # noqa: BLE001
        return default


def _validated_card(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict) or set(payload) != CARD_FIELDS:
        raise ValueError("coach response fields do not match the card schema")
    if not all(isinstance(payload[field], str) for field in CARD_FIELDS):
        raise ValueError("coach response fields must be strings")
    if payload["tone"] not in CARD_TONES:
        raise ValueError("coach response tone is not allowed")
    return payload


def pick_product(products: list[dict] | None, label: str) -> dict | None:
    """Deterministic product selection from the Seller Catalog for this intent."""
    if not products:
        return None
    if label in PRICE_LABELS:
        for p in products:
            if p.get("price"):
                return p
    if label in STOCK_LABELS:
        for p in products:
            if p.get("stock") is not None:
                return p
    return products[0]


class _Safe(dict):
    """format_map helper: unknown placeholders become empty string instead of KeyError."""

    def __missing__(self, key):
        return ""


class MockCoach:
    """Deterministic cards from templates + catalog. Zero network."""

    name = "mock-coach"

    def __init__(self) -> None:
        self.catalog = _load_json(CATALOG_PATH, {"products": [], "shipping_note": ""})
        self.playbook = _load_json(PLAYBOOK_PATH, {})

    async def generate(self, card_inputs: dict, products: list[dict] | None = None) -> dict:
        top = card_inputs["top"]
        entry = self.playbook.get(top["label"], {})
        # Seller Catalog first, frozen demo catalog as fallback (judge path unchanged)
        product = pick_product(products, top["label"]) or (self.catalog.get("products") or [{}])[0]

        reply_tpl = entry.get("template", "Siap kak, {product} ready ya!")
        reply = reply_tpl.format_map(
            _Safe(
                product=product.get("name", "produk"),
                price=product.get("price", ""),
                promo=product.get("promo", ""),
                shipping=self.catalog.get("shipping_note", ""),
                count=top["count"],
            )
        )
        reply = re.sub(r"\s{2,}", " ", reply).strip()
        why = (
            f"{top['count']} dari {card_inputs['total']} komentar terakhir nanya "
            f"{top['label_id'].lower()} - jawab sekarang biar penonton nggak pindah live."
        )
        tone = entry.get("tone", "inform")
        return {
            "suggested_reply": reply,
            "why_now": why,
            "tone": tone,
            "engine": "template",
        }


class MuseSparkCoach:
    """Meta Model API (OpenAI-compatible). reasoning_effort minimal for latency."""

    name = "muse-spark-1.2-contributor"

    def __init__(self, api_key: str, base_url: str, model: str):
        from openai import AsyncOpenAI  # imported lazily

        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=8.0)
        self.model = model
        self.catalog = _load_json(CATALOG_PATH, {})
        self.playbook = _load_json(PLAYBOOK_PATH, {})

    def _system_prompt(self, products: list[dict] | None) -> str:
        if products:
            catalog_block = (
                "KATALOG PENJUAL (satu-satunya sumber fakta produk, JANGAN mengarang "
                "harga/stok/promo di luar ini): "
                f"{json.dumps(products, ensure_ascii=False)}\n"
            )
        else:
            catalog_block = (
                f"KATALOG PRODUK: {json.dumps(self.catalog, ensure_ascii=False)}\n"
            )
        return (
            "Kamu coach jualan untuk host live shopping Indonesia (TikTok Shop + Shopee Live). "
            "Diberi ringkasan komentar 10 detik terakhir, hasilkan SATU saran jawaban "
            "yang paling bernilai jual. Gunakan fakta produk dari konteks. Bahasa Indonesia "
            "santai, maksimal 2 kalimat, siap diucapkan. why_now ditulis untuk host: bahasa "
            "sehari-hari, sebut jumlah komentar, tanpa istilah teknis. "
            "Jawab HANYA JSON sesuai skema.\n\n"
            f"{catalog_block}"
            f"PLAYBOOK: {json.dumps(self.playbook, ensure_ascii=False)}"
        )

    async def generate(self, card_inputs: dict, products: list[dict] | None = None) -> dict:
        try:
            resp = await self._client.chat.completions.create(
                model=self.model,
                reasoning_effort="minimal",
                response_format={"type": "json_schema", "json_schema": {"name": "priority_card", "schema": CARD_SCHEMA, "strict": True}},
                messages=[
                    {"role": "system", "content": self._system_prompt(products)},
                    {"role": "user", "content": json.dumps(card_inputs, ensure_ascii=False)},
                ],
            )
            content = resp.choices[0].message.content or "{}"
            card = _validated_card(json.loads(content))
            card["engine"] = "llm"
            return card
        except Exception as exc:  # noqa: BLE001
            print(f"[coach] api request failed ({exc}) -> template")
            return await MockCoach().generate(card_inputs, products)


def get_coach(settings) -> Any:
    if settings.meta_api_key:
        try:
            return MuseSparkCoach(settings.meta_api_key, settings.meta_base_url, MUSE_MODEL)
        except Exception as exc:  # noqa: BLE001
            print(f"[coach] api init failed ({exc}) -> mock")
    return MockCoach()
