# Table family parity checkpoint

Status (2026-10-30, fork n4): md-table and its ten supporting tags (md-table-container, -head, -body, -foot, -row, -cell,
-toolbar, -sort-label, -pagination, -expand-toggle) have dedicated SwiftUI (macOS + iOS) and Compose renderers in production
dispatch (`AWCNativeView` → `nativeTableFamily`, `AWCComponent` → `NativeTableFamily`), verified against Mac Chrome 153 on
the same fixtures, with the Laboratory integration (gate 3) and tools/ax evidence; installed in canonical by n4-030
(`outputs/native-parity/md-table/checkpoint.json`). The independent final audit (gate 7) is separate. Source review and decisions: [md-table-source-review.md](md-table-source-review.md); plan:
[md-table-native-plan.md](md-table-native-plan.md).

## Source (gate 1)

Eight source defects (T1–T8) fixed test-first (family 272/272, see the source review). The provisional cloud oracle was
recaptured on the Mac (Chrome 153, job n4-001); `outputs/native-parity/md-table/cloud-vs-mac.txt` lists the differences
(computed-style reporting, timing, font raster; forced colours differ completely: Mac Chrome's forced palette is dark). The
Mac capture is the reference. The open items are decided in the source review's decision table.

## Browser reference (gate 2)

`outputs/native-parity/md-table/web-oracle/` (Chrome 153, macOS, trusted CDP input; pages in `web-reference/`):

* Paint, 128 cases: `paint-matrix` (light/dark × LTR/RTL × 13 states), `paint-density`, `paint-variants`,
  `paint-interaction`, `paint-forced-colors` and `paint-hooks` (the 52 typed hooks, one or several per case) — border boxes
  of every cell / row / part, column tracks and flat pixels.
* States, 19 runs (15 + 4 reduced motion): hover / selection (row, select-all, host property, single-mode trim), expansion
  (pointer, keyboard, `toggle()`, host property), sorting with the consumer's reorder (labels, keyboard, `setSort`),
  pagination (buttons, `setRowsPerPage`, `goToPage`, silent clamp) with the consumer's paging, the Tab order across the
  family, frozen-body wheel / thumb drag / keyboard scrolling, sticky container scrolling, loading / empty, `pinColumn` /
  `setColumnVisibility`, toolbar auto-bind — per-frame samples, events, focus, scroll offsets, pinned positions and
  phase screenshots.
* The fixtures are generated once and are byte-identical on both platforms (Swift `Tests/Fixtures/table-web-*.json`,
  Android `androidTest/assets/table/`).

## Renderers and APIs (gate 4)

* **SwiftUI** (`packages/native-ios/Sources/AWCUI`): `TableModel.swift` (row model, selection / sort / pin state, pagination
  model), `NativeTable.swift` (colours, palette, row entries), `NativeTableGrid.swift` (column tracks from the template /
  intrinsic widths, the resolved grid, pinned ranges), `NativeTableView.swift` (md-table: grid, sticky / frozen header,
  frozen-body scrollport with custom thumbs, keep-height, loading overlay / skeleton, empty state), `NativeTableParts.swift`
  (rows, cells, sort label, expand toggle, expanded zone, FLIP), `NativeTableContainer.swift` (container scrollport,
  toolbar, pagination), `NativeTableScroll.swift` (scroll bridge and controller), `NativeTableControl.swift` (controllers,
  pin layout, keyboard scrolling, motion probes), `NativeTableAppearance.swift` (hooks).
* **Compose** (`packages/native-android`): `AWCTableModel.kt`, `NativeTable.kt`, `NativeTableAppearance.kt`.
* **Methods:** `AWCTableController` (`getSelection` → `{count, total, values, all, indeterminate}`, `selectAll`,
  `deselectAll`, `toggleSelectAll`, `setSort`, `pinColumn` → effective side or nil/null, `setColumnVisibility` → effective
  visibility, `animateNextChange`, `toggleRow(id)` for md-table-row `toggle()`), `AWCTablePaginationController`
  (`goToPage`, `setRowsPerPage`). Swift `.awcTableController(_:for:)` / `.awcTablePaginationController(_:for:)` by node
  id; Compose `AWCTableControllerScope(tables, paginations)` by the `id` property.
* **Hooks:** the 52 public custom properties as eight typed structs (`AWCTableAppearance`, `AWCTableCellAppearance`,
  `AWCTableContainerAppearance`, `AWCTableExpandToggleAppearance`, `AWCTablePaginationAppearance`, `AWCTableRowAppearance`,
  `AWCTableSortLabelAppearance`, `AWCTableToolbarAppearance`; Swift `.awcTable…Appearance(_)`, Compose
  `AWCTable…AppearanceScope`) plus raw declarations (`.awcTableHooks("--md-table-…: …")` / `AWCTableHooksScope`) and
  authored `style` declarations on any family node. They inherit down the family like CSS custom properties.
* **Scrolling:** `AWCTableScrollController` (`scroll(x:y:)` in logical offsets) on the container scrollport or a frozen body.

## Results (gate 5)

Same shared fixtures on every platform (Swift `Tests/Fixtures/table-web-{paint,states}.json` = Android
`androidTest/assets/table/`, checked byte-identical at every Android build).

| Suite | macOS (SwiftUI) | iOS simulator | Android (Compose) |
| --- | --- | --- | --- |
| Paint (128 cases: geometry of every cell / row / part, column tracks, flat pixels) | 6,501 / 6,501 (paint-14) | 6,501 / 6,501 (ios-7) | 6,520 / 6,520 (paint-18) |
| States (19 runs: interaction, motion per frame, events, focus, scroll, lifecycle, phase shots) | 3,628 / 3,628 (states-14) | 3,627 / 3,627 (ios-8) | 3,495 / 3,495 (states-11) |
| Laboratory host | SwiftUI live host 107 / 107 | — | LivePreviewTableHostTest 3 / 3 |

The ten keyboard-focus paint cases are compared in the states runs (Tab order, focus rings in the phase shots). Gaps are
recorded, never counted as passes: per-frame latency (a curve aligned on the native first frame), Chrome's cancelled FLIP
glides, the wheel physics (the harness scrolls by the deltas), the RTL thumb track (source defect, decision log), focus
on a control disabled while focused, the Tab wrap after the page's last stop and the md-select tab stop (n2).
Shared-file regression (the Android edits of NativeSourceText, AWCComponent and NativeIconButton): 15 Compose suites
(button paint / parity, icon button, list, dialog, bottom sheet, snackbar, tooltip, text field, chip, accordion, checkbox,
breadcrumbs, tabs) pass; every Swift live-host test passes on the host with the table installed.

## Laboratory (gate 3)

Same contract as the other Laboratory components (Studio JS, released policies, both live hosts):

* **Appearance module** `apps/native-playground/table-appearance.js`: the 52 public custom properties as eight typed profiles
  (template, angle, display, length, colour, opacity, duration, corners, shadow kinds) in the native initializer order,
  registered in the Styles panel, theme options and framework snippets; invalid input keeps the last valid value.
* **In-place property updates** of every source property of the ten tags that have properties (md-table-head has none),
  type-checked with the source types; the live hosts apply them to the retained preview.
* **Methods with results:** md-table `getSelection` (selection snapshot), `selectAll`, `deselectAll`, `toggleSelectAll`,
  `setSort`, `pinColumn` (effective side or null), `setColumnVisibility` (effective visibility), `animateNextChange`;
  md-table-row `toggle`; md-table-pagination `goToPage`, `setRowsPerPage` — through `AWCTableController` /
  `AWCTablePaginationController` on both hosts. Results travel as `{awcTableResult}` (a bare null stays an invalid
  result for every other component).
* **Live hosts:** SwiftUI `apps/native-ios-playground/LiveRenderer` (`scripts/test-live-table.mjs`: 107 checks — hooks,
  defaults, methods and events, updates, row / pagination / sort label / cell / toolbar / container / toggle previews) and
  Compose `LivePreviewActivity` (`LivePreviewTableHostTest`: 3/3).
* **Compiled examples** (released policies): 93 Swift examples type-checked against AWCUI and 93 Compose examples compiled
  in the androidTest source set (usage, theme, copied default, every hook and its defaults, every event / method / slot of
  the eleven tags; `outputs/native-parity/md-table/laboratory/examples/`, generator `generate.mjs`).
* Studio suite: no new failure against the canonical baseline (786 pass; its 2 failures fail on canonical too); `table-integration.test.mjs` 5/5.

## Accessibility (gate 6, tools/ax)

`node tools/ax/run.mjs` on the eleven tags (16 cases; macOS SwiftUI host, Web, iOS simulator AWC-n4, Android
emulator-5562): 10 of the 11 tags pass on all three platforms (16 cases;
the accepted platform conventions are listed with their reasons in each report). md-table-pagination's open findings are
all its rows-per-page md-select (below).

* macOS: AXTable → AXRow → AXCell over the SwiftUI layout (AppKit elements; the SwiftUI elements they stand for are
  hidden), header cells as AXCells listed as the table's column headers, AXARIARowCount / AXARIARowIndex for paged data, a
  tab-stop row is its focus surface encoded as the AXRow (shared hook `AWCFocusAccessibilityOverride`, nil by default);
  AXToolbar; the pagination an AXGroup / AXLandmarkNavigation; the sort label one element named with its status.
* Android: a named collection (CollectionInfo, rows' CollectionItemInfo), header cells headings, the expand toggle a
  disclosure button (md-icon-button `aria-expanded`), polite live regions for the sort status, toolbar caption and
  pagination range.
* iOS: SwiftUI containers (exception 2); live texts announced.
* `tools/ax/compare.mjs` encodes table structure per platform (macOS AXTable / AXCell, iOS / Android container types with a
  focusable row compared as its stop); reviewed conventions in `tools/ax/expectations.mjs`.
* Open, owned by fork n2: the pagination's rows-per-page md-select is the generic picker (role button named by its value,
  not a tab stop); the Web's md-select exposes a textbox named "Rows per page:" (+ its outline's legend).

