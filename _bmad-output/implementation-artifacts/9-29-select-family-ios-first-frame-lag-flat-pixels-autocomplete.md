---
title: 'Select family on the iOS simulators: first frame one frame late after a hardware key (S61-IOS-01, S66-18-01, S66-18-02), select-all flat pixels (S66-18-03, S919-02), autocomplete states 1468 of 1472 (S919-01), and the TextField difference after fix 3'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and AWC-n2-18 (iOS 18.6); both exist from story 6-6'
lab: 'work/s929-lab (create it; private tree work/s929-tree = a copy of canonical taken at the start; the lab of story 9-19 is work/s919-lab, with the file from before fix 3 as NativeInspection.swift.canonical-before-fix3; the main-thread gap record of story 9-23 is in work/s923-lab)'
depends_on: ['9-19-select-family-ios18-residuals-and-intermittent-click-loss']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-19 fixed the lost clear click (C66-02; fix 3 in NativeInspection.swift, installed on canonical by its job 130) and found no fix for the rest. Open on canonical today: (1) S61-IOS-01, iPhone 26.3 with the iOS shim v5: select states 1029, 1029, 1028 of 1030 and multi 872, 872, 871 of 872 (9-19 job 100); the failing checks are single frames of the open motion after a hardware key (`select-keyboard-ltr arrowdown-open` opacity at t=49: web 0.807, native 0.657), one caret frame, one outside-close opacity frame and one multi reduced mdRemove/mdChange gap (+143 against +83 ms); with the shim before v5 the same sources had 1030 x3 and 872 x3. (2) S66-18-01 and S66-18-02 on iOS 18.6: select 1028/1030 x2 (`select-keyboard-rtl arrowdown-open` and `enter-open` opacity at t=49, native 0.494 and 0.396 against web 0.807), `multi-pointer-rtl escape` caret at t=200 (web 0.594, native 1.000 or 0.717). (3) S66-18-03 and S919-02: `select-all flat pixels` fails on iOS 18.6 in 2 of 2 runs (multi 869/872, 9-19 job 110) and on macOS in 12 of 50 loop runs; the menu rows band follows the md-menu-item ripple release fade through the shot window. (4) S919-01: autocomplete states on iPhone 26.3 1468 to 1470 of 1472; macOS 1472/1472. (5) Not classed after the install of fix 3: TextField states on iPhone 26.3 2042/2050 with fix 3 against 2048/2048 without, in `tf-throttle-200` (mdInput/mdSearch order), one run each (9-19 jobs 112 and 113). Until these are closed the gate-7 audit 7-2 of md-select, md-multi-select and md-autocomplete cannot pass, and stories 6-1 and 9-19 stay blocked.

**Approach:** Task 1 comes first because fix 3 is already on canonical: run the TextField states suite five times with fix 3 and five times without it (the file from before fix 3), alternating on the same simulator, and name the failing checks of each run. If the tf-throttle-200 order miss appears only with fix 3, find how the fallback delivery changes the order, fix it in the private tree and replace the installed file through one main-queue job (dry run, backup in the lab folder, byte identity); if no fix is found in one session, put the file from before fix 3 back the same way and say so. If the miss appears with and without fix 3, class it with the record below and add the numbers to S918-01. Then class before fixing: for every failing check of points 1 to 4, ten runs of the reduced case on its runtime with the main-thread gap record of story 9-23 (GAPS lines; pair each failing line with the GAPS line of its own pass; blocks of 12 ms or more count), and write a table: check, runtime, runs failed, the block in the turn that delivered the key or touch (ms and what ran in it), and how late the first product frame is against the delivered input. For the opacity samples also take 20 Chrome runs of the same case and give the spread of the Web value at that sample. A class that has such a block in the delivery turn of every failing run is harness cost: do not change the product for it and do not change a tolerance; put the table in the Handover for the coordinator. For a failing check without such a block, find where the open motion starts relative to the delivered key (compare iPhone 26.3 and iOS 18.6 on the same tree) and fix the product in the private tree. Flat pixels: record the native band colour and the Chrome band colour over the shot window in 10 runs each; if the native ripple release fade has a different length or start than the Web source, fix the product; if the shot is taken at a different point of the fade than in Chrome, fix the test anchor and show that a mutation of the fade still fails. Autocomplete: name the failing checks in three runs with and three runs without fix 3 and class them the same way.

## Boundaries & Constraints

