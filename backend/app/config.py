"""Runtime configuration read from environment (12-factor style)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass
class Settings:
    mode: str = field(default_factory=lambda: os.environ.get("MODE", "mock"))
    window_seconds: float = field(default_factory=lambda: _f("WINDOW_SECONDS", 10.0))
    demo_speed: float = field(default_factory=lambda: _f("DEMO_SPEED", 1.0))

    meta_api_key: str = field(default_factory=lambda: os.environ.get("META_API_KEY", ""))
    meta_base_url: str = field(default_factory=lambda: os.environ.get("META_BASE_URL", "https://api.meta.ai/v1"))
    meta_model: str = field(default_factory=lambda: os.environ.get("META_MODEL", "muse-spark-1.2-contributor"))
    coach_provider: str = field(default_factory=lambda: os.environ.get("COACH_PROVIDER", "auto"))

    classifier_mode: str = field(default_factory=lambda: os.environ.get("CLASSIFIER_MODE", "keyword"))

    try_tiktok: bool = field(default_factory=lambda: os.environ.get("TRY_TIKTOK", "0") == "1")
    shopee_partner_id: str = field(default_factory=lambda: os.environ.get("SHOPEE_PARTNER_ID", ""))
    shopee_partner_key: str = field(default_factory=lambda: os.environ.get("SHOPEE_PARTNER_KEY", ""))
    shopee_shop_id: str = field(default_factory=lambda: os.environ.get("SHOPEE_SHOP_ID", ""))
    shopee_access_token: str = field(default_factory=lambda: os.environ.get("SHOPEE_ACCESS_TOKEN", ""))
    shopee_session_id: str = field(default_factory=lambda: os.environ.get("SHOPEE_SESSION_ID", ""))

    @property
    def effective_window(self) -> float:
        return max(1.0, self.window_seconds / max(1.0, self.demo_speed))


settings = Settings()
