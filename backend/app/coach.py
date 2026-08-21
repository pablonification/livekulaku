"""Tier-2 coach: turns a window summary into ONE priority card.

Providers:
- api  : Meta Muse Spark 1.2 (contributor tier), OpenAI-compatible, structured JSON.
- mock : deterministic template cards grounded in data/catalog.json (judge-safe).

COACH_PROVIDER=auto -> api if META_API_KEY present else mock.
API failures always fall back to mock with source flagged, never crash.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
CATALOG_PATH = DATA_DIR / "catalog.json"
PLAYBOOK_PATH = DATA_DIR / "playbook.json"

CARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["suggested_reply", "why_now", "tone"],
    "properties": {
        "suggested_reply": {"type": "string", "description": "1-2 kalimat bahasa Indonesia santai siap diucapkan host"},
        "why_now": {"type": "string", "description": "1 kalimat alasan strategis, sebut angka cluster"},
        "tone": {"type": "string", "enum": ["closing", "reassure", "inform", "upsell"]},
    },
}


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except Exception:  # noqa: BLE001
        return default


class MockCoach:
    """Deterministic cards from templates + catalog. Zero network."""

    name = "mock-coach"

    def __init__(self) -> None:
        self.catalog = _load_json(CATALOG_PATH, {"products": [], "shipping_note": ""})
        self.playbook = _load_json(PLAYBOOK_PATH, {})

    async def generate(self, card_inputs: dict) -> dict:
        top = card_inputs["top"]
        entry = self.playbook.get(top["label"], {})
        product = (self.catalog.get("products") or [{}])[0]

        reply_tpl = entry.get("template", "Siap kak, {product} ready ya! {extra}")
        reply = reply_tpl.format(
            product=product.get("name", "produk"),
            price=product.get("price_display", ""),
            promo=product.get("promo", ""),
            shipping=self.catalog.get("shipping_note", ""),
            count=top["count"],
        )
        why = (
            f"{top['count']} dari {card_inputs['total']} komen window ini nanya "
            f"{top['label_id'].lower()} — jawab sekarang sebelum pindah live lain."
        )
        tone = entry.get("tone", "inform")
        return {
            "suggested_reply": reply,
            "why_now": why,
            "tone": tone,
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

    def _system_prompt(self) -> str:
        return (
            "Kamu coach jualan untuk host live shopping Indonesia (TikTok Shop + Shopee Live). "
            "Diberi ringkasan cluster komen 10 detik terakhir, hasilkan SATU saran jawaban "
            "yang paling bernilai jual. Gunakan fakta produk dari konteks. Bahasa Indonesia "
            "santai, maksimal 2 kalimat, siap diucapkan. Jawab HANYA JSON sesuai skema.\n\n"
            f"KATALOG PRODUK: {json.dumps(self.catalog, ensure_ascii=False)}\n"
            f"PLAYBOOK: {json.dumps(self.playbook, ensure_ascii=False)}"
        )

    async def generate(self, card_inputs: dict) -> dict:
        resp = await self._client.chat.completions.create(
            model=self.model,
            reasoning_effort="minimal",
            response_format={"type": "json_schema", "json_schema": {"name": "priority_card", "schema": CARD_SCHEMA, "strict": True}},
            messages=[
                {"role": "system", "content": self._system_prompt()},
                {"role": "user", "content": json.dumps(card_inputs, ensure_ascii=False)},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)


def get_coach(settings) -> Any:
    if settings.coach_provider == "mock":
        return MockCoach()
    if settings.coach_provider == "api" or (settings.coach_provider == "auto" and settings.meta_api_key):
        try:
            return MuseSparkCoach(settings.meta_api_key, settings.meta_base_url, settings.meta_model)
        except Exception as exc:  # noqa: BLE001
            print(f"[coach] api init failed ({exc}) -> mock")
    return MockCoach()
