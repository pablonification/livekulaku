"""Adapter contract: every platform source normalizes into BufferedComment flow."""
from __future__ import annotations

import abc
import asyncio
from typing import AsyncIterator

from ..aggregator import BufferedComment


class BaseAdapter(abc.ABC):
    """Yields comments until cancelled. Must never raise unhandled exceptions."""

    name: str = "base"

    @abc.abstractmethod
    def stream(self) -> AsyncIterator[BufferedComment]: ...


async def sleep_scaled(seconds: float, demo_speed: float) -> None:
    await asyncio.sleep(max(0.0, seconds) / max(1.0, demo_speed))
