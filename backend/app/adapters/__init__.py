"""Adapter factory: pick source by MODE env, always safe fallback to mock."""
from __future__ import annotations

from ..config import settings
from .base import BaseAdapter
from .mock import MockAdapter


def get_adapter() -> BaseAdapter:
    speed = settings.demo_speed
    if settings.mode == "shopee":
        from .shopee import ShopeeAdapter

        adapter = ShopeeAdapter(demo_speed=speed)
        if adapter.configured:
            return adapter
        print("[factory] shopee not configured -> falling back to mock")
        return MockAdapter(demo_speed=speed)

    if settings.mode == "tiktok" and settings.try_tiktok:
        from .tiktok import TikTokAdapter

        return TikTokAdapter(username="your_tiktok_shop", demo_speed=speed)

    return MockAdapter(demo_speed=speed)
