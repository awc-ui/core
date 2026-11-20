---
title: 'md-text-field iOS: tab-out, blur, press-focus and required-validity motion fail on one late frame in 1 to 4 checks per run (S918-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d4 · no Android lane · simulators AWC-d4 (iPhone 26.3) and the iOS 18.6 simulator that story 9-18 used on lane d4 (both exist)'
lab: 'work/s920-lab (create it; private tree work/s920-tree = a copy of canonical taken after the installs of stories 9-18, 9-6 and 9-17; the runs and logs of story 9-18 are in work/s918-lab)'
depends_on: ['9-18-text-and-number-field-states-suites-stale-frames', '9-17-ios-rtl-outlined-field-notch-wrong-side']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-18 installed the carry fix in the TextField and NumberField states suites and left one finding open (DEFECTS.md S918-01). On canonical the TextField states suite fails 1 to 4 checks per run on the iPhone simulator: iPhone 26.3 three runs with 4, 2 and 1 FAIL lines, iOS 18.6 one run with 3 FAIL lines (job 9-18-009). The failing checks are motion checks of `tf-focus-type-blur-filled-ltr` (tab-out and blur, press-focus) and of `tf-required-validity` (focus and blur): one native frame at about t=50 ms is behind the Web value. The misses were there before and after the carry fix (jobs 9-18-005 and 9-18-006), they change from run to run, and one run of story 9-10 passed 2048/2048 (job 111). macOS and NumberField pass. The gate-7 re-check 7-14 cannot pass md-text-field on iOS while a run has FAIL lines, and nobody has measured whether the late frame is in the product or in the test.

**Approach:** Rate first: the TextField states suite 10 times on iPhone 26.3 and 5 times on iOS 18.6 on canonical, in timing slots, with the failing checks listed by name per run. Then one frame-level trace for each kind of failing check (tab-out, blur, press-focus, required-validity): the time the input arrived in the app (for Tab the HID key arrival from `AWCShimTouch.keyArrivals`, on canonical since 11-17 06:07 UTC; for a press the delivery of the touch), the time of the first changed frame, and the Web times of the same phase. Rule out the test-side causes that other stories measured this week, each of which gives a frame that is one frame late or early: the phase start is anchored on something other than the arrival of the input (story 9-6, jobs 143 to 146; the OTP suite now reads `keyArrivals`); the first-responder hop between two fields (story 6-6, KNOWN-CAUSES rows 21 and 23); `AWCShimTouch.onScreen` pumping frames inside the release call (story 9-14, job 012). A cause in the suite gets a suite fix plus a mutation run in which the start of the product's transition is delayed by one frame and the check fails. A cause in the product gets a fix in `NativeTextField.swift`, with the check failing before and passing after. The OTP suite has the same kind of miss on a first attempt (Tab-out, record of story 9-6): say whether your cause explains it, but do not edit the OTP files.

## Boundaries & Constraints

**Always:** After the change the TextField states suite has 0 FAIL lines in 10 runs on iPhone 26.3 and in 5 runs on iOS 18.6 on canonical, macOS passes three runs, NumberField and OTP counts are unchanged, and the mutation run fails. The rules in project-context.md apply. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, skip a case, add a retry, an attempt loop or a delay. Do not change the Web fixtures. Do not edit `apps/native-ios-parity/Shim/AppKitShim.swift` on canonical; if the cause is in the shim, keep the change in the private tree and report it in the open items. Do not edit the OTP sources or the OTP suite. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S918-01 and the two status lines of story 9-18 below it; C96-01
- the Dev Agent Record of story `9-18` (jobs 005, 006, 008, 009 and how the suite is run on lane d4) and of story `9-6` (jobs 143 to 146: phases anchored at the HID arrival)
- `NativeTextFieldStatesIntegration.swift` and `NativeTextField.swift`; find them with `ls -R packages | grep -i TextField`
- `apps/native-ios-parity/Shim/AppKitShim.swift` -- `AWCShimTouch.keyArrivals` (read only); `work/claude-runner/KNOWN-CAUSES.md` rows 21, 23 and the lines of stories 9-6, 9-10 and 9-14

## Tasks & Acceptance

**Execution:**
- [ ] Rate on canonical: TextField states 10 runs on iPhone 26.3 and 5 runs on iOS 18.6; the failing checks by name per run
- [ ] One frame-level trace per kind of failing check with the arrival time of the input, the first changed frame and the Web times; the test-side causes ruled in or out with numbers
- [ ] The fix in the private tree (suite or product); for a suite fix the mutation run that fails; TextField states 10 runs on iPhone 26.3, 5 on iOS 18.6 and 3 on macOS after the fix
- [ ] Regression once on iPhone 26.3 and macOS: NumberField states, OTP states, TextField paint; the suites of the other users of a changed shared source
- [ ] One main-queue install as an anchored patch (dry run, rollback, byte identity); the runs on canonical; a DEFECTS.md status line for S918-01; refresh and confirm the checkpoint of md-text-field; a KNOWN-CAUSES line for the cause

