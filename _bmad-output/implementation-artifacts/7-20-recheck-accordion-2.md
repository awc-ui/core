---
title: 'Gate-7 re-check: accordion (s7-12 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-20-recheck-accordion-2'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18'
lab: 'work/audit (your folder: work/audit/s7-20)'
depends_on: ['9-24-accordion-android-registration-before-first-toggle-and-wrapped-items']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-accordion (+item) (s7-12-01).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folders: work/audit/s7-12 and work/audit/s7-8. Re-check s7-12-01 on a new snapshot: every Android test class whose name starts with NativeAccordion once (unit and instrumented), the Initialization and Dispatch classes three times, NativeAccordionFloatingTest 35 of 35, the accordion paint and states suites on Android once. No Swift change is expected: show that the Swift accordion sources of the snapshot equal those of the s7-12 snapshot, and run the Swift accordion timing suite once on macOS. The verdicts of md-avatar and md-list and the other gate results of s7-12 stand.

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

### Coordinator note (2026-11-17 23:16 UTC: scope extended to md-list (s7-12-02, story 9-25))
Scope extended on 2026-11-17 after the verdicts of 7-12 (md-avatar PASS, md-list FAIL on s7-12-02, md-accordion FAIL on s7-12-01). This re-check covers both findings:
- md-accordion (+item), s7-12-01, fix story `9-24-accordion-android-registration-before-first-toggle-and-wrapped-items` (as written in this file).
- md-list (+item), s7-12-02, fix story `9-25-list-macos-full-states-pointer-buttons-and-reorder-placeholder`: on a new snapshot run the full `NativeListStatesIntegration` suite on macOS five times through `slot.sh timing` (5 of 5 must pass; write the load at the start and the end of each run), the drag-reorder subset 20 times, and the 33 ms mutation of 9-25 once (it must fail); if 9-25 changed a shared list source, the md-list states and paint suites once on iOS 26.3 and once on Android.
- The verdict of md-avatar (PASS, s7-12) stands.
The coordinator launches this story when both fix stories are in review.

### Coordinator note (2026-11-18 05:39 UTC: 9-24 is in review; one extra check (accordion inside a modal scope))
Story 9-24 is in review (2026-11-18, evidence check 0 hard failures). Cause it names: the movableContentOf change of story 9-4 attaches the item nodes after the connection SideEffect; fix: the panel is composed inline when there is no modal session (installed, byte-identical). Its runs: the two classes 5 of 5 with 0 of 80 differing traces (job 9-24-003-fix-x5); the 15 NativeAccordion classes 32/32 and unit tests 38/38 (9-24-004-family); on canonical the two classes, NativeStackingOverlayTest, NativeStackingTest and NativeAccordionFloatingTest pass (9-24-006-stacking-canon); checkpoints confirmed (9-24-101-confirm).
One point to check yourself, named by the dev story as a residual risk: an accordion inside a modal scope (AWCModalScope: dialog, sheet) still composes through movableContentOf. Run the initialisation and the wrapped-item scenario for an accordion inside a modal scope on Android (a defaultExpanded accordion in a dialog; read the first mdItemToggle event and its items snapshot and compare with Chrome for the same fixture, or with the trace of the non-modal case if no modal fixture exists). If the first event there shows unregistered items (index -1), that is a new blocking finding for md-accordion.
Also from 9-24: md-dialog Android ax shows 0 open on a fresh capture (job 9-24-005-dialog-ax); the 7 open in the s7-12 compare run were a stale capture. Nothing to do for md-dialog.