## iOS simulator execution (gate 6)

`apps/native-ios-parity` on the AWC-n4 simulator: paint 6,501 / 6,501 (ios-7), states 3,627 / 3,627 (ios-8). Curves that the simulator's HID
input starts late (touches) or early (several keys) are aligned on their own first frame and recorded as gaps.

## Exceptions

Recorded under the AUDIT exception policy (source behaviour, platform and API, technical reason, user impact, tested native
equivalent, evidence, reviewer, acceptance). Reviewer and acceptance: the independent final audit (gate 7); until then they
are **pending acceptance**, not waived.

1. **iOS: ArrowLeft / ArrowRight do not scroll md-table-container around a focused control.**
   Source: Chrome's default action scrolls the scroll container 40 px when the focused control (a checkbox, a sort label)
   does not use the arrow. Platform: iOS (UIKit hardware keyboard). Reason: on iOS the arrow keys belong to the focus
   engine (Full Keyboard Access moves focus with them), and UIKit has no default scroll of a scroll view around a focused
   control; intercepting the keys would break focus navigation. Impact: an iPad keyboard user scrolls a wide table by
   moving focus (UIKit scrolls the focused control into view) or with the pointer, not by 40 px steps. Native equivalent
   tested: macOS scrolls 40 px (states run `tb-keyboard [23] ArrowRight`), iOS focus scroll-into-view. Evidence: the iOS
   states console (`ios-*-NativeTableStatesIntegration-console.log`, gap line `iOS does not scroll the container on
   ArrowRight`).
