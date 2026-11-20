---
title: 'md-table: iOS sort click starts the row motion 40 to 55 ms late (S7-15-01); the Web role flips between table and treegrid in tools/ax (S7-15-02)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-16-table-ios-sort-click-late-start-and-web-role-race'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d6 · android lane a1 (emulator-5556), only for the tools/ax run and one states run · simulators AWC-d6 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-d6-ipad (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s916-lab (create it; private tree work/s916-tree = a copy of canonical; the reviewer's evidence is in work/audit/s7-15)'
depends_on: ['7-15-recheck-table']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-15 left md-table at FAIL with two findings (DEFECTS.md S7-15-01 and S7-15-02); md-table-pagination and md-table-cell now pass. S7-15-01: on iOS `NativeTableStatesIntegration` fails 2 checks in 3 of 6 runs (3860/3862, on iPhone 26.3 and on iOS 18.6): case `tb-contract [0] click-calories-default-desc`, motion `order:n0.1.1.3` 37/44 and `order:n0.1.1.0` 36/44. The DIAG lines show input to t0 54 ms; the native row order value stays 3.00 until +71 ms and 2.98 until +121 ms, while Web is 2.43 at +33 ms. The native motion starts 40 to 55 ms late and then follows the same curve. The load was 103 at one failing run, under the 300 line of PARALLEL.md; macOS (3859/3859 twice) and Android pass. S7-15-02: the Web role of the same md-table fixture flips between `treegrid` (rows named) and `table` (rows unnamed) from one tools/ax capture to the next. When Web is `table`, tools/ax reports macOS `name` and `focus` findings as open: 10 open in 7-15-003-ax-mac, 5 in 7-15-A004-ax-android-web, 0 in 7-15-005-rerun on the same bytes. KNOWN-CAUSES row 63 describes the race; the wait that story 9-11 put into tools/ax `web.mjs` (about line 100) covers only fixtures with an expandable row.

**Approach:** S7-15-01 first, because it needs measurements. In your private tree run the one case ten times on iPhone 26.3 with the DIAG motion lines and a timestamp log in ms at: the click release, the sort handler, the model change, the first body evaluation of the reordered rows, the first frame in which the order value differs from 3.00. Say which interval holds the 40 to 55 ms in the failing runs and how long the same interval is in the passing runs. Confirm or reject each candidate with the numbers: the first draw of the reordered row tree (the family of KNOWN-CAUSES rows 29 and 33), the animation starting one transaction after the model change (row 19 is the macOS case of the same suite), a first-responder or focus change on the header click (rows 21 and 23). Fix the cause in the component: the motion must start in the frame after the click as on Web, in every run. Then S7-15-02: read the Web md-table source (`syncRows`, or the code that sets the host role) and say when the role is `treegrid` and when it is `table` for the sorted fixture. If the role depends on a start-up race for the same DOM, that is a fact of the Web source: do not change the Web source, record it, name the settled role, and make tools/ax wait for a stable role before the capture of every md-table fixture, not only when a row has `[expandable]`. Then check that the native role, names and focus match the settled Web role on macOS, iOS and Android.

## Boundaries & Constraints

**Always:** `NativeTableStatesIntegration` passes 3862/3862 in ten of ten runs on iPhone 26.3 and three of three on iOS 18.6 after the change; the before runs of the same day and lane are in the record with their failing count. tools/ax md-table has 0 open in three macOS runs in a row and in one run each on iOS and Android, and the Web role is the same in every capture. The rules in project-context.md apply.

**Never:** Do not widen a tolerance, skip the case, add a retry or add a delay. Do not change the Web source or the fixture expectations. Do not edit `NativeFocusBridge.swift` (story 9-15 is changing it): if your cause is in the bridge, write a Handover line in story 9-15 and say so in `open_items`. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S7-15-01 and S7-15-02; `work/claude-runner/KNOWN-CAUSES.md` rows 1, 19, 29, 33 and 63
- `work/audit/s7-15/` -- `ios-iphone2/console-s5.log` (DIAG motion lines), `ax/others/md-table/report.md`, `ax-android3/md-table/report.md` (Web `table`) and `ax-ios2/md-table/report.md` (Web `treegrid`)
- the Swift md-table sources and `NativeTableStatesIntegration`; find them with `ls -R packages | grep -i Table`
- the Web md-table source in `packages/core` and `tools/ax/web.mjs`; the Dev Agent Record of story `9-11` (its tools/ax wait)

## Tasks & Acceptance

**Execution:**
- [x] S7-15-01: the case ten times on iPhone 26.3 before the change (failing runs and load per run); the timestamp table for one failing and one passing run
- [x] Name the cause with the numbers (add a KNOWN-CAUSES.md row if it is new); fix in the private tree; ten runs on iPhone 26.3 and three on iOS 18.6 at 3862/3862; Table states and paint once on macOS, on iPad and on Android
- [x] S7-15-02: say from the Web source when the role is `treegrid` and when `table`; tools/ax waits for a stable role for every md-table capture; three macOS tools/ax runs in a row with 0 open and the same Web role, one run on iOS and one on Android
- [x] One main-queue install as an anchored patch (dry run, rollback, byte identity); Table states on canonical after the install (iPhone 26.3 three runs, macOS one run); DEFECTS.md status lines `ready for re-check` for S7-15-01 and S7-15-02; refresh and confirm the md-table checkpoint

**Acceptance Criteria:**
- Given the fix, when `NativeTableStatesIntegration` runs ten times on iPhone 26.3 and three times on iOS 18.6, then every run passes 3862/3862, and the record holds the before runs of the same day with their failing count
- Given tools/ax for md-table, when it runs three times in a row on macOS and once on iOS and on Android, then the Web role is the same in every capture and no finding is open
- Given the fix, when a reader opens the Dev Agent Record, then it names the interval that held the 40 to 55 ms with the measured numbers, and the fix contains no wait
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 22:21 UTC: start; measure on today's shim first)
Start now. Since the s7-15 runs (2026-11-16) the canonical iOS shim has changed twice: key arrivals (story 9-6) and the harness clock fix in `AWCShimTouch.onScreen` (story 9-14, installed 2026-11-17 07:25 UTC; md5 of apps/native-ios-parity/Shim/AppKitShim.swift starts with 30db5861). Story 9-14 showed that a click-to-first-frame lateness of this kind on the phone (rail states, S7-4-02) was the harness clock and not the product.
- So measure first, before any product change: Table states on iPhone 26.3 five times and on iOS 18.6 twice on a copy of today's canonical. If every run is 3862/3862, S7-15-01 was the harness clock: record the before (the s7-15 runs) and the after, prove the other direction with one run on a private tree in which the onScreen hunk of 9-14 is reverted (the old misses come back), add a KNOWN-CAUSES line and the DEFECTS status line `ready for re-check`, and go on to S7-15-02.
- If misses remain: class every late frame with the main-thread gap trace of story 9-20 (tree work/s920-tree, GapRec; job 9-20-008 shows how) as inside or outside a main-thread block, and say what runs in the block. A block inside UIKit (responder change, keyboard) is the cause class of story 9-23: report it with the numbers in the Handover and do not move product code around it. A late start in the product's own code is yours to fix.
- Do not change AppKitShim.swift; a shim change is reported and installed by its own story.
- Timing runs go through `slot.sh timing` as in the other stories; write the Mac load at the start of each run next to its result.
- S7-15-02 (the Web role flips between table and treegrid in tools/ax) is independent of this; run it in parallel jobs.

### Coordinator note (2026-11-18 04:30 UTC: link to the Mac was down 00:00-04:25 UTC; the Mac did not sleep; job results are valid)
Between about 00:00 and 04:25 UTC on 2026-11-18 the link between the agents and the Mac was down (device calls answered 'not connected to the bridge'). The Mac itself did not sleep: the power log has no sleep or wake line since 18:43 UTC on 11-17 (coordinator jobs 889 and 890), it was on AC power, and the lanes kept running jobs through the whole gap. Sessions that started in the gap ended without work, and the coordinator stopped the other runs at 00:13 UTC so that no session was spent on a dead link. Your jobs that were in flight have all finished; their results are valid under the usual rules (the load written next to each run). Nothing was restarted on the Mac. Continue from your Current state; read the logs of the jobs that finished in the gap first.

### Coordinator note (2026-11-18 09:40 UTC - coordinator: relaunch; three things to settle before the install)
Relaunch after the session limit; jobs 016, 017 and A016 are in flight (the first session waits for them). Before the install job, three things must be plain in the record:
1. iPhone 26.3 after the fix. Job 013 had 6 of 10 runs passing, with 4 misses in click-calories-default-desc; job 014 had 9 of 10. Before the fix (jobs 005 and 009) iPhone 26.3 had no motion miss in 13 runs: the runs that did not pass had lost a click. Say what differs between the builds of 013 and 014. If nothing differs, the 4 misses of 013 count against the fix. Count the after-fix runs of 013, 014 and 017 together, per case, next to the 13 before-fix runs. Class every after-fix miss with the GAPS record of job 014 (what the main thread does in the gap: the lay17 block is product work). The fix is installed only when iPhone 26.3 does not miss more often after it than before it, or when every extra miss has a proof that it is not product work. 'Load noise' without a proof is not a class. If the click-action layout block is the cause, that is a product matter: fix it or set escalate.
2. The lost clicks before the fix (4 of 13 runs on iPhone 26.3: 3816, 3839, 3842, 3859; tb-pagination-rtl select-row-0 with events [], at load 36 and 370). Say whether the after-fix runs still lose clicks, whether this is a filed finding, and what its class is (story 9-19 found one cause of lost events in the select family: an inspection preference change that is never delivered; check whether the table suite reads its events the same way). If it is not filed, file it in DEFECTS.md with the runs.
3. The Web role race. The wait for rows, role and 8 frames in tools/ax/web.mjs is a harness matter. The nudge (mdRowgroupSlotChange) makes the Web component compute its role again: that works around a Web source defect (the role stays 'table' when the reflected expandable attribute lands after the last syncRows, md-table.tsx near line 1333). Record it in DEFECTS.md as a finding of the Web source with file and line, say in docs/native-parity for md-table that the comparison uses the settled role, keep the nudge bounded, and show one run without the nudge and with the wait only (does the wait alone suffice in 6 of 6?). Audit 7-19 judges it.
Then as planned: install job on the main queue with its dry run, canonical states runs, DEFECTS status lines, checkpoint, KNOWN-CAUSES rows, verify_evidence, status review.

### Coordinator note (Coordinator note 2026-11-18 15:45 UTC: install stands; residual miss has no class yet; lost-click loop on canonical; evidence lines by hand)
Coordinator ruling after session 11. The install (job 100) stands: the interleaved A/B (018+020) has fix 18/22 and base 18/22, so the condition 'does not miss more often' is met. Two things are still open, and the story is not in review until they are settled. Audit 7-19 follows in this chain.

1. The residual motion miss on iPhone 26.3 (click-calories-default-desc / click-dessert motion; 013 run1, 014 run7, 017 runs 5, 8, 9 at loads 15 to 19, 020, 021 run2; iPad 3861/3862 in 016) has NO class yet. 'Shared by base and fix' says the fix did not cause it; it does not say it is not product work. Correct the DEFECTS status line of 2026-11-18 and KNOWN-CAUSES row accordingly (replace 'is not product work' / 'is the harness class' by 'not yet classed'). Then class it, in the private tree only:
- Reduce to the failing cases and run them 20 times on iPhone 26.3 with the GAPS record. For every failing AND every passing run write: the block in the delivery turn of the click (length, what runs in it; the layout block is product work), and the time from the delivered touch-up to the start of the row motion clock. Story 9-29 found for the select family that the block has the same length in passing runs and that the product's motion clock starts 20 to 25 ms into the turn, after product work; check whether the table is the same.
- (a) If the row motion clock starts after product work in the turn: start it from the delivered touch-up time (pattern of the close fix of story 6-6, close(requestedAt:), bounded 0..100 ms; KNOWN-CAUSES row 26). 20 runs alternating with and without; a +33 ms mutation of the row motion must fail. If the misses go to 0, it is a product fix: regression (table paint and states on macOS, states iPhone 26.3 x3, iOS 18.6 x2, iPad once, Android unchanged so no run), one main-queue install with dry run, backup and byte identity, canonical runs.
- (b) scripts/build-awcui.sh compiles the product library with -Onone. With a private copy of the script using -O (never the canonical script): the reduced cases 5 runs -Onone and 5 runs -O, alternating, with GAPS; report block length and misses per build. A measurement for the coordinator; nothing installed from it.
- Short trial job first for each change (build plus one case); every script stops at the first failed build; write load1max per run; runs above load 30 are a class of their own.

2. Lost clicks (S9-16-02). Canonical now has fix 3 of story 9-19 in NativeInspection.swift (job 130, the inspection preference change that SwiftUI did not deliver). On a fresh copy of canonical: loop the two cases that lost clicks (tb-pagination-rtl select-row-0, tb-hover-select-ltr click-row-3-cell-rowclick) 100 times on iPhone 26.3 and count runs with events []. Put the count and the count before fix 3 (4 of 13 base runs, 1 of 10 in 018) in S9-16-02; 0 of 100 closes it as 'fixed by 9-19 fix 3, ready for re-check', otherwise it stays open with the numbers.

3. EVIDENCE lines. No script and no bulk edit. In your last session, by hand, a partial-pass line may get the word explained only with its own true reason:
- base-build runs (005, 006, 009, 018 base run1): the build before the fix, the misses are the defects under test (name the id);
- 019 run4,5: the control run without the nudge that shows the wait alone is not enough (S9-16-01);
- after-fix runs with the residual (013 run1, 014 run7, 017, 021 run2, 016 iPad): only after point 1, with the class and the job that proves it, or with the id of the finding that stays OPEN for audit 7-19.
If an edit is refused, leave the line as it is and say so in the summary; do not try another way.

End states: review when points 1 and 2 are in the record (cause fixed, or class table with (a) and (b) numbers and an OPEN finding for the audit) and the verifier has 0 hard failures; blocked with the words coordinator decision if a class needs the decision after story 9-23. If the cause needs deeper work than a sonnet session, set escalate.

### Coordinator note (Coordinator note 2026-11-18 19:41 UTC: Mac restarted; fix (a) rejected; sample the main thread during the block; phase check)
What happened. The Mac restarted at 18:56 UTC on 2026-11-18. Job 025-onone-vs-O was terminated (exit recorded as 143 by the coordinator; partial lines in its log). Lanes and keep-awake are restored; simulators are not booted after the restart.

Accepted by the coordinator: fix (a) (flip clock from the delivered touch-up) is rejected and stays out of canonical (job 023: 7 of 8 runs still miss; 8 failed checks of 1616 against 11 of 1616). S9-16-02: 0 lost clicks in 100 runs on canonical (job 024): set its DEFECTS line to 'not reproduced in 100 runs on canonical with 9-19 fix 3, ready for re-check'. The 2 motion misses of another kind that 024 saw get one DEFECTS line each with the case, the check and the frame time, status open.

This run, in this order.
1. Requeue the -O against -Onone measurement as 026 (same script; stop at the first failed build). Before each run wait until the 1-minute load is below 20, at most 15 minutes (sleep steps of 30 s, no artificial load); print load1max per run.
2. Behind it in the same lane, one short trial job and then one measurement job for the question that is still open: what runs on the main thread during the 80-100 ms block after the click turn. Use the macOS tool /usr/bin/sample on the fixture process in the simulator (it is an ordinary macOS process): start `sample <pid> 3 1 -file <out>` (1 ms interval, 3 s) just before the click of the reduced case, and print from the report the heaviest main-thread stacks. Trial job: build plus one case, to see that sample attaches and the report has main-thread frames. Measurement: 10 runs of the tb-contract sort click on iPhone 26.3 with GAPS, with wall-clock times printed on both sides so that the block's start and end in each run can be matched to the sample report. Report the top five main-thread stacks inside the block, for failing and for passing runs.
3. Phase check from data you already have (022, 023): for every run take the time from the click to the first changed native frame and the time of the Web envelope crossing of the failing check. Say whether fail or pass is predicted by the first-frame time alone (give the threshold and the number of runs it gets wrong).

What the answers mean. If the block is system work that the product does not start (for example the CoreAnimation commit of the first transaction, the simulator render server, accessibility), and the phase check predicts fail and pass, the class is 'late first frame behind a simulator main-thread block' with the stacks as proof; the coordinator then decides together with 9-23 how the suite treats it, and nothing is widened here. If the block is product or SwiftUI work that the product starts (for example a body pass over every row, a sort of the whole data set on the main thread, layout of rows off screen), that is a product finding: say what, fix it in the private tree if the fix is small, and run the 20 alternating runs again.

Escalation: if after the sample report the stacks do not name the work, set escalate with the report path. The deeper session reads the report and the product code; it does not queue a long job before a short trial.

Evidence lines by hand as in the 15:45 note; job 025 has no result (terminated by the restart): say so on its line.
End: blocked with the words coordinator decision and the table (runs with a miss: base, fix (a), -O; first-frame time; top stacks in the block), or review only if the residual miss has a proven class or is gone.

### Coordinator note (Coordinator note 2026-11-18 23:48 UTC: the macOS misses look like the scroller style (a mouse is connected); install path for the announce fix; announcement call sites)
Read job 033-mac-control first (the chain waits for it). Facts from the coordinator's probe (main job 900, 23:44 UTC): the global setting AppleShowScrollBars is not set (Automatic); a Bluetooth mouse (MX Anywhere 3) is connected to the Mac now; the legacy (always visible) scroller is 15.0 px wide. With Automatic and a mouse connected, AppKit apps get the legacy scroller style, and your macOS misses are 15 px offsets in the frozen-scroll cases. So the likely cause is the environment, not the patch.
1. If 033 on the pristine canonical copy fails the same cases: class 'environment: legacy scroller style while a mouse is connected', with 033 as the proof. Then one short macOS job that prints, from INSIDE the fixture process, NSScroller.preferredScrollerStyle and the scrollerStyle of the frozen-scroll scroll view, and says which side has the 15 px (the native layout or the Chrome capture). Then try a per-process pin for the test only: start the fixture binary with the arguments `-AppleShowScrollBars WhenScrolling` (the argument domain of that process; the user's system setting is not touched) and print the style again; if it is overlay, run macOS paint and states once with it. Report the result. Do not change the user's system settings, do not edit AppKitShim.swift or the canonical run scripts: the coordinator makes a harness story for the pin and asks the user whether the always-visible scroller mode is a configuration to test.
2. If 033 passes on pristine canonical: the patch tree differs from canonical in more than the announce patch; diff the trees and stop.
3. The announce fix. It is accepted as a product fix (job 031: base 7 of 10 runs with a miss, fix 2 of 10; the announce step 27-37 ms before, 1 ms after). With the macOS difference classed by step 1, do the anchored main-queue install (dry run, backup in the lab, byte identity), then canonical iPhone 26.3 x3 and iOS 18.6 x2 behind a load gate.
4. The residual on the iPhone (032: 3861, 3859, 3862 of 3862; 031 fix arm 2 of 10 runs): name each failing check and class it with the data you have (is it the UIKit becomeFirstResponder in NativeFocusBridge.swift that the opus session saw in the same block? show a passing attempt next to a failing one). Do not fix it in this run.
5. For the record and a later sweep: list every call site in packages/native-ios/Sources/AWCUI that posts an accessibility announcement through the Swift AttributedString bridge (grep AccessibilityNotification: NativeAutocomplete 713, NativeMultiSelect 876, NativeSearch, NativeTimePicker, NativeCheckbox 265, NativeBadge, NativeSnackbar, NativeSkeleton, NativeStatusDot, NativeLoadingIndicator, NativeTransferList, PopupScope, NativeTableAccessibility 61) and say for each whether it runs inside an interaction turn that a states suite times. Write the KNOWN-CAUSES row (first use of AccessibilityNotification.post with an AttributedString costs 25-37 ms on the main thread, once per process) so that other stories can check their first-interaction misses against it.
Evidence lines by hand. End: review if the install is verified and the residual has a proven class; otherwise blocked with the words coordinator decision and the table.

### Coordinator note (Coordinator decision 2026-11-19 01:51 UTC: install and canonical runs accepted; residual stays an open finding; pin the scroller style in the macOS runner; then review)
Decisions. Set status in-progress.
1. The announce install (job 101) and the canonical runs (102: iPhone 26.3 three of three and iOS 18.6 two of two at 3862/3862; 103: macOS with the scroller pin 7403/7403 and 3859/3859) are accepted. The residual first-frame miss (tb-sort click-dessert, one frame; 032: 3861, 3859, 3862; A/B fix arm 2 of 10 runs) did not appear in the five canonical runs. It stays an OPEN finding in DEFECTS (S7-15-01 residual), with those numbers; it is part of the question that story 9-37 measures (what the test's own sampling pump does to the main thread). With that written, this story may go to review: the rule of the 15:45 note is met by 'not reproduced on canonical in 5 runs, open finding with its rate'. Audit 7-19 will be started by the coordinator after the 9-37 result.
2. The scroller pin becomes part of the canonical macOS runner, because every macOS suite with a scroll view depends on whether the user has a mouse connected (033 fails by 15 px, 034 and 103 pass with the pin). The user was told. Do it in this run:
   a. In a private copy: make `-AppleShowScrollBars WhenScrolling` the default fixture argument of the macOS runner (packages/native-ios/scripts/test-native-views.sh, the way your AWC_FIXTURE_ARGS did it; an explicit AWC_FIXTURE_ARGS still overrides). One line of comment in the script saying why. Print the scroller style from inside one fixture once, to show the pin is in force.
   b. Regression with the pin, macOS only, every states and paint fixture of the macOS runner once (table, list, menu, select, multi-select, autocomplete, search, text field, tabs, dialog and the rest: take the list from the script), each compared with its last canonical count from the checkpoints or the done logs; name the job you compare with. A difference needs a class before the install (some suites have open misses of their own: they must be the same checks as before).
   c. One main-queue install of the script (dry run, backup in work/s916-lab, byte identity), then table paint and states once on canonical without any AWC_FIXTURE_ARGS in the job.
   d. KNOWN-CAUSES row (legacy scroller style while a mouse is connected: 15 px in scroll views; pinned to overlay for the test processes; the always-visible mode is not a tested configuration) and one paragraph in work/claude-runner/PARALLEL.md.
   Do not change the user's system settings. Do not touch AppKitShim.swift.
3. Evidence lines: the 21 rejected lines by hand, each with its true reason as your Current state lists them (base-build lines: the defect under test; 019 run 4 and 5: control without the nudge; after-fix residual lines: open finding S7-15-01 residual; 033 and the macOS lines of 101: legacy scroller, proof 034). If an edit is refused, leave the line and say so.
End: review with 0 hard failures, or blocked with the words coordinator decision if the regression of the pin shows a difference you cannot class.

### Coordinator note (Coordinator note 2026-11-19 15:09 UTC: closing run; the rail members hang goes to story 9-40)
Closing run. The install job 106-install-pin is waited for first. Then as you planned: read its log (pre-image, dry run, byte identity), run the table paint and states once on canonical macOS with the pin, write the KNOWN-CAUSES row (legacy scrollers of 15 px while a mouse is connected; the runner pins the overlay style) and one PARALLEL.md line saying that the macOS runner now passes the pin to every fixture, the EVIDENCE lines for 104, 105, 107, 108 and 106 by hand, verify_evidence with 0 hard failures, status review.
The rail members hang (exit 142 in 3 of 6 pinned and 3 of 6 unpinned runs of job 108, one passing run of 970 s) is routed: story 9-40-navigation-rail-members-test-hangs-on-macos with the re-check 7-24. File the DEFECTS.md entry with the numbers of job 108 and a pointer to story 9-40; do not look for its cause here.
Search 763/766 pinned and unpinned belongs to story 1-2; one line in your record is enough.

### Coordinator note (Coordinator correction 2026-11-19 15:25 UTC: simulators are shut down on exit as before; the no-shutdown line of 14:10 is withdrawn)
Correction of a coordinator rule. At 14:10 UTC I wrote into PARALLEL.md (and into some notes) that a job must not shut its simulator down at the end. That was wrong: it contradicts the rule of 2026-10-31 (every job that boots a simulator shuts it down on exit; never more than one booted simulator per fork), which exists because the Mac ran out of file descriptors and had to be rebooted, and it would stall the labs that wait until no simulator is booted. The line is withdrawn in PARALLEL.md. Shut your simulator down on exit as before (trap on EXIT). If you took a shutdown line out of a job script or a lab common since 14:10, put it back before you queue the next job, and say in your report that you did. The other new line under Load discipline stays: a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 27, final. All tasks done. Announce fix (101), scroller pin in the macOS runner (106) installed; byte identity verified (106: dry run 1/1, identity 1/1, final identity 1/1).
- Canonical after the pin install, no AWC_FIXTURE_ARGS (106): macOS table paint 7403/7403, states 3859/3859. iPhone 26.3 x3 and iOS 18.6 x2 at 3862/3862 in 102 (before the pin; the pin is macOS only).
- Residual first-frame miss S7-15-01 stays an OPEN finding for audit 7-19 (rates in DEFECTS). Rail Members hang (exit 142, 3 of 6 pinned, 3 of 6 unpinned in 108; not pin dependent) filed in DEFECTS and routed to story 9-40; Search 763/766 belongs to story 1-2.
- KNOWN-CAUSES row (legacy scroller + mouse) and PARALLEL.md paragraph are written (2026-11-19). Evidence lines by hand below; verify_evidence: hard failures 0.
- Next: none. Status review; audit 7-19 follows.

#### Evidence (103, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-103-mac-canon-pinned | macos | NativeTablePaintIntegration canonical copy with scroller pin | 7403/7403
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-103-mac-canon-pinned | macos | NativeTableStatesIntegration canonical copy with scroller pin | 3859/3859

#### Evidence (101/102, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-102-canon-ann | ios-iphone26.3 | NativeTableStatesIntegration run1-3 (loads 56, 58, 76) | 11586/11586
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-102-canon-ann | ios-ios18.6 | NativeTableStatesIntegration run1-2 | 7724/7724

#### Evidence (033, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-033-mac-control | macos | NativeTablePaintIntegration pristine canonical copy (control) (explained: legacy scroller style while a mouse is connected (15 px), proof job 034) | 7005/7403
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-033-mac-control | macos | NativeTableStatesIntegration pristine canonical copy (control) (explained: legacy scroller style while a mouse is connected (15 px), proof job 034) | 3766/3859

#### Evidence (032, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-032-ann-regress | ios-iphone26.3 | NativeTableStatesIntegration run1-3 (3861, 3859, 3862; loads 42-54) (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 11582/11586
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-032-ann-regress | ios-ios18.6 | NativeTableStatesIntegration run1-2 | 7724/7724
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-032-ann-regress | ipad | NativeTableStatesIntegration | 3862/3862

#### Evidence (031, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-031-ann-ab20 | ios-iphone26.3 | tb-contract case base arm runs 1-10 (7 runs with a miss) (explained: base arm = defect under test (announce cost 27-37 ms)) | 2010/2020
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-031-ann-ab20 | ios-iphone26.3 | tb-contract case announce-fix arm runs 1-10 (2 runs with a miss) (explained: after-fix residual, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 2018/2020

#### Evidence (026, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-026-onone-vs-O | ios-iphone26.3 | tb-contract click-calories case, -O build runs 1-5 (fails 0,0,2,0,0 of 202 each) (explained: arm of an A/B on the residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 1008/1010
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-026-onone-vs-O | ios-iphone26.3 | tb-contract click-calories case, -Onone build runs 1-5 (fails 1,1,1,2,4 of 202; the residual under test) (explained: arm of an A/B on the residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 1001/1010

#### Evidence (023/024, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-023-fixa-ab | ios-iphone26.3 | tb-contract case fix-a arm runs 1-8 (misses in 7 of 8; 8 failed checks of 1616) (explained: arm of an A/B on the residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 1608/1616
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-023-fixa-ab | ios-iphone26.3 | tb-contract case base arm runs 1-8 (11 failed checks of 1616) (explained: arm of an A/B on the residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 1605/1616
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-024-lostclick-loop | ios-iphone26.3 | tb-pagination-rtl+tb-hover-select-ltr 100 runs, runs without lost click (events []) | 100/100

#### Evidence (install, 021, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-100-install-table-flip | macos | NativeTablePaintIntegration | 7403/7403
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-100-install-table-flip | macos | NativeTableStatesIntegration | 3859/3859
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-021-canon-states | ios-iphone26.3 | NativeTableStatesIntegration run1,3 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-021-canon-states | ios-iphone26.3 | NativeTableStatesIntegration run2 (load 64) (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3861/3862

#### Evidence (019/020, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-019-ax-mac-wait-only | macos | tools/ax md-table wait-only run1-3,6 open findings 0 | 4/4
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-019-ax-mac-wait-only | macos | tools/ax md-table wait-only run4,5 (Web role table, no nudge) open findings 0 (explained: control run without the nudge that shows the wait alone is not enough (S9-16-01)) | 0/2
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-020-ab2-fix-first | ios-iphone26.3 | NativeTableStatesIntegration fix run1-3,5,8,9,11,12 | 8/8
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-020-ab2-fix-first | ios-iphone26.3 | NativeTableStatesIntegration base run2-8,11,12 | 9/9

#### Evidence (018 A/B, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-018-ab-base-vs-fix | ios-iphone26.3 | NativeTableStatesIntegration fix run1-10 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-018-ab-base-vs-fix | ios-iphone26.3 | NativeTableStatesIntegration base run1 (load 61) (explained: base arm = build before the fix, the miss is the defect under test S7-15-01) | 3857/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-018-ab-base-vs-fix | ios-iphone26.3 | NativeTableStatesIntegration base run2-10 | 3862/3862

#### Evidence (016/017/A016, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-016-mac-ipad-axios | macos | NativeTablePaintIntegration | 7403/7403
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-016-mac-ipad-axios | macos | NativeTableStatesIntegration | 3859/3859
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-016-mac-ipad-axios | ipad | NativeTableStatesIntegration (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3861/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-A016-android | android | NativeTablePaintTest | 1/1
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-A016-android | android | NativeTableStatesTest | 1/1
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-017-states-r2 | ios-iphone26.3 | NativeTableStatesIntegration run1-4,6,7,10 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-017-states-r2 | ios-iphone26.3 | NativeTableStatesIntegration run5,9 (loads 17, 19) (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3861/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-017-states-r2 | ios-iphone26.3 | NativeTableStatesIntegration run8 (load 15) (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3860/3862

#### Evidence (014/015, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-014-fix-gaps | ios-iphone26.3 | NativeTableStatesIntegration run1-6,8-10 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-014-fix-gaps | ios-iphone26.3 | NativeTableStatesIntegration run7 (load 83) (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3860/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-015-ax-mac-nudge | macos | tools/ax md-table run3-6 open findings 0 | 4/4

#### Evidence (fix, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-013-fix-states | ios-ios18.6 | NativeTableStatesIntegration run1-4 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-013-fix-states | ios-iphone26.3 | NativeTableStatesIntegration run1 (explained: after-fix residual first-frame miss, open finding S7-15-01 residual (DEFECTS.md), for audit 7-19) | 3861/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-013-fix-states | ios-iphone26.3 | NativeTableStatesIntegration run3 | 3862/3862

#### Evidence (before, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-005-base-iphone26-fresh | ios-iphone26.3 | NativeTableStatesIntegration run1 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-005-base-iphone26-fresh | ios-iphone26.3 | NativeTableStatesIntegration run4 (explained: base build before the fix, lost click is the defect under test S9-16-02) | 3839/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-005-base-iphone26-fresh | ios-iphone26.3 | NativeTableStatesIntegration run5 (explained: base build before the fix, lost click is the defect under test S9-16-02) | 3842/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-006-base-ios18-fresh | ios-ios18.6 | NativeTableStatesIntegration run1 (explained: base build before the fix, the late motion start is the defect under test S7-15-01) | 3861/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-006-base-ios18-fresh | ios-ios18.6 | NativeTableStatesIntegration run2 | 3862/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-009-diag-gaps | ios-ios18.6 | NativeTableStatesIntegration run3 (explained: base build before the fix, the late motion start is the defect under test S7-15-01) | 3860/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-009-diag-gaps | ios-iphone26.3 | NativeTableStatesIntegration run2 | 3862/3862

#### Evidence (107/108, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-107-reg-fix | macos | NativeFaViewsIntegration pinned, fixed script | 506/506
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-107-reg-fix | macos | NativeChartSceneIntegration pinned, fixed script | 485/485
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-107-reg-fix | macos | NativeChartInteractionIntegration pinned, fixed script | 211/211
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-107-reg-fix | macos | NativeButtonStatesIntegration pinned | 645/645
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-107-reg-fix | macos | NativeOTPFieldStatesIntegration pinned | 1370/1370

#### Evidence (104/105/106/108, valid)
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-106-install-pin | macos | NativeTablePaintIntegration canonical after install, no AWC_FIXTURE_ARGS | 7403/7403
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-106-install-pin | macos | NativeTableStatesIntegration canonical after install, no AWC_FIXTURE_ARGS | 3859/3859
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-104-reg-pinned | macos | NativeNavigationRailStatesIntegration pinned | 543649/543649
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-105-reg-unpinned | macos | NativeNavigationRailStatesIntegration unpinned | 543649/543649
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-104-reg-pinned | macos | NativeSelectStatesIntegration pinned | 1030/1030
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-105-reg-unpinned | macos | NativeSelectStatesIntegration unpinned | 1030/1030
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-108-rail-pin | macos | NativeNavigationRailMembersIntegration runs that finished (pinned run1, run2; unpinned run1; the other 3 runs hung, exit 142, own finding routed to story 9-40) | 3/3

## Review Triage Log

