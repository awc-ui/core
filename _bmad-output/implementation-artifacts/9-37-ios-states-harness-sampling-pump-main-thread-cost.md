---
title: 'iOS states harness: while it samples, the test's own pump keeps the main thread in CoreAnimation commits; measure the cost per tick and try a cheaper sampler in a private copy (no install)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-37-ios-states-harness-sampling-pump-main-thread-cost'
epic: 9
model: 'opus'
wave: 6
lanes: 'mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and AWC-d3-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist'
lab: 'work/s937-lab (create it; private tree work/s937-tree = a copy of canonical, including a private copy of the shim and the test harness; the sample reports of story 9-32 are in work/s932-lab/out-smp-010-sample, those of story 9-16 in work/s916-lab (job 028); the UIKit bracket hooks and the gap recorder of story 9-23 are in work/s923-lab)'
depends_on: ['9-23-ios-harness-uikit-responder-block-and-first-key']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** One-frame misses after an input on the iOS simulators are open in many suites: text field tab-out (final failures in 2 of 5 runs), select keyboard open (a miss in 8 of 10 runs), table sort click (2 of 10 runs after the announce fix), time picker taps and drags (1 to 4 of 5676 checks), list. Every story saw main-thread blocks of 20 to 130 ms in the turn of the input, with the same length in passing and failing runs. What is known: story 9-23: UIKit's own turn at a focus change is 12 to 21 ms inside a block of 18 to 35 ms and the rest of the block is run-loop time that its traces could not attribute; an optimised build and a motion clock started at the delivered input change nothing for text field and select. Story 9-16: one real product cost (the first accessibility announcement, 25 to 37 ms, fixed in its tree). Story 9-32, job 010 (time picker tap on iPhone 26.3, /usr/bin/sample at 1 ms, 12 reports): about 90 percent of the main-thread samples are in the test's own pump; CA::Transaction::commit is about 57 percent (the mach_msg round trip to the render server about 35 percent), run-loop waiting about 25 percent, the shim's touch dispatch 7 samples, named time-picker product functions 0 samples; the failing and the passing profile are equal within 5 percent; the reports are 1 s aggregates and not resolved in time. Story 9-16 job 028 saw the same picture (test raster and display-link work dominate). So the measuring itself may hold the main thread: while the pump samples, a frame of the product after an input comes late by an amount that depends on the phase. This is a hypothesis with one profile behind it, not a result.

**Approach:** Read first, then measure, then prototype; nothing is installed in this story. (1) Read the harness: where the pump runs in the states tests, what one tick does (which functions of `AppKitShim.swift`, of the test host and of `NativeInspection.swift` it calls), and what forces a synchronous CoreAnimation commit or a raster (a flush, a draw of the hierarchy after screen updates, a layer render, a snapshot). (2) Measure one tick with time stamps in the private copy: commit or flush, raster or capture, inspection read, run-loop wait; for four subsets with a short job each: text-field tab-out, table sort click, select keyboard open, time-picker taps. Give the cost per tick, the ticks per second and the share of the main thread, and a time-resolved picture of one input turn (when the input is delivered, when the product writes its state, when the next commit ends, when the tick reads). (3) Say which checks need pixels and which only read values. (4) Prototype a cheaper sampler in the private copy: value checks read without a forced commit or raster, pixel checks unchanged; no sample is dropped or moved. (5) A/B behind a load gate (1-minute load below 20, load1max printed): ten alternating pairs for each of the four subsets, runs with a miss per arm. (6) Sensitivity: with the prototype the existing 33 ms product-delay mutations of those suites (stories 9-23, 9-16, 9-29, 9-31 have the switches) still fail in every run. End blocked with the words coordinator decision and the table; an install into the canonical shim is a separate decision that the coordinator takes and tells the user first.

## Boundaries & Constraints

