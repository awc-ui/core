---
title: 'md-switch: the states suite passes when the state layer starts 33 ms late (checkbox and radio fail the same mutation)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-39-switch-states-suite-passes-a-33ms-delay'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane r2 · no Android lane · simulators AWC-r2 (iPhone 26.3) and AWC-r2-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist'
lab: 'work/s939-lab (create it; private tree work/s939-tree = a copy of canonical; the mutation job of story 9-31 is claude-runner/done/9-31-016*.sh with its patch scripts in work/s931-lab; the crossing-offset check that story 9-31 added to the list suite is in work/s931-tree, Tests/NativeListStatesIntegration.swift)'
depends_on: ['9-31-list-states-suite-extra-timing-tier']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-31 ran one mutation on the three suites that share the timing window of -34/+40 ms: with the state-layer start delayed by 33 ms the checkbox states suite fails (13 failed checks), the radio states suite fails (31), and the switch states suite passes with 0 failed checks (job 9-31-016, macOS). So `NativeSwitchStatesIntegration` cannot show a two-frame delay of its state layer, and its PASS says less than the PASS of checkbox and radio. md-switch has a gate-7 PASS in the ledger that rests on this suite. The same kind of gap was finding s7-20-02 for md-list (a 33 ms delay passed there because of an extra tier); the list suite now has a crossing-offset check with a 17 ms late limit that fails +17, +33 and +50 ms in 3 of 3 runs each.

**Approach:** Find out why the switch suite does not see the delay: which checks cover the state layer of the switch (hover, press, focus, the thumb and track motion), at which times they sample, and why a 33 ms later start stays inside the envelope (few samples on the rising part, a short fade, a check that compares only end values). Then close the gap in the test of the private tree without touching a limit of the shared window: add the crossing-offset check of the list suite for the switch state layer and the thumb motion (half-crossing native against Chrome, early limit -34 ms, late limit 17 ms, crossings in Chrome frame gaps over 34 ms counted and printed, not compared), or more samples on the rising part if that is what is missing. Show what the suite catches after the change: delays of 17, 33 and 50 ms, three runs each, and the unmutated suite ten times on macOS, three times on iPhone 26.3 and twice on iOS 18.6 behind a load gate. If the unmutated suite then misses on the product, class each miss (do not fix product code here: report).

## Boundaries & Constraints

**Always:** After the change the switch states suite fails a 33 ms delay of the state layer in 3 of 3 runs on macOS and passes unmutated 10 of 10 on macOS; the iOS result is given with its misses classed. The rules in project-context.md apply.

**Never:** Do not widen or narrow the shared window of -34/+40 ms. Do not add a retry or a known-gap list. Do not change the product code of the switch; a product miss that the stricter check shows is reported with its numbers. Do not touch the checkbox and radio suites. Regression before the install; nothing goes to canonical unless the story's install task. Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-31` (jobs 015 and 016, the crossing-offset check) and `work/s931-lab`, `work/s931-tree`
- `packages/native-ios/Tests/NativeSwitchStatesIntegration.swift`, the checkbox and radio states tests for comparison, `packages/native-ios/Sources/AWCUI/NativeSwitch.swift`
- `work/audit/DEFECTS.md` (the switch finding filed by story 9-31; s7-20-02 for the pattern)

## Tasks & Acceptance

**Execution:**
- [x] Why the 33 ms delay passes today: the checks that cover the switch state layer and thumb, their sample times, the envelope at those times
- [x] The stricter check in the private tree; mutation runs of 17, 33 and 50 ms, three each, on macOS
- [x] The unmutated suite: macOS x10, iPhone 26.3 x3, iOS 18.6 x2 behind a load gate; every miss classed
- [x] One main-queue install of the test file (dry run, backup, byte identity); the suite once on canonical macOS; DEFECTS.md status line `ready for re-check`; KNOWN-CAUSES.md row; refresh and confirm the md-switch checkpoint

