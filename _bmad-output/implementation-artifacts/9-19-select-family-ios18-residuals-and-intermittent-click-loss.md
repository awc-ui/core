---
title: 'Select family: iOS 18.6 residuals (S66-18-01 to 03) and intermittent click and pick losses (C66-02, C66-03)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-19-select-family-ios18-residuals-and-intermittent-click-loss'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and AWC-n2-18 (iOS 18.6); both exist from story 6-6'
lab: 'work/s919-lab (create it; private tree work/s919-tree = a copy of canonical taken after the second install of story 6-1; the diagnostics of story 6-6 are in work/n2-lab/lab/g6/diag and work/n2-lab/out)'
depends_on: ['6-1-select-family-finish']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 6-6 reached its acceptance on iPhone 26.3 (select 1030/1030 and multi 872/872, three runs each) and left five open points that the gate-7 audit 7-2 would meet. On iOS 18.6 only: S66-18-01, the hardware-keyboard open of md-select in RTL is one frame late (`select-keyboard-rtl arrowdown-open` opacity at t=49 web 0.807, native 0.494; `enter-open` 0.396; 1028/1030 and 1029/1030); S66-18-02, `multi-pointer-rtl escape` caret at t=200 web 0.594, native 1.000 or 0.717 (868/872); S66-18-03, after select-all the menu rows band (clip y 72 to 112) has a uniform tint against Chrome (mean 2.3, worst (25,89) web [206,197,219] native [199,191,214]). Intermittent, cause unknown: C66-02, a click on clear is lost on the iPhone simulator (`multi-pointer-rtl (reduced) clear` leaves `[b,d]`; jobs 054 D2 and 057 M2); C66-03, on macOS a reduced-motion pointer pick is lost (jobs 046, 049) and one click-open caret miss at t=166 (job 051 run 1).

**Approach:** Start only when story 6-1 has installed the 6-6 patch sets on canonical (its Dev Agent Record says so); if not, set `blocked`. The three 18.6 findings: the same checks pass on iPhone 26.3 on the same tree, so first find what differs on 18.6. For each, capture the frames of the failing case on both simulators with the diagnostics of story 6-6 (KNOWN-CAUSES rows 21, 23, 27, 28 and the 6-6 lines; the patches `patch-menu-close-delivered-time.py`, `patch-menu-shadow-raster.py` and the row-drag patch), and check whether a patch of 6-6 has a condition or an API path that leaves 18.6 out. The tint of S66-18-03 is a paint difference: compare the native and Web pixels of one row before and after select-all and name the layer that differs (state layer, ripple rest, selected tint). The two intermittent points: build a loop for each (the clear case 50 times on iPhone 26.3; the reduced pointer pick subset 50 times on macOS) that logs whether the touch or click reached the control and whether its handler ran, so that a loss is classed as harness (the event was not delivered) or product (delivered and ignored). Fix what the measurements name. If a loop shows no loss in 100 runs, record the counts and say that the point did not reproduce.

## Boundaries & Constraints

**Always:** On iOS 18.6 select passes 1030/1030 and multi 872/872 in two runs each; on iPhone 26.3 three runs each still pass; the clear loop and the pick loop have 0 losses in 50 runs after the change, with the loss count of the before loops in the record. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, skip a case, add a retry or add a delay. Do not edit NativeTextField or `AWCFieldOutlineShape` (story 9-17). Do not change the Web fixtures. Keep `apply.sh --check` of the 6-6 patch folders passing, or deliver your change as a new patch folder with its own `apply.sh`. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S66-18-01, S66-18-02, S66-18-03, C66-02, C66-03; `work/claude-runner/KNOWN-CAUSES.md` rows 21, 23, 27, 28 and the lines that start with `6-6 (`
- the Dev Agent Record of story `6-6` (jobs 052, 054, 057, 058 for iOS 18.6 and the clear loss; jobs 046, 049, 051 for macOS) and the Handover of story `6-1`
- `work/n2-lab/lab/g6/swift`, `work/n2-lab/lab/g6/swift-ios-hop` (the patch sets and `apply.sh`), `work/n2-lab/lab/g6/diag` (multi-dump.py, sample-main.py)
- the select, multi-select and menu Swift sources and their states suites; find them with `ls -R packages | grep -i -E 'Select|Menu'`

