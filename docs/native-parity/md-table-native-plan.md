# Table family native implementation plan (md-table and sub-components)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-table-source-review.md](md-table-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-table/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) before any native parity diff.
* md-table-pagination's new `label` prop is not in the generated native
  contracts yet: regenerate the CEM and run `native-compiler` first.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/DataViews.swift`, `table`,
`preparedTableSection`, `pagination`; routed from `AWCNativeView.swift`):

* `md-table-container`: a two-axis `ScrollView` with 12pt padding, max
  height from `maxHeight` (default 420), radius-16 surface. No variants,
  shape, elevation, top / bottom slot placement.
* `md-table`: a `VStack` of sections; caption as a headline; `loading` shows a
  `ProgressView` above the rows; `empty` shows the slot or "No rows" (Web "No
  data"). No column template, density, striped, dividers, hoverable, sticky /
  frozen header, sticky footer, pinning, skeleton, live region, aria-busy,
  row-offset / row-count, treegrid.
* Selection: the adapter owns `_tableSelection`; head rows of a `multiple`
  table get a synthetic select-all checkbox; unvalued rows use the **node
  id** (Web: body-row index, T1); `mdSelectionChange` payload matches. Single
  mode replaces the selection. No indeterminate head state.
* Sort: the **adapter sorts the rows itself** (numeric or localized compare
  on cell text) and toggles asc ↔ desc only (Web: the consumer sorts; cycle
  asc → desc → none; `default-order`); no `aria-sort`, no FLIP.
* Rows: SF Symbol checkbox button ("Select row"), a trailing chevron button
  for `expandable` (Web: an `md-table-expand-toggle` in a leading cell);
  selected tint primary 15% (Web secondary-container), highlight = surface;
  `clickable` via tap only (no focus / Enter / Space); `expanded` content
  appears without animation; divider per row.
* Cells: min width 96, padding 12 (0 for `none`), end alignment for
  `numeric` / `end`, `ellipsis` = one line, `meta` = caption font, head =
  semibold. No colspan, sticky, pin badge, scope / header traits.
* Sort label: plain button with SF arrow (35% when inactive); no hover mode,
  icon position, disabled, density, status text.
* Expand toggle: its own `_expanded` flag (not the row's), `expand_more`
  rotating 180° (Web `chevron_right` → 90°, mirrored in RTL).
* Pagination: picker for rows-per-page (default options 10 / 25 / 50; Web
  5 / 10 / 25 / 50 + all), range "a–b of n" hard-coded (no
  `label-displayed-rows`), "Rows:" default label (Web "Rows per page:"), SF
  chevrons, no `label`, no clamp, no `goToPage` / `setRowsPerPage`.
* Toolbar: "n selected" built from `labelSelected` as a suffix (Web replaces
  `%count%`); no `auto-bind`, selection band, slots.

**Android** (`packages/native-android/.../AWCNavigation.kt`,
`TableComponent`):

* `md-table` and `md-table-container` share one `Surface` (tonal elevation 3
  when `variant="elevated"`) with a horizontally scrolling `Column`; caption;
  `LinearProgressIndicator` for `loading`. No empty state, density, striped,
  sticky / frozen header, pinning, skeleton, selection coordination (no
  select-all, no `mdSelectionChange`), sort coordination (no
  `mdSortChange`), treegrid / table semantics.
* Rows: secondary-container when selected; `Checkbox` when `selectable`
  (never set by the table); expand `IconButton` inside the row
  (`expand_more` / `expand_less`); `clickable` emits `mdRowClick {value}`
  (no `row`); divider.
* Cells: min width 100, padding 12 / 0, end alignment, `heading()` semantics
  for head cells.
* Sort label: `TextButton` toggling asc / desc locally; `mdSortRequest` only.
* Expand toggle: local state only (does not drive the row).
* Pagination: "a–b / n" (no template), « ‹ › » with text glyphs for
  first / last, rows-per-page as `FilterChip`s (Web: a select), emits
  `mdPageChange` after `mdRowsPerPageChange`; no labels for first / last.
* Toolbar: headline / "n selected" text, supporting text, actions slot.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Column model | Shared tracks from `column-template` / `columns`; rows subgrid; `min-width` overflow | Per-cell min 96, stretch | Per-cell min 100 |
| Density | compact / standard / comfortable + 0…−4: rows 36/52/60, head 56 | None | None |
| Stripes / dividers / hover | `striped`, `no-dividers`, hover layer 8%, stripe tokens | Divider only | Divider only |
| Sticky header / footer | In-flow sticky in the container scroller | None | None |
| Frozen header | Separate head grid, body scroller (focusable), overlay h/v thumbs or gutter, floors | None | None |
| Pinning | `sticky` start/end, stack / static, pin badge, `pinColumn`, `setColumnVisibility` | None | None |
| Selection | Auto-wired checkboxes, select-all (indeterminate), single trim, `getSelection` & co., values = value or body-row index | Synthetic checkboxes, node-id values, no indeterminate | Row checkbox only, no coordination |
| Sort | Consumer sorts; asc → desc → none; `aria-sort`; FLIP | Adapter sorts; asc ↔ desc | Local toggle only |
| Expand | Toggle in a leading cell; grid-rows spring; treegrid + aria-expanded; RTL mirrored caret | Trailing chevron, instant | Inline button, instant |
| Loading | overlay (dim + progress) or skeleton rows; aria-busy; keep-height | Spinner above rows | Linear progress |
| Empty | Slot or "No data", min height 160, announced politely (slot text) | Slot or "No rows" | None |
| Toolbar | Selection band (secondary container), `%count%` template, auto-bind seeded | Suffix text | Suffix text |
| Pagination | Range template, labels incl. `label`, select of options + all, first/last, clamp, methods, RTL chevrons | Picker, fixed range text | Chips, "/" range |
| Container | 4 variants, shape, elevation, vibrant, max/min height, top/bottom slots, FLIP arming | ScrollView, radius 16 | Surface |
| Keyboard | Tab order per source review; Enter/Space on rows, labels, toggles; frozen body scrolling keys | Tap only | Clickable rows |
| Semantics | table / treegrid, row/cell/columnheader/rowheader, aria-rowindex/rowcount, aria-sort, aria-selected | Label on the stack | Heading on head cells |
| Reduced motion | All family transitions and FLIP dropped | n/a (no motion) | n/a |
| Forced colours / high contrast | Highlight / HighlightText selected rows (T8), CanvasText dividers, ButtonText thumbs | System | System |
| RTL | Logical layout, pinned edges and thumbs mirror, caret and chevrons mirror | System | System |

## Plan

1. **Model** (shared, both platforms): column tracks from the template (fr /
   px / minmax, content floors as T7), row groups, selection rules (T1
   identity, select-all with indeterminate, single trim, emit order from
   `states.json`), sort cycle and `aria-sort`, pagination arithmetic + clamp,
   expand state owned by the row. Unit-test against the event payloads.
2. **Grid layout**: one column-width solver shared by head, body and foot
   (frozen header aligns to body widths); density rungs; dividers, stripes,
   hover / selected / highlight / disabled paint from `paint-matrix.json`.
3. **Scrolling**: container scroller, sticky header / footer, frozen header
   with custom thumbs (geometry per frame in `tb-frozen-scroll-*`), pinned
   start / end cells (stack vs static), RTL offsets.
4. **Sub-components**: sort label (icon position, hover mode, 180° arrow),
   expand toggle (90° caret, RTL mirror, drives the row), toolbar (selection
   band, template, auto-bind), pagination (labels, select, first / last,
   methods), container variants.
5. **Motion**: FLIP on sort / page, expand spring, hover / selection fades;
   all off under reduced motion.
6. **Semantics and keyboard**: table / treegrid roles or platform
   equivalents, header traits, sort and selection state, row index of total,
   live empty announcement; the Tab sequence and activation keys.
7. **Loading, empty, forced colours / high contrast** per the oracle.
8. **Contracts**: parity tests per platform for selection / sort / pagination
   payloads, the keyboard sequence and the paint matrix against the
   recaptured oracle.

## Open decisions to settle before native work

* `rowspan` (does not span rows on Web; remove, document or redesign).
* RTL caret change (T3) vs the old `chevron_left` workaround.
* Unvalued row identity for paged data (add `row-offset`?).
* Space activation on keydown; English fallbacks with no prop ("Data table",
  "Table toolbar", visible "No data"); silent pagination clamp;
  first-occurrence placeholders; `:host-context` RTL in pagination; no grid
  arrow-key model.
* Whether native adapters keep sorting rows themselves (iOS) or follow the
  Web consumer-sorts contract.

## Evidence

* Source review, tests and oracle: see
  [md-table-source-review.md](md-table-source-review.md),
  `outputs/native-parity/md-table/source-tests/`,
  `outputs/native-parity/md-table/web-oracle-cloud/` (109 paint cases, 19
  state runs, 268 screenshots; provisional).
