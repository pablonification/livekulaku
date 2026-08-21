"""Pydantic schemas — 1:1 with contracts/openapi.yaml

Do not hand-edit fields without updating contracts/openapi.yaml first.
Contract is law (AGENTS.md). If they drift, openapi.yaml wins.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CommentIn(BaseModel):
    user: Optional[str] = Field(default=None, example="budi_99")
    text: str = Field(example="kak harga berapa?")
    platform: Literal["tiktok", "shopee", "mock"] = Field(default="mock")
    ts: Optional[int] = Field(default=None, description="unix seconds, optional")


class AnalyzeRequest(BaseModel):
    source: Literal["mock", "shopee", "tiktok"] = Field(default="mock")
    window_seconds: int = Field(default=10, ge=1, le=120)
    comments: List[CommentIn] = Field(default_factory=list, max_length=80)


class ClusterItem(BaseModel):
    label: str
    count: int
    share: float


class TopCluster(BaseModel):
    label: str
    label_id: str
    count: int
    share: float
    samples: List[str]


class AnalyzeResponse(BaseModel):
    total: int
    window_seconds: int
    clusters: List[ClusterItem]
    top_cluster: Optional[TopCluster] = Field(default=None)
    urgency: int = Field(ge=0, le=100)
    suggested_reply: str
    why_now: str
    tone: Literal["closing", "reassure", "inform", "upsell"] = "inform"
    source: str
