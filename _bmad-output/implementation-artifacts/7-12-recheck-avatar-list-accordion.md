---
title: 'Gate-7 re-check: avatar, list, accordion (s7-8 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-12-recheck-avatar-list-accordion'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18'
lab: 'work/audit (your folder: work/audit/s7-12)'
depends_on: ['9-1-avatar-ios-forced-colors-outline', '9-2-list-android-expand-timing-under-load', '9-3-accordion-macos-controls-relation', '9-4-accordion-floating-panel-overlay-layer', '9-9-list-macos-drag-reorder-fade-tail']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-avatar (s7-8-01), md-list (+item) (s7-8-02, and C65-01: the macOS drag-reorder fade tail frame, story 9-9), md-accordion (+item) (s7-8-03, s7-8-04).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-8 (re-check scripts in work/audit/s7-8/bin). Re-check the four findings and re-run every suite the fixes touched; the other s7-8 verdicts stand.

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

### Coordinator note (2026-11-17 05:58 UTC: start; C65-01 re-check with 20 + 20 subset runs; iOS on shim v5)
- All five stories you depend on are in `review` (9-9 since 11-17 05:5x UTC). Start.
- C65-01 (story 9-9, md-list macOS drag-reorder): the before-fix rate was 12 failures in 20 runs of the drag-reorder subset (job 9-9-002) and 12 in 20 with a second suite running (job 9-9-003; that job has exit 143 from the runner event of KNOWN-CAUSES row 34, its summary lines are valid). Re-check on canonical with your own runs: the subset 20 times alone and 20 times with a second suite running, then the full states suite three times on macOS, one states run on iPhone 26.3 and one on iOS 18.6. The fix changed shared files (NativeList.swift, NativeListItemView.swift): confirm the Android claim `not affected` by listing the changed files yourself.
- Canonical has the iOS shim v5 since 11-17 02:55 UTC (story 9-10). Run your iOS checks on canonical as it is now and say so in the record. A difference between a dev story's older iOS number and yours is a finding to explain.
- For every finding a dev story calls intermittent: at least 20 runs of that case before a verdict.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: all up to `7-12-recheck-avatar-list-accordion-005-swift-timing`. Running when the Mac went to sleep: `7-12-recheck-avatar-list-accordion-006-liststates-full-x3`. Still queued at the wake (they run now): `-007-ios26`, `-008-ios18`, `-009-ax-lab`, `-010-playground-live-examples`.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- DONE (2026-11-17 ~23:35 UTC). Verdicts installed in AUDIT.md + docs/native-parity/audit by main-queue job 7-12-recheck-avatar-list-accordion-101-install-audit (exit 0; -100 aborted on a pre-check before writing).
- md-avatar PASS (s7-8-01 closed: forced appearance iOS 232/232, avatar 2950 iOS 26.3 + 18.6). md-list FAIL s7-12-02 (C65-01 residual: full states suite fails 3 of 7 macOS runs; subset 20/20+20/20 passes; s7-8-02 Android closed). md-accordion FAIL s7-12-01 (Android: 2 tests regressed after 9-4; s7-8-03/04 closed).
- ax compare 0 open for avatar/list/accordion on all platforms (job A010-ax-android-list; the earlier 10 open for md-list Android came from a stale 08:53 capture).
- EVIDENCE | 7-12-recheck-avatar-list-accordion-014-liststates-full-x4 | macOS | NativeListStates full runs 4-7 | 2 pass 2 fail
- EVIDENCE | 7-12-recheck-avatar-list-accordion-A010-ax-android-list | android | tools/ax compare md-list,md-accordion,md-avatar | 0 open
- Nothing left; coordinator routes s7-12-01/02 to fix stories and requests a re-check.

## Review Triage Log

