---
title: 'md-table: macOS Tab leaves the rows-per-page field (R5-18); rowSpan reaches tested semantics (R5-12)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-11-table-pagination-macos-tab-and-rowspan-semantics'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d5 · android lane a4 (emulator-5562) · simulator AWC-d5 (create it as PARALLEL.md describes if it does not exist)'
lab: 'work/s911-lab (create it; private tree work/s911-tree = a copy of canonical; story 4-2's lab is work/d5-lab/table)'
depends_on: ['7-9-recheck-charts-orgchart-table']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check s7-9 (2026-11-16) left md-table, md-table-pagination and md-table-cell at FAIL because of two findings in DEFECTS.md. R5-18 (blocking): on macOS, Tab never leaves the rows-per-page field of md-table-pagination (a tools/ax focus finding, 3 of 3 runs on canonical). Story 4-2 wrote the host fix (`work/d5-lab/table/scripts/patch-host-tab.py` adds the tag to the field-editor Tab list in `apps/native-ios-playground/LiveRenderer/main.swift`), but its install job 4-2-md-table-open-items-101 skipped the patch: the guard `grep -q md-table-pagination <file> || python3 patch-host-tab.py` is always true, because the tag name already occurs elsewhere in that file. R5-12: `rowSpan` reaches no accessibility semantics that a test checks. The decision log says the value reaches the cell's semantics (macOS AXCell row range, Android CollectionItemInfo rowSpan); story 4-2 added a span test on Android (job 111, install 120), but tools/ax has no assertion for a row range greater than 1 on any platform.