**Always:** The record has the cost of one sampling tick split into its parts for the four subsets, a time-resolved picture of one input turn, the A/B table (runs with a miss per arm, ten pairs per subset) and the mutation results with the prototype; nothing is installed. The rules in project-context.md apply.

**Never:** Do not install anything and do not edit canonical `AppKitShim.swift`, the canonical tests or `scripts/build-awcui.sh`. Do not widen a tolerance, add a retry, drop or shift samples around an input, or mark misses as known gaps: a sampler that does not look at the frames after an input is not a fix. Short trial job (build plus one case) before every long job; a job stops at the first failed build. Before queueing a job check that no file with the same name sits in the lane queue. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Records of stories `9-32` (job 010 sample table), `9-16` (jobs 028 to 031), `9-23` (E report, Session 14 and Session 7) and `9-20`
- `packages/native-ios` test host and shim: `AppKitShim.swift` (canonical md5 starts with 30db5861), the states tests under `packages/native-ios/Tests`, `Sources/AWCUI/NativeInspection.swift`, `apps/native-ios-parity/scripts/run-fixture.sh` and `build-awcui.sh`
- `work/claude-runner/KNOWN-CAUSES.md` and `work/claude-runner/PARALLEL.md`

## Tasks & Acceptance

**Execution:**
- [x] What one sampling tick does and what forces a commit or a raster, with file and function names
- [x] Cost per tick split into its parts for the four subsets; a time-resolved picture of one input turn (failing and passing attempt)
- [x] The list of check kinds that need pixels and of those that only read values
- [x] The prototype sampler in the private copy; A/B ten alternating pairs per subset behind the load gate
- [x] The 33 ms mutations of the four suites with the prototype: every run fails
- [x] KNOWN-CAUSES.md row with the numbers; the table for the coordinator; status blocked with the words coordinator decision

**Acceptance Criteria:**
- Given the record, when a reader asks what the main thread does during one sampling tick on the iOS simulator, then it names the functions and gives the time of each part
- Given the prototype, when ten alternating pairs run for each of the four subsets, then the table shows the runs with a miss per arm with load1max per run
- Given the prototype, when the 33 ms product-delay mutation of each suite runs three times, then every run fails
- Given the end of the story, when the coordinator reads it, then nothing is installed and canonical is byte-identical to before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator decision 2026-11-19 03:15 UTC: lite sampler not installed; story closed to review; story 9-38 follows)
Decision: the recommendation is accepted. The lite sampler is NOT installed (no gain on any subset, select gets worse); nothing from this story goes to canonical. The hypothesis 'the measuring itself makes the misses' is closed as not supported, with your A/B table as the proof. Your job 010 trace is the new starting point: same main-thread profile in the failing and the passing turn, the miss follows the phase of the display grid against the oracle clock. Story 9-38 takes that on (how the checks line up frames and inputs; a comparison that does not depend on the phase, limits unchanged; private prototype, no install). All tasks are done and the evidence check reports 0 hard failures, so the coordinator sets this story to review; no further session is needed here.

## Dev Agent Record

### Current state
- Status blocked: coordinator decision. All six tasks done (sessions 1-3). Nothing installed; canonical byte-identical to `s937-lab/canon-md5-before.txt` (8/8 OK, session 3).
- A/B (ten pairs each): tp 5 vs 5 (011), sel 2 vs 7 (006), tb 1 vs 0 (007), tf 10 vs 10 (008); mutations +33 ms fail in every run (009); traced turns (003, 010). Table for the coordinator in Session 3 notes.
- Recommendation: do not install the lite sampler (no gain, select worse). KNOWN-CAUSES.md 9-37 line corrected to the 011 numbers.
- Nothing in flight. Next: only a coordinator decision (install or close); no job to run.

### Session 1 (2026-11-19) notes

