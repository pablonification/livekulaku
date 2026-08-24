---
name: LiveLaku
description: Satu cue yang dapat langsung diucapkan host untuk setiap Window flood komentar.
colors:
  ink: "#171916"
  paper: "#F4F1E8"
  paper-quiet: "#E8E5DB"
  slate: "#202522"
  slate-quiet: "#343A35"
  line: "#C7C5BC"
  accent-amber: "#9A5B00"
  accent-amber-soft: "#F3E2B8"
  critical: "#A33A30"
  critical-soft: "#F5DCD8"
  calm: "#2F7053"
  calm-soft: "#D9EAE0"
  info: "#2F5F87"
  info-soft: "#DDE9F2"
typography:
  display:
    fontFamily: "Commissioner Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.35rem, 5vw, 4.45rem)"
    fontWeight: 650
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "clamp(1.65rem, 3.1vw, 3rem)"
    fontWeight: 520
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Commissioner Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.36rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Commissioner Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Commissioner Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  none: "0px"
  sm: "3px"
  md: "8px"
  lg: "14px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  display: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent-amber}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 13px"
    height: "48px"
  cue-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
    padding: "22px 0 26px"
---

# Design System: LiveLaku

## Overview

**Creative North Star: "The Window Cue Sheet"**

LiveLaku is an operational instrument for a host speaking during a live stream. Every fixed Window ends in one clear cue: the most important comment cluster, the urgency, a reason the topic matters now, and one reply the host can say without leaving the stream. The interface must therefore feel closer to a well-edited cue sheet than to an analytics warehouse or a marketing page.

The visual world combines a light editorial instrument with a quiet control-room alert layer. A warm paper surface gives Indonesian operational copy enough room to breathe. A restrained slate workbench carries source, Window timing, and flood evidence. Amber is the one deliberate accent for attention and action. Critical, calm, and informational colors exist only as semantic state channels, never as decoration.

The system is designed for the Operate mode. The host should understand what to say first, why it matters second, and how the result was formed third. The raw flood is supporting evidence, not the main product. The first viewport must make the cue sheet memorable even when the product name and temporary text mark are removed.

**Design Read:** Live-commerce host console for Indonesian sellers, with a cue-sheet and monitoring language, dial `ENERGY 2 / RHYTHM 2 / MOTION 1`.

**Key Characteristics:**

- One Window, one focal cue, one next action.
- Light paper cue sheet with a quiet slate workbench.
- One amber accent reserved for urgency and the primary action.
- Progressive disclosure instead of a wall of metrics.
- Sentence-case Indonesian copy that is short enough to speak aloud.
- Stable spatial hierarchy across empty, loading, success, no-flood, stale, and error states.

### Product truth that constrains the system

- `Priority Card` is the only action the host is asked to take per Window.
- A Window is normally 10 seconds and resolves synchronously through `POST /analyze`.
- Mock must remain usable offline after `docker compose up`.
- Mock, Shopee, and TikTok resolve to the same host-facing card shape.
- No auth, history page, multi-action queue, retraining control, testimonials, or fabricated metrics belong in this surface.

### Decision record

| Decision | Reason |
|---|---|
| Light editorial base | Long Indonesian reply text benefits from a calm, high-contrast reading surface and avoids assuming a dim room. |
| Slate evidence rail | Source and Window controls need separation from the cue without competing with it. |
| Amber as the deliberate accent | Urgency and the primary action need one scarce attention signal. |
| Cue sheet as the largest surface | The product promise is one actionable cue, not broad analytics or a generic card grid. |
| Commissioner Variable plus Newsreader | Commissioner brings a humanist operational texture with useful variable axes. Newsreader gives the speakable reply an editorial voice and a comfortable reading shape. |
| Tonal layering before shadow | Flat surfaces keep the screen grounded; the cue does not need a decorative lift. |
| Motion 1 | Hosts need stable text while speaking; motion only marks Window and card transitions. |

## Colors

The palette is warm neutral plus slate, with one amber action accent and a small semantic state family. Neutral surfaces do most of the work. Saturated colors appear only when the user needs to interpret state or act.

### Primary

