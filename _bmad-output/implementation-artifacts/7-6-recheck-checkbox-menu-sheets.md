---
title: 'Gate-7 re-check: checkbox, menu, bottom-sheet, side-sheet'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-6-recheck-checkbox-menu-sheets'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5'
lab: 'work/audit (your folder: work/audit/s7-6)'
depends_on: ['3-1-containment-batch-install-and-stacking', '6-1-select-family-finish']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-checkbox (R4-26), md-menu family (R4-16, R4-23, R4-27), md-bottom-sheet and md-side-sheet (R4-03, R4-25).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r4.

## Boundaries & Constraints

**Always:** Be skeptical: a claim is evidence only after you matched it to a log or re-ran it. New findings go to DEFECTS.md with evidence and a suggested fix. The rules in project-context.md apply.

**Never:** Never edit product code or tests. Never accept a `::part` exception where a typed target is implementable.

</intent-contract>

## Code Map

- `work/audit/AUDIT-PROTOCOL.md` -- your procedure
- `work/audit/DEFECTS.md` -- findings and their status lines
- `work/audit/r1`..`r6` -- earlier reviewers' scripts and probes you can reuse
- `docs/native-parity/audit/` -- verdict docs

## Tasks & Acceptance

**Execution:**
- [ ] Fresh snapshot of canonical; contract matrix per component
- [ ] Re-run: Swift paint and states (macOS), Android tests, iOS harness on iPhone 26.3 (states x3) plus one more runtime, Laboratory probes through 4177, examples compile, tools/ax
- [ ] Decide each proposed exception; record new findings in DEFECTS.md
- [ ] Write `docs/native-parity/audit/<tag>.md` and update the AUDIT.md cells through one main-queue install

**Acceptance Criteria:**
- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 04:58 UTC: start now; 6-1 is blocked only for select and multi-select on iOS)
- You can start although story 6-1 is `blocked`: it is blocked only for md-select and md-multi-select on iOS (DEFECTS S61-IOS-01, story 9-19; those two components belong to audit 7-2). The menu part of 6-1 is finished: install job `6-1-select-family-finish-050-install-hop`; canonical job `6-1-select-family-finish-051-canonical-states-x3`: menu states 2524/2524 on macOS three times and on iPhone 26.3 once.
- Canonical has the iOS shim v5 since 11-17 02:55 UTC (story 9-10). Run your iOS checks on canonical as it is now and say so in the record. Older iOS numbers of the dev stories were taken with the old shim; a difference between their numbers and yours is a finding to explain, not to average.
- As in the other re-checks: include one states run on iOS 18.6 for each component you re-check, and for a finding that a dev story calls intermittent, at least 20 runs of that case.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: `s7-6-001-snapshot`, `s7-6-A001-android`. Running when the Mac went to sleep: `s7-6-002-swift`, `s7-6-A002-ax-android`. Still queued at the wake (they run now): `s7-6-003-ios26`, `s7-6-004-ios18`, `s7-6-005-lab-web`, `s7-6-006-ax-mac-ios`, `s7-6-A003-examples-kotlin`.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

## Dev Agent Record

### Current state
Session 4 (2026-11-17 23:50 UTC). All evidence collected (jobs 001-009, A001-A004; see EVIDENCE lines below). Verdicts: md-checkbox FAIL (S7-6-01 iPhone 26.3 glyph opacity 1 check x3 runs), md-menu family FAIL (S7-6-02 intermittent 1-check motion/flat-pixel fails, 3 of 6 runs; S7-6-03 non-blocking), md-bottom-sheet PASS, md-side-sheet PASS. Findings appended to work/audit/DEFECTS.md by install job.
In flight: nothing. Install job s7-6-100-install-audit-checkbox-menu-sheets finished (exit 0, 6 files installed).
Next: none; audit complete. Re-check after the fixes for S7-6-01 / S7-6-02 (20 runs per runtime).
EVIDENCE | s7-6-003-ios26 | ios26 | NativeCheckboxStatesIntegration x3 | 17851/17852,17971/17972,17977/17978
EVIDENCE | s7-6-004-ios18 | ios18 | NativeCheckboxStatesIntegration | 17480/17480
EVIDENCE | s7-6-009 | macos | NativeMenuStatesIntegration x2 | 2523/2524, 2524/2524
EVIDENCE | s7-6-009 | macos | live-selection x20 | 20/20 runs 38/38
EVIDENCE | s7-6-A001-android | android | tests | 28/28

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

