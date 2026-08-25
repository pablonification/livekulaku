# CONTEXT.md - Liveku Laku ubiquitous language

> Glossary only. No implementation details, no specs, no scratch notes.

**Priority Card** - The single actionable output produced once per aggregation window (e.g. 10s). It names the topic the host should address now: `{ top_cluster (label, count, share), urgency 0–100 deterministic, why_now }`, plus supporting clusters and samples as evidence. An optional `suggested_reply` may accompany the topic as coaching the host can speak, but the host decides how to address the topic. Live bars show cluster sizes continuously; the Priority Card is the only thing the host is asked to act on per window.
_Avoid: aggregated suggestion, insight, nudge, recommendation list._

**Seller Catalog** - The product knowledge a seller brings to a live session: per product, name, price, promo, and stock level. It is held client-side for the duration of the session and travels with each analyze request. Nothing is stored server-side. Replies and coaching are grounded in the Seller Catalog instead of demo data.
_Avoid: database, inventory sync, scraping._

**Flood** - A sustained comment rate where a host cannot read individually. For Liveku Laku: 500–5k concurrent viewers, roughly 15–80 comments/min observed. Below that there is no Flood; above that windowing still applies.
_Avoid: many comments, rame, spam._

**Window** - A fixed time slice (e.g. 10s) over which comments are buffered, classified, and clustered. The Priority Card is derived from one Window, then the buffer resets.

**Adapter** - The pluggable comment source. Implementations: MockAdapter (replays demo file), ShopeeAdapter (official polling), TikTokAdapter (WebSocket via reverse-engineer). All Adapters normalize into the same comment shape regardless of platform.
