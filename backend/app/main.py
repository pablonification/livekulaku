"""LiveLaku backend: sync POST /analyze (rulebook: sync-only, single input→output).

Also keeps legacy WS /api/live/* for local dev; prelim contract is POST /analyze.
Schemas are 1:1 with contracts/openapi.yaml - see backend/app/schemas.py.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from .aggregator import BufferedComment, WindowAggregator
from .classifier import get_classifier
from .config import settings
from .coach import get_coach
from .schemas import AnalyzeRequest, AnalyzeResponse, ClusterItem, CommentIn, TopCluster

app = FastAPI(title="LiveLaku", version="0.1.0")


class Hub:
    """Fan-out server events to every connected dashboard."""

    def __init__(self) -> None:
        self.clients: Set[WebSocket] = set()  # type: ignore[assignment]

    async def join(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def leave(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        msg = json.dumps({"type": event_type, **payload}, ensure_ascii=False)
        dead: list[WebSocket] = []
        for ws in list(self.clients):
            try:
                await ws.send_text(msg)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.leave(ws)


class Runtime:
    """Owns the ingestion pipeline lifecycle (one at a time)."""

    def __init__(self) -> None:
        self.hub = Hub()
        self.aggregator = WindowAggregator(settings.effective_window)
        self.classifier = get_classifier(settings.classifier_mode)
        self.coach = get_coach(settings)
        self._task: Optional[asyncio.Task] = None
        self.mode: str = "idle"
        self.stats = {"classified": 0}

    # -- pipeline ---------------------------------------------------------
    async def start(self, mode: Optional[str] = None) -> dict:
        if mode:
            settings.mode = mode
        await self.stop()
        from .adapters import get_adapter

        adapter = get_adapter()
        self.mode = adapter.name
        self._task = asyncio.create_task(self._run(adapter))
        await self.hub.broadcast("status", {"mode": self.mode,
                                            "classifier": getattr(self.classifier, "name", "?"),
                                            "coach": getattr(self.coach, "name", "?")})
        return {"started": self.mode}

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        self._task = None
        self.mode = "idle"

    def inject(self, text: str) -> None:
        if self._task and hasattr(self._adapter_ref(), "inject"):
            asyncio.get_running_loop().create_task(self._adapter_ref().inject(text))  # type: ignore[attr-defined]

    def _adapter_ref(self):  # tiny helper; mock adapter exposes inject
        return getattr(self, "_current_adapter", None)

    async def _run(self, adapter) -> None:
        self._current_adapter = adapter
        loop = asyncio.get_running_loop()
        last_flush = loop.time()

        async def coach_tick() -> None:
            nonlocal last_flush
            while True:
                await asyncio.sleep(0.25)
                if self.aggregator.is_due():
                    inputs = self.aggregator.build_card_inputs()
                    summary = {k: inputs[k] for k in ("total", "window_seconds", "clusters")}
                    await self.hub.broadcast("window_summary", summary)
                    card_payload: dict[str, Any]
                    if inputs.get("empty"):
                        card_payload = {"card": None}
                    else:
                        try:
                            suggestion = await asyncio.wait_for(
                                self.coach.generate(inputs), timeout=8.0
                            )
                        except Exception as exc:  # noqa: BLE001 - API down => fallback
                            print(f"[coach] provider failed ({exc}) -> mock template")
                            suggestion = await MockLikeFallback().generate(inputs)
                        card_payload = {
                            "card": {
                                **inputs["top"],
                                "urgency": inputs["urgency"],
                                "flood_pressure": inputs["flood_pressure"],
                                "total": inputs["total"],
                                "platforms": inputs["platforms"],
                                **suggestion,
                                "source": getattr(self.coach, "name", "mock"),
                                "generated_at": int(time.time()),
                            }
                        }
                    await self.hub.broadcast("card", card_payload)
                    self.aggregator.reset()
                    last_flush = loop.time()

        coach_task = asyncio.create_task(coach_tick())
        try:
            async for c in adapter.stream():
                label, conf = self.classifier.predict(c.text)
                self.stats["classified"] += 1
                await self.hub.broadcast("comment", {
                    "comment_id": c.comment_id, "user": c.user, "text": c.text,
                    "platform": c.platform, "label": label, "confidence": round(conf, 2),
                    "ts": int(time.time()),
                })
                self.aggregator.add(BufferedComment(**c.__dict__, label=label))
        finally:
            coach_task.cancel()

    # mock inject support -------------------------------------------------
    async def do_inject(self, text: str) -> dict:
        adapter = getattr(self, "_current_adapter", None)
        if adapter is not None and hasattr(adapter, "inject"):
            await adapter.inject(text)
            return {"injected": text}
        return {"injected": False, "reason": "active adapter does not support inject"}


class MockLikeFallback:
    """Import-light duplicate of MockCoach for emergency fallback inside runtime."""

    async def generate(self, card_inputs: dict) -> dict:
        from .coach import MockCoach

        return await MockCoach().generate(card_inputs)


runtime = Runtime()


# ---------------------------------------------------------------- helpers for real live (sync per-request fetch)
async def _fetch_tiktok_window(handle: str, window_seconds: int) -> list:
    """Collect real TikTok comments for one Window via zerodytrash Node helper, sync inside the request. No background hold."""
    if not settings.try_tiktok:
        print("[tiktok fetch] TRY_TIKTOK=0, skipping live fetch (mock/judge path)")
        return []
    # Call Node helper: backend/scripts/tiktok-fetch.js (works both locally and in Docker at /app/scripts)
    import json as _json
    from pathlib import Path as _Path

    helper = _Path(__file__).resolve().parents[1] / "scripts" / "tiktok-fetch.js"
    if not helper.exists():
        # fallback to old Python adapter if Node helper missing (local dev without Docker)
        try:
            from .adapters.tiktok import TikTokAdapter

            return await TikTokAdapter.fetch_once(handle, collect_seconds=max(2, min(window_seconds, 12)))
        except Exception as exc:
            print(f"[tiktok fetch] helper missing and fallback failed: {exc}")
            return []
    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(helper),
            handle,
            str(max(2, min(window_seconds, 12))),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=window_seconds + 7)
        except asyncio.TimeoutError:
            proc.kill()
            stdout, stderr = await proc.communicate()
            print(f"[tiktok fetch] timeout for {handle}")
            return []
        if proc.returncode != 0:
            msg = stderr.decode()[:300] if stderr else ""
            print(f"[tiktok fetch] node exit {proc.returncode} for {handle}: {msg}")
            # still try to parse stdout if any
        text = stdout.decode().strip() if stdout else ""
        if not text:
            return []
        data = _json.loads(text)
        out: list[dict] = []
        for c in data:
            if isinstance(c, dict) and c.get("text"):
                out.append({"user": str(c.get("user") or "viewer"), "text": str(c["text"]), "platform": "tiktok"})
        return out
    except Exception as exc:
        print(f"[tiktok fetch] failed for {handle}: {exc}")
        return []


async def _fetch_shopee_window(session_id: str) -> list:
    """One-shot Shopee official poll inside the request."""
    try:
        from .adapters.shopee import ShopeeAdapter

        adapter = ShopeeAdapter(session_id=session_id)
        if not adapter.configured:
            print("[shopee fetch] SHOPEE_* env not configured, returning empty window")
            return []
        return await adapter.fetch_once()
    except Exception as exc:
        print(f"[shopee fetch] failed for {session_id}: {exc}")
        return []


# ---------------------------------------------------------------- sync contract (prelim)
@app.post("/analyze", response_model=AnalyzeResponse)
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Single Window in → one Priority Card out. Statically validated against contracts/openapi.yaml."""
    # If FE sent handle/session_id but no comments, fetch real comments inside this single request (sync, no background job)
    raw_comments = list(req.comments)
    if not raw_comments and req.handle and req.source == "tiktok":
        fetched = await _fetch_tiktok_window(req.handle, req.window_seconds)
        raw_comments = [CommentIn(**c) for c in fetched]  # type: ignore[arg-type]
    elif not raw_comments and req.session_id and req.source == "shopee":
        fetched = await _fetch_shopee_window(req.session_id)
        raw_comments = [CommentIn(**c) for c in fetched]  # type: ignore[arg-type]

    # stateless per-request aggregator - no background state
    agg = WindowAggregator(window_seconds=req.window_seconds)
    # classifier is request-local or reused; reload is cheap
    classifier = get_classifier(settings.classifier_mode)
    # map comments → labeled buffer
    for idx, c in enumerate(raw_comments):
        label, _ = classifier.predict(c.text or "")
        agg.add(BufferedComment(comment_id=f"req-{idx}", user=c.user or "viewer", text=c.text, platform=c.platform, label=label))
    inputs = agg.build_card_inputs()

    # empty window → still valid response (no crash for FE)
    if inputs.get("empty"):
        return AnalyzeResponse(
            total=0,
            window_seconds=req.window_seconds,
            clusters=[],
            top_cluster=None,
            urgency=0,
            suggested_reply="Belum ada komen di Window ini - putar Mock Flood untuk demo.",
            why_now="Window kosong, tidak ada cluster.",
            tone="inform",
            source=getattr(get_coach(settings), "name", "mock"),
        )

    # non-empty → coach
    coach = get_coach(settings)
    try:
        suggestion = await asyncio.wait_for(coach.generate(inputs), timeout=8.0)
    except Exception as exc:  # noqa: BLE001 - API down → deterministic fallback
        print(f"[coach] api failed ({exc}) → mock template")
        from .coach import MockCoach

        suggestion = await MockCoach().generate(inputs)

    top = inputs["top"]
    return AnalyzeResponse(
        total=inputs["total"],
        window_seconds=req.window_seconds,
        clusters=[ClusterItem(**c) for c in inputs["clusters"]],  # type: ignore[arg-type]
        top_cluster=TopCluster(label=top["label"], label_id=top["label_id"], count=top["count"], share=top["share"], samples=top["sample_comments"]),
        urgency=inputs["urgency"],
        suggested_reply=suggestion["suggested_reply"],
        why_now=suggestion["why_now"],
        tone=suggestion.get("tone", "inform"),  # type: ignore[arg-type]
        source=getattr(coach, "name", "mock"),
    )


