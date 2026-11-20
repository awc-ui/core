# Gate 7 re-check (s7-9, 2026-11-16): md-organization-chart

**Verdict: PASS**



## Re-run counts (reviewer s7-9, 2026-11-16, snapshot work/audit/s7-9-tree)
| Suite | Platform | Result | Job |
|---|---|---|---|
| NativeOrgChartPaintIntegration | macOS / iPhone 26.3 / iOS 18 | 1644/1644 each | s7-9-002-macos / s7-9-003 / s7-9-004 |
| NativeOrgChartStatesIntegration | macOS / iPhone / iOS 18 | 1253/1253 each | same |
| Android NativeOrgChartPaintTest, NativeOrgChartStatesTest, LivePreviewOrgChartHostTest (emulator-5566) | Android | BUILD SUCCESSFUL, 3 of 3 | s7-9-A003-android |
| stdio host validation, test-live-orgchart, 4177 probes | Laboratory | ok | s7-9-005-lab-ax |
| Compiled examples | Swift typecheck / Kotlin compile | 22 / 22 | s7-9-006, s7-9-A004 |
| tools/ax (8 cases) | macOS, iOS, Android | pass, 0 accepted, 0 open | s7-9-005, s7-9-A005 |

## Findings re-checked
- R5-06: 14 typed parts implemented (paint 1644/1644 on every runtime); no `::part` exception remains.
- R5-08: generated IR `md-organization-chart` has 15 css properties and 14 parts (read in the snapshot). The inventory generator could not be re-run in the snapshot (no git metadata: s7-9-006 `inventory exit 1`); the IR read replaces it.
No blocking finding.


---

## Earlier review (r5, 2026-10-31), superseded by the section above

# Gate 7 audit — `md-organization-chart`

Reviewer: gate-7 reviewer r5, 2026-10-31. **Verdict: FAIL** — findings R5-06 (`::part` exception rejected) and R5-08 (CEM / source metadata drift). Every suite, the Laboratory and the accessibility comparison re-ran green.

Snapshot `work/audit/r5-tree`: rsync of canonical `work/awc-native` at 2026-10-31 02:12 Mac local time (job r5-001; 42 install jobs, latest `fx-072-install-orgchart-apk`), build products excluded, `node_modules` linked; inventory regenerated from it (`work/audit/r5/evidence/current-inventory.json`). Reviewer evidence: `work/audit/r5/evidence/`; jobs: `work/claude-runner/done/r5-*`. Platforms: macOS 15.6.1 (24G90), Xcode 26.3 (17C529); simulators AWC-r5 (iPhone 17 Pro, iOS 26.3.1), AWC-r5-pad (iPad Pro 11-inch M5, iOS 26.3.1), AWC-r5-18 (iPhone 16 Pro, iOS 18.6); Android emulator-5566 (AwcNative7, API 36) with the snapshot's private project.

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | FAIL | 9 properties, 2 events, 0 methods, 1 slot (`empty`), 15 hooks (`--md-org-chart-*`, from the CSS: the CEM / inventory list none), 14 parts (CEM lists 10). All properties, events, the slot and the 15 hooks have SwiftUI + Compose code, Laboratory exposure (`orgchart-appearance.js`, released policies) and Chrome-compared tests (every hook in the paint fixture). Open: parts without a native surface (R5-06), metadata drift (R5-08). |
| 2 Implementation | PASS | Dedicated renderers in production dispatch; paint and states against Chrome 153 (below). |
| 3 Laboratory | PASS | SwiftUI live session + update 200; Android live session + update 200 (one transient 502 `ANDROID_HOST_FAILED` in r5-005, 3/3 retries pass in r5-0075); live hosts and examples pass. |
| 4 Behaviour | PASS (re-run) | States 1253/1253 on every platform (iPad: 1 of 3 runs 1252/1256, see observations). |
| 5 Visual | PASS (re-run) | Paint 1437/1437 (Android 1434/1434) pixel + geometry checks vs Chrome. |
| 6 Runtime + accessibility | PASS | macOS, iPhone 26.3, iPad 26.3, iPhone iOS 18.6, Android; tools/ax macOS pass; iOS pass; Android pass (8 cases). |
| 7 Independent audit | FAIL | This document. |

