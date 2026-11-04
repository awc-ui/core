# Table family source review (md-table and its ten sub-components)

Status: Gates 1–6 done (2026-10-30, fork n4); independent final audit (gate 7) pending. The contract of md-table,
md-table-container, -head, -body, -foot, -row, -cell, -toolbar, -pagination, -sort-label and -expand-toggle is inventoried;
eight source defects (T1–T8) were fixed test-first (below). The oracle was recaptured on Mac Chrome 153 (the reference;
the provisional cloud capture is kept for comparison) and drives the dedicated SwiftUI and Compose renderers, the
Laboratory integration and the accessibility evidence recorded in [md-table.md](md-table.md). The open questions below
are decided in the decision log at the end of this review.

## Public contract

### md-table

**Layout props.** `column-template` (any `grid-template-columns`; wins over
`columns`), `columns` (`repeat(n, minmax(0, 1fr))`), `min-width` (horizontal
overflow floor), `density` (`compact` | `standard` (default) | `comfortable` |
0 … −4: rows 36 / 52 / 60, head 56, ±4px per rung; compact also sets
`--md-checkbox-touch-target-size: 32px`), `striped`, `no-dividers`,
`hoverable` (true), `motion` (`expressive` | `none`).

**Header / footer / scroll.** `sticky-header` (in-flow sticky head inside the
container's scroller), `frozen-header` (separate head and body grids, body is
a focusable scroll region, header tracks follow the body's resolved widths,
custom overlay scrollbars), `keep-height` (true: the body never shrinks below
its first height during loading), `scrollbar` (`overlay` | `gutter`, frozen
only), `sticky-footer`, `mdScroll {scrollLeft, scrollTop}` (frozen only).
In frozen mode with sort labels or pins the table **rewrites
`column-template`** with content floors (T7).

**Pinning.** `sticky="start|end"` on cells; `pin-mode` (`stack` — pinned
columns stack at the edge — | `static` — side by side); `pin-icon`
(ligature; cast to every pinned head cell); `pinColumn(column, side)` and
`setColumnVisibility(column, visible)` use original 0-based indexes, need a
`repeat()`-free template, no colspans and one cell per column; events
`mdPinChange {column, side}`, `mdColumnVisibilityChange {column, visible,
hidden}`.

**Selection.** `selection` (`none` | `single` | `multiple`); slotted
`md-checkbox`es in `padding="checkbox"` cells are auto-wired (head checkbox =
select all, indeterminate when partial); `getSelection()`, `selectAll()`,
`deselectAll()`, `toggleSelectAll()`; `mdSelectionChange {count, total,
values, all, indeterminate}` (not on load). Unvalued rows are identified by
their **body-row index** (T1). Switching to `single` trims to the first
selected row and emits.

**Sort.** `sort-by`, `sort-order`; head `md-table-sort-label`s raise
`mdSortRequest`; the table cycles asc → desc → none (default order honoured),
stamps `aria-sort` on the head cell and emits `mdSortChange {column, order}`;
`setSort(column, order)`. The consumer reorders rows synchronously; the table
FLIP-animates (`motion="expressive"`, `animateNextChange()` for other
mutations), and the container arms the same motion for pagination events.

