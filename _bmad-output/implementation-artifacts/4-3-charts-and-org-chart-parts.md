---
title: 'Charts and organization chart: typed parts and remaining R5 items'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '4-3-charts-and-org-chart-parts'
epic: 4
model: 'sonnet'
wave: 2
lanes: 'mac lane d4 · android lane a6 (emulator-5566) · simulator AWC-d4'
lab: 'work/d5-lab/charts and the org-chart files in work/d5-lab'
depends_on: ['4-1-r5-post-install-verification']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Chart parts (R5-06) were wired on SwiftUI only for some sites; Compose chart parts, zoom part sites, the 14 org-chart parts, Laboratory part fields and examples, and the `area-colors-hex` fill colour difference were open before the install.

**Approach:** Start from story 4-1's status table. Finish typed parts on both platforms with Chrome ::part cases, close the remaining chart findings, install.

## Boundaries & Constraints

**Always:** Shared `AWCPartStyle` is the part style type. `getInstance()` stays out of the supported methods (R5-05). The rules in project-context.md apply.

**Never:** No `::part` exception records.

</intent-contract>

## Code Map

- `work/d5-lab/charts` -- chart sources, NativeChartPaintIntegration, parts capture
- `OrgChartParts.swift`, `OrgChartParts.kt`, `patch-orgchart-*.py`, `lab-patch-parts.py` in `work/d5-lab` -- org-chart part work
- Handover section below (filled by story 4-1)

## Tasks & Acceptance

**Execution:**
- [x] Chart parts on Compose and zoom part sites on both platforms; chart paint suite on Android and iOS
- [x] Org-chart 14 parts on SwiftUI and Compose with Chrome ::part cases
- [x] Laboratory part fields and compiled examples for charts and org chart
- [x] Root-cause `area-colors-hex` (blue channel ~21 levels off) and fix
- [x] iPad org-chart first card click 1-2 frames off: classify with a probe (harness or product) and fix
- [x] Install; update DEFECTS.md (R5-01..R5-06, R5-08, R5-15, R5-17), docs, checkpoints

**Acceptance Criteria:**
- Given every published chart and org-chart ::part case, when rendered natively on macOS, iOS and Android, then boxes and pixels match Chrome
- Given the five charts' paint suites, when they run on all platforms, then every case passes
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

Written by story 4-1 on 2026-11-14 from canonical runs (jobs `4-1-r5-post-install-verification-002/003/A002/A003`, logs `work/claude-runner/done/` and `work/d5-lab/out/4-1/`). Two parts of this story's problem statement are already done on canonical; start from the real state.

**Already done on canonical (verified, do not redo)**
- Chart parts on SwiftUI and Compose, zoom parts and all five charts' paint-parts/paint-hooks subsets: macOS 1045/1045, iOS 1045/1045, Android pass (22 case groups, 2092 checks, 0 failures; the A002 timeout was load, A003 passed).
- Org chart 14 parts on SwiftUI and Compose: macOS 1644/1644, iOS 1644/1644, Android pass (1640 checks). Org chart states 1253/1253 on macOS and iOS.
- R5-01, R5-02, R5-03, R5-04, R5-05, R5-06, R5-08, R5-15, R5-17 have FIXED status lines in DEFECTS.md. Studio suite 872/872. `md-organization-chart` checkpoint confirmed current; chart checkpoints current.

