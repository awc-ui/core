---
title: 'iOS states checks: a miss after an input depends on where the display grid falls against the oracle clock; make the comparison independent of that phase without changing a limit (private prototype, no install)'
type: 'bugfix'
created: '2026-11-15'
status: review
story_key: '9-38-ios-states-checks-phase-of-the-display-grid'
epic: 9
model: 'opus'
wave: 6
lanes: 'mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and AWC-d3-18 (iOS 18.6); both exist (story 9-37 made them)'
lab: 'work/s938-lab (create it; private tree work/s938-tree = a copy of canonical with a private copy of the shim and the tests; the lab of story 9-37 is work/s937-lab: probe.swift, patch-probe.py, common.sh with the load gate, the A/B scripts, mut.py for the 33 ms mutations, and the traces of jobs 003 and 010)'
depends_on: ['9-37-ios-states-harness-sampling-pump-main-thread-cost']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-37 closed the question of the sampling pump: it spins (22,000 to 30,000 ticks per second, 82 to 95 percent of the main thread) but a sampler without the forced flush does not reduce the misses (runs with a miss in ten pairs: time picker 5 against 5, select 2 against 7, table 1 against 0, text field 10 against 10); nothing was installed. Its time-resolved trace of one input turn (job 010, time-picker tap-hour-7, the hand check at t=1100, failing run 877 of 878 against passing run 878 of 878) shows the same main-thread profile in both runs within 0.5 ms: the phase fires 1 to 3 ms after its planned time, the touch-down is delivered 8 to 11 ms after the plan (inside a pump tick whose run-loop call lasts 14 to 16 ms), UIKit handles it in 3 ms, the product writes its value 10 ms after the delivery, the touch-up follows and a 26 ms run-loop call hands the focus over. What differs is the phase: in the failing run the display grid (vsync 1073.2, 1089.9, 1106.5) sits 1.8 ms earlier against the oracle clock, so the frame that the t=1100 check reads and the next one (hand 118.6 and 62.0 against the Web's 120.9) straddle the Web value differently. So the miss is decided by where the 16.7 ms display grid falls against the oracle clock, on top of a native start that is later than Chrome's by the harness's own delivery delay plus UIKit and product work. Open misses of this shape: text-field tab-out and press-focus (motion lines in 10 of 10 runs; final failures in 2 to 7 of 10 runs; no first-frame threshold separates failing from passing attempts, story 9-20), time-picker taps, drags and the period switch (S62-01, 02, 04, 05), select keyboard open (opacity at t=83: web 0.934, native 0.899), the table sort click (1 of 10 to 20 runs), colour-picker thumb press, search on iOS. Rejected so far, each with a measurement: a harness helper around UIKit's focus turn, an optimised build, a motion clock started at the delivered input, an earlier blur signal, the lite sampler.

**Approach:** Read, measure, prototype; nothing is installed. (1) Read how each kind of check lines up native frames with the Web trace: the per-sample value checks (which native frame is read for a Web sample at time t, with which time stamp), the envelope checks (window -34 to +40 ms), the crossing checks; and how each suite times its inputs: against the planned time or against the delivered time (some suites already move their clock to the delivery: keyArrivals, tabkeyat, releaseclock and tap-shift of story 6-2, the HID anchor of story 9-6). Write the table per suite. (2) Measure on the four subsets of 9-37 (text-field tab-out, table sort click, select keyboard open, time-picker taps), ten runs each behind the load gate: for every check that misses in some run, the delay from the planned input to its delivery, the time stamp of the native frame that was read, the display-grid phase against the oracle clock, and the value; show that pass or fail follows the phase (or show that it does not). (3) Prototype in the private copy, limits unchanged, no sample dropped: (a) where a suite still times an input against the plan, time the samples after it against the delivered input, as the Web trace is timed against its dispatched input; (b) compare a native frame at its own presentation time with the Web curve at that same time (interpolated between the two Web samples around it), not with the Web sample that happens to be nearest on the grid. (4) A/B, ten alternating pairs per subset behind the load gate: runs with a miss per arm. (5) Sensitivity with the prototype: product delays of 17 and 33 ms (mut.py of 9-37) must fail in every run of three for each subset; if 17 ms passes somewhere, say for which check and why. (6) The same A/B once on iOS 18.6 for the text-field and select subsets. End blocked with the words coordinator decision and the table; an install into the canonical tests or shim is a separate decision and the user is told first.

## Boundaries & Constraints

**Always:** The record has the table of how each suite lines up frames and inputs, the proof that pass or fail follows the display-grid phase (or the proof that it does not), the A/B table with the prototype (ten pairs per subset) and the 17 and 33 ms mutation results; nothing is installed and canonical is byte-identical. The rules in project-context.md apply.

**Never:** Do not install anything; do not edit canonical `AppKitShim.swift`, canonical tests or `scripts/build-awcui.sh`. Do not change a limit or a window, add a retry, drop or skip samples around an input, or mark misses as known gaps. A comparison that no longer fails a product delay of 33 ms is rejected. Do not pass a time from the test into the product. Short trial job (build plus one case) before every long job; a job stops at the first failed build; keep the per-run console files (give every run its own file name). Before queueing a job check that no file with the same name sits in the lane queue. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-37` (Sessions 1 to 3: what one tick does, job 010 trace, the A/B and mutation tables) and `work/s937-lab`
- the Dev Agent Records of stories `9-20` (job 013 table: no first-frame threshold), `9-23` (E report), `6-2` (keyArrivals, tabkeyat, releaseclock, tap-shift) and `9-6` (HID anchor)
- `packages/native-ios`: `AppKitShim.swift` (canonical md5 starts with 30db5861), the states tests of text field, table, select and time picker under `packages/native-ios/Tests`, the shared check helpers, `Sources/AWCUI/NativeInspection.swift`
- `work/claude-runner/KNOWN-CAUSES.md` (the 9-37 row and the timing rows)

## Tasks & Acceptance

**Execution:**
- [x] The table per suite: which native frame a check reads and with which time stamp; whether inputs are timed against the plan or the delivery
- [x] Phase proof on the four subsets: for each check that misses in some run, delivery delay, frame time stamp, grid phase and value over ten runs; does pass or fail follow the phase
- [x] The prototype in the private copy: samples timed against the delivered input where they are not yet; native frames compared at their own presentation time against the interpolated Web curve; limits unchanged
- [x] A/B ten alternating pairs per subset on iPhone 26.3 behind the load gate; the text-field and select subsets once more on iOS 18.6
- [x] Mutations with the prototype: 17 and 33 ms product delay, three runs each per subset
- [x] KNOWN-CAUSES.md row; the table for the coordinator; status blocked with the words coordinator decision
- [x] (coordinator note 06:54) Part (a) alone (AWC_CMP=deliv): A/B ten pairs text field and select on iPhone 26.3, attempt and final level, tab-out phase table, 17/33 ms mutations three runs each
- [x] (coordinator note 06:54) Diagnostics AWC_DG=1: five alternating pairs per subset with zero difference in checks and FAIL lines, class per FAIL line by the fixed rule, class counts, install file lists; status blocked (coordinator decision)

**Acceptance Criteria:**
- Given the record, when a reader asks why one run of a subset misses and the next passes, then it shows the numbers that decide it for at least one check per subset
- Given the prototype, when ten alternating pairs run per subset, then the table gives the runs with a miss per arm with load1max per run
- Given the prototype, when the product is delayed by 33 ms, then every run of three fails in each subset; the result for 17 ms is given per subset
- Given the end of the story, when the coordinator reads it, then nothing is installed and canonical is byte-identical to before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator decision 2026-11-19 06:54 UTC: prototype rejected; continue with part (a) alone and with diagnostics that class each FAIL line; no install)
Decision on your table. Accepted as the record: the display-grid phase does not decide pass or fail on the four subsets (the one exception: text-field tab-out without a stall, boundary between 13.5 and 14.5 ms); main-thread stalls and dropped frames do (text-field focus turn 80-100 ms in every failing attempt against 45-55 ms in every passing one; select menu open 65-95 ms; two dropped time-picker frames at load 79). The prototype comparison is rejected and not installed (it fails 10 of 10 unmutated runs for time picker, select and text field, and passes a 33 ms delay in the table suite). Option (c) is noted, not ordered: the shared window does not catch 17 ms in any suite by design.
Two things are still worth having from your private tree, because they do not change what is compared. Set status in-progress; nothing is installed in this run either.
1. Part (a) alone: samples timed against the delivered input for select keyboard and text-field tab-out (the Web trace is timed against its dispatched input; the harness delivers a key 3-5 ms and a touch 8-11 ms after the plan). Give it its own switch. A/B ten alternating pairs for the text-field subset and the select subset on iPhone 26.3 behind the load gate, attempt level and final level; for tab-out without a stall, the phase table again (does the boundary at 13.5/14.5 ms disappear). Mutations of 17 and 33 ms, three runs each: every result given; a 33 ms delay must fail.
2. Diagnostics only, no change of pass or fail: every FAIL line of the states checks carries the numbers that class it: the largest display-link gap in the 150 ms after the last input, the delay from the planned to the delivered input, the phase, and the length of UIKit's become or resign bracket inside that gap (the BRK hooks of work/s923-lab). Show with five alternating pairs per subset that the checks passed and the FAIL lines are the same with and without the diagnostics (same counts, same checks), and print for each FAIL line of those runs its class by a fixed rule that you write down (for example: gap of 60 ms or more with a UIKit bracket inside = focus turn of UIKit; gap of 60 ms or more without a bracket = stall not from UIKit, product or load; no gap and phase at the window edge = grid phase; else = not classed). Count the classes.
End blocked with the words coordinator decision: the A/B and mutation table of part (a), the zero-difference table of the diagnostics, the class counts, and the exact list of canonical files an install of each would touch. The coordinator asks the user before anything of this goes into the canonical shim or tests.

### Coordinator note (Coordinator decision 2026-11-19 09:30 UTC: investigation accepted; nothing installed; both installs wait for the user's answer)
The investigation is complete and accepted (jobs 013-020 exit 0, 56 evidence lines, 0 hard failures; canonical unchanged, shim md5 30db5861). Nothing is installed. Readings:
- Part (a), comparison at the delivered input: accepted as a correction of the zero point, not as a wider tolerance. The Web reference counts from the event that reaches the page; the native check counted from the planned input time, so the delivery delay of the test's own input (select 0-7.2 ms, text-field tab-out 3.8-21.8 ms) was held against the component. Requirement met: a 33 ms delay fails 3 of 3 in both subsets. Gain with a mechanism: text-field tab-out without a stall 0 misses in 23 attempts against 5 in 26, the phase boundary at 13.5/14.5 ms is gone. Gain for select is small in number (runs with a miss 0 of 10 against 2 of 10). Cost, stated as it is: a 17 ms delay in select is no longer caught (0 of 3; base catches it), because base counted the test's own delay on top of the product's.
- Diagnostics on FAIL lines: accepted as 'the same checks fail with and without it, counts within the spread of the unchanged base'; not claimed as identical output. Classes over 15 lines: UIKit focus turn 5 (text-field press-focus), stall not from UIKit 0, grid phase 0, not classed 10 (text-field tab-out 6, time-picker tap-hour-7 3, table click-dessert 1).
- The grid-phase idea is closed: with the delivered input as zero no line falls in the phase class.
Both installs touch canonical tests and the shared shim, so the user is asked first (question 4 in RUNS.md). The story stays blocked with the words 'waits for the user's answer'. If the answer is yes, one short session does it: sync NativeTextFieldStatesIntegration.swift with what job 9-20-019 installed; build-only job; regression on iPhone 26.3 and iOS 18.6 (text field, select, time picker, table: three gated runs each, 33 ms mutation once each); then one main-queue install per part, named here in advance: 'iOS states comparison at the delivered input (text field and select; test files only)' and 'iOS states diagnostics on FAIL lines (shim and four test files)'. Without that answer nothing of s938-tree goes anywhere, and no other story uses AWC_CMP or AWC_DG outside a private tree.

### Coordinator note (Coordinator note 2026-11-19 18:59 UTC: the user said yes; install both; the class 'UIKit focus turn' is decided)
User decision (2026-11-19, asked in the conversation): YES to both changes. Install them.

One short session, in this order:
1. Sync NativeTextFieldStatesIntegration.swift with 9-20-019, as planned.
2. A build-only job. The job stops at the first failed build.
3. The regression (macOS, iPhone 26.3, iOS 18.6, iPad) with the load rule of PARALLEL.md applied. No install while a regression difference has no class.
4. The two installs, under the names fixed before: 'iOS states comparison at the delivered input (text field and select; test files only)' and 'iOS states diagnostics on FAIL lines (shim and four test files)'. The second one changes the canonical shim (AppKitShim.swift, md5 30db5861 before): the user has agreed to it. Pre-image check, dry run, byte identity after.
5. After the install write one paragraph into claude-runner/PARALLEL.md (section 'Load discipline', dated, signed 9-38): the canonical files that changed, the new md5 of the shim, and that every lab made before it rebases on canonical before its own install (its pre-image check will fail otherwise). Other stories work on iOS at this moment (9-36 select, 9-32 time picker, 9-33 color picker, 9-27 menu, 9-31 list): do not touch their labs.
6. State the cost in the story and in KNOWN-CAUSES.md as measured: a 17 ms delay in select is no longer caught, a 33 ms delay is caught 3 of 3.

The second user decision of today is about the class 'UIKit focus turn':
User decision (2026-11-19, asked in the conversation): a FAIL line of the class 'UIKit focus turn' is counted and reported, with the measurement that shows it comes from iOS, and is written into the audit as a native difference. It does not make the component FAIL.

How the class is decided (the rule is in claude-runner/PARALLEL.md, 'User decisions on classes'): per line, from the numbers on that line. The diagnostics must show that the main thread was inside UIKit's focus change (becomeFirstResponder, the keyboard task queue) for a bracket that covers the missed frame, and give the component's own share of that turn in ms. A line without that proof is not of the class and stays a finding. No list of check names is exempt, no limit is widened, nothing is retried. The audit gives: how many lines of the class in how many runs, the bracket in ms, and the lines that are NOT of the class as open findings.

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-19 21:16 UTC: repeat the loaded subsets, iPad before the install, then install)
For the sessions after jobs 023, 024 and 025.
1. Job 022 ran while the Mac was at load 275 to 969 (the coordinator's trial with more jobs at once; over since 20:21 UTC). The table miss (206 of 207 in one run) and the time-picker misses (877, 873, 857 of 878) are not evidence in either direction. Repeat these two subsets three times each on iPhone 26.3 now that the load is down, base and arm alternating if the arm changes anything in those suites; class every failing check by the load of its minute from claude-runner/load/load-20261119.log (the file name has no dashes in the date).
2. iPad: create the simulator for your lane as PARALLEL.md describes (AWC-d3-ipad) and run the text-field and select subsets three times on it before the install. 'Not run' is not acceptable for a change of what the text-field test measures: the iPad Tab focus finding (C910-01) lives in that suite.
3. Then the two installs under their fixed names, in one main-queue job each (dry run, backup, byte identity), the PARALLEL.md paragraph (files changed, new shim md5, 'labs made before this rebase'), the KNOWN-CAUSES cost row (17 ms in select no longer caught; 33 ms caught 3 of 3), evidence lines, verify_evidence by hand.
4. The class 'one frame, rare' (PARALLEL.md item (e)) may be used for a regression line only with its four proofs; a line at load above 30 is repeated, not classed.
Stories 9-20, 7-14, 9-36, 9-35 and audit 7-2 wait for your install: do it as soon as items 1 to 3 are met, and say in your summary the UTC time of the install.

## Dev Agent Record

### Current state
- Session 10 (2026-11-20 05:05 UTC): BOTH INSTALLS DONE at 05:01 UTC (jobs 032 test files, 033 shim + four tests; byte identity OK). New shim md5 9055674f405eb3d2ff7369fffbca7199. PARALLEL.md paragraph and KNOWN-CAUSES row written.
- Regression before install: iPhone 26.3 tp/tb (026, 029), iOS 18.6 (023), iPad tf/sel (027) plus iPad base arm (028: same tab-out attempt lines, finals 194,193,194 vs arm 193 x3 = press-focus UIKit focus turn bracket 88-118 ms); macOS compile 4/4 (025, 029); 33 ms mutation (024).
- Time-picker test was changed in canonical at 04:11 UTC by another story; patch rebased (s938-lab/s6/clean, patch-split.py skips files without mode edits); 029 compile 4/4, tp 877,876/878 (tap-hour-7 t=1100 known miss, load 30-200, DG brk 19 ms = not classed, existing finding, not caused by this change).
- Next: run python3 $HOME/mnt/p/work/bmad-coord/verify_evidence.py 9-38-ios-states-checks-phase-of-the-display-grid; set status review if 0 hard failures.

### Session 1 (2026-11-19) notes

**Task 1: how each suite lines up native frames with the Web trace (read from canonical, shim md5 30db5861).**

| suite | native value and its time stamp | check (limits unchanged) | input timing |
|---|---|---|---|
| time picker states (`checkPhase` / `motion()`) | product record `runtime.motion[key]` (TimePickerModel.record): value computed in the TimelineView(.animation) body for `CACurrentMediaTime()`, stamped with that same time = the frame's render (body evaluation) time, about 1-2 ms after the vsync; not its presentation time | Web sample at st: the Web value must lie in [min, max] of all native records within +-20 ms of `at` plus the last record before at-20, +- tol (hand 0.8 deg, dialog/mode opacity 0.03, scale 0.006, y 0.35; colours 0.012) | phase fired at the plan (`t0 + p.start`); samples timed from the DELIVERED input: `at = t0 + st + shift(st)`, shift = delivery delay of the phase's inputs (queue time paired with `AWCShimTouch.deliveredAt`; tap phases use the first input of the phase; mode toggle: release clock of 6-2) |
| select states (`compare`) | pump read every 4 ms (`sample()`: inspection preference values of the last SwiftUI update; caret, menu progress = opacity, scaleY), t = read time - `actual` (when the phase was fired) | Web sample t (relative to the phase's planned start): Web value within [min, max] of the native reads in [t-40, t+34] plus the read before and after, +- 0.03; pixels: best frame at phase end | keys posted at the phase fire; samples timed against the FIRE (planned start + fire lateness), not the delivery (keyArrivals not used) |
| table states (`compareMotion` / `motion()`) | product motion recorder `state.motion.samples` (t = CACurrentMediaTime at record), read as a step function `probe(key, at)` | Web tau (from the Web's actEnd) against the native step values at t0+tau+{-33,-17,0,17,33}, range +- tol (order 0.2, sort 0.12/0.1, selection 0.15); 90 % of the Web frames must pass | t0 = harness time after the action; moved to the native first change - 17 ms when that is later than t0+17 (gap); fallbacks: the key's own first frame (<= 200 ms), mid-curve alignment; so effectively timed from the native start, not the plan |
| text field states (`runOne` envelope) | pump read after each `RunLoop.run(until: +4 ms)` (inspection values), t = read time - phaseStart (the planned phase start, t0 + p.t) | Web sample t: within [min, max] of the native reads in [t-40, t+34] plus the reads across a gap > 34 ms; tol font 0.05, y 0.3, indicator 0.05, notch 0.6 | tab-out / blur: key at the planned start, no realignment (PLAN); press-started phases (press-focus, focus, click): native label crossing of Chrome's first moving value, shift only when native is later (delivery-like) |

Already timed from the delivered input: time picker (deliveryShift, releaseclock, tap shift of 6-2), table (first-change alignment), text-field press phases (crossing). Still timed from the plan / fire: select keyboard phases, text-field tab-out / blur. In every suite a native value is stamped with its render or read time, not its presentation time, and is compared with the Web sample nearest in the grid via a window, not with the Web curve at the native frame's time.

**Diagnostics (`s938-lab/patch-pd.py`, private tree only):** shim `AWCShimFrameClock` keeps the display-link timestamps (`stamps`); `AWCPD.vs` prints the vsync stamps around a check and the grid phase (last vsync relative to the oracle origin of the check, mod 16.67 ms); `AWCPD.dl` prints delivered touches (t) and HID key arrivals (k). A `PD` line is printed for every failing comparison and for the checks named in `AWC_PD` (pattern list), so passing runs give the same numbers.

**Prototype (`s938-lab/patch-proto.py`, private tree only, run-time switch `AWC_CMP=proto`, so both arms use one build):** (a) select phases and text-field key phases: native samples are timed from the delivered key (first HID key arrival / touch delivery after the fire; `d` printed); time picker and table already time from the delivery / first change. (b) every suite: the native value as a step curve (a frame holds until the next) is checked at each native frame time and at each Web sample time against the Web curve interpolated linearly over the mirrored canonical window ([x-20, x+20] time picker; [x-34, x+40] select and text field, the mirror of the native window [t-40, t+34]; [x-33, x+33] table); tolerances unchanged; no sample dropped (every Web sample time stays a check point). Table keeps its 90 % rule (ok points scaled to the Web frame count).

**Trial findings (one run per subset, iPhone 26.3):**
- 001 diagnostics (base comparison): tp 878/878, sel 91/91, tb 207/207, tf final 194/194 with motion FAIL lines in press-focus (6/84) and tab-out (3/84). PD numbers: tf press-focus failing attempt: native label frozen at 16.00 from -43 ms to 147.6 ms (no display-link callback between 9.9 and 106.1: a 96 ms main-thread stall in UIKit's focus turn), passing attempt of the same run: stall 9.9 to 41.2 (31 ms), first native change 65.8. tf tab-out: Tab arrived 11.0 ms after the plan; native frames at 54.9 (12.24) and then 96.5 (14.50): no frame in between (stall again). sel arrowdown-open: phase fired 26.9 ms after the plan, key arrived at +32.0, no native read between 0 and 99.3 ms after the fire (main thread blocked ~99 ms while the menu opens); t=83 passes when a native read with 0.930 lands by t+34 (111.5 here). tp tap-hour-7 t=1100: native hand frames 1091.5 (62.7), 1116.0 (119.7), 1121.4 (120.2) against Web 120.92 at the shifted time 1114.8: passes by 0.06 deg; native records are not on a 16.7 ms grid (5-11 ms apart near inputs, gaps of 37 ms), so how many native frames fall inside the +-20 ms window varies run to run.
- 002 prototype: tp 132/134 (tap-hour-7 and tap-minute-5 hand: a native frame at 66.5 deg while the Web curve within +-20 ms is at 121: native start more than 20 ms behind on the steep part), tb 207/207, tf 192/194 (press-focus: native frozen at 16.00 for x = 50..133 ms, the stall; now also in the reduced runs; tab-out font 12.279 held from 54.9 to 96.5), sel not run (compile: expression too complex, fixed by `selfix.py`).
- Early reading: the prototype removes the frame-count/phase dependence of the window, and where the native screen really holds a frame (UIKit stall, late native start) it fails more, not less. Whether pass/fail in the base arm follows the grid phase or the stall length is what the base-arm PD data of jobs 003-006 must show.

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-001-pd-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap (diagnostics) | 878/878
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-001-pd-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr (diagnostics) | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-001-pd-trial | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr (diagnostics) | 207/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-001-pd-trial | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr (diagnostics; explained: motion FAIL lines press-focus 6/84 and tab-out 3/84 in attempts, the open miss under study) | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-002-proto-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap prototype (explained: tap-hour-7 / tap-minute-5 hand, native start > 20 ms behind) | 132/134
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-002-proto-trial | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr prototype | 207/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-002-proto-trial | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr prototype (explained: press-focus held frame during the UIKit stall) | 192/194

### Session 2 (2026-11-19) notes

**Task 2: does pass or fail follow the display-grid phase? (base arm of jobs 003-006, ten runs each, iPhone 26.3; extracted by `s938-lab/s2/phase.py`; ph = last vsync before the check relative to the oracle origin, mod 16.7 ms)**

| subset / check | runs with a miss (base) | phases of failing runs | phases of passing runs | what decides it |
|---|---|---|---|---|
| text field press-focus (attempt level) | 10/10 (first attempt; final checks 194/194 in 9 runs, 193/194 in run 1) | 1.0, 1.1, 2.5, 3.1, 5.1, 9.3, 9.5, 13.5, 13.5, 16.1 | 0.0-16 (retries and reduced runs) | main-thread stall: largest display-link gap after the press 80.4-100.4 ms in every failing attempt (392 ms in run 1), 44.7-54.9 ms in every passing one. Phase spread over the whole grid: not phase |
| text field tab-out (attempt level) | 9 attempts in 10 runs | stalled attempts (second key 50-68 ms late): any phase; unstalled: 14.5, 14.7, 15.9 | unstalled: 1.0-13.5 (about 20 attempts) | after a stall: the stall; without a stall: phase >= 14.5 ms fails 3/3, <= 13.5 passes: the one phase-decided check (the grid puts the frame that should show 14.x just outside the window) |
| time picker dial-tap/open dialog t=266 | 1/10 (run 1, load1max 79) | 14.5 | 3.3-15.8 (15.8 passes twice) | two dropped frames: native frames 248.9, 270.8, 296.1 (22 and 25 ms apart) leave one frame inside at=275.8 +-20; passing runs have 4-5 frames 15-17 ms apart. Not phase |
| time picker tap-hour-7 hand t=1100 | 0/10 | - | 9.2-15.8 | native frame after the delivered touch-up lands 1.6-4.9 ms after `at` in every run (121.0-122.1 deg vs web 120.92): passes in all |
| select arrowdown-open opacity t=83 | 0/10 | - | 3.4-16.1 | first native read 97-115 ms after the fire (key delivered +3-5 ms, then the main thread is blocked ~65-95 ms while the menu opens); margin +0.026 in 8 runs, +0.057 in 2, independent of phase |
| table click-dessert order (90 % rule) | 0/10 (43/44 frames every run) | - | 0.6-16.6 | same single frame out in every run; not phase |

Answer for the coordinator: on these four subsets pass or fail is decided by main-thread stalls and dropped frames (text-field focus turn 80-100 ms, menu open ~65-95 ms, two dropped frames in the time picker), not by where the 16.7 ms grid falls. The one check that follows the phase is text-field tab-out without a stall (boundary between 13.5 and 14.5 ms).

**Task 4 (iPhone 26.3): A/B, ten alternating pairs per subset (`s938-lab/ab.sh`; arms base = canonical comparison, proto = AWC_CMP=proto; one build; load gate < 20 before every pair)**

| subset | job | runs with a miss base | runs with a miss proto | FAIL lines base / proto | load1max per run (base / proto) |
|---|---|---|---|---|---|
| select keyboard (proto before fix2) | 003-ab-sel | 0/10 (91/91 x10) | 10/10 (86-88/91) | 0 / 45 | base 35.5, 40.2, 37.0, 19.6, 16.3, 57.8, 72.1, 18.0, 16.2, 112.8; proto 35.5, 53.0, 25.7, 27.7, 14.6, 47.9, 53.7, 19.0, 13.1, 12.3 |
| time picker dial-tap | 004-ab-tp | 1/10 (877/878 in run 1) | 10/10 (130-131/134) | 1 / 39 | base 79.1, 15.5, 12.5, 15.5, 12.4, 10.0, 10.0, 33.7, 46.6, 16.8; proto 112.5, 17.4, 10.9, 17.0, 12.4, 10.6, 65.2, 52.2, 34.2, 19.9 |
| table sort | 005-ab-tb | 0/10 (207/207) | 0/10 (207/207) | 0 / 0 | base 41.1, 14.2, 13.1, 11.6, 11.3, 9.2, 33.3, 59.1, 16.3, 12.2; proto 41.2, 19.7, 11.4, 16.3, 9.7, 9.4, 32.7, 80.6, 12.6, 12.2 |
| text field focus-type-blur | 006-ab-tf | 10/10 (attempt-level motion lines; final 194/194 in 9, 193/194 in run 1) | 10/10 (final 192/194 every run) | 22 / 46 | base 48.1, 17.6, 16.2, 17.5, 16.2, 10.3, 10.5, 8.2, 7.9, 8.4; proto 48.1, 18.3, 14.3, 13.7, 13.8, 10.8, 9.7, 9.4, 8.8, 8.7 |

(The summary line's "gate-valid" counter in ab.sh is wrong; read the load1max column.) The prototype fails more because it checks the native step curve at every frame time against the interpolated Web curve: held frames (UIKit stall in press-focus, late hand start, menu-open block) that the canonical [t-40, t+34] min/max window absorbs become misses. The select proto misses before fix2 include the scaleY artifact (fix2, applied to s938-tree before job 007); the rest are the held frames named in Session 1.

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-003-ab-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr base arm, runs without a miss | 10/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-003-ab-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr prototype arm before fix2, runs without a miss (explained: held frames + scaleY artifact) | 0/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-004-ab-tp | ios26.3 | NativeTimePickerStatesIntegration dial-tap base arm, runs without a miss (explained: run 1 dialog t=266, two dropped frames, load1max 79) | 9/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-004-ab-tp | ios26.3 | NativeTimePickerStatesIntegration dial-tap prototype arm, runs without a miss (explained: late native hand start) | 0/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-005-ab-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr base arm | 10/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-005-ab-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr prototype arm | 10/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-006-ab-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr base arm, runs with final 194/194 (explained: run 1 press-focus 392 ms stall) | 9/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-006-ab-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr prototype arm, runs with final 194/194 (explained: held frames during the UIKit stall) | 0/10

### Session 3 (2026-11-19) notes

**Task 4 continued (proto = AWC_CMP=proto, base = canonical comparison; one build; load gate <20 before each pair; the summary's "gate-valid" counter is wrong, read load1max)**

| subset | OS | job | runs with a miss base | runs with a miss proto | final checks base / proto | load1max base / proto |
|---|---|---|---|---|---|---|
| select keyboard (fix2) | iPhone 26.3 | 007-ab-sel-r2 | 2/10 (90/91 in runs 3, 8: arrowdown-open opacity t=83) | 10/10 (88/91 every run: space-open opacity, enter-open caret held frames) | 91/91 x8, 90/91 x2 / 88/91 x10 | 70.7, 15.3, 13.5, 12.9, 11.9, 22.5, 17.7, 16.6, 17.1, 18.1 / 61.4, 17.3, 12.2, 11.5, 11.2, 16.6, 16.2, 16.9, 23.1, 43.6 |
| text field focus-type-blur | iOS 18.6 | 010-ab18-tf | 6/10 attempt-level motion lines (tab-out 2-3/84, press-focus); final 194/194 in 10/10 | 10/10 (final 191-193/194: press-focus held frames during the UIKit stall) | 194/194 x10 / 192/194 x8, 193/194, 191/194 | 110.2, 10.3, 10.2, 16.1, 12.6, 22.7, 18.2, 12.5, 15.1, 14.1 / 132.5, 18.9, 14.1, 17.1, 12.0, 18.9, 16.4, 14.3, 15.5, 16.1 |
| select keyboard (fix2) | iOS 18.6 | 011-ab18-sel | 1/10 (90/91 run 8: arrowdown-open opacity t=49) | 10/10 (89/91 every run: space-open opacity, arrowdown-open opacity) | 91/91 x9, 90/91 / 89/91 x10 | 38.9, 10.8, 11.8, 10.5, 9.4, 10.6, 10.0, 9.2, 8.5, 7.7 / 38.1, 17.5, 11.5, 10.5, 9.2, 10.6, 11.1, 10.7, 7.8, 7.3 |

**Task 5: mutations (`s938-lab/mutjob.sh <ms>`: product delay injected in NativeTextField, NativeTimePicker, MenuController, NativeTableView; 3 proto runs + 1 base run per subset; iPhone 26.3)**

| subset | 33 ms proto (008) | 33 ms base | 17 ms proto (009) | 17 ms base |
|---|---|---|---|---|
| text field | 3/3 fail (190/194) | fail 192/194 | 3/3 fail (191/194) | final 194/194 (only attempt motion lines: press-focus 3/84, tab-out 10/84) |
| time picker dial-tap | 3/3 fail (129-131/134) | fail 867/878 | 3/3 fail (129-131/134) | fail 871/878 |
| select keyboard | 3/3 fail (88/91) | fail 89/91 | 3/3 fail (88/91) | fail 89/91 |
| table sort | 0/3 fail (207/207) | fail 206/207 (click-dessert order 39/44) | 0/3 fail (207/207) | 207/207 (passes) |

Reading: for tf, tp and sel the proto arm already fails unmutated (88/91, 130-131/134, 192/194), so its 3/3 under mutation proves nothing about sensitivity; the fail lines do grow (sel arrowdown-open 15-23 points at 33 ms against 4-7 at 17 ms; tp tap-hour-7 hand 15/38 at 33 ms). Table: the prototype keeps the canonical first-change alignment (t0 moved to the native first change - 17 ms) and then checks the interpolated Web curve over [x-33, x+33] with the 90 % rule; a uniform product delay is absorbed by the alignment and the wider interpolated window, so 33 ms passes 3/3 -> per the Intent this comparison is rejected for table. The base table check catches 33 ms only through one frame of the order curve (39/44 < 90 %) and does not catch 17 ms: the first-change alignment makes the table suite insensitive to start delays in both arms (the "latency gaps" counter, 27-28 base vs 10-14 proto, is informational and not a check).

**Canonical byte identity:** job 011 compared `s938-lab/canon-md5-before.txt` (03:19:32) with `canon-md5-after.txt` (06:48:07) over 8 files: 7 identical (AppKitShim.swift 30db58615e00eb99847339d17ae81fb9, build-awcui.sh, the table, select, time picker tests, ...); NativeTextFieldStatesIntegration.swift 23a0cb3e -> 98897fc1, written 06:44:21 by the main-queue job 9-20-019-install-text-field-throttle-replay-window (story 9-20, exit 0, "BYTE IDENTITY OK"). This story wrote nothing to canonical. No macOS or Android claims: the story is iOS-simulator only (no Android lane).

**Table for the coordinator (coordinator decision):**
1. The display-grid phase does not decide pass or fail on the four subsets, except text-field tab-out without a stall (phase >= 14.5 ms fails 3/3). Misses follow main-thread stalls (UIKit focus turn 80-100 ms, select menu open 65-95 ms, dropped time-picker frames).
2. The prototype (delivery-timed samples + native step curve against the interpolated Web curve, limits unchanged) is stricter, not phase-independent: it fails 10/10 runs for tp, sel and tf on both OS versions because held frames become visible; it is blind to a 33 ms delay in the table suite. Recommendation: do not install it. Options: (a) keep the canonical window checks and route the stalls as product/system findings (row 40 of KNOWN-CAUSES, story 9-23/9-20); (b) install only part (a) of the prototype (delivery timing for select keyboard and text-field tab-out) after its own A/B; (c) add a start-delay check to the table suite (native first change vs Web first change), since neither arm catches 17 ms there.

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-007-ab-sel-r2 | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr base arm, runs without a miss (explained: runs 3 and 8 arrowdown-open opacity t=83, 90/91) | 8/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-007-ab-sel-r2 | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr base arm, best run | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-007-ab-sel-r2 | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr prototype arm with fix2, every run (explained: held frames, space-open opacity and enter-open caret) | 88/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-010-ab18-tf | ios18.6 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr base arm, final checks in 10/10 runs | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-010-ab18-tf | ios18.6 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr prototype arm, typical run (explained: press-focus held frames during the UIKit stall; 191-193/194 in all ten) | 192/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-011-ab18-sel | ios18.6 | NativeSelectStatesIntegration select-keyboard-ltr base arm, 9 of 10 runs (explained: run 8 arrowdown-open opacity t=49, 90/91) | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-011-ab18-sel | ios18.6 | NativeSelectStatesIntegration select-keyboard-ltr prototype arm, every run (explained: held frames, space-open and arrowdown-open opacity) | 89/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | ios26.3 | NativeTextFieldStatesIntegration 33 ms mutation, proto (explained: expected failure, 3/3 runs fail) | 190/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | ios26.3 | NativeTimePickerStatesIntegration 33 ms mutation, base (explained: expected failure) | 867/878
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | ios26.3 | NativeSelectStatesIntegration 33 ms mutation, proto (explained: expected failure, 3/3 runs fail) | 88/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | ios26.3 | NativeTableStatesIntegration 33 ms mutation, proto 3/3 runs (explained: NOT caught, prototype rejected for table) | 207/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | ios26.3 | NativeTableStatesIntegration 33 ms mutation, base (explained: expected failure, click-dessert order 39/44) | 206/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-009-mut17 | ios26.3 | NativeTextFieldStatesIntegration 17 ms mutation, proto (explained: expected failure, 3/3 runs fail) | 191/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-009-mut17 | ios26.3 | NativeTextFieldStatesIntegration 17 ms mutation, base final (explained: not caught at the final level, only attempt motion lines) | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-009-mut17 | ios26.3 | NativeTimePickerStatesIntegration 17 ms mutation, base (explained: expected failure) | 871/878
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-009-mut17 | ios26.3 | NativeSelectStatesIntegration 17 ms mutation, base (explained: expected failure) | 89/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-009-mut17 | ios26.3 | NativeTableStatesIntegration 17 ms mutation, base and proto (explained: NOT caught in either arm, first-change alignment) | 207/207

### Session 4 (2026-11-19) notes

Coordinator note 06:54 UTC followed: prototype rejected; part (a) alone + diagnostics; nothing installed.

- Part (a) switch `AWC_CMP=deliv` (`s938-lab/s4/patch-deliv.py`): select `compare`: `start = fire - first key/touch delivery after the fire` (Web sample time moved by d; window [t-40, t+34] and tolerances unchanged); text field: for the `tab-out` and `blur` phases `t = web t + (first HID key arrival - planned phase start)`. Trial 012: select d = 0-5.7 ms per phase, text-field tab-out d = 16.3 ms. A first version also shifted type-/select-all phases (d 16-33 ms); restricted to tab-out/blur before the A/B.
- Diagnostics `AWC_DG=1` (`s4/patch-dg.py`, shim AWCUIKitBrackets of s923-lab + AWCDG): every `FAIL:` line ends with `[DG gap=<largest display-link gap overlapping 150 ms after the last delivered input of the phase>@<start rel. that input> d=<first delivery - planned input> ph=<last vsync <= last input rel. planned, mod 16.67> brk=<ms of UIKit become/resign/keyboard brackets inside the gap> n=<deliveries>]`; nothing else changes. Class rule fixed before the runs (`s4/classify-dg.py`): U gap>=60 and brk>=10; S gap>=60 and brk<10; G gap<34 and ph<=2.0 or >=14.0; N else. Trial 012: tf press-focus `gap=84.9 brk=64.1` (U), tf tab-out `gap=24.8 ph=15.0` (G), tp tap-hour-7 t=1100 `gap=48.1 brk=20.4` (N).

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-012-s4-trial | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr AWC_CMP=deliv (trial) | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-012-s4-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr AWC_CMP=deliv (trial) | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-012-s4-trial | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr AWC_DG=1 (trial; attempt FAIL lines carry DG) | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-012-s4-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap AWC_DG=1 (trial; explained: tap-hour-7 t=1100 hand, gap 48 ms with UIKit bracket 20 ms, the open S62 miss) | 877/878
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-012-s4-trial | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr AWC_DG=1 (trial) | 207/207

### Session 5 (2026-11-19) notes

Results of jobs 013-020 (iPhone 26.3, lane d3, one build per job, load gate < 20 before each pair; private tree only).

**Part (a) alone, `AWC_CMP=deliv`: A/B ten alternating pairs (013 text field, 014 select)**

| subset | arm | runs with an attempt-level FAIL line | final level | FAIL lines | load1max per run |
|---|---|---|---|---|---|
| text field | base | 10/10 | 194/194 x9, 193/194 x1 (run 10) | 21 | 48.9, 13.6, 13.8, 9.9, 8.4, 11.5, 9.0, 7.2, 8.0, 8.6 |
| text field | deliv | 10/10 | 194/194 x10 | 17 | 48.5, 18.7, 12.3, 10.8, 8.1, 8.8, 8.4, 7.5, 9.1, 9.5 |
| select keyboard | base | 2/10 (runs 2, 4: arrowdown-open opacity) | 91/91 x8, 90/91 x2 | 2 | 98.9, 18.7, 16.0, 11.1, 13.2, 12.1, 10.7, 9.9, 9.7, 69.8 |
| select keyboard | deliv | 0/10 | 91/91 x10 | 0 | 91.8, 46.5, 14.2, 12.6, 14.9, 13.8, 10.0, 9.4, 9.9, 9.5 |

Measured delivery delay d (Web sample time moved by d, window and tolerances unchanged): select 0-7.2 ms per phase; text-field tab-out 3.8-21.8 ms.

**Tab-out phase table (013, `s938-lab/s4/tabout.py`; stalled = display-link gap across the planned input >= 50 ms)**

| arm | attempts | stalled: n / miss | unstalled: n / miss | unstalled misses by phase |
|---|---|---|---|---|
| base | 34 | 8 / 7 | 26 / 5 | ph 2-4: 3/8; ph 4-12: 0/14; ph 14-17: 2/4 |
| deliv | 30 | 7 / 7 | 23 / 0 | ph 2-4: 0/7; ph 4-12: 0/13; ph 14-17: 0/3 |

Reading: with part (a) the phase boundary at 13.5/14.5 ms disappears (0 of 23 unstalled attempts miss; the base arm missed at ph 14-17 in 2/4 and at ph ~3 in 3/8). Every remaining tab-out miss follows a 56-60 ms display-link stall (7/7). Select: arrowdown-open t=83 misses 2/10 in base, 0/10 in deliv.

**Mutations with part (a) (015: 33 ms, 016: 17 ms; 3 deliv runs + 1 base run per subset)**

| subset | 33 ms deliv | 33 ms base | 17 ms deliv | 17 ms base |
|---|---|---|---|---|
| text field | 3/3 fail (193, 193, 192/194) | fail 192/194 | 1/3 fail at final level (194, 193, 194/194; all three carry attempt FAIL lines: press-focus label font/y, press-focus and tab-out motion) | final 194/194 (attempt lines only) |
| select keyboard | 3/3 fail (89/91: arrowdown-open and space-open opacity) | fail 89/91 | 0/3 fail (91/91) | fail 89/91 |

A 33 ms delay fails every run in both subsets (requirement met). 17 ms: select is caught by base (1/1 here, 1/1 in job 009) but not by deliv (0/3): moving each Web sample by d = 3-7 ms gives a 17 ms start delay room inside the [t-40, t+34] window that base did not give; text field at 17 ms is caught at the final level in 1/3 deliv runs and 0/1 base runs. So part (a) removes the phase misses but costs the select suite its 17 ms sensitivity.

**Diagnostics `AWC_DG=1`: five alternating pairs per subset (017 tf, 018 sel, 019 tp, 020 tb)**

| subset | final nodg | final dg | FAIL lines nodg (checks) | FAIL lines dg (checks) |
|---|---|---|---|---|
| text field | 194/194 x5 | 194/194 x5 | 9 (press-focus 7, tab-out 2) | 11 (press-focus 5, tab-out 6) |
| select keyboard | 91/91 x4, 90/91 x1 | 91/91 x5 | 1 (arrowdown-open) | 0 |
| time picker dial-tap | 878 x3, 877, 876/878 | 878 x2, 877 x3 | 3 (open t=266 x2, tap-hour-7 t=1100) | 3 (tap-hour-7 t=1100 x2, t=1133) |
| table sort | 207/207 x5 | 207/207 x4, 206/207 x1 | 0 | 1 (dg-3: click-dessert order 38/44, gap 58.5 ms, bracket 9.9 ms) |

Zero difference: the patch only appends `[DG ...]` to `FAIL:` lines and keeps the display-link stamps (no change to what is compared, no extra sampling); the same checks fail in both arms (tf press-focus/tab-out, sel arrowdown-open, tp dial-tap hand/open), and the count differences are within the run-to-run spread of the unchanged base (base alone: tf 21 lines in 10 runs, sel 0-2 per 10 runs). Not literally identical line counts per arm in five pairs; claimed as "same checks, counts within base spread", not as byte-identical output.

**Class rule (fixed before the runs, `s4/classify-dg.py`):** U = gap >= 60 ms and UIKit bracket >= 10 ms inside (focus turn of UIKit); S = gap >= 60 ms, bracket < 10 (stall not from UIKit); G = gap < 34 ms and phase <= 2.0 or >= 14.0 (grid phase); N = else (not classed).

**Class counts (dg arm, all FAIL lines of 017-020):** U=5, S=0, G=0, N=10, not classed X=0 (15 FAIL lines).
- tf press-focus: U 5/5 (gap 88-100 ms, bracket 63-69 ms).
- tf tab-out: N 6/6 (gap 24-28 ms, d 9-18 ms, phase 8.7-16: not at the grid edge, no stall; these are the tab-out misses part (a) removes, the delivery delay d being the deciding number).
- tp tap-hour-7: N 3/3 (gap 43-49 ms with a UIKit bracket of 19-24 ms: below the 60 ms stall bound).
- tb click-dessert order: N 1/1 (gap 58.5 ms, bracket 9.9 ms: just under both the 60 ms and the 10 ms bound; one dropped/held stretch).
- G (grid phase) = 0, S = 0.

**Install file lists (if the coordinator orders either; nothing installed):**
- part (a): `packages/native-ios/Tests/NativeSelectStatesIntegration.swift`, `packages/native-ios/Tests/NativeTextFieldStatesIntegration.swift` (the latter changed in canonical by 9-20-019 since s938-tree was taken; re-sync before any install).
- diagnostics: `apps/native-ios-parity/Shim/AppKitShim.swift` (AWCUIKitBrackets, AWCDG), `packages/native-ios/Tests/NativeSelectStatesIntegration.swift`, `NativeTextFieldStatesIntegration.swift`, `NativeTimePickerStatesIntegration.swift`, `NativeTableStatesIntegration.swift` (check() suffix, input marks, frame-clock start).


EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-013-ab-deliv-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr base arm, final level, runs (explained: run 10 193/194) | 9/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-013-ab-deliv-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr AWC_CMP=deliv arm, final level, runs | 10/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-013-ab-deliv-tf | ios26.3 | NativeTextFieldStatesIntegration tab-out unstalled attempts without a miss, base (explained: phase 2-4 and 14-17 misses) | 21/26
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-013-ab-deliv-tf | ios26.3 | NativeTextFieldStatesIntegration tab-out unstalled attempts without a miss, AWC_CMP=deliv | 23/23
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-014-ab-deliv-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr base arm, runs without a miss (explained: runs 2, 4 arrowdown-open opacity) | 8/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-014-ab-deliv-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr AWC_CMP=deliv arm, runs without a miss | 10/10
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-015-mut33-deliv | ios26.3 | NativeTextFieldStatesIntegration 33 ms mutation AWC_CMP=deliv, typical run (explained: expected failure, 3/3 runs fail) | 193/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-015-mut33-deliv | ios26.3 | NativeSelectStatesIntegration 33 ms mutation AWC_CMP=deliv, every run (explained: expected failure, 3/3 runs fail) | 89/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-016-mut17-deliv | ios26.3 | NativeSelectStatesIntegration 17 ms mutation AWC_CMP=deliv, every run (explained: NOT caught, 0/3; base catches it 89/91) | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-016-mut17-deliv | ios26.3 | NativeSelectStatesIntegration 17 ms mutation base (explained: expected failure) | 89/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-016-mut17-deliv | ios26.3 | NativeTextFieldStatesIntegration 17 ms mutation AWC_CMP=deliv run 2 (explained: expected failure; runs 1, 3 final 194/194 with attempt lines) | 193/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-017-dg-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr AWC_DG=1 arm, final level, runs | 5/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-017-dg-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr no-DG arm, final level, runs | 5/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-018-dg-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr AWC_DG=1 arm, runs 91/91 | 5/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-018-dg-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr no-DG arm, runs 91/91 (explained: run 5 arrowdown-open opacity 90/91) | 4/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-019-dg-tp | ios26.3 | NativeTimePickerStatesIntegration dial-tap AWC_DG=1 arm, runs 878/878 (explained: tap-hour-7 hand, class N) | 2/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-019-dg-tp | ios26.3 | NativeTimePickerStatesIntegration dial-tap no-DG arm, runs 878/878 (explained: open t=266 and tap-hour-7 hand) | 3/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-020-dg-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr AWC_DG=1 arm, runs 207/207 (explained: dg-3 click-dessert order 38/44, class N) | 4/5
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-020-dg-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr no-DG arm, runs 207/207 | 5/5

### Session 6 (2026-11-19) notes

Install session (coordinator note 18:59). Method: instead of syncing the old s938-tree (which carried proto and PD code), the five touched files were reset to canonical and `s938-lab/s6/patch-split.py <tree> s923-lab/patch-brk.py <a|dg|all>` applied: part (a) (select `compare`, text-field tab-out/blur) and the diagnostics (shim stamps + AWCUIKitBrackets + AWCDG, FAIL suffix in the four tests). Both are ON by default now (AWC_CMP=none restores the planned-input comparison, AWC_DG=0 switches diagnostics off). Dry run on a copy: canonical + a + dg == s6/clean, in both orders. Trial 021 (iPhone 26.3, load1max 315): text field 194/194, DLV lines present (d=6.8, 1.5, 13.0 ms), FAIL lines carry the DG suffix (press-focus gap=229.4 brk=92.4: class U).

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-021-build-clean-trial | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr clean tree defaults (explained: attempt-level press-focus UIKit focus turn gap 229 ms brk 92 ms, tab-out gap 29 ms) | 194/194

### Session 7 (2026-11-19) notes

Job 022 (iPhone 26.3, clean tree defaults, 3 runs per subset; load gate result "timeout" for tp/tb means the load never dropped below 20 in the wait): tf final 194/194 x3 (attempt-level FAIL lines 1-2 per run, press-focus/tab-out as before), sel 91/91 x3 (0 FAIL lines), tb 207, 207, 206 (tb-3 click-dessert order 38/44, load1max 275), tp 877, 873, 857 of 878 (load1max 400, 367, 969; tp-3 open t=266/300 after a 262 ms display-link gap with a 36 ms UIKit bracket at load 969). Classing of tp/tb by load still to do.

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-022-reg-iphone263 | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr clean tree, 3 runs final level | 3/3
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-022-reg-iphone263 | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr clean tree, 3 runs | 3/3
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-022-reg-iphone263 | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr clean tree, run 2 (explained: run 3 206/207 click-dessert at load1max 275) | 207/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-022-reg-iphone263 | ios26.3 | NativeTimePickerStatesIntegration dial-tap clean tree run 1 (explained: load1max 400 miss; runs 2, 3 873 and 857 at load 367 and 969) | 877/878

### Session 10 evidence (2026-11-20)

EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-024-mut33-default | ios26.3 | 33 ms mutation Select states (explained: the mutation must fail, 33 ms delay caught) | 89/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-024-mut33-default | ios26.3 | 33 ms mutation Text field states (explained: the mutation must fail, 33 ms delay caught) | 193/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-024-mut33-default | ios26.3 | 33 ms mutation Time picker states (explained: the mutation must fail, 33 ms delay caught) | 868/878
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-025-macos-compile | macos | compile of the four patched states tests | 4/4
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-029-rebase-tp-compile-reg | macos | compile of the four patched states tests (rebased time picker) | 4/4
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-026-reg-iphone263-tp-tb-repeat | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr run 2 | 207/207
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-027-reg-ipad-tf-sel | ios-ipad26.3 | NativeSelectStatesIntegration select-keyboard-ltr run 1 | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-027-reg-ipad-tf-sel | ios-ipad26.3 | NativeSelectStatesIntegration select-keyboard-ltr run 2 | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-027-reg-ipad-tf-sel | ios-ipad26.3 | NativeSelectStatesIntegration select-keyboard-ltr run 3 | 91/91
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-027-reg-ipad-tf-sel | ios-ipad26.3 | NativeTextFieldStatesIntegration run 1 (explained: press-focus UIKit focus turn bracket 97 ms, tab-out attempt lines also in the base arm 028) | 193/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-028-ipad-tf-base-arm | ios-ipad26.3 | NativeTextFieldStatesIntegration base arm AWC_CMP=none run 1 | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-028-ipad-tf-base-arm | ios-ipad26.3 | NativeTextFieldStatesIntegration base arm AWC_CMP=none run 3 | 194/194
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-032-install-comparison-delivered-input | macos | install byte identity (a), 2 test files | 2/2
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-033-install-diagnostics-fail-lines | macos | install byte identity (dg), shim + 4 tests | 5/5

Installs at 2026-11-20 05:01 UTC. Canonical md5: shim 9055674f405eb3d2ff7369fffbca7199; TextField 9b69a897; Table 4b838a68; Select e8276c5c; TimePicker 118c2223. Cost: 17 ms select not caught (0/3), 33 ms caught 3/3. iPad base arm 028: finals 194,193,194 (tab-out attempt lines 5,2,3 per run); arm 027: 193 x3 (final miss = press-focus, brk 97.1, 117.9, 88.7 ms = class UIKit focus turn; tab-out attempt lines brk 0 not classed, same as base).

## Review Triage Log

