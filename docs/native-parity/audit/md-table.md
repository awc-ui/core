# Gate 7 re-check (s7-15, 2026-11-16): md-table, md-table-pagination, md-table-cell (re-check of s7-9 findings R5-18, R5-12)

**Verdict: md-table FAIL (blocking S7-15-01, S7-15-02); md-table-pagination PASS (R5-18 closed); md-table-cell PASS (R5-12 closed). The other eight tags keep their s7-9 PASS.**

Reviewer s7-15 (lane r5, Android lane a6 emulator-5566, simulator AWC-r5). Snapshot `work/audit/s7-15-tree` (canonical at 2026-11-16 20:46 Mac time, includes install 9-11-100). Evidence root `work/audit/s7-15/`, jobs `work/claude-runner/done/7-15-*.log`.

## Re-run counts
| Suite | Platform | Result | Job |
|---|---|---|---|
| NativeTablePaintIntegration | macOS | 7403/7403 (6 span assertions) | 7-15-002-macos-table |
| NativeTableStatesIntegration | macOS | 3858/3859 (load 275 at start, 1 motion check), then 3859/3859 twice | 7-15-002-macos-table, 7-15-005-rerun (r2, r3) |
| NativeTablePaintIntegration | iPhone 26.3 | 7400/7400 (3 span assertions) | 7-15-004-ios |
| NativeTableStatesIntegration | iPhone 26.3 | 3862/3862, 3862/3862, 3860/3862; rerun 3862/3862, 3860/3862 | 7-15-004-ios, 7-15-005-rerun |
| NativeTableStatesIntegration | iOS 18.6 | 3860/3862 | 7-15-004-ios |
| NativeTablePaintTest / NativeTableStatesTest | Android emulator-5566 | 1/1, 1/1 (BUILD SUCCESSFUL) | 7-15-A002-android |
| LivePreviewTableHostTest | Android | 3/3 | 7-15-A002-android |
| tools/ax md-table-pagination x3 | macOS | 0 open each | 7-15-003-ax-mac |
| tools/ax md-otp-field (5 cases), md-autocomplete (7 cases) | macOS | 0 open | 7-15-003-ax-mac |
| tools/ax md-table, md-table-cell, md-table-pagination compare | macOS+web+iOS | 0 open (7 cases) | 7-15-005-rerun |
| tools/ax same, with web | macOS+web+Android | md-table-cell 0, md-table-pagination 0, md-table 5 open (macOS name x4, focus x1: S7-15-02) | 7-15-A004-ax-android-web |

## R5-18 (md-table-pagination, macOS Tab order): FIXED, VERIFIED
Three consecutive macOS tools/ax runs of md-table-pagination on the s7-15 snapshot have 0 open findings (7-15-003-ax-mac pag run 1..3); Tab leaves the rows-per-page field. The same host branch for md-otp-field and md-autocomplete is unchanged: 0 open. iOS and Android compare 0 open.

## R5-12 (md-table-cell rowSpan): FIXED, VERIFIED
The rowspan case asserts a span > 1 on every platform: Web aria-rowspan 2; macOS AXCell rowIndexRange [1,2]; iOS rowRange [1,2]; Android CollectionItemInfo rowSpan 2 (7-15-A004-ax-android-web, compare without span finding). Paint suites assert the span as a layout metric (macOS 6, iOS 3). Note: the Android-only run 7-15-A002 skipped the Web side and proves nothing about spans; only A004 does.

## Blocking findings (md-table), see work/audit/DEFECTS.md
- S7-15-01: iOS `tb-contract click-calories-default-desc` motion order check fails in 3 of 6 iPhone/iOS 18 runs (native row-order animation starts 40 ms after the Web one); no KNOWN-CAUSES row, not explained by load (load 103 in the failing rerun).
- S7-15-02: md-table Web role flips between `table` and `treegrid` for identical fixtures; with `table` tools/ax reports macOS row names and focus as open (10 open in 7-15-003, 5 in 7-15-A004, 0 in 7-15-005). KNOWN-CAUSES row 63 describes it; the tools/ax wait installed by 9-11 does not remove it.

