"""Mock adapter: bursty replay of data/demo_comments.jsonl.

This is the judge-facing default: deterministic, offline, loops forever.
delay_ms in the file controls pacing; DEMO_SPEED divides it.
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import AsyncIterator

from ..aggregator import BufferedComment
from ..config import settings
from .base import BaseAdapter, sleep_scaled

DEFAULT_DATA = Path(__file__).resolve().parents[2] / "data" / "demo_comments.jsonl"


class MockAdapter(BaseAdapter):
    name = "mock"

    def __init__(self, demo_speed: float = 1.0, path: Path | None = None):
        self.demo_speed = demo_speed
        self.path = path or DEFAULT_DATA
        self.inject_queue: asyncio.Queue[BufferedComment] = asyncio.Queue()

    def _load(self) -> list[dict]:
        rows: list[dict] = []
        with self.path.open() as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
        return rows or [{"user": "demo", "text": "min info", "platform": "tiktok", "delay_ms": 500}]

    async def stream(self) -> AsyncIterator[BufferedComment]:
        seq = 0
        while True:
            for row in self._load():
                # manual injections (judge clicks a button) jump the queue
                while not self.inject_queue.empty():
                    yield self.inject_queue.get_nowait()

                seq += 1
                yield BufferedComment(
                    comment_id=f"mock-{seq}",
                    user=row.get("user", "viewer"),
                    text=row.get("text", ""),
                    platform=row.get("platform", "tiktok"),
                )
                await sleep_scaled(row.get("delay_ms", 800) / 1000.0, self.demo_speed)

    async def inject(self, text: str, user: str = "judge", platform: str = "tiktok") -> None:
        seq = int(time.time() * 1000) % 1_000_000
        await self.inject_queue.put(
            BufferedComment(comment_id=f"inject-{seq}", user=user, text=text, platform=platform)
        )

