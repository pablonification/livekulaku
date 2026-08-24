# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a live-commerce host or seller on TikTok Shop or Shopee Live. They operate a stream with roughly 500 to 5,000 viewers and 15 to 80 comments per minute, a Flood they cannot read individually. Their job is to notice what needs a response now and say a useful reply without leaving the live stream.

No secondary audience is confirmed for the prelim product.

## Product Purpose

LiveLaku is a live-commerce copilot that turns a Flood of comments into one Priority Card per fixed 10-second Window. The card identifies the top comment cluster, gives a deterministic urgency score from 0 to 100, proposes a one to two sentence reply the host can speak, and explains why that topic matters now.

Success means the host can scan and act on one clear card for each Window instead of sorting through an unbounded comment feed.

## Positioning

LiveLaku compresses a platform-agnostic comment Flood into exactly one actionable Priority Card per Window. Normalized adapters and deterministic urgency keep the output consistent across Mock, Shopee, and TikTok sources while preserving the samples and reason the host needs to trust the next action.

## Operating Context

- The product is a single web surface used while a live stream is running.
- Mock is the default, offline-safe mode. It replays a demo flood, buffers one Window in the browser, sends one synchronous request, and renders the returned card.
- Optional live modes accept a TikTok handle or Shopee session identifier. The backend fetches that Window inside the same request; there are no background jobs or live polling loops in the frontend endpoint.
- The source selector supports `mock`, `shopee`, and `tiktok`. Source-specific input guidance changes with the selection.
- The Window buffer may show incoming comments and platform counts. The Priority Card is the only action the host is asked to take per Window.
- The product is evaluated with `docker compose up` without provider keys, so the Mock path must remain usable offline.

## Capabilities and Constraints

- The frontend batches one 10-second Window and calls the contract-defined `POST /analyze` endpoint once per analysis.
- The request may contain normalized comments, or a live `handle` or `session_id` when the backend fetches comments for Shopee or TikTok.
- The response shape is defined only by `contracts/openapi.yaml`: `top_cluster`, `urgency`, `suggested_reply`, `why_now`, plus the supporting totals, clusters, Window, tone, and source fields.
- The interface must make empty, Window-running, loading, successful-card, no-flood, and API-error states understandable without adding another action queue.
- Inference and supporting catalog/playbook data are frozen at build time. No retraining control, auto-tuning, database, auth, history page, or multi-action workflow belongs in the prelim product.
- The current frontend implementation evidence is React 19 + Vite + Astryx Design System in `frontend/src`, built and served through the frontend container.
- Open decision: `tasks/prelim/TASK-001-fe-window.md` names `frontend/public/index.html`, `frontend/public/app.js`, and `frontend/public/style.css` as owned files, but those files are not the current implementation. Future frontend work must reconcile that ticket path with the React/Vite source before changing code; this product record does not silently choose one.

## Brand Commitments

- Product name: LiveLaku.
- The interface is Indonesian-first for operational copy, including controls, statuses, guidance, errors, and Priority Card text. Product and protocol names such as Mock, Shopee, TikTok, `session_id`, and `POST /analyze` may remain in their established form when that is clearer.
- The voice is direct, timely, and speakable by a host during a live stream.
- No logo, marketing claim, testimonial, or visual identity asset is confirmed by the repository.

## Evidence on Hand

- `CONTEXT.md` defines the terms Flood, Window, Priority Card, and Adapter.
- `contracts/openapi.yaml` is the source of truth for the synchronous request and response contract.
- `frontend/src/App.jsx` demonstrates the current Mock, Shopee, TikTok, buffering, loading, success, no-flood, and error flows.
- `frontend/public/demo_comments.jsonl` contains the 18-comment replay used by the frontend demo path.
- `data/demo_comments.jsonl`, `data/catalog.json`, and `data/playbook.json` provide frozen demo or model-support material.
- The repository contains no confirmed customer testimonials, production benchmarks, press proof, or non-synthetic case study. Future work must not fabricate any.

## Product Principles

1. One Window, one next action: reduce attention load instead of creating another feed.
2. Explain the priority: show enough cluster evidence and `why_now` for a host to trust the card quickly.
3. Normalize the source: Mock, Shopee, and TikTok should resolve to the same host-facing card shape.
4. Stay deterministic and demo-safe: frozen inference and an offline Mock path are part of the product, not fallback polish.
5. Speak the host's language: keep operational copy Indonesian-first, concise, and ready to say aloud.

## Accessibility & Inclusion

The web frontend targets responsive use on a laptop or small monitor during a live stream. It should support keyboard operation, visible focus, readable contrast, and clear status changes, with WCAG 2.2 AA as the implementation target. This is a quality target, not a claim of compliance until it is tested.
