# TASK-002 - BE Sync Analyze

**Owner:** BE (1 of 3 devs) - parallel with FE+ML
**Contract:** `contracts/openapi.yaml` → POST /analyze

## What to build
Sync-only endpoint (no background jobs):
`POST /analyze {source, comments, window_seconds}` → `{Priority Card}`

Inside per request:
1. call `classifier.py` per comment → label
2. call `aggregator.py` → clusters + deterministic urgency
3. call `coach.py` (frozen prompt + catalog/playbook) → suggested_reply + why_now
Bake `data/catalog.json` + `data/playbook.json` into image.

## Files you own
- `backend/app/main.py`
- `backend/app/aggregator.py`
- `backend/app/adapters/*.py`
- `contracts/openapi.yaml` (steward - changes need FE+ML review)

## Files you DO NOT touch
- `frontend/*`, `model/training/*`

## Done when
- [ ] `docker compose up` → `POST /analyze` with 18 mock comments returns card matching openapi example (no keys, no internet)
- [ ] `GET /health` returns ok
- [ ] PR includes `curl` proof (copy-paste from README)

## Notes from rulebook
Single sync interaction only - no background pollers in this endpoint. Shopee/TikTok fetch is a plain function call *inside* the request if credentials exist.
