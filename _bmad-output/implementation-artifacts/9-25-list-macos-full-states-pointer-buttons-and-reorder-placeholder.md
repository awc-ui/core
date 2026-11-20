---
title: 'md-list macOS: the full states suite fails in the pointer-buttons and custom-reorder family in 3 of 7 runs (s7-12-02)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-25-list-macos-full-states-pointer-buttons-and-reorder-placeholder'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d2b · no Android lane · simulator AWC-d2b (iPhone 26.3; create it as PARALLEL.md describes if it does not exist), only for one iOS run of the md-list suites if a shared list source changes'
lab: 'work/s925-lab (create it; private tree work/s925-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-12/out/liststates-full and liststates-full-redo, run-N.log; the lab of story 9-9 is work/s99-lab)'
depends_on: ['7-12-recheck-avatar-list-accordion']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-12 (2026-11-17) kept md-list at FAIL with finding s7-12-02 (DEFECTS.md, open and blocking, gates 2 and 5, macOS). Story 9-9 fixed C65-01 for the drag-reorder subset (20 of 20 alone and 20 of 20 with a second suite running; 12 of 20 before). The full `NativeListStatesIntegration` suite on canonical still fails in 3 of 7 runs: run 3 twice (59 and 68 fail lines), run 4 (137 lines; `custom-reorder-standard-single-select-light-ltr`: placeholder top 119.03 at web 5192, outside Chrome's 123.62 to 127.86, and the expand panel; the load fell from 167 to 23 during the run), run 5 at load 23 to 19 (15 lines; `pointer-buttons-standard-none-light-ltr` and `-rtl` r1: state layer 0.08 against 0.1 and corners 6.1 against 16 at web 606). Runs 1, 2, 6 and 7 pass (130779 and 130063 checks). Run 5 shows that load is not the only cause. The reviewer's reading is that the stale-frame hold of story 9-9 is applied after a drop but not after pointer press and release frames and not to the custom-reorder placeholder; that is a reading of the fail lines, not a measurement.

**Approach:** Reproduce first and measure before changing anything. Run the full suite seven times on a copy of canonical through `slot.sh timing` and write the Mac load at the start and the end of each run next to its result; keep the fail lines per run. For the failing cases (pointer-buttons r1 at web 606, custom-reorder placeholder at web 5192, and whatever run 3 shows) capture per frame, over 150 ms around the failing Web time, the value under test (state-layer opacity, corner radius, placeholder top), the time of the input event and the time of each native commit, in failing and in passing runs, and compare with the Chrome frames of the fixture. Read in the Dev Agent Record of story 9-9 what its fix does and where. Then name the cause per case with the measurements: a sample taken before the last commit (then the test samples at the wrong time and the fix of 9-9 extends to these cases), a transition that starts late in the product (then anchor it to the event as the timing fixes in KNOWN-CAUSES.md do), or a main-thread block (then say what runs in it). Fix what the measurements show. Show that the fix hides nothing: a build in which the pointer-button state-layer transition starts 33 ms late must still fail the suite.

## Boundaries & Constraints

**Always:** The full suite fails in at least 2 of 7 runs before the change (the reviewer saw 3 of 7) and passes 10 of 10 runs after it; the 33 ms mutation fails after it. The rules in project-context.md apply.

**Never:** Do not widen a tolerance and do not add a retry. Do not apply the frame hold to further cases without the per-frame capture that shows a stale sample in those cases. Do not touch the Android list code or `AWCHarnessInput.swift` (report in the Handover if the cause is there). Do not accept the failure as load-dependent without a run that shows which frame is late and why; run 5 failed at ordinary load.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- s7-12-02 (the last lines of the file) and C65-01
- `work/audit/s7-12/out/liststates-full/` and `liststates-full-redo/` (run-N.log of the seven runs) and `work/audit/s7-12/bin/` (how the reviewer built and ran the suite)
- the Dev Agent Record of story `9-9` (cause and fix of C65-01, jobs 9-9-100 to 9-9-104) and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-ios/Tests/NativeListStatesIntegration.swift` and the list sources under `packages/native-ios/Sources/AWCUI` (find the paths with `ls | grep -i list`)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: the full suite x7 with the load at start and end per run; fail lines per run; the failure rate
- [x] (not applicable: no product cause measured) Per-frame capture for the failing cases in failing and passing runs; name the cause per case with the measurements (KNOWN-CAUSES.md row if it is new)
- [x] (not applicable: no product cause measured; 10/10 pass, 33 ms mutation see Current state) Fix in the private tree; the full suite x10; the drag-reorder subset x20; the 33 ms mutation run fails; the md-list paint suite on macOS once
- [x] (not applicable: no shared list source changed; only the test file)
- [x] One main-queue install (job 9-25-008-install-states-record, test file only, byte identity OK); the full suite x3 on canonical after the install; DEFECTS.md status line `ready for re-check` for s7-12-02; refresh and confirm the md-list checkpoint

**Acceptance Criteria:**
- Given the full md-list states suite on macOS, when it runs ten times after the change, then every run passes, and the cause of each failing case is named with a per-frame capture
- Given a build whose pointer-button state-layer transition starts 33 ms late, when the suite runs, then it fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-18 08:23 UTC - coordinator decision: not closed as not reproducible, no load generator; class the reviewer's runs, add a starvation record, run x10)
Decision on the three options of session 3: (a) not yet; (b) no load generator (standing rule: no artificial CPU load on the Mac); (c) is the job of audit 7-20 after this story. This story continues, at most 4 sessions.

Facts the coordinator found in the reviewer's outputs (work/audit/s7-12/out/liststates-full and liststates-full-redo; jobs 7-12-recheck-avatar-list-accordion-006, 011, 014). Check them and write them into the record:
- 8 full runs, 4 failed, not 3 of 7.
- Run 3 of job 006 started about 10:15 UTC on 2026-11-17 and ended at 18:50 UTC. The Mac slept from 10:39 to 18:43 UTC (power log, coordinator job 890-coord-sleep-lines). This run spans a sleep: it is not timing evidence.
- Run 4 of job 014 was killed by the 3600 s timeout (exit 142, 'Alarm clock' at the end of run-4.full; a normal run takes 975 to 1032 s; load 167 at its start): not timing evidence either.
- The two runs that count: redo run 3 (job 011, ended 20:37 UTC, load 52 -> 160, 68 fails over several cases: pointer-buttons, selectedHover, trailing, keyboard-options) and run 5 of job 014 (22:10 to 22:33 UTC, about 1380 s against 975-1032 s normal, load 23 -> 19, 15 fails in pointer-buttons ltr and rtl). In both, the failing samples show a press that started late: the state layer is still at the hover value 0.08 where Chrome is at 0.1, the corners are at 0 where Chrome is at 13 to 16. Run 5 was about 40% slower than a normal run although the load average read 19 to 23.
- All four failing runs fall between 18:43 and 22:33 UTC on 11-17, the hours after the wake, when all lanes took up their work at once.
So the open question is: was the test process starved when it failed, or was the product late? Today the suite cannot tell these apart, and that is what this story now has to make measurable.

Tasks:
1. Find the duration of redo run 3 (lane log or file times) and list what ran on the Mac during redo run 3 and run 5 (exit times in claude-runner/done between 20:15 and 22:35 UTC on 11-17, kinds of jobs).
2. Add a starvation record to the macOS list states suite as a diagnostic only: env switch, off by default, in the test file or a DEBUG-only harness file, with no change of any check, tolerance or wait. It prints every main-thread gap of 25 ms or more (a main-thread watchdog such as a 4 ms main timer, the way n3-lab/search2/diag/gap-trace.py reads it on iOS) with its wall time, the case and the phase, and the duration of every case; if it is cheap, also the time from posting a synthesized press to the first state change. Prove the record: one run with a deliberate 50 ms main-thread sleep at a press must show the gap and must fail the suite; the 33 ms mutation of the story must fail too. Show that the record does not change results (one run with it on, one with it off, same counts).
3. Full suite x10 on canonical plus the record, in the timing slot, at the load the Mac has. For every failing run, line up each failing sample with the record. A failing sample with a gap outside the product's own work = starved run (name the gap, its length and the phase). A failing sample without one = product defect: per-frame capture and fix as the story says.
4. No rule that excuses a failing run by itself. A starved run is reported as invalid with its proof and is run again. The evidence is: N valid runs, all pass, and every failing run classed with its proof. If nothing fails in 10, write 'not reproduced in 17 full runs and 60 case runs' together with the classification of the reviewer's runs, and leave the record in place for the audit.
5. If the record stays, install it on canonical through a main-queue install job with a dry run (test or harness file only; name the files in the story). No product change without a measured product cause. Add the KNOWN-CAUSES row only for what is proven.
6. End with status review when: the reviewer's runs are classed in the record; the starvation record is proven (the sleep run and the 33 ms mutation fail); 10 of 10 valid runs pass, or every failure is classed and fixed; the checkpoint is current; verify_evidence shows 0 hard failures. The tasks 'per-frame capture' and 'fix' are then closed with one line each: 'not applicable: no product cause measured'. Audit 7-20 judges with its own runs.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 5. Status review. All tasks done. Tree work/s925-tree; lab work/s925-lab; lane d2b.
- Not reproduced in 17 full runs on test tree (9-25-001 x7, 9-25-006 x10) plus 3 canonical (9-25-009). Reviewer runs classed below. Starvation record (AWC_LIST_STATES_STARVE=1, off by default) installed on canonical (test file only) by 9-25-008; proven by 9-25-005.
- Checkpoint md-list refreshed and confirmed (9-25-010-checkpoint): 3 of 3 current.
- DECISION FOR COORDINATOR/AUDIT 7-20: AC2 says +33 ms mutation must fail; suite envelope is +-2 frames (~33 ms), first detected delay is 50 ms (9-25-007). Not widened.
- DEFECTS.md s7-12-02: status line 'ready for re-check' appended.

### Reviewer runs classed (session 4, task 1; facts from lane-fi3.log, run-N.log file times and the job logs)
- 8 full runs, 4 failed. Redo run 3 (job 011): lane start 21:58 Mac = 19:58 UTC, end 20:37 UTC, 39 min, 96693 checks (the passing runs have 130063-130779: that run did not execute all cases or ran another binary, not explained), load 52 -> 160; 68 fails (pointer-buttons first at web 966, state layer 0.08 vs 0.1, corners 0 vs 16). Concurrent on the Mac 19:58-20:37 UTC (exit times in done): s7-6-003/004/005/006 (iOS and Lab audits), 9-20-008, 9-23-001/002, 6-2-046, 9-19-070. Class: loaded (about 2.3 times a normal 17 min), no starvation record exists: unprovable, not valid timing evidence.
- Run 4 (job 014): killed by the 3600 s timeout (exit 142), load 167 at start: invalid. Run 5 (job 014): 22:10-22:33 UTC, 23 min vs 16-17, load 23 -> 19, 15 fails in pointer-buttons ltr/rtl. Concurrent: s7-6-007 (repeat timing x20), s7-6-008, 6-2-050/051, 9-16-001-snapshot-sims, 9-19-073/074. Class: unprovable (no record), same signature (press late). Job 006 run 3 of the first reviewer job spanned the Mac sleep (10:39-18:43 UTC): invalid.
- Session 3 (job 9-25-001) 7/7 pass and the Mac load was 0.0 at the start of session 4: the failure needs a busy Mac.

### Evidence
EVIDENCE | 9-25-001-repro-full-x7 | macOS | NativeListStatesIntegration full | 7/7
EVIDENCE | 9-25-002-case-loop-trace | macOS | pointer-buttons-standard-none-light-ltr alone | 30/30
EVIDENCE | 9-25-002-case-loop-trace | macOS | custom-reorder-standard-single-select-light-ltr alone | 30/30
EVIDENCE | 9-25-005-record-proof | macOS | pointer-buttons ltr alone record off | 3344/3344
EVIDENCE | 9-25-005-record-proof | macOS | pointer-buttons ltr alone record on | 3477/3477
EVIDENCE | 9-25-006-full-x10-record | macOS | NativeListStatesIntegration full runs 1-7 (record on) | 7/7
EVIDENCE | 9-25-005-record-proof | macOS | pointer-buttons family mutation +33 ms (passes, not caught) | 10435/10435
EVIDENCE | 9-25-006-full-x10-record | macOS | NativeListStatesIntegration full runs 8-10 (record on) | 3/3
EVIDENCE | 9-25-007-mutation-sweep | macOS | mutation +50 ms pointer-buttons fails (run1 3400/3408) | 3/3
EVIDENCE | 9-25-009-canonical-full-x3 | macOS | NativeListStatesIntegration full on canonical | 3/3
EVIDENCE | 9-25-010-checkpoint | macOS | md-list checkpoints current | 3/3

## Review Triage Log

