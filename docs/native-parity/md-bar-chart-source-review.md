# Bar chart source review (md-bar-chart) — Gate 1

Status: **Gate 1 passed in the cloud** with two engine fixes (polar layout, polar click), the two shared fixes from
the line review, and the test-only interaction-flake fix. Oracle: **provisional cloud capture**
in `outputs/native-parity/md-bar-chart/web-oracle-cloud/` — recapture on the Mac (Chrome 153).

Shared infrastructure: [md-line-chart-source-review.md §7](md-line-chart-source-review.md#7-shared-cartesian-chart-infrastructure-also-used-by-area-and-bar).

## 1. Public contract

| Prop (attribute) | Default | Contract |
|---|---|---|
| `series` | `[]` | `label`, `data`, `id`, `color`, `stack` (group id), `hidden`, `yAxisIndex` (→ `y-axis2`), `range` (floating bars), `overlay` + `widthRatio` (bullet/target bar on the full band), `pointColors`, `pointWidths` (variwide bands) |
| `xAxis` / `yAxis` / `yAxis2` | — | Category axis, value axis, optional second value axis |
| `layout` (reflected) | `vertical` | `vertical` or `horizontal` (categories down the side) |
| `stack` | `none` | `none` (grouped), `normal`, `percentage`, `silhouette`, `wiggle`; stack groups side by side |
| `category-gap` | `30%` | Gap between category bands (`%` of band or px) |
| `bar-gap` | `20%` | Gap between sibling bars (`%` of a bar or px) |
| `bar-width` | auto | Fixed px width, centred in its slot, clamped to the slot |
| `corner-radius` | 6 | Rounds only the free end (stack: outermost segment per sign) |
| `show-labels` | `false` | Value labels bound to the bar tip (animate with it) |
| `show-totals` | `false` | Stack totals (stacked only) |
| `chevron` | `false` | Arrow-shaped segments interlocking along a stack |
| `polar` (reflected), `polar-hole`, `polar-sweep` | `false`, 0.22, 0.75 | One ring per category (category 0 outermost), value as angle from 12 o'clock, names in the free quarter, value ticks around the outside; zoom gestures ignored |
| `clickable` | `false` | Pointer cursor over bars only (events fire regardless) |
| `legend` (reflected), `tooltip`, `grid`, `axis-ticks`, `zoom`, `locale`, `label`, `subtitle`, `title-align`, `label-plot`, `label-point`, `label-zoom-*`, `animation`, `animation-duration`, `no-animation`, `loading` (reflected), `loading-label`, `height`, `density`, `value-formatter`, `tooltip-renderer` | as line | `tooltip`: only `none` is honoured; `item` renders the axis card (documented) |
| — | — | **No** `label-empty` (empty text hard-coded "No data to display"; slot `empty` still works), **no** `summary`, **no** `table-labels` (O-B1) |

Events: `mdBarClick {seriesIndex, seriesId, dataIndex, value, axisValue, nativeEvent}`,
`mdLegendClick`, `mdHover`, `mdReady`, `mdZoom`. Methods: `refreshTheme`, `resize`, `replay`,
`drill(index, 'down'|'up')` (animate the next data swap as a drill — await it first),
`toDataURL`, `getInstance`, `setZoom`, `resetZoom`. Slots/parts/hooks mirror the line chart
with the `--md-bar-chart-*` prefix.

Motion: same intro variants; bars grow from the value-axis zero line (`barBaseline`), stacks
rise as one column; `draw` staggers bars; polar rings sweep from nothing along a fixed radius;
value labels track the animating bar tips. Non-polar bars have **no hover emphasis**; polar
segments spotlight (others fade toward the surface by 62 %, `POLAR_FADE_MS`) and the polar
tooltip waits for a short dwell.

Keyboard: as line, except Enter/Space (and legacy `Spacebar`) emit `mdBarClick` for the
**first visible series** at the cursor, even when that series has no value there (O-B3); in
`horizontal` and `polar` layouts the categories are still walked with ←/→ (Up/Down unhandled,
O-B2).

## 2. Fixes made at this gate (test-first)

| # | Defect | Where | Test |
|---|---|---|---|
| B1 | **Polar + unstacked series overlapped**: every series of a category was drawn on the same ring radius from 12 o'clock, so a series hid under any longer one drawn after it (characterization data: Q4's series A fully hidden), and the hit test spotlighted the hidden segment instead of the visible one | `utils/charts/engine/bar-layout.ts` (`radialScene`): each visible series (or stack group) gets its own sub-ring of the category ring with `barGapRatio` between siblings — the radial form of grouped bars; one slot keeps the full ring, so stacked and single-series polar charts are unchanged; caps per sub-ring | new `utils/charts/engine/bar-polar-grouped.spec.ts` (3 of 5 failed before); `bar-layout.characterization` snapshots `polar` and `polar-tuned` (the two unstacked polar cases) re-pinned — `polar-stacked` and all 22 others unchanged |
| B2 | **Polar segments ignored pointer clicks**: the click hit test only looked at `scene.bars`, which is empty on a polar chart, so no `mdBarClick` ever fired — although the segment shows a hand cursor on hover and Enter on the keyboard cursor does emit | `utils/charts/engine/bar-chart.ts` (`handleClick` hit-tests `scene.slices` with the hover's `sliceAt`; the hole and gaps still emit nothing) | new `md-bar-chart.polar-click.e2e.ts` (failed before) |
| S1, S2 | typescale tokens; forced-colors colour keys | shared, see line review | bar rows in both tests |
| T1 | flaky click test | **test-only**: `md-bar-chart.interactions.e2e.ts` waits after `mouse.click` | regression |

Locale and `no-animation` already re-applied at runtime on the bar chart (it watches them); it
served as the passing control in `md-line-chart.runtime-props.e2e.ts`.

## 3. Verification

Oracle: paint matrix (theme × direction × 9 variants: grouped, stacked + totals, horizontal,
horizontal stacked + labels, negatives, labels, chevron, polar, square/tight gaps), extras
(percentage, bar width, px gaps, radius 16, horizontal negatives, polar hole/sweep, polar
stacked, dual axis, clickable, horizontal RTL, chevron horizontal, all common knobs), forced
colors, hover (vertical, horizontal, stacked), keys (incl. horizontal), pointer (bar clicks,
horizontal, negative, stacked segment, polar segment, legend, zoom), runtime, entrance per
variant for grouped/stacked/horizontal/negative/polar/chevron with value-label tracks, polar
spotlight per frame, reduced motion.

## 4. Open decisions

* O-B1 Bar lacks `label-empty`, `summary` and `table-labels` (line and area have them) — the
  empty text and the summary cannot be localised.
* O-B2 Horizontal and polar layouts walk categories with ←/→ only; ↑/↓ would match the visual
  axis.
* O-B3 Keyboard Enter reports the first visible series even where its value is null.
* O-B4 B1 changes the geometry of unstacked multi-series polar charts (intended; confirm).
* O-B5 A double-click reset on a zoomed plot first delivers its two single clicks (`mdAxisClick`/`mdBarClick` where they hit), then `mdZoom {reset:true}` (oracle `pointer.json`) — same on line and area.
* Line review O-1…O-9 apply here too.

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

Line review decisions (O-1…O-9, runtime `density`, motion digest tolerance) apply here too.

| Item | Decision | Alternative | How to revert |
| --- | --- | --- | --- |
| O-B4 / B1 Unstacked multi-series polar bars (behaviour change) | Follow the fixed Web layout (grouped rings instead of overlapping); native draws the grouped rings (scene parity). | Restore the overlapping ring offsets. | Revert B1 in the bar layout and the two ports' polar layout. |
| O-B1 No `label-empty` / `summary` / `table-labels` | Keep the source contract; native exposes exactly the IR properties. | Add the three properties (Web + native). | — |
| O-B2 Horizontal / polar layouts walk with ←/→ only | Keep (oracle `keys.json`); native identical. | ↑/↓ on the horizontal layout. | Key map change in the source and both keyboard models. |
| O-B3 Enter reports the first visible series even with a null value | Keep; native identical. | Skip null series. | Change the Enter detail in the source and both ports. |
| O-B5 Double-click reset first delivers its two single clicks | Keep (Chrome event order, oracle `pointer.json`); native replays it identically. | Suppress the clicks of a double click. | Pointer model change in the source and both ports. |