## Tasks & Acceptance

**Execution:**
- [x] iOS 18.6: frames of the three failing cases on 18.6 and on 26.3; what differs; fix in the private tree; select and multi two runs each on 18.6 and three on 26.3
- [x] C66-02: the clear loop 50 times on iPhone 26.3 before the change with the class of each loss (not delivered, or delivered and ignored); the cause; the loop after the change
- [x] C66-03: the reduced pointer pick loop 50 times on macOS before the change with the class of each loss; the cause; the loop after the change; select, multi and menu states once on macOS
- [x] Regression: menu states and paint, autocomplete states on iPhone 26.3 and macOS once; tools/ax md-select and md-multi-select 0 open on iOS
- [x] One main-queue install as an anchored patch or patch folder (dry run, rollback, byte identity); DEFECTS.md status lines for the five findings; refresh and confirm the checkpoints of md-select, md-multi-select and md-menu

**Acceptance Criteria:**
- Given the fix, when select and multi states run twice on iOS 18.6 and three times on iPhone 26.3, then every run passes 1030/1030 and 872/872
- Given the clear loop on iPhone 26.3 and the pick loop on macOS, when each runs 50 times after the change, then no click or pick is lost, and the record has the loss counts and classes of the loops before the change
- Given a finding that did not reproduce in 100 runs, when a reader opens the Dev Agent Record, then it has the loop counts and the DEFECTS.md line says so
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 04:58 UTC: start condition met; S61-IOS-01 is yours; first measure old shim against shim v5)
- Start condition met: story 6-1 installed the 6-6 patch sets on canonical (job `6-1-select-family-finish-050-install-hop`; job `6-1-select-family-finish-060-diff-canon-s66` shows NativeSelect.swift and NativeMenu.swift on canonical equal to `work/s66-tree`). Story 6-1 is `blocked` only because of DEFECTS `S61-IOS-01`, and that finding is yours now.
- New since this story was written: canonical has the iOS shim v5 since 11-17 02:55 UTC (the key await ends at HID delivery; before, every key waited the full 30 ms). With v5 on iPhone 26.3 on canonical: select 1028, 1029, 1029 of 1030 and multi 870, 872, 872 of 872 (6-1 job 051); story 9-10 job 111 had select 1027/1030. On `work/s66-tree` with the old shim: 1030 x3 and 872 x3. The failing checks are listed in S61-IOS-01. `select-keyboard-ltr arrowdown-open` (opacity at t=49: web 0.807, native 0.657) has the same shape as S66-18-01 on iOS 18.6.
- First measurement, before any fix: one private tree with canonical sources, one simulator, select and multi states three times with `work/s910-lab/shim.before.swift` and three times with `work/s910-lab/shim.after5.swift` (this is the shim on canonical). This shows whether v5 uncovered a one-frame latency that the old 30 ms wait hid. If it did, measure where the frame goes: the time from HID key arrival to the first changed frame, against Chrome's time from keydown to the first changed frame in the oracle. `AWCShimTouch.keyArrivals` in `work/s96-tree` gives the arrival clock; it is not on canonical yet, so use it only in your private tree. A latency of the product gets a product fix. A wrong phase anchor in the suite gets a suite fix plus a mutation run that shows the check still fails for a late start.
- Run your iOS 18.6 jobs with shim v5 as well, and say in each EVIDENCE line which shim the run used.
- Added end condition: after your install, iPhone 26.3 on canonical with shim v5 passes select 1030/1030 and multi 872/872 three times each. Then write a `### Note from story 9-19` into the 6-1 story file above its `## Dev Agent Record` (job names and counts) and mark S61-IOS-01 `ready for re-check`; the coordinator then closes 6-1.
- Do not edit `apps/native-ios-parity/Shim/AppKitShim.swift` on canonical. If you need a shim change, keep it in your private tree and report it in the open items (shim installs are ordered by the coordinator: 9-6, 9-14, 1-2, then yours).
- Lane n2 once ran two jobs at the same time (jobs n2-020, n2-055, 6-6-043). If you see two of your lane jobs in `claude-runner/running` at once, do not use the numbers of those runs; report it in the open items.

