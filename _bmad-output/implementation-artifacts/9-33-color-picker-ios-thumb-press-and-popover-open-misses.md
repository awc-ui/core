---
title: 'md-color-picker on the iOS simulators: the plate thumb press and the popover open miss in every run (S62-09, S62-10); one unnamed miss on macOS'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-33-color-picker-ios-thumb-press-and-popover-open-misses'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane fi2 · android lane a6 (emulator-5566) for the regression once · simulators AWC-fi2 (iPhone 26.3), AWC-fi2-ipad and AWC-fi2-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist'
lab: 'work/s933-lab (create it; private tree work/s933-tree = a copy of canonical; the lab of story 6-2 is work/fi-lab with harness2.sh: use your own build and stage folders (FI_BUILD, FI_STAGE) and your own simulators so that you do not collide with story 9-32 on lane fi; job recipes claude-runner/done/6-2-pickers-audit-readiness-116*.sh and -120-canonical-all.sh; the UIKit bracket hooks (BRK) are in work/s923-lab)'
depends_on: ['6-2-pickers-audit-readiness']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 6-2 made md-color-picker ready on macOS and Android, but the canonical states suite (20950 checks) still misses on every iOS simulator. Job `6-2-pickers-audit-readiness-120-canonical-all` (2026-11-18, load 12 to 19 at each start): iPhone 26.3 20946, iPad 20945, iOS 18.6 20948, and macOS 20949 of 20950 (the macOS miss is not named in the record). The open findings in DEFECTS.md: S62-09 drag-plate, thumb press at t=100 and t=133 (iPhone in jobs 111, 116 and 120; the installed `cpshift` reduced it on the iPad and iOS 18.6 only); S62-10 popover open and show() (iPhone, iPad 5 checks, iOS 18.6; the failing case moves between runs). One-offs in job 120: presets click-5 and ArrowRight preset, one check each. None of them has a per-frame capture or a class. The harness story 9-23 ended without an install: there is no harness helper; UIKit's turn at a focus change is measured (12 to 21 ms inside a main-thread block of 18 to 35 ms) and no rule excuses it.

**Approach:** Start with the rate: name every failing check of jobs 111, 116 and 120 per device, and the macOS miss of job 120. Then, with a short trial job before each long one, make a per-frame capture of one failing and one passing attempt for the thumb press and for the popover open: the value under test, the time of the input, the time of each native commit, main-thread blocks of 12 ms or more, the Web series around the failing time, and with the BRK hooks whether a UIKit bracket lies in the block. Class each: the test samples before the last commit or at a boundary (correct the sample time with the limit unchanged and show a mutation that fails); a product clock that starts at a later onChange or body pass and not at the state write, or at the handler and not at the press (fix it in the product; say why cpshift helped on the iPad and iOS 18.6 and not on the iPhone); or a block (say what runs in it). Fix in the private tree, run the regression, then install once.

## Boundaries & Constraints

**Always:** After the install the colour-picker states suite on canonical passes with 0 misses on iPhone 26.3 three times, on the iPad twice and on iOS 18.6 twice, each run started behind a load gate (1-minute load below 20) with load1max printed, and three times on macOS; or the story ends blocked with the class table. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, add a retry, add a delay to the test, or move a miss into a known-gap list. Do not pass a time from the test or the shim into the product. Do not change `AppKitShim.swift` (canonical md5 starts with 30db5861) or `scripts/build-awcui.sh`: report in the Handover instead. Do not touch the time picker (story 9-32). No install before the regression. Before queueing a job check that no file with the same name sits in the lane queue. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S62-09 and S62-10
- the Dev Agent Record of story `6-2` (Current state table; jobs 111, 115 cpshift, 116, 120) and of story `9-23` (E report; BRK hooks in work/s923-lab)
- `work/claude-runner/KNOWN-CAUSES.md`, `work/claude-runner/PARALLEL.md`
- `packages/native-ios/Sources/AWCUI` colour-picker sources and `packages/native-ios/Tests/NativeColorPickerStatesIntegration.swift`

## Tasks & Acceptance