**Acceptance Criteria:**
- Given a build whose switch state layer starts 33 ms late, when the suite runs three times on macOS, then every run fails
- Given the unmutated product, when the suite runs ten times on macOS, then every run passes, or the misses are reported as product findings with their numbers
- Given the record, when a reader asks why the old suite passed a 33 ms delay, then it names the checks and sample times
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-19 23:56 UTC: start; install named)
Start. The inputs from story 9-31 exist (job 9-31-016 and its patch scripts in work/s931-lab; the crossing-offset check in work/s931-tree, Tests/NativeListStatesIntegration.swift). Story 9-31 is still at work in its own tree: read from it, write nothing there.

Install name, for the story's install task: 'switch states: crossing-offset check for the state layer and the thumb (test file only)'. It may go to canonical when all of this is in the record with job names:
1. the reason why the 33 ms delay passes today (task 1), in numbers;
2. with the new check, the delays of 17, 33 and 50 ms each fail 3 of 3 on macOS, and the unmutated suite passes 10 of 10 on macOS (a failing check is class 'load' only when the load in its minute was above 30; such a run is repeated and both are written down);
3. iPhone 26.3 x3 and iOS 18.6 x2 with every miss classed. For iOS misses of the new check the user's rule (e) 'One frame, rare' in PARALLEL.md applies only with its four numbers (one-frame shift passes; at most 1 of 5 over at least 10 runs on that runtime; the +33 ms mutation fails 3 of 3 on an iOS simulator on the same tree; the lines in the audit doc and DEFECTS.md). Two runs are not ten: either run ten on that runtime or leave the line open for audit 7-23 and say so.
4. If the unmutated suite misses on macOS in the same check more than once, that is a product finding about md-switch, not noise: do not install, write the numbers into the open items and end blocked. I rule then (the switch has a PASS in the ledger that rests on this suite).

Reminders: every build step through tools/slot.sh build 2 before the timing slot; timing runs through tools/slot.sh timing 4 (the machine-wide cap is 3 now); boot once per job inside the timing slot, bootstatus -b and 60 s before the first timed run; simulators shut down on exit; no artificial CPU load.

### Coordinator note (Coordinator decision 2026-11-20 03:06 UTC: job 010 did not run the delay on iOS; no limit change; split the one late step by the delivered input; install with the check judged on macOS and printed on iOS)
Ruling on your three options, after reading job 010 myself.

1. Job 010 did not test a 33 ms delay on iOS. Its three runs fail only 'state layer half-crossing up at web 2183' with native offsets of 19.6 to 25.1 ms: the same step and the same offsets as the unmutated runs. With the delay active that step would sit near 53 ms and most of the 74 measured crossings would move by 33 ms, as on macOS (28 crossing fails per run). The job patches the source, builds, calls unmutate, and only then runs ios1 three times: find out whether ios1 builds or links the app again from the restored tree, or whether the mutated line (now: now + 33) is on the iOS path at all. Show a line from the app that proves the delayed code ran (a one-time print in the mutated branch is enough), then +33 ms x3 on iPhone 26.3 again. 'The limit cannot tell the mutation from the baseline' is withdrawn until that run exists. A mutation run that passes is a finding about the test, or about the job, until it is explained.

2. Not option (b): no limit changes. Not option (c) yet: a product finding needs the split of point 3.

3. The iOS baseline: one step only (web 2183, the rising half-crossing of the state layer; cases pointer-light-ltr-on-none, on-icons, off-none and cancel), 19.6 to 25.1 ms against 17, in 9 of 10 runs on both runtimes, while the other 70 or so crossings pass. That is an offset to find. Say first which input that step is (what the harness sends at web 2166 to 2183 and how it differs from the steps that pass). The first suspect is the proven class 'the test's own delivery delay of 0 to 22 ms' (story 9-38, part (a)). In the private tree print for that step: the time stamp of the event, the time the view got it, the native half-crossing; 10 launches on iPhone 26.3 of one case that holds the step. Two readings: (i) measured from the delivered input the offset is at most 17 ms in at least 9 of 10: the miss is the harness delivery delay; write the class and the numbers. (ii) Otherwise the native state layer starts late at that step on iOS: write it as a product finding for md-switch on iOS in DEFECTS.md with the numbers per launch; do not fix it here.
Points 1 and 3 fit into one iPhone job (one boot). Build steps through tools/slot.sh build 2.

