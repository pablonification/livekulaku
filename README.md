# LiveLaku - Flood to Priority Card

**COMPFEST 18 AIC | AI for the Backbone of the Economy | Smart Commerce**

Dual live commerce copilot for TikTok Shop + Shopee Live. Hosts with 500–5k viewers (15–80 c/min) can't read the flood - LiveLaku buffers one **Window** (10s), clusters comments, and returns one **Priority Card** `{top_cluster, urgency 0–100, suggested_reply, why_now}`.

> Rulebook limits for prelim are respected: single input → output FE, sync-only BE, frozen inference. No background jobs, no DB, no auth pages. See `AGENTS.md` for agent rules and `contracts/openapi.yaml` for API contract.

## Stack

- **FE:** plain JS (no build) served by nginx - single page
- **BE:** FastAPI (Python 3.11) - `POST /analyze` sync only
- **AI:** Tier-1 small IndoBERT classifier (supporting model, baked `model/checkpoints/`) + Tier-2 Muse Spark 1.2 contributor (frozen prompt + `data/catalog.json` + `data/playbook.json` via RAG-lite). Mock fallback when no key.
- **Infra:** `docker compose up --build` (offline judge-safe)

## Quick start

```bash
cp .env.example .env   # no keys needed for mock demo
docker compose up --build

# FE → http://localhost:3000
# BE → http://localhost:8000  (docs: /docs, health: /api/health)

# One-window check (mock, offline):
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d @data/demo_comments.jsonl
```

With real providers (optional, only if you set them):

```bash
# .env
META_API_KEY=your_meta_api_key
SHOPEE_PARTNER_ID=...  # plus SHOPEE_* for official polling
TRY_TIKTOK=1           # enable tiktok-live-connector stub
```

`docker compose up` with no keys still shows a full flood → Priority Card via `MockAdapter` + mock coach (judge contract).

## API

Source of truth: `contracts/openapi.yaml`

- `POST /analyze {source: mock|shopee|tiktok, comments: [{user,text,platform,ts}]}` → `Priority Card`
- `GET /api/health`
- Deterministic urgency: `100*(0.5*share + 0.3*intentWeight + 0.2*min(1,total/60))`

## Structure

```
contracts/openapi.yaml   API contract (frozen)
tasks/prelim/TASK-*.md   work tickets - one per dev, agent-friendly
frontend/public/         FE (TASK-001)
backend/app/             BE + adapters + aggregator (TASK-002)
  classifier.py, coach.py  ML hooks (TASK-003)
data/catalog.json, playbook.json, demo_comments.jsonl  frozen RAG content
model/checkpoints/       baked IndoBERT weights (small)
AGENTS.md                how AI agents must work in this repo
CONTEXT.md               glossary (Priority Card, Flood, Window, Adapter)
```

## Working (3 devs parallel)

Pick a ticket → branch `feat/TASK-00X-slug` → code only files listed in ticket → PR with `curl` + screenshot proof → Conventional Commits.

## Model proof (kustomisasi)

Not zero-shot: commit includes supporting IndoBERT classifier (trained) plus RAG over frozen catalog/playbook into Muse Spark. Heavy retrain happens *before* submission; demo inference is static.

## License

For COMPFEST 18 AIC prelim only. See parent `../aic-rulebook.md`.