**Lab:** `work/s937-lab` (probe.swift, patch-probe.py, common.sh, NNN.sh, outNNN/). Private tree `work/s937-tree` = rsync of canonical `apps/native-ios-parity` + `packages/native-ios` (only the iOS parts are needed by run-fixture.sh) + the probe patch. Canonical md5s before any job: `s937-lab/canon-md5-before.txt` (shim 30db5861...). Sims: AWC-d3 = E5FA07C1-902C-4A1E-A210-5CF9E5C34019 (iPhone 17 Pro, iOS 26.3), AWC-d3-18 = 3E52E2F3-1EBE-427B-9178-DE2BFBAE12A4 (iPhone 16 Pro, iOS 18.6).

**Task 1, what one sampling tick does (read from canonical):**
- Time picker (`NativeTimePickerStatesIntegration.pump`, line 74), select (`NativeSelectStatesIntegration.pump`, line 96), table (`NativeTableStatesIntegration.pump`, line 104): one tick = (a) drain the shim event queue `NSApp.nextEvent` / `NSApp.sendEvent` (shim `AWCShimTouch.dispatch`); (b) `host.layoutSubtreeIfNeeded()` = shim `UIView.layoutIfNeeded()` on the hosting view and each direct subview (UIHostingView layout pass = SwiftUI graph update when dirty); (c) `host.displayIfNeeded()` = shim `layer.displayIfNeeded(); CATransaction.flush()` (AppKitShim.swift line 290): **a forced synchronous Core Animation commit on every tick**; (d) `RunLoop.current.run(mode: .default, before: now + 2 ms)` (table 4 ms) = `CFRunLoopRunInMode(default, t, returnAfterSourceHandled: true)`; table also appends `(now, frozenScroll(), containerScroll())`.
- Text field (`NativeTextFieldStatesIntegration.pump`, line 98): (a), (b), then `RunLoop.current.run(until: now + 4 ms)` (keeps running the loop until the date, may sleep), then the sample read (copy of `state.measurements`). No displayIfNeeded, so no explicit flush; commits come from UIKit's own update cycle / run-loop observer.
- Values read by every suite come from `awcNativeInspection` (NativeInspection.swift, `AWCNativeInspectionModifier.deliver` via `onPreferenceChange` / `transformPreference` + main-queue redelivery), i.e. the SwiftUI preference values of the last graph update, no pixels.
- Pixel captures (outside the tick): shim `AWCShim.capture` (line 63): `AWCShimFrameClock.waitForFrame()` when the shot follows an input or a series shot without a new frame, then `view.layoutIfNeeded(); CATransaction.flush()`, then `drawHierarchy(afterScreenUpdates: !series)` (render-server snapshot; a non-series shot waits for a screen update, measured ~20 ms at 3x per the shim comment).
- Forces a commit or raster: (c) every tick in table/select/time picker; capture() (flush + drawHierarchy) for every shot; `AWCShim.pumpFrames` (flush every 4 ms) inside shim helpers (selectText, window content change, orderFront).

**Task 3, check kinds (read from canonical):**
- Value-only (inspection): text field states (no capture at all), time picker states (no capture at all), select motion envelope / state checks (`sample()`), table motion / state / scroll checks (`frames`, inspection).
- Pixels: select: a series of `cacheDisplay` shots every 16 ms from the phase's last web input + 17 ms to the phase end (line 238), compared as phase-end best frame (line 309); table: one phase shot per phase after the motion comparison (line 742, `capture(ph["clip"])`).

**Probe (private tree only, `s937-lab/probe.swift` + `patch-probe.py`):** `AWCTickProbe.begin/mark/end` around the pump parts; run-loop observers bracket the implicit CA commit (order 1999999/2000001) and the wait (afterWaiting); `CFRunLoopRunInMode` result histogram; input delivery stamps in the shim's `UIWindow.sendEvent` (TINP/TIND), inspection delivery (TDLV), display-link stamps (TVS), capture durations (TCAP), CA commit durations via the private `+[CATransaction addCommitHandler:forPhase:]` (armed only inside the trace window). Summary line `TICKSUM` at exit.

