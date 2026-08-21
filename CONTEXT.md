# CONTEXT.md — LiveLaku ubiquitous language

> Glossary only. No implementation details, no specs, no scratch notes.

**Priority Card** — The single actionable output produced once per aggregation window (e.g. 10s). It summarizes the flood in that window as `{ top_cluster (label, count, share), urgency 0–100 deterministic, suggested_reply (1–2 sentences host can speak), why_now }`. Live bars show cluster sizes continuously; the Priority Card is the only thing the host is asked to act on per window.
_Avoid: aggregated suggestion, insight, nudge, recommendation list._

**Flood** — A sustained comment rate where a host cannot read individually. For LiveLaku: 500–5k concurrent viewers, roughly 15–80 comments/min observed. Below that there is no Flood; above that windowing still applies.
_Avoid: many comments, rame, spam._

**Window** — A fixed time slice (e.g. 10s) over which comments are buffered, classified, and clustered. The Priority Card is derived from one Window, then the buffer resets.

**Adapter** — The pluggable comment source. Implementations: MockAdapter (replays demo file), ShopeeAdapter (official polling), TikTokAdapter (WebSocket via reverse-engineer). All Adapters normalize into the same comment shape regardless of platform.
