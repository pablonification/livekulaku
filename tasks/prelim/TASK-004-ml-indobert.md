# TASK-004 - ML IndoBERT Classifier Fine-tune

**Owner:** ML (IndoBERT) - parallel with FE, BE, and TASK-003
**Contract:** `contracts/openapi.yaml` -> comment `label` taxonomy, plus `backend/app/intents.py`
**Depends on:** TASK-002 calls your `classifier.py`, but you can train and evaluate offline

## What to build
Prove kustomisasi with a small supporting trained model (not a huge LLM). Fine-tune IndoBERT for live-comment intent.

- Labels (7): `harga`, `bandingkan_harga`, `ongkir`, `cod`, `garansi`, `stok`, `checkout`, plus `browse` fallback. See `backend/app/intents.py` for canonical weights.
- Dataset: `data/demo_comments.jsonl` - 500 to 1k synthetic Indonesian live comments, 6-7 labels, split 80/10/10. Generate via `facebook/mms-tts-ind` or LLM synthetic plus 10 percent human spot-check. Keep file small and committed.
- Training: `model/training/train.py` or notebook, outputs `model/checkpoints/` (IndoBERT base, e.g. `indobenchmark/indobert-base-p1`). Use QLoRA or full fine-tune, but keep checkpoint under 500MB and gitignored binaries except small adapter if possible. Document `W E R` or accuracy.
- `backend/app/classifier.py` exposes `get_classifier(mode)` with `keyword` baseline (always works) and `local` that loads `model/checkpoints` when `CLASSIFIER_MODE=local` and files exist, otherwise falls back silently.
- Commit training log and eval `accuracy` vs `keyword` baseline, honest even if tie (see StokCerdas honesty).

## Files you own (only these)
- `backend/app/classifier.py`
- `backend/app/intents.py`
- `model/training/*`
- `data/demo_comments.jsonl`
- `model/checkpoints/` (weights, gitignored binaries but folder tracked)

## Files you DO NOT touch
- `frontend/*`, `backend/app/main.py`, `backend/app/coach.py`, `data/catalog.json`, `data/playbook.json`, `contracts/openapi.yaml` (read only)

## Done when
- [ ] `pytest backend/tests/test_contract.py` still passes (no drift)
- [ ] `classifier.py` keyword baseline vs IndoBERT - accuracy reported in PR (e.g. 0.72 vs 0.85) with confusion matrix snippet
- [ ] `CLASSIFIER_MODE=keyword` (default) and `CLASSIFIER_MODE=local` both run without crash, `docker compose up` works with or without checkpoints
- [ ] Weights are inside image when present (`docker compose exec backend ls /app/model/checkpoints` shows files) or gracefully missing
- [ ] No bulk-test scripts committed per rulebook, only training log

## Proof of work
- Train log screenshot plus `curl POST /analyze` before and after swapping `CLASSIFIER_MODE` (show label change)
- Link to training run (Colab or local) and dataset generation note

## Notes
Keep it boring: IndoBERT small, not Qwen 7B. This task plus TASK-003 together satisfy clarification: supporting trained model plus RAG.
