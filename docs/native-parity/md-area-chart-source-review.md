# Area chart source review (md-area-chart) — Gate 1

Status: **Gate 1 passed in the cloud** with three component fixes plus the two shared fixes
listed in the line review. Oracle: **provisional cloud capture** in
`outputs/native-parity/md-area-chart/web-oracle-cloud/` — recapture on the Mac (Chrome 153).

The shared infrastructure (theme, engine, tooltip, legend, a11y, intro and emphasis motion) is
reviewed once in [md-line-chart-source-review.md §7](md-line-chart-source-review.md#7-shared-cartesian-chart-infrastructure-also-used-by-area-and-bar);
only what differs is written here.

## 1. Public contract (differences from md-line-chart)

`md-area-chart` drives the same `LineChartEngine` with fills always on.

| Prop | Default | Notes |
|---|---|---|
| `series` | `MdChartSeries[]` | Category data only (no `{x,y}` tuples, no `yAxisIndex`) |
| `stack` | **`normal`** | `none`, `normal`, `percentage`, `silhouette`, `wiggle` (streamgraphs) |
| `fill-opacity` | **0.55** | Gradient fill opacity, 0..1 |
| `show-line` | `true` | Line on top of each fill; per-series `stroke` wins |
| `curve`, `connect-nulls`, `show-marks`, `line-width`, `mark-size`, `grid`, `axis-ticks`, `inverted`, `show-labels`, `series-labels`, `legend`, `tooltip`, `zoom`, `locale`, `summary`, `table-labels`, `label-empty`, `label-plot`, `label-point`, `label-zoom-*`, `animation`, `animation-duration`, `no-animation`, `height`, `density`, `value-formatter`, `tooltip-renderer`, `label`, `subtitle`, `title-align` | as line | |
| `loading` | `false`, **not reflected** | Line and bar reflect it (O-A2) |
| — | — | **No** `area`, `mark-lines`, `y-axes` props |

Events: `mdMarkerClick`, `mdLineClick`, `mdAreaClick`, `mdAxisClick`, `mdLegendClick`,
`mdHover`, `mdReady`, `mdZoom` (same payloads as line). Methods: `refreshTheme`, `resize`,
`replay`, `toDataURL`, `getInstance`, `setZoom`, `resetZoom`. Slots, parts and hooks mirror the
line chart with the `--md-area-chart-*` prefix (same defaults); the CSS header also documents
the engine-created `tooltip` part.

Behaviour specific to filled charts:

* Hover emphasis is **off on `axis` trigger** (the card already lists every band); with
  `tooltip="item"` the band under the pointer is emphasised (containment, not distance) and the
  card names only that series. Oracle: `motion.json` → `area-emphasis-axis-none`,
  `area-emphasis-item-band-1`.
* `mdAreaClick` fires for a click inside a band; marker and line clicks as in line.
* Summary verb: "Area chart".

## 2. Fixes made at this gate (test-first)

| # | Defect | Where | Test |
|---|---|---|---|
| A1 | `locale` changed after mount was ignored (ticks, labels, table) | `md-area-chart.tsx` watch list | `md-line-chart/md-line-chart.runtime-props.e2e.ts` (area row) |
| A2 | `no-animation` changed after mount was ignored | same | same |
| A3 | `series-labels` toggled after mount was ignored (end labels stayed / never appeared) | same | `md-area-chart.series-labels.e2e.ts` |
| S1, S2 | typescale tokens; forced-colors colour keys | shared, see line review | `charts-typescale-tokens.e2e.ts`, `charts-forced-colors.e2e.ts` |

## 3. Verification

Area suites run in every regression with line, bar and `utils/charts`. Oracle: paint matrix
(theme × direction × 8 variants: stacked default, stack none, percentage, linear marks,
no-line, labels, inverted, nulls), extras (silhouette, wiggle, step, opaque fill, connect-nulls,
widths, all common knobs), forced colors, hover, keys, pointer, zoom, runtime, entrance per
variant (plus `stack="none"`), emphasis, reduced motion.

## 4. Open decisions

* O-A1 Area does **not replay the entrance when `loading` clears** (line and bar do, and their
  readmes promise it). Align?
* O-A2 `loading` is not reflected on the host (line and bar reflect it).
* O-A3 The watch list is hand-maintained: three props were missing before this gate (A1–A3).
  A shared "every engine-affecting prop" list per chart would prevent the next one.
* Line review O-1…O-9 apply here too.

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

Line review decisions (O-1…O-9, runtime `density`, motion digest tolerance) apply here too.

| Item | Decision | Alternative | How to revert |
| --- | --- | --- | --- |
| O-A1 No entrance replay when `loading` clears | Keep the area source behaviour (only the line and bar readmes promise the replay); native follows each chart's own rule, verified by the motion and interaction oracles. | Align area with line / bar (replay). | Add the `loading` → replay transition to `md-area-chart.tsx` and the area path of both ports. |
| O-A2 `loading` not reflected on the host | Keep; native exposes `loading` as the property only (no reflected attribute on native). | Reflect it like line / bar. | Web-only change (`reflect: true`). |
| O-A3 Hand-maintained watch list | Native re-renders on every property change (no watch list); the Web list covers every engine-affecting property after A1–A3 except `density` (line decision). | A shared generated watch list. | Engineering change; no behaviour difference. |
