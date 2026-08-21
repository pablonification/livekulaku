## Outcome

<!-- What is observably true after this PR? One sentence, no em dash. -->

## Why

<!-- Why is this change needed now? Link task, e.g. tasks/prelim/TASK-001-fe-window.md -->

## Selected task

<!-- e.g. tasks/prelim/TASK-001-fe-window.md or None - reason -->

## Acceptance criteria

- [ ] Criterion from task Done

## Verification

<!-- Exact commands you ran and their result. Prefer copy-paste. -->

```text
docker compose up --build
curl -X POST http://localhost:8000/analyze -H "Content-Type: application/json" -d '{"source":"mock","comments":[{"text":"kak harga berapa?"}]}'

# result:
```

## Risk and rollout

<!-- Not applicable - reason, or describe risk -->

## Visual review

<!-- Not applicable - no visual change, or link screenshot -->

## Checklist

- [ ] Change is coherent and preserves unrelated work
- [ ] `docker compose up --build` boots with no keys (mock flood -> card)
- [ ] Contract drift check passes (`pytest backend/tests/test_contract.py`)
- [ ] No em dash in commit messages, PR title, or body (use hyphen or comma)
- [ ] Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`)
- [ ] PR will be squash-merged (not merge commit)

<!-- Human replaces PROOF-PENDING placeholders - agents leave them -->