**Always:** Every failing check of the five points has a class with its numbers (harness block, product timing, Chrome spread, load), and every fix has a run count before and after on the runtime where it failed. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, an envelope or a retry rule, and do not add a rule that lets a failing run excuse itself. Do not install a shared test helper. Do not change the iOS shim (md5 30db5861). Do not create CPU load on the Mac. A change to NativeInspection.swift needs the clear loop of story 9-19 again (200 runs, 0 lost).

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-19` (cause and fix 3 of C66-02, jobs 090 to 130, the regression jobs 112 and 113) and `work/s919-lab`
- `work/audit/DEFECTS.md` lines S61-IOS-01, S66-18-01, S66-18-02, S66-18-03, S919-01, S919-02, S918-01
- the Dev Agent Record of story `9-23` and `work/s923-lab` (the GAPS record, brk-class.py, the class tables); `work/claude-runner/KNOWN-CAUSES.md` rows 21, 23, 27, 28 and the row of story 9-23
- the Dev Agent Records of story `6-6` (delivered-time anchors, the ripple release fade through the shot window, jobs 052 to 058) and story `6-1` (jobs 051 and 060)
- `packages/native-ios/Sources/AWCUI/NativeSelect.swift`, `NativeMenu.swift`, `NativeInspection.swift` and the states tests NativeSelectStatesIntegration, NativeMultiSelectStatesIntegration, NativeAutocompleteStatesIntegration, NativeTextFieldStatesIntegration

## Tasks & Acceptance

**Execution:**
- [x] TextField states 5 runs with fix 3 and 5 without, alternating; the class of the tf-throttle-200 miss; if fix 3 is the cause: fix and replace the install, or put the earlier file back
- [x] Class table for S61-IOS-01, S66-18-01, S66-18-02: 10 runs per case and runtime with the GAPS record; 20 Chrome runs for the opacity samples
- [x] Flat pixels (cause found, decision needed): band colour over the shot window, native and Chrome, 10 runs each on iOS 18.6 and macOS; the cause; the fix
- [x] Autocomplete on iPhone 26.3: the failing checks with and without fix 3 (3 runs each); class; fix
- [x] (no product change in this story; classes in the closing table, mutation job 150) Product fixes for the classes that are product timing; select, multi and autocomplete states x3 on iPhone 26.3, x2 on iOS 18.6, once on macOS; the select-all loop 50 times on macOS; a 33 ms mutation of the open motion fails
- [x] (docs-only install, job 160) One main-queue install (dry run, backup in the lab folder, byte identity); DEFECTS lines; KNOWN-CAUSES row; the notes for stories 6-1 and 9-19 and for audit 7-2

**Acceptance Criteria:**
- Given the TextField states suite on iPhone 26.3, when it runs five times with fix 3 and five times without, then the record names the failing checks of each run and says whether fix 3 changes the tf-throttle-200 order; if it does, canonical has the corrected file or the file from before fix 3
- Given every failing check of S61-IOS-01, S66-18-01, S66-18-02, S66-18-03, S919-01 and S919-02, when a reader opens the Dev Agent Record, then the check has a class with run counts, and a class named harness cost shows a block of 12 ms or more in the delivery turn of every failing run
- Given the fixes, when select, multi and autocomplete states run three times on iPhone 26.3 and twice on iOS 18.6, then every run passes 1030/1030, 872/872 and 1472/1472; or the only misses left are of a class named harness cost, and the story ends blocked with the words coordinator decision and the table
- Given the select-all loop on macOS, when it runs 50 times after the change, then no run fails `select-all flat pixels`
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

**Session 5 (dev agent), coordinator decision needed:** see Current state and the Session 4 class table in the Dev Agent Record. Harness-cost classes: all motion checks of S61-IOS-01, S66-18-01/02, S919-01. Flat pixels S66-18-03/S919-02: test resolution vs 0.42 level/ms fade; product aligned within ~5 ms.

### Coordinator note (Coordinator decision 2026-11-18 15:40 UTC: flat pixels by interpolation, motion classes not accepted yet)
Coordinator decision on the session 5 report (two parts) and the order of the remaining work.

What stands: Task 1 is closed. The tf-throttle-200 miss appears 2 of 5 with fix 3 and 2 of 5 without it, so fix 3 stays installed and the miss is S918-01 (add your pair numbers to that DEFECTS entry).

Decision 1, flat pixels (S66-18-03, S919-02): change the measurement, not the limit.
- In NativeMultiSelectStatesIntegration.swift and NativeSelectStatesIntegration.swift take the two native shots that bracket the web shot time and compare the web shot with the value interpolated at that time. The limit stays mean 1.0. Write in the test comment and in the record which instant a shot's time stamp means (start, middle or end of the capture) and how you know.
- Proof that the check still sees a late fade: with the ripple release fade shifted by +17 ms, by -17 ms and by +33 ms the check must fail in every run (3 runs each). If +17 or -17 passes, stop and report the smallest shift that fails; do not install.
- Without a shift: iOS 18.6 ltr and rtl 10 runs, iPhone 26.3 10 runs, macOS select-all loop 50 runs, 0 fails of flat pixels.

Decision 2, the motion classes: NOT accepted as harness cost on the present table. Reason: by your own table the block has the same length in passing runs, so it does not explain the failing ones, and you found a product-side variable (the open clock starts 20 to 25 ms into the delivery turn). Two measurements decide it, both in the private tree only:
- (a) Open clock from the delivered input. Same pattern as the close fix of story 6-6 (close(requestedAt:), bounded 0..100 ms) and KNOWN-CAUSES row 26: start the md-menu open motion from the delivered key or touch time (or the time at entry of the key handler if no delivered time exists for keys). 10 runs per failing case and runtime, alternating with and without; a +33 ms mutation of the open motion must fail. If the failures of a class go to 0 it is a product fix and goes to regression and install (below).
- (b) Optimised product build. scripts/build-awcui.sh compiles AWCUI with -Onone. Make a private copy of the script with -O in s929-tree (never the canonical script), and run the cases of your class table 5 times with -Onone and 5 times with -O, alternating, with the GAPS record. Report per check: block length and runs failed for both builds. This is a measurement for the coordinator and for story 9-23; nothing from it is installed and no canonical run uses it.
- Autocomplete caret (type-a 9 of 10, ac-multiple-ltr click-open 10 of 10 with no passing run, enter caret t=66): a check that fails in every run is not harness cost. Find where the native caret blink clock is anchored (key or focus time, or after the options render in the same turn) against the Web; if it is anchored after product work in the turn, apply the delivered-time pattern; report the -O numbers of (b) for these checks.

Order (the rule of the chain: a short trial job first, build plus one case, for each of the three changes; every script stops at the first failed build):
1. Trial jobs: interpolated band check; delivered-time open clock; -O build.
2. Long jobs: Decision 1 runs; (a) and (b).
3. If product code changed: menu, select, multi and autocomplete states once on macOS, x3 on iPhone 26.3, x2 on iOS 18.6 from the private tree; then one main-queue install (dry run, backup in s929-lab, byte identity) of the product change and the two test files; then the same suites once on canonical.
4. DEFECTS lines (S61-IOS-01, S66-18-01..03, S919-01, S919-02, S918-01 numbers), the KNOWN-CAUSES rows, the notes for 6-1, 9-19 and audit 7-2.
5. EVIDENCE lines: each partial-pass line gets its own true reason after the word explained (for example: explained: probe run, the one miss is flat pixels, cause in job 040) or stays as it is. No bulk edit.

End states: review if select, multi and autocomplete pass in full x3 / x2 / x1. Otherwise blocked with the words coordinator decision and one table: check, runtime, runs failed before, after (a), with -O, block length for both builds. Do not widen a tolerance, do not change the shim, do not install a shared helper, do not create CPU load. Runs with load1max above 30 go into a class of their own.

### Coordinator note (Coordinator note 2026-11-18 19:41 UTC: Mac restarted at 18:56 UTC; the caret patch was installed before its macOS regression; what this run does)
What happened. The Mac restarted at 18:56 UTC on 2026-11-18. Every lane and job was terminated; lanes, keep-awake, emulators and Laboratory are restored by coordinator job 892. Your job 081-ac-canon-mac was terminated after its build (exit 143, no run); job 080-ac-since-mac stopped at the patch assertion (exit 3, no run). Simulators are not booted after the restart: boot yours as your recipes do.

The early install. Job 090-install-ac-since put the autocomplete caret patch on canonical at 18:50 UTC (NativeAutocomplete.swift md5 82406b17a2431db8dbb72abe5c3339b0; backup work/s929-lab/NativeAutocomplete.swift.canonical-before-since md5 929438fffb92cba7df1c984269f58ee8). The order in the 15:40 note was regression first, then one install. iPhone 26.3 x5 (078) and iOS 18.6 x2 (079) were in hand; macOS and the unaffected check were not. The coordinator leaves the file in place for now. Do not install anything else in this run before step 1 is green.

Step 1, first job of this run (one job, stop at the first failed build): on a fresh copy of canonical, macOS: NativeAutocompleteStatesIntegration once, the autocomplete paint fixture once, NativeSelectStatesIntegration, NativeMultiSelectStatesIntegration and NativeMenuStatesIntegration once each. Then iPhone 26.3: select, multi-select and menu states once each. Compare every result with the last canonical result before 18:50 UTC (name the job you compare with). A difference in a check that touches the caret or the open motion of autocomplete, or any new failure in select, multi-select or menu, means: roll back with a main-queue job from the backup (byte identity against the backup md5), say so in Current state, and stop with blocked and the words coordinator decision. A failure that the before-run also has is listed with its class and does not trigger the rollback.

Step 2, if step 1 is green: DEFECTS line for the caret finding (ready for re-check), KNOWN-CAUSES row (autocomplete caret clock: AWCSelectCaret got no open-write time, its rotation started at the SwiftUI onChange after the options render; the fix passes rt.openWriteAt), notes for 6-1, 9-19 and 7-2 with the job names. The two single-frame misses that remain after the fix (078 run 4 reduced escape opacity t=33; 079 run 1 ac-multiple-ltr click-open motion t=149) are OPEN and not classed: write them down as such, with an id each.

Step 3, flat pixels, diagnosis only (short jobs, no install): the interpolated check fails rtl select-all 10 of 10 and passes a -17 ms shift, so it is not installed. Two questions, one short job each. (i) Why does -17 pass: for one passing -17 run and one base ltr run print the two bracketing native shot times, their pixel values, the interpolated value, the Chrome value and the web shot time. (ii) Why is rtl about 6 levels lighter than ltr: record the band pixel as a time series (every native shot and every Chrome shot of the fade, 3 runs) for ltr and rtl, and say whether the native fade starts later, runs slower or ends at another level in rtl, and whether Chrome differs between ltr and rtl at all. If (ii) shows a product difference in rtl, name the file and function; fix it in the private tree only if the fix is a few lines and the +17, -17 and +33 mutations then all fail in every run; otherwise report.

Settled, no more runs: (a) the open clock from the key handler has no effect (8 of 10 against 8 of 10; 8 of 10 against 10 of 10) and is not installed; (b) the -O build changes nothing for select or autocomplete. Write both into KNOWN-CAUSES with the job names so that no other story repeats them.

Evidence lines: by hand, each with its own true reason, as in the 15:40 note. Jobs 080 and 081 have no results: say so on their lines or leave them out.

End of this run: blocked with the words coordinator decision and the table (select keyboard motion per runtime: before, after (a), with -O; autocomplete: before, after the caret fix; flat pixels: ltr and rtl, base and each mutation; the answers to (i) and (ii)); or review if step 1 is green, the flat-pixel cause is fixed with all mutations failing, and the select keyboard misses have a proven class.

### Coordinator note (Coordinator note 2026-11-18 20:22 UTC: correction, the Mac did not restart at 20:15 UTC; job 100 is still running)
Correction. The Mac did NOT restart at 20:15 UTC. Coordinator job 894 (20:19 UTC) shows the same boot as before (20:56:52 local time), 33 runner processes, keep-awake and Laboratory alive. What restarted was the device shell (its uptime is not the Mac's uptime). Your job 100-step1-canon-regress was never killed: it kept running (job 895 lists it). Remove the sentence about a second restart from Current state when you rewrite it.
How to tell next time: a lane log without a new line and a fresh device shell do not show a restart. Queue a one-line main-queue job (date; uptime) and read its log; if it does not run within two minutes, say so and end the session without conclusions about the Mac.
This run: your first session starts when job 100 has ended (the chain waits for it). Then as you planned: autocomplete on macOS x5 with the built binary (work/s929-lab/out/100-step1) to decide about the one caret miss (ac-multiple-rtl click-open t=199; the before-run had 1472/1472), read the menu and iPhone results of job 100, decide rollback or keep by the rule of the previous note, then steps 2 and 3 of that note.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: facts from 9-23 and 9-16 for your table (-O is per component))
For your table and the KNOWN-CAUSES rows. Story 9-23 has closed its measurement: for the text field -O changes nothing (block 27 against 28 ms), and UIKit's turn at a focus change is 12-21 ms inside a block of 18-35 ms. Its BRK hooks (work/s923-lab) show whether a become or resign bracket lies inside the block of one attempt. For the select keyboard misses that are still not classed, one short job with those hooks on the failing case tells whether your block is such a turn (the options field taking focus at open) or something else; show a passing attempt next to a failing one.
For the table story (9-16) -O did change the result (0, 0, 2, 0, 0 failed checks against 1, 1, 1, 2, 4; the 72-78 ms block is missing in 4 of 5 -O runs). So do not write that -O has no effect in general: write it per component.

### Coordinator note (Coordinator decision 2026-11-18 22:16 UTC: rollback accepted; rework the caret patch for macOS rtl; flat pixels: calibrate the shot time; keyboard motion: class with the UIKit hooks)
Decisions on your three points. Set status in-progress.

(1) Autocomplete caret patch. The rollback is accepted and was the right call (macOS ac-multiple-rtl click-open caret t=199 fails 4 of 5 with the patch, 0 before). The iOS finding stands as an OPEN product finding: write its DEFECTS line now (AWCSelectCaret in NativeAutocomplete.swift gets no open-write time; iPhone 26.3 0 of 10 clean runs; with the patch 4 of 5; patch not installed because of macOS rtl). The macOS miss is not accepted. Rework in the private tree: for ac-multiple-rtl click-open and ac-multiple-ltr click-open on macOS, with and without the patch, print the click time, every write of rt.openWriteAt, the time the caret rotation starts and the Web caret series around t=199. Say what differs in rtl (two writes, a write at the press instead of the release, a stale time from the previous open, a different open path for the multiple variant). Short trial job first. The reworked patch is ready for an install only when all of this holds: macOS autocomplete x5 with 0 caret misses, iPhone 26.3 x5, iOS 18.6 x2, select and multi-select states once on macOS and iPhone 26.3, and a 33 ms delay of the caret start fails in every run (3 runs). Regression first, then one main-queue install.

(2) Flat pixels. The interpolated check as written is dropped (rtl fails 10 of 10; a -17 ms shift passes). Read the two facts together: in rtl the native pixel is about 6 levels lighter, and the fade runs at 0.42 level per ms (your job 040), so 6 levels are about 14 ms, one frame; and a -17 ms shift passes. Both fit a check that stamps the native shot about one frame too early (the request time instead of the time the frame was captured; job 040 said a shot costs about 16 ms). So do not look for a product difference in rtl (your band series shows none). Calibrate the shot time: one short job with a probe whose colour flips at a known host time (or any state that flips at a known time in the existing suite), 20 shots around the flip, and report the delay between the requested shot time and the first shot that shows the flip (median and range, iOS 18.6 and iPhone 26.3). Then stamp native shots with request time plus that delay in the interpolated check, limit unchanged (mean 1.0), and run: base ltr and rtl x10 on iOS 18.6 and on iPhone 26.3, and the +17, -17 and +33 ms shifts 3 runs each. Accepted only if base has 0 fails and every shifted run fails. If ltr and rtl then still differ, print the bracketing shots (times, values), the interpolated value and the Chrome value for one ltr and one rtl run, and stop with that table. Answer question (i) with those printed lines in any case.

(3) Select keyboard motion. Not accepted as harness cost: a block that is the same in passing attempts explains nothing. One short job with the BRK hooks of work/s923-lab on select-keyboard-rtl (iPhone 26.3, 10 runs): for every attempt, passing and failing, the time from the key to the open write, to the first changed frame, and whether a become or resign bracket lies in the block. Say whether a miss is predicted by the first-frame time alone (threshold, attempts it gets wrong). If the product learns of the open late (as the text field learns of a blur 19-27 ms after the key through a didEnd callback), say where; do not fix it in this run.

Order: (1) trial and rework first, its long runs in the lane while you do (2) and (3). The menu miss on macOS in job 110 (one opacity frame at t=366) belongs to story 9-27: one line in your record with the job name, nothing else.
Evidence: the 9 hard failures of verify_evidence.py are lines of yours without a reason (011, 015, 023, 030, 032, 033 twice, 060 and one more): give each its own true reason by hand (pair runs before the fix-3 decision; GAPS diagnostic runs with the misses under study; a mutation that is meant to fail) or leave it; no bulk edit.
End: review only if the reworked caret patch is installed with its regression, the flat-pixel check is accepted as above and installed, and the keyboard misses have a proven class; otherwise blocked with the words coordinator decision and one table per point.

### Coordinator note (Coordinator decision 2026-11-19 00:16 UTC: this story is closed as a record; the open parts move to stories 9-34, 9-35 and 9-36)
This story is closed as a record; do not queue jobs here. Its three open parts move to three small stories, each with its own lab: 9-34 (autocomplete caret clock: late on iOS, the write-time patch fails macOS rtl at t=199; canonical stays rolled back), 9-35 (flat-pixels check: calibrate the shot time, limit unchanged) and 9-36 (single-frame misses after a key or click opens the menu: OPEN-131a, OPEN-131b, 078 run 4, 079 run 1). Settled here and written in KNOWN-CAUSES: the open clock from the key handler has no effect; -O is a per-component question. Fix 3 of 9-19 stays installed (S918-01 pair numbers 2 of 5 with and 2 of 5 without).
When the three stories are in review this story gets one closing session: point its DEFECTS lines to them, write the notes for 6-1, 9-19 and audit 7-2, keep the evidence block (0 hard failures), set review.

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-19 20:39 UTC: closing session; what to do)
Closing session with the class 'one frame, rare' (note above; PARALLEL.md, 'User decisions on classes', item (e)). This story is blocked on residual iOS misses. Do this, in this order:
1. One table from your EXISTING runs: every open finding of this story (its DEFECTS ids), with check, runtime, k of n runs, the shifted comparison and the mutation job.
2. Lines the class covers: DEFECTS.md 'closed as one frame, rare (user decision 2026-11-19)' with the numbers. The audit doc lines go in by ONE main-queue docs install, named 'audit docs: one-frame-rare lines of this story (docs only)' (dry run, backup, byte identity).
3. Lines the class does not cover: leave them open and name the story that owns each (9-34 caret clock, 9-35 select-all shot time, 9-36 keyboard open on iOS 18.6, 9-32 and 9-33 for the pickers). Do not start work on them here.
4. verify_evidence, hard failures answered by hand. Then status review.
New runs only for a missing mutation or to reach 10 runs of a check. The timing pool is at 2; build steps through tools/slot.sh build 2; boot once per job and inside the timing slot.

### Coordinator note (Coordinator note 2026-11-19 20:52 UTC: ruling on the shift basis and the pooled rate)
Ruling on your two judgement calls. (1) The shift basis is accepted: each failing native sample equals the Web value one frame earlier within the check's limit (0.889 against 0.887; 0.657 against 0.669). PARALLEL.md item (e) now says so. (2) The pooled rate is NOT enough for a final closure: the 30 runs come from jobs with diagnostic hooks or experiment arms, one of them at 4 of 10. The two DEFECTS lines stay as you wrote them, but they are provisional: audit 7-2 decides from its own 10 runs per runtime on a snapshot taken after the 9-38 install. Nothing more to do in this story; status review stands.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 15 (closing session, status review). No product code changed; canonical autocomplete stays rolled back (md5 929438ff); fix 3 stays installed.
- Job 150-mut33-sel26 (iPhone 26.3, +33 ms open motion, x3): 358, 359, 359 of 364, arrowdown-open and enter-open fail 3 of 3. Job 160 (main queue, docs only): audit docs section in md-select.md plus DEFECTS lines, byte identity ok (md5 a9010c10 md-select.md, 1356b583 DEFECTS.md; backups in work/s929-lab/*.before-9-29).
- Closed as one frame, rare (iPhone 26.3): select-keyboard-ltr arrowdown-open t=83 4/30, select-keyboard-rtl arrowdown-open t=49 5/30; shifted comparison computed from the Chrome series (native 0.889/0.657 equal web 16.7 ms earlier 0.887/0.669), not from logged native series.
- Still open, owners: reduced enter t=33 iPhone (10/20) and iOS 18.6 misses over one frame (S66-18-01, S66-18-02, multi gap): 9-36; autocomplete caret S919-01: 9-34; flat pixels S66-18-03, S919-02: 9-35; menu t=366 macOS: 9-27.
- Notes for 6-1, 9-19, audit 7-2: S61-IOS-01 / S66-18-01 as in the DEFECTS lines of 2026-11-19; the audit must list the two one-frame lines above and keep the rest open. Not written into those story files.
- Coordinator: the shifted-comparison basis (Chrome curve, not native logs) and the rate (30 runs pooled over 3 jobs, one with GAPS hooks at 4/10 for rtl) are judgement calls; re-check if strict.
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-150-mut33-sel26 | ios26.3 | NativeSelectStatesIntegration keyboard subset +33 ms open mutation x3 (must fail) | 358/364 (explained: mutation meant to fail, run 1), 359/364 (runs 2 and 3, same)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-140-caret-mac-x5 | macos | NativeAutocompleteStatesIntegration reworked caret patch x5 | 1471/1472 (explained: ac-multiple-rtl click-open caret t=199 in 4 of 5 runs, run 2 1472/1472; patch not installed)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-140-caret-mac-x5 | macos | NativeAutocompleteStatesIntegration mut33 (no-op +33) x3 | 1472/1472 (explained: mutation did not take effect, since + 33 is ignored by NativeSelect.swift line 334)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-110-ac-mac-x5-menu | macos | NativeAutocompleteStatesIntegration with caret patch x5 | 1471/1472 (explained: ac-multiple-rtl click-open caret t=199 in 4 of 5 runs, patch rolled back by job 120)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-110-ac-mac-x5-menu | macos | NativeMenuStatesIntegration | 2523/2524 (explained: selection-keep-open click-plain-closes opacity t=366 single frame)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-111-flat-diag | ios18.6 | NativeMultiSelectStatesIntegration flat pixels base x2, -17 ms x3, band x3 | 159/160 (band runs x3; explained: flat pixels the one miss, cause in job 040)

### Session 5 flat pixels record (job 040, iOS 18.6, multi-pointer-ltr select-all, shots every 6 ms requested, 3 runs, band pixel (25,89))
- Native band colour over time (run 1): t=499 201,192,215; t=520..572 flat 193,185,207 (pressed/hover state); fade starts ~575; t=587 196; 603 205,197,219; 620 210,200,224; 637 212; 653 213; 686 215; 703 onward 216,207,231 (settled). Run 2/3 identical to within 1 level.
- Chrome shot at (25,89) = 206,197,219 = the native colour at t~604-605, the oracle shot is at 600 after the act: the product fade is aligned with Chrome within about 5 ms (same curve point, same end 216,207,231 band).
- Fade slope at the shot is 0.42 level/ms (196 to 210 over 33 ms). The test passes only when a native shot lands within about 2 ms of the web shot time (mean limit 1.0 of max(0,q-1)); each cacheDisplay costs about 16 ms so the shot spacing cannot go below 16 ms, and the scheduled shots (550, 566, 582, 600) are late by the frame cost: the best shot is lighter by 3-5 levels (runs failed: mean 1.157 and 1.543; worst 4-5 levels at (25,89), 0/32853 pixels above 6).
- Class: test measurement resolution against a steep fade, not a product defect. No Chrome multi-time capture of the fade was made (not needed: native curve passes through the Chrome value at the Chrome shot time). macOS 12/50 follows the same mechanism (frame-cost jitter), not re-measured this session.
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-040-band18 | ios18.6 | NativeMultiSelectStatesIntegration multi-pointer-ltr band probe | 159/160 (explained: flat pixels the one miss in runs 2 and 3, probe run for the band record, cause in this job)

### Task 1 record (TextField states, iPhone 26.3, fix3 vs before-fix3, alternating, 5 pairs)
- tf-throttle-200 (mdInput/mdSearch order, event 7) failed: without fix3 in pair 1 and 5 (2/5); with fix3 in pair 1 and 3 (2/5). Same check, same event, both variants: class as S918-01 (not fix 3). Other misses in all runs, both variants: press-focus motion label y/font frames, tab-out 1-3 frames.
- Totals: nofix3 2040/2048, 2048/2048, 2044/2044, 2050/2050, 2042/2050; fix3 2041/2050, 2048/2048, 2040/2048, 2048/2048, 2048/2048.
### Autocomplete states record (iPhone 26.3, 3 runs each)
- nofix3 1467, 1469, 1469 of 1472; fix3 1469, 1469, 1467 of 1472. Same checks in both variants: caret frame `ac-keyboard-ltr type-a` t=149 (web 0.953, native 0.000, every run), `ac-multiple-ltr click-open` caret t=149/t=183 (1-3 frames), `ac-keyboard-rtl enter` caret t=66 (every run), `ac-keyboard-ltr enter` caret t=66 (some runs), once opacity t=166 (`ac-keyboard-rtl escape1`, nofix3) and once `ac-freesolo-rtl enter-commit` opacity t=33 (fix3). Fix3 does not change the set: all are caret-blink phase and single opacity frames. Class pending the GAPS record (Task 4 needs the table).

EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-011-tf-pair1 | ios26.3 | NativeTextFieldStatesIntegration nofix3/fix3 | 2040/2048 and 2041/2050 (explained: pair 1 before the fix-3 decision; the miss is tf-throttle-200 order, class S918-01 with and without fix 3)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-015-tf-pair5 | ios26.3 | NativeTextFieldStatesIntegration nofix3/fix3 | 2042/2050 and 2048/2048 (explained: pair 5 before the fix-3 decision; nofix3 miss is tf-throttle-200 order, class S918-01)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-023-ac-pair3 | ios26.3 | NativeAutocompleteStatesIntegration nofix3/fix3 | 1469/1472 and 1467/1472 (explained: pair 3 of the autocomplete comparison; the misses are the caret frames recorded in the autocomplete states record, same checks with and without fix 3)

### Session 3 notes (class work, iPhone 26.3 select, job 030, 10 runs of select-keyboard-ltr/rtl with GAPS)
- Every failing motion check has a main-thread block of 39-87 ms in the delivery turn (starts 0-9 ms after the key; run-loop segment afterWait>exit; display-link gap 48-103 ms): ltr arrowdown-open fails at t=83 (2 runs, block 86-87), rtl arrowdown-open fails at t=49 (5 failing check lines in 4 runs, block 50-57), reduced `enter` opacity t=33 (4 runs, block 39-42).
- The same blocks occur in the passing runs of the same cases (ltr arrowdown-open 84-91 ms, rtl 51-58, reduced enter 39-45): the block length does not separate pass from fail. The native opacity at the first frame after the block (0.63-0.66 at frame ~+56 for rtl, 0.89 at ~+88 for ltr) says the open clock starts about 20-25 ms into the turn, after product work in the same turn, not at the key; whether the first frame is inside the +-0.03 envelope depends on that offset. Class (story rule): block >= 12 ms in the delivery turn of every failing run = harness cost, no product change, no tolerance change. Open question for the coordinator: the 20-25 ms pre-work before the open clock starts could be removed by stamping the transition with the event time (product change in the shared md-menu motion clock, NativeMenu.swift track.start), not tried.
- Chrome spread of the Web value at these samples: job 031 (pending).

### Session 4 class table (jobs 030, 031, 032, 033; blocks = main-thread blocks >=12 ms in the delivery window -5..+120 ms of the key; gap-class.py)
| check | runtime | runs failed / 10 | block in delivery turn (ms, segment) | passing runs of same case |
|---|---|---|---|---|
| select-keyboard-ltr arrowdown-open op t=83 | iPhone 26.3 | 2 | 86-87 afterWait>exit, display-link gap 84-103 | 84-91 |
| select-keyboard-rtl arrowdown-open op t=49 (web 0.807, native 0.657-0.669) | iPhone 26.3 | 5 (4 runs) | 50-57 | 51-58 |
| select-keyboard-ltr/rtl (reduced) enter op t=33 | iPhone 26.3 | 4 | 39-44 | 39-45 |
| select-keyboard-ltr arrowdown-open op t=49/83 | iOS 18.6 | 3 | 67-83 | 67-79 |
| select-keyboard-rtl arrowdown-open, enter-open op t=49 (web 0.807) | iOS 18.6 | 3 | 38-45 | 35-49 |
| ltr space-open op t=49; (reduced) enter op t=33 | iOS 18.6 | 1; 3 | 43; 40-41 | 31-41; 40-49 |
| (reduced) tab-away op t=33 | iOS 18.6 | 3 | 22 (exitf>exitl) | 21-25 |
| multi-pointer-rtl escape caret t=200 (web 0.594) | iOS 18.6 | 2 | 12-13 x2-3 (sourcesl>exitf) | 12-15 |
| multi select-all flat pixels | iOS 18.6 | 10 of 10 (both ltr and rtl, mean 1.115-1.543) | blocks 16-21 ms at +32 and +67, 38-51 at +108 in every run | 0 passing: not harness, OPEN |
| ac type-a caret t=116/149 (web 0.878/0.953, native 0.000) | iPhone 26.3 | 9 | 120-130 ms (sources/exit>exitl: options render in the key turn) | 104 (1 pass) |
| ac enter caret t=66 (ltr/rtl) | iPhone 26.3 | 9 | 51-61 + 28-31 | 52-59 |
| ac-multiple-ltr click-open caret t=149 (web 0.406, native 0.000) | iPhone 26.3 | 10 | 77-86 at +100 | none passing |
| ac (reduced) escape1 / enter-commit op t=33 | iPhone 26.3 | 1; 2 | 14-16 | 13-19 |
- Chrome (job 031, 20 runs): web opacity at the t~49 sample 0.807 in all 20 runs (sd 0.000) for ltr arrowdown-open, rtl arrowdown-open, rtl enter-open. The caret samples are not in the web-spread script (KeyError 'caret', fix before reuse).
- Native opacity after the block (0.63-0.67 at ~+56 ms) shows the open clock starts 20-25 ms into the delivery turn, after product work in the same turn; question for the coordinator: stamp the md-menu motion clock with the delivered event time (NativeMenu.swift track.start). Not tried.
- Multi states iPhone 26.3 (job 030): 564/564 in 10 of 10 runs. Select iPhone 26.3: 362-364 of 364 per run (one run per case, so 10 runs of the keyboard subset).
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-030-gap-sel26 | ios26.3 | NativeSelectStatesIntegration keyboard subset x10 (GAPS) | 362/364 (run 7), 363/364 (runs 8,10), 362/364 (run 9) (explained: GAPS diagnostic runs, the misses are the select keyboard motion frames under study)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-030-gap-sel26 | ios26.3 | NativeMultiSelectStatesIntegration x10 (GAPS) | 564/564
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-032-gap-18 | ios18.6 | NativeMultiSelectStatesIntegration run4 (GAPS) | 722/724 (explained: GAPS diagnostic run 4 of the misses under study, the two misses are multi single-frame motion checks)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-033-gap-ac26 | ios26.3 | NativeAutocompleteStatesIntegration run6 (GAPS) | 866/870 (explained: GAPS diagnostic run 6, the misses are autocomplete caret frames under study)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-033-gap-ac26 | ios26.3 | NativeAutocompleteStatesIntegration run9 (GAPS) | 868/870 (explained: GAPS diagnostic run 9, the misses are autocomplete caret frames under study)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-031-chrome20 | chrome153 | picker-states web oracle x20 | 20/20 runs exit 0

EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-050-flat-trial | ios18.6 | NativeMultiSelectStatesIntegration multi-pointer-ltr interpolated flat pixels | 160/160 (runs 1 and 2)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-060-flat-mutation | ios18.6 | NativeMultiSelectStatesIntegration ripple fade +33 ms mutation (must fail) | 158/160 x3 (explained: mutation meant to fail; flat pixels fails 3/3, ltr and reduced)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-060-flat-mutation | ios18.6 | NativeMultiSelectStatesIntegration ripple fade -17 ms mutation (passes: check insensitive in this direction) | 160/160 x3

## Review Triage Log

EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-078-ac-since26 | ios26.3 | NativeAutocompleteStatesIntegration with caret since-patch x5 | 1472/1472 (runs 1,2,3,5), 1471/1472 (run 4: reduced escape opacity frame)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-073-open-sel26 | ios26.3 | NativeSelectStatesIntegration keyboard subset open-from-key off/on x10 | 362-364/364 off, 360-364/364 on (explained: no effect)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-074-open-sel18 | ios18.6 | NativeSelectStatesIntegration keyboard subset open-from-key off/on x10 | 362-364/364 both (explained: no effect)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-076-O-26 | ios26.3 | NativeSelectStatesIntegration -Onone vs -O x5 | 362-364/364 and 361-364/364 (explained: -O no effect)

EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-130-trial | macos | NativeAutocompleteStatesIntegration debug-logged caret patch x2 | 2/2 runs 1472/1472 (explained: debug run of the reworked caret patch, 0 misses in 2 runs)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-131-brk-sel26 | ios26.3 | NativeSelectStatesIntegration BRK hooks x10 | 1817/1820 (explained: 3 single-frame misses, run 1 arrowdown-open blank frame t=83, runs 2 and 6 reduced enter opacity t=33; none predicted by first-frame time)
EVIDENCE | 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete-132-flatint-18 | ios18.6 | NativeMultiSelectStatesIntegration flat pixels interpolated check base x2 and -17 ms x2 | 4/4 runs with 0 flat-pixels fails (explained: -17 ms shift passes, check insensitive in that direction, not accepted)
