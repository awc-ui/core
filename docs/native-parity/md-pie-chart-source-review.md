# Pie chart source review (md-pie-chart)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
eight source defects are fixed test-first, and a browser reference (paint
matrix, per-frame entrance / hover / click / keyboard / legend / data-change
runs, reduced motion) is captured. The oracle is **provisional**: headless
Chromium 141 on Linux, captured while the Mac runner was blocked. Recapture it
on the Mac (Chrome 153) and diff before it gates native work. No native code
has changed. This is not a native completion record.

## Public contract

**Props** (defaults in brackets):

* `data: MdPieDatum[]` [`[]`]. A datum is `label`, `value`, optional `color`
  (MD3 role or any CSS colour), `id`, `selected` (exploded 12px),
  `hidden` (drawn out of the ring, chip struck through; overrides the
  reader's legend toggle), `radius` (0–1 second dimension, floored),
  `children` (an outer ring subdividing exactly the parent's arc, any depth,
  children taken in proportion to each other).
* Every index (events, legend, keyboard, table) addresses the **depth-first
  flattening** of the tree, not `data[i]`.
* Shape: `innerRadius` [`'0%'`] (px number or %), `outerRadius` [`'75%'`],
  `startAngle` [90 = 12 o'clock], `endAngle` [-270], `paddingAngle` [0°],
  `cornerRadius` [4], `ringWidths` (relative weights per ring, innermost
  first; the default gives inner rings 1.45×).
* Labels: `showLabels` [true]; `labelMode` [`value` with a legend, `both`
  without]. Inner-ring labels sit inside the band; the outermost ring of a
  legend-less or nested chart uses leader labels "Name · value", ellipsised
  by a character-width estimate (0.52 × 11px per char), not by measuring.
* Fill: `monochrome` (present-empty = `primary`; a role or a colour; a
  single-hue ramp toward the surface), `gradient` [false].
* `highlight` [`slice`] | `series` | `none`.
* `legend` [`right`], reflected. All nine anchors and `none`. The legend is
  dropped for a single slice. Under RTL every anchor mirrors, physical ones
  included (`right` → left, `top-start` → `top-end`).
* `tooltip` [`item`] is **inert** (documented). The card is always on.
* Title: `label`, `subtitle`, `titleAlign` [`start`].
* i18n: `locale` [browser], `valueFormatter` (wins over `locale` for
  values), `summary` (replaces the English `aria-label` outright),
  `tableLabels {category, value, share}`, `labelEmpty` ["No data to
  display"], `loadingLabel` ["Loading chart…"], `labelPlot` (focus
  instructions), `labelPoint` [`%label%: %value% (%percent%)`; each
  placeholder replaced once].
* `tooltipRenderer`: replaces the card's content (now applied when assigned
  after first render, P3).
* `loading` [false]: the overlay (`role="status"`, named by `loadingLabel`)
  covers the plot; the chart still paints underneath when it has data.
* Motion: `animation` [`expressive`] | `grow` | `fade` | `draw` |
  `stagger` | `none`; `animationDuration` (ms, ≤ 0 = off; default 700);
  `noAnimation`. All of it honours `prefers-reduced-motion`.
* `height` (sets the host block size), `density` [0 … -4], reflected.

**Events** (bubbling, composed, not cancelable):

* `mdSliceClick {seriesIndex: 0, seriesId: datum.id, dataIndex (flat),
  value, nativeEvent, series: datum}` — pointer click (`nativeEvent.type`
  `click`) and Enter/Space on the keyboard cursor (`keydown`). Never for a
  hidden slice (P1).
* `mdLegendClick {dataIndex, selected}` — `selected` is the new visibility
  (`false` = just hidden). No `nativeEvent`. Pointer and keyboard (the chips
  are buttons).
* `mdReady` — once, after the first engine build.

**Methods.** `refreshTheme()`, `resize()`, `replay()`, `drill(index,
'down' | 'up')` (must be awaited before the `data` swap), `toDataURL()`,
`getInstance()`.

**Slots.** `header`, `center` (aria-hidden; capped to the hole box),
`empty`, `loader` (with `loading` as the legacy inner fallback), `footer`.

**Parts.** `header`, `canvas` (the focusable plot), `plot-canvas`, `legend`,
`tooltip`, `center`, `empty`, `loading`, `footer`.

**CSS hooks** (12 documented): `--md-pie-chart-block-size` (auto),
`-min-block-size` (max(140, 200 + 12d)), `-aspect-ratio` (1 / 1),
`-background` (surface-container-low), `-padding` (max(8, 16 + 2d)),
`-shape` (max(8, 16 + 2d)), `-empty-color`, `-empty-background`,
`-empty-font`, `-empty-font-size`, `-empty-icon-size` (40px),
`-center-color` (on-surface). Two undocumented, differently prefixed hooks are
read: `--md-pie-center-max-width`, `--md-pie-center-max-height`.

## Anatomy, geometry, paint (DPR 1, light, density 0)

* Host: block, padding 16, radius 16, surface-container-low, square by
  aspect ratio. The canvas is inset by the padding; the legend takes a
  measured gutter (a second layout pass) on its side.
* Ring: slices separated by a 1px surface-coloured gap, corner radius 4.
  Inner value labels 11px, white or black by contrast with the fill actually
  painted (so a faded slice keeps a readable number).
* Palette: a harmonic ramp from primary / tertiary / secondary; a child
  without its own colour is its parent's colour mixed toward the surface
  (0.18 + 0.42 · i / n).
* Hover (slice mode): the hovered slice keeps its geometry and gains a raised
  rim band (7px at a 3px gap, opaque, drawn last); every unrelated slice fades
  62% toward the surface; its family (ancestors/descendants) is spared.
  `series` lights every slice; `none` changes nothing but still shows the
  card. The strength tweens over 260ms with the expressive ease, in and (since
  P8) out.
* Card: surface-container-high, radius 8, padding 8/10, 11px; swatch, label,
  and "value (share%)" with the share at one decimal in `locale` (P5).
* Selected slice: explodes 12px along its mid-angle (300ms tween). Press:
  ripple from the pointer, 450ms, alpha 0.16.
* Entrance: 700ms (`expressive`: canvas opacity 0 → 1 plus radial growth;
  measured settle ≈ 730ms); the drill crossfade is 520ms.

## Interaction and semantics

* Host `role="figure"`, `aria-label` from `summary` or the generated
  "Traffic sources, Pie chart, with 5 slices." (English).
* The plot (`part="canvas"`) is `role="application"`, `tabindex=0`, named by
  `labelPlot`. Keys: ArrowRight (ArrowLeft under RTL) and ArrowDown move
  forward; the opposite arrow and ArrowUp move back; both clamp at the ends;
  from no cursor, forward lands on the first slice and back on the last;
  Home / End; Escape clears; Enter / Space report the slice (`mdSliceClick`)
  and fire its press ripple; blur clears.
* The cursor visits only **drawn** slices: hidden ones and every child under
  a hidden ancestor are skipped (P1). A zero slice is reachable and clears the
  previous card (P6). When the slice under a resting cursor disappears (data
  shrinks, it becomes hidden), the cursor moves to the next drawn slice, else
  the previous one, and announces it (P2).
* Each move is announced through a polite live region from `labelPoint`;
  `%percent%` is the share of the **visible** siblings on the slice's own
  ring, up to one decimal, in `locale` — the same figure the card shows.
* A visually hidden table: caption = `label`; columns Category / Value /
  Share; every ring depth-first, a child named "Parent / Child"; each share
  against all its siblings (hidden ones included — the table is the data);
  shares printed as percentages in `locale`, never through `valueFormatter`
  (P4).

## Source defects fixed (test-first)

| # | Defect (before) | Fix | Files | Test |
|---|---|---|---|---|
| P1 | Keyboard walked hidden slices and their children: old highlight stayed lit, an invisible slice was announced, Enter emitted `mdSliceClick` for it; shares included hidden slices (keyboard 50% vs card 71.4%) | Navigable = drawn slices; share over visible same-level siblings | `md-pie-chart.tsx` | `md-pie-chart.keyboard-table.e2e.ts` (3 cases) |
| P2 | After `data` shrank, `kbIndex` pointed past the end: stale "S4" announcement, dead arrow presses | `syncKeyboardCursor()` after every engine apply and legend toggle | `md-pie-chart.tsx` | same file (2 cases) |
| P3 | `tooltipRenderer` assigned after first render ignored | `@Watch('tooltipRenderer')` | `md-pie-chart.tsx` | same file |
| P4 | SR table: Share column through `valueFormatter` ("$75.00", or "75" without %); nested rings missing | Per-column `format` in `buildDataTableHtml`; depth-first rows, path names, per-ring shares | `md-pie-chart.tsx`, **shared** `utils/charts/a11y.ts` (additive optional field) | e2e (2 cases) + `a11y.series-format.spec.ts` (4) |
| P5 | Card share not localised ("2.000,5 (66.7%)" in de-DE) | Optional `percentFormatter` on the spec; the component passes a `locale` one (1 decimal) | **shared** `engine/pie-layout.ts` (type), `engine/pie-chart.ts`, `md-pie-chart.tsx` | e2e + `pie-focus-percent.spec.ts` |
| P6 | Cursor on a zero slice left the previous slice lit with its card up | `focusIndex` clears hover when there is no arc | `engine/pie-chart.ts` | e2e + unit |
| P7 | `tooltipRenderer` context: every entry's `percent` measured against the **hovered** slice's ring (children of a hovered parent came out as shares of the parents' level) | Per-entry own-ring total | `engine/pie-chart.ts` | unit |
| P8 | Hover / keyboard treatment eased in but **snapped out** in one frame | `litIndex` keeps the last slice lit while the strength tweens to 0; forgotten on a data change | `engine/pie-chart.ts` | unit (2, with a real-clock RAF shim) |

Shared chart-only modules changed: `utils/charts/a11y.ts`,
`utils/charts/engine/pie-layout.ts`, `utils/charts/engine/pie-chart.ts`
(pie-only), and `utils/charts/engine/color.ts` (see the sparkline review).
All changes are additive or pie-only; the cartesian charts' suites pass.

## Observed, not changed (decisions needed)

1. The generated `aria-label` and table chrome defaults are English;
   `summary` must replace the whole sentence.
2. `labelPoint` placeholders are replaced once each (`String.replace`).
3. The card prints the share at one decimal ("42.0%"), the announcement and
   table at up to one ("42%"). Kept to avoid churn; pick one for native.
4. A value update under a resting cursor (index still valid) is not
   re-announced (avoids chatter on live charts).
5. The SR table counts hidden slices in the shares; the card and the
   announcement do not.
6. With the plot focused and no cursor, Space is not consumed (the page
   scrolls); the plot stays focusable while `loading`.
7. `density` only changes padding, shape and minimum height; the ring and the
   labels do not scale.
8. Outside-label truncation uses a character-width estimate; "Support · 10"
   is ellipsised in `pie-nested` with visible room left.
9. The tooltip renderer's `percent` for a hidden entry is its value over the
   visible ring total.

## CEM / source drift

* `tooltip` prop documented as inert — keep or remove.
* `cornerRadius` doc says "(reserved)" but it is applied (4).
* `animation` doc lists five presets; the type has six (`stagger`).
* CSS header lists slot `loading`; the outer slot is `loader`.
* `--md-pie-center-max-width/-height` read but undocumented, prefix differs.
* `noAnimation` is not watched (only read on the next spec build).

## Evidence

* Tests (cloud, serial): baseline 37 suites / 707 tests pass. All 5 new test
  files on pristine source: 27 fail / 5 pass (controls). Final: 42 / 741
  pass. Cartesian dependents (line, bar, area): 21 / 274 pass; one later run
  hit a known-flaky line-chart click case unrelated to the pie engine (it
  passes on isolated rerun). Logs: `outputs/native-parity/md-pie-chart/source-tests/`.
* Diffs and new tests: `outputs/native-parity/md-pie-chart/source-changes/`.
* Oracle: `outputs/native-parity/md-pie-chart/web-oracle-cloud/` — 108 paint
  cases, 34 state runs, 34 reduced-motion runs (see its README).

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

The observations above are kept as the source contract; the native port reproduces each (scene and state-run parity).

| Item | Decision | Alternative | How to revert |
| --- | --- | --- | --- |
| 1 English generated `aria-label` / table chrome | Keep; `summary` and `tableLabels` replace them on every platform. | Localised defaults. | Add locale tables to the source and both ports. |
| 2 `labelPoint` placeholders replaced once each | Keep (`String.replace`). | Replace every occurrence. | Replace-all in the source and both ports. |
| 3 Share precision differs per surface (card 1 decimal, announcement / table up to 1) | Keep each surface's own format; native matches each surface. | One format everywhere. | Change the formatter per surface in the source and both ports. |
| 4 A value update under a resting cursor is not re-announced | Keep (avoids chatter on live charts). | Re-announce. | Announce on data change in the source and both ports. |
| 5 The SR table counts hidden slices in the shares | Keep. | Count visible slices only. | Change the table share basis in the source (and the native table text, if exposed). |
| 6 Space not consumed without a cursor; plot focusable while `loading` | Keep. | Consume Space; make the plot inert while loading. | Key / focus model change in the source and both ports. |
| 7 `density` changes padding, shape and minimum height only | Keep (MD3 density does not scale data marks). | Scale ring and labels. | Engine change in the source and both ports. |
| 8 Outside-label truncation uses a character-width estimate | Keep; native uses the same estimate (scene parity incl. `pie-nested`). | Measure text. | Replace the estimate in the engine and both ports. |
| 9 Tooltip renderer `percent` for a hidden entry is over the visible total | Keep. | Over the full total. | Change the renderer context in the source and both ports. |