2. **iOS: the table's structure is not exposed as a data table.**
   Source: role="table" / "treegrid" with rows, cells, column / row headers, `aria-rowcount` / `aria-rowindex` for paged
   data. Platform: iOS (UIKit accessibility through SwiftUI). Reason: SwiftUI has no data-table accessibility API for a
   custom layout (only SwiftUI `Table`, which cannot host the family's rows and controls); UIKit's
   UIAccessibilityContainerDataTable would need the cells as UIKit elements, i.e. a parallel element tree that hides
   SwiftUI's own elements and re-exposes every control inside the cells (what macOS does with AppKit, see the
   accessibility section) — on iOS the controls' VoiceOver actions (adjustable, custom actions, the hardware-keyboard focus
   surfaces) would have to be re-created for each slotted component. Impact: VoiceOver reads the table as its label, then
   the header texts and each row's cells in reading order, with the controls (sort labels, checkboxes, toggles) as
   buttons; it does not announce "row 2 of 87, column Calories" nor associate cells with their header. Native
   equivalent tested: macOS AXTable / AXRow / AXCell with AXARIARowCount / AXARIARowIndex and Android CollectionInfo /
   CollectionItemInfo (tools/ax), the rows' tab stops named by their cells on iOS. Evidence:
   `outputs/native-parity/md-table/accessibility/` (iOS reports: no table / row / cell elements, encoded in
   `tools/ax/compare.mjs` as the platform's container type).

## Known differences and gaps

* **Recorded gaps** (states runs): see Results; each is listed with its reason in the run's report
  (`native-swift/<run>/report.json`, `native-ios/*-console.log`, `native-android/states-*-device/`).
* **md-select (fork n2):** the pagination's rows-per-page select is the generic picker until the dedicated md-select
  renderer lands — its look (filled field, value colour), its accessible role / name and its tab stop follow md-select.
* **No grid keyboard model**, **consumer sorting**, **rowspan** and the other contract decisions: the source review's
  decision log.
* **Frozen bodies:** rows scrolled out of a frozen body stay in the macOS table structure through their identity (rows /
  cells are tied to their table / row ids, not to what is visible).

## Evidence

`outputs/native-parity/md-table/`: `source-tests/`, `source-changes/`, `web-reference/`, `web-oracle/` (Mac),
`web-oracle-cloud/` (provisional), `native-swift/<run>/` (run logs, reports, captures), `native-ios/`, `native-android/`
(XML, device JSON, logcat), `accessibility/`, `laboratory/examples/`, `checkpoint.json`. Jobs:
`work/claude-runner/done/n4-*.sh` and `.log`; install `work/n4-lab/install/` (n4-030).