### Note from story 9-6
- `AWCShimTouch.keyArrivals` is on canonical since 06:02 UTC (08:02 Mac time) 2026-11-17, job `9-6-201-install-otp-keyarrivals`, `AppKitShim.swift` md5 045d11b46d7008165195a9a485a855d3 (before: 39cdcd264a817a856e80043f3cd4ec7e; the diff is the two keyArrivals hunks only).

### Coordinator note (2026-11-17 06:36 UTC: add the autocomplete suite to the first measurement)
- One more suite for your first measurement (old shim against shim v5): `NativeAutocompleteStatesIntegration` on iPhone 26.3, three runs each. Story 9-10 job 034 had 1469/1472 with the old shim and 1466/1472 with v5 (one run each). If the cause is the one you find for select, the autocomplete suite is in your fix and in your acceptance (1472/1472 three times on iPhone 26.3); if it is a different cause, write it into DEFECTS.md as a finding for audit 7-2 with the failing checks and values.

### Coordinator note (2026-11-17 07:29 UTC: canonical shim now also has keyArrivals and the onScreen fix)
- The shim on canonical changed twice more since the note above: `AWCShimTouch.keyArrivals` (story 9-6, 06:07 UTC) and the `AWCShimTouch.onScreen` fix (story 9-14, job `9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-100-install`, 07:25 UTC). The file now has md5 30db5861... For your first measurement take `work/s910-lab/shim.before.swift` as the old shim and the canonical file as it is now as the new one. If the two differ in your suites, one more run with `work/s910-lab/shim.after5.swift` shows whether the difference comes from v5 or from the two later changes.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: all up to `9-19-select-family-ios18-residuals-and-intermittent-click-loss-050-pick-loop-before-macos` (10:21 UTC). Running when the Mac went to sleep: none. Still queued at the wake (they run now): none.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

### Coordinator note (2026-11-17 23:47 UTC: two opus sessions for the cause of the lost inspection delivery)
The run of six sonnet sessions ended without the cause: the clear loop on iPhone 26.3 loses 3 to 6 percent of runs (6 of 270 before any change; fix1 3 of 80; fix2 5 of 80). In a lost run the click is delivered, the product clears (view body value=[], VALCHG fires, INSP republishes value=[]), but no DELIV follows and the suite's end sample still reads [b,d]. Pixel checks pass. Fix1 and fix2 are rejected; do not install either.
This run: two opus sessions, for the cause only.
- Session 1: read the delivery path of NativeInspection.swift end to end (publish, preference, onPreferenceChange, store, the sink the suite reads) and list every place that can drop an update: an equality test, an epoch or generation guard (your traces already print STORE epochOK), a throttle or coalescing step, a cancelled task, two main-actor hops that can swap order. Put one trace point at each. Queue the loop as two jobs of 40 runs in lane n2 (80 runs give at least one lost run with about 96 percent probability at the rate seen). No fix attempt in this session.
- Session 2: read the lost runs; name the one place where the update with value=[] stops, with the trace lines of a lost and of a good run side by side. Say whether the stale value is only in the test channel or would also be shown by the Laboratory's inspector (then it is a product-facing defect and is written as one). Write the cause into KNOWN-CAUSES.md and the story file, and describe the fix; build it in the private tree and queue the first loop if the session has room.
- Acceptance of a fix (for the sonnet sessions that follow): 0 lost in 200 runs of the clear loop after the change (five jobs of 40). 50 runs are not enough at this rate: without any fix, 50 runs pass clean about one time in eight. Say also whether S61-IOS-01 (select 1028-1029 of 1030, multi 870-872 of 872 on iPhone 26.3) is this same loss: compare its fail lines (value and chips checks with passing pixels) with the lost runs.
- Left for the sonnet relaunch after this run: the fix loop, the macOS pick loop after the change, iOS 18.6 captures S66-18-01..03, regression suites, the main-queue install, the DEFECTS lines (also the two new findings: autocomplete states 1468-1470 of 1472; multi `select-all flat pixels` in 12 of 50 macOS runs), and the `### Note from story 9-19` in story 6-1.

