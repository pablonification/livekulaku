"""Pydantic schemas - 1:1 with contracts/openapi.yaml

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


class ProductIn(BaseModel):
    name: str = Field(example="Kaos Oversize Hitam")
    price: Optional[str] = Field(default=None, example="99k")
    promo: Optional[str] = Field(default=None, example="free ongkir Jawa")
    stock: Optional[int] = Field(default=None, example=42)


class CatalogParseRequest(BaseModel):
    url: Optional[str] = Field(default=None, description="product share link (vt.tokopedia.com, id.shp.ee, shopee.co.id)")
    text: Optional[str] = Field(default=None, description="share-sheet text blob pasted by seller")


class CatalogParseResponse(BaseModel):
    name: Optional[str] = None
    price: Optional[str] = None
    promo: Optional[str] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    parse_source: Literal["link", "text", "manual"]
    needs_manual: List[Literal["name", "price", "promo", "stock"]]


class AnalyzeRequest(BaseModel):
    source: Literal["mock", "shopee", "tiktok"] = Field(default="mock")
    window_seconds: int = Field(default=10, ge=1, le=120)
    handle: Optional[str] = Field(default=None, example="@tokoku", description="TikTok handle for live fetch when comments empty")
    session_id: Optional[str] = Field(default=None, example="6236215", description="Shopee session id for live fetch when comments empty")
    products: List[ProductIn] = Field(default_factory=list, max_length=20, description="Seller Catalog sent inline; grounds suggested_reply")
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
    suggested_reply: Optional[str] = Field(default=None, description="optional coaching; topic is the main output")
    why_now: str
    tone: Literal["closing", "reassure", "inform", "upsell"] = "inform"
    source: Literal["mock", "template", "muse-spark-1.2-contributor"] = "mock"