**Acceptance Criteria:**
- Given canonical after the install, when the TextField states suite runs 10 times on iPhone 26.3 and 5 times on iOS 18.6, then no run has a FAIL line, and the record has the rate before the change
- Given a fix in the suite, when the start of the product's transition is delayed by one frame, then the changed check fails; given a fix in the product, when the check runs on the tree before the fix, then it fails
- Given the OTP first-attempt misses of story 9-6, when a reader opens the Dev Agent Record, then it says with numbers whether the same cause explains them
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 06:36 UTC: the iPad is in scope (6 failing checks in 9-10 job 033))
- Scope extended to the iPad. Story 9-10 job 033 (`work/s910-lab/out/033`, simulator AWC-di-ipad, shim v5): TextField states on the iPad has 6 failing checks: `tf-focus-type-blur-filled-ltr press-focus` label font 12.67 vs 12.0, label y 33.90 vs 32.0 and motion 45 of 84 frames outside the envelope; `tab-out` motion 2 of 84; `tf-required-validity focus` motion 1 of 57; `tf-restrict-numeric-maxlength focus` motion 3 of 39. Story 9-15 job 012 saw 6 failing checks on the iPad before and after its change as well. The press-focus miss (45 of 84 frames, label not at its end values) is larger than one late frame: trace it first.
- Add to the rate and to the acceptance: the suite three times on an iPad 26.3 simulator (create one for lane d4 as PARALLEL.md describes, or use the lane's existing one), 0 FAIL lines after the change.

### Coordinator note (2026-11-17 08:49 UTC: class your misses with the gap trace of story 1-2 first)
- A measured cause from story 1-2 that may be yours too: in md-search every states miss on iOS lies in a block of the main thread at the press, `UITextField` `becomeFirstResponder` with `_reloadInputViews` (36 to 57 ms, jobs 071 to 074 of story 1-2). The gap rule of your suite allows about two frames of trailing, so a block of that length gives a miss in some runs and not in others, which is the shape of S918-01. Class your failing checks the same way before anything else: `work/n3-lab/search2/diag/gap-trace.py` and `fail-class.py` (copy them into your lab). Story 9-22 works on the order of work at the press for md-search (logical focus and transition start first, responder change behind the first commit); read its record before you choose a fix.

### Coordinator note (2026-11-17 09:06 UTC: KNOWN-CAUSES row 35 (first HID key of a process, about 560 ms))
- One more measured cause to check first, from story 6-2 (KNOWN-CAUSES row 35, job 037): the first HID key of a process makes UIKit create its keyboard object once, about 560 ms on the main thread. A phase that holds that first key loses most of its frames. The iPad press-focus miss of this story (45 of 84 frames) has that size: see with console timestamps whether it lies in the first key phase of the process. Story 6-2 tests a priming step in the shim (job 038); if it is confirmed, the coordinator opens a shim story for it. Do not add priming in your suite.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: `9-20-003-rate-iphone263` (09:43 UTC), `9-20-004-rate-ios186-ipad` (10:14 UTC). Running when the Mac went to sleep: `9-20-005-tree-diag-trace`. Still queued at the wake (they run now): none.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

### Coordinator note (2026-11-17 20:17 UTC: cause accepted; blocked until story 9-23 is installed)
- Your result is accepted as the cause record (job 008: 32 of 40 failing checks in a main-thread block of 30 to 59 ms that starts 0 to 15 ms after the input; rate before any change 4 of 10 clean on iPhone 26.3 and 2 of 5 on iOS 18.6). The block and the first-key creation are now the subject of the harness story `9-23-ios-harness-uikit-responder-block-and-first-key`. This story stays `blocked` until the coordinator writes here that the result of 9-23 is installed.
- Then, in this story: the runs on canonical (10 on iPhone 26.3, 5 on iOS 18.6, 3 on an iPad, 3 on macOS), the 6 FREE and 2 NONE checks of job 008 each with a cause, the DEFECTS line for S918-01 and the checkpoint. The iPad simulator: use an iPad device type that the installed runtime supports (`xcrun simctl list devicetypes | grep iPad`), as the other lanes did.
- The `tf-throttle-200 (reduced)` miss (12 against 13 events): write it into DEFECTS.md as its own finding with the numbers and the run names, for audit 7-14.

### Coordinator note (Coordinator decision 2026-11-18 21:24 UTC: unblocked; no harness install is coming; find the earliest blur signal in the product)
The 9-23 result is in (E report in its Dev Agent Record, Session 14) and nothing is installed from it: the harness helper added failures and is dropped, and the -O build changes nothing for the text field. So this story does not wait for an install any more. It is unblocked with this order. Set status in-progress.

Numbers you can rely on (iPhone 26.3; jobs 003, 004, 014, 015, 018 of 9-23). Tab-out: the key reaches the shim at 0; UIKit's resign bracket starts about 1 ms later and lasts 15 ms (12-21); the block around it is 28 ms (18-35); the product callback (NativeTextField.swift focusChanged, line 334) arrives 19-27 ms after the key; the first changed native frame 41 ms after the key (26-54). The motion timestamp rt.changeAt is set by the focusMark closure (line 700, also through earlyFocus/markFocused), that is, when the product handler runs. At the failing sample (t=50) the native value lags the Web by 2-19 ms, median 10. Final failures: 3 over 10 quiet runs, all tab-out. First focus of the process: 370-425 ms, fails attempt 1 in every run, passes attempt 2; story 9-23 will sample it (its task F); leave it alone until that result is in the 9-23 record.

Task 1 (product, private tree s920-tree; restore the suite from s920-lab/orig first). The product learns of a blur 19-27 ms after the key, after UIKit's resign has returned. Find the earliest signal that the product ITSELF can observe for the end of editing, the way earlyFocus/markFocused does it for the start (candidates: the end-editing notification or delegate call of the wrapped field, the resign of the responder; read how earlyFocus is wired and mirror it). Set the blur motion timestamp there. Never pass a time from the test or the shim into the product: a signal that only the harness can give is not a fix.
Short trial job: build plus the tab-out case once, printing the time from the key to rt.changeAt before and after the change.
Measurement: 10 alternating pairs (with, without) of the tab-out subset on iPhone 26.3; each run waits until the 1-minute load is below 20 (at most 15 minutes, 30 s steps, no artificial load) and prints load1max. Report per arm: runs with a final failure, FAIL lines, key to rt.changeAt, key to first changed frame.
Mutation: with the change in, a 33 ms delay of the blur motion start must fail in every run (3 runs).
If the final tab-out failures go to 0 of 10: continue with the story's tasks 3 to 5 as written (10 runs iPhone 26.3, 5 runs iOS 18.6, 3 macOS; NumberField, OTP and TextField paint once; one main-queue install; DEFECTS; checkpoint; KNOWN-CAUSES).
If they do not: do not install. For every attempt of the 20 runs, passing and failing, list the time from the key to the first changed frame and say whether a final failure is predicted by that time alone (threshold, number of attempts it gets wrong). End blocked with the words coordinator decision and that table.

Task 2, in your scope by acceptance criterion 1: the tf-throttle-200 (reduced) miss, 12 against 13 events (S918-01, 2 of 5 runs). Trace one failing and one passing run with the event times and say which event is missing and why (product timer, coalescing, or the test's timeline). Short trial first.

Task 3: the 6 FREE and 2 NONE checks of your job 008, each with a cause from the traces you have (9-23's Session 7 found that its earlier no-block class was the first focus of the process plus tab-out blocks of 17-29 ms under the old 30 ms threshold: check whether that covers yours).

Evidence runs print load1max; runs above 30 are a class of their own, neither for nor against. Escalation: if after the trial of task 1 you cannot find a product-side signal, set escalate with what you tried.

### Coordinator note (Coordinator note 2026-11-18 22:52 UTC: three invalid trial jobs; a job stops at the first failed build; build-only job before a long one)
Three trial jobs in a row gave no result (009: the DIAG print did not type-check and the logs were stale copies; 010: the patch failed on a second application; 011: exit 0 although the build had failed). Each cost a session and up to 40 minutes of lane time. From job 012 on, every job of this story must do all of this:
- stop at the first failed build: run the build, test its exit code, grep its log for `error:`, and exit non-zero with the first error line printed if either says failed; a job never reports exit 0 after a failed build;
- delete or rename the previous run logs of its out folder before the runs, so that a stale log can never be read as a result; print the modification time of the binary it runs;
- apply patches on a fresh copy of the tree (or make the patch script refuse a second application with a clear message).
Before a 40-minute job, queue a build-only job (a few minutes: patch, build, print `BUILD OK` or the error) and read it in the same session; queue the long job only after BUILD OK.
You have used 3 of 5 sessions. If job 012 is invalid too, set escalate with the build error; do not queue a fourth trial of the same kind.

### Coordinator note (Coordinator decision 2026-11-19 01:04 UTC: early-blur rejected; tab-out waits for story 9-37; do tasks 2 and 3 now)
Decision on job 013. Accepted as the record: the early-blur change does not help (runs with a final tab-out failure: 5 of 10 without it, 7 of 10 with it; key to rt.changeAt about 10 ms in both arms; key to first changed frame 24 to 39 ms in both) and it is not installed; take it out of the private tree. Your table also shows that no first-frame time separates failing from passing attempts (the best threshold gets 18 of 68 and 13 of 65 attempts wrong). So the tab-out miss has no proven cause yet, and it is not excused.
The tab-out part now waits for story 9-37 (it measures what the test's own sampling pump does to the main thread on the simulator and gives a time-resolved picture of one input turn: delivery, state write, end of the next commit, the tick's read). Do not run more tab-out measurements here until the coordinator writes its result into this story.
What you do in this run, because it does not depend on that. Set status in-progress.
Task 2: the tf-throttle-200 (reduced) miss, 12 against 13 events (S918-01, 2 of 5 runs with and 2 of 5 without fix 3). It is an event count, not a frame: trace one failing and one passing run with the time of every event of that case on the native side and in the Web trace; say which event is missing and why (a timer of the product that fires across the end of the case, coalescing of two inputs, or the test ending the case too early). Short trial job first; a job stops at the first failed build. If the cause is in the product, fix it in the private tree and show 10 runs of that case without a miss plus one changed-timer run that fails; if it is in the test's timeline, correct it with the count unchanged and show the same.
Task 3: the 6 FREE and 2 NONE checks of your job 008, each with a cause from the traces you have.
End of this run: blocked with the words coordinator decision (the tab-out part is still open) and the results of tasks 2 and 3 in Current state; if task 2 produced a fix, its regression table, not yet installed.

### Coordinator note (Coordinator note 2026-11-19 03:15 UTC: the 9-37 result for tab-out (pump not the cause; phase of the display grid; story 9-38))
Result of story 9-37 for your tab-out part (do not act on it in this run; finish tasks 2 and 3). The test's sampling pump is not the cause: a sampler without the forced flush gave the text-field subset motion lines in 10 of 10 runs in both arms (final checks 194 of 194 in all), and the other suites no gain either; nothing was installed. Its trace of one input turn (time picker) shows the same main-thread profile in a failing and a passing run; what differs is the phase of the 16.7 ms display grid against the oracle clock, on top of a native start that is later than Chrome's by the harness's delivery delay (8 to 11 ms after the planned time) plus UIKit and product work. That fits your table (no first-frame threshold separates failing from passing attempts). Story 9-38 now measures this for the text-field tab-out subset too and prototypes a comparison that does not depend on the phase, with the limits unchanged. Tab-out stays open and is not excused until the coordinator writes the 9-38 result here.

### Coordinator note (Coordinator decision 2026-11-19 03:43 UTC: tasks 2 and 3 accepted; install named 'text-field throttle replay window (test file only)' after three conditions; tab-out waits for 9-38)
Decision on tasks 2 and 3. Accepted: task 3 (39 of 40 failing checks lie in a main-thread block of 30 to 429 ms; the classifier's key collision is recorded) and task 2 as a correction of the test's replay model, under these conditions, which your next run fulfils before the install:
1. The record says in plain words: where the product closes the throttle window (file, line, why emit plus 201 ms), what the Web component does with a key that arrives 200.0 to 201 ms after the emit (from the Web source and its timer, and what the Web trace of this case shows), and why the old replay (window closed at t0 plus 200) could give 13 events for a product that is right. The expected count stays 12.
2. The mutation you ran is named: which product timer value was changed, to what, and the counts of the two failing runs. Add one more: the product timer shortened by 20 ms must fail too.
3. Then one main-queue install, named here: 'text-field throttle replay window (test file only)': dry run, backup in work/s920-lab, byte identity. After it on canonical: the tf-throttle-200 cases ten times on iPhone 26.3 (0 event-count misses), TextField states once on macOS, NumberField and OTP states once on macOS and iPhone 26.3 (they share the helper: say so if they do not).
4. DEFECTS: S918-01 and the tf-throttle-200 (reduced) finding to 'ready for re-check' with the job names; KNOWN-CAUSES rows (replay boundary; classifier key collision). The macOS OTP lines Backspace-x3 (1368 of 1370): name the finding they belong to; they are not part of this story.
5. Evidence lines by hand. Then set blocked with the words coordinator decision again: the tab-out part stays open until the coordinator writes the result of story 9-38 here, and the story's canonical runs (10, 5, 3, 3) follow after that.
Nothing else goes to canonical in this run.

### Coordinator note (Coordinator note 2026-11-19 06:43 UTC: first focus of the process is system work (9-23 task F); warm-up ruling; the repeat rule is decided with 9-38)
Result of 9-23 task F for the first focus of the process (text field, 390-425 ms): about 65 percent of the block is the main thread waiting in UIKit's keyboard task queue, the rest is becomeFirstResponder (59-76 ms); no AWCUI function is on the path (KNOWN-CAUSES row 40): system work, paid once per process. Coordinator ruling: such a cost may be paid before the measurement by a fixed, unchecked warm-up step at the start of the iOS fixture (the first focus of the product's own field, then blur), written in the test with its reason and recorded in the docs as a native difference; it is not a retry. The repeat of a failing case that the text-field suite has today is a different thing (it also discards other motion lines: 57 of 59 in 9-23's count); what happens to it is decided with the result of story 9-38. Not for this run: this run is only the named install of the throttle replay fix as the note of 03:1x UTC says.

### Coordinator note (Coordinator note 2026-11-19 09:30 UTC: the 9-38 result; the story waits for the user's answer)
Result of story 9-38 (jobs 013-020, iPhone 26.3 behind the load gate; nothing installed, canonical unchanged).
(1) Comparison at the delivered input (the Web sample time moved by the measured delivery delay d of the test's own input; window and tolerances unchanged). Text-field tab-out without a stall: 0 misses in 23 attempts against 5 in 26 in base; the phase boundary at 13.5/14.5 ms is gone. Every tab-out miss that remains follows a display-link stall of 56-60 ms (7 of 7). Select keyboard: runs with a miss 0 of 10 against 2 of 10 (arrowdown-open opacity). A 33 ms delay fails 3 of 3 in both subsets. A 17 ms delay in select is no longer caught (0 of 3; base catches it). d: select 0-7.2 ms, text-field tab-out 3.8-21.8 ms.
(2) Diagnostics on FAIL lines (display-link gap, delivery delay, phase, UIKit bracket). Classes over 15 lines: UIKit focus turn 5 (all text-field press-focus: gap 88-100 ms, bracket 63-69 ms); stall not from UIKit 0; grid phase 0; not classed 10 (text-field tab-out 6: gap 24-28 ms, d 9-18 ms; time-picker tap-hour-7 3: gap 43-49 ms with a bracket of 19-24 ms; table click-dessert 1: gap 58.5 ms, bracket 9.9 ms).
(3) Whether (1) or (2) goes into canonical is asked of the user first. Until the answer the canonical tests and the shim stay as they are, and no story uses AWC_CMP or AWC_DG outside a private tree. The patches and the class rule are in work/s938-lab/s4.
For this story: it stays blocked until the user's answer. If the answer to (1) is yes, story 9-38 does the install and the tab-out misses without a stall are closed by it. Press-focus then stays an open finding of the class 'UIKit focus turn' (system work, 63-69 ms inside the press turn); how a line of that class counts is the second question to the user. The repeat-on-fail rule of the suite is decided after the answer, not before.

### Coordinator note (Coordinator note 2026-11-19 18:59 UTC: the user answered; runs after the 9-38 install; how the class counts)
The user has answered both questions (2026-11-19).
(1) The comparison at the delivered input and the diagnostics of 9-38 are installed by story 9-38, which runs before this one. Do not start before its install is in canonical; then make your lab from canonical again.
(2) The class 'UIKit focus turn':
User decision (2026-11-19, asked in the conversation): a FAIL line of the class 'UIKit focus turn' is counted and reported, with the measurement that shows it comes from iOS, and is written into the audit as a native difference. It does not make the component FAIL.

How the class is decided (the rule is in claude-runner/PARALLEL.md, 'User decisions on classes'): per line, from the numbers on that line. The diagnostics must show that the main thread was inside UIKit's focus change (becomeFirstResponder, the keyboard task queue) for a bracket that covers the missed frame, and give the component's own share of that turn in ms. A line without that proof is not of the class and stays a finding. No list of check names is exempt, no limit is widened, nothing is retried. The audit gives: how many lines of the class in how many runs, the bracket in ms, and the lines that are NOT of the class as open findings.

For this story: after the 9-38 install, run the text-field suite on iPhone 26.3 x5, iOS 18.6 x3 and iPad x3 with the load rule applied. Class every FAIL line from its diagnostics. Tab-out misses without a stall should be gone; if one remains it is a finding. Press-focus lines that carry the proof are reported as the class above. Then verify_evidence (hard failures answered by hand) and review. The same suites for number field and OTP field belong to audit 7-14, not to this story.

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

### Coordinator note (Coordinator note 2026-11-20 07:01 UTC: slot.sh was not executable 06:52-06:59 UTC (and 02:47-02:50); runs in those windows have no result)
Coordinator fault, and what it means for your runs. tools/slot.sh was not executable in two windows today: from 02:47:30 to about 02:50 UTC and from 06:52:18 to 06:59:36 UTC (I swapped the script in from the device mount and the new file had no exec bit; restored by job 927, and the swap procedure now sets the mode). A run in those windows that called tools/slot.sh directly ended at once with 'Permission denied' (exit 126) and has NO result. An empty log is not a pass and not 'mutation not detected': count nothing from such a run, and repeat it. Find them with: grep -l 'slot.sh: Permission denied' in your lab's run logs. Calling it as 'bash tools/slot.sh' or directly both work again.

Yours: work/s920-lab/out023: the iOS 18.6 text field runs r1 to r5 did not run. Repeat them under a new job number before any rate is written for iOS 18.6.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator note 2026-11-20 09:04 UTC: relaunch; warm-up install named with conditions; tab-out is an offset to find (delivered input first))
Relaunch. Two things named in advance so that no round is lost.

1. The warm-up. If job 027 shows that the FAIL lines of the first case of the process (attempt 1, press-focus with a UIKit bracket of 62 to 107 ms) go away with a fixed, unchecked warm-up focus at the start of the iOS fixture, that is the proven class 'first focus of the process' and the install is named: 'text-field iOS fixture warm-up (test file only)'. Conditions: pairs with and without the warm-up on iPhone 26.3 (x4 is the trial; x10 for the claim) and x10 on iOS 18.6, x3 on the iPad, all in quiet minutes; the lines that go away are only first-case lines, and every other line is unchanged in rate; the +33 ms mutation of the focus motion still fails 3 of 3 on an iOS simulator with a line that proves the delayed code ran in the app that was measured; macOS states once. The warm-up must not check anything and must not touch a later case. One main-queue install (dry run, backup, byte identity); the story's other Always lines met or listed as open.
2. Tab-out filled-ltr (FAIL lines in 8 of 10 runs on iPhone 26.3 and 4 of 10 on iOS 18.6, bracket 0, about one frame): above 1 of 5, so not rule (e), and no bracket, so not the focus turn. It is an offset to find. From the lines you have (the 9-38 diagnostics are on them): the offset from the time stamp and from the delivered input, per run. If it is inside the window when measured from the delivered input, say so with the numbers: the text field test already compares at the delivered input for its open and focus steps, so say which steps of tab-out do not, and why. If it stays outside, give native against Chrome frame by frame for three failing attempts and end with the words coordinator decision.
3. Jobs: an iOS job takes the timing slot once, from boot to shutdown, under about 40 minutes (PARALLEL.md, 08:12); runs of 06:52:18 to 06:59:36 UTC have no result (out023 r1 to r5).

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 19 (2026-11-20 ~11:50 UTC): status in-progress. Canonical has the 9-38 install. Rate before change (jobs 022 iPhone x10, 025 iOS 18.6 x10, 026 iPad x3; Session 18 record below): press-focus FAILs = class UIKit focus turn (brk 62-116 ms); tab-out filled-ltr (iPhone 8/10 runs, iOS 18.6 4/10, iPad 3/3; brk=0, gap 16-27, d 6-20) is NOT a decided class.
- Job 026 (iPad x3) DONE: 2045/2048, 2048/2048, 2045/2050; FAILs tab-out (filled/outlined, ltr/rtl/dark, 1-5 of 84 frames, brk=0) and tab-back-in 3/84 brk 30.
- Job 027 (warm-up trial) is INVALID: its build failed (PCH module-cache path error: BTAG=-s920 dir was a copy of the canon build dir), the runs used an old binary. Fixed in 028: BTAG=-canon, a TFWARMUP print proves the patched binary, the job stops with BUILD FAIL on an error or missing proof; the whole job holds the timing slot once (common.sh SL_OVERRIDE, inner028.sh, quiet-load gate).
- IN FLIGHT: 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-028-warmup-trial-iphone263-x4 (lane d4; 1 run w263a + 3 runs w263b in s920-lab/out028). Read: grep -a "checks passed\|startUTC\|FAILS PER RUN\|FAIL:\|BUILD\|quiet gate" claude-runner/done/<job>.log; count TFWARMUP in out028/*/console.log.
- Observation (job 022 r2,r3 console): failing tab-out frames are indicator height 1.84 vs envelope 2.42..3.0 at t=56..66 (after the +d shift): native is AHEAD of Chrome by about a frame, not late; the suite shifts Chrome's samples by d (DLV, suite line ~318).
- NEXT: if 028 shows the first-case lines (tab-out filled-ltr, press-focus attempt 1) gone: x10 iPhone + 10 iOS 18.6 + 3 iPad runs with the warm-up tree, +33 ms focus mutation x3, main-queue install 'text-field iOS fixture warm-up (test file only)' (anchored patch, dry run, backup, byte identity), DEFECTS S918-01, KNOWN-CAUSES (add: PCH path error with BTAG copy of a build dir), checkpoint, verify_evidence, review. If tab-out remains: print native vs Chrome samples frame by frame for 3 failing attempts (DIAG patch in tree, short job), then status blocked with the words coordinator decision and the table.
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-026-canon-rate-ipad-x3 | iPad Pro 13 M4 | TextField states final checks run 1 | 2045/2048
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-026-canon-rate-ipad-x3 | iPad Pro 13 M4 | TextField states final checks run 2 | 2048/2048
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-026-canon-rate-ipad-x3 | iPad Pro 13 M4 | TextField states final checks run 3 | 2045/2050

#### Session 18 record (moved from Current state)
- Session 18 (2026-11-20 09:10 UTC): status in-progress. Canonical has the 9-38 install (shim md5 9055674f). Rule (e) needs <=1 of 5 runs per check over >=10 runs.
- Job 022 (iPhone 26.3 x10) DONE: finals 2048-2050/2050; FAIL lines in 9 of 10 runs: press-focus 9/10 (brk 62-100 ms, UIKit focus turn), tab-out filled-ltr 8/10 (brk=0, gap 18-24, d 6-19: NOT a decided class, rate >1 of 5), click-clear 1/10. All in the first case of the process.
- Job 025 (iOS 18.6 x10, canonical) DONE exit 0: finals 2046-2052 of same total, 3 of 10 runs without FAIL line (r6,r7,r8); FAIL lines per run 3,2,1,1,2,0,0,0,2,1. Types: tab-out filled-ltr motion 1-2/84 frames in r1-r4 (brk=0.0, gap 17-20 ms, d 16-20: one frame, not UIKit class; 4 of 10 runs), press-focus (brk 95-107 ms, UIKit focus turn, r1 had 40/84 frames + label font/y), tab-back-in 6/84 (r1, brk 4.5, n=0) and 3/84 on iPad r2 (brk 30).
- Job 026 (iPad Pro 13 M4 x3) RUNNING (r1,r2 done: 2045/2048 and 2048/2048; FAILs: press-focus brk 110-116, tab-out filled-ltr/outlined-dark/outlined-rtl brk=0 gap 16.7-23, tab-back-in 3/84 brk 30). 027-warmup-trial-iphone263-x4 queued behind it (unchecked warm-up of case 1, patch-warm.py; BUILD FAIL printed on error).
- NEXT: read with grep -a "checks passed\|startUTC\|FAILS PER RUN\| FAIL:\|BUILD" claude-runner/done/<job>.log. If 027 shows tab-out + press-focus gone in 4 runs: queue 10 iPhone + 10 iOS 18.6 + 3 iPad runs of the tree, +33 ms mutation x3, install warm-up (main queue, anchored patch, dry run, backup, byte identity), DEFECTS S918-01, KNOWN-CAUSES, audit, checkpoint, verify_evidence. If tab-out remains (brk=0, one frame, >1 of 5 runs): table of lines by class, finding, status blocked 'coordinator decision'.
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-022-canon-rate-iphone263-x10 | iPhone 26.3 | TextField states final checks (all runs 2048-2050 of same total) | 10/10
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-022-canon-rate-iphone263-x10 | iPhone 26.3 | TextField states runs without any FAIL line | 1/10
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-025-canon-rate-ios186-x10 | iOS 18.6 | TextField states runs without any FAIL line | 3/10
- EVIDENCE | 9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-025-canon-rate-ios186-x10 | iOS 18.6 | TextField states runs without a tab-out FAIL line | 6/10

#### Session 15/16 record (moved from Current state)
- Session 16 (2026-11-20 05:10 UTC): status in-progress. 9-38 install is in canonical (shim md5 9055674f...; checked). Handover 20:38 note: class FAIL lines by rule (e) 'one frame, rare' + 'UIKit focus turn' (PARALLEL.md item (a),(e)); FAIL lines now carry [DG gap d ph brk n] suffix.
- IN FLIGHT (lane d4, queued in this order, canonical tree, run via s920-lab/rate.sh; per-run fails in s920-lab/out02N/<tag>-NativeTextFieldStatesIntegration-rK/fails.full, start/end UTC in the log for the load-record lookup claude-runner/load/load-<day>.log):
  9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late-022-canon-rate-iphone263-x10 (out022), -023-canon-rate-ios186-x5 (out023), -024-canon-rate-ipad-x3 (out024; iPad device type may fail to create: see its log head).
- NEXT: read logs (grep -a "checks passed\|startUTC\|FAILS PER RUN" claude-runner/done/<job>.log). Build ONE table: check, runtime, k of n runs, shifted comparison (<=1 frame, from logged samples or per-failing-frame limit), mutation job (+33 ms, 3 of 3 on iOS sim; AWC_CMP/AWC_DG are in canonical tests; use a private tree copy for the mutation: patch product transition start +33 ms, see s920-lab/patch-t*.py for patterns). Class each FAIL line from its DG suffix and load of its minute (load log); lines of class 'UIKit focus turn' need brk covering the missed frame + component share. Rate class needs >= 10 runs per iOS runtime: add 18.6 runs to 10 if k>0. Then DEFECTS.md S918-01 line, KNOWN-CAUSES, audit doc native-differences list, checkpoint refresh (tools/checkpoint-refresh.py via main queue only if an install is needed; otherwise note), verify_evidence, status review.
- Not covered by classes = findings: >1 of 5 runs, >1 frame, wrong end state, macOS. Tab-out without stall should be 0 after 9-38.
- DONE and verified: install 'text-field throttle replay window (test file only)' (main job 9-20-019, dry run OK, backup s920-lab/backup-019, byte identity OK). After it on canonical: job 9-20-020 tf-throttle cases 10 runs iPhone 26.3 0 event-count misses; macOS TextField 2050/2050, NumberField 1549/1549, OTP 1368/1370 (known Backspace-x3, OTP suite's own finding); iPhone NumberField 1403/1403, OTP 1370/1370. Mutations: product window 240 ms fails 2/2 (job 016), timer shortened by 20 ms fails 2/2 (job 021, 13 vs 12).
- DEFECTS.md and KNOWN-CAUSES.md lines written (replay boundary; classifier key collision).
- Condition 1 (plain words): product closes the throttle window 1 ms after its end (TextFieldModel.swift AWCSearchEmitter.emit, throttleDue = now + (throttle+1) ms; flushDue() at NativeTextField.swift ~325 closes an expired window before an input); Web arms setTimeout(throttle) at the emit (md-text-field.tsx 766-777). Old replay closed at t0+200, so a native key at 200.1-201 ms gave a 13th event for a correct product. Expected count stays 12.
- EVIDENCE | 9-20-020-canonical-throttle-after-install | iPhone 26.3 | TextField states tf-throttle-200 runs without event-count miss | 10/10
- EVIDENCE | 9-20-020-canonical-throttle-after-install | macOS | TextField states | 2050/2050
- EVIDENCE | 9-20-020-canonical-throttle-after-install | macOS | NumberField states | 1549/1549
- EVIDENCE | 9-20-020-canonical-throttle-after-install | macOS | OTP states (known Backspace-x3) | 1368/1370
- EVIDENCE | 9-20-020-canonical-throttle-after-install | iPhone 26.3 | NumberField states | 1403/1403
- EVIDENCE | 9-20-020-canonical-throttle-after-install | iPhone 26.3 | OTP states | 1370/1370
- EVIDENCE | 9-20-021-throttle-mutation-short-2runs | iPhone 26.3 | TextField states, product timer shortened by 20 ms, runs failing the event count | 2/2

#### Session 12 record
- Session 12 (2026-11-19): status in-progress. Tab-out part waits for story 9-37 (coordinator 01:04 UTC). Nothing installed.
- Task 2 DONE in private tree s920-tree (suite fix only): cause = the suite's tfReplay closes the throttle window at t0+200, the product at emit+201 ms (1 ms grace). Fix: windowEnd = t + throttle + 1 (anchor `distinct(t, v); pending = false; windowEnd = t + throttle }`, file Tests/NativeTextFieldStatesIntegration.swift). Job 016: event-count miss base 1 of 10 runs, fix 0 of 10, mutation (product window 240 ms) fails 2 of 2 with "11 md events vs 12". The remaining `tf-throttle-200 focus motion` FAIL lines in every run are the first-focus-of-process attempt 1 (retried, passes attempt 2; counted 98/98), not the event count.
- Task 3 DONE (job 008 classification with fail-class2.py): see earlier record: 39 of 40 failing checks in a main-thread block 30-429 ms, 40th in 29 ms; the FREE/NONE = resign block of tab-out (31-40 ms), first focus of process (17+152 ms, 174+83 ms), first key (11+429 ms, row 35).
- IN FLIGHT: job 9-20-017-throttle-fix-regression (lane d4): clean tree with only the suite fix; macOS TF states x3, NumberField, OTP, TF paint; iPhone 26.3 NumberField, OTP, TF paint. Read: `grep -a "exit\|checks passed\|fails:" claude-runner/done/9-20-017-throttle-fix-regression.log | cut -c1-150`.
- 017 macOS part done (clean tree = canonical + the one suite fix): TextField states 2050/2050 x3, NumberField states 1549/1549, TextField paint 13088/13088; OTP states 1368/1370 (3 FAIL lines, Backspace-x3 motion 1/96 frames, in the OTP suite which does not use the changed file; the same OTP misses appear in 12+11+10 earlier logs of other stories: 1361 to 1369 of 1370). iPhone 26.3 part (NumberField, OTP, TextField paint) still running.
- EVIDENCE | 9-20-017-throttle-fix-regression | macOS | TextField states x3 (fix tree) | 2050/2050 each
- EVIDENCE | 9-20-017-throttle-fix-regression | macOS | NumberField states | 1549/1549
- EVIDENCE | 9-20-017-throttle-fix-regression | macOS | TextField paint | 13088/13088
- EVIDENCE | 9-20-017-throttle-fix-regression | macOS | OTP states (suite untouched, known Backspace-x3 motion misses) | 1368/1370
- NEXT: if 017 is clean, write its EVIDENCE lines and stop blocked with the words coordinator decision (tab-out open; the suite fix awaits an install together with the tab-out result). Tasks 3 to 5 of the story (10+5+3 runs on canonical, install, DEFECTS, checkpoint, KNOWN-CAUSES: classifier key collision, replay grace) remain.
- EVIDENCE | 9-20-016-throttle-fix-10runs | iPhone 26.3 | TextField states tf-throttle-200 event count, runs without the miss, base (before fix) | 9/10
- EVIDENCE | 9-20-016-throttle-fix-10runs | iPhone 26.3 | TextField states tf-throttle-200 event count, runs without the miss, fix | 10/10
- EVIDENCE | 9-20-016-throttle-fix-10runs | iPhone 26.3 | TextField states mutation (product window 240 ms), runs failing the event count | 2/2
- EVIDENCE | 9-20-015-trial-throttle-trace | iPhone 26.3 | TextField states, tf-throttle-200 (reduced) 12 vs 13 events, runs without the miss (before the fix) | 2/4
- EVIDENCE | 9-20-008-tree-gap-trace | iPhone 26.3 | failing motion checks paired with their own GAPS line (fail-class2.py), checks in a main-thread block >= 29 ms | 40/40

#### Session 11 record
(replaced by the block above)

#### Session 9 record (task 1, kept from the earlier Current state)
- Session 9: status blocked, coordinator decision needed. Task 1 result (job 013, iPhone 26.3, 10 alternating pairs): the early-blur signal (blurEarly: should-end-editing -> focusChanged(false)) does NOT remove the tab-out final failures. Runs with a final tab-out failure: off 5 of 10 (7 cases: runs 1,3,4,5,7; case counts 3,1,1,1,... see table), on 7 of 10 (runs 1,2,3,4,5,9,10). Not installed. The mutation run was not made (the change has no effect).
- Cause: key to rt.changeAt is already ~10 ms in both arms (should-end-editing already sets it); key to first changed native frame 24-39 ms in both arms, gated by the ~28 ms UIKit main-thread block after the key (not by the product signal).
- 20-run table (non-reduced tab-out attempts, key to first changed frame, ms; F = failed attempt (final or retried), P = passing final). off: 68 attempts, 26 F, 8 final-fail cases. F: 31..38 (median 34); P: 24..35 (median 31). Best single threshold (>=33 predicts F) gets 18 of 68 attempts wrong. on: 65 attempts, 22 F, 7 final-fail cases. F: 25..39 (median 34); P: 24..35 (median 31). Best threshold (>=36) gets 13 of 65 wrong. So the first-frame time alone does not predict a final failure: passing attempts at 31-35 ms overlap failing ones at 31-36 ms.
- Not done: Task 2 (tf-throttle-200 reduced 12 vs 13 events; seen again in job 013 on1: events 7-11 shifted, mdInput abcdefg/abcdefgh vs abcdef), Task 3 (6 FREE/2 NONE), story tasks 3-5. No product change installed; private tree s920-tree holds the blurEarly patch (patch-t1.py), restore from s920-lab/orig.
- Next (after coordinator decision): tabulation script s920-lab/tbl013.py (run in s920-lab/out013); then Task 2 trace short trial, Task 3 with the DIAG20 lines.
- EVIDENCE | 9-20-013-ab-10pairs | iPhone 26.3 | TextField states tab-out, runs without final tab-out FAIL, off arm | 5/10
- EVIDENCE | 9-20-013-ab-10pairs | iPhone 26.3 | TextField states tab-out, runs without final tab-out FAIL, on arm (blurEarly) | 3/10
- EVIDENCE | 9-20-012 | iPhone 26.3 | TextField states, key to rt.changeAt on vs off (no change, ~10 ms) | 1/1

## Review Triage Log



---
Note from story 9-23 (2026-11-19, jobs 9-23-014..021, record: 9-23 Dev Agent Record): tab-out blur reaches the product 19-27 ms after the key (job 015); the UIKit resign bracket is 12-21 ms inside a block of 18-35 ms; -O build changes nothing (018); delivered-input anchor would remove only the 19-27 ms. Product clock: NativeTextField.swift focusChanged(_:) and the focusMark closure (changeAt). First press of the process is a 370-425 ms system block (UIKit keyboard task queue wait, job 020), hidden by the suite's repeat. Find the earliest signal the product can observe for the blur.