**Execution:**
- [ ] The rate table: every failing check of jobs 111, 116 and 120 per device, and the macOS miss of job 120 by name; colour-picker states x3 on macOS to see whether the macOS miss repeats
- [ ] Thumb press (S62-09): per-frame capture of a failing and a passing attempt on the iPhone; the class with proof; the fix in the private tree
- [ ] Popover open and show() (S62-10): the same on the iPhone and the iPad; the class with proof; the fix in the private tree
- [ ] The presets one-offs: 5 runs of the presets cases on the iPhone; a class if they recur
- [ ] Regression in the private tree: colour-picker states on iPhone 26.3 x3, iPad x2, iOS 18.6 x2, macOS x3; colour-picker paint once; the Android classes once
- [ ] One main-queue install (dry run, backup in the lab, byte identity); the same runs on canonical; DEFECTS.md status lines; KNOWN-CAUSES.md rows; refresh and confirm the md-color-picker checkpoint

**Acceptance Criteria:**
- Given S62-09 and S62-10, when a reader opens the Dev Agent Record, then each has a per-frame capture of a failing and a passing attempt, a class and the fix or the reason why none exists
- Given a change of a sample time in the test, when the product motion is delayed by 33 ms, then the changed check fails in every run of three
- Given the macOS miss of job 120, when the suite runs three times on macOS, then the record names the check and says whether it repeats and why
- Given canonical after the install, when the colour-picker states suite runs on iPhone 26.3 three times, on the iPad twice and on iOS 18.6 twice behind the load gate, then no run has a miss, or the story ends blocked with the words coordinator decision and the table
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 09:30 UTC: the 9-38 result; class each miss first)
Result of story 9-38 (jobs 013-020, iPhone 26.3 behind the load gate; nothing installed, canonical unchanged).
(1) Comparison at the delivered input (the Web sample time moved by the measured delivery delay d of the test's own input; window and tolerances unchanged). Text-field tab-out without a stall: 0 misses in 23 attempts against 5 in 26 in base; the phase boundary at 13.5/14.5 ms is gone. Every tab-out miss that remains follows a display-link stall of 56-60 ms (7 of 7). Select keyboard: runs with a miss 0 of 10 against 2 of 10 (arrowdown-open opacity). A 33 ms delay fails 3 of 3 in both subsets. A 17 ms delay in select is no longer caught (0 of 3; base catches it). d: select 0-7.2 ms, text-field tab-out 3.8-21.8 ms.
(2) Diagnostics on FAIL lines (display-link gap, delivery delay, phase, UIKit bracket). Classes over 15 lines: UIKit focus turn 5 (all text-field press-focus: gap 88-100 ms, bracket 63-69 ms); stall not from UIKit 0; grid phase 0; not classed 10 (text-field tab-out 6: gap 24-28 ms, d 9-18 ms; time-picker tap-hour-7 3: gap 43-49 ms with a bracket of 19-24 ms; table click-dessert 1: gap 58.5 ms, bracket 9.9 ms).
(3) Whether (1) or (2) goes into canonical is asked of the user first. Until the answer the canonical tests and the shim stay as they are, and no story uses AWC_CMP or AWC_DG outside a private tree. The patches and the class rule are in work/s938-lab/s4.
For this story: class each miss first, in your private tree, with the diagnostic of 9-38 (gap, d, UIKit bracket per FAIL line). A popover open that holds the first focus of the process falls under the warm-up ruling (KNOWN-CAUSES row 40: a fixed unchecked warm-up at the start of an iOS fixture, with its two proofs). A thumb press whose gap holds no UIKit bracket points at the component's own work in the press turn: bracket it and fix it in the private tree, with ten alternating pairs and the 33 ms mutation. Short trial job first (build and one case).

### Coordinator note (Coordinator correction 2026-11-19 15:25 UTC: simulators are shut down on exit as before; the no-shutdown line of 14:10 is withdrawn)
Correction of a coordinator rule. At 14:10 UTC I wrote into PARALLEL.md (and into some notes) that a job must not shut its simulator down at the end. That was wrong: it contradicts the rule of 2026-10-31 (every job that boots a simulator shuts it down on exit; never more than one booted simulator per fork), which exists because the Mac ran out of file descriptors and had to be rebooted, and it would stall the labs that wait until no simulator is booted. The line is withdrawn in PARALLEL.md. Shut your simulator down on exit as before (trap on EXIT). If you took a shutdown line out of a job script or a lab common since 14:10, put it back before you queue the next job, and say in your report that you did. The other new line under Load discipline stays: a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported.

### Coordinator note (Coordinator note 2026-11-19 16:13 UTC: relaunch; the popover's first open: show what the extra 25 ms are before any warm-up; productize the thumb-press fix)
Relaunch after the session limit; jobs 005 and 006 are waited for first. Good so far: the thumb press has a product cause (the press transition clock started at the body pass after the handler) and the fix is clean in 8 of 8 against 4 of 8. Three points for the rest.
(1) The popover's first open (41 ms from the input to the native start in a fresh process, 16 ms or less later). The warm-up ruling (KNOWN-CAUSES row 40) covers one thing only: the first focus of the process, which is UIKit's keyboard work with no AWCUI on the path. A first-use cost of our own code is not covered by it. So before a warm-up is made permanent, show what the extra 25 ms of the first open are: brackets or a sample of the first open against a later open, split into UIKit (which call), AWCUI (which function: a lazy static, a font or image load, the first build of the popover surface) and the rest. If it is UIKit's first focus, the warm-up is allowed with its two proofs (first-open checks 5 of 5; a 33 ms delay of the open still fails 3 of 3). If it is AWCUI's own first use, fix it in the product instead (do that work at mount or at idle, not in the turn of the first open) and show pairs; a warm-up in the test would hide a cost the user pays.
(2) Productize the thumb-press fix as planned: ten alternating pairs on iPhone 26.3 in all, the 33 ms mutation failing 3 of 3, then macOS x3 (name the macOS miss that the rate table leaves unnamed), presets x5, the regression (iPhone x3, iPad x2, iOS 18.6 x2, macOS x3, paint once, Android once). I name the install when you report the regression table; until then nothing goes to canonical.
(3) Load and simulators: PARALLEL.md, Load discipline, as corrected today: shut your simulator down on exit as always; a failing check is class 'load' only when the load in the minute around it was above 30.

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

### Coordinator note (Coordinator note 2026-11-19 20:40 UTC: you own S62-09 to S62-12; the set the class needs)
You own the open S62 lines of your picker in DEFECTS.md (9-32: S62-01 to S62-08, time picker; 9-33: S62-09 to S62-12, colour picker). Story 6-2 tried the class 'one frame, rare' on the existing canonical runs and could not establish it: fewer than 10 runs per runtime and no mutation 3 of 3 on canonical. So your regression after your install is the set the class needs: at least 10 runs per iOS runtime (iPhone 26.3, iOS 18.6, iPad) and a +33 ms mutation of each motion with an open line, 3 runs, all failing. Report one table per S62 id: check, runtime, k of n, the shifted comparison, class result. Lines that fail in more than 1 of 5 runs or by about two frames (the colour-picker thumb press before its fix, S62-09) are not covered: for those the fix or the cause is still owed. S62-08 (time picker on macOS, 0 to 2 misses per run in 2 of 3 runs) is not covered either (macOS): run the macOS states suite three times at the regression and report the counts with the load of each failing check's minute.

### Coordinator note (Coordinator note 2026-11-19 21:12 UTC: install name for the thumb-press fix; popover open: separating proof and split)
Decisions after the regression table of the fix tree (iPhone 26.3 x3: 20949, 20950, 20949 of 20950; iPad x2: 20949; iOS 18.6 x2: 20948, 20949; thumb press pairs base 6 of 10 failing, fix 0 of 10; +33 ms mutation fails 3 of 3).

1. INSTALL NAME for the thumb-press fix: 'color-picker: thumb press motion starts at the press (product)'. Conditions before the main-queue job: job 015 (macOS) read and every difference against canonical classed (the class 'one frame, rare' does not cover macOS); the Android rerun A017 passes its classes; the trace prints are out of the tree. Then one install (dry run, backup, byte identity) and the colour-picker states suite three times per runtime on canonical. S62-09: DEFECTS.md 'ready for re-check' with the pair table.
2. S62-10 (popover open; missed in 5 of 7 iPad and iOS 18.6 runs and 1 of 3 iPhone runs; no UIKit bracket): not covered by any class (more than 1 of 5; about 25 ms extra, more than one frame). Two short jobs: (a) the separating proof: in ONE process open the popover, close it, open it again; ten processes each on iPad and iOS 18.6; does the second open pass? (b) one sample of the first-open turn: our own code in ms, SwiftUI and UIKit in ms. If the cost is the first use of our own views: try the fix in the product (build the popover content before the first open) with pairs base against fix and the mutation. If it is system code and only at the first open of a process: end blocked with the facts (ms, calls, once per process, what a person sees) and I ask the user. A warm-up in the fixture is not allowed for our own first use.
3. Presets click-5 (once on iPhone): job 016 gives 5 runs; the class needs 10 runs on the judged tree, so add 5 after the install and give k of n with the per-frame shift proof.
4. After the install your canonical runs are the set the class needs for S62-11 and S62-12 too (note of 20:4x UTC): 10 runs per iOS runtime, a table per S62 id.
Build steps through tools/slot.sh build 2; boot once per job, inside the timing slot; the timing pool is at 2.

### Coordinator note (Coordinator note 2026-11-20 07:01 UTC: slot.sh was not executable 06:52-06:59 UTC (and 02:47-02:50); runs in those windows have no result)
Coordinator fault, and what it means for your runs. tools/slot.sh was not executable in two windows today: from 02:47:30 to about 02:50 UTC and from 06:52:18 to 06:59:36 UTC (I swapped the script in from the device mount and the new file had no exec bit; restored by job 927, and the swap procedure now sets the mode). A run in those windows that called tools/slot.sh directly ended at once with 'Permission denied' (exit 126) and has NO result. An empty log is not a pass and not 'mutation not detected': count nothing from such a run, and repeat it. Find them with: grep -l 'slot.sh: Permission denied' in your lab's run logs. Calling it as 'bash tools/slot.sh' or directly both work again.

Yours (you found it yourself, thank you): the canonical reruns 024 to 026 and the paint run of 022 have no result; 027 to 030 repeat them. After them: the DEFECTS line S62-09, KNOWN-CAUSES, the md-color-picker checkpoint; presets click-5 x5 more on canonical in quiet minutes (load below 30 and boot=0 on the last line of the load record). S62-10 (popover open, no cause, no class): bring it as a table (runtime, k of n in quiet minutes, the gap, what the main thread does in it from a sample, first open against second open in one process) and end with the words coordinator decision; if the cost is a first use in system code it goes into my question to the user.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Lab work/s933-lab, tree work/s933-tree. INSTALLED 2026-11-20 (job 023): 'color-picker: thumb press motion starts at the press (product)'; byte identity OK. S62-09 thumb press: 0 misses in all canonical runs (027/028), base 6/10 vs fix 0/10.
- Canonical after install (027/028): iPhone 20948, 20950, 20950; iPad 20949, 20948; iOS 18.6 20950, 20948. Misses: presets click-5-short-hex (iPhone run 1, iOS18 run 2; one frame, d 15 ms), popover click-trigger-open t=133 (iPhone run 1, iPad run 2; brk 3-4 ms, not UIKit), popover-in-dialog show-and-focus-plate t=33 (iPad 1+2, iOS18 2; brk 0). Acceptance (0 misses) NOT met: S62-10 open, no class covers it.
- macOS canonical 029: runs 1, 2 = 20950/20950; run 3 and 030 (paint, fix tree) still running/queued at last check.
- In flight on fi2: 029-canon-mac, 030-paint-mac, 031-canon-presets-x5-iphone (canonical presets only x5, for the one-frame-rare rate; needs 10 runs: 016/018 runs are on the fix tree).
- Next: read with grep -a "RESULT\|^FAIL" done/<job>.log; EVIDENCE for 029/030/031; DEFECTS.md S62-09 line (ready for re-check, pair table) and S62-10/presets lines; KNOWN-CAUSES row (thumb press clock started at body pass after handler); tools/checkpoint-refresh.py md-color-picker (main-queue job); then S62-10 table (runtime, k of n, gap, first open vs second open; separating proof jobs not yet run) and end blocked with the words coordinator decision.
- slot.sh lost exec bit earlier (coordinator told). Lab common.sh calls `bash slot.sh`; ios1 still takes the slot per run (not once from boot): change before any new long iOS job.
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-A017-android-cp-rerun | android-emulator-5566 | colorpicker-states + paint (2 tests, 0 failures) | 2/2
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-015-reg-mac | macos | colorpicker-states fix tree run 1 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-015-reg-mac | macos | colorpicker-states fix tree run 2 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-015-reg-mac | macos | colorpicker-states fix tree run 3 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-015-reg-mac | macos | colorpicker-paint fix tree | 13685/13685
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-016-presets-x5 | ios-iphone-26.3 | colorpicker presets-only run 1 | 2690/2693
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-013-reg-iphone | ios-iphone-26.3 | colorpicker-states fix tree run 1 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-013-reg-iphone | ios-iphone-26.3 | colorpicker-states fix tree run 2 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-013-reg-iphone | ios-iphone-26.3 | colorpicker-states fix tree run 3 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-014-reg-ipad-ios18 | ios-ipad | colorpicker-states fix tree run 1 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-014-reg-ipad-ios18 | ios-ipad | colorpicker-states fix tree run 2 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-014-reg-ipad-ios18 | ios-18.6 | colorpicker-states fix tree run 1 | 20948/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-014-reg-ipad-ios18 | ios-18.6 | colorpicker-states fix tree run 2 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-018-preset-ab-iphone | ios-iphone-26.3 | colorpicker presets-only base (no preset clock fix) 5 runs, runs without miss | 1/5
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-018-preset-ab-iphone | ios-iphone-26.3 | colorpicker presets-only preset clock fix 5 runs, runs without miss | 4/5

EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-019-preset-fix-mut-iphone | ios-iphone-26.3 | colorpicker presets-only fix tree 5 runs, runs without miss | 4/5
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-019-preset-fix-mut-iphone | ios-iphone-26.3 | colorpicker presets-only +33 ms mutation 3 runs, runs failing | 3/3
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-020-reg2-iphone | ios-iphone-26.3 | colorpicker-states final patch run 1 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-020-reg2-iphone | ios-iphone-26.3 | colorpicker-states final patch run 2 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-020-reg2-iphone | ios-iphone-26.3 | colorpicker-states final patch run 3 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-021-reg2-ipad-ios18 | ios-ipad | colorpicker-states final patch run 1 | 20948/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-021-reg2-ipad-ios18 | ios-ipad | colorpicker-states final patch run 2 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-021-reg2-ipad-ios18 | ios-18.6 | colorpicker-states final patch run 1 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-021-reg2-ipad-ios18 | ios-18.6 | colorpicker-states final patch run 2 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-022-reg2-mac | macos | colorpicker-states fix tree run 1 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-022-reg2-mac | macos | colorpicker-states fix tree run 2 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-022-reg2-mac | macos | colorpicker-states fix tree run 3 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-023-install-thumb-press-product | macos | canonical install byte identity (2 files) | 2/2

EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-027-canon-iphone | ios-iphone-26.3 | colorpicker-states canonical after install run 1 | 20948/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-027-canon-iphone | ios-iphone-26.3 | colorpicker-states canonical after install run 2 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-027-canon-iphone | ios-iphone-26.3 | colorpicker-states canonical after install run 3 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-028-canon-ipad-ios18 | ios-ipad | colorpicker-states canonical after install run 1 | 20949/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-028-canon-ipad-ios18 | ios-ipad | colorpicker-states canonical after install run 2 | 20948/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-028-canon-ipad-ios18 | ios-18.6 | colorpicker-states canonical after install run 1 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-028-canon-ipad-ios18 | ios-18.6 | colorpicker-states canonical after install run 2 | 20948/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-029-canon-mac | macos | colorpicker-states canonical after install run 1 | 20950/20950
EVIDENCE | 9-33-color-picker-ios-thumb-press-and-popover-open-misses-029-canon-mac | macos | colorpicker-states canonical after install run 2 | 20950/20950

## Review Triage Log
