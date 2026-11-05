# Line chart source review (md-line-chart) — Gate 1

Status: **Gate 1 (Web source contract checkpoint) passed in the cloud**, with four source fixes
(two of them in chart-only shared modules) and one test-only flake fix. The oracle is a
**provisional cloud capture** (headless Chromium 141, Linux) in
`outputs/native-parity/md-line-chart/web-oracle-cloud/`; recapture it on the Mac (Chrome 153)
before any native parity diff.

This file also holds the **shared cartesian-chart infrastructure** review (§7), which
[md-area-chart-source-review.md](md-area-chart-source-review.md) and
[md-bar-chart-source-review.md](md-bar-chart-source-review.md) reference instead of repeating.

Sources reviewed (Mac snapshot `_sync11`, then the fixed cloud copy):
`packages/core/src/components/md-line-chart/{md-line-chart.tsx,md-line-chart.css,readme.md,*.spec.ts,*.e2e.ts}`
and `packages/core/src/utils/charts/**` (engine, theme, a11y, tooltip, xy, options, types).

## 1. Public contract

### Data and series

| Prop (attribute) | Type / default | Contract |
|---|---|---|
| `series` | `MdChartXYSeries[]`, `[]` | Per series: `label`, `data` (number \| null \| `{x,y}` \| `[x,y]`), `id`, `color` (MD role or CSS colour), `curve`, `dash` (`solid`/`dashed`/`dotted`), `hidden`, `connectNulls`, `showMarks`, `symbol` (`circle`, `square`, `diamond`, `triangle`, `triangle-down`, `none` or an emoji/text glyph), `stack` (group id), `yAxisIndex`, `range` (band), `stroke`, `fill`, per-point extras (`pointSymbols`, `markIndices`, `dashAfter`) |
| `xAxis` / `yAxis` | `MdChartAxis` | `data`, `scale` (`category`/`time`/`value`/`log`), `label`, `min`/`max`, `valueFormatter`, `bands`, `breaks`, `hideTicks`, `hidden`, `axisLine`, `reverse`, `position`, `color`, `labelRotation`, `mirrorLabels`, `dash`, `gridDash` |
| `yAxes` | `MdChartAxis[]` | Multiple value axes; a series picks one with `yAxisIndex` (oracle: `line-dual-axes`) |
| `curve` | `smooth` | `linear`, `smooth` (Catmull-Rom), `monotone`, `step`, `step-before`, `step-middle`; per-series `curve` wins |
| `stack` | `none` | `none`, `normal`, `percentage`, `silhouette`, `wiggle` |
| `connect-nulls` | `false` | A `null` breaks the line unless set (chart-wide or per series) |
| `show-marks` | `false` | Point markers; `mark-size` (px), per-series `symbol` |
| `line-width` | engine default | Stroke width in px |
| `area` / `show-line` | `false` / `true` | Fill under each line; `show-line=false` leaves fills only |
| `inverted` | `false` | Categories on the vertical axis, values horizontal |
| `show-labels` | `false` | Value label at every point (collision-managed by the engine) |
| `series-labels` | `false` | End-of-line series names (collision-managed, fade in/out) |
| `mark-lines` | `MdChartMarkLine[]` | Vertical reference lines: `value` (axis value or fractional index), `label`, `color`, `dash` |

### Chrome, text and i18n

