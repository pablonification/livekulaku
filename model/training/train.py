"""Fine-tune IndoBERT and compare it with the keyword baseline.

Run from the repository root after installing the training dependencies:
    python model/training/train.py
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.classifier import KeywordClassifier
from backend.app.intents import ID_TO_LABEL, LABELS, LABEL_TO_ID


def read_rows(path: Path) -> list[dict[str, Any]]:
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            row = json.loads(line)
            if row.get("label") not in LABEL_TO_ID:
                raise ValueError(f"unknown label on line {line_number}: {row.get('label')}")
            if row.get("split") not in {"train", "validation", "test"}:
                raise ValueError(f"unknown split on line {line_number}: {row.get('split')}")
            rows.append(row)
    return rows


def accuracy(expected: list[str], predicted: list[str]) -> float:
    return sum(left == right for left, right in zip(expected, predicted)) / len(expected)


def confusion_matrix(expected: list[str], predicted: list[str]) -> list[list[int]]:
    matrix = [[0 for _ in LABELS] for _ in LABELS]
    for expected_label, predicted_label in zip(expected, predicted):
        matrix[LABEL_TO_ID[expected_label]][LABEL_TO_ID[predicted_label]] += 1
    return matrix


def evaluate_keyword(rows: list[dict[str, Any]]) -> dict[str, Any]:
    classifier = KeywordClassifier()
    expected = [row["label"] for row in rows]
    predicted = [classifier.predict(row["text"])[0] for row in rows]
    return {
        "accuracy": round(accuracy(expected, predicted), 4),
        "confusion_matrix": confusion_matrix(expected, predicted),
    }


def write_report(path: Path, dataset_counts: dict[str, int], keyword: dict[str, Any], local: dict[str, Any]) -> None:
    payload = {
        "labels": list(LABELS),
        "dataset_counts": dataset_counts,
        "keyword": keyword,
        "indobert": local,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "demo_comments.jsonl")
    parser.add_argument("--model", default="indobenchmark/indobert-base-p1")
    parser.add_argument("--output", type=Path, default=ROOT / "model" / "checkpoints")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--baseline-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    rows = read_rows(args.dataset)
    counts = Counter(row["split"] for row in rows)
    if counts != {"train": 640, "validation": 80, "test": 80}:
        raise ValueError(f"expected 640/80/80 split, got {dict(counts)}")

    test_rows = [row for row in rows if row["split"] == "test"]
    keyword = evaluate_keyword(test_rows)
    if args.baseline_only:
        if args.report:
            write_report(args.report, dict(counts), keyword, {"status": "not_run"})
        print(json.dumps({"keyword": keyword}, indent=2))
        return

    try:
        import numpy as np
        import torch
        from torch.utils.data import Dataset
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
    except ImportError as exc:
        raise SystemExit(
            "training dependencies missing; install model/training/requirements.txt"
        ) from exc

    class CommentDataset(Dataset):
        def __init__(self, split: str, tokenizer: Any):
            selected = [row for row in rows if row["split"] == split]
            self.encodings = tokenizer(
                [row["text"] for row in selected],
                truncation=True,
                padding=True,
                max_length=64,
            )
            self.labels = [LABEL_TO_ID[row["label"]] for row in selected]

        def __len__(self) -> int:
            return len(self.labels)

        def __getitem__(self, index: int) -> dict[str, Any]:
            item = {key: torch.tensor(values[index]) for key, values in self.encodings.items()}
            item["labels"] = torch.tensor(self.labels[index])
            return item

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(LABELS),
        id2label=ID_TO_LABEL,
        label2id=LABEL_TO_ID,
    )
    train_dataset = CommentDataset("train", tokenizer)
    validation_dataset = CommentDataset("validation", tokenizer)
    test_dataset = CommentDataset("test", tokenizer)

    training_args = TrainingArguments(
        output_dir=str(args.output / "runs"),
        num_train_epochs=args.epochs,
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        save_total_limit=1,
        seed=args.seed,
        report_to=[],
    )

    def compute_metrics(result: Any) -> dict[str, float]:
        predictions = np.argmax(result.predictions, axis=-1)
        return {"accuracy": float(np.mean(predictions == result.label_ids))}

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        compute_metrics=compute_metrics,
    )
    train_result = trainer.train()
    output = trainer.predict(test_dataset)
    predicted_ids = np.argmax(output.predictions, axis=-1).tolist()
    expected_ids = output.label_ids.tolist()
    expected = [ID_TO_LABEL[index] for index in expected_ids]
    predicted = [ID_TO_LABEL[index] for index in predicted_ids]
    local = {
        "accuracy": round(accuracy(expected, predicted), 4),
        "confusion_matrix": confusion_matrix(expected, predicted),
        "train_loss": round(float(train_result.training_loss), 6),
        "epochs": args.epochs,
        "base_model": args.model,
        "seed": args.seed,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    report_path = args.report or ROOT / "model" / "training" / "evaluation.json"
    write_report(report_path, dict(counts), keyword, local)
    print(json.dumps({"keyword": keyword, "indobert": local}, indent=2))


if __name__ == "__main__":
    main()