## Re-runs (claimed → r5)

| Suite | Claimed | macOS (r5-004, canonical `test-native-views.sh`) | iPhone 17 Pro 26.3 (r5-007) | iPad Pro 11 26.3 (r5-010, r5-013) | iPhone 16 Pro 18.6 (r5-011) | Android emulator-5566 (r5-A001) |
| --- | --- | --- | --- | --- | --- | --- |
| NativeOrgChartPaintIntegration / NativeOrgChartPaintTest | 1437 (Android 1434) | 1437/1437 | 1437/1437 | 1437/1437 | 1437/1437 | 1434/1434 |
| NativeOrgChartStatesIntegration / NativeOrgChartStatesTest | 1253 | 1253/1253 | 1253/1253 | 1252/1256, then 1253/1253 ×2 | 1253/1253 | 1253/1253 |
| Live hosts | Swift 19/19, Android pass | test-live-orgchart.mjs pass (r5-012) | | | | LivePreviewOrgChartHostTest pass |

The iOS evidence in the component doc (iPhone only, 2026-10-30 11:04) predates the install (fx-068 / fx-072, 2026-10-31 00:03); the re-runs above are on the installed code and add iPad 26.3 and iOS 18.6.

## Laboratory (gate 3)

- 4177 server (r5-005 / r5-0075): SwiftUI session 200, update `{orientation: horizontal, selectionMode: multiple}` 200; Android session 200 and update 200 on 3 of 3 retries (the first r5-005 attempt returned 502 `ANDROID_HOST_FAILED` right after the previous preview closed; not reproducible).
- Studio `orgchart-integration.test.mjs` in the 36/36 subset (r5-012); examples regenerated with the owner's generator from canonical (r5-006): 22 SwiftUI type-check, 22 Compose compile (r5-A003). The published `laboratory/examples/verification.json` input hashes no longer match canonical; the re-run supersedes it.

## Accessibility (gate 6)

tools/ax re-run (r5-008 / r5-A005): macOS pass; iOS pass; Android pass (8 cases), 0 open; the tree / treeitem encodings are documented in the source review.

## Exceptions

### md-organization-chart/part-selectors — REJECTED (gate-7 reviewer r5, 2026-10-31)

The record is complete but the behaviour is implementable: the record itself states "A typed part surface (as `AWCAvatarPartAppearance` for md-avatar, the md-list / md-card part surfaces) is implementable", and those surfaces exist and are tested. Required: `AWCOrgChartPartAppearance` for the 14 parts (incl. the state parts `node-selected`, `branch-on-path`), Laboratory part rules, examples and paint tests (R5-06).

## Findings

- **R5-06** (1 (exception rejected)): Proposed `::part` exceptions rejected: per-part restyling is implementable natively and the codebase already does it with typed part surfaces where part rules win over hooks (md-card `AWCCardPartAppearance`, md-list `AWCListPartAppearance` + placeholder part, md-avatar `AWCAvatarPartAppearance`, md-checkbox `AWCCheckboxPartAppearance`); the org chart record itself states the surface is implementable.
- **R5-08** (1, 7): CEM / source drift still unresolved: the 15 `--md-org-chart-*` hooks are absent from the CEM, the IR and `current-inventory.json` (AUDIT row shows 0 CSS hooks) because the shared generator expects `--md-organization-chart-*`; the CEM lists 10 of the 14 parts (`branch`, `branch-on-path`, `node`, `node-selected` missing).

## Observations (non-blocking)

- iPad 26.3 states: one run (r5-010, under load) had 4 per-frame motion samples outside Chrome's one-frame window (`full/pointer-multiple` click-support +33…+66 ms, 1252/1256); two re-runs (r5-013) passed 1253/1253 — the same harness timing class as the iPad click-shot notes in ios-harness.md.
- Dependencies md-avatar, md-icon-button, md-ripple, md-tooltip have their own rows; the SVG avatar decoding was exercised through the org chart paint suite on every platform.