### Coordinator note (2026-11-18 08:23 UTC - coordinator: md-list s7-12-02, what 9-25 found and how to judge)
md-list, finding s7-12-02: what story 9-25 found so far and how to judge.
- 9-25 could not reproduce the failure on canonical (7 full runs at loads 287 down to 7, plus 60 runs of the two cases alone: all pass) and found no product cause. The list sources and the states test are byte-identical between the earlier reviewer's tree and canonical.
- The coordinator classed the earlier reviewer's runs (work/audit/s7-12/out/liststates-full and liststates-full-redo): 8 full runs, 4 failed. Run 3 of job 006 spans the Mac's sleep (started about 10:15 UTC on 11-17, ended 18:50 UTC; sleep 10:39 to 18:43 UTC). Run 4 of job 014 was killed by the 3600 s timeout (exit 142). Two runs count: redo run 3 of job 011 (load 52 -> 160, 68 fails) and run 5 of job 014 (about 1380 s against about 1000 s normal, 15 fails). In both, the failing samples show a press that started late.
- 9-25 adds a starvation record (main-thread gaps, case durations) to the list states suite. Read its Current state for the switch name and its results before you plan your runs.
- Judge md-list with your own runs: full NativeListStatesIntegration x10 on macOS with the record on, in the timing slot. A run that spans a sleep or hits the timeout is invalid: say so and run it again. PASS for s7-12-02 needs 10 valid runs that pass. If a run fails, it counts as starved only with a proof from the record at the failing samples; a failing sample without such a proof keeps the FAIL (file it with the per-frame values). Run the 33 ms mutation once: it must fail.
- Write the classification of the earlier runs into the audit page, so that the history is exact: the earlier FAIL stood on two runs that count.

### Coordinator note (2026-11-18 13:13 UTC coordinator: ruling on the list suite detection limit (33 ms not caught))
Coordinator ruling on the list suite's detection limit. Story 9-25 measured that a state layer late by 33 ms passes the pointer-buttons family and 50 ms fails (job 9-25-007). So 'the 33 ms mutation must fail' from the earlier note cannot be met by this suite as it is, and the tolerance is not changed inside this audit. Judge md-list s7-12-02 like this:
1. Write the measured limit in the audit page as a number from your own sweep (+17, +33, +50 ms): the first delay that fails.
2. Say where the limit comes from. Name the constants of the envelope rule in the list states test and in one suite where 33 ms is caught (button or checkbox states). If the list suite uses the same rule and the 33 ms shift stays inside the value tolerance because of the shape of the state-layer curve, show it with the numbers of one sample (web value, native value, shifted value, tolerance). If the list suite has a wider rule than the shared one, that is a finding: md-list stays FAIL and the finding gets a DEFECTS line for a fix story.
3. Because the envelope cannot see 33 ms, measure the timing directly. From the raw samples of your 10 valid full runs, for the state-layer checks of the pointer-buttons family, give the offset in ms between the native curve and the web curve (median and worst over the runs; the method in one sentence, for example the time at which each curve crosses half of its end value). The timing part passes only if the worst offset in valid runs is at most one frame (17 ms). If the sample spacing does not give that resolution, say which resolution it gives and report the number with it. An offset above one frame in a valid run is a miss whatever the envelope says.
4. The rest stays as in the earlier notes: 10 valid passing runs with the starvation record on; invalid runs named with proof and rerun; the exact history in the audit page.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 3. ACCORDION: FAIL (s7-20-01, modal scope, Android). LIST: FAIL (s7-20-02: extra -50/+56 tier in list states suite); product itself 10/10 valid full runs pass (005), timing offset worst 11.4 ms (007), mutation limit +50 (004). Docs written: work/audit/s7-20/docs/{md-accordion,md-list}.md; DEFECTS.md has s7-20-01, s7-20-02.
- DONE: install job 7-20-recheck-accordion-2-100-install-audit exit 0 (2 docs, 2 AUDIT cells). Nothing left; fix stories needed for s7-20-01 and s7-20-02.
- EVIDENCE | 7-20-recheck-accordion-2-005-list-full-x10 | macos | NativeListStatesIntegration full | 10/10 ; EVIDENCE | 7-20-recheck-accordion-2-007-list-trace-x10 | macos | list pointer-buttons trace | 20/20 ; EVIDENCE | 7-20-recheck-accordion-2-004 | macos | list +33 mutation passes 3/3, +50 fails 3/3

## Review Triage Log