**Loading / empty.** `loading` (`aria-busy`), `loading-mode` (`overlay`:
dimmed body + progress line; `skeleton`: `loading-rows` (4) shimmer rows),
`loader` / `loading` slots; `empty` with the `empty` slot (default text "No
data"); a persistent polite live region announces the empty state's text
(T5).

**Naming / ARIA.** `label` (accessible name; "Data table" fallback),
`caption` (visual, aria-hidden, names the table), `summary`
(`aria-description`), `row-offset` + `row-count` (`aria-rowindex` /
`aria-rowcount` for paged data). The structural role is `table`, promoted to
`treegrid` when any row is `expandable`. The table stamps `rowgroup`,
`data-stripe`, `data-sticky`, `data-last`, `data-adjacent-foot`,
`aria-rowindex`, `aria-selected` and `aria-sort`.

**Parts.** `caption`, `grid`, `header-grid`, `hscrollbar(-thumb)`,
`vscrollbar(-thumb)`, `skeleton-row`, `loading`, `progress`, `empty`.
**Hooks.** `--md-table-body-max-h`, `-cell-padding-block/-inline`,
`-columns-template`, `-divider-color`, `-empty-min-height`, `-foot-bg`,
`-head-bg`, `-head-color`, `-header-height`, `-min-width`,
`-row-height-compact/-standard/-comfortable`, `-row-hover-color`,
`-row-selected-bg`, `-row-selected-color`, `-stripe-color`.

### Sub-components

* **md-table-container** — `variant` elevated | outlined | filled | flat,
  `shape`, `max-height` (forwarded to a frozen table's body), `min-height`,
  `vibrant`, `elevation`; slots `top` / default / `bottom`; horizontal scroll
  (`part="scroll"`); arms the table's FLIP on `mdPageChange` /
  `mdRowsPerPageChange`.
* **md-table-head / -body / -foot** — rowgroups; the head moves to the
  table's `head` slot in frozen mode (never author `slot="head"`).
* **md-table-row** — `rowgroup`, `selected` (mutable), `disabled`,
  `selectable`, `clickable` (tab stop; Enter / Space on keydown when the row
  itself has focus → `mdRowClick {value, row}`; clicks on interactive
  descendants ignored), `value` (identity; default = row index, T1),
  `expandable`, `expanded` (mutable; `expanded` slot; grid-rows spring 500ms,
  content 350ms after 60ms), `highlight`; `toggle()`;
  `mdRowSelectionChange {selected, value}`, `mdRowExpandedChange
  {expanded}`. Rows are subgrid items on the table's column tracks.
* **md-table-cell** — `align`, `numeric` (end + tabular figures), `padding`
  default | none | checkbox, `head` (+ `scope`: columnheader / rowheader),
  `sticky` start | end, `colspan`, `rowspan`, `ellipsis`, `variant` body |
  meta, `no-pin-indicator`, `pin-icon`, `density`; parts `content`, `pin`.
  Pinned cells are opaque and fade with the row (150ms; dropped under reduced
  motion, T2).
* **md-table-sort-label** — `column`, `disabled`, `default-order`,
  `icon-position`, `icon`, `inactive-icon` always | hover, `active`, `order`,
  `sorted-ascending-label` / `sorted-descending-label` (visually hidden status
  text), `density`; `role="button"`, Enter / Space on keydown; arrow rotates
  180° for desc (350ms spring).
* **md-table-expand-toggle** — `button-label` ("Expand row"), `icon`
  (`chevron_right`); `md-icon-button` xs with `aria-expanded`; rotates by
  `--md-table-expand-toggle-rotation` (90deg); mirrored in RTL (T3).
* **md-table-pagination** — `count`, `page`, `rows-per-page`,
  `rows-per-page-options` ("5,10,25,50", `all`), `show-first-last`,
  `label-displayed-rows` ("%from%–%to% of %count%"), `label-rows-per-page`,
  `label-first-page` / `-previous-page` / `-next-page` / `-last-page`,
  `label-all`, **`label`** (landmark name, new, T6), `compact`, `disabled`,
  `density`; `goToPage()`, `setRowsPerPage()`; `mdPageChange {page}`,
  `mdRowsPerPageChange`; page silently clamped when `count` / rows-per-page
  shrink; chevrons mirrored in RTL.
* **md-table-toolbar** — `headline`, `supporting-text`, `num-selected`
  (mutable), `auto-bind`, `label-selected` ("%count% selected"), `compact`,
  `density`; slots `leading`, `headline`, `supporting-text`, `title-area`,
  `actions`, `selection-actions`; `role="toolbar"` named by the headline or
  "Table toolbar"; selection mode when `num-selected > 0` (secondary
  container band, polite caption). `auto-bind` seeds from and tracks the
  container's table across re-connection (T4).

### Keyboard

No grid navigation (static table semantics, documented): Tab visits, in DOM
order, the head checkbox, sort labels, then per row the clickable row, its
checkbox and its expand toggle, then the container's pagination (select,
enabled buttons). Enter / Space activate rows, sort labels and toggles; arrow
keys do nothing on rows. In frozen mode the body scroller is a tab stop:
PageUp / PageDown / Home / End scroll vertically, arrows scroll both axes.
Measured in `states.json` (`tb-keyboard`, `tb-frozen-scroll-*`).

### Motion

Rows, pinned cells and the scrollbar thumbs: 150ms background; row hover
layer; sort arrow 350ms spring; expand zone 500ms + content 350ms; toggle
caret 350ms; toolbar band 200ms fade; FLIP glide and entrant fade/rise on
sort and page changes; skeleton shimmer 1.4s. Under `prefers-reduced-motion`
every family-owned transition and the FLIP are dropped (T2 closed the last
two); nested `md-ripple`, `md-checkbox` and `md-icon-button` keep their own
timing.

## Paint and interaction reference

`outputs/native-parity/md-table/web-oracle-cloud/` (README there): 109 paint
cases (`paint-matrix` 52 = light/dark × LTR/RTL × 13 states, `paint-density`
15, `paint-variants` 19, `paint-interaction` 18, `paint-forced-colors` 5) and
19 state runs (`states.json` 15 runs / 127 phases / 3,684 frames / 207 events
/ 509 animation records; `states-reduced-motion.json` 4 runs / 32 phases /
1,175 frames), 268 screenshots, with scroll / sticky geometry per case and
per frame.

## Source defects fixed (test-first)

Every new test failed on the unchanged source and passes after its fix; each
file also carries a guard that passed before and after.

* **T1. Unvalued rows reported the wrong identity** (`md-table.tsx`,
  `md-table-row.tsx`). Selection values used the index *within the selected
  subset* (rows 1 and 3 → `["0","1"]`), and `mdRowClick` /
  `mdRowSelectionChange` sent `""`, although `value` documents "Defaults to
  row index".
  * Fix: both use the row's index among the table's body rows (head / foot
    rows: within their group).
  * Test: `md-table.selection-values.e2e.ts` (2).
* **T2. Reduced motion missed pinned cells and scrollbar thumbs**
  (`md-table-cell.css`, `md-table.css`). Rows dropped their 150ms
  transitions, pinned cells and the custom thumbs kept them, so the pinned
  column lagged its row.
  * Fix: reduced-motion blocks for the cell host and both thumbs.
  * Test: `md-table.reduced-motion.e2e.ts` (2).
* **T3. The expand caret was not mirrored in RTL**
  (`md-table-expand-toggle.css`). The family's other chevrons mirror.
  * Fix: `:host(:dir(rtl))` applies `scaleX(-1)` before the rotation (still
    points down when open; works for host or ancestor `dir`).
  * Test: `md-table-expand-toggle.rtl.e2e.ts` (2). Readme: the old
    `icon="chevron_left"` workaround now double-mirrors (see decisions).
* **T4. `auto-bind` lost the selection** (`md-table-toolbar.tsx`). It bound
  once in `componentDidLoad`, never read the current selection, and a moved
  toolbar stayed unbound.
  * Fix: bind on load, on re-connection and when `auto-bind` turns on; seed
    from `getSelection()` unless a live event arrived first; unbind on
    disconnect.
  * Test: `md-table-toolbar.auto-bind.e2e.ts` (2).
* **T5. The empty-state announcement was hard-coded English**
  (`md-table.tsx`). Screen readers heard "No data" while the slot said
  "Keine Daten".
  * Fix: announce the slotted empty state's readable text (aria-hidden /
    hidden skipped, aria-label used), else "No data".
  * Test: `md-table.empty-announcement.e2e.ts` (2).
