# TASK-003 — ML Supporting Model + RAG

**Owner:** ML (1 of 3 devs) — parallel with FE+BE
**Contract:** `contracts/openapi.yaml` → labels + card fields, plus `docs/adr/`

## What to build
Prove "kustomisasi" without shipping a huge model:
- Fine-tune small IndoBERT classifier on `data/demo_comments.jsonl` (500-1k synthetic, 6 labels: harga/bandingkan_harga/ongkir/cod/garansi/stok)
- Commit weights to `model/checkpoints/` (small, baked into image)
- RAG-lite: `data/catalog.json` (5 products) + `data/playbook.json` (templates per label) frozen at build
- `coach.py` prompt is frozen (no retrain during demo)

## Files you own
- `backend/app/classifier.py`
- `backend/app/coach.py`
- `model/training/*`
- `data/catalog.json`, `data/playbook.json`, `data/demo_comments.jsonl`
- `model/checkpoints/` (weights)

## Files you DO NOT touch
- `frontend/*`, `backend/app/main.py` (call your modules, don't edit)

## Done when
- [ ] `classifier.py` keyword baseline vs IndoBERT — accuracy reported in PR (even if small win)
- [ ] `coach.py` with `META_API_KEY` set → Muse Spark 1.2 contributor returns JSON matching AnalyzeResponse; without key → mock template (no crash)
- [ ] Weights + playbook are inside `docker compose` image (offline works)
- [ ] PR links to training notebook/log

## Proof of work
Train log screenshot + `curl POST /analyze` before/after swapping keyword → finetuned (show improvement or honest tie).