- **Action Amber** (`#9A5B00`): primary action, active Window cue, and urgency emphasis on a light surface. It is never used as a page-wide wash.
- **Quiet Slate** (`#202522`): control rail, source setup, Window evidence, and protocol notes. It is a work surface, not a dark-mode identity.

### Secondary

- **Slate Quiet** (`#343A35`): tonal variation inside the control rail. It is a surface value, not text on `slate`; secondary rail text uses `paper` or a separately tested semantic color.

### Tertiary

- **Critical Red** (`#A33A30`): response-required or API-error semantics, paired with a text label and icon.
- **Calm Green** (`#2F7053`): no urgent response or successful completion, paired with a text label and icon.
- **Info Blue** (`#2F5F87`): source and informational state, never a decorative brand color.

### Neutral

- **Cue Paper** (`#F4F1E8`): Priority Card and the primary reading surface.
- **Paper Quiet** (`#E8E5DB`): inactive tracks, soft separators, and non-actionable state surfaces.
- **Ink** (`#171916`): primary text, reply text, and high-contrast controls.
- **Line** (`#C7C5BC`): 1px separators and control boundaries only.

### Semantic soft surfaces

- **Amber Soft** (`#F3E2B8`), **Critical Soft** (`#F5DCD8`), **Calm Soft** (`#D9EAE0`), and **Info Soft** (`#DDE9F2`) are backgrounds for their corresponding labels. Text still uses the stronger semantic color, not the soft fill.

### Named Rules

**The One Voice Rule.** Amber is scarce. If a screen uses amber on more than the primary action, the active Window cue, and one urgency indicator, remove the extra use.

**The Non-Color Rule.** Urgency is always communicated by a label, text, or shape in addition to color. Never make a host infer `critical` from hue alone.

**The Grounded Surface Rule.** Do not use blue-purple gradients, colored page glows, decorative grids, or neon borders. A surface must earn attention through hierarchy and state.

## Typography

**Display Font:** Commissioner Variable (with `ui-sans-serif`, `system-ui`, sans-serif fallback)

**Body Font:** Commissioner Variable (with system fallback)

**Cue Font:** Newsreader Variable, only for the suggested reply that the host speaks.

**Label/Mono Font:** System monospace, only for Window seconds, counts, source IDs, and endpoint names.

**Character:** Commissioner is a low-contrast humanist sans with variable shape axes. A restrained flare and volume setting gives LiveLaku a specific voice without turning the console into a display type specimen. Newsreader is reserved for the spoken cue, where its open editorial forms create a clear focal moment. Both families are self-hosted so the offline Mock path keeps its identity.

### Hierarchy

- **Display** (`600`, `clamp(2.75rem, 7vw, 5.5rem)`, `0.98`): one short page title or the largest success cue. Keep to roughly 6 words or fewer.
- **Headline** (`520`, `clamp(1.65rem, 3.1vw, 3rem)`, `1.08`): the suggested reply the host needs to speak.
- **Title** (`650`, `1.36rem`, `1.2`): workbench titles, state titles, and the cue sheet heading.
- **Body** (`400`, `1rem`, `1.55`): guidance, `why_now`, and supporting copy. Keep reading measure around 45 to 68 characters on the card.
- **Label** (`650`, `0.75rem`, `1.25`): status and field labels. Use sentence case by default. Uppercase is limited to the `LIVE CUE` stamp.
- **Mono** (`400`, `0.72rem`, `1.35`): Window duration, counts, `session_id`, and `POST /analyze` only.

### Named Rules

**The Speakable Scale Rule.** The suggested reply must be readable at a glance and must never be rendered as tiny supporting text. A host should not need to zoom or open details to speak it.

**The Sentence Case Rule.** Indonesian operational copy uses sentence case and direct verbs. Avoid wide-tracked all-caps headings and generic AI terminology.

## Layout

LiveLaku uses a cue-first operational sheet, not a generic dashboard shell or card grid.

### Desktop, 1024px and above