* **T6. The pagination landmark name could not be localised**
  (`md-table-pagination.tsx`). It was a literal "Pagination" rewritten on
  every render.
  * Fix: new `label` prop (default "Pagination").
  * Test: `md-table-pagination.label.e2e.ts` (2).
* **T7. Frozen header + sort labels collapsed `minmax()` templates into one
  column** (`md-table.tsx`; found by the paint oracle). Header floors wrote
  `minmax(Npx, minmax(a, b))` (and `minmax(Npx, fit-content(…))`), which is
  invalid, so the whole template was dropped and every cell stacked in a
  single 100% column.
  * Fix: `floorTrack()` — plain track → `minmax(N, t)`; `minmax(a, b)` →
    `minmax(max(N, a), b)` (keyword minimum replaced by N); `fit-content()`
    left unfloored.
  * Test: `md-table.frozen-floors.e2e.ts` (4: sort labels, after
    `pinColumn`, fit-content, plain-track guard).
* **T8. A selected row was unreadable in forced colours**
  (`md-table-row.css`; found by the forced-colours oracle). HighlightText
  text got a Canvas backplate (white on white) and pinned cells were forced
  to Canvas.
  * Fix: the selected row keeps the Highlight / HighlightText pair with
    `forced-color-adjust: none` (inherited by its cells) and casts
    `--md-table-cell-sticky-bg: Highlight`.
  * Test: `md-table-row.forced-colors.e2e.ts` (2; screenshot pixels decoded
    in the page).