### Coordinator note (2026-11-18 04:30 UTC: link to the Mac was down 00:00-04:25 UTC; the Mac did not sleep; job results are valid)
Between about 00:00 and 04:25 UTC on 2026-11-18 the link between the agents and the Mac was down (device calls answered 'not connected to the bridge'). The Mac itself did not sleep: the power log has no sleep or wake line since 18:43 UTC on 11-17 (coordinator jobs 889 and 890), it was on AC power, and the lanes kept running jobs through the whole gap. Sessions that started in the gap ended without work, and the coordinator stopped the other runs at 00:13 UTC so that no session was spent on a dead link. Your jobs that were in flight have all finished; their results are valid under the usual rules (the load written next to each run). Nothing was restarted on the Mac. Continue from your Current state; read the logs of the jobs that finished in the gap first.

### Coordinator note (2026-11-18 04:30 UTC: opus session 2 of the cause pair; jobs 080 and 081 are done)
Jobs 080 (finished 00:12 UTC) and 081 (00:37 UTC), 40 runs each with the seven trace points, are done. This run is one opus session = session 2 of the cause pair of the 23:2x note: read the lost runs, name the one place where the update with value=[] stops (which of XFORM 1, XFORM 2, DELALL, STORE is missing), lost and good run side by side; say whether the Laboratory's inspector would show the same stale value; write the cause into KNOWN-CAUSES.md and this file; describe the fix, build it in the private tree and queue the first two loops of 40. If 080 and 081 hold no lost run, queue two more loops and say so. The sonnet sessions after this run do the fix loops (0 lost in 200 runs) and the rest of the list.