**Job 001 (trial, time picker dial-tap, iPhone 26.3, load1max 67):** 878/878. TICKSUM: 372661 ticks in 11.3 s of pump wall time = about 33000 ticks/s, mean tick 0.03 ms (p95 0.03): **the pump is a busy spin**; the run loop never sleeps (wait 0), the run-loop call returns at once. The input turn is inside one long run-loop call: touch-down delivered inside `RunLoop.run` of a tick that took 16.5 ms (rl 16.53, flush 0.01), inspection delivered 11 ms after the touch inside the same tick. So the per-tick parts are tiny; the cost is (i) the main thread never idles (one core at 100 % for the whole suite) and (ii) the heavy work sits inside the run loop, not in the flush.

**Job 003 (probe v2, one traced run per subset, iPhone 26.3, load1max 56-76) and job 004 (probe v3, base vs lite, one run each, load1max 32-110). Cost of one tick, base arm (job 004 for tp/sel/tb, no commit handlers; job 003 for tf):**

| subset | ticks/s in pump | tick mean / p95 / max ms | main thread inside ticks (busy) | flush share of tick time | run-loop call | heavy ticks >= 4 ms (n / ms) | captures |
|---|---|---|---|---|---|---|---|
| time picker dial-tap | 30100 | 0.03 / 0.05 / 114 | 95.5 % (95.3 %) | 56 % (5893 of 10566 ms) | 36 %, returns "handled source" 333036 of 333036 | 106 / 1810 (rl 1279, layout 188, flush 42) | none |
| select keyboard-ltr | 21800 | 0.04 / 0.10 / 61 | 81.5 % (81.5 %) | 71 % (4628 of 6490 ms) | 25 %, handled source 100 % | 64 / 491 | 50 shots, mean 14.2 ms, p95 23.4, max 40.6 (709 ms) |
| table sort-ltr | 30300 | 0.03 / 0.04 / 93 | 85.2 % (85.2 %) | 33 % (2089 of 6266 ms); read (frames.append + scroll reads) 38 % (job 003) | 21 %, handled source 100 % | 13 / 264 (layout 227: SwiftUI update forced by layoutIfNeeded) | 8 phase shots, mean 39.9 ms |
| text field filled-ltr (tab-out) | 206 | 4.51 / 4.73 / 156 | 92.9 % (busy 11.0 %, wait 3.98 ms of each tick) | no flush | `run(until: +4 ms)` sleeps | 19 >= 8 ms / 505 | none |