## Exceptions
No new exceptions proposed; the accepted ones from s7-9 stand (Android heading/option name conventions, iOS 44 pt target note on the sort button).


---

## Earlier review (s7-9, 2026-11-16), superseded by the section above where they differ

# Gate 7 re-check (s7-9, 2026-11-16): md-table family (md-table, -container, -head, -body, -foot, -row, -cell, -toolbar, -sort-label, -pagination, -expand-toggle)

**Verdict: FAIL for md-table and md-table-pagination (blocking R5-18); md-table-cell FAIL, non-blocking (R5-12); the other 8 tags PASS**



## Re-run counts (reviewer s7-9, 2026-11-16, snapshot work/audit/s7-9-tree)
| Suite | Platform | Result | Job |
|---|---|---|---|
| NativeTablePaintIntegration | macOS | 7403/7403 (141 cases) | s7-9-002-macos |
| NativeTablePaintIntegration | iPhone 26.3 / iOS 18 | 7400/7400 (141 cases, 3 span assertions) each | s7-9-003 / s7-9-004 |
| NativeTableStatesIntegration | macOS | 3859/3859 | s7-9-002-macos |
| NativeTableStatesIntegration | iPhone 26.3 x3 / iOS 18 x1 | 3862/3862 each (no failure; latency gaps 154-161 recorded) | s7-9-003 / s7-9-004 |
| Android NativeTablePaintTest, NativeTableStatesTest, LivePreviewTableHostTest | Android | BUILD SUCCESSFUL, 3 of 3 | s7-9-A003-android |
| test-live-table, stdio host, 4177 probes | Laboratory | 107 checks; probes ok | s7-9-005-lab-ax |
| Compiled examples | Swift typecheck / Kotlin compile | 93 / 93 | s7-9-006, s7-9-A004 |
| tools/ax, 11 table tags, Android | Android | pass for all 11 tags (accepted: pagination 13, md-table 21) | s7-9-A005-ax-android |
| tools/ax, 11 table tags, macOS | macOS | pass for 10 tags; md-table-pagination 1 OPEN focus, reproduced 3/3 | s7-9-005-lab-ax, s7-9-007-ax-mac-pagination (runs 1, 2) |
| tools/ax iOS | iOS | pass for 11 tags (pagination 4 accepted) | s7-9-005-lab-ax |

## Blocking finding
- **R5-18** (md-table-pagination, md-table; macOS gate 6): Tab never leaves the rows-per-page field editor (Web: field, Next page, Last page; macOS: field x6). Cause: the host half of the story 4-2 fix (`"md-table-pagination"` in the field-editor Tab list of `apps/native-ios-playground/LiveRenderer/main.swift`) is not on canonical; the install guard `grep -q md-table-pagination` matched unrelated occurrences and skipped the patch. Suggested fix in DEFECTS.md. R5-09 therefore stays open on macOS (iOS and Android re-confirmed pass).

## Non-blocking finding
- **R5-12** (md-table-cell): rowSpan reaches the semantics (NativeTableAccessibility rowSpan, Android CollectionItemInfo) and the paint fixture has a rowSpan 2 cell whose metric is asserted (3 span assertions), but no AX test asserts a row range > 1 in tools/ax. Contract row without a semantic test: verdict FAIL for md-table-cell until added.

## Other findings re-checked
- R5-07 (33 table parts typed): FIXED, paint 7403/7403 / 7400/7400. R5-10, R5-11, R5-14, R5-16: FIXED (iOS states 3862/3862 x3, no failure; Android states class passes; table tools/ax iOS pass).
- R5-13: summary, loader slot, title-area slot, defaultOrder, sortedAscendingLabel and the not-selectable checkbox click are present in the Chrome oracle fixtures (table-web-paint.json / table-web-states.json) and are compared by the fixture-driven suites; accepted as covered. A dedicated lone-label mdSortRequest assertion exists (states suite).
- R5-15: FIXED (suites registered and run by name).
- Exceptions: none outstanding.


---

## Earlier review (r5, 2026-10-31), superseded by the section above