- Maximum content width: `1312px`, centered with a minimum outer gutter of `20px`.
- Top status strip: brand wordmark, current Window status, source, and freshness. Keep it compact; it is context, not a hero.
- Cue sheet: full content width with status, suggested reply, urgency, `why_now`, and progressive evidence in one ruled surface.
- Workbench below: source and optional live identifier share one row with Window timing and current buffer in a second column.
- Output order: cue status, suggested reply, urgency, `why_now`, cluster evidence, then source and Window metadata.
- Do not add a stat row, chart, activity feed, or second action queue unless a real product decision requires it.

### Tablet, 641px to 1023px

- Collapse to one main column when the Priority Card would otherwise lose reading measure.
- Keep the Priority Card before the lower control and evidence sections.
- Use two compact control columns only when both fields remain at least `240px` wide.

### Mobile, 320px to 640px

- Output first: status, suggested reply, urgency, and `why_now` appear before setup details.
- Stack source and live identifier fields vertically.
- Collapse raw comment evidence behind a native disclosure. Do not shrink the reply below `1.35rem` merely to keep a two-column composition.
- Keep every button and select at least `44px` tall, with at least `8px` between controls.
- No horizontal scrolling, clipped cards, colliding labels, or fixed-width ticker.

### Spacing rhythm

Use the spacing scale in frontmatter. Tight groups use `4px`, `8px`, or `12px`; related blocks use `16px` or `24px`; section changes use `32px` or `48px`; the first viewport earns `64px` only when it improves focus. More space belongs above a heading than below it.

### Named Rules

**The Cue-First Rule.** On every breakpoint, the host can reach the current cue before raw flood evidence.

**The Evidence-Last Rule.** Details justify the cue. They do not compete with it.

**The No-Template Rule.** Do not use a hero plus feature grid, four-stat row, three-step explainer, logo bar, or marketing footer in the host console.

## Elevation & Depth

The system is grounded and flat. Depth comes from tonal contrast and ruled boundaries. The cue sheet is integrated into the page plane, not lifted as a floating card. Avoid soft shadow on every panel, glassmorphism, backdrop blur, and colored halos.

### Shadow Vocabulary

- **No shadow:** source fields, status lines, buffer rows, cue sheet, and disclosure blocks use tonal layering and 1px lines.

### Named Rules

**The Flat-By-Default Rule.** If removing a shadow does not reduce comprehension or interaction, remove it.

**The Ruled Surface Rule.** A surface earns attention through reading order, typography, and state rules before it earns depth.

## Shapes

Shapes are restrained and functional. The system distinguishes controls, surfaces, and status labels through a small radius scale rather than making everything a pill.

- `0px`: progress tracks, hard separators, and the Priority Card outer edge when a stronger editorial plane is useful.
- `3px`: inputs, buttons, status tags, and compact controls. This is the default interactive radius.
- `0px`: the cue sheet and larger editorial planes.
- `14px`: reserved for a future modal or a clearly elevated container, not ordinary fields.
- Pills are not a default. A fully rounded shape is reserved for a genuinely compact status marker whose text length is stable.
- Borders are 1px and neutral by default. A semantic state may tint a border, but it may not become a decorative stripe.

## Components

### Top status strip

The strip answers whether a Window is active and where the comments came from.

- **Content:** LiveLaku wordmark, `Window aktif` or `Siap menerima flood`, source, and freshness.
- **Style:** paper background on light mode; slate background only when it improves separation from the output.
- **State:** pair the live dot with text. The dot is not the only signal.
- **Behavior:** no dead navigation. Every link must point to an existing section or real external destination.

### Source selector and live identifier

These fields start the real work, so their labels name the platform and the required identifier.

- **Style:** 1px line, paper fill, `3px` radius, `48px` minimum height.
- **Help:** tell the host what Mock, Shopee, or TikTok does in this Window.
- **Focus:** 3px visible amber outline with `3px` offset. Never remove the browser focus indicator without replacement.
- **Error:** place the problem next to the field and name the recovery action.
- **Copy:** use `Sumber komentar`, `Shopee session_id`, and `TikTok @handle`; do not use ambiguous labels such as `Input`.

### Window timer and buffer

The timer makes the 10-second aggregation legible without turning the screen into a ticker.