| Prop | Default | Contract |
|---|---|---|
| `label` | `''` | Canvas title (overlay text, title-small 14px/600) and first part of the summary |
| `subtitle` | — | Second title line (label-small, muted) |
| `title-align` | `start` | `start`/`center`/`end` over the plot (logical: mirrors in RTL) |
| `legend` (reflected) | `top-end` | `top`, `bottom`, `left`, `right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`, `none`; only drawn with ≥ 2 series. `start`/`end` are logical, `left`/`right` physical |
| `tooltip` | `axis` | `axis` (every series at the x), `item` (series under the cursor; also turns hover emphasis on for filled charts), `none` (no card; keyboard still announces) |
| `grid` | `horizontal` | `none`, `horizontal`, `vertical`, `both` |
| `axis-ticks` | `false` | Tick marks on the axes |
| `locale` | `''` (document) | BCP-47 for ticks, labels, tooltip, data table, summary range, announcements |
| `value-formatter` / `tooltip-renderer` | — | Function props (no attribute) |
| `summary` | generated | Overrides the host `aria-label` (`"<label>, Line chart, with N series, from <min> to <max>."`) |
| `table-labels` | `{x:'X', index:'#', series:'Series', truncated:…}` | SR table chrome |
| `label-empty` | `No data to display` | Empty-state text (slot `empty` replaces it) |
| `label-plot` | `Chart data. Use the arrow keys…` | Accessible name of the focusable plot |
| `label-point` | `%x%: %values%` | Announcement template per keyboard move |
| `label-zoom-start` / `-end` | `Zoom range start` / `end` | Slider thumb names |
| `loading` (reflected), `loading-label` | `false`, `Loading chart…` | Opaque loader overlay, `aria-busy="true"`, slots `loader` > `loading` > default spinner + text; clearing it **replays the entry animation** |
| `height` | — | Writes the host `block-size` inline |
| `density` (reflected) | `0` | `0…-4`, maps onto `--md-sys-density-scale` |

### Motion

| Prop | Default | Contract |
|---|---|---|
| `animation` | `expressive` | `expressive`, `grow`, `fade`, `draw`, `stagger`, `none` |
| `animation-duration` | 700 ms (`INTRO_MS`) | ≤ 0, NaN or ∞ disables; `stagger` scales by series count, capped at 5200 ms |
| `no-animation` | `false` | Shorthand for `none` |

