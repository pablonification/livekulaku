# TASK-001 - FE Window + Single Page

**Owner:** FE (1 of 3 devs) - can run in parallel with BE+ML
**Contract:** `contracts/openapi.yaml` → POST /analyze

## What to build
Single page: dropdown `[Mock | Shopee | TikTok]` + one input field + one output.
- Mock → button "Play Flood" replays `data/demo_comments.jsonl`
- Shopee → input `session_id`
- TikTok → input `@handle`
Frontend **batches one Window (10s)** in browser, then POSTs once:
`POST /analyze {source, comments: [...]}` → renders `Priority Card`.

## Files you own (only these)
- `frontend/public/index.html`
- `frontend/public/app.js`
- `frontend/public/style.css`

## Files you DO NOT touch
- `backend/*`, `model/*`, `data/*.json` (read only)

## Done when
- [ ] `docker compose up` → http://localhost:3000 shows page
- [ ] Mock flood 18 comments → one Priority Card appears (from example in openapi.yaml)
- [ ] Shopee/TikTok input switches placeholder text
- [ ] PR includes screenshot + 30s screen recording (like OSKM proof-of-work)

## Proof of work
`curl -X POST localhost:8000/analyze` with example body returns same card shape you render.
