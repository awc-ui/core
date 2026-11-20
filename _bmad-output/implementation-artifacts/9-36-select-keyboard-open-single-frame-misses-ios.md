---
title: 'md-select and md-autocomplete on the iOS simulators: single frames miss after a hardware key or click opens the menu (S61-IOS-01, S66-18-01, OPEN-131a, OPEN-131b)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-36-select-keyboard-open-single-frame-misses-ios'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n5 · no Android lane · simulators AWC-n5 (iPhone 26.3) and AWC-n5-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist'
lab: 'work/s936-lab (create it; private tree work/s936-tree = a copy of canonical; story 9-29 kept its scripts and the out folders of jobs 030 to 033, 071 to 076 and 131 in work/s929-lab; the UIKit bracket hooks (BRK) are in work/s923-lab; the sample recipe is job 028 of story 9-16 and the sample jobs of story 9-32)'
depends_on: ['9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `NativeSelectStatesIntegration` on the iOS simulators misses single frames after a hardware key opens the menu (S61-IOS-01, S66-18-01): the keyboard subset has a miss in 8 of 10 runs on iPhone 26.3 and in 8 of 10 on iOS 18.6 (jobs 073 and 074 of story 9-29). Job 131 (select-keyboard-rtl ten times with UIKit bracket hooks): 1817 of 1820; the open write comes 3 to 9 ms after the key (once 18 ms); the first changed frame 49 to 119 ms after the key, and that time does not predict a miss; the three misses are a blank frame at t=83 (OPEN-131a) and a reduced-motion enter opacity at t=33, twice (OPEN-131b). Also open in autocomplete: job 078 run 4 (reduced escape opacity t=33) and job 079 run 1 (ac-multiple-ltr click-open motion t=149). Tried without effect: the open clock started at the key handler (jobs 073, 074) and an optimised build (job 076). Main-thread blocks of 39 to 130 ms in the delivery turn have the same length in passing runs, so they explain nothing by themselves. Two facts from other stories: the first `AccessibilityNotification.post` with an AttributedString costs 25 to 37 ms on the main thread once per process (story 9-16; `NativeMultiSelect.swift` line 876, `NativeAutocomplete.swift` line 713 and `PopupScope.swift` post announcements); story 9-32 measures what runs inside the harness's input call.

**Approach:** Read the result of story 9-32 first (who uses the time inside the input call) and the KNOWN-CAUSES row of story 9-16 about the announcement. Then, with a short trial before each long job: sample the main thread of the fixture process at 1 ms around the key of select-keyboard-rtl (iPhone 26.3) and split the samples of the turn into the shim's own waiting, UIKit delivery, AWCUI functions (top five by name), SwiftUI update and render, accessibility posts. Make a per-frame capture of the two kinds of miss, each next to a passing attempt: for the blank frame at t=83, what is on screen in that frame (an empty popup layer before its content, a frame from before the open, a dropped commit); for the reduced-motion enter opacity at t=33, when the reduced-motion path sets its opacity and what the Web does at that time. Class each miss and fix what is product in the private tree; a fix needs ten alternating pairs and a 33 ms mutation that fails.

## Boundaries & Constraints

**Always:** With the fixes in the private tree the select keyboard subset has no miss in ten runs on iPhone 26.3 and in ten on iOS 18.6, autocomplete states have no motion miss in five runs on iPhone 26.3, and the 33 ms mutation fails in every run; or the story ends blocked with the class table. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, add a retry or a delay, or move a miss into a known-gap list. Do not pass a time from the test or the shim into the product. Do not change `AppKitShim.swift` or `scripts/build-awcui.sh`: report instead. Do not touch the caret clock (story 9-34) or the flat-pixels check (story 9-35). Regression before the install. Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-29` (Session 3 and 4 class tables; jobs 030 to 033, 073, 074, 076, 131) and of stories `9-16` (announce cause, job 028) and `9-32` (input-call split)
- `packages/native-ios/Sources/AWCUI/NativeSelect.swift`, `NativeMenu.swift`, `PopupScope.swift`, `NativeAutocomplete.swift` and the select and autocomplete states tests
- `work/audit/DEFECTS.md` -- S61-IOS-01, S66-18-01 and the lines of job 131; `work/claude-runner/KNOWN-CAUSES.md`

## Tasks & Acceptance

**Execution:**
- [ ] The sample split of the open turn for a failing and a passing attempt on iPhone 26.3
- [ ] Per-frame capture and class of the blank frame at t=83 and of the reduced-motion enter opacity at t=33, each next to a passing attempt
- [ ] The fixes in the private tree, each with ten alternating pairs and a 33 ms mutation that fails
- [ ] Regression in the private tree: select, multi-select, autocomplete and menu states on macOS once, iPhone 26.3 x3, iOS 18.6 x2
- [ ] One main-queue install (dry run, backup, byte identity); the keyboard subset x10 per runtime on canonical; DEFECTS.md status lines; KNOWN-CAUSES.md rows; refresh and confirm the checkpoints of md-select and md-autocomplete

**Acceptance Criteria:**
- Given each open single-frame miss, when a reader opens the Dev Agent Record, then it has a per-frame capture next to a passing attempt, a class and the fix or the reason why none exists
- Given canonical after the install, when the select keyboard subset runs ten times on iPhone 26.3 and ten times on iOS 18.6, then no run has a miss, or the story ends blocked with the words coordinator decision and the table
- Given a fix, when the open motion is delayed by 33 ms, then the suite fails in every run of three
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 09:30 UTC: the 9-38 result; start with the stall of the menu open)
Result of story 9-38 (jobs 013-020, iPhone 26.3 behind the load gate; nothing installed, canonical unchanged).
(1) Comparison at the delivered input (the Web sample time moved by the measured delivery delay d of the test's own input; window and tolerances unchanged). Text-field tab-out without a stall: 0 misses in 23 attempts against 5 in 26 in base; the phase boundary at 13.5/14.5 ms is gone. Every tab-out miss that remains follows a display-link stall of 56-60 ms (7 of 7). Select keyboard: runs with a miss 0 of 10 against 2 of 10 (arrowdown-open opacity). A 33 ms delay fails 3 of 3 in both subsets. A 17 ms delay in select is no longer caught (0 of 3; base catches it). d: select 0-7.2 ms, text-field tab-out 3.8-21.8 ms.
(2) Diagnostics on FAIL lines (display-link gap, delivery delay, phase, UIKit bracket). Classes over 15 lines: UIKit focus turn 5 (all text-field press-focus: gap 88-100 ms, bracket 63-69 ms); stall not from UIKit 0; grid phase 0; not classed 10 (text-field tab-out 6: gap 24-28 ms, d 9-18 ms; time-picker tap-hour-7 3: gap 43-49 ms with a bracket of 19-24 ms; table click-dessert 1: gap 58.5 ms, bracket 9.9 ms).
(3) Whether (1) or (2) goes into canonical is asked of the user first. Until the answer the canonical tests and the shim stay as they are, and no story uses AWC_CMP or AWC_DG outside a private tree. The patches and the class rule are in work/s938-lab/s4.
For this story: start with the product side, which waits for nobody. The select menu open holds a main-thread stall of 65-95 ms on iOS (numbers in stories 9-23 and 9-29). Bracket the component's own work in the open turn (menu build, layout, the focus call, the announcement post, the first motion write) and print each bracket per attempt, for attempts that miss and attempts that pass. A stall the component causes is a product cause to fix in your private tree, with ten alternating pairs and the 33 ms mutation as proof. The arrowdown-open opacity miss (2 of 10 base runs) disappears with (1), but (1) is not installed: do not count on it and do not copy it into canonical. Use the diagnostic of 9-38 in your private tree if it helps. Short trial job first (build and one case).

### Coordinator note (Coordinator correction 2026-11-19 15:25 UTC: simulators are shut down on exit as before; the no-shutdown line of 14:10 is withdrawn)
Correction of a coordinator rule. At 14:10 UTC I wrote into PARALLEL.md (and into some notes) that a job must not shut its simulator down at the end. That was wrong: it contradicts the rule of 2026-10-31 (every job that boots a simulator shuts it down on exit; never more than one booted simulator per fork), which exists because the Mac ran out of file descriptors and had to be rebooted, and it would stall the labs that wait until no simulator is booted. The line is withdrawn in PARALLEL.md. Shut your simulator down on exit as before (trap on EXIT). If you took a shutdown line out of a job script or a lab common since 14:10, put it back before you queue the next job, and say in your report that you did. The other new line under Load discipline stays: a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported.

### Coordinator note (Coordinator note 2026-11-19 16:34 UTC: relaunch; prewarm dropped; iOS 18.6 misses the same two checks with the same values: one table, then class or fix)
Relaunch after the session limit; job 006 (iOS 18.6 pairs) is waited for first. What stands: on iPhone 26.3 the keyboard subset is clean at quiet load in both arms (10 of 10 each, 91/91), so the prewarm brings nothing and is dropped. On iOS 18.6 both arms miss 1 to 2 checks per run at quiet load, always the same ones with the same values (arrowdown-open and enter-open opacity at t=49: Web 0.81, native 0.40). A miss that returns in the same check with the same value is an offset to find, not noise: native is about two frames behind at that sample on iOS 18.6 only.
Next, in the private tree, on iOS 18.6:
(1) For ten attempts that miss and ten that pass (arrowdown-open and enter-open), print per attempt: the key time as delivered; the time of the first opacity write of the menu surface and of the first frame that shows it; the display-link gap after the key; the UIKit bracket inside it and which call it is (the diagnostic of story 9-38, work/s938-lab/s4, AWC_DG=1; private tree only); your own brackets for the SwiftUI mount and body of the menu surface and for focusFirst. One table.
(2) Class from the table. If the gap holds a UIKit focus bracket and no bracket of ours above 2 ms: class UIKit focus turn; then say whether the open motion could start before the focus move (the motion write in the key turn, the focus call after it) without losing a key typed right after the open: try it in the private tree with five alternating pairs, the 33 ms mutation, and a key test (a key typed 100 ms after the open must reach the menu, 8 of 8). If our own mount or body is the time: that is the product cause; fix it there. If neither: write the table and end blocked with the words coordinator decision.
(3) The two older lines of this story are still open and belong in the same table: the blank frame at t=83 and the reduced-motion enter opacity at t=33.
Load and simulators as in PARALLEL.md today (shut the simulator down on exit as always; class 'load' per failing check by the load of its minute).

### Coordinator note (Coordinator note 2026-11-19 18:59 UTC: 9-38 installs into canonical (rebase before your install); the class 'UIKit focus turn' is decided)
Two things changed today that touch your work.
(1) Story 9-38 installs into canonical: 'iOS states comparison at the delivered input (text field and select; test files only)' and 'iOS states diagnostics on FAIL lines (shim and four test files)'. The user agreed. The canonical shim changes. When 9-38 has written its paragraph into PARALLEL.md (files changed, new md5), rebase your lab on canonical before your own install; your pre-image check fails otherwise. Jobs that run now are not affected.
(2) The class 'UIKit focus turn':
User decision (2026-11-19, asked in the conversation): a FAIL line of the class 'UIKit focus turn' is counted and reported, with the measurement that shows it comes from iOS, and is written into the audit as a native difference. It does not make the component FAIL.

How the class is decided (the rule is in claude-runner/PARALLEL.md, 'User decisions on classes'): per line, from the numbers on that line. The diagnostics must show that the main thread was inside UIKit's focus change (becomeFirstResponder, the keyboard task queue) for a bracket that covers the missed frame, and give the component's own share of that turn in ms. A line without that proof is not of the class and stays a finding. No list of check names is exempt, no limit is widened, nothing is retried. The audit gives: how many lines of the class in how many runs, the bracket in ms, and the lines that are NOT of the class as open findings.

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-19 20:25 UTC: the class is not accepted yet; the separating proof first)
Ruling on the result of session 3 (class proposed: on iOS 18.6 the main thread is busy with cold SwiftUI/AttributeGraph type metadata in the menu mount turn after the key).

The class is NOT accepted yet. Two things in your own record speak against a cold cost: the two checks miss in every run with the same values, and the prewarm gave no gain. A class needs a cause that separates failing from passing.

One session, in this order:
1. The separating proof. In ONE process: arrowdown-open, close, arrowdown-open again; the same for enter-open. Ten processes on iOS 18.6. If the first open misses and the second passes, it is a first-use cost. If the second misses too, it is not, and the class is wrong: then find where the motion write sits against the mount in that turn (pairs, 33 ms mutation, the key test 8 of 8).
2. The same trace points on iPhone 26.3, where the checks pass: the time of the menu mount turn on both runtimes, so that the difference between the runtimes is a number.
3. The captures you did not take: the frame at t=83 and the reduced-motion enter opacity at t=33.
4. verify_evidence (hard failures answered by hand).

Then, if it is a first-use cost in the system's code on iOS 18.6 only: end blocked with these facts for the user: how many ms, in which calls, our own share in ms, once per process or at every open, and what a person sees (the first open of a select after the app starts comes one frame later on iOS 18). I ask the user whether that is a native difference to document. A warm-up in the fixture is not allowed for it (the warm-up rule covers the keyboard task queue of UIKit, not the first use of our own views), and the class 'UIKit focus turn' does not apply (no UIKit bracket).

Load: job 009 ran at load 89 to 968 in some runs. Class every failing check by the load of its minute (claude-runner/load/load-<UTC day>.log) and repeat runs with a 'load' miss. The timing pool is at 2. Build steps through tools/slot.sh build 2; boot the simulator inside the timing slot. After the install of story 9-38 rebase your lab on canonical.

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-20 05:46 UTC: relaunch after the 9-38 install; canonical x10 on iOS 18.6 in quiet minutes with the new diagnostics; the separating proof (same scenario twice in one process, ten processes); nothing installed)
Relaunch: story 9-38 has installed both of its changes into canonical at 05:01 UTC (the select states test now compares at the delivered input, and FAIL lines carry the diagnostics; new shim md5 9055674f405eb3d2ff7369fffbca7199; its PARALLEL.md paragraph says how to read the lines). Status in-progress.

1. Make a fresh private tree from canonical (or rebase work/s936-tree) so that your runs have the installed comparison and the diagnostics. First question, answered by one job: with canonical as it is now, select-keyboard on iOS 18.6 x10 in quiet minutes. Do arrowdown-open (t=83, t=116) and enter-open (t=49) still miss, and what do the new diagnostics print on those lines?
2. The separating proof of the note of 20:25 UTC, in the same job and boot: the same scenario twice in one process, ten processes. Table: process, first pass (fails), second pass (fails), the main-thread samples in the menu mount turn for each. If the first pass misses and the second never does, the cost is a first use: say whose (which types are instantiated: the component's own view types through the Swift runtime, or system types). If the second pass misses too, it is not a first use: an offset to find; go on with the per-frame capture you still owe (t=83 and the reduced enter t=33).
3. Quiet minutes: start each run only when the last line of claude-runner/load/load-<day>.log shows a load below 30 and boot=0 (wait up to ten minutes, then start anyway and mark the run); give load and boot of the minute for every FAIL line. Job 009 ran at loads of 89 to 968 and decides nothing. The timing slot is first come, first served since 02:47 UTC; one boot per job inside the slot; builds through tools/slot.sh build 2.
4. Do not install anything and do not add a warm-up yet. A first use of the component's own types is not covered by the class 'first focus of the process'. With the table of point 2 the question goes to the user (first open of a select in a process on iOS 18.6: one to two frames of its fade are lost once; native difference to document, or a fix to look for). End with the words coordinator decision and the table.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator note 2026-11-20 09:43 UTC: relaunch to pool job 013; table for the user (first select open in a process on iOS 18.6); no new diagnostics, nothing installed)
Relaunch to close the measurement; no new diagnostics.
1. Read job 013, pool the first pass and the second pass over the 20 processes on iOS 18.6 (and the 5 on iPhone 26.3), per check (arrowdown-open, enter-open): k of n for each pass, the size of each miss (how many frames without a native sample, the DG value on the line), and the load and boot of its minute.
2. If the second pass misses in 0 of 20: the finding is a cost of the first select open in a process on iOS 18.6. Write the table into the story and into the DEFECTS.md line as 'to decide by the user: first open in a process on iOS 18.6 (k of 20 processes, one to several frames of the fade lost once; second open 0 of 20; iPhone 26.3 0 of 5; prewarm gave no gain)'. Say from job 007/009 samples, in one sentence, whose types are instantiated in that turn (the component's own view types through the Swift runtime, or system types). End with the words coordinator decision. The per-frame captures of t=83 and of the reduced enter t=33 are not needed in that case.
3. If the second pass misses at all: it is not a first use; say so and go on with the per-frame capture.
Nothing is installed. No warm-up is added to the test: a first use of the component's own types is not covered by the class 'first focus of the process'; whether it is documented or fixed is the user's call.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 10 (2026-11-20, in-progress). Canonical untouched, nothing installed. s936-tree = canonical rebase + patches; shim md5 9055674f... = canonical.
- Done: job 011 (iOS 18.6 x10 processes, scenario twice): pass1 FAIL in 2 of 10 (p2 arrowdown-open t=59, p8 enter-open t=52), pass2 0 of 10. Job 012 (iPhone 26.3 x5, twice): 910/910, pass1 0, pass2 0 (all quiet=ok but p4 marked). Job 013 (iOS 18.6 x10 more): runs 1-6 done, 6 x 182/182, pass1 0 pass2 0; runs 7-10 in flight.
- Pool on 18.6 so far: pass1 2 of 16 processes, pass2 0 of 16. Not proven as first-use cost (miss rate 1 in 8, both in loaded-ish minutes); table 011 below.
- In flight (lane n5): 013-twice-x10b-ios186 (ends about 10:20 UTC).
- Next: when 013 done: grep 'RESULT\|per pass FAIL\|run .* start' claude-runner/done/9-36-select-keyboard-open-single-frame-misses-ios-013-twice-x10b-ios186.log; add EVIDENCE line; pool pass1 over 20 processes; write the coordinator decision text (first open of a select per process on iOS 18.6 loses 1-2 fade frames in about 1 of 8 processes, pass2 never; native difference to document, or fix) with table 011 + 013; run verify_evidence; set status blocked ("coordinator decision") or review.
- Not done: capture of t=83 and reduced t=33; any fix; 10 pairs/33 ms mutation; install.
- Table 011 (18.6; process: pass1 fails / pass2 fails; run load1max): p1 0/0 103; p2 1/0 39.9; p3 0/0 92; p4 0/0 52; p5 0/0 80; p6 0/0 61; p7 0/0 197; p8 1/0 199; p9 0/0 146; p10 0/0 115.
- Reuse: cp work/s936-lab/NNN.sh claude-runner/queue-n5/9-36-...-NNN-<desc>.sh. Bash 3.2. common.sh has quiet().
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-012-twice-x5-ios263 | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl twice in one process, 5 processes (canonical comparison, diagnostics) | 910/910
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-011-twice-x10-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl twice in one process, 10 processes (canonical comparison, diagnostics) | 1818/1820 (explained: pass1 arrowdown-open t=59 p2 and enter-open t=52 p8, pass2 none, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-009-shadow-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s2 (shadow marks) | 89/91 (explained: arrowdown-open t=83, enter-open t=49, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-010-trial-twice-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl twice in one process (trial, load1max 104) | 182/182
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-009-shadow-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s3 (shadow marks, load 517) | 87/91 (explained: load and cold metadata, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-009-shadow-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s4 (shadow marks) | 90/91 (explained: enter-open t=49, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-009-shadow-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s5 (shadow marks, load 968) | 89/91 (explained: load, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-007-marks-smp-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s1 (diagnostic, sampler) | 89/91 (explained: arrowdown-open t=83 and enter-open t=49, open class table)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-007-marks-smp-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s3 (diagnostic, sampler) | 91/91
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-009-shadow-ios186 | ios18.6 | NativeSelectStatesIntegration select-keyboard-rtl s1 (shadow marks) | 90/91 (explained: arrowdown-open t=83, open)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-004-prewarm-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl off1/on2/off2 (diagnostic, prewarm trial, sampler) | 91/91
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-001-ob-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl (private tree, brackets) | 91/91
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-002-sample | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl run 2 (private tree, sample) | 91/91 (explained: diagnostic run, sampler active)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-002-sample | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl run 3 (private tree, sample) | 90/91 (explained: arrowdown-open caret t=116, 4/56 frames; sampler active, diagnostic run)
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-003-smp2-trial | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl (private tree, in-process sampler) | 91/91
EVIDENCE | 9-36-select-keyboard-open-single-frame-misses-ios-005-pairs-ios263 | ios26.3 | NativeSelectStatesIntegration select-keyboard-rtl prewarm on vs off, 10 valid pairs (private tree, diagnostic) | 91/91 (20 valid runs clean; 1 off run 90/91 at load 49.6, class load)

## Review Triage Log