- **Content:** current Window status, seconds remaining, a determinate progress track, recent comments, and platform counts when real.
- **Style:** quiet slate or paper-quiet surface with mono seconds. Use no perpetual pulse.
- **Loading:** state what is being analyzed, for example `Menganalisis Window`.
- **Empty:** explain how to start, for example `Belum ada flood. Putar flood demo atau isi sumber live.`
- **Overflow:** show a bounded recent sample and disclose the count only when it is real.

### Cue sheet

The API still calls this result a `Priority Card`, but the UI presents it as a cue sheet so the host reads it as a line of work, not a dashboard tile.

- **Order:** card status, top cluster, suggested reply, urgency, `why_now`, optional cluster evidence, then Window and source metadata.
- **Reply:** use a large, readable blockquote or reply field. The host should be able to speak it without opening details.
- **Urgency:** show a label such as `Perlu respons`, a number only when the API provides it, and a bar or shape in addition to the color.
- **Evidence:** use progressive disclosure for cluster counts and shares. Never show invented numbers.
- **Success:** the card may lift above the rail. Do not add a second CTA inside the card unless the contract gains a real action.
- **No flood:** explain that no cluster crossed the response threshold and offer the one next action that exists.
- **Error:** keep the error in context, state the cause, and say how to retry. Do not disguise an API failure as a successful cue.

### Status tags

Tags describe state. They are not buttons, filters, or decoration.

- **Labels:** `Window aktif`, `Siap diucapkan`, `Tidak ada flood`, `Perlu respons`, `Tidak terhubung`.
- **Style:** light semantic fill, dark semantic text, 1px border, `3px` radius, sentence case.
- **Accessibility:** label and shape or icon must carry the meaning in addition to hue.

### Buttons

Buttons are explicit actions and use product language.

- **Primary:** `Putar flood demo`, `Kirim Window`, or `Jalankan live Shopee/TikTok` depending on actual state. Amber fill, ink or paper text only after contrast testing.
- **Secondary:** `Kirim Window` when a live input is present, or a real secondary action. Transparent or paper-quiet background with 1px boundary.
- **Tertiary:** `+ Suntikkan satu komentar` only while the demo path is available.
- **States:** hover, active, disabled, loading, and keyboard focus must be visible and functional.
- **Avoid:** `Get Started`, `Learn More`, `Explore`, decorative arrows on every button, and buttons without a real behavior.

### Disclosure for evidence

Use a native disclosure for clusters and raw comments when the information is supportive rather than actionable.

- **Closed by default** on mobile and in the idle state.
- **Open after success** only if the evidence is needed for trust and does not push the reply below the first viewport.
- **Keyboard:** `Enter` and `Space` operate it, focus remains visible, and the summary names the content.

### State matrix

| State | User question | Required visual treatment | Required action or recovery |
|---|---|---|---|
| Empty | How do I start? | Clear explanation, no fake card, one visible start action | Play Mock or provide live identifier |
| Window running | Is the system collecting? | Determinate timer, text status, calm motion | Let Window finish or use the existing send action |
| Loading | Is analysis still working? | In-context progress indicator and `Menganalisis Window` | Preserve layout, do not steal focus |
| Success | What do I say now? | Priority Card dominates, reply first, urgency and reason visible | Speak the reply; no extra queue |
| No flood | Did anything require response? | Honest no-flood state with no invented counts | Start another Window or adjust the real source input |
| Stale | Is this card current? | Visible stale label and last-known timestamp when real | Start a fresh Window; never present stale output as live |
| API error | What failed and what now? | Inline error with cause and retry guidance | Retry the same real action; keep diagnostic detail secondary |

### Controlled status announcements

- Use a polite status region for Window completion and aggregate card changes.
- Do not announce every incoming comment.
- Do not move focus when a card arrives.
- Do not auto-dismiss critical or error messages.
- Respect `prefers-reduced-motion` and keep all content visible without animation.

## Do's and Don'ts

### Do:

- **Do** make the Priority Card the first answer to the host's next decision.
- **Do** use Indonesian-first sentence case and replies that can be spoken naturally.
- **Do** reserve amber for urgency and the primary action.
- **Do** pair every semantic color with text, shape, icon, or position.
- **Do** keep empty, loading, success, no-flood, stale, and error states equally intentional.
- **Do** show real Window, cluster, source, and urgency values only when supplied by the contract.
- **Do** test 320px, 640px, 768px, 1024px, and wide desktop layouts for overflow and reading measure.
- **Do** keep the Mock path offline-safe and visibly distinct from a real Shopee or TikTok connection.
- **Do** record the reason for every major visual choice before implementation.

