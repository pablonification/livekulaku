"""TikTok adapter via TikTokLive python client (unofficial, disclosed).

Enabled ONLY when MODE=tiktok and TRY_TIKTOK=1 - judges never touch this.
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
                    comment_id=f"tiktok-{event.comment}",
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