**Exact open items**
1. Laboratory part fields, part rules and compiled examples for the five charts and md-organization-chart: none exist (no chart/org-chart/table entries in `apps/native-playground/appearance-part-rules.js` or `native-api-examples.js`; d5-033 even patched the test to the "parts are Web-only" wording). Pattern: `appearance-part-rules.js`, accordion part examples. Adding them changes shared Laboratory registries: anchored edits in an install job only.
2. `area-colors-hex` (blue channel about 21 levels off): not investigated by 4-1; the case is in `Tests/Fixtures/chart-web-paint/md-area-chart/shots-paint-extra/` and Android `ChartWebPaint/md-area-chart/shots-paint-extra/`, and the paint suites pass, so check whether the case is accepted with a tolerance and why (do not widen tolerances without Chrome variance evidence).
3. iPad org-chart first card click 1-2 frames off (3/1262 checks, varies per run, d5-021 / di): not re-run in 4-1 (iPhone 1253/1253 passed on canonical). Classify with a probe (harness or product).
4. R5-01: the server route `POST /api/native-live/session?platform=ios` for the charts was not re-probed after the install (only `test-live-charts` 57 checks and the status endpoints 200); needs a probe on port 4177 by a main-queue job or the reviewer.
5. R5-04: no dedicated assertion for `tableLabels` on the AXChartDescriptor / TalkBack text was re-run in 4-1 (chart-data-table 7/7 ran in d5-A007 on identical Kotlin).
6. R5-17: the iOS empty line chart (host descriptor, generic AXChart probe branch) is covered by the 0-open compare in 4-1 (md-line-chart iOS `pass, 22 accepted`); the accepted entries are reviewer-reviewed expectations in `patch-ax-chart.py`; a reviewer should re-confirm them.
7. The org-chart Android states test is not part of the Android runs in 4-1 (only paint); decide whether states are required.
8. Checkpoints for the five charts record runs only up to d5-031: after your runs, `python3 tools/checkpoint-refresh.py confirm <tag> --runs <jobs>`.
9. Orphan CPU hogs ran 11-12 08:45 to 11-14 00:06 Mac time: re-run any timing failure from that window before recording it.

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Agent 4-3 notes (2026-11-14, lane d4 / a6 / AWC-d4; logs in work/d4-lab/out/4-3/)
- Item 1 (Laboratory part examples) was ALREADY on canonical (native-api-examples.js `r5PartExample`, visualParts for the five charts and md-organization-chart on both platforms; 4-1's grep missed it). Job `4-3-charts-and-org-chart-parts-001-studio`: r5-parts/chart/orgchart/table studio tests 42/42; whole Studio suite 878/878; visualParts count line/area/bar 12, pie 6, sparkline 1, org chart 14 on iOS and Android. No appearance-panel "part fields" exist for any component except app-bar/rail; the accordion pattern (typed part examples) is what the charts use.
- Item 2 (`area-colors-hex`) ROOT CAUSE = test harness, not product. Job `...-003-area-hex-rootcause` (own clone work/4-3-pkg, canonical sources, case only): variant A (current test, `window.colorSpace = .sRGB`) `8/8 checks` pass (mean 0.20, worst 1.25); variant B (same test with that one line removed) reproduces the old failure bit for bit: `mean 6.2372723429979136, >6: 74831/220013, worst 20.5 at (350,185) web [240,172,107] native [242,173,128]`, identical to d5-005/008/010. The offscreen capture window was in the display colour space; the d5-016 test fix (sRGB window) removed it. Chart product files unchanged since 10-30. No tolerance was widened. Chrome-oracle fixtures unchanged (10-27).
- Android on canonical bytes, job `4-3-charts-and-org-chart-parts-A001-android` (emulator-5566, tree work/4-3-android-tree): NativeOrgChartStatesTest 1253/1253 (item 7: states DO run on Android and pass), NativeOrgChartPaintTest 1640/1640, NativeChartPaintTest 1046/1046 incl. chart-data-table 7/7 (item 5, R5-04 tableLabels descriptor/TalkBack table), 0 failures.
- Item 3 iPad "first click 1-2 frames off" CLASSIFIED = HARNESS race (test), fixed in the test only. Job `...-005-ipad-oc-states` (canonical bytes, iPad clone, 4 runs): 1251/1259, 1250/1265, 1249/1268, 1250/1262, i.e. 8-19 failing checks per run in 1-3 `click-*` phases of random sets. Job `...-006-trace` (AWC_ORGCHART_STATES_TRACE): on iPad the card's border colour and box-shadow transitions start exactly one frame after Chrome's and after iPhone's after the click release, while the state-layer is in step (iPhone native = Chrome frame by frame; iPhone 1253/1253). Mechanism in the product: `retarget(..., deferred: state.pointerCommit)` with `pointerCommit = now - pointerCommitAt < 8` and `pointerCommitAt` stamped in the card gesture's `onEnded`. The harness `up()` only pumps 4 ms of real time before the virtual frame clock ticks; on iPad UIKit delivers the gesture end later, so the stamp lands in the next virtual frame in a random subset of clicks. Product timing in real use (display clock) is unaffected. Experiment `-007` (longer real-time settle BEFORE the press/release) did not help (1251/1262, 1252/1256, 1251/1259, 1250/1265); fix `-009`: `pump(0.1)` right AFTER `up(q)` on UIKit (comment cites HID-key precedent) gives iPad 1253/1253 in 4 of 4 runs. Installed to canonical by main-queue job `-010-install-oc-click` (patch-oc-click.py, anchored, byte-identical to work/4-3-ios-tree, macOS states re-run 1253/1253 before keeping it, rollback otherwise).
- macOS and iPhone simulator on canonical bytes, job `-008-mac-ios-paint`: macOS NativeChartPaintIntegration 1045/1045, NativeOrgChartPaintIntegration 1644/1644, NativeOrgChartStatesIntegration 1253/1253; iPhone (AWC-d4) NativeChartPaintIntegration 1045/1045, NativeOrgChartPaintIntegration 1644/1644. iPhone org chart states 1253/1253 and iPad 1253/1253 x4 in `-009` (private tree = canonical + the test fix).
- Not done here (open): item 4 R5-01 server route probe on port 4177 (main-queue/reviewer; forbidden for this agent to test on 4177); item 6 R5-17 iOS empty line chart accepted entries in `patch-ax-chart.py` need a gate-7 reviewer's re-confirmation (not an agent decision).
- Install job `4-3-charts-and-org-chart-parts-010-install-oc-click` (main queue, exit 0): pre-image checked, byte-identical to the verified tree file, macOS org-chart states 1253/1253 after install, docs note in md-organization-chart.md, DEFECTS.md status lines under R5-02, R5-04, R5-06, R5-15, `checkpoint-refresh refresh` + `confirm` for md-organization-chart (current, 45/45 pins) and the five chart pre-d5 checkpoints; the five charts' main checkpoints report `current`.
- Summary of ticks: tasks 1, 2 (verified already on canonical by 4-1 and re-run here: charts 1045/1045 macOS + iPhone, 1046 Android; org chart 1644/1644 macOS + iPhone, 1640 Android); task 3 (Studio part examples already installed, tests 42/42, 878/878); task 4 (harness colour space, proven by job -003); task 5 (harness race, fixed + installed); task 6 (install, docs, checkpoints, DEFECTS lines; R5-01 server-route probe on 4177 remains for a main-queue job or the reviewer).
- Open items for the coordinator/reviewer: (a) R5-01 `POST /api/native-live/session?platform=ios` probe on port 4177; (b) R5-17 accepted entries in patch-ax-chart.py need reviewer re-confirmation; (c) the iPad harness fix is test-only: if d5-lab/orgchart/src/Tests/NativeOrgChartStatesIntegration.swift is ever re-synced over canonical it would revert it; (d) private trees/clones left: work/4-3-pkg, 4-3-ios-tree, 4-3-ios-build, 4-3-android-tree (iPad clones were deleted by the jobs' traps).

## Review Triage Log