### Don't:

- **Don't** add a dashboard stat row, chart, activity feed, history page, or multi-action queue without a real product decision.
- **Don't** use blue-purple gradients, grid backgrounds, glassmorphism, glow carpets, or decorative emoji.
- **Don't** make every component pill-shaped, shadowed, or amber.
- **Don't** use color as the only urgency or error signal.
- **Don't** fabricate comments, users, counts, testimonials, benchmarks, security claims, or customer proof.
- **Don't** use generic AI labels such as `AI Powered`, `Revolutionary`, or `Seamless`.
- **Don't** add a navigation item or button that has no real destination or behavior.
- **Don't** replace the reply with a chart. A chart exists only if a real decision needs it.
- **Don't** use a loading spinner as the only explanation for a slow or failed request.
- **Don't** choose dark mode solely because the product uses AI. Add a theme only when the use scene justifies it, and verify both modes.

### Research basis

- [SAP Analytical Scenarios](https://www.sap.com/design-system/sac-dashboard-design-best-practices/foundation/analytical-page-types): monitoring emphasizes current status, anomalies, rapid response, and limited interaction.
- [Stephen Few, Dashboard Design for Real-Time Situation Awareness](https://www.perceptualedge.com/articles/Whitepapers/Dashboard_Design.pdf): neutral baseline, selective salience, conservative alerts, and pauseable changing data.
- [Center for Operator Performance, COSA Graphic Guide](https://centerforoperatorperformance.org/tools/cosa-console-op-situation-awareness-graphic-guide): overview hierarchy and rapid situation awareness for operators.
- [W3C Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/): brief important alerts, no focus stealing, no automatic disappearance, and no alert fatigue.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): status changes must be programmatically determinable without moving focus.
- [WCAG 2.2 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): color is not the only signal and text contrast must meet AA thresholds.
- [Apple Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities) and [Apple Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts): glanceable live information, progressive disclosure, concise copy, and sparse actionable alerts.
- [Material Responsive Layout Grid](https://m2.material.io/design/layout/responsive-layout-grid.html): breakpoint-specific columns, gutters, and margins rather than a fixed desktop canvas.
- [GOV.UK Notification Banner](https://design-system.service.gov.uk/components/notification-banner/) and [GOV.UK Tag](https://design-system.service.gov.uk/components/tag/): use status patterns sparingly, consistently, and without making labels look like buttons.
- [Carbon Notification Pattern](https://carbondesignsystem.com/components/notification/usage/): match visual disruption to urgency, keep messages concise, and do not auto-dismiss critical information.
- [LiveLaku UI unslop research](exa-results/livelaku-ui-unslop-research-2026-08-22.md): Exa-backed typography and operational-surface audit, including the Commissioner and Newsreader selection.
- [LiveLaku visual direction research note](exa-results/visual-directions-live-console-2026-08-22.md): Exa synthesis, source-quality notes, alternatives, trade-offs, and validation plan.

### Delivery gate for this design contract

- `R-02` PASS: this document contains no em dash characters.
- `R-17` and `R-38` PASS: numbers and examples are labelled as contract values, real API values, or design constraints; no customer claims are invented.
- `R-20` and `R-31` PASS: identity, palette, typography, layout, spacing, shape, component, and motion choices each have a one-line reason.
- `R-25` and `R-32` PASS: contrast, non-color status, keyboard operation, and visible focus are explicit implementation requirements.
- `R-27` PASS: empty, loading, success, no-flood, stale, and error states are specified.
- `R-03` PASS: mobile order, minimum target size, overflow, and disclosure behavior are specified.
- `R-05`, `R-14`, and `R-20` PASS: the structure is product-shaped, the Priority Card has unique hierarchy, and no template card grid is prescribed.
- `R-19` PASS: motion is explicitly `MOTION 1`, limited to state transitions and loading feedback.
