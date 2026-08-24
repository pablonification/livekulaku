# IndoBERT intent fine-tune

The dataset contains 800 synthetic Indonesian live-commerce comments across the seven sales intents and the `browse` fallback. The templates were produced with an LLM-assisted synthetic generation pass, and `generate_dataset.py` expands them deterministically into a stratified 80/10/10 train, validation, and test split.

Exactly 80 rows have `review_required: true`. A team member must inspect those rows and change `review_status` from `pending` to `approved` or `corrected` before claiming the required 10 percent human spot-check. This repository does not claim that pending work is complete.

Install the isolated training dependencies and run the fine-tune from the repository root:

```sh
python3 -m venv .venv-training
.venv-training/bin/pip install -r model/training/requirements.txt
.venv-training/bin/python model/training/train.py
```

The command writes the selected model and tokenizer files to `model/checkpoints/` and the held-out metrics to `model/training/evaluation.json`. Large weight files are ignored by Git. The committed evaluation report must only contain results produced by this command.

To reproduce only the keyword baseline without installing ML packages:

```sh
python3 model/training/train.py --baseline-only
```