# Gate 7 audit — `md-table` (+ md-table-container, -head, -body, -foot, -row, -cell, -toolbar, -sort-label, -pagination, -expand-toggle)

Reviewer: gate-7 reviewer r5, 2026-10-31. **Verdict: FAIL** for md-table and its ten supporting tags — findings R5-07, R5-09, R5-10, R5-11, R5-12, R5-13, R5-14, R5-15, R5-16. Exceptions: (1) iOS arrow-key container scroll **rejected**, (2) iOS data-table semantics **rejected**.

Snapshot `work/audit/r5-tree`: rsync of canonical `work/awc-native` at 2026-10-31 02:12 Mac local time (job r5-001; 42 install jobs, latest `fx-072-install-orgchart-apk`), build products excluded, `node_modules` linked; inventory regenerated from it (`work/audit/r5/evidence/current-inventory.json`). Reviewer evidence: `work/audit/r5/evidence/`; jobs: `work/claude-runner/done/r5-*`. Platforms: macOS 15.6.1 (24G90), Xcode 26.3 (17C529); simulators AWC-r5 (iPhone 17 Pro, iOS 26.3.1), AWC-r5-pad (iPad Pro 11-inch M5, iOS 26.3.1), AWC-r5-18 (iPhone 16 Pro, iOS 18.6); Android emulator-5566 (AwcNative7, API 36) with the snapshot's private project.

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | FAIL | 222 rows over the eleven tags (93 properties, 11 events, 11 methods, 22 slots, 52 hooks, 33 parts). Properties, events, methods, slots and hooks have SwiftUI + Compose code and Laboratory exposure (52 typed hooks in `table-appearance.js`); paint fixtures cover the hooks. Open: 33 parts without surface or exception (R5-07); `rowSpan` not implemented despite the decision (R5-12); untested rows (R5-13). `rowgroup` on md-table-row is table-stamped; natively it follows the head / body / foot structure (acceptable internal parent contract). |
| 2 Implementation | PASS with gaps | Dedicated renderers in production dispatch; iOS arrow-key container scroll missing (R5-10); iOS AttributeGraph cycles in pagination (R5-16). |
| 3 Laboratory | PASS | SwiftUI and Compose live sessions for every family tag with updates; methods with results (below); live hosts 107/107 and 3/3; examples compile. |
| 4 Behaviour | FAIL | Android states fail inside a combined instrumentation run (R5-14); Swift / iOS suites green; suites not registered in the canonical runner (R5-15). |
| 5 Visual | PASS (re-run) | Paint 6,501/6,501 (Android 6,520/6,520) geometry + pixel checks vs Chrome on every platform. |
| 6 Runtime + accessibility | FAIL | Suites pass on macOS, iPhone 26.3, iPad 26.3, iPhone iOS 18.6, Android. tools/ax: md-table-pagination open findings (R5-09); iOS exceptions rejected (R5-10, R5-11). |
| 7 Independent audit | FAIL | This document. |

## Re-runs (claimed → r5)

The canonical checkpoint has no source hashes for the installed files that could be matched; every suite was re-run on the snapshot with the canonical shared fixtures (`packages/native-ios/Tests/Fixtures/table-web-*`, Android `androidTest/assets/table/`).

| Suite | Claimed | macOS (r5-004) | iPhone 17 Pro 26.3 (r5-007) | iPad Pro 11 26.3 (r5-010) | iPhone 16 Pro 18.6 (r5-011) | Android emulator-5566 |
| --- | --- | --- | --- | --- | --- | --- |
| Paint (128 cases) | 6,501 (Android 6,520) | 6,501/6,501 | 6,501/6,501 | 6,501/6,501 | 6,501/6,501 | 6,520/6,520 (r5-A001) |
| States (19 runs) | 3,628 macOS / 3,627 iOS / 3,495 Android | 3,628/3,628 (178 latency gaps) | 3,627/3,627 (157) | 3,627/3,627 (162) | 3,627/3,627 (150) | **3,479/3,495** in r5-A001 (with the other classes); 3,495/3,495 alone (r5-A002) |
| Hosts | SwiftUI 107/107, Android 3/3 | test-live-table.mjs 107/107 (r5-012) | | | | LivePreviewTableHostTest 3/3 (r5-A001) |

