# Sparkline source review (md-sparkline)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
two source defects are fixed test-first (one in the component, one in the
shared colour parser), and a browser reference (paint matrix, per-frame
entrance / hover / click / live-change runs, reduced motion) is captured. The
oracle is **provisional** (headless Chromium 141, Linux) and must be
recaptured on the Mac (Chrome 153). No native code has changed.

## Public contract

**Props** (defaults in brackets):

* `data: (number | null)[]` [`[]`]; `null` is a gap. Lines and areas
  **connect across gaps** (`connectNulls: true`); bars leave the slot empty.
* `labels` (category names; only used by the tooltip header).
* `variant` [`line`] | `area` | `bar`, reflected. Switching to/from `bar`
  swaps the engine (Line ↔ Bar) and repaints from scratch.
* `color` [`primary`]: an MD3 role or any CSS colour; an invalid one warns
  and falls back to the palette.
* `curve` [`smooth`] | `linear` | `monotone` | `step` | `step-before` |
  `step-middle` (line/area).
* `showMarks` [`extremes`] | `none` | `edges` | `all` (line/area). Extremes =
  max + min; edges = first + last finite point.
* `showTooltip` [**true**] — the class comment says "no tooltip by default"
  (drift).
* `referenceAreas: {from, to, color?, label?}[]` — data-index windows,
  line/area only. Fill: an opaque colour in any syntax at 18% alpha, a colour
  with its own alpha as given, none → the line colour at 12% (S1).
* `valueFormatter` (tooltip and `aria-label`), `min` / `max` (fixed scale),
  `lineWidth`, `markSize`, `barWidth`, `cornerRadius` [2] (bar),
  `height` (host block size), `noAnimation`.

**Events.** `mdSparkClick {dataIndex, value | null}` — pointer only, on a
point or bar hit (not on a gap; also with the tooltip off). `mdReady` once.

**Methods.** `refreshTheme()`, `resize()`, `getInstance()`.

**Slots.** None. **Parts.** `canvas` (plus the engine's `plot-canvas`,
`tooltip`).

**CSS hooks** (3): `--md-sparkline-block-size` (28px),
`-inline-size` (100%), `-min-inline-size` (32px). No density prop; an
ancestor `data-density` changes nothing.

## Anatomy and paint

* Host `inline-block`, `vertical-align: middle`, `line-height: 1`, 28px tall,
  full inline size, minimum 32px (overflows a narrower container).
* Compact engine mode: no axes, grid, legend or title; area fill opacity 0.45;
  bars with a 0.2 category gap, radius 2.
* RTL mirrors the x axis (the latest point is on the left).
* Entrance (once, on first mount): canvas opacity 0 → 1 with a rise, ≈ 730ms;
  instant under reduced motion and `no-animation`.

## Interaction and semantics

* Host `role="img"` with a generated English `aria-label`: "Sparkline,
  latest 33, range 11 to 35." plus " Highlighted: <labels>." for labelled
  reference areas; "Sparkline, no data." when empty.
* Not focusable; no keyboard path (Tab passes over it).
* Hover shows a card with the category (from `labels`, else the **0-based
  index**) and the formatted value; nothing on a gap; nothing with
  `show-tooltip="false"`.

## Source defects fixed (test-first)

| # | Defect (before) | Fix | Files | Test |
|---|---|---|---|---|
| S1 | Reference band tint handled only `#rrggbb` and comma `rgb()`: a named / `hsl()` line colour gave an **opaque** band (docs promise a tint); `rgb(r g b)` became an invalid string and painted **black** | `bandFill()` via `parseColor` for any syntax; explicit colours keep their own alpha | `md-sparkline.tsx`, readme | `md-sparkline.reference-tint.e2e.ts` (9 cases; 3 controls) |
| C1 | `parseColor('rgb(255 99 71)')` **threw** (comma-only split), breaking every caller (hover dimming, slice labels, band tint) for CSS Color 4 syntax | Split on whitespace, commas and `/`; fewer than 3 channels → fallback | **shared** `utils/charts/engine/color.ts` | `color.space-syntax.spec.ts` (6; 1 control) |

**Behaviour change (sign-off needed):** the readme said an explicit band
colour other than `#rrggbb` / `rgb()` was "used as given" (opaque). It now
follows one rule: opaque → 18%, translucent → as given. The readme is
updated. Reverting only the explicit branch restores the old behaviour.

## Observed, not changed (decisions needed)

1. The tooltip header is the 0-based index ("0", "7") when `labels` is
   unset — omit it or make it 1-based?
2. `aria-label` is English with no override or locale (pie has `summary`).
3. On `variant="bar"` the bands are not drawn but the `aria-label` still says
   "Highlighted: …".
4. `mdSparkClick` has no keyboard path (the host is an image).
5. No density prop; no RTL-specific behaviour beyond the mirrored axis.

## CEM / source drift

* CSS header: part `canvas` described as "ECharts SVG container".
* Class comment: "no tooltip by default (opt in with `show-tooltip`)" —
  the default is on.

## Evidence

* Tests: shared with the pie run (42 suites / 741 tests pass after; the two
  sparkline files fail 6 + 5 cases on pristine source). Logs and diffs:
  `outputs/native-parity/md-sparkline/source-tests/`, `source-changes/`.
* Oracle: `outputs/native-parity/md-sparkline/web-oracle-cloud/` — 105 paint
  cases, 21 state runs, 21 reduced-motion runs.

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

| Item | Decision | Alternative | How to revert |
| --- | --- | --- | --- |
| S1 Reference band tint (behaviour change) | Keep the fixed `bandFill`: any CSS colour is tinted to 18 %, an explicit alpha is kept; native follows (scene parity). | The old rule (only `#rrggbb` / comma `rgb()` tinted, others opaque). | Drop the tint branch in `bandFill()` and in both ports' `ChartSparklineModel`. |
| 1 Tooltip header is the 0-based index without `labels` | Keep; native identical. | 1-based, or no header. | Change the header text in the source and both ports. |
| 2 English `aria-label`, no override | Keep. | Add a `summary` property as on pie. | Contract change (Web + native). |
| 3 `variant="bar"` still says "Highlighted: …" | Keep. | Omit the band sentence for bars. | Summary change in the source and both ports. |
| 4 `mdSparkClick` has no keyboard path | Keep (the host is an image; MD3 sparklines are not interactive). | Make the host focusable and activatable. | Add focus + Enter handling in the source and both views. |
| 5 No `density` property | Keep. | Add density. | Contract change. |
