---
title: 'Select and multi-select on the iOS simulators: the flat-pixels check after a pointer select-all compares a native shot that is stamped about one frame too early (S66-18-03, S919-02)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-35-select-all-ripple-flat-pixels-check-shot-time'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n4 · no Android lane · simulators AWC-n4 (iPhone 26.3) and AWC-n4-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist'
lab: 'work/s935-lab (create it; private tree work/s935-tree = a copy of canonical; story 9-29 kept its test copies in work/s919-tree and its patch scripts and out folders of jobs 040, 050, 060 to 065, 111 and 132 in work/s929-lab)'
depends_on: ['9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The flat-pixels check after a pointer select-all in `NativeMultiSelectStatesIntegration.swift` and `NativeSelectStatesIntegration.swift` fails now and then on the iOS simulators (S66-18-03, S919-02; for example multi-select 871 of 872 on iPhone 26.3 in job 100 of story 9-29, rtl). Measured in story 9-29 (job 040, iOS 18.6, band pixel (25,89), shots every 6 ms): the ripple fade runs at 0.42 level per ms; the native pixel passes Chrome's value 206 at about t=605 while the compared shot is stamped t=600; one shot costs about 16 ms; Chrome gives 0.807 with a spread of 0.000 over 20 runs. An interpolated check was tried (interpolate between the two bracketing native shots at the time of the Web shot, limit unchanged at mean 1.0): with no shift it fails rtl select-all 10 of 10 on iOS 18.6 and iPhone 26.3 with the native pixel about 6 levels lighter (6 levels at 0.42 level per ms are about 14 ms), ltr passes on iOS 18.6 and fails 3 of 10 on iPhone 26.3; fade shifts of +17, +33, -25 and -33 ms fail 3 of 3, but -17 ms passes (jobs 060 to 065 and 132). The band time series shows no product difference between ltr and rtl (job 111). So the check stamps the native shot about one frame too early, or is wrong in time in another way; it is not installed and canonical has the old check.

**Approach:** Calibrate before changing the check. One short job with a probe whose colour flips at a known host time (a probe view in the fixture, or a state of the existing suite that flips at a known time): 20 shots around the flip; report the delay between the requested shot time and the first shot that shows the flip, median and range, on iOS 18.6 and on iPhone 26.3, and say what the time stamp of a shot means today (request, capture or return). Then stamp native shots with their capture time in the interpolated check, limit unchanged, and print for one ltr and one rtl run the two bracketing shots (times and values), the interpolated value, the Chrome value and the Web shot time. Then the runs: base ltr and rtl ten times on each runtime, and the fade shifted by +17, -17 and +33 ms three runs each. If ltr and rtl still differ after the calibration, stop with the printed table and say what differs.

## Boundaries & Constraints

**Always:** With the corrected check: 0 flat-pixels fails in ten runs of ltr and rtl on iOS 18.6 and on iPhone 26.3 and in a loop of 50 select-all cases on macOS, and every run with the fade shifted by +17, -17 or +33 ms fails. Then one install of the test files. The rules in project-context.md apply.

**Never:** The limit stays at mean 1.0: this story changes how the time of a shot is read, not how much difference is allowed. Do not add a retry. Do not change the product ripple. Do not install a check that passes any of the three shifts. Do not touch the caret (story 9-34) or the keyboard misses (story 9-36). Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-29` (Session 5 flat pixels record; jobs 040, 050, 060 to 065, 111, 132) and `work/s929-lab`, `work/s919-tree`
- `packages/native-ios/Tests/NativeMultiSelectStatesIntegration.swift` and `NativeSelectStatesIntegration.swift` (flat-pixels check and the shot helper), the shot code of the test host
- `work/audit/DEFECTS.md` -- S66-18-03 and S919-02

## Tasks & Acceptance

**Execution:**
- [ ] Calibration job: the delay from the requested shot time to the capture, median and range per runtime; the meaning of the shot time stamp today
- [ ] The interpolated check with capture-time stamps in the private tree; the printed bracket table for one ltr and one rtl run
- [ ] Base runs: ltr and rtl x10 on iOS 18.6 and on iPhone 26.3; macOS select-all loop of 50
- [ ] Shift runs: +17, -17 and +33 ms, three runs each on iOS 18.6; every run must fail
- [ ] One main-queue install of the two test files (dry run, backup, byte identity); select and multi-select states on canonical: macOS once, iPhone 26.3 x3, iOS 18.6 x2; DEFECTS.md status lines; KNOWN-CAUSES.md row

**Acceptance Criteria:**
- Given the corrected check, when ltr and rtl select-all run ten times on iOS 18.6 and on iPhone 26.3, then there is no flat-pixels fail
- Given the ripple fade shifted by +17, -17 or +33 ms, when the check runs three times each, then every run fails
- Given the record, when a reader asks why rtl failed 10 of 10 with the first interpolated check, then it gives the measured reason
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

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

### Coordinator note (Coordinator note 2026-11-20 05:50 UTC: start after the 9-38 install; canonical first; quiet minutes; lessons of the night)
Start. What changed since this story was written:
1. Story 9-38 installed both of its changes into canonical on 2026-11-20 at 05:01 UTC: the select states test compares at the delivered input, and FAIL lines carry diagnostics (new shim md5 9055674f405eb3d2ff7369fffbca7199; its PARALLEL.md paragraph says how to read the lines). Make your private tree from canonical as it is now. First job: the select-all ripple check on canonical as it is now, x10 on iPhone 26.3 and x10 on iOS 18.6: does the flat-pixels miss still occur, how often per check, and what do the diagnostics print?
2. Quiet minutes: start each timed run only when the last line of claude-runner/load/load-<day>.log shows a load below 30 and boot=0 (wait up to ten minutes, then start anyway and mark the run); give the load and boot of the minute for every FAIL line. The timing slot is first come, first served since 02:47 UTC (PARALLEL.md, paragraph of 02:50); one boot per job inside the slot; builds through tools/slot.sh build 2.
3. Tonight's lessons from other stories, so that they are not repeated here: a denser shot target (8 ms) did not help the menu's flat-pixels check and broke another case (story 9-27: reverted); a mutation job must prove that the delayed code ran in the app that was measured (story 9-39: the tree was restored before the runs and the app was rebuilt without the delay); rule (e) counts per check and per runtime; the install is queued only when every Always line is met or a coordinator note names it (project-context.md, line 42).

### Coordinator note (Coordinator note 2026-11-20 07:01 UTC: slot.sh was not executable 06:52-06:59 UTC (and 02:47-02:50); runs in those windows have no result)
Coordinator fault, and what it means for your runs. tools/slot.sh was not executable in two windows today: from 02:47:30 to about 02:50 UTC and from 06:52:18 to 06:59:36 UTC (I swapped the script in from the device mount and the new file had no exec bit; restored by job 927, and the swap procedure now sets the mode). A run in those windows that called tools/slot.sh directly ended at once with 'Permission denied' (exit 126) and has NO result. An empty log is not a pass and not 'mutation not detected': count nothing from such a run, and repeat it. Find them with: grep -l 'slot.sh: Permission denied' in your lab's run logs. Calling it as 'bash tools/slot.sh' or directly both work again.

Yours: work/s935-lab/out: b18 runs 1 to 10, b26 runs 8 to 10, c18 runs 1 and 2, c26 runs 1 and 2 did not run. Repeat them under new job numbers; the rates of the first job are counted only from the runs that have a result.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator note 2026-11-20 09:07 UTC: relaunch; base rate on canonical first; the interpolated check is installed only under a name given after the table and the user's answer; make it reusable for the menu)
Relaunch; your plan stands. Three points.
1. Base first, and say it plainly: on canonical as it is now (after the 9-38 install), how often does the select-all ripple flat-pixels check still miss, per check and per runtime, in the runs that have a result (job 010 runs 1 to 7 on iPhone 26.3: 0 flat-pixels fails; iOS 18.6 still owed in job 040)? If it no longer misses in 10 runs on either runtime, the interpolated check is not needed for this finding: report that and stop there.
2. If it still misses: the interpolated check with capture-time stamps changes how a sample taken during a fade is judged, so it goes to canonical only under a name I give after your table: base rate; the new check unmodified x10 on both runtimes and a macOS loop; shifts of +17, -17 and +33 ms each failing 3 of 3 with a line that proves the shifted code ran in the app that was measured; the limit of the pixel difference unchanged. A check that passes +17 or -17 is weaker than it looks: say so if that happens. Because it changes what passes, I put it to the user with the other test-method question before it is installed; the work in the private tree goes on meanwhile.
3. The same pattern (a flat-pixels shot in the middle of a fade, best candidate one level over the limit, shots 12 to 19 ms apart) is open in the menu states suite (story 9-27, lines 3a, iOS 18.6). Write your check so that it can be reused there (a helper with the shot times and values as input), and say in the Handover how.
Jobs: an iOS job takes the timing slot once, from boot to shutdown, under about 40 minutes (PARALLEL.md, 08:12).

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 3 (2026-11-20). Tree: work/s919-tree (canonical synced, shim md5 9055674f405eb3d2ff7369fffbca7199). Lab: work/s935-lab; run.sh = quiet-minute iOS runner (`bash run.sh <label> <26|18> <runs> <Suite> KEY=VAL...`; out in s935-lab/out/<label>/console-<Suite>-<r>.log; uses `bash slot.sh`).
- Done (job 010, canonical as is, multi-select pointer ltr+rtl, iPhone 26.3): runs 1-7 flat-pixel fails 0 (EVIDENCE once verified); run1 had 1 unrelated FAIL (caret open motion t=200, story 9-34).
- Job 030-calibrate (exit 0) gave NO calibration: calib-patch.py did not compile (`var probe = false, probeX..` in an @Observable class: "accessor macro ObservationTracked can only apply to a single variable"; exit 4, no CALSUM). Fixed in session 3 (one var per line); re-queued as 9-35-select-all-ripple-flat-pixels-check-shot-time-050-calibrate (same script as 030).
- In flight (queue-n4, in order): 9-35-select-all-ripple-flat-pixels-check-shot-time-040-base-rest (label b26b runs 8-10 on 26, then b18 x10 on 18.6; SUMMARY lines in done/<job>.log), then 9-35-select-all-ripple-flat-pixels-check-shot-time-050-calibrate (CALSUM lines in out/c26, out/c18 console logs and done/<job>.log).
- Next: read CALSUM, decide shot stamp (start/mid/end minus staleness); write interpolated check patch (base work/s929-lab/flat-patch.py, capture-time stamps) for Multi and Select; base ltr/rtl x10 both runtimes with it; mutations +17/-17/+33 (prove delayed code runs in the measured app); macOS loop of 50; one main-queue install. Class existing runs per rule (e) in a table. Never install while an Always line is unmet.

## Review Triage Log

