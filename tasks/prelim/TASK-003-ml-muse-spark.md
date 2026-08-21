# TASK-003 - ML Muse Spark Coach + RAG

**Owner:** ML (Muse) - parallel with FE, BE, and TASK-004
**Contract:** `contracts/openapi.yaml` -> AnalyzeResponse fields `suggested_reply`, `why_now`, `tone`
**Depends on:** TASK-002 provides `POST /analyze` shape, but you can develop coach in isolation via unit test

## What to build
Wire Tier-2 coach using Muse Spark 1.2 contributor (Meta API) with frozen RAG-lite. No training at demo time.

- Implement `backend/app/coach.py` with two providers:
  - `MockCoach` - deterministic template from `data/catalog.json` + `data/playbook.json`, always works offline (judge contract)
  - `MuseSparkCoach` - calls `muse-spark-1.2-contributor` via OpenAI-compatible API at `api.meta.ai/v1`, `reasoning_effort: minimal`, `response_format: json_schema`, with system prompt built from catalog + playbook
- `get_coach(settings)` returns `MuseSparkCoach` only when `META_API_KEY` is set, otherwise `MockCoach`, and never crashes (fallback on API error)
- Freeze `data/catalog.json` (3-5 products with price, promo, stock) and `data/playbook.json` (template per label: harga, bandingkan_harga, ongkir, cod, garansi, stok, checkout) at build time, baked into image

## Files you own (only these)
- `backend/app/coach.py`
- `data/catalog.json`
- `data/playbook.json`

## Files you DO NOT touch
- `frontend/*`, `backend/app/main.py`, `backend/app/classifier.py`, `backend/app/intents.py`, `model/*`, `data/demo_comments.jsonl`, `contracts/openapi.yaml` (read only)

## Done when
- [ ] `POST /analyze` with `META_API_KEY` unset returns mock card with `source: mock-coach` and no crash (offline judge)
- [ ] `POST /analyze` with `META_API_KEY` set returns card with `source: muse-spark-1.2-contributor` and JSON matches `AnalyzeResponse` schema
- [ ] Templates use only known placeholders `{product}`, `{price}`, `{promo}`, `{shipping}`, `{count}` and safe fallback for unknown labels (no KeyError)
- [ ] `docker compose up --build` includes catalog and playbook inside image (verified via `docker compose exec backend cat /app/data/catalog.json`)
- [ ] No em dash in any template or prompt

## Proof of work
- `curl POST /analyze` proof for both modes (without key and with key), plus `docker compose exec` proof that files are baked
- Screenshot of Muse Spark dashboard showing model `muse-spark-1.2-contributor` usage (optional)

## Notes
Prompt and templates are frozen at build, no retrain button per rulebook. Keep `reasoning_effort` minimal for latency.