4. Install, without waiting for point 3: the check as tested, under the name already given ('switch states: crossing-offset check for the state layer and the thumb (test file only)'). It judges on macOS. On iOS it measures the same crossings and prints one line per case with the offsets ('crossing offsets, iOS, not judged yet: ...') and does not fail, until point 3 is decided: today canonical has no such check on iOS at all, so nothing gets weaker, and the numbers are in every log. Conditions: the macOS evidence you have (+17, +33, +50 ms each 3 of 3; unmutated 10 of 10); with the file to install, switch states x2 on iPhone 26.3 and x1 on iOS 18.6: no failing check that canonical does not have, the printed lines present. ONE main-queue job (dry run, rollback, byte identity). After it: one canonical macOS run, DEFECTS.md (the gap is closed on macOS; on iOS it is open with the numbers of point 3 and of the new +33 run), KNOWN-CAUSES row, md-switch checkpoint refresh, verify_evidence.

5. What comes after point 3 is mine: under reading (i) the comparison at the delivered input for this check on iOS is a change of the test method and I ask the user; under reading (ii) I write the fix story. Either way this story ends in review after points 1, 3 and 4, with the table: step, runtime, k of n, offset from the time stamp, offset from the delivered input, the +33 ms result.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- (session 3) All tasks done. Install: job 9-39-013 (byte-identical, sha256 de62dc2e...). Canonical macOS: 9-39-015 (32159/32160, one load-class miss: drag-off handle size at web 631, load1max 64.9, not the new check; exec bug of 014 fixed) and repeat 9-39-016 32844/32844, 74 crossings, offsets -7.3..12.0 ms.
- DEFECTS.md S931-04 status line written (closed on macOS `ready for re-check`; iOS open with numbers); KNOWN-CAUSES.md row appended; md-switch checkpoint refreshed (9-39-017) and confirmed (9-39-018): current 3 of 3.
- iOS point 3: neither reading (i) nor (ii); left open for audit 7-23 and the coordinator (see Result table). Status review.
- Next: nothing for the dev agent; coordinator decides on iOS comparison at the delivered input.

### Why the 33 ms delay passed before (task 1)
The old suite compares every native frame with Chrome over a window [t-34, t+40] ms (monotone envelope across Chrome gaps > 34 ms) and nothing else. The state layer of md-switch fades in about 50-100 ms with ~17 ms frames, so a start 33 ms late moves each native sample by at most 33 ms along the ramp, which is inside the 74 ms window: every frame of the delayed ramp still finds a Chrome value of the envelope (hover, press, focus, thumb motion all sampled per frame at the same times; no check compared a crossing time). The end values are equal. Job 9-31-016: 32469/32469 with the delay, 0 failed checks. The new check locates the half-crossing (state layer opacity 0.04; thumb middle of travel) in both series and limits native minus Chrome to [-34, +17] ms: 74 crossings measured per run, 28 crossing fails per run with +33 ms on macOS and on iPhone 26.3.

### Result table (point 5)
| step | runtime | k of n | offset from stamp | offset from delivered input | +33 ms result |
|---|---|---|---|---|---|
| state layer up, web 2183 (tabFocus), full suite | iPhone 26.3 / iOS 18.6 | 9 of 10 miss (jobs 006, 009) | 19.6-25.1 ms | not measured in the full suite | +33 ms: 28 crossing fails x3 (job 012, MUTATION-ACTIVE proven) |
| same step, case pointer-light-ltr-on-none alone | iPhone 26.3 | 1 of 10 miss (d5 20.7 ms, native gap 34 ms) | 3.1-4.5 ms (9), 20.7 (1) | stamp to view 1.2-1.7 ms, so same | - |
| all 74 crossings | macOS | 0 of 10 miss (jobs 003, 008, 011) | within limits | - | +17/+33/+50 ms: 3 of 3 fail each |