Parts of a light tick (base): drain 0.00, layout 0.00, display 0.00, flush 0.02-0.03, run loop 0.01, read 0.00-0.01 ms. The implicit CA commit observed by the run-loop observer bracket is ~0 (commits happen in the explicit flush and in UIKit's update cycle inside the run-loop call).

**Time-resolved input turns (job 003, iPhone 26.3; times relative to the touch-up delivery):**
- time picker tap (input 5, passing run): touch-down delivered at -15.4 ms inside a 13.1 ms run-loop call (UIKit handling 0.8 ms), product value written (inspection delivery) at -6.8; touch-up at 0 handled in 0.24 ms; vsync at +0.3, +16.6, +33.2, +49.9, +66.5 ...; each vsync starts a run-loop call of 1.3-2.0 ms (SwiftUI frame) and the inspection delivery follows 1.0-1.5 ms after the vsync; the next pump tick (0.03 ms) flushes it. No frame skipped.
- table sort click (input 3): touch-down at -15.0 (UIKit 4.6 ms); touch-up at 0 (0.44 ms); inspection delivered at +19.6 outside the pump (the test's own click/up code); display-link callbacks at -10.4 and then only at +41.1: two frames (~+6, ~+23) have no callback, the main thread is busy outside the pump for ~50 ms (the sort re-render, the block of story 9-16), then 60 Hz with 2.3-3.2 ms per frame.
- text field (input 4, press): touch-up handling 22.95 ms (UIKit focus change, story 9-23), vsync at +26.3, +32.7, then +64.5 (one frame missing near +48).
- So the per-tick parts are tiny; the 20-130 ms blocks are inside the run loop (UIKit / product) or in the test's input code, not in the tick. The spin's cost is that the main thread never idles (one host core at 100 % for the whole suite).

**Prototype `AWC_SAMPLER=lite` (private tree only):** in `patch-probe.py` the shim's `displayIfNeeded()` skips `CATransaction.flush()` while a pump tick runs (`AWCTickProbe.inPump`); `layer.displayIfNeeded()`, the event drain, `layoutSubtreeIfNeeded()`, the run-loop call and every value sample stay; `AWCShim.capture` keeps its own flush + `drawHierarchy`, so pixel checks are unchanged; no sample is dropped or moved (a tick still follows every run-loop wake, i.e. every vsync and input, and at least every 2-4 ms). Job 004 (one run per arm): ticks/s tp 30100 -> 515, sel 21800 -> 452, tb 30300 -> 307; busy share 95 -> 26 %, 82 -> 14 %, 85 -> 12 %; run-loop calls now end by timeout in 49 %, 54 %, 32 %. Single-run results: tp base 877/878 (tap-hour-7 t=1100 hand), tp lite 875/878 (tap-hour-7 t=1100 and t=1133 hand, open t=300 dialog), load1max 110 for both; sel 91/91 both; tb 207/207 both. One run is not an A/B; jobs 005-008 are.

**Mutations (job 009, `s937-lab/mut.py`):** tf = the 9-23 recipe with 33 ms (`NativeTextField.swift` transition clock + 33); tp = hand presented 33 ms behind the clock (`NativeTimePicker.swift` hand TimelineView); sel = md-menu `openedAt` + 33 (`MenuController.swift`); tb = row FLIP delays + 0.033 s (`NativeTableView.swift startFlip`). Each in its own tree `work/s937-mut-<k>` and build dir.

EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-001-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap (probe v1) | 878/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-003-trace4b | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr (probe v2, trace) | 194/194
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-003-trace4b | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr (probe v2, trace) | 91/91
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-003-trace4b | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr (probe v2, trace) | 207/207
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap base (explained: tap-hour-7 t=1100 hand, the open miss under study, load1max 110) | 877/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeTimePickerStatesIntegration dial-tap lite (explained: tap-hour-7 t=1100/1133 hand and open t=300 dialog, load1max 110; single run, see A/B 005) | 875/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr base | 91/91
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr lite | 91/91
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr base | 207/207
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-004-lite-trial | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr lite | 207/207
Job 002 (`9-37-ios-states-harness-sampling-pump-main-thread-cost-002-trace4`, exit 7) stopped at its first run: the commit-handler block needed `@escaping` (fixed in 003); no result.
KNOWN-CAUSES.md: dated 9-37 line appended (busy spin from the forced flush; numbers above).

### Session 2 (2026-11-19) notes

**A/B, prototype `AWC_SAMPLER=lite` vs base, iPhone 26.3 (AWC-d3), ten alternating pairs per subset, one load gate per pair (1-minute load < 20, at most 5 min). "Miss" = the run has at least one `FAIL` line. Runs with load1max >= 20 are listed but excluded from the gate-valid count.** Per-run values from the `RESULT` lines of the job logs (the per-run console files of 005-008 were overwritten: the gate's loop variable `i` clobbered the pair index; fixed with `local i` in `common.sh` for 010/011).

| subset (job) | arm | runs with a miss | gate-valid runs with a miss | FAIL lines | load1max per run (fails) |
|---|---|---|---|---|---|
| time picker dial-tap (011, rerun of 005) | base | 5/10 | 4/9 | 7 | 39.4(1) 10.6(0) 9.3(0) 8.9(1) 9.4(0) 10.3(1) 10.0(3) 9.9(1) 9.7(0) 15.0(0) |
| | lite | 5/10 | 4/9 | 15 | 39.0(2) 19.4(0) 9.5(0) 9.0(2) 9.4(4) 10.2(0) 9.9(5) 9.6(2) 9.7(0) 9.6(0) |
| time picker dial-tap (005, exit 2: ab.sh edited while it ran; superseded by 011, no EVIDENCE) | base | 8/10 | 6/8 | 9 | 185.1(1) 20.5(1) 18.3(1) 14.4(1) 12.4(0) 14.3(2) 14.1(0) 18.2(1) 17.7(1) 10.8(1) |
| | lite | 4/10 | 3/9 | 8 | 16.5(0) 19.1(0) 16.9(2) 15.3(0) 13.2(0) 13.6(2) 14.5(0) 22.6(2) 15.3(2) 12.9(0) |
| select keyboard-ltr (006) | base | 2/10 | 2/10 | 2 | 10.3(1) 9.8(0) 9.1(0) 10.6(0) 14.5(0) 8.3(1) 7.8(0) 7.2(0) 7.5(0) 8.8(0) |
| | lite | 7/10 | 7/10 | 7 | 9.9(1) 10.6(1) 10.7(1) 10.2(0) 10.1(1) 9.1(1) 7.8(0) 7.6(0) 8.2(1) 8.4(1) |
| table sort-ltr (007) | base | 1/10 | 1/9 | 2 | 101.1(0) 15.7(0) 13.2(0) 9.7(0) 10.6(0) 15.6(0) 16.4(0) 11.2(0) 9.5(0) 8.1(2) |
| | lite | 0/10 | 0/8 | 0 | 102.4(0) 18.9(0) 11.7(0) 10.0(0) 10.6(0) 9.3(0) 16.4(0) 14.0(0) 8.9(0) 35.7(0) |
| text field filled-ltr (008) | base | 10/10 (final checks 194/194 in 10/10) | 9/9 | 16 | 68.9(3) 8.2(1) 7.6(2) 8.2(2) 9.0(1) 7.4(1) 7.1(1) 6.6(1) 7.4(2) 13.9(2) |
| | lite | 10/10 (final checks 194/194 in 10/10) | 9/9 | 14 | 68.9(1) 17.8(2) 9.9(1) 9.5(2) 9.0(1) 7.9(1) 6.6(1) 6.6(2) 14.5(2) 15.0(1) |

Fail kinds: tp `tap-hour-7 t=1100 hand` (both arms; lite also `t=1133 hand` and `open t=300 dialog`); sel `arrowdown-open motion 1/56 frames outside the envelope opacity t=83` (native lags: web 0.934, native 0.899); tb `[3] click-dessert motion order n0.1.0/n0.1.1` (base only, one run); tf `press-focus` and `tab-out motion 3-7/84 frames outside the envelope` (both arms, every run; the text-field pump has no forced flush, so its arms differ only in the shim helpers).
**Reading:** removing the forced flush cuts the pump's main-thread share from 82-95 % to 12-26 % (job 004) but does not remove the misses: tp 5 vs 5 runs in the clean rerun 011 (FAIL lines 7 vs 15; 005 had 8 vs 4), select gets worse (2 -> 7: without the flush, the opacity frame at t=83 is committed one frame later), table 1 vs 0, text field 10 vs 10. The hypothesis "the measuring itself holds the main thread and makes the misses" is not supported; the 20-130 ms blocks are inside the run loop (UIKit / product) and in the tests' input code (job 003 turns).

**Mutations with the prototype (job 009, +33 ms product delay, `s937-lab/mut.py`, own tree per suite):** every run fails, lite x3 and base x1: tf 192/194, 192/194, 191/194 (base 193/194); tp 867, 867, 868 of 878 (base 867); sel 89/91 x3 (base 89/91; `arrowdown-open opacity t=49 native 0.000`); tb 206, 205, 206 of 207 (base 206; the order check that also misses naturally in 1 of 20 runs).

EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-006-ab-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr A/B base, runs without a miss (explained: A/B count, 2 of 10 runs with a miss) | 8/10
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-006-ab-sel | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr A/B lite, runs without a miss (explained: A/B count, 7 of 10 runs with a miss) | 3/10
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-007-ab-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr A/B base, runs without a miss (explained: A/B count, 1 of 10 runs with a miss) | 9/10
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-007-ab-tb | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr A/B lite, runs without a miss | 10/10
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-008-ab-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr A/B base, final checks (explained: motion FAIL lines in 10 of 10 runs) | 194/194
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-008-ab-tf | ios26.3 | NativeTextFieldStatesIntegration tf-focus-type-blur-filled-ltr A/B lite, final checks (explained: motion FAIL lines in 10 of 10 runs) | 194/194
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTextFieldStatesIntegration +33 ms mutation lite run 1 (explained: the mutation must fail) | 192/194
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTextFieldStatesIntegration +33 ms mutation lite run 3 (explained: the mutation must fail; run 2 192/194, base 193/194) | 191/194
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTimePickerStatesIntegration dial-tap +33 ms mutation lite runs 1-2 and base (explained: the mutation must fail) | 867/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTimePickerStatesIntegration dial-tap +33 ms mutation lite run 3 (explained: the mutation must fail) | 868/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeSelectStatesIntegration select-keyboard-ltr +33 ms mutation lite x3 and base (explained: the mutation must fail) | 89/91
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr +33 ms mutation lite runs 1, 3 and base (explained: the mutation must fail) | 206/207
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-009-mut33 | ios26.3 | NativeTableStatesIntegration full/tb-sort-ltr +33 ms mutation lite run 2 (explained: the mutation must fail) | 205/207

**Failing vs passing input turn (job 010, time picker dial-tap `tap-hour-7`, base arm, iPhone 26.3, probe trace + a `TPHASE` stamp at each phase fire; times in ms from the run's t0, the oracle clock; the check that misses is the hand at t=1100).** Failing run = console `out010/tp7-10.log` (877/878, `tap-hour-7 t=1100 hand web 120.92 vs native [118.635], [61.964]`, load1max 17.8); passing run = `out010/tp7-1.log` (878/878, load1max 12.8; the gate's clobbered loop variable named the five runs tp7-1 x4 and tp7-10, so only the last tp7-1 console survived).

| event | failing | passing |
|---|---|---|
| phase fired (plan 1064.7) | 1067.7 | 1065.8 |
| touch-down delivered (inside a pump tick whose run-loop call lasts) | 1075.9 (tick 14.5 ms, rl 14.5) | 1076.6 (tick 15.7 ms, rl 15.7) |
| UIKit handling of the touch-down | 2.6 | 3.2 |
| product value written (inspection delivery) | 1085.9 | 1087.7 |
| vsync timestamps around the turn | 1073.2, 1089.9, 1106.5, 1123.2, 1139.9 | 1075.0, 1091.7, 1108.3, 1125.0, 1141.7 |
| touch-up delivered / handled | 1107.1 / 0.26 | 1108.9 / 0.29 |
| inspection after touch-up | 1114.6 (outside a tick) | 1116.7 (outside a tick) |
| run-loop call after touch-up (hand-over to minutes) | 25.6 ms at 1120.2 | 26.1 ms at 1122.4 |
| display-link callbacks after touch-up | none until 1149.2 (frames ~1123, ~1140 without callback) | none until 1151.5 (same two frames) |
| flush per tick in the turn | 0.01-2.1 ms | 0.01-1.9 ms |

Reading: the two turns have the same main-thread profile within 0.5 ms (the blocks are the 14-16 ms run-loop call of the touch-down and the 26 ms call of the touch-up, both product / UIKit work inside `CFRunLoopRunInMode`, not the tick's flush or read). What differs is the phase: in the failing run the vsync grid sits 1.8 ms earlier against the oracle clock while the inputs land 0.7-1.8 ms earlier, so the frame the t=1100 check reads (hand 118.6 vs web 120.9) and the next one (62.0) straddle the web value differently. The miss is a phase effect of where the display grid falls relative to the oracle clock, not of the sampler's cost.

EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-010-tp7-trace | ios26.3 | NativeTimePickerStatesIntegration dial-tap traced base, passing run | 878/878
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-010-tp7-trace | ios26.3 | NativeTimePickerStatesIntegration dial-tap traced base, failing run (explained: tap-hour-7 t=1100 hand, the miss under study, traced above) | 877/878

### Session 3 (2026-11-19) notes

**Job 011 (time picker dial-tap A/B rerun, ten alternating pairs, iPhone 26.3, exit 0):** base 5/10 runs with a miss (gate-valid 4/9, 7 FAIL lines), lite 5/10 (gate-valid 4/9, 15 FAIL lines); per-run values in the A/B table above. Fail kinds over both arms: `tap-hour-7 t=1100 hand` 9, `tap-hour-7 t=1133 hand` 4, `open t=266 mode-dial` 3, `open t=266 dialog` 3, `tap-minute-5 t=2033/2066/2099 hand` 1 each. So the 005 difference (8 vs 4) was noise: the lite sampler gives no gain on any subset (tp 5 vs 5, sel 2 vs 7 worse, tb 1 vs 0, tf 10 vs 10).

**Canonical unchanged (session 3):** `md5sum -c s937-lab/canon-md5-before.txt` in `work/awc-native`: 8 of 8 files OK (AppKitShim.swift 30db5861..., build-awcui.sh, run-fixture.sh, the four states tests, NativeInspection.swift); `AWCTickProbe` occurs 0 times in canonical Shim/Sources/Tests. Nothing was installed; no main-queue job was queued by this story.

**Platforms:** this story is iOS-simulator only by its scope (harness pump of the iOS states tests); no macOS or Android code was changed, so there is no macOS or Android evidence to give. AC 5's canonical-install clause does not apply: by the intent contract nothing is installed.

**Table for the coordinator (coordinator decision):**

| subset | pump main-thread share base -> lite (004) | runs with a miss base / lite (ten pairs) | mutation +33 ms with lite (009) |
|---|---|---|---|
| time picker dial-tap | 95 % -> 26 % | 5/10 / 5/10 (011) | 3/3 fail |
| select keyboard-ltr | 82 % -> 14 % | 2/10 / 7/10 (006) | 3/3 fail |
| table sort-ltr | 85 % -> 12 % | 1/10 / 0/10 (007) | 3/3 fail |
| text field filled-ltr | no flush in its pump | 10/10 / 10/10 motion lines, final 194/194 (008) | 3/3 fail |

Recommendation: do not install the lite sampler. It frees the main thread but does not reduce the misses, and it makes select worse (its opacity frame commits one frame later without the flush). The misses come from 14-26 ms UIKit/product run-loop calls in the input turn and from the phase of the vsync grid against the oracle clock (job 010), not from the sampler's cost.

EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-011-ab-tp-r2 | ios26.3 | NativeTimePickerStatesIntegration dial-tap A/B base, runs without a miss (explained: A/B count, 5 of 10 runs with a miss: tap-hour-7 hand / open t=266) | 5/10
EVIDENCE | 9-37-ios-states-harness-sampling-pump-main-thread-cost-011-ab-tp-r2 | ios26.3 | NativeTimePickerStatesIntegration dial-tap A/B lite, runs without a miss (explained: A/B count, 5 of 10 runs with a miss: tap-hour-7 hand / open t=266 / tap-minute-5) | 5/10

## Review Triage Log

