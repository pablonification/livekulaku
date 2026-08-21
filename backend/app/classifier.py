"""Tier-1 comment classifier.

Two backends:
- keyword (default, zero-dep): Indonesian rule baseline. Always works offline.
- local: loads a fine-tuned IndoBERT checkpoint from model/checkpoints if
  CLASSIFIER_MODE=local and the folder exists; silently falls back otherwise.

The keyword baseline doubles as the evaluation baseline for the trained model.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from .intents import ID_TO_LABEL, INTENTS

# ---- keyword baseline -------------------------------------------------
_PATTERNS: dict[str, list[str]] = {
    "bandingkan_harga": [r"\b(mahal|kemahalan)\b", r"\b(di sebelah|toko sebelah|sana lebih|di (tokopedia|shopee|tiktok) (lebih|cuma|cuman))\b", r"\bkalah (murah|saing)\b"],
    "harga": [r"\b(harga|brp|brapa|berapa|hrg)\b", r"\b(berapaan)\b", r"\bspill (harga|dong)\b"],
    "ongkir": [r"\b(ongkir|ongkos kirim|gratis ongkir|free ongkir)\b", r"\b(sampai|sampe|ke) (luar kota|luar jawa|medan|solo|sby|surabaya|makassar|pontianak)\b"],
    "cod": [r"\b(cod|bayar di tempat|bayar ditempat)\b"],
    "garansi": [r"\b(garansi|jaminan|retur|rusak gmn|kalau rusak)\b"],
    "stok": [r"\b(stok|ready|ada (barang|stock)?\s*\?|ready all)\b", r"\b(restock)\b"],
    "checkout": [r"\b(checkout|co dulu|mau (beli|order)|ambil (satu|1|2|tiga|3)|checkout sekarang)\b", r"\b(langsung (co|checkout))\b"],
}

_COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in _PATTERNS.items()}

# priority: more specific intents win when several match
_PRIORITY = ["bandingkan_harga", "harga", "ongkir", "cod", "garansi", "stok", "checkout"]


class KeywordClassifier:
    name = "keyword-baseline"

    def predict(self, text: str) -> tuple[str, float]:
        scores: dict[str, int] = {}
        for label in _PRIORITY:
            hits = sum(1 for rx in _COMPILED[label] if rx.search(text))
            if hits:
                scores[label] = hits
        if not scores:
            return "browse", 0.55
        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        confidence = min(0.9, 0.6 + 0.1 * scores[best])
        return best, confidence


class LocalClassifier:
    """Loads fine-tuned IndoBERT from model/checkpoints (optional)."""

    name = "indobert-finetuned"

    def __init__(self, ckpt_dir: Path):
        from transformers import pipeline  # heavy import, only when used

        self._pipe = pipeline(
            "text-classification",
            model=str(ckpt_dir),
            tokenizer=str(ckpt_dir),
            truncation=True,
            max_length=64,
        )

    def predict(self, text: str) -> tuple[str, float]:
        out = self._pipe(text)[0]
        raw_label = str(out["label"])
        if raw_label in INTENTS:
            label = raw_label
        elif raw_label.upper().startswith("LABEL_"):
            try:
                label = ID_TO_LABEL[int(raw_label.rsplit("_", 1)[1])]
            except (KeyError, ValueError):
                label = "browse"
        else:
            label = "browse"
        return label, float(out["score"])


def get_classifier(mode: str | None = None, ckpt_dir: str = "model/checkpoints"):
    mode = (mode or os.environ.get("CLASSIFIER_MODE", "keyword")).lower()
    if mode == "local" and Path(ckpt_dir).exists():
        try:
            return LocalClassifier(Path(ckpt_dir))
        except Exception:  # weights broken / libs missing -> never crash the demo
            pass
    return KeywordClassifier()
