# AGENTS.md - LiveLaku, rules for AI coding agents

This repo is built by 3 devs + AI agents for COMPFEST 18 AIC prelim (deadline **25 Aug 23:55 WIB**). Repo state is truth - not your chat memory. Read files before you code.

## Project snapshot (so you don't re-ask)

**LiveLaku = TikTok + Shopee live commerce copilot for flood.** Host with 500–5k viewers (15–80 c/min) can't read flood; we buffer one **Window** (10s), cluster comments, return one **Priority Card** `{top_cluster, urgency 0–100 deterministic, suggested_reply, why_now}`. FE shows live bars; card is the only action per Window. See `CONTEXT.md` for language.

**Stack (keep it boring):** `FastAPI (Python 3.11) + plain JS (no build) + Docker Compose + Muse Spark 1.2 contributor (Tier-2) + small IndoBERT classifier (Tier-1) + tiny frozen catalog/playbook`. No auth, no DB, no history page - rulebook forbids it for prelim.

**Key docs:**
- `CONTEXT.md` - glossary (Priority Card, Flood, Window, Adapter). Challenge any term that conflicts.
- `contracts/openapi.yaml` - API contract, source of truth. `POST /analyze {source, comments}` → `Priority Card`. Do not improvise fields.
- `tasks/prelim/TASK-*.md` - work contract per dev. One ticket per session.
- `aic-rulebook.md` (in parent `../`) - Hard limits: sync only, single input→output FE, static inference, fine-tune proof required.

## Mode: implementer (default)

You are an implementer. You touch **only** files listed in the ticket's "Files you own".

### Start session (mandatory)

1. Read the ticket the user named, e.g. `tasks/prelim/TASK-001-fe-window.md`. If user names no ticket - ASK, don't invent.
2. Read `contracts/openapi.yaml` relevant section + `CONTEXT.md`.
3. State back your understanding in 2–3 sentences + plan. Wait for "go" if user wants to correct.

### Working rules

- **Hard boundary:** touch only files under "Files you own". Do NOT touch `contracts/openapi.yaml` (steward is BE, needs FE+ML review), other person's task files, or CI config. Stuck? Report blocker, don't improvise.
- **Contract is law:** endpoint/fields come only from `contracts/openapi.yaml`. Missing field → log blocker, don't add it silently.
- **Sync only:** no background workers, no WS pollers in this endpoint. `POST /analyze` is a plain function call per request. Mock floods via replay; Shopee/TikTok fetch is a function call *inside* the request when creds exist.
- **Frozen at demo:** classifier weights + `data/catalog.json` + `data/playbook.json` + coach prompt are baked into the image. No retrain button, no auto-tune, no bulk-test scripts in repo per rulebook.
- **One ticket per session:** finish it until runnable. Half-done large chunk is worse than small finished one.
- **Conventional Commits required:** `feat: ...`, `fix: ...`, `docs: ...` per `https://www.conventionalcommits.org/`. Non-conforming commits fail review. Use plain hyphens or commas, never em dashes.
- **Tests from Done:** every checkbox in the ticket's "Done when" becomes a check you run. `docker compose up` + `curl POST /analyze` must stay green.
- **No em dash allowed:** never use em dashes (--) in any text you produce, including commit messages, PR titles, PR bodies, docs, copywriting, or code comments. Use hyphens (-), commas, periods, or line breaks instead. This is a hard lint rule.
- **Squash merge only:** every PR merges via squash. Never use merge commits or rebase merges. Use `gh pr merge --squash --delete-branch` or GitHub UI Squash and merge.

### Proof of work (human captures, you prepare)

- **BE:** write exact `curl` commands for the author's OS, run them yourself against your HEAD, hand them over with commit + OS.
- **FE:** write shot list mapped to Done checkboxes (empty/loading/success) for human screen recording.
- Leave `PROOF-PENDING` placeholders in PR - human replaces them. Don't delete the proof section.

### CI

- GitHub CI runs `backend` (pytest + contract), `docker` (compose build + healthcheck + smoke POST), and `lint` (no em dash). Keep them green.
- If CI fails due to billing or runner limit, run the same checks **locally** and treat local green as the gate:
  ```bash
  pytest backend/tests/test_contract.py -v
  docker compose build
  docker compose up -d && curl -sf http://localhost:8000/api/health && curl -sf -X POST http://localhost:8000/analyze -H "Content-Type: application/json" -d '{"source":"mock","window_seconds":10,"comments":[{"text":"kak harga berapa?"}]}' | grep -q suggested_reply; docker compose down -v
  grep -R "—" --exclude-dir=.git --exclude-dir=.agents --exclude-dir=.claude --include="*.md" --include="*.yaml" --include="*.py" --include="*.js" --include="*.html" .
  ```
- Do not invent a pass when a required check is not green and no local proof exists.

### End session

- `docker compose up --build` boots with **no keys** and shows mock flood → card (offline judge contract).
- Lint + `curl` checks pass (CI green or local green when CI is limited).
- Update ticket's Done checkboxes.
- State what's still open.

## Maintainer mode

Only when user says "maintainer mode". Then you may touch cross-cutting files (`contracts/*`, `docker-compose.yml`, `AGENTS.md`) and multiple tickets. Still need PR, still no direct push to `main`.

## Document map

| File | What |
|---|---|
| `CONTEXT.md` | Glossary - read before you name anything |
| `contracts/openapi.yaml` | API contract - read-only in implementer mode |
| `tasks/prelim/TASK-*.md` | Work ticket - your only scope for this session |
| `data/catalog.json` + `data/playbook.json` | Frozen RAG content (ML owns) |
| `../aic-rulebook.md` | Hard competition limits |

If `CONTEXT.md` and code disagree - call it out immediately. That's the job.