### Evidence
EVIDENCE | 9-39-003-build-all-unmut-m33x3 | macOS | NativeSwitchStatesIntegration unmutated run 1 | 32472/32472
EVIDENCE | 9-39-003-build-all-unmut-m33x3 | macOS | NativeSwitchStatesIntegration +33 ms run 1 (must fail) | 32708/32736 explained: mutation caught, intended failure
EVIDENCE | 9-39-003-build-all-unmut-m33x3 | macOS | NativeSwitchStatesIntegration +33 ms run 2 (must fail) | 32312/32340 explained: mutation caught, intended failure
EVIDENCE | 9-39-003-build-all-unmut-m33x3 | macOS | NativeSwitchStatesIntegration +33 ms run 3 (must fail) | 32822/32850 explained: mutation caught, intended failure
EVIDENCE | 9-39-006-ios-unmut | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 1 | 16894/16896 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-006-ios-unmut | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 2 | 17034/17034
EVIDENCE | 9-39-006-ios-unmut | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 3 | 16936/16938 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-006-ios-unmut | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 1 | 16821/16824 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-006-ios-unmut | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 2 | 16712/16716 explained: crossing-offset miss, see Current state

EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +17 ms run 1 (must fail) | 32761/32784 explained: mutation caught, intended failure
EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +17 ms run 2 (must fail) | 33004/33024 explained: mutation caught, intended failure
EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +17 ms run 3 (must fail) | 32805/32826 explained: mutation caught, intended failure
EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +50 ms run 1 (must fail) | 32036/32610 explained: mutation caught, intended failure
EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +50 ms run 2 (must fail) | 31914/32478 explained: mutation caught, intended failure
EVIDENCE | 9-39-007-mut17-50-x3 | macOS | NativeSwitchStatesIntegration +50 ms run 3 (must fail) | 32211/32790 explained: mutation caught, intended failure
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 2 | 32898/32898
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 3 | 32418/32418
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 4 | 32430/32430
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 5 | 32388/32388
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 6 | 32184/32184
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 7 | 31836/31836
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 8 | 32574/32574
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 9 | 32418/32418
EVIDENCE | 9-39-008-unmut-x9 | macOS | NativeSwitchStatesIntegration unmutated run 10 | 32232/32232
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 4 | 16935/16938 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 5 | 16863/16866 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 6 | 16733/16739 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 7 | 16954/16956 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 8 | 16917/16920 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 9 | 16942/16944 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 26.3 | NativeSwitchStatesIntegration unmutated run 10 | 16912/16914 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 3 | 16693/16698 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 4 | 16745/16746 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 5 | 16804/16806 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 6 | 16818/16818
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 7 | 16869/16872 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 8 | 16779/16782 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 9 | 16744/16746 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-009-ios-unmut-more | iOS 18.6 | NativeSwitchStatesIntegration unmutated run 10 | 16681/16686 explained: crossing-offset miss, see Current state
EVIDENCE | 9-39-011-final-file-check | macOS | NativeSwitchStatesIntegration final file run 1 | 32172/32172
EVIDENCE | 9-39-011-final-file-check | iOS 26.3 | NativeSwitchStatesIntegration final file run 1 | 16834/16834
EVIDENCE | 9-39-011-final-file-check | iOS 26.3 | NativeSwitchStatesIntegration final file run 2 | 16936/16936
EVIDENCE | 9-39-011-final-file-check | iOS 18.6 | NativeSwitchStatesIntegration final file run 1 | 16798/16798
EVIDENCE | 9-39-012-ios-mut33-proof-and-focus-diag | iOS 26.3 | NativeSwitchStatesIntegration +33 ms run 1 (must fail) | 16889/16920 explained: mutation caught, intended failure
EVIDENCE | 9-39-012-ios-mut33-proof-and-focus-diag | iOS 26.3 | NativeSwitchStatesIntegration +33 ms run 2 (must fail) | 16900/16932 explained: mutation caught, intended failure
EVIDENCE | 9-39-012-ios-mut33-proof-and-focus-diag | iOS 26.3 | NativeSwitchStatesIntegration +33 ms run 3 (must fail) | 16944/16974 explained: mutation caught, intended failure
EVIDENCE | 9-39-015-canonical-macos-run | macOS | NativeSwitchStatesIntegration canonical run 1 | 32159/32160 explained: load-class miss (drag-off handle size, load1max 64.9), repeated in 016
EVIDENCE | 9-39-016-canonical-macos-repeat | macOS | NativeSwitchStatesIntegration canonical run 2 | 32844/32844

## Review Triage Log