Readmes updated: md-table (empty announcement, frozen floors), -row (identity,
forced colours), -cell (reduced motion), -toolbar (auto-bind lifecycle),
-pagination (`label`), -expand-toggle (RTL).

## Observed, not changed (decisions needed)

* **`rowspan` cannot span rows.** Each row is its own subgrid item, so
  `grid-row: span N` only grows the cell inside its own row; the next row's
  cells do not shift, yet `aria-rowspan` is exposed (visual and AT disagree).
  Remove / document as unsupported, or change the row architecture.
* **T3 compatibility.** Authors who followed the old readme
  (`icon="chevron_left"` in RTL) now get a double mirror; confirm the
  behaviour change.
* **Unvalued row identity is positional** (T1 now matches the docs). Should
  it add `row-offset` for paged data?
* **Space activates** rows and sort labels on keydown (buttons activate on
  keyup).
* **English fallbacks** with no prop: table "Data table", toolbar "Table
  toolbar", visible empty text "No data" (slot only).
* **Pagination clamps `page` silently** when `count` or rows-per-page shrink
  (no `mdPageChange`).
* **Placeholders** in `label-displayed-rows` and `label-selected` replace only
  the first occurrence.
* **RTL** in md-table-pagination uses `:host-context([dir=rtl])` (Chromium
  only) next to `:host([dir=rtl])`; md-table-expand-toggle now uses `:dir()`.
* **No grid keyboard model** (arrow-key cell navigation) — documented static
  table semantics.
* **Density props** on cells and sort labels only cascade to slotted content.
* **Stencil warning**: `_hasExpandedSlot changed during componentDidLoad()`
  in md-table-row (one extra render).
* **Untranslated range text in RTL** is reordered by the bidi algorithm
  ("of 12 10–6"); consumers must localise `label-displayed-rows`.
* **Headless capture** hides native scrollbars (`scrollbar="gutter"` not
  visible in the oracle).

## Decisions (autonomous, 2026-10-27 / 2026-10-30, reversible)

