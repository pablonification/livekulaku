# TASK-005 - Seller Catalog Grounding + Topic-First Card

**Owner:** TBD (mega-ticket, 1 owner tonight, deadline 25 Aug 23:55 WIB)
**Contract:** `contracts/openapi.yaml` → adds `POST /catalog/parse`, extends `POST /analyze`
**Mode:** Maintainer mode authorized by steward this session. Contract edits still go through PR with FE+ML review.
**Cut order if hours run out:** catalog ingestion > LLM grounding > topic-first UI. Videos and proposal outrank all three.

## What to build

### 1. Contract (PR needs FE+ML review)
- New sync setup-time endpoint, stateless:
  `POST /catalog/parse {url?} | {text?}` → `{name, price?, promo?, stock?, image_url?, parse_source: link|text|manual, needs_manual: [...]}`. Never raises. 5s timeout. Nothing stored.
- `AnalyzeRequest` gains optional `products: [{name (required), price?, promo?, stock?}]`, maxItems 20.
- `AnalyzeResponse.suggested_reply` becomes nullable (removed from required list). `why_now` stays required.
- `source` response enum gains `template` alongside existing values so the keyless fallback is honest.

### 2. BE: link/text parsing (`backend/app/catalog_parse.py`)
Plain httpx inside the request, no browsers, no proxies:
- TikTok Shop ID: `vt.tokopedia.com/t/*` resolves to `shop-id.tokopedia.com/view/product/<id>` whose Location header carries `og_info` JSON with title + image. Fallback: fetch page `og:title`.
- Shopee: `id.shp.ee/*` resolves to `shopee.co.id/product/<shopid>/<itemid>`. Name from `og:title` (strip leading `Jual `), price from first `Rp` regex hit in HTML, promo keywords from `og:description` (gratis ongkir, COD, cashback).
- Share-text regex: `Name ... Rp99.000 ... https://...` pasted blobs.
- Verified live 24 Aug against real links: Tokopedia gives name+image auto, price manual; Shopee gives name+price auto, promo hint, stock manual. Unparsed fields land in `needs_manual`.

### 3. BE: grounded replies (`backend/app/coach.py`)
- If `products` present: ground coaching on them. Muse Spark key exists → LLM writes `suggested_reply` (Indonesian, 1-2 speakable sentences, only submitted fields, no invented facts) with strict JSON output validation; any failure falls back to deterministic templates filled from the same products.
- No products: current frozen playbook behavior unchanged.
- No key or LLM failure: template fallback, labeled `source: template`. Offline judge path stays green.
- Urgency and clusters stay classifier-deterministic. LLM never touches numbers.

### 4. FE: Katalog Saya panel + topic-first card
- Setup panel: paste link or share-text → `POST /catalog/parse` → prefilled editable rows; add/edit/remove; held in browser memory; sent as `products` on every `/analyze` call.
- Card hierarchy: topic headline + urgency + why_now are THE card. `suggested_reply` renders behind a collapsed `Lihat saran` expander when present; clean empty state when null.
- Panel counts as session configuration (like the source selector), not a second analysis input, keeping rulebook one-input flow intact.

## Files you own
- `contracts/openapi.yaml` (steward mode, see above)
- `backend/app/main.py`, `backend/app/coach.py`, `backend/app/schemas.py`, `backend/app/catalog_parse.py`, `backend/tests/*`
- `frontend/src/*`
- `CONTEXT.md` (already updated this session: Priority Card redefined, Seller Catalog added)
- `tasks/prelim/TASK-005-seller-catalog-card.md`

## Files you DO NOT touch
- `data/catalog.json`, `data/playbook.json`, `model/training/*`, CI config

## Done when
- [x] `docker compose up` no keys → mock flood → card with template-labeled suggestion (offline judge contract intact) - verified: keyless boot returns source=template grounded on submitted products; with .env key returns muse-spark-1.2-contributor
- [x] `curl POST /catalog/parse {"url":"<vt.tokopedia.com short link>"}` returns name+image, `needs_manual` contains price - verified live 24 Aug via share-text blob carrying the link
- [x] `curl POST /catalog/parse {"url":"<id.shp.ee link>"}` returns name+price - verified live 24 Aug during grilling session (og:title + Rp regex)
- [x] share-text blob parses to same shape - verified offline, deterministic
- [x] `/analyze` with `products:[{name:"Kaos Hitam",price:"99k"}]` yields grounded reply naming that product - verified both template and LLM engines
- [x] `suggested_reply: null` renders clean card without expander - FE expander hidden when null; empty-window cards show why_now
- [x] pytest green incl. contract test updates (14 passed, 2 skipped live-gated); lint (no em dash) green; vite build green
- [ ] curl proofs captured for PR (`PROOF-PENDING` - human replaces with OS-tagged captures; commands in session log, macOS)
- [x] Optional: ADR still open - not blocking

## Proof commands (macOS, run against HEAD)
```bash
pytest backend/tests/test_contract.py backend/tests/test_catalog_and_coach.py -v
docker compose build
docker compose up -d && sleep 6
curl -sf http://localhost:8000/api/health
curl -s -X POST http://localhost:8000/api/catalog/parse -H "Content-Type: application/json" -d '{"text":"Kaos Oversize Hitam Rp99.000 https://vt.tokopedia.com/t/ZS9BRhoHp6Vgc-mhs03/"}'
curl -s -X POST http://localhost:8000/api/analyze -H "Content-Type: application/json" -d '{"source":"mock","window_seconds":10,"products":[{"name":"Kaos Oversize Hitam","price":"99k","promo":"gratis ongkir Jawa"}],"comments":[{"user":"budi_99","text":"kak harga berapa?","platform":"tiktok"},{"user":"sari","text":"spill harga dong kak","platform":"shopee"}]}'
docker compose down -v
grep -R "$(printf '\xE2\x80\x94')" --exclude-dir=.git --exclude-dir=.agents --exclude-dir=.claude --include="*.md" --include="*.yaml" --include="*.py" --include="*.js" --include="*.jsx" .
```
PROOF-PENDING

## Notes from rulebook
Sync-only: `/catalog/parse` is one-shot inside the request like live comment fetch. No DB, no background jobs, no scraping infra dependencies added to the image.
