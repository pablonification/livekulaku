# TASK-002 - BE Sync Analyze

**Owner:** BE (1 of 3 devs) - parallel with FE+ML
**Contract:** `contracts/openapi.yaml` → POST /analyze

## What to build
Sync-only endpoint (no background jobs):
`POST /analyze {source, handle, session_id, comments, window_seconds}` → `{Priority Card}`

Inside per request (single call, no hold between requests):
1. if `comments` is non-empty: use it directly (Mock mode and FE-batched Window)
2. if `comments` is empty and `handle` with `source: tiktok`: fetch real TikTok comments for one Window inside this request via `adapters/tiktok.py` (connect, collect for window_seconds, disconnect), then continue. Same for `session_id` with `source: shopee` via `adapters/shopee.py` one-shot poll. No background job lives beyond the request.
3. call `classifier.py` per comment → label
4. call `aggregator.py` → clusters + deterministic urgency
5. call `coach.py` (frozen prompt + catalog/playbook) → suggested_reply + why_now
Bake `data/catalog.json` + `data/playbook.json` into image.

## Files you own
- `backend/app/main.py`
- `backend/app/aggregator.py`
- `backend/app/adapters/*.py`
- `contracts/openapi.yaml` (steward - changes need FE+ML review)

## Files you DO NOT touch
- `frontend/*`, `model/training/*`

## Done when
- [x] `docker compose up` with no keys → `POST /analyze` with 18 mock comments returns card matching openapi example (offline judge) - verified via TestClient and CI docker build
- [x] `POST /analyze {source: "tiktok", handle: "@test", comments: []}` with `TRY_TIKTOK=1` attempts a live fetch inside the request and still returns a valid card shape (empty Window is valid if not live) - graceful fallback when not live or TikTokLive not installed
- [x] `GET /health` returns ok
- [x] PR includes `curl` proof for both mock (`comments`) and live (`handle`) modes

## Notes from rulebook
Single sync interaction only - no background pollers in this endpoint. Shopee/TikTok fetch is a plain function call *inside* the request if credentials exist.
