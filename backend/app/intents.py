"""Intent taxonomy for Indonesian live-commerce comments.

Pure data + helpers, no external deps (unit-testable anywhere).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Intent:
    key: str
    label_id: str          # Indonesian label for UI
    urgency_weight: float  # 0..1, how sales-critical this intent is


INTENTS = {
    "harga": Intent("harga", "Harga", 0.8),
    "bandingkan_harga": Intent("bandingkan_harga", "Banding Harga", 1.0),
    "ongkir": Intent("ongkir", "Ongkir", 0.7),
    "cod": Intent("cod", "COD", 0.6),
    "garansi": Intent("garansi", "Garansi", 0.5),
    "stok": Intent("stok", "Stok/Ready", 0.6),
    "checkout": Intent("checkout", "Mau Checkout", 0.9),
    "browse": Intent("browse", "Liat-liat", 0.1),
}

# Stable training and inference order. Hugging Face checkpoints without an
# explicit id2label mapping expose predictions as LABEL_0, LABEL_1, and so on.
LABELS = tuple(INTENTS)
LABEL_TO_ID = {label: index for index, label in enumerate(LABELS)}
ID_TO_LABEL = {index: label for label, index in LABEL_TO_ID.items()}

DEFAULT_INTENT = INTENTS["browse"]


def get_intent(key: str) -> Intent:
    return INTENTS.get(key, DEFAULT_INTENT)
