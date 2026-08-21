"""Aggregation window: turns a flood of classified comments into cluster stats.

Pure python (no framework deps) so judges and tests can run it anywhere.

Urgency formula (deterministic, documented in README):
    urgency = 100 * (0.50 * cluster_share + 0.30 * intent_weight + 0.20 * flood_pressure)
    cluster_share  = size of top cluster / total comments in window
    intent_weight  = urgency_weight of the top intent (see intents.py)
    flood_pressure = min(1, total / FLOOD_CAPACITY)
"""
from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field

from .intents import get_intent

FLOOD_CAPACITY = 60  # comments per window that saturates flood pressure


@dataclass
class BufferedComment:
    comment_id: str
    user: str
    text: str
    platform: str
    label: str
    ts: float = field(default_factory=time.time)


class WindowAggregator:
    def __init__(self, window_seconds: float = 10.0):
        self.window_seconds = window_seconds
        self.buffer: list[BufferedComment] = []
        self._window_opened_at = time.time()

    def add(self, c: BufferedComment) -> None:
        self.buffer.append(c)

    def is_due(self) -> bool:
        return (time.time() - self._window_opened_at) >= self.window_seconds

    def reset(self) -> None:
        self.buffer.clear()
        self._window_opened_at = time.time()

    def summarize(self) -> dict:
        """Cluster the current buffer without clearing it."""
        total = len(self.buffer)
        counts = Counter(c.label for c in self.buffer)
        clusters = [
            {"label": label, "count": n, "share": round(n / total, 3) if total else 0}
            for label, n in counts.most_common()
        ]
        return {
            "total": total,
            "window_seconds": self.window_seconds,
            "clusters": clusters,
        }

    def build_card_inputs(self) -> dict:
        """Everything the coach needs, computed deterministically."""
        summary = self.summarize()
        total = summary["total"]
        if total == 0:
            return {"empty": True, **summary}

        top_label, top_count = summary["clusters"][0]["label"], summary["clusters"][0]["count"]
        intent = get_intent(top_label)

        cluster_share = top_count / total
        flood_pressure = min(1.0, total / FLOOD_CAPACITY)
        urgency = round(100 * (
            0.50 * cluster_share
            + 0.30 * intent.urgency_weight
            + 0.20 * flood_pressure
        ))

        samples = [c.text for c in self.buffer if c.label == top_label][:5]
        return {
            "empty": False,
            "total": total,
            "window_seconds": self.window_seconds,
            "clusters": summary["clusters"],
            "top": {
                "label": top_label,
                "label_id": intent.label_id,
                "count": top_count,
                "share": round(cluster_share, 3),
                "urgency_weight": intent.urgency_weight,
                "sample_comments": samples,
            },
            "flood_pressure": round(flood_pressure, 3),
            "urgency": urgency,
            "platforms": dict(Counter(c.platform for c in self.buffer)),
        }