**Approach:** Start with R5-18. Reproduce it on canonical: tools/ax macOS for md-table-pagination shows 1 open focus finding (the reviewer's job `s7-9-007-ax-mac-pagination` shows how to run it). Apply the host patch to the private tree with a guard on the exact new string, run tools/ax macOS for md-table-pagination three times, and once each for md-otp-field and md-autocomplete, which use the same host branch. Then check every other guard of the 4-2 install jobs (101, 120, 141) and of their dry runs for the same always-true shape: for each patch, show with a grep on canonical that its post-image is present, and apply any patch that was skipped. For R5-12, first read what story 4-2 installed for spans (job 120 and the Android span test of job 111). Then make the value reach the semantics where it does not yet: macOS (the row index range of the cell), iOS (the row range of a data-table cell, if the iOS table exposes a data table; if it does not, write that down as a native difference with the reason, and the reviewer decides) and Android (`CollectionItemInfo` rowSpan). Add one tools/ax expectation per platform that fails when a cell with rowSpan 2 reports a range of 1; the Web side is the Chrome accessibility tree of the same fixture.

## Boundaries & Constraints

**Always:** tools/ax macOS for md-table-pagination reports 1 open focus finding on canonical before the change and 0 open three times after it. The rowSpan assertion fails on the tree without the semantics change and passes with it, on each platform that gets one. The rules in project-context.md apply.

**Never:** Do not mark a finding fixed from a run on a lab tree: the evidence for R5-18 is a run on canonical after the install. Do not guard a patch with a text that already occurs in the target file. Do not change what the pagination does on the Web side, and do not touch the select-family sources (stories 6-1 and 6-6 own them).

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- R5-18 and R5-12 (and the status lines of R5-09)
- `work/d5-lab/table/scripts/patch-host-tab.py` and `work/claude-runner/done/4-2-md-table-open-items-101*.sh` (the skipped patch and its guard)
- `work/claude-runner/done/s7-9-007-ax-mac-pagination.sh` and `work/audit/s7-9/lab/ax-pag1/md-table-pagination/report.md` (the reviewer's reproduction)
- `apps/native-ios-playground/LiveRenderer/main.swift`, the table sources under `packages/native-ios/Sources/AWCUI` and the Android table sources (find them with `ls | grep -i table`), `tools/ax/expectations.mjs`

## Tasks & Acceptance

**Execution:**
- [x] Reproduce R5-18 on canonical (tools/ax macOS md-table-pagination, 1 open); private tree with the host patch; three runs with 0 open; md-otp-field and md-autocomplete macOS tools/ax once each
- [x] Check every guard of the 4-2 install jobs for the always-true shape; a table of patch, guard and post-image present on canonical (yes or no); apply what was skipped
- [x] R5-12: read what 4-2 installed; rowSpan into the cell semantics on macOS, iOS (or a written native difference) and Android; a failing-first tools/ax assertion per platform
- [x] Table paint and states once per platform on the private tree (macOS, iPhone 26.3, Android); tools/ax for the md-table family on all platforms with 0 open
- [x] One main-queue install (dry run, rollback, byte identity, guards on the exact new strings); after it tools/ax macOS md-table-pagination on canonical; DEFECTS.md status lines `ready for re-check` for R5-18 and R5-12; refresh and confirm the md-table checkpoint

**Acceptance Criteria:**
- Given canonical after the install, when tools/ax runs for md-table-pagination on macOS three times, then each run has 0 open findings and the Tab order matches the Web order
- Given a cell with rowSpan 2, when tools/ax reads it on macOS and Android (and on iOS, unless a written native difference says why not), then the reported row range is 2, and the same assertion fails on the tree before the change
- Given the 4-2 install jobs, when a reader opens the table of guards, then every patch is shown present on canonical
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE, status review. Canonical install 9-11-100-install-ax-tab-span (exit 0): host Tab patch (guard on the exact new string), rowSpan tools/ax assertion (spans.mjs, `rowspan` case, probes for macOS/iOS/Android), web.mjs role-settle wait; byte-identical to tree work/s911-tree.
- R5-18: canonical before 1 open (9-11-002); canonical after the install 3 runs 0 open (9-11-100). DEFECTS.md R5-18 and R5-12 carry `ready for re-check` lines. Checkpoint md-table refreshed/confirmed (9-11-101).
- R5-12: Web [2] = macOS [2] = iOS [2] = Android [2]; forced range 1 -> 1 finding per platform (mutation lines in 9-11-009; scripts/mutation.mjs).
- New cause (KNOWN-CAUSES.md): tools/ax Web capture race, md-table role table vs treegrid, empty row names; fixed in web.mjs. The Web start-up race itself is not changed (Web side out of scope); reviewer may look.
- iOS paint/states (9-11-008) printed only exit codes, no counts. No further work; next step is the gate-7 re-check by a reviewer.

### Guard table (4-2 install jobs 101, 120, 141; canonical before 9-11 install, job 9-11-001-guards-tree-build)
| patch | guard in the 4-2 job | post-image on canonical |
|---|---|---|
| patch-focus-promote (NativeFocusBridge.swift, `AWCFocusHolder`) | python anchors (pre-image once, idempotent) | yes |
| patch-field-tab (NativeDocumentOrder.swift `moveNext`, FieldTextInput.swift) | python anchors | yes |
| patch-host-tab (LiveRenderer/main.swift) | `grep -q md-table-pagination file \|\| python3 ...` always true | NO (fixed by 9-11) |
| copies 101: NativeTableAccessibility, NativeTableContainer, NativeTableStatesIntegration, NativeTable.kt, NativeTableStatesTest.kt | sha of pre-image + cmp with lab | yes (cmp identical) |
| copies 120: NativeTableParts, NativeTablePaintIntegration, NativeTableStatesIntegration, NativeTablePaintTest.kt | sha + cmp | yes |
| copy 141: NativeTablePaintIntegration | sha + cmp | yes |
EVIDENCE | 9-11-001-guards-tree-build | macOS | guard table 4-2 post-images on canonical (before install, 1 NO = host patch, explained: the defect itself) | 11/12 explained

### Notes
- The canonical host Tab list now reads `["md-otp-field","md-autocomplete","md-multi-select"]` (story 6-6 added md-multi-select), so 4-2's patch-host-tab.py pre-image no longer matches; 9-11 uses s911-lab/scripts/patch-host-tab-911.py (guard = exact new string).
EVIDENCE | 9-11-004-ax-mac-patched | macOS | tools/ax md-table-pagination, tree with host patch, run 1 (3 runs: 0 open each) | 2/2
EVIDENCE | 9-11-004-ax-mac-patched | macOS | tools/ax md-otp-field + md-autocomplete, tree with host patch | 12/12

### Evidence (session 2)
EVIDENCE | 9-11-002-ax-mac-pagination | macOS | tools/ax md-table-pagination, tree WITHOUT host patch: 1 open focus x3 (reproduction, expected failure) | 3/3 explained
EVIDENCE | 9-11-100-install-ax-tab-span | macOS | tools/ax md-table-pagination on canonical after install, 3 runs, 0 open each | 3/3
EVIDENCE | 9-11-100-install-ax-tab-span | macOS | tools/ax md-table family on canonical (md-table, cell, row, pagination), 0 open | 4/4
EVIDENCE | 9-11-009-ax-mac-family-stable | macOS | tools/ax md-table x2 + family, Web row names present in all captures (0 empty of 4 rows, 12 of 12 captures) | 12/12
EVIDENCE | 9-11-009-ax-mac-family-stable | macOS | rowSpan assertion mutation check (native range forced to 1 gives 1 finding) | 3/3
EVIDENCE | 9-11-010-ax-ios-family | iOS | tools/ax md-table family incl. rowspan case (iOS range [2] = Web [2]), 0 open | 4/4
EVIDENCE | 9-11-A008-ax-android-family | Android | tools/ax md-table family incl. rowspan case (rowSpan [2] = Web [2]), 0 open | 4/4
EVIDENCE | 9-11-005-mac-table-suites | macOS | NativeTablePaintIntegration | 7403/7403
EVIDENCE | 9-11-005-mac-table-suites | macOS | NativeTableStatesIntegration | 3859/3859
EVIDENCE | 9-11-008-ios-table-suites | iOS | NativeTablePaintIntegration, NativeTableStatesIntegration (iPhone 26.3 AWC-d5; log prints exit codes 0 and 0, no counts) | 2/2
EVIDENCE | 9-11-A007-android-table-paint-states | Android | tableMatchesChromePaintAndGeometry (151 cases) | 1/1
EVIDENCE | 9-11-A007-android-table-paint-states | Android | tableMatchesChromeInteraction (20 runs) | 1/1
EVIDENCE | 9-11-101-checkpoint-refresh | macOS | md-table checkpoints current after install, confirmed | 2/2
Task notes: the Web empty-row-name flake was found as a capture race (role table before the treegrid pass of syncRows), not as an effect of the rowSpan read; the proof is 12 of 12 captures with names after the wait, against 5 of 8 without it in the earlier tree runs.

## Review Triage Log