Entrance engine (`engine/animate.ts`): `expressive`/`grow`/`fade` share
`emphasizedDecelerate = cubic-bezier(0.05, 0.7, 0.1, 1)`; `draw`/`stagger` use
`easeInOutCubic`. `expressive`/`grow` grow the geometry from the baseline and fade the canvas
layer (`canvas.style.opacity = e`); `fade` is opacity only; `draw` reveals left-to-right by a
moving cut x (mirrored in RTL) with gridlines fading in over the first half; `stagger` draws
series one after another. The t=0 frame is painted synchronously (no blank frame). Hover
emphasis: the nearest line stays vivid, the others fade to 22 % alpha over 260 ms
(`EMPHASIS_MS`), linear in time; filled charts on `axis` trigger never emphasise. Hover markers
pop with a 320 ms Web Animation (`cubic-bezier(0.2, 0, 0, 1)`). Reduced motion: the theme
reports `motionDuration 0`; intro, emphasis and pop snap. (Note: `expressiveEase` with
overshoot still exists in `animate.ts` but no variant uses it any more — the `expressive`
doc string's "small overshoot" is stale.)

### Events (all bubble, composed)

| Event | Detail | When |
|---|---|---|
| `mdMarkerClick` | `{seriesIndex, seriesId, dataIndex, value, axisValue, nativeEvent}` | Pointer click within 26 px (`MARK_HIT_RADIUS`) of a point |
| `mdLineClick` | same | Click on a line away from points |
| `mdAreaClick` | same | Click inside a filled band (`item` trigger) |
| `mdAxisClick` | `{dataIndex, axisValue, seriesValues[], nativeEvent}` | Click on empty plot; **Enter/Space** on the keyboard cursor |
| `mdLegendClick` | `{seriesIndex, seriesId, selected}` | Legend chip toggles (pointer, Enter, Space) |
| `mdHover` | `{dataIndex, axisValue, seriesIndices}` | Hover / keyboard index changes; `-1` on leave is engine-internal |
| `mdReady` | — | First drawn frame |
| `mdZoom` | `{startIndex, endIndex, reset}` | Any window change (drag, slider, pan, `setZoom`, `resetZoom`) |

A drag beyond `DRAG_SLOP` (8 px) is a zoom/pan, not a click. All indices are **absolute**
(rebased through the zoom window).

### Methods

`refreshTheme()`, `resize()`, `replay()`, `toDataURL()`, `getInstance()` (escape hatch),
`setZoom(startIndex, endIndex)` (absolute indices), `resetZoom()`.

### Slots, parts, CSS hooks

* Slots: `header`, `footer`, `empty`, `loader` (and the older `loading`).
* Parts (component): `header`, `canvas`, `empty`, `loading`, `zoom`, `zoom-slider`,
  `zoom-track`, `zoom-window`, `zoom-handle` (forwarded from md-slider), `zoom-pan`,
  `zoom-band`, `footer`. Parts created by the engine inside `canvas`: `plot-canvas`, `legend`,
  `tooltip`.
* Hooks: `--md-line-chart-{block-size (auto), min-block-size (max(120px, 160px + 8px·d)),
  aspect-ratio (16/9), background (surface-container-low), padding (max(8px, 16px + 2px·d)),
  shape (max(8px, 16px + 2px·d)), empty-color, empty-background, empty-font, empty-font-size,
  empty-icon-size (40px), zoom-size (28px), zoom-track-color, zoom-window-color,
  zoom-handle-color, zoom-band-color}`; engine-read `--md-chart-grid-color` (default
  outline-variant at 50 %) and `--md-chart-axis-color` (outline-variant).
* Focus rings: plot `3px solid secondary`, offset −3px, radius 4px; legend chips `3px solid
  secondary`, offset 2px, radius 6px.

## 2. Keyboard and screen readers (oracle `keys.json`)

* Host `role="figure"` named by the summary; plot `role="application"`, `tabindex=0`, named by
  `label-plot` (not focusable and unnamed when there is no data).
* Arrows follow the reading direction: LTR → advances, RTL ← advances. From no cursor, the
  advancing arrow lands on the first point and the other arrow on the last. Home/End are
  logical first/last. Up/Down are not handled (also with `inverted`). Modifiers are ignored:
  Shift/Alt/Ctrl+Arrow move the cursor and `preventDefault` (see open decision O-5).
* Each move drives the same tooltip/crosshair as hover, emits `mdHover`, and writes the polite
  live region with `label-point` (`%x%` and `%values%` replaced once each — O-6).
* Enter/Space emit `mdAxisClick` for the cursor; Escape clears the cursor (only when one
  exists, so an unused Escape still bubbles); blur clears it.
* Zoomed: the cursor walks the window only; events report absolute indices.
* Tab order: plot, then the legend chips (they sit visually above the plot).
* SR-only data table (`<table>` with caption, `th scope=row`), max 200 rows plus a truncation
  note.

## 3. Zoom (oracle `pointer.json` zoom cases)

`zoom`: `none`, `inside` (drag across the plot selects a range; drag inside a zoomed window
pans; double-click on the plot resets), `slider` (an md-slider range under the plot, plus a
pan grip over the window), `both`. The window is a view: `series`/`xAxis` stay untouched.

## 4. Fixes made at this gate (test-first)

| # | Defect | Where | Test (failed before, passes after) |
|---|---|---|---|
| L1 | Changing `locale` after mount did not re-render ticks, labels or the data table | `md-line-chart.tsx` (`@Watch('locale')`) | `md-line-chart.runtime-props.e2e.ts` |
| L2 | Changing `no-animation` after mount did not reach the engine (next replay still animated) | `md-line-chart.tsx` (`@Watch('noAnimation')`) | same file |
| S1 | Chart text ignored the MD3 typescale tokens: the theme read `--md-sys-typescale-label-small-size` / `-title-small-size`, which no theme sets, so a themed `*-font-size` never reached the canvas | `utils/charts/theme.ts` (chart-only shared) — the real `*-font-size` tokens now feed the size; the old names still win when set | `charts-typescale-tokens.e2e.ts` (line, area, bar) |
| S2 | Under forced colors the legend swatches, tooltip row swatches and hover markers were repainted with the system Canvas colour while the canvas kept the series colours — the legend no longer identified the lines | `utils/charts/engine/overlay.ts`, `utils/charts/engine/hover.ts` (chart-only shared; `forced-color-adjust:none` on colour keys) | `charts-forced-colors.e2e.ts` (line, area, bar); the frozen default-tooltip body in `engine/tooltip.spec.ts` updated deliberately for the swatch's new declaration |
| T1 | Flaky `md-line-chart.interactions.e2e.ts` click tests (1–2 of 3 runs failed) | **test-only**: `await page.waitForChanges()` after each `page.mouse.click` — the spy's `lastEvent` arrives through an async binding; same fix applied to the bar interactions test | 5 dedicated reruns clean (before: 3 runs, 1/2/0 failures), plus every full regression since |

Default-theme visuals are unchanged by S1 (tokens.css sets label-small 11px, title-small 14px,
the old fallbacks).

## 5. Verification

* Before: line/area/bar + `utils/charts` = 51 suites / 931 tests, 930 passed, 1 flaky failure.
* After all fixes: line/area/bar + `utils/charts` + dependents (`md-pie-chart`,
  `md-sparkline`) = **63 suites / 1002 tests, all pass** (25 snapshots). Combined with the
  pie/sparkline fork's pending changes (`a11y.ts`, `color.ts`, pie/sparkline sources and tests)
  overlaid: **68 suites / 1036 tests, all pass**.
* Oracle (provisional): paint matrix (theme × direction × 9 variants, plus 50+ single-knob
  cases, forced colors), hover/tooltip with per-frame samples (light/dark × LTR/RTL, item,
  none, custom renderer, locale), keyboard (LTR, RTL, label-point, zoomed, inverted, legend,
  empty), pointer (marker/line/empty clicks, legend hover/toggle, drag zoom, pan, tiny drag,
  double-click reset, slider keyboard, API), runtime changes, entrance per variant on a manual
  60 Hz clock (canvas opacity, per-series pixel digest, canvas PNG every 3rd frame), hover
  emphasis per frame, all motion again under reduced motion.

## 6. Open decisions (not changed here)

* O-1 `forcedColors` is read by the theme but unused: the canvas keeps brand colours in high
  contrast. Map series/text/grid to system colours, or keep brand colours (S2 assumes keep)?
* O-2 Typescale sizes are parsed with `parseFloat`, so a `rem` token (e.g. `0.6875rem`) reads
  as 0.69 and clamps to 9px. All shipped tokens are px.
* O-3 CSS header drift: documents the `shape` default as `corner-large` (code: 16px density
  formula), omits the `loading` part/slot, and still mentions ECharts.
* O-4 Host `role="figure"` with a focusable `role="application"` inside; the in-code comment
  claims figure hides descendants from AT (it does not). Keep the structure, fix the comment?
* O-5 Arrow keys with Alt/Ctrl/Meta are swallowed (`preventDefault`), which also blocks
  Alt+← browser back while the plot has focus.
* O-6 `label-point` replaces only the first `%x%`/`%values%` (oracle `keys-label-point`).
* O-7 Escape then an arrow restarts from the first point rather than resuming.
* O-8 Changing `zoom` to `none` keeps an active window with no way to reset it from the UI.
* O-9 Dense value labels can collide (`line-dark-rtl-labels`: Mar 15/13).

## 7. Shared cartesian-chart infrastructure (also used by area and bar)

* **Theme** (`utils/charts/theme.ts`): palette from the role cycle (primary first); text
  on-surface / on-surface-variant; grid outline-variant @ 50 % (`--md-chart-grid-color`
  verbatim); axis outline-variant (`--md-chart-axis-color`); tooltip inverse-surface /
  inverse-on-surface, radius corner-small, shadow elevation-2; font family from
  `--md-sys-typescale-label-medium-font`; label size label-small (11) and title size
  title-small (14) **+ 0.5px × density**, floors 9 / 11; reduced motion → duration 0. A
  MutationObserver re-reads the theme on theme/class/style changes.
* **Engine** (`utils/charts/engine/*`): pure layout to a `RenderScene` (`layout.ts`,
  `bar-layout.ts`, `scale.ts`, `geometry.ts`), RTL by mirroring the finished scene (`rtl.ts`),
  canvas renderer (`renderer-canvas.ts`, DPR aware), DOM overlay for ticks/titles/labels/legend
  (`overlay.ts`), hover UI (`hover.ts`), hit testing (`hit-test.ts`), emphasis
  (`emphasis.ts`), intro (`animate.ts`), decimation, axis breaks.
* **Tooltip** (`utils/charts/tooltip.ts` + `hover.ts`): MD3 card, flips side near the edge,
  prefers the leading side in RTL; `tooltipRenderer` may return a string, node or null.
* **a11y** (`utils/charts/a11y.ts`): summary builder and SR table builder (200-row cap,
  en-dash ranges).
* **Legend** (`overlay.ts`): `button[aria-pressed]` chips, delegated click, hidden series at
  40 % swatch opacity; survives data re-feeds keyed by id → label → position.

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

Taken for the native port against the Web source contract (the code, as captured by the Mac Chrome 153 oracles) and the
MD3 spec. They also apply to md-area-chart and md-bar-chart (shared cartesian engine). The native ports reproduce each
kept behaviour; the paint, interaction and motion suites verify it.

| Item | Decision | Alternative | How to revert |
| --- | --- | --- | --- |
| O-1 `forcedColors` unused on the canvas | Keep the brand colours on the canvas in forced-colors mode (legend / tooltip swatches already use system colours, S2). Native platforms have no forced-colors mode to map. | Map series, text and grid to system colours. | Add a forced-colors branch to the engine's theme read (`readTheme`) and the two ports' theme readers. |
| O-2 `rem` typescale tokens | Keep px-only parsing: every shipped typescale token is px; the ports read the same px tokens. | Resolve `rem` against the root font size. | Parse `rem` in `readTheme` and in both ports' token readers. |
| O-3 CSS header drift (`shape` default, `loading` part/slot, ECharts) | The code is the contract (16 px density formula, the `loading` slot); the header text is stale documentation. The native renderers follow the code. | Change the code to the header (`corner-large`). | Documentation-only; no native change either way. |
| O-4 `role="figure"` host with a focusable `role="application"` plot | Keep the structure: natively the labelled host contains one focusable plot element (the keyboard cursor and its live announcement). | Flatten to a single labelled image / application. | Change the semantics modifiers on the plot layer in both views. |
| O-5 Arrow keys with Alt/Ctrl/Meta are consumed | Keep the source rule (arrow keys are handled whatever the modifiers); the native key handlers use the same key names. | Ignore modified arrows (let Alt+← navigate back). | Add a modifier check before the arrow branch in the source and both key handlers. |
| O-6 `label-point` replaces only the first `%x%` / `%values%` | Keep (`String.replace` semantics, oracle `keys-label-point`); native replaces the first occurrence too. | Replace every occurrence. | Switch to replace-all in the source and both ports' template fill. |
| O-7 Escape then an arrow restarts from the first point | Keep. | Resume from the last cursor. | Keep the cursor index on Escape in the source and both keyboard models. |
| O-8 `zoom` changed to `none` keeps an active window | Keep (the window stays until `resetZoom()`); native follows. | Reset the window when zoom becomes `none`. | Reset in the `zoom` watcher and in both ports' property-change path. |
| O-9 Dense value labels may collide | Keep: the source has no collision avoidance and MD3 sets no rule; native draws the same label positions (scene parity). | Add label collision avoidance. | Engine change mirrored in both ports. |
| `density` changed at runtime | Native re-reads the theme on the change; the Web keeps the stale theme until the next watched property (`density` is not watched) — a Web defect, recorded; the replays model the Web quirk to prove it is the only difference. | Model the stale theme natively too. | Re-read the theme only on watched properties in both ports. |
| Motion digest tolerance (test methodology) | Each native measurement is the interval of its ±24 / ±28 / ±32 colour-band digests and Chrome's ±28 value must fall inside (counts widened by max(24, 3 %, one-pixel ring), bounds / columns by 1 px); a target colour that anti-aliased blends of another series can reproduce (stacked areas: the third series) is compared by pixel count only. | A single ±28 band. | Drop the interval and `motionBlendAmbiguous` in `NativeChartMotionIntegration.swift` / `NativeChartMotionTest.kt`. |
