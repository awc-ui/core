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
