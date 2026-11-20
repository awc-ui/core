---
title: 'md-menu: the states suite fails one motion frame or one flat-pixel sample in half of the runs on macOS and iOS (S7-6-02); named tests for two hooks (S7-6-03)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-27-menu-states-one-frame-misses-and-hook-tests'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d5 · no Android lane · simulators AWC-d5 (iPhone 26.3) and an iPhone on iOS 18.6 for lane d5 (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s927-lab (create it; private tree work/s927-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-6 and in claude-runner/done/s7-6-003-ios26.log, s7-6-004-ios18.log, s7-6-007*.log, s7-6-009-menu-states-x2-selection-x20-matrix.log)'
depends_on: ['7-6-recheck-checkbox-menu-sheets']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-6 (2026-11-17) kept md-menu (with item, group and sub-menu-item) at FAIL with finding S7-6-02 (DEFECTS.md, open and blocking, gate 5). `NativeMenuStatesIntegration` fails one check in 3 of 6 runs at ordinary load, a different case each time: macOS run 1 2523/2524 (`selection-keep-open click-plain-closes`: opacity at t=366, 1 of 18 frames; the native surface is at 0.99 for one frame where Chrome is at 0.70), iPhone 26.3 run 1 2523/2524 (`selection-keep-open click-checkbox`: flat pixels, shot 2 of 6), iOS 18.6 2523/2524 (`open-close-baseline-light click-anchor`: motion, 5 of 38 frames). The other runs are 2524/2524; story 6-1 recorded 2524 three times on macOS. Virtual 18/18, a11y 22/22 and paint 9092/9092 pass. The reviewer's reading of the macOS case is a repaint of the surface at full opacity for one frame before the close fade is applied; if that is what happens, a user can see it as a flash. Finding S7-6-03 (non-blocking, gate 1): the hooks `--md-menu-viewport-margin` and `--md-menu-section-gap` have no test that names them; they are only exercised through the paint fixture `menu-r4-paint.json`.

**Approach:** Reproduce first: the states suite ten times on macOS, ten times on iPhone 26.3 and five times on iOS 18.6 on a copy of canonical through `slot.sh timing`, with the Mac load at the start of each run; list the failing case and check of every failing run. Then capture per frame for the failing phases, in failing and in passing runs: the surface opacity (or the pixel under test), the time of the click as the harness reports it, the time of each native commit and the main-thread gaps (the gap trace of story 9-20, tree work/s920-tree, GapRec, for iOS; the same record on macOS as story 9-22 used for its block). Put the Chrome frames of the fixture next to them. Class every miss: a frame painted at full opacity before the fade is applied (product: apply the fade in the same commit as the state change), a first frame after the click that is late (say what runs before it; a block inside UIKit or AppKit that is not the product's code is the cause class of stories 9-23 and 9-22: report it with the numbers and do not move product code around it), or a flat-pixel sample taken during a commit (the suite samples at the wrong time). Fix what the measurements show. For S7-6-03 add one named case per hook with a non-default value to the menu appearance tests on iOS and Android and show both in the gate-1 matrix.

## Boundaries & Constraints

**Always:** The suite fails in at least 3 of 10 runs on one runtime before the change (the reviewer saw 3 of 6 over all runtimes) and passes 20 of 20 runs on macOS, on iPhone 26.3 and on iOS 18.6 after it; a build whose close fade starts 33 ms late fails after it. The rules in project-context.md apply.

**Never:** Do not widen a tolerance and do not add a retry. Do not change the select, multi-select or autocomplete sources (story 9-19 owns them); if the cause is in a source they share with the menu (popup, overlay, focus trap), name the file in the Handover before the install and run the select, multi-select and autocomplete states suites once on macOS and iPhone 26.3. Do not change AppKitShim.swift or AWCHarnessInput.swift.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S7-6-02 and S7-6-03 (near the end of the file)
- `work/claude-runner/done/s7-6-009-menu-states-x2-selection-x20-matrix.log` (lines starting with SUMMARY macos NativeMenuStatesIntegration), `s7-6-003-ios26.log`, `s7-6-004-ios18.log`; `work/audit/s7-6/gate1/matrix.log`
- the Dev Agent Record of stories `6-1` (menu part: how the suite is built and run, 2524 x3), `9-20` (gap trace) and `9-22` (macOS block record) and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-ios/Tests/NativeMenuStatesIntegration.swift`, the menu sources under `packages/native-ios/Sources/AWCUI` (find the paths with `ls | grep -i menu`) and the Android menu appearance tests (find them with `grep -rl md-menu-viewport-margin packages apps`)

## Tasks & Acceptance

**Execution:**
- [ ] Reproduce: the suite x10 on macOS, x10 on iPhone 26.3, x5 on iOS 18.6 with the load per run; failing case and check per run
- [ ] Per-frame capture with click time, commits and main-thread gaps for each failing phase and the same phase in a passing run; class every miss; name the cause (KNOWN-CAUSES.md row)
- [ ] Fix in the private tree; the suite x20 on macOS, x20 on iPhone 26.3 and x20 on iOS 18.6, once on the iPad; the 33 ms mutation fails; menu paint, virtual and a11y suites once
- [ ] Named tests for `--md-menu-viewport-margin` and `--md-menu-section-gap` on iOS and Android; the gate-1 matrix shows both
- [ ] One main-queue install (dry run, rollback, byte identity); the suite x3 on canonical per runtime after the install; DEFECTS.md status lines `ready for re-check` for S7-6-02 and S7-6-03; refresh and confirm the md-menu checkpoints

**Acceptance Criteria:**
- Given the menu states suite, when it runs twenty times on macOS, on iPhone 26.3 and on iOS 18.6 after the change, then every run passes, and every miss of the runs before is classed with a per-frame capture
- Given a build whose close fade starts 33 ms late, when the suite runs, then it fails
- Given the gate-1 matrix, when it is rebuilt, then both hooks have a test that names them on iOS and on Android
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-18 10:54 UTC - coordinator: relaunch; decide between a stale read and a real product frame with a pixel sample)
Relaunch after the session limit; job 007-mac-trace is in flight (the first session waits for it).
- The reproduction rate (macOS 1 of 10, iPhone 26.3 1 of 10, iOS 18.6 0 of 5) is lower than the audit's 3 of 6, but that changes nothing in the task: every miss is classed with a measured cause. 'Below 3 of 10' is not a reason to stop.
- Two readings are possible for 'one frame near full opacity in the middle of the fade' (macOS r6: 0.993 where Chrome has 0.70; iPhone r1: click-anchor opacity at t=233), and the trace must decide between them with two independent values of the same frame, the inspection value and a pixel sample of the surface:
  (1) the test reads a missing or stale inspection value (KNOWN-CAUSES row 27 class): then the pixels show the right opacity and only the read is wrong;
  (2) the product really paints one frame at the wrong opacity. Story 9-26 proved exactly this shape in md-checkbox today: the first render after the state flips drew the glyph at the end value before the animation start was set (KNOWN-CAUSES row of 9-26). Read that row and check the menu surface for the same pattern at open and at close (first render after the closing flag flips).
  A change of the test's read is allowed only for reading (1), with the pixel proof in the record; for reading (2) the fix is in the product source.
- If the full suite needs about 20 minutes per run, do not wait for all 15 traced runs once a traced miss has shown the cause. If the suite can run single cases, a loop of the two failing cases alone with the trace is a faster second source, but a class found only in full runs must be proven in full runs.
- Then as the story says: fix, 20 of 20 on macOS, iPhone 26.3 and iOS 18.6, the 33 ms mutation fails, the two hook tests of S7-6-03 on iOS and Android, one main-queue install with its dry run, DEFECTS.md, checkpoint, verify_evidence, status review. Do not change select-family sources.

### Coordinator note (Coordinator note 2026-11-18 19:41 UTC: Mac restarted; job 010 runs with exit 142; decide the release-overshoot hypothesis with data)
What happened. The Mac restarted at 18:56 UTC on 2026-11-18. Job 010-mac-x20 was terminated in run 9 (exit recorded as 143 by the coordinator). Its log shows mac-r1 to mac-r7 with exit 142 and r8 with exit 0. Exit 142 is the time limit of with-timeout: check first whether those runs were cut by the limit (duration, last line of each run log, load) before you count any of them as a pass or a fail. Jobs 011, 012 and 013 were still in queue-d5 and start when the lane is back; they carry the same limits, so read their first runs before you wait for all of them. Lanes and keep-awake are restored; simulators are not booted after the restart.

This run (3 sessions).
1. Decide hypothesis 3b with data: from the TRACE9-27 lines (down=, up=) of every miss and, with one short job, of 10 passing runs too (print the line always, not only on a miss), say whether up is well above 100 ms in the failing runs only. A cause that is the same in passing runs does not explain the failing ones.
2. If up is late only in failing runs: the fix is in the test timeline (native sample times anchored to the actual release), limit unchanged; then the +33 ms mutation of the close fade must fail in every run (3 runs) and x20 on macOS must be clean. If up is about 100 in the failing runs: the product still starts late; print where AWCMenuMotionSurface.start takes its time. Keep the mouse-up timestamp fix in the tree only if an alternating run (10 with, 10 without) shows that it removes misses; otherwise take it out before the install.
3. Requeue x20 on macOS with a time limit that fits a full run under load (say the measured duration of a full run and set the limit to twice that; the limit is not a tolerance), then iPad once, paint and accessibility once, remove the CLOSEAT print, one main-queue install (the hook tests of S7-6-03 and whatever fix survived), DEFECTS, checkpoint, KNOWN-CAUSES row, evidence lines by hand, verify_evidence.py.
End: review with 0 hard failures, or blocked with the words coordinator decision and the table (runs with a miss per runtime: before, with the mouse-up fix, with the timeline fix; up= in failing and in passing runs).

### Coordinator note (Coordinator note 2026-11-19 18:56 UTC: jobs 023-026 read; three kinds of misses on iOS 18.6; repeats; shared load record)
Jobs 023 to 026 are read. What they show and what the next sessions do.

1. Job 023 (macOS x20): 20 of 20 runs at 2524/2524. It stands.

2. Job 024 (iPhone 26.3 x20): 19 runs clean. Run 8 has one miss: 'keyboard-nav-ltr mdClose in phase 7 at +359 vs phase 7'. The load at the end of that run was 134.62. These jobs were queued before the load rule of 14:53 UTC (PARALLEL.md, 'Load and evidence'), so they give the load only at the end of each run. That is not enough to call the miss 'load': the rule asks for the highest load in the minute around the failing check. Repeat with the rule applied (load every 20 s, the value next to each FAIL line): iPhone x10. If the miss comes back in a quiet minute it is a finding with a cause to find.

3. Job 025 (iOS 18.6 x20): misses in 6 of 20 runs (1, 7, 11, 17, 19, 20). They are three different things. Do not put them in one class.
   a. 'selection-keep-open (reduced) click-checkbox' and 'click-radio' flat pixels at shot 3 (+591 to +594 of [550, 581, 592, 638, ...]; mean 0.153; about 4480 of 175956 pixels above 6) in runs 7, 11 and 17, and the same shot in 'selection-keep-open click-radio' in run 19. Four runs, the same check, the same shot, the same time; run 19 ended at load 17.67. A miss that repeats in the same check is an offset to find, not load. iPhone 26.3 passes this check 20 of 20. Find what is on the screen at +592 on iOS 18.6 and why (shot 3 comes 11 ms after shot 2): one diagnostic job, a short trial first. This is to be classed before any install.
   b. Run 1: 'open-close-baseline-light click-anchor motion 3/38 frames outside the envelope, opacity t=200 web 0.934 native 0.000, 0.809', load at the end 26. The iPad run of job 026 misses the same check (8/38 frames) at load 278. Every run is its own process, so this is the first open of the process in every run, and it missed once in 20 on iOS 18.6: not a constant first-use cost. Class it with the repeat (item 5); the iPad run is repeated in any case.
   c. Run 19 'selection-close-on-select click-checkbox-closes motion 1/18 frames, opacity t=399 web 0.881 native 0.851' (load at the end 17.67) and run 20 'submenu-hover-ltr mdClose in phase 3 at +629 vs phase 3' (load at the end 78.48). Say for each whether it is the class this story is about and which arm the run was (base or fix); give the pair table.

4. Job 026: the iPad run ended at load 278 (2523/2524): repeat it. The accessibility capture captured nothing although the job ended with exit 0: AWCLivePreview was not built in s927-tree (spawn ENOENT). Build AWCLivePreview in the snapshot before the accessibility job and read the capture, not the exit code (the same happened in 7-22). Repeat it.

5. Order: (i) the diagnostic for 3a, trial first; (ii) iPad run and accessibility capture again, with the build; (iii) iPhone x10 and iOS 18.6 x10 with the load rule applied. The timing pool is capped (tools/timing.cap) and heavy diagnostics go through the timing slot. Nothing is installed while a regression difference has no class. When the table with a class for every miss is reported, I name the install.

6. Load. The Mac is also used for other work (at 18:51 UTC a probe showed a Unity editor, a game build and Spotlight indexing among the busiest programs, next to our jobs). These are not ours and are not touched. There is now one shared load record, claude-runner/load/load-<UTC day>.log: a line every 20 s with the UTC time and the load; when the 1-minute load is 60 or more also the busiest programs. You may read the highest load in the minute around a failing check from it (print the UTC start time of each run) instead of sampling in the job.

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

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator decision 2026-11-20 02:10 UTC: the rule counts per check; the 33 ms test on iOS is not met by macOS; one trial of the macOS-width envelope; installs named with conditions)
Decisions on your three points, with the facts I read from your logs.

1. How the rule counts (item 2 of rule (e)): per check and per runtime, not per run. Job 025 (iOS 18.6, 20 runs, the tree as it is now after the density revert):
- selection-keep-open (reduced) click-checkbox flat pixels: runs 7, 11 = 2 of 20
- selection-keep-open (reduced) click-radio flat pixels: runs 11, 17 = 2 of 20
- selection-keep-open click-radio flat pixels: run 19 = 1 of 20 (the three together: 4 of 20 runs)
- selection-close-on-select click-checkbox-closes motion 1/18: run 19 = 1 of 20
- submenu-hover-ltr mdClose time (+629 against +566): run 20 = 1 of 20
- open-close-baseline-light click-anchor motion 3/38: run 1 = 1 of 20
Job 024 (iPhone 26.3, 20 runs): keyboard-nav-ltr mdClose time (+359 against +299): run 8 = 1 of 20.
'6 of 20' is the number of runs with any miss; three different kinds are in it. Item 2 holds for every line above. Job 030 (density arm) does not count: that tree is reverted.

2. Item 1 (at most one frame), per line, from the FAIL lines themselves:
- 3a: the best candidate is one level over the limit (worst 7.0 against 6; native [212, 203, 226], web [206, 197, 219]; the same in all four runs). Job 027 shows the layer moving 13 levels in 15 ms between two neighbouring shots, so a shot 1 to 2 ms earlier passes. Holds; write it this way.
- the two mdClose time lines: 63 and 60.x against the limit of 60. Hold.
- click-checkbox-closes t=399: web 0.8814 against native 0.851 + 0.03. Show from the logged samples that a shift of one frame passes.
- click-anchor on the first open (run 1; the iPad too, 8/38): NOT covered. The window around t=200 holds no native sample, only its two neighbours (0.000 and 0.809): more than 100 ms without a sample. See point 6.

3. The 33 ms test on iOS (item 3). The macOS result (job 022, 3 of 3) meets this story's own acceptance line, which names no runtime. It does not meet item 3 of the rule: the user's decision asks that the 33 ms test fails every time on an iOS simulator, and a user decision is not relaxed by the coordinator. Two things follow.
(a) For 3a job 032 mutated the wrong motion: in keep-open the menu does not close. The motion of 3a is the fade of the row's state layer after the click (194 to 214). Delay that by 33 ms; selection-keep-open, 3 launches, iOS 18.6. The candidate shots leave a hole of about 46 ms after shot 3 ([551, 581, 592, 638, ...]), so I expect it to fail; the job decides.
(b) For the motion and mdClose lines a close or an open delayed by 33 ms passes on iOS because of `late = 67.0` (line 340), as you found. Trial in the private tree only: `late = 34.0` on iOS, the macOS value. That narrows a limit; nothing is widened. Run: unmutated x10 on iPhone 26.3 and x10 on iOS 18.6 with the per-check table; close +33 ms and open +33 ms, 3 launches each on one iOS simulator (cases selection-close-on-select and open-close-baseline-light only).

4. The mdClose time lines were seen only with the fix (2 of 40 fix runs, 0 of 15 base runs; too few to tell). Before the install: the two cases (submenu-hover-ltr, keyboard-nav-ltr), 10 launches per arm (base, fix) on iOS 18.6, with a report-only print of the native and the Web time of mdClose. If the mean offset of the fix arm is later than the base arm by more than 8 ms, that is a regression difference: say where the time goes and whether Chrome's own mdClose carries the same two frames (the fixture's event times against its opacity samples). The limit of 60 ms stays.

5. Jobs. Put 3(a), 4 and 6 into ONE iOS 18.6 job (one boot) and 3(b) into one job per runtime. A short trial first for the new mutation and the new print. Build steps through tools/slot.sh build 2. The timing pool is at 2 and jobs wait for it: no job beyond these.

6. click-anchor on the first open of the process is the one line no class covers yet. In the iOS 18.6 job add 20 launches of open-close-baseline-light alone with the gap record of story 9-20 (GapRec) on. If a failing launch is caught, report what holds the main thread in the hole. If none fails in 20, report 0 of 20 next to the 1 of 20 of job 025 and write the line into DEFECTS.md as open and not covered, with its numbers; the audit decides on it. Not more than this one job on it.

7. Installs, named now so that no further round is needed when the conditions hold. ONE main-queue job (dry run, rollback, byte identity), anchored patches on canonical as it is at that time. 9-38 may have installed by then: rebase first, and if 9-38 touched one of your files run the menu states suite once on macOS and once on iPhone 26.3 after the rebase.
A. Name: 'menu: close at activation plus 150 ms, two-frame start, hook tests (product and tests)'. Conditions: point 4 shows no shift above 8 ms, or the shift is the Web's own; the regression in hand (023, 024, 025, iPad, paint, virtual, a11y, Android hook tests) with every line in the table of point 1. List the changed files in the Handover first. Say whether select, multi-select or autocomplete use the code you changed in MenuController.swift or MenuSupport.swift; if they do, run their states suites once on macOS and on iPhone 26.3 before the install (the story's own rule).
B. Name: 'menu states: iOS motion envelope at the macOS width (test file only)'. Only if 3(b) shows: unmutated, no check above 1 of 5 runs on either runtime and every miss within one frame; close +33 and open +33 fail 3 of 3. If not, B is not installed: report the per-check table, and I decide whether the comparison at the delivered input (the method of story 9-38) is asked from the user for the menu test. A is installed either way.
After the install: the suite x3 on canonical per runtime; DEFECTS.md (S7-6-02 with the table of the lines under rule (e): check, runtime, k of n, the one-frame numbers, the mutation job; S7-6-03 ready for re-check); KNOWN-CAUSES; md-menu checkpoints; verify_evidence. Then status review. If B is not installed, say plainly in DEFECTS.md which lines lack item 3; the audit will count them.

### Coordinator note (Coordinator note 2026-11-20 05:52 UTC: install A now; B by its trial; 3a is not covered by rule (e) and stays an open line; then review so that audit 7-21 can start)
Job 035 read from your summary: the mdClose offsets are clean in both arms (154/154 each over 10 launches, the fix arm under the 8 ms limit), the first open was not caught in 20 traced launches, and the +33 ms mutation of the row state layer fails only 1 of 3. Order of the rest, so that this story reaches review and the audit 7-21 can start (md-checkbox waits on that audit too):

1. Install A now; do not wait for the late = 34 trial. Its condition from point 4 of the 02:10 note is met. Rebase on canonical as it is (story 9-38 installed at 05:01 UTC; the time-picker test changed too: neither is your file, but check your patch anchors), list the changed files in the Handover, answer the shared-code question (do select, multi-select or autocomplete use what you changed in MenuController.swift or MenuSupport.swift; if yes, their states suites once on macOS and iPhone 26.3 first), then ONE main-queue job under the name 'menu: close at activation plus 150 ms, two-frame start, hook tests (product and tests)'.
2. Install B ('menu states: iOS motion envelope at the macOS width (test file only)') only if jobs 036 and 037 show what the 02:10 note asks (unmutated: no check above 1 of 5 on either runtime and every miss within one frame; close +33 and open +33 fail 3 of 3, each run with a line that proves the delayed code ran). If they do not, B is not installed and its table goes into DEFECTS.md.
3. 3a is NOT covered by rule (e): item 3 fails (the +33 ms mutation of the row layer passes 2 of 3; the candidate shots of the flat-pixels check span about 100 ms, so a layer that starts 33 ms late still finds a shot). Write it so in DEFECTS.md with the numbers: per check at most 2 of 20 on iOS 18.6, the best shot one level over the limit, the mutation result. Do not change the flat-pixels check and do not try the shot density again. What would make the suite see the layer's timing is a crossing-offset check for the row state layer, as the list and switch suites have; that is not for this story: I write the follow-up after the audit.
4. The first open (click-anchor, 1 of 20 in job 025, 0 of 20 traced): an open line with these numbers, not covered.
5. Then: the suite x3 on canonical per runtime in quiet minutes (start a run only when the last line of the load record shows a load below 30 and boot=0; wait up to ten minutes, then start and mark it), the iPad run and the accessibility capture with AWCLivePreview built, DEFECTS.md (S7-6-02: fixed on macOS with the numbers; the iOS lines as above; S7-6-03 ready for re-check), KNOWN-CAUSES, md-menu checkpoints, verify_evidence, status review.

### Coordinator note (Coordinator note 2026-11-20 07:01 UTC: slot.sh was not executable 06:52-06:59 UTC (and 02:47-02:50); runs in those windows have no result)
Coordinator fault, and what it means for your runs. tools/slot.sh was not executable in two windows today: from 02:47:30 to about 02:50 UTC and from 06:52:18 to 06:59:36 UTC (I swapped the script in from the device mount and the new file had no exec bit; restored by job 927, and the swap procedure now sets the mode). A run in those windows that called tools/slot.sh directly ended at once with 'Permission denied' (exit 126) and has NO result. An empty log is not a pass and not 'mutation not detected': count nothing from such a run, and repeat it. Find them with: grep -l 'slot.sh: Permission denied' in your lab's run logs. Calling it as 'bash tools/slot.sh' or directly both work again.

Yours: work/s927-lab/out037a: all ten l34 runs (l34-r1 to r10) and the close and open mutation runs (cm-r1 to r3, om-r1 to r3) did not run; out034/fix-r1 (02:48) neither. The late = 34 trial and its two mutations are therefore still to do: repeat job 037a as a new job number. Job 038 started after the repair. Do not decide install B from 037a.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

## Dev Agent Record

### Current state
- Session 10 (rules v5, in-progress). Lab work/s927-lab, tree work/s927-tree (fix: NativeMenu.swift 2-frame lead + MenuController requestedAt=activation+150; hook tests S7-6-03: virtual 24/24, Android JVM 2/2). Mac x20 20/20 (023); iPhone x20 19/20 (024); iOS 18.6 x20 14/20 (025); 035: 3a +33 not met, mdClose no regression, gap x20 0/20.
- Job 038 (iPhone 26.3, late=34 trial x10) DONE: 10 runs, 9 clean 2524/2524, r4 one miss selection-keep-open click-radio flat pixels shot 2/6 (class 3a) => 1 of 10, no other check.
- Job 039 (iOS 18.6, repeat of 037a: cm x3, om x3, l34 x10, out dir s927-lab/out039) IN FLIGHT: cm r1-r3 all fail (46/47 each, escape motion t=100 = proof line), om r1,r2 fail (r3 running), l34 x10 not started. Decide B from it: unmutated no check above 1 of 5 per runtime, misses within one frame; cm/om 3 of 3.
- Install A queued in MAIN queue: 040-install-menu-close-two-frame-hooks (script work/s927-lab/install927.sh; 6 pre-image md5 in install927-pre.md5; copies 7 files tree->canonical: MenuController/MenuSupport/NativeMenu.swift, NativeMenuVirtualIntegration.swift, NativeMenu.kt, NativeMenuSupport.kt, NativeMenuHookTest.kt (new)). Shared-code answer: NativeSelect/NativeMultiSelect/NativeAutocomplete do not use MenuController/MenuSupport/AWCMenuSurfacePlacement (grep: comments only); no select-family run needed. Canonical differed from tree in these files only by this story's hunks (checked by diff 2026-11-20 10:10 UTC).
- NEXT: read 040 (grep -a 'PRE-IMAGE\|DRY RUN\|BYTE IDENTITY\|INSTALL FAILED' done/9-27-...-040-*.log). Then B decision from 039; if B: install test-file change (late=34 in NativeMenuStatesIntegration, patch927.py mode late34 on top of canonical test, no DIAG927). Then x3 canonical per runtime in quiet minutes (new jobs via common2.sh vrun on a fresh canonical copy), iPad once + a11y capture (build AWCLivePreview), DEFECTS.md (S7-6-02 table; 3a and first-open click-anchor open, not covered), KNOWN-CAUSES row, checkpoint-refresh md-menu, EVIDENCE lines, verify_evidence.py, status review.
- Helpers: s927-lab/common2.sh (mktree, boot18, vrun TREE BUILDTAG "FXARGS" TAG RUNNO), patch927.py modes print|gap|mut|late34|closemut|openmut.

### Job 035 (iOS 18.6, one boot, read in session 6)
Layer+33 mutation x3 (keep-open): 1 of 3 fails (r1: click-radio flat pixel shot 4, the 3a density class), 2 of 3 clean: the 3a +33 test is NOT met. MCLOSE base vs fix x10: no shift above 8 ms. Gap trace x20 open-close-baseline-light: 0 of 20 miss (job 025 had 1 of 20); the click-anchor first-open miss is not caught (open, not covered, numbers 0/20 vs 1/20).
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-035-ios18-mut-print-gap-x | iOS 18.6 | NativeMenuStatesIntegration selection-keep-open (layer+33 mutation, 3 launches, 1 fails) | 119/120
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-035-ios18-mut-print-gap-x | iOS 18.6 | NativeMenuStatesIntegration submenu-hover-ltr,keyboard-nav-ltr (base arm x10, all clean) | 154/154
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-035-ios18-mut-print-gap-x | iOS 18.6 | NativeMenuStatesIntegration submenu-hover-ltr,keyboard-nav-ltr (fix arm x10, all clean) | 154/154
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-035-ios18-mut-print-gap-x | iOS 18.6 | NativeMenuStatesIntegration open-close-baseline-light (gap trace, 20 launches, 0 misses) | 23/23

### Session 8 note: class of 3a (iOS 18.6, selection-keep-open click-checkbox / click-radio flat pixels)
Job 027 (diag, 8 launches, AWC_MENU_ONLY=selection-keep-open, DIAG927 line per candidate shot). One of 8 launches misses (r4, click-checkbox, same check, bbox (9,51)-(118,96) = the checkbox row, 4487 px). Per-shot values at (25,67), web oracle [206,197,219] (one value, taken mid-fade):
- passing launch r2: native R by shot (+550..+636) 193,194,198,204,209,212 -> bad 4487,4487,4487,0,0,4487
- failing launch r4: +550 193, +575 194, +587 199, +602 212, +637 213, +654 214 -> no shot in the band 200..212 (the web value 206 +- 6)
The native row state layer fades 194 -> 214 over about 60 ms starting near +575; the band that passes is about 13 ms wide, the shots are 12..19 ms apart (render cost). So the miss is a SAMPLING class: the suite's native shot density is the size of the band. It is not a product frame at a wrong value (the native values are monotone and smooth) and not a stale read. The candidates are all the shots across the oracle-screenshot window, tolerance is unchanged; fix = denser candidate shots (every 8 ms target, taken as fast as the render allows). Check in 029.
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-027-diag-ios18-keepopen | iOS 18.6 | NativeMenuStatesIntegration selection-keep-open (diag, 8 launches, 1 sampling miss class 3a) | 7/8
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-023-mac-x20 | macOS | NativeMenuStatesIntegration (20 runs, final fix) | 2524/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-028-ipad-ax-rebuilt | macOS | tools/ax md-menu macos+web captures ok | 6/6

EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-022-mac-mutation | macOS | NativeMenuStatesIntegration selection-keep-open (+33 ms close, with final fix, 3 runs all fail) | 119/120
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-022-mac-mutation | macOS | NativeMenuStatesIntegration selection-keep-open (final fix, clean x2) | 120/120
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-022-mac-mutation | macOS | NativeMenuStatesIntegration selection-close-on-select (final fix, clean x2) | 48/48

EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-004-mac-repro | macOS | NativeMenuStatesIntegration (9 runs) | 2524/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-004-mac-repro | macOS | NativeMenuStatesIntegration (run r6, fail click-plain-closes) | 2523/2524

EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-030-ios18-x20-density | iOS 18.6 | NativeMenuStatesIntegration (20 runs, 8 ms density: 10 clean, 7 at 2523, 2 at 2522, 1 at 2521) | 10/20

## Review Triage Log
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-005-iphone-repro | iOS 26.3 | NativeMenuStatesIntegration (9 runs) | 2524/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-005-iphone-repro | iOS 26.3 | NativeMenuStatesIntegration (run r1, fail click-anchor) | 2523/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-006-ios18-repro | iOS 18.6 | NativeMenuStatesIntegration (5 runs) | 2524/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-008-hook-tests | macOS | NativeMenuVirtualIntegration | 24/24
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-011-iphone-x20 | iOS 26.3 | NativeMenuStatesIntegration (20 runs, fix) | 2524/2524
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-008-hook-tests | Android | NativeMenuHookTest (JVM) | 2/2
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-013-mac-mutation | macOS | NativeMenuStatesIntegration selection-keep-open (+33 ms close, 3 runs all fail) | 119/120

EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-033-typeahead-density-trial | iOS 26.3 | NativeMenuStatesIntegration typeahead (pre029 arm clean x2) | 272/272
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-034-trial-mut-gap-print | iOS 18.6 | NativeMenuStatesIntegration selection-keep-open (layer+33 mutation trial, 1 launch, not detected) | 120/120
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-034-trial-mut-gap-print | iOS 18.6 | NativeMenuStatesIntegration open-close-baseline-light (gap trace trial) | 23/23
EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-032-ios-mutation | iOS 26.3 | NativeMenuStatesIntegration selection-keep-open (+33 ms close, 1 of 3 fail: not detected) | 359/360

EVIDENCE | 9-27-menu-states-one-frame-misses-and-hook-tests-038-iphone263-l34-x10 | iOS 26.3 | NativeMenuStatesIntegration (10 runs, late=34 trial tree, 9 clean, r4 class 3a) | 9/10