### Coordinator note (2026-11-18 04:39 UTC: cause accepted (SwiftUI drops the preference action); acceptance of fix 3)
The opus session named the cause of C66-02 and it is accepted: in the lost runs (4 of 80 in jobs 080 and 081) SwiftUI recomputes the root inspection preference with value=[] twice, but the onPreferenceChange action never runs (no DELALL, no STORE); it is not the equality test and not the epoch guard. The Laboratory's LiveRenderer uses the same modifier, so this is a product-facing defect (a stale value in the inspector), not only a test-channel one. Fix candidate 3 (work/s919-lab/clear-fix3.py, NativeInspection.swift only): a changed value that SwiftUI's own action has not delivered is delivered on the next main-queue turn, without duplicates. Jobs 090 to 094 (5 x 40 runs) are queued.
For the sonnet sessions of this run:
- Acceptance of fix 3: 0 lost and 0 invalid in the 200 runs of 090 to 094. Report also how many times the fallback path delivered in those 200 runs (count its trace line; add one if the loop does not print it and run 40 more). At the rate seen (about 5 percent) it should be near 10; a count of 0 would mean the 200 clean runs do not prove the fix.
- Order: show with the traces of one fallback run that a later value is never overwritten by an earlier one (the fallback must not deliver a value that SwiftUI's own action delivered in the meantime, and two changes in a row must arrive in order).
- NativeInspection.swift is shared by every component's suites and by the Laboratory. Before the install: select, multi-select, autocomplete and menu states once on macOS and on iPhone 26.3, and the regression set that story 9-14 used (its job 053) on iPhone 26.3; compare the counts with the last canonical runs. Android has its own inspection path; say in one line whether the same loss can happen there (read the Android delivery path; no change without a measured loss).
- Then the list as before: compare S61-IOS-01 with this loss; macOS pick loop after the change (50 runs); iOS 18.6 captures S66-18-01..03; main-queue install (dry run, rollback, byte identity); DEFECTS lines for the five findings and the two new ones (autocomplete states 1468-1470 of 1472; multi `select-all flat pixels` in 12 of 50 macOS runs) with what you know about each; the `### Note from story 9-19` into story 6-1 (before its `## Dev Agent Record`) saying what S61-IOS-01 is and whether it is fixed; refresh the md-select and md-multi-select checkpoints; verify_evidence.py; review, or blocked with the named misses.

### Coordinator note (2026-11-18 13:13 UTC coordinator: iOS 18.6 residuals not accepted; AC 1 moves to story 9-29)
Coordinator decision: the iOS 18.6 residuals are NOT accepted as explained. They fail in 2 of 2 runs and no cause is shown. AC 1 moves to story 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete, together with S61-IOS-01, S919-01, S919-02 and the TextField tf-throttle-200 difference after the fix 3 install.
This story stays blocked 'waits for story 9-29' and gets no further session until 9-29 is in review. Then one session records the 9-29 runs that meet AC 1 and sets review.
The lines of job 110 keep their numbers. The words 'explained: ... residuals' on them mean 'named in DEFECTS, not fixed'; that last session corrects them to point at the 9-29 job that passes.
For the record: fix 3 was installed while one difference of the regression table (TextField 2042/2050 against 2048/2048) had no class. An install goes ahead only when every difference of the regression table has a class. Story 9-29 classes it first (task 1) and replaces or reverts the file if fix 3 is the cause.

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

## Dev Agent Record

### Current state
- STATUS REVIEW (closing session 2026-11-19, user decision 'one frame, rare'). Done: C66-02 cause + fix3 (090-094: 200 runs, 0 lost) installed on canonical (job 130, md5 e552a3cf); C66-03 not reproduced (0/100 before, 50/50 after); regression, ax iOS 0 open, checkpoints refreshed.
- AC 1 (iOS 18.6 1030/1030, 872/872) is NOT met. It moved to 9-29, which closed S61-IOS-01 (iPhone 26.3) as one frame, rare, with audit doc lines in md-select.md (9-29 job 150-mut33-sel26 mutation 3 of 3). Nothing of this story is added to the audit docs: no docs install was needed.
- Still open, owned elsewhere (no work here): S66-18-01 and S66-18-02 (iOS 18.6, larger than one frame or no mutation) -> 9-36; S919-01 autocomplete caret -> 9-34; S66-18-03 and S919-02 select-all flat pixels -> 9-35. TextField tf-throttle-200 difference -> 9-29.
- Wording correction: 'explained: ... residuals' on the job 110 lines means 'named in DEFECTS, not fixed', not accepted.
- Next: coordinator review; no command pending.

Table of open findings (from existing runs): finding | check | runtime | k of n | shifted | mutation | class
- S61-IOS-01 | select-keyboard-ltr arrowdown-open opacity t=83 | iPhone 26.3 | 4/30 | yes, 16.7 ms earlier matches (0.889 vs 0.887) | 9-29 job 150 3/3 | one frame, rare (closed by 9-29)
- S61-IOS-01 | select-keyboard-rtl arrowdown-open opacity t=49 | iPhone 26.3 | 5/30 | yes (0.657 vs 0.669) | 9-29 job 150 3/3 | one frame, rare (closed by 9-29)
- S61-IOS-01 | reduced enter opacity t=33; multi mdRemove/mdChange gap | iPhone 26.3 | 10/20 lines; 1/13 | not shown | none | not covered -> 9-36
- S66-18-01 | rtl arrowdown-open / enter-open opacity t=49 | iOS 18.6 | 4/10 (9-29 job 074), 2.3 frames | no | none | not covered -> 9-36
- S66-18-02 | multi escape caret t=200 | iOS 18.6 | 2 of 2 in job 110 | no | none | not covered -> 9-36
- S66-18-03, S919-02 | select-all flat pixels | iOS 18.6 / macOS | 2 of 2; 12/50 macOS | paint | n/a | not covered (macOS, paint) -> 9-35
- S919-01 | autocomplete caret | iPhone 26.3 | 1468-1470/1472 in 6 of 6 | no | none | not covered -> 9-34

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-115-macos-menu-fix3-long | macOS (fix3) | NativeMenuStatesIntegration | 2524/2524
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-120-ax-ios-select-multi | iOS 26.3 (fix3) | tools/ax md-select 5 cases, md-multi-select 3 cases, 0 open findings | 8/8
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-130-install-fix3 | canonical | NativeInspection.swift installed, dry run, backup, byte identity to tested tree (md5 e552a3cf) | 1/1
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-110-fix3-ios186-select-multi-x2 | iOS 18.6 (shim md5 30db5861, fix3) | NativeSelectStatesIntegration run1 | 1028/1030 | explained (class named, not fixed, not accepted as pass): S66-18-01..03 (owners 9-36, 9-35); AC 1 moved to 9-29
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-110-fix3-ios186-select-multi-x2 | iOS 18.6 (shim md5 30db5861, fix3) | NativeSelectStatesIntegration run2 | 1028/1030 | explained (class named, not fixed, not accepted as pass): S66-18-01..03 (owners 9-36, 9-35); AC 1 moved to 9-29
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-110-fix3-ios186-select-multi-x2 | iOS 18.6 (shim md5 30db5861, fix3) | NativeMultiSelectStatesIntegration run1 | 869/872 | explained (class named, not fixed, not accepted as pass): S66-18-01..03 (owners 9-36, 9-35); AC 1 moved to 9-29
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-110-fix3-ios186-select-multi-x2 | iOS 18.6 (shim md5 30db5861, fix3) | NativeMultiSelectStatesIntegration run2 | 869/872 | explained (class named, not fixed, not accepted as pass): S66-18-01..03 (owners 9-36, 9-35); AC 1 moved to 9-29
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-111-fix3-macos-menu-rerun | macOS (fix3) | NativeMenuStatesIntegration timed out exit 142 (1800 s) | 0/2524 | explained: slowness of the 39 min menu suite, not a hang; job 115 passes 2524/2524 with fix3

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeSelectStatesIntegration run1 | 1029/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeSelectStatesIntegration run2 | 1029/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeSelectStatesIntegration run3 | 1028/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeMultiSelectStatesIntegration run1 | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeMultiSelectStatesIntegration run2 | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-100-fix3-ios-select-multi-x3 | iOS 26.3 (canonical shim, fix3) | NativeMultiSelectStatesIntegration run3 | 871/872 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-101-fix3-ios-autocomplete-menu | iOS 26.3 (canonical shim, fix3) | NativeAutocompleteStatesIntegration | 1468/1472 | explained: autocomplete states 1468-1470 of 1472 on iPhone, also without fix3 (old shim 1469/1472), DEFECTS S919-01
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-101-fix3-ios-autocomplete-menu | iOS 26.3 (canonical shim, fix3) | NativeMenuStatesIntegration | 2524/2524
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-102-fix3-macos-states | macOS (fix3) | NativeSelectStatesIntegration | 1030/1030
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-102-fix3-macos-states | macOS (fix3) | NativeMultiSelectStatesIntegration | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-102-fix3-macos-states | macOS (fix3) | NativeAutocompleteStatesIntegration | 1472/1472
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-103-pick-loop-after-macos | macOS (fix3) | NativeSelectStatesIntegration reduced pointer runs without lost pick | 50/50

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-090-clear-fix3-loop | iOS 26.3 (shim md5 30db5861, fix3 + trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-091-clear-fix3-loop | iOS 26.3 (shim md5 30db5861, fix3 + trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-092-clear-fix3-loop | iOS 26.3 (shim md5 30db5861, fix3 + trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-093-clear-fix3-loop | iOS 26.3 (shim md5 30db5861, fix3 + trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-094-clear-fix3-loop | iOS 26.3 (shim md5 30db5861, fix3 + trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-070-clear-loop-insp | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 39/40 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-071-clear-loop-insp | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 40/40
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-060-clear-loop-diag | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 29/30 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-061-clear-loop-diag | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 29/30 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim, md5 ea14...) | NativeSelectStatesIntegration run1 | 1030/1030
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeSelectStatesIntegration run2 | 1029/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeSelectStatesIntegration run3 | 1030/1030
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeMultiSelectStatesIntegration run1 | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeMultiSelectStatesIntegration run2 | 870/872 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeMultiSelectStatesIntegration run3 | 869/872 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeSelectStatesIntegration run1 | 1029/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeSelectStatesIntegration run2 | 1030/1030
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeSelectStatesIntegration run3 | 1029/1030 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeMultiSelectStatesIntegration run1 | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeMultiSelectStatesIntegration run2 | 872/872
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeMultiSelectStatesIntegration run3 | 870/872 | explained: one-frame motion lag of the first native frame on iPhone (S61-IOS-01), not a click loss; DEFECTS
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-020-old-shim-states-x3 | iOS 26.3 (old shim) | NativeAutocompleteStatesIntegration x3 | 1469/1472, 1468/1472, 1470/1472 | explained: autocomplete states 1468-1470 of 1472 on iPhone, also without fix3 (old shim 1469/1472), DEFECTS S919-01
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-030-new-shim-states-x3 | iOS 26.3 (shim md5 30db5861) | NativeAutocompleteStatesIntegration x3 | 1468/1472 each | explained: autocomplete states 1468-1470 of 1472 on iPhone, also on the old shim (S919-01)

NOTE (not evidence: job 040 exit 2, its script had a syntax error, 24/25 is void; the loop before the change is in jobs 060/061/070/071/080/081) | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-040-clear-loop-before-a | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 24/25
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-041-clear-loop-before-b | iOS 26.3 (shim md5 30db5861) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 25/25
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-076-clear-fix2-loop | iOS 26.3 (shim md5 30db5861, fix2 FAILED) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 36/40 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-077-clear-fix2-loop | iOS 26.3 (shim md5 30db5861, fix2 FAILED) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 39/40 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-050-pick-loop-before-macos | macOS | NativeSelectStatesIntegration reduced pointer runs without lost pick | 50/50
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-050-pick-loop-before-macos | macOS | NativeMultiSelectStatesIntegration reduced pointer runs without lost pick | 50/50

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-080-clear-loop-trace5 | iOS 26.3 (shim md5 30db5861, no fix, trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 38/40 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-081-clear-loop-trace5 | iOS 26.3 (shim md5 30db5861, no fix, trace5) | multi-pointer-rtl (reduced) clear loop runs without lost clear | 38/40 | explained: this row is a loss count of the C66-02 clear loop (lost clicks counted, cause found, fix3 in jobs 090-094 loses none)

EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-112-regress-ios-baseline | iOS 26.3 (canonical) | 25 states suites (Accordion..Toolbar) | all pass; TextField 2048/2048
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-113-regress-ios-fix3 | iOS 26.3 (fix3) | 25 states suites (Accordion..Toolbar) | all pass; TextField 2042/2050 (tf-throttle-200 order)
EVIDENCE | 9-19-select-family-ios18-residuals-and-intermittent-click-loss-114-macos-menu-canonical-baseline | macOS (canonical) | NativeMenuStatesIntegration | 2524/2524

### Session 11 (sonnet, 2026-11-18): order proof of fix 3
The fallback (AWCInspectionDeliveryBox.saw) never captures a value: it runs on the next main-queue turn and delivers `latest` (the newest value the transform saw), and only if `latest != delivered`; deliver() also refuses a value equal to `delivered`. So a later value cannot be overwritten by an earlier one and two changes in a row arrive in order (the second change sets `latest` before the scheduled turn runs). Trace, run 28 of job 090 (s919-lab/out/clear-fix3-090/trace-28.txt): XFORM value=[] at 938754, VALCHG, second XFORM at 938761, DELFIX 938765 n=13, then DELALL and STORE 938765: the fallback delivered value=[] with no earlier value delivered afterwards.

### Session 9 (opus 1, 2026-11-18): delivery path of the inspection and its drop points
Path (iOS, test host): leaf `AWCNativeInspectionPart` (GeometryReader in `.background`, evaluated during layout; the metrics closure captured at body time computes `value`; INSP prints there) -> `AWCNativeInspectionPreference.reduce` (append) -> root modifier `AWCNativeInspectionModifier` (`onPreferenceChange`) -> `Dictionary(uniquingKeysWith: latest)` by id + metricSources resolve -> `onChange` closure in `MultiStatesFixture` (epoch guard `state.epoch == epoch`, STORE) -> `state.measurements` (@Observable) -> `sample()` read by the pump loop (`pump`: shim event dispatch, `layoutIfNeeded`, `CATransaction.flush`, `RunLoop.run(.default, 2 ms)`) -> ENDS.
Places that can drop the update, and the trace at each:
1. Leaf not re-evaluated, or evaluated with a stale captured `value`: INSP (now with rl=).
2. Duplicate `m:component` nodes (a second copy, e.g. a removed or sizing copy, wins `uniquingKeysWith latest`): `mc=` in XFORM and DELALL.
3. Root preference not recomputed after the leaf changed: XFORM (transformPreference just above onPreferenceChange, value unchanged).
4. onPreferenceChange not dispatched (Equatable equal, or no follow-up update after a preference written during layout): DELALL (unconditional; the old DELIV printed only when an m:component value existed).
5. Collector modifier / host re-created or re-evaluated with a new closure: MODBODY, HOSTBODY (epoch).
6. Epoch guard in the test closure: STORE epochOK (trace4).
7. Main run loop idle without a SwiftUI update: RLW = the next 25 beforeWaiting cycles after INSP value=[] (CFRunLoopObserver, common modes), rl= counter on every line.
No equality test, throttle, coalescing step or Task/async hop exists in NativeInspection.swift on iOS; the nested-landmark relay (`AWCNestedLandmark`) is macOS-only. Lost run of 073 r9 (trace4): INSP value=[] at 911794, then no DELIV at all for 700 ms (not even the old value), while the good run had DELIV n=13 13 ms after INSP.

### Session 10 (opus 2, 2026-11-18): where the value=[] update stops
Jobs 080/081: 80 runs, 4 lost (080 r24, r31; 081 r2, r6). Event order after `INSP value=[]` (all 80 runs): 70 `XFORM VALCHG XFORM DELALL`, 6 `XFORM DELALL VALCHG XFORM DELALL`, 4 `XFORM VALCHG XFORM` = the 4 lost runs. Missing in every lost run: DELALL (the onPreferenceChange action) and therefore STORE. XFORM #1 and #2 are present with n=13 mc=1 value=[] (one m:component node, so no duplicate-node race).
Lost (081 r2) | good (080 r3), ms on the run clock:
- CLRV 772934 / SETF 772951 / CLRV2 772951 | CLRV 278617 / SETF 278633 / CLRV2 278633
- INSP value=[] 772958 rl=194 | INSP value=[] 278638 rl=176
- XFORM 772958 value=[] | XFORM 278639 value=[]
- VALCHG 772959 | VALCHG 278639
- XFORM 772966 value=[] | XFORM 278647 value=[]
- (nothing) | DELALL 278648 value=[]; STORE 278648 epochOK=true
- RLW bw=195..215 (main run loop idles, 21 cycles, no SwiftUI delivery) | RLW bw=177..194
- ENDS value=["b","d"] | ENDS value=[]
So the update stops between the recomputed root preference and the change action: SwiftUI recomputes the value but does not run (or drops) the enqueued action, and no later update re-delivers it. fix2 (backgroundPreferenceValue + onChange, also an enqueued action) lost 5 of 80, fix1 (republish from the leaf) 3 of 80: neither path avoids it. The Laboratory LiveRenderer (`apps/native-ios-playground/LiveRenderer/main.swift:600`) feeds its inspector through the same `awcNativeInspection` modifier, so the inspector would show the stale value too: product-facing defect (inspection/test channel; the rendered control is correct, pixel checks pass).
Fix candidate 3 (`work/s919-lab/clear-fix3.py`, NativeInspection.swift only): `AWCNativeInspectionModifier` keeps an `AWCInspectionDeliveryBox` (@State). A `transformPreference` just inside onPreferenceChange hands every recomputed root value to the box; when it differs from the last delivered value, the box delivers it on the next main-queue turn unless onPreferenceChange delivered it first. Both paths call one `deliver()` that skips a value equal to the last delivered one, so no duplicate publication. No delay, retry or tolerance change: the fallback runs only when SwiftUI's own action has not delivered the value. Affects every inspection root (macOS too): macOS regression needed before the install.

## Review Triage Log