iOS counts exclude the arrow-key container scroll, downgraded to a gap under `#if os(iOS)` (R5-10). Gaps are reported by the suites and not counted; note that the motion check passes a curve when ≥ 90 % of Chrome's frames are matched within ±2 frames after re-aligning the start by up to 120 ms (macOS) / 200 ms (iOS), recording the rest as gaps — a tolerance the component doc should state ("gaps are never counted as passes" is not literally true for partial curves).

## Laboratory (gate 3)

4177 server probe (r5-005 / r5-0075), SwiftUI and Compose: sessions 200 for md-table, -container, -row, -cell, -toolbar, -sort-label, -pagination, -expand-toggle with one property update each; md-table `selectAll` → `mdRowSelectionChange` events, `getSelection()` → `{count: 3, total: 3, values: [project-0, project-1, project-2], all: true, indeterminate: false}`, `setSort(name, desc)` → `mdSortChange {name, desc}`, `pinColumn(0, start)` → null; md-table-pagination `goToPage(2)` → `mdPageChange {page: 2}`, `setRowsPerPage(25)` → `mdRowsPerPageChange {25}` (display "1–25 of 87"); md-table-row `toggle()` → `mdRowExpandedChange {expanded: true}`. Studio `table-integration.test.mjs` in the 36/36 subset (r5-012). Examples regenerated from canonical (owner's generator, r5-006): 93 SwiftUI type-check, 93 Compose compile (r5-A003); the published `verification.json` input hashes (NativeSupport.json, support.json, native-api-examples.js) no longer match canonical — superseded by the re-run.

## Accessibility (gate 6)

tools/ax re-run (r5-008, r5-A005; `evidence/ax/<tag>/report.md`):

- `md-table`: macOS pass, 2 accepted; iOS pass; Android pass, 21 accepted (3 cases)
- `md-table-container`: macOS pass; iOS pass; Android pass, 1 accepted (1 cases)
- `md-table-head`: macOS pass; iOS pass; Android pass, 1 accepted (1 cases)
- `md-table-body`: macOS pass; iOS pass; Android pass (1 cases)
- `md-table-foot`: macOS pass; iOS pass; Android pass (1 cases)
- `md-table-row`: macOS pass; iOS pass; Android pass (2 cases)
- `md-table-cell`: macOS pass; iOS pass; Android pass (1 cases)
- `md-table-toolbar`: macOS pass; iOS pass; Android pass, 1 accepted (2 cases)
- `md-table-sort-label`: macOS pass; iOS pass; Android pass, 2 accepted (2 cases)
- `md-table-pagination`: macOS 7 open, 1 accepted; iOS 7 open, 2 accepted; Android 7 open, 11 accepted (2 cases)
- `md-table-expand-toggle`: macOS pass; iOS pass; Android pass (1 cases)

md-table-pagination's open findings are its rows-per-page md-select (generic picker: no textbox / legend, extra button "10", not a Tab stop) — R5-09; md-select (fork n2) has no dedicated native renderer yet, so the required child and therefore md-table cannot pass.

## Exceptions

### 1. iOS: ArrowLeft / ArrowRight do not scroll md-table-container — REJECTED (gate-7 reviewer r5, 2026-10-31)

Fields present, but the gap is implementable. The record argues that intercepting arrows would break focus navigation; AWC already intercepts arrow keys on iOS through `UIKeyCommand` for its own controls (NativeFocusBridge applicable groups / routeKey, chart plot, slider), the iPhone has no system focus engine (`UIFocusSystem` is nil, ios-harness.md), and the frozen-body ArrowRight scroll — the same behaviour on md-table's own body — passes on iOS (`tb-frozen-scroll-ltr [8] ArrowRight-x3`). The cited evidence line is not printed in the console (it is recorded as a gap in report.json), and the decision log entry it references ("iOS arrow scrolling") does not exist. Required: route arrows the focused control does not use to the container's scroll controller on iOS and remove the `#if os(iOS)` gap (R5-10).

### 2. iOS: no data-table structure — REJECTED (gate-7 reviewer r5, 2026-10-31)

Fields present; user impact real (VoiceOver users lose row / column position and header association that iOS Safari gives for the same Web table). Implementable: macOS already re-exposes the SwiftUI layout as an AppKit AXTable / AXRow / AXCell tree, UIKit provides `UIAccessibilityContainerDataTable` / `…DataTableCell`, and public SwiftUI semantics allow at least row containers labelled with `aria-rowindex` / `aria-rowcount` and per-cell column headers (`accessibilityCustomContent`, rotors). Cost is not a technical impossibility (R5-11).

## Findings

- **R5-07** (1): The table family's CSS parts (`caption`, `grid`, `header-grid`, `hscrollbar(-thumb)`, `vscrollbar(-thumb)`, `skeleton-row`, `loading`, `progress`, `empty`; cell `content`, `pin`; container `top`, `scroll`, `bottom`; row `expanded`; sort label `icon`, `label`; toolbar 6; pagination 8) have neither a native part surface nor an exception record.
- **R5-09** (6): tools/ax re-run: 7 open findings on each of macOS, iOS and Android (21): the rows-per-page md-select is the generic picker — no textbox "Rows per page:" / legend, an extra button "10", and it is not a Tab stop (Web Tab order starts at it), so keyboard users cannot change rows per page. Depends on the md-select native renderer (fork n2; md-select is still "native migration pending" in AUDIT.md).
- **R5-10** (2, 6 (exception 1 rejected)): ArrowLeft / ArrowRight do not scroll md-table-container 40 px around a focused control on iOS; the iOS states run downgrades the check to a gap (`#if os(iOS)` in NativeTableStatesIntegration.swift), so 3627 vs macOS 3628 checks. Implementable: AWC already routes arrow keys on iOS through `UIKeyCommand` (NativeFocusBridge: applicable groups, routeKey; charts, slider) and the frozen-body ArrowRight scroll passes on iOS (`tb-frozen-scroll-* ArrowRight-x3`).
- **R5-11** (6 (exception 2 rejected)): iOS exposes no data-table semantics (no row/column position, no header association). Implementable: macOS already builds an AppKit AXTable/AXRow/AXCell tree over the SwiftUI layout; UIKit offers `UIAccessibilityContainerDataTable` / `UIAccessibilityContainerDataTableCell`; at minimum SwiftUI can expose per-row containers labelled with `aria-rowindex/rowcount` ("Row 2 of 87") and per-cell column headers (`accessibilityCustomContent` / rotor).
- **R5-12** (1): `rowSpan` is not read by either renderer; the decision log says "Native: same (no spanning, the value reaches the cell's semantics)", but no semantics carry it (macOS AXCell row range, Android CollectionItemInfo rowSpan).
- **R5-13** (1, 4): Contract rows with no native test: md-table `summary`, `loader` slot; md-table-row `selectable=false`; md-table-sort-label `defaultOrder`, custom `sortedAscendingLabel` / `sortedDescendingLabel`, `mdSortRequest` of a label outside a table; md-table-toolbar `title-area` slot.
- **R5-14** (4): `NativeTableStatesTest` failed 3479/3495 when run with the other r5 classes in one instrumentation run (r5-A001: tb-expand-ltr Tab → expand toggle "focus none", Enter/Space on the toggle no events/expansion, tb-toolbar-autobind one motion curve), and passed alone (r5-A002). Order/state-dependent keyboard focus: either a test-isolation leak (touch mode / focus) or a real first-key focus defect.
- **R5-15** (4): The chart (`NativeChartScene/Interaction/Motion`, `NativeChartViewsSmoke`) and table (`NativeTablePaint/States`) Swift suites are not in `packages/native-ios/scripts/test-native-views.sh`, so the canonical integration (`integrate-swift.sh`) never runs them; they only ran from fork lab scripts (n5-lab/build-scene.sh, n4-lab/scripts/build-test.sh).
- **R5-16** (6 (runtime warning)): SwiftUI logs 72 "AttributeGraph: cycle detected" warnings during the pagination runs (tb-pagination-ltr/-rtl, reduced/tb-pagination-rm) on iPhone and iPad iOS 26.3 (none on macOS): a dependency cycle in the pagination / table update path.

## Observations (non-blocking)

- The cited dependency md-select is outside this audit; md-checkbox, md-icon-button, md-tooltip, md-progress-indicator have their own rows.
- Supporting-tag verdicts follow md-table: a parent cannot pass with a failing required child (md-table-pagination), and the family-wide findings (R5-07, R5-13, R5-15) apply to every tag.

## Gate 7 re-check (s7-19, 2026-11-19): FAIL (blocking S7-15-01 residual; open S9-16-03)

Scope: S7-15-01, S7-15-02 (fixes of story 9-16) and C910-01 (story 9-15). Verdicts of md-table-pagination and md-table-cell (s7-15) stand. Snapshot `work/audit/s7-19-tree`, lanes r6 / a1 (emulator-5556), simulators AWC-r6 (iPhone 26.3), iOS 18.6 clone, AWC-r6-ipad. Job logs: `claude-runner/done/7-19-recheck-table-2-*.log`; outputs `work/audit/s7-19/out/`.

| Run | Result | Load (1-min) |
| --- | --- | --- |
| macOS Table paint | 7403/7403 | (002) |
| macOS Table states | 3859/3859 | (002) |
| iPhone 26.3 states, 8 runs (s1..s8) | 3829, 3861, 3862, 3862, 3862, 3862, 3862, 3858 of 3862 | median 367, 16, 152, 43, 48, 82, 136, 80 |
| iOS 18.6 states, 2 runs | 3862/3862 twice | median 134, 42 |
| iPad 26.3 states, 5 runs | 3862, 3862, 3857, 3862, 3862 | median 103, 43, 55, 12, 18 |
| iPhone paint | 7400/7400 | |
| Android NativeTablePaintTest / NativeTableStatesTest / LivePreviewTableHostTest | 1/1, 1/1, 3/3 pass | |
| tools/ax md-table, macOS x3 | 0 open each (run 1: multiple case timed out in `configure` at load 158, exit 1; runs 2 and 3 complete) | |
| tools/ax iOS (macOS+iOS+Web+compare, 7 cases) | 0 open | |
| tools/ax Android (macOS+Android+Web+compare, out.json 184 KB) | 0 open | |

S7-15-02: the Web role of every md-table capture (loading, rowspan, sorted always; multiple in runs 2, 3, iOS, Android) is `treegrid`; no `table`. Accepted as fixed. Note: the first iOS and Android ax jobs (006, A001, run without the macOS phase / without AWC_A_TEST) captured 0 cases and reported "0 open"; they are not evidence and were repeated (008, A003). See S7-19-01.

S7-15-01 residual (not closed): iPhone run s2 ran in a quiet machine (median load 16) and failed `tb-sort-ltr [3] click-dessert: motion order 38/44`; the 9-16 A/B rate (2 of 10) fits. Misses in s1, iPad s3 and s8 were at load above 30 and are class load, not counted. Story 9-38 found the Table suite catches a product delay of 33 ms but not of 17 ms: this is the shared window, not a Table defect. Lost clicks (tb-hover-select-rtl click-head-checkbox in s1, tb-hover-select-ltr click-row-3-cell-rowclick in s8, both at high load) match S9-16-03, which stays open.

C910-01: five iPad rounds, no Tab focus-name failure in any (the 5 failures of s3 are sort motion and a pagination phase shot at load 109). Fixed. Regression compare: iPad TextField states tf1 2047/2052 (5 fail, all motion, load median 22) against Button 1 / TextField 6 in 9-15 job 012: no regression.

Limits of the evidence: the macOS runner pins the overlay scroller style (`-AppleShowScrollBars WhenScrolling`); the always-visible scroller mode is not a tested configuration (open question with the user). The Android and iOS 18.6 runs are single or double runs. Most iOS runs ran at load above 30.