# ---------------------------------------------------------------- legacy / dev routes (keep for local WS demo)
@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "mode": runtime.mode,
        "classifier": getattr(runtime.classifier, "name", "?"),
        "coach": getattr(runtime.coach, "name", "?"),
        "window_seconds": settings.effective_window,
        "stats": runtime.stats,
    }


class StartBody(BaseModel):
    mode: Optional[str] = None


@app.post("/api/live/start")
async def live_start(body: StartBody) -> dict:
    return await runtime.start(body.mode)


@app.post("/api/live/stop")
async def live_stop() -> dict:
    await runtime.stop()
    return {"stopped": True}


class InjectBody(BaseModel):
    text: str


@app.post("/api/live/inject")
async def live_inject(body: InjectBody) -> dict:
    return await runtime.do_inject(body.text)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await runtime.hub.join(ws)
    try:
        await ws.send_text(json.dumps({
            "type": "status",
            "mode": runtime.mode,
            "classifier": getattr(runtime.classifier, "name", "?"),
            "coach": getattr(runtime.coach, "name", "?"),
            "window_seconds": settings.effective_window,
        }))
        while True:
            await ws.receive_text()  # keepalive pings from client are ignored
    except WebSocketDisconnect:
        pass
    finally:
        runtime.hub.leave(ws)