Taken by fork n4 under the parallel-work protocol: each open item is decided for the Web source contract / MD3 spec and
mirrored natively; nothing here is a silent waiver (platform limits are AUDIT exception records in [md-table.md](md-table.md#exceptions)).

| Decision | Alternative | How to revert |
| --- | --- | --- |
| `rowspan` is reflected as `aria-rowspan` only and does not span rows (each row is its own subgrid item); documented as such. Native: same (no spanning, the value reaches the cell's semantics). | Rework the rows into one grid so `grid-row: span N` spans. | Change the row architecture in `md-table` / `md-table-row` and the native grids (`AWCTableResolvedGrid`, `NativeTableOwner`) together. |
| T3: the expand caret mirrors itself in RTL (`:dir(rtl)`); authors no longer pass `chevron_left`. Native: mirrored caret, probe in the source's terms. | Keep the old readme contract (author-supplied RTL icon). | Drop the `:dir(rtl)` rule and the native `scaleEffect` / `graphicsLayer` mirror. |
| Unvalued row identity stays positional (T1); `rowOffset` / `rowCount` only feed the row-index semantics of paged data. | Derive identity from `rowOffset`. | Key rows by `rowOffset + index` in the source and both runtimes. |
| Space activates rows and sort labels on keydown, as the source. | Activate on keyup like buttons. | Move the Space handling to keyup in the three implementations. |
| English fallbacks without props: "Data table", "Table toolbar", "No data" (the empty text is visible only through the slot). Native: same strings. | Require labels / localise. | Change the fallbacks in the source and both renderers. |
| Pagination clamps `page` silently when `count` or rows-per-page shrink (no `mdPageChange`). | Emit `mdPageChange` on a clamp. | Emit from the clamp in the source and both models (`AWCTablePaginationModel`). |
| `label-displayed-rows` / `label-selected` replace only the first placeholder occurrence. | Replace all. | `replaceAll` in the source and both models. |
| Pagination RTL: the source's `:host-context([dir=rtl])` is matched by the native layout direction. | — | — |
| No grid keyboard model (static table semantics: Tab between controls, no arrow-key cell navigation). | WAI grid navigation. | Add roving cell focus to the source and both renderers. |
| Sorting follows the source contract: `mdSortChange` / `setSort`, the application reorders its rows; natives never reorder (the old iOS adapter sorted rows itself). | Native sorting of authored rows. | Reinstate a native sort pass behind an opt-in property. |
| `--md-table-pagination-padding-inline` is declared but never read by the source's `padding-inline`: no effect on the Web and none natively. | Fix the source to read it. | Read the variable in `md-table-pagination.css` and in both pagination renderers. |
| `--md-table-container-shape` / `-color` have no visible effect: the shape class and the variant surface rules always win (readme). Native: same. | Let the hooks win. | Reorder the cascade in `md-table-container.css` and the native container. |
| RTL custom horizontal thumb: Chrome places it from the track's inline start translated by (1 − p)·travel (a source defect: it starts on the left and travels right). Native follows the documented intent (starts at the right end, travels left); the states test masks that track and records the gap. | Copy Chrome's placement. | Use `translateX(-(1 - p)·travel)` in the source, or Chrome's placement natively (`thumb` offset in `NativeTableView` / `NativeTable.kt`). |
| Focus on a control in a sticky / frozen head row does not scroll the table (Chrome does not scroll sticky elements into view). Native: the head group opts out of bring-into-view. | Scroll the focused header cell into view. | Remove `NativeTableNoFocusScroll` (Compose) / the head's focus scroll suppression (SwiftUI). |
| Forced colours (macOS): table-owned paint emulates Mac Chrome's forced palette (`Canvas` black, `CanvasText` white, `Highlight` cyan); nested md-checkbox / md-icon-button keep their own forced modes (their suites). | — | `awcTableForcedColors` / `LocalAWCTableForcedColors`. |
| A frozen right-to-left body is a physical left-to-right scrollport around the right-to-left grid; its inline start (scrollLeft 0) is the physical right edge and offsets are mapped logically. | — | `rtlOverride` in `AWCTableScrollBridge`. |
| Loading overlay: the scrim follows the progress line in DOM order, so it dims the line as well (both platforms). | — | Swap the two layers back. |
| Test semantics (all platforms): a curve passes when the native curve passes through the Web value within ±2 frames; curves are aligned on the native first changed frame and a later start is reported as a latency gap, never as a pass; Chrome's cancelled FLIP glides (`transitioncancel`), the macOS wheel injection fallback (SwiftUI's scroll view ignores synthesized wheel events; the harness scrolls by the wheel deltas), the RTL thumb above, focus loss on a control that becomes disabled (Android drops focus, Chrome keeps it) and the Tab wrap after the page's last stop are reported as gaps. | Count them as failures. | The gap rules in `NativeTableStatesIntegration.swift` / `NativeTableStatesTest.kt`. |
| Density props on md-table-cell / md-table-sort-label only cascade to slotted content (the source sizes the cell from the table's density). Native: same. | Let the cell's own density resize it. | Read the cell / label `density` in the source's cell CSS and in both cell renderers. |
| The md-table-row Stencil warning (`_hasExpandedSlot changed during componentDidLoad()`, one extra render) is a Web-only render detail; no native counterpart. | Fix the source's slot probe. | — |
| Untranslated range text in RTL is reordered by the bidi algorithm ("of 12 10–6"); consumers localise `label-displayed-rows`. Native: the same string through the platform bidi. | Isolate the numbers with FSI / PDI in the default template. | Wrap the placeholders in U+2068 / U+2069 in the source default and in `AWCTablePaginationModel`. |
| Headless capture hid native scrollbars: the oracle was recaptured on Mac Chrome 153 (n4-001), which is the reference; the cloud capture stays in `web-oracle-cloud/` for comparison only. | Keep the cloud oracle. | — |
| Accessibility structure as Chrome exposes the source's ARIA: macOS AXTable → AXRow → AXCell (header cells AXCells, no row groups, aria-rowcount / rowindex), the toolbar AXToolbar, the pagination a navigation landmark, through AppKit elements over the SwiftUI layout and the shared focus-surface hook (a tab-stop row is its focus surface encoded as AXRow); Android a named collection (CollectionInfo / CollectionItemInfo) with header cells as headings; a lone part shown without a table (Laboratory) has no table semantics, as on the Web. iOS: SwiftUI containers (exception 2 in md-table.md). | SwiftUI default containers (AXGroup). | Remove `AWCTableAXRoot` / markers (`NativeTableAccessibility.swift`) and the `awcAccessibilityOverride` hook; Compose `semantics` in `NativeTable.kt`. |
| The sort label is one element named with its status ("Project sorted descending", the sr-only text), announced politely when it changes (Android: the status is the button's stateDescription with a polite live region, expectation in tools/ax). | Name without the status, value carries it. | `AWCTableAX.sortLabelName`, the label's `.onChange` announcement; Compose `liveRegion` / `stateDescription`. |
| Live text (toolbar selection caption, pagination range, aria-live="polite") is announced with a low-priority announcement (iOS / macOS) or a polite live region (Android); no "updates frequently" trait. | Mark the text updatesFrequently. | `AWCTableAX.announce` calls in `NativeTableContainer.swift`; `liveRegion` in `NativeTable.kt`. |
| Laboratory: a table method's result travels from the live hosts as `{awcTableResult: value}`, so `null` (pinColumn with nothing pinned) stays distinguishable from an invalid result for every other component. | Accept a bare null in the generic method-result check. | `tableMethodValue` (table-appearance.js) and both hosts' invoke wrappers. |

## Evidence

* Tests (Linux Chromium 141, Stencil 4.44.0 patched, serial): family before
  30 suites / 254 tests; after 38 / 272. New tests on the original source: 12
  failed, 6 guards passed; after the fixes 18 / 18. Dependents
  (`utils/flip.spec.ts`, `utils/isolation-escape.spec.ts`) 2 / 16 before and
  after (no changed import). Logs:
  `outputs/native-parity/md-table/source-tests/`.
* Source: `outputs/native-parity/md-table/source-changes/`
  (`md-table-gate1.patch`, `manifest.tsv` with pre / post SHA-256 per file;
  every Mac pre-image matched the cloud snapshot and every post-image matched
  after the copy).
