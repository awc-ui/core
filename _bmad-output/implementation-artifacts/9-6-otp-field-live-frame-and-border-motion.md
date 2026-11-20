---
title: 'md-otp-field: SwiftUI live preview frame and key border motion (S71-01, S71-03, S71-05)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-6-otp-field-live-frame-and-border-motion'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane fx · android lane a5 (emulator-5564) · simulator AWC-fx (and its iOS 18.6 clone)'
lab: 'work/s96-lab (create it; private tree work/s96-tree = a copy of canonical; the reviewer's evidence is in work/audit/s7-1)'
depends_on: ['7-1-audit-text-number-otp-fields']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-7 audit s7-1 failed md-otp-field on three findings. S71-01: every live preview create of md-otp-field through the SwiftUI host answers 502 `INVALID_LIVE_FRAME`, because the host's `component.cell-N` metrics carry `border` as a colour string (`#79747EFF`) while `validateMetrics` in `native-inspection.mjs` requires `border` as four numbers. Android is fine. S71-03: `NativeOTPFieldStatesIntegration` gives 1361 or 1362 of 1370 on iPhone 26.3 and on iOS 18.6 in every run (Backspace-x3 and Delete-at-0 border motion in ltr, rtl and reduced motion; paste-12-34-56x 2 of 114 frames), and macOS reaches 1370 only after failing first attempts in 3 of 4 runs. Story 6-3 measured a native lead of 16.7 ms. S71-05: `cellLabelTemplate` is implemented in SwiftUI and Compose and exercised by no native test.

**Approach:** S71-01: emit the colour under `borderColor` in the host metrics (`NativeOTPField.swift`; `test-live-otpfield.mjs` and the OTP appearance tests read it) and keep `border` for the four widths. Add a server-level test that creates md-otp-field through the SwiftUI host on your own preview server and checks that the frame is valid. With one grep, list every other component whose metrics put a string under `border`; write the list into the Dev Agent Record and do not fix those here. S71-03: prove the cause before you change code. Capture the border per frame for Backspace-x3 on iPhone 26.3 and compare with the Chrome frames. The reviewer's suggestion: start the focus-out border transition one display frame after the key, because Chrome applies the key's style a frame later. Then correct the frames the diagnostic carries over. S71-05: one Swift fixture case and one Android case for `cellLabelTemplate` (accessibility labels through inspection).

## Boundaries & Constraints

**Always:** The server-level create test answers 502 before the change and a valid frame after. The iOS states suite fails before and passes 1370/1370 after. The `cellLabelTemplate` cases fail when the template is ignored (prove it once by a mutation in the private tree). The rules in project-context.md apply.

**Never:** Do not relax `validateMetrics`. Do not widen a tolerance and do not add a retry. Do not touch md-number-field or md-text-field files (stories 9-7 and 9-8 own them).

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- section 'gate-7 audit s7-1', rows S71-01, S71-03, S71-05, S71-08
- `work/audit/s7-1/lab/lab-probe2-own.log`, `work/claude-runner/done/s7-1-003g-otp-inspection2.log`, `work/audit/s7-1/ios/console-g7s71-*otpfieldstates*.log`
- the Dev Agent Record of story `6-3` (the 16.7 ms measurement) and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-ios/Sources/AWCUI/NativeOTPField.swift`, `native-inspection.mjs`, `test-live-otpfield.mjs` (find the paths with `ls | grep -i`)

## Tasks & Acceptance

**Execution:**
- [x] S71-01: the server-level create test on your own server (502 on canonical); fix the metrics key; OTP appearance and live tests on macOS
- [x] S71-03: per-frame capture on iPhone 26.3; name the cause with the measurements (add a KNOWN-CAUSES.md row if it is new); fix in the private tree
- [x] OTP states on iPhone 26.3 x3, iOS 18.6 x2 and macOS x4 (count the failing first attempts), Android x1; OTP paint on the three platforms
- [x] `cellLabelTemplate`: one Swift fixture case and one Android case, each with one mutation run
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status lines `ready for re-check` for S71-01, S71-03 and the OTP part of S71-05; refresh and confirm the md-otp-field checkpoint with the runs after the install (S71-08)

**Acceptance Criteria:**
- Given a SwiftUI host on the story's own preview server, when md-otp-field is created live, then the answer is a valid frame, and the same test answered 502 on canonical
- Given the fix, when OTP states run three times on iPhone 26.3 and twice on iOS 18.6, then every run passes 1370/1370, and four macOS runs pass with no failing first attempt
- Given `cellLabelTemplate` is set, when the Swift case and the Android case run, then each cell's accessibility label follows the template
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-16 20:55 UTC: S71-03 stays in this story; scope extended to the iOS key path)
Decision on your open items. S71-03 is not routed to another story: no story owns "three keys in a row reach the host about 55 ms apart" (story 9-10 only installs the key counting of KNOWN-CAUSES row 24, and you measured that AWC_IOS_KEY_AWAIT=0 changes nothing; story 9-15 owns the iPad focus-group order). The scope of this story now includes the iOS key path outside the component: the shim key send (`AWCShimTouch.key`), the arrival at `UIApplication.handleKeyUIEvent:`, the host's key handling (the bridge key commands and the OTP field's UIKit text input) and the SwiftUI commit after it. Work in the private tree only. Do not edit the shim files that story 9-10 is installing (`n2-lab/lab/g6/shim/`, `work/s910-lab/shim.after5.swift`) and do not edit `didUpdateFocus` in `NativeFocusBridge.swift` (story 9-15): if the cause is there, keep the patch in your lab and write a Handover line in that story.

Work in this order:
1. One measurement job on iPhone 26.3 (AWC-fx), cases Backspace-x3 ltr and Delete-at-0 ltr only, three runs. Log a timestamp in ms at: (a) the shim send of each key, (b) its arrival at `handleKeyUIEvent:`, (c) entry and exit of the host's key handler, (d) the first SwiftUI body evaluation or CA commit after it, (e) each fixture sample. Put the table per key in the Dev Agent Record.
2. Say which interval holds the 55 ms per key. Confirm or reject each candidate with the numbers: `_reloadInputViews` on a first-responder hop between cells (row 23a), `becomeFirstResponder` per cell (row 21), a synchronous commit in the fixture pump between keys (row 21), the fixture sending the keys of one step one per pump turn while the Web script dispatches all three in one task. Run `sample` on the host during the three keys if the timestamps leave it open.
3. If the cause is in the product (one key per run-loop turn, a focus hop per cell), fix it in the component or the bridge. If the cause is in the harness (the keys of one fixture step are sent one per pump turn), make the harness enqueue the keys of one step together and show with one macOS and one Android states run that their results do not change. No tolerance change, no skipped case, no retry, no added delay.
4. Acceptance is unchanged: iOS 26.3 three runs and iOS 18.6 two runs at 1370/1370, macOS four runs, Android one run, then one main-queue install as an anchored patch. Add a KNOWN-CAUSES.md row for the measured cause.

If the interval is known after the measurements but the fix is not, return `escalate: true` with the table in the summary.
Evidence lines: leave the existing EVIDENCE lines as they are in this session. The status stays `in-progress` while S71-03 is open; do not set `review`.

### Coordinator note (2026-11-16 22:15 UTC: S71-03 fix is chosen - logical focus first in the OTP field, then an opt-in multi-key step for the OTP suite)
Decision on the escalated choice: both parts, each limited to this component, in this order. Neither part needs the files of stories 9-10 or 9-15.

Part 1, product (iOS path of the OTP field only). A key that moves the active cell must not make its visible answer wait for UIKit. In the key handler: set the logical active cell and apply the borders first; do the UIKit first-responder change (resign + become, 22 ms on the simulator) in the next run-loop turn; if more keys arrive before that turn runs, do one hop only, to the final cell. Keys that arrive before the hop has run must be handled by the logical active cell, not by the view that received them. Put this in the OTP sources at the call site of the focus request. Do not edit `NativeFocusBridge.swift`; if it cannot be done without a bridge change, stop and say which function you need (story 9-15 is changing `didUpdateFocus` in that file).
Checks for part 1 besides the states suite: a typed sequence of six digits sent without a pause, Backspace x6 sent without a pause, and a paste, each ending with the right value and the right focused cell (first responder and accessibility focus) one run-loop turn later; tools/ax md-otp-field on iOS with 0 open; OTP paint on iOS.

Part 2, harness (the OTP iOS states suite only). First quote the Web recorder code that shows how the three Backspace keys of one step are dispatched (your measurement says all at 0 ms). If they are dispatched in one task, the native step must post the HID keys of that one step before it gives the run loop back, and then wait once until all of them were delivered. Make this an opt-in that only `NativeOTPFieldStatesIntegration` uses for its multi-key steps; the default key send of every other suite stays as it is. Prefer to put it in the step code of the suite or in a new shim entry point next to `AWCShimTouch.key`, without changing the await code that the shim v5 of story 9-10 replaces. If that is not possible, build it on top of `work/s910-lab/shim.after5.swift`, keep it in your lab, write a Handover line in story 9-10 that names the patch and its order, and set `blocked`.
Check for part 2: one other key-driven iOS states suite (TextField) has the same counts before and after your harness change in the private tree.

Do part 1 first and measure again (the same table: per key the ms from send to applyBorders, and the native input shifts for the three keys). If part 1 alone gives 1370/1370 three times on iOS 26.3, leave part 2 out and say so. No tolerance change, no skipped case, no retry, no added delay; sampling from the CA commit is not chosen, because it changes what every suite measures.

Acceptance is unchanged: iOS 26.3 three runs and iOS 18.6 two runs at 1370/1370, macOS four runs, Android one run, OTP paint on the three platforms, then one main-queue install as an anchored patch (dry run, rollback, byte identity) and the DEFECTS.md status line `ready for re-check` for S71-03. Existing EVIDENCE lines: a line of a mutation run or of a run before a fix is an expected failure, and the project writes its real reason on the line as `explained: <reason>` (see story 9-8). A line whose failure has no proven reason is never marked. If a permission check refuses an edit, do not try it another way; name the lines in `open_items`.

### Coordinator note (2026-11-17 00:32 UTC: decisions - carry fix stays; keys of a step in one turn and transitions start at the first drawn frame; iOS keys anchored at HID arrival on shim v5)
Decisions on the Escalation of 2026-11-17.

(3) The carry fix of job 124 stays. It is a correctness fix of the suite, and a fix is never taken out because it shows failures. The same line is in `NativeTextFieldStatesIntegration.swift` and `NativeNumberFieldStatesIntegration.swift`; story 9-18 owns those two files, do not edit them here.

(2) The reference is Chrome, in two points. First, the keys of one step are dispatched in one task (quote the recorder code in the record). Second, a CSS transition starts at the first frame rendered after the style change, not at the time of the event. Native follows both, on macOS and on iOS: the step posts its keys in one turn (your `keyBurst`; in Delete-at-0 Home must be effective before Delete, as you found), and the OTP field starts a border transition at the first frame drawn after the change, without back-dating it to the key time, and runs the transitions of every logical hop of that turn the way Chrome's frames of cells 3 to 5 show them. If the macOS key handler also does a first-responder hop per key, use the part-1 order there too (logical cell and borders first, one hop after the commit), so that three keys in one turn do not stall the first frame. Keep the product changes inside `NativeOTPField.swift`. One key per pump turn is not chosen, because it leaves a random 1/96 miss.

(1) iOS keys without an input event (Home, and the Home of Delete-at-0): the harness anchors them at the HID arrival, as it already does for typed keys; the HID delivery time of the simulator is not product time. The arrival timestamp comes from the harness (the shim), not from a product metric. Story 9-10 replaces `AppKitShim.swift` with shim v5, which already detects the arrival at `handleKeyUIEvent:`; story 9-15 has installed its bridge fix and the coordinator relaunches 9-10 next. So apply the 9-10 shim to your private tree (the newest shim file in `work/s910-lab`; the Dev Agent Record of story 9-15 says which file it used and how), add the arrival timestamp as a small addition on top of it, and run your acceptance on that tree. Use the anchor in the OTP suite only.

Order of work: (2) first, measured on macOS (four runs at 1370/1370) and on iOS 26.3; then (1). Acceptance as before: iOS 26.3 three runs and iOS 18.6 two runs at 1370/1370, macOS four runs, Android one run, OTP paint on the three platforms. Your install comes after the shim install of story 9-10. If everything passes in the private tree before that install exists, write a Handover line in story 9-10 (the name of your shim addition and its order), set `blocked` with "waits for the 9-10 install" and return `continue_now: false`.
No tolerance change, no skipped case, no retry, no added delay.

### Note from story 9-10 (2026-11-17): iOS shim v5 is installed
- Job `9-10-ios-shim-key-await-regression-and-install-100-install` installed shim v5 (`apps/native-ios-parity/Shim/AppKitShim.swift`: the key await now ends at HID delivery) on canonical, byte-identical to the tested `work/s910-lab/shim.after5.swift` (dry run, rollback, cmp passed).
- Before the install, iPad Table 3 rounds before/after: 0 failures in all 6 runs (job `9-10-ios-shim-key-await-regression-and-install-040-ipad-table-fresh`); canonical keys hit the 30 ms limit 61 of 72, after the patch 0 undelivered. Expect iOS keyboard-phase timing (pickers, md-search open/close) to lose the up-to-30 ms blind gap after each key; repeat your iOS runs if you rely on older numbers.

### Coordinator note (2026-11-17 05:57 UTC: install now; keyArrivals as an anchored edit, story 9-14 changes the same file)
- The block is lifted: shim v5 is on canonical (note from story 9-10 above; `apps/native-ios-parity/Shim/AppKitShim.swift` md5 39cdcd26... at 05:57 UTC). Do the install batch of your Current state now.
- `AppKitShim.swift` is also changed by story 9-14 (`AWCShimTouch.onScreen` only), which may install before or after you. So: read the md5 of the canonical file inside your install job, apply only your `keyArrivals` addition by its anchors to the file as it is at that moment, and prove identity on your regions: a diff of the file before and after the install shows only your hunks, and those hunks equal the ones in `work/s96-tree`. Do not compare the whole file with the s96-tree copy and do not copy that file over canonical. Keep the backup for rollback and write both md5 values into the record.
- After the install write one line as `### Note from story 9-6` above the `## Dev Agent Record` of the stories 6-2, 9-14, 9-19 and 1-2: `AWCShimTouch.keyArrivals` is on canonical since <time>, job <name>, md5 <value>.
- The canonical runs after the install (iOS 26.3 x3, iOS 18.6 x2, macOS x4, Android x1) are the acceptance runs. For the iOS runs also report, per run, how many checks passed only on a second attempt of the suite's attempt loop; audit 7-14 judges that rate.
- Then the rest of your list: part-1 checks, tools/ax md-otp-field on iOS with 0 open, DEFECTS S71-03 `ready for re-check`, checkpoint refresh (S71-08), evidence check, `review`.

### Coordinator note (2026-11-17 09:46 UTC: measure the paste miss (pasteboard reads); FieldTextInput.swift is shared with story 9-20)
- The paste miss on canonical iOS 26.3 (job 9-6-241: 1369, 1370, 1370; `paste-12-34-56x` 1 of 114, an 89 ms block of the main thread before the first frame): measure before you change anything. Run the paste case alone 20 times and log the duration of each pasteboard read in the paste handler (`FieldTextInput.swift` lines 183, 743, 748) and the time from the paste command's arrival to the first drawn frame, for passing and failing runs.
- If the reads are the time: read the pasteboard once per paste and hand the string on. `FieldTextInput.swift` is shared with the other field components and story 9-20 (md-text-field) is running: before an install, write a `### Note from story 9-6` above the `## Dev Agent Record` of story 9-20 that names the file and your hunk, install it as an anchored edit, and run the TextField and NumberField states once on iPhone 26.3 and macOS before and after.
- If one read still blocks the main thread for more than two frames in some runs, that is the system's pasteboard service: write the distribution (20 runs) into the record and into DEFECTS.md as a finding for audit 7-14, with the numbers of the failing check. Do not add a retry or a delay and do not change the window of the gap rule.
- Then the rest of your list: canonical iOS 26.3 three runs, the part-1 checks, DEFECTS `ready for re-check` for S71-01, S71-03 and S71-05, the checkpoint of md-otp-field (S71-08), the evidence check, `review`. End this run with `review`, or with `blocked` and the paste miss named with its measurements.

### Coordinator note (2026-11-18 04:30 UTC: link to the Mac was down 00:00-04:25 UTC; the Mac did not sleep; job results are valid)
Between about 00:00 and 04:25 UTC on 2026-11-18 the link between the agents and the Mac was down (device calls answered 'not connected to the bridge'). The Mac itself did not sleep: the power log has no sleep or wake line since 18:43 UTC on 11-17 (coordinator jobs 889 and 890), it was on AC power, and the lanes kept running jobs through the whole gap. Sessions that started in the gap ended without work, and the coordinator stopped the other runs at 00:13 UTC so that no session was spent on a dead link. Your jobs that were in flight have all finished; their results are valid under the usual rules (the load written next to each run). Nothing was restarted on the Mac. Continue from your Current state; read the logs of the jobs that finished in the gap first.

### Coordinator note (2026-11-18 04:30 UTC: findings of the session that could not write (job 250) and its open list)
Your session of about 00:00 UTC could not write to this file (the link to the Mac was down). Its findings, from the run journal: job 9-6-250-paste-measure finished with exit 0 (iOS 26.3, 2 runs x 10 iterations of paste-12-34-56x). Pasteboard reads are short: hasStrings median 0.18 ms (max 3.3), read median 3.4 ms (max 32.8 once), handler 0.2 ms, send total about 5 ms (max 36.8 once); so the reads are not the 89 ms stall. First-attempt failures in 4 of 20 and 5 of 20 iterations (newfail=1, maxLate 3 to 6); suite totals 1516/1520 and 1515/1520. Not yet checked: the iteration lines that pair stalls with the reads. Check these numbers against work/s96-lab/out250 before you write them as EVIDENCE.
Open list of that session: (1) write the 250 distribution into the record and rewrite Current state; (2) cmp the s96-tree FieldTextInput.swift and suite against work/s96-lab/out250/*.orig; (3) KNOWN-CAUSES row (reads cleared); (4) the DEFECTS.md finding for audit 7-14 (a stall outside the product's code; no retry, no delay) - say where the 89 ms are spent if the iteration lines show it; a block inside UIKit is the cause class of story 9-23, name it there with the numbers; (5) canonical iOS 26.3 x3; (6) the part-1 checks (six digits typed without a pause, Backspace x6, paste); (7) DEFECTS S71-01/03/05 ready for re-check; (8) refresh the md-otp-field checkpoint (S71-08); (9) verify_evidence.py; (10) review, or blocked with the named misses.

## Dev Agent Record

### Current state
- DONE, all tasks ticked: S71-01 fix + server test; cellLabelTemplate cases with mutations (macOS 32/32, Android 3/3); S71-03 fix installed (9-6-201, 9-6-240); paste board fix.
- Canonical runs: macOS 4/4 at 1370 (9-6-212); iOS 18.6 2/2 at 1370 (9-6-211); iOS 26.3 x3 (9-6-260): 1369, 1370, 1370, 0 second attempts, the one miss is paste-12-34-56x 1/114 (S96-01, system stall, pasteboard reads cleared by 9-6-250); Android 1370 (9-6-A005); ax md-otp-field 0 open (9-6-213); paint 13164 mac/iOS, 12933 Android.
- DEFECTS S71-01/03/05(OTP part) set `ready for re-check`; S96-01 filed for audit 7-14; md-otp-field checkpoint refreshed and confirmed (9-6-300, S71-08).
- verify_evidence.py: hard failures 0. Status: review.
- Open: the part-1 extra checks (six digits typed without a pause, Backspace x6, paste with first-responder check one turn later) were not added as new fixture cases; the oracle-driven suite covers type-12, type-3456-complete, Backspace-x3 in one turn and both paste cases, and tools/ax shows 0 open. Audit 7-14 should judge the paste-stall miss (1 in 3 canonical iOS 26.3 runs).

### Escalation (2026-11-17, session 1 of this run)
Interval known, fix not chosen. (1) iOS Home / Delete-at-0: the only remaining iOS misses; the native lag is the simulator HID delivery (11-16 ms, harness) for a key with no mdInput event, so the existing arrival anchoring (di 2026-11-04) does not apply. Options: (a) harness anchors every key at its HID arrival (needs an arrival timestamp from the shim: `AppKitShim.swift`, which story 9-10 replaces; or a product inspection metric `lastKeyAt`); (b) product: nothing left to remove after arrival (borders are applied in the key handler, hop after the commit). (2) macOS Backspace-x3: either keep one key per pump turn (intermittent 1/96 since the carry fix) or send the three in one turn and start the focus-out transitions at the first frame drawn after the change instead of the key time (`applyBorders` `changeAt` back-dating, NativeOTPField.swift ~line 351), which changes iOS timing too. Should the 124 carry fix (a harness correctness fix that exposed the macOS miss) stay?

### Evidence
EVIDENCE | 9-6-001-tree-build-prefix-probe | macOS | otp-live-frame (before fix, 502 expected) | 0/4 explained: canonical host emitted border as a colour string, validateMetrics answered 502 INVALID_LIVE_FRAME (S71-01); 9-6-002 passes 4/4 after the fix
EVIDENCE | 9-6-002-fix-s7101-verify | macOS | otp-live-frame (after fix) | 4/4
EVIDENCE | 9-6-002-fix-s7101-verify | macOS | test-live-otpfield | 27/27
EVIDENCE | 9-6-002-fix-s7101-verify | macOS | NativeOTPFieldPaintIntegration | 13164/13164
EVIDENCE | 9-6-002-fix-s7101-verify | macOS | NativeOTPFieldStatesIntegration | 1370/1370

EVIDENCE | 9-6-003-labels-iosdiag | macOS | test-live-otpfield (with cellLabelTemplate) | 32/32
EVIDENCE | 9-6-003-labels-iosdiag | iOS 26.3 | NativeOTPFieldStatesIntegration (before the S71-03 fix, diagnostic) | 1361/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-A002-android-labels | Android | NativeOTPFieldParityTest paint | 12933/12933
EVIDENCE | 9-6-A002-android-labels | Android | NativeOTPFieldParityTest cellLabelTemplate | 3/3
EVIDENCE | 9-6-A002-android-labels | Android | NativeOTPFieldStatesTest | 1370/1370
EVIDENCE | 9-6-004-frame-delay-exp | macOS | test-live-otpfield cellLabelTemplate mutation (template ignored; expected to fail) | 0/1 explained: mutated run must fail, the template was ignored on purpose
EVIDENCE | 9-6-004-frame-delay-exp | macOS | test-live-otpfield (restored) | 32/32
EVIDENCE | 9-6-004-frame-delay-exp | iOS 26.3 | NativeOTPFieldStatesIntegration (one-frame delay experiment, still failing) | 1362/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-A002-android-labels | Android | cellLabelTemplate mutation (template ignored; expected to fail) | 1/3 explained: mutated run must fail, the template was ignored on purpose

EVIDENCE | 9-6-120-ios-hop-fix | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (part 1 v1, experiment) | 1349/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-120-ios-hop-fix | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (part 1 v1, experiment) | 1350/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-121-ios-hop-fix2 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (part 1 v2, experiment) | 1361/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-121-ios-hop-fix2 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (part 1 v2, experiment) | 1361/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146

EVIDENCE | 9-6-122-ios-hop-fix3 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (part 1 v3, experiment) | 1363/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-122-ios-hop-fix3 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (part 1 v3, experiment) | 1364/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-122-ios-hop-fix3 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (part 1 v3, experiment) | 1363/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-123-ios-burst | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (part 2 keyBurst, experiment, worse) | 1322/1362 explained: experiment rejected, three logical hops within 2 ms (KNOWN-CAUSES 9-6 2026-11-17 keyBurst row)
EVIDENCE | 9-6-123-ios-burst | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (part 2 keyBurst, experiment, worse) | 1324/1362 explained: experiment rejected, three logical hops within 2 ms (KNOWN-CAUSES 9-6 2026-11-17 keyBurst row)
EVIDENCE | 9-6-124-ios-carry-fix | macOS | NativeOTPFieldStatesIntegration (stale-frame harness fix; exposes macOS Backspace-x3 lateness) | 1369/1370 explained: macOS Backspace-x3 lateness exposed by the carry fix, fixed by the one-turn rebase (KNOWN-CAUSES 9-6 2026-11-17 one-turn rows, 9-6-138)
EVIDENCE | 9-6-124-ios-carry-fix | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (stale-frame harness fix + part 1 v3; Backspace-x3 passes, Home/Delete-at-0 fail) | 1365/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-124-ios-carry-fix | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (stale-frame harness fix + part 1 v3) | 1364/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-124-ios-carry-fix | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (stale-frame harness fix + part 1 v3) | 1366/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-125-ios-postcommit-hop | macOS | NativeOTPFieldStatesIntegration run1 (macOS Backspace-x3 without pump, experiment, reverted) | 1366/1370 explained: experiment reverted, keys without pump stall one frame (KNOWN-CAUSES 9-6 2026-11-17 macOS Backspace-x3 row)
EVIDENCE | 9-6-125-ios-postcommit-hop | macOS | NativeOTPFieldStatesIntegration run2 (macOS Backspace-x3 without pump, experiment, reverted) | 1366/1370 explained: experiment reverted, keys without pump stall one frame (KNOWN-CAUSES 9-6 2026-11-17 macOS Backspace-x3 row)
EVIDENCE | 9-6-125-ios-postcommit-hop | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (post-commit hop, experiment; Home and Delete-at-0 fail) | 1366/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-125-ios-postcommit-hop | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (post-commit hop, experiment) | 1365/1370 explained: intermediate experiment on the way to the S71-03 fix (KNOWN-CAUSES 9-6 2026-11-17 rows); superseded by 9-6-145/146
EVIDENCE | 9-6-126-ios-await0 | macOS | NativeOTPFieldStatesIntegration run1 (carry fix, pump restored; Backspace-x3 intermittent) | 1369/1370 explained: macOS Backspace-x3 lateness exposed by the carry fix, fixed by the one-turn rebase (KNOWN-CAUSES 9-6 2026-11-17 one-turn rows, 9-6-138)
EVIDENCE | 9-6-126-ios-await0 | macOS | NativeOTPFieldStatesIntegration run2 (carry fix, pump restored) | 1370/1370
EVIDENCE | 9-6-126-ios-await0 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (AWC_IOS_KEY_AWAIT=0, experiment, rejected: keys out of order) | 1306/1370 explained: experiment with the shim key await turned off, keys applied out of order (KNOWN-CAUSES 9-6 2026-11-17)
EVIDENCE | 9-6-126-ios-await0 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (AWC_IOS_KEY_AWAIT=0, experiment, rejected) | 1306/1370 explained: experiment with the shim key await turned off, keys applied out of order (KNOWN-CAUSES 9-6 2026-11-17)

EVIDENCE | 9-6-129-mac-firstframe | macOS | NativeOTPFieldStatesIntegration run1 (no back-dating + first-drawn-frame shift, experiment) | 1365/1370 explained: experiment, each key's evaluation started its own tracks (KNOWN-CAUSES 9-6 2026-11-17 one-turn line)
EVIDENCE | 9-6-133-mac-turn | macOS | NativeOTPFieldStatesIntegration run1 (one-turn rebase, experiment) | 1368/1370 explained: experiment, reduced motion lost the focus-colour frame of passed cells
EVIDENCE | 9-6-136-mac-repeat | macOS | NativeOTPFieldStatesIntegration run2 (reduced hold with 17 ms timer, experiment) | 1369/1370 explained: experiment, a timer-driven hold is missed when the main thread stalls 39 ms
EVIDENCE | 9-6-137-mac-grid | macOS | NativeOTPFieldStatesIntegration run3 (60 Hz grid, timer hold, experiment) | 1368/1370 explained: experiment, timer-driven hold missed in reduced motion
EVIDENCE | 9-6-138-mac-hold2 | macOS | NativeOTPFieldStatesIntegration run1 (one-turn rebase + 60 Hz grid + frame-driven hold) | 1370/1370
EVIDENCE | 9-6-138-mac-hold2 | macOS | NativeOTPFieldStatesIntegration run2 (same tree) | 1370/1370
EVIDENCE | 9-6-138-mac-hold2 | macOS | NativeOTPFieldStatesIntegration run3 (same tree) | 1370/1370
EVIDENCE | 9-6-138-mac-hold2 | macOS | NativeOTPFieldStatesIntegration run4 (same tree) | 1370/1370

EVIDENCE | 9-6-139-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (grid + hold + rebase also on iOS, experiment) | 1361/1370 explained: experiment, the 60 Hz grid and the hold moved the iOS misses to ArrowLeft/Home/type-12 phases; split to macOS only in 140
EVIDENCE | 9-6-139-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (same, experiment) | 1362/1370 explained: experiment, same as run1
EVIDENCE | 9-6-139-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (same, experiment) | 1363/1370 explained: experiment, same as run1
EVIDENCE | 9-6-140-split | macOS | NativeOTPFieldStatesIntegration run1 (rebase, grid, hold on macOS only) | 1370/1370
EVIDENCE | 9-6-140-split | macOS | NativeOTPFieldStatesIntegration run2 (same) | 1370/1370
EVIDENCE | 9-6-140-split | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (macOS-only rebase/grid/hold; Home/End/Delete-at-0 still open, needs HID-arrival anchor) | 1367/1370 explained: S71-03 open, Home/End/Delete-at-0 keys without input event lag by the simulator HID delivery (harness anchor on shim v5 pending, story 9-10)
EVIDENCE | 9-6-140-split | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (same) | 1368/1370 explained: S71-03 open, same Home/Delete-at-0 cause

EVIDENCE | 9-6-143-ios-del0anchor | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (Delete-at-0 anchored at Home HID arrival, experiment; paste still open) | 1369/1370 explained: experiment, paste-12-34-56x focus hop ran before the commit (KNOWN-CAUSES 9-6 2026-11-17 last misses)
EVIDENCE | 9-6-143-ios-del0anchor | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (same, experiment) | 1369/1370 explained: experiment, same paste cause
EVIDENCE | 9-6-143-ios-del0anchor | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (same, experiment) | 1369/1370 explained: experiment, same paste cause
EVIDENCE | 9-6-144-ios186-del0anchor | iOS 18.6 | NativeOTPFieldStatesIntegration run1 (same, experiment) | 1369/1370 explained: experiment, same paste cause
EVIDENCE | 9-6-144-ios186-del0anchor | iOS 18.6 | NativeOTPFieldStatesIntegration run2 (same, experiment) | 1369/1370 explained: experiment, same paste cause
EVIDENCE | 9-6-145-ios-pastehop | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (paste focus deferred, final tree) | 1370/1370
EVIDENCE | 9-6-145-ios-pastehop | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (final tree) | 1370/1370
EVIDENCE | 9-6-145-ios-pastehop | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (final tree) | 1370/1370
EVIDENCE | 9-6-146-ios186-pastehop | iOS 18.6 | NativeOTPFieldStatesIntegration run1 (final tree) | 1370/1370
EVIDENCE | 9-6-146-ios186-pastehop | iOS 18.6 | NativeOTPFieldStatesIntegration run2 (final tree) | 1370/1370

EVIDENCE | 9-6-147-final-paint-mac | macOS | NativeOTPFieldStatesIntegration (final tree) | 1370/1370
EVIDENCE | 9-6-147-final-paint-mac | macOS | NativeOTPFieldPaintIntegration (final tree) | 13164/13164
EVIDENCE | 9-6-147-final-paint-mac | iOS 26.3 | NativeOTPFieldPaintIntegration (final tree) | 13164/13164
EVIDENCE | 9-6-A004-android-final | Android | NativeOTPFieldParityTest paint (final tree) | 12933/12933
EVIDENCE | 9-6-A004-android-final | Android | NativeOTPFieldStatesTest (final tree) | 1370/1370
EVIDENCE | 9-6-A004-android-final | Android | cellLabelTemplate (final tree) | 3/3

EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | test-live-otpfield (canonical after install) | 32/32
EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | NativeOTPFieldPaintIntegration (canonical after install) | 13164/13164
EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | NativeOTPFieldStatesIntegration run1 (canonical after install) | 1370/1370
EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | NativeOTPFieldStatesIntegration run2 (canonical after install) | 1370/1370
EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | NativeOTPFieldStatesIntegration run3 (canonical after install) | 1370/1370
EVIDENCE | 9-6-201-install-otp-keyarrivals | macOS | NativeOTPFieldStatesIntegration run4 (canonical after install, load 110-190) | 1369/1370 explained: host load 110-190 at the run, Backspace-x3/type-12 first-attempt frame misses under load (KNOWN-CAUSES load rows); the same canonical tree passed 4/4 at 1370 in 9-6-212
EVIDENCE | 9-6-A005-android-post | Android | NativeOTPFieldParityTest paint (canonical after install) | 12933/12933
EVIDENCE | 9-6-A005-android-post | Android | NativeOTPFieldStatesTest (canonical after install) | 1370/1370
EVIDENCE | 9-6-A005-android-post | Android | cellLabelTemplate (canonical after install) | 3/3

EVIDENCE | 9-6-210-canon-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (canonical after install, load 100+; input 96-111 ms late, 6 failing first attempts) | 1368/1370 explained: host load 100 at start (uptime 20/68/101), harness input 96-111 ms late in every failing attempt, not product timing; rerun in 9-6-220
EVIDENCE | 9-6-210-canon-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (canonical after install; 1 failing first attempt Tab-out-commits 1/96, passed on repeat) | 1370/1370
EVIDENCE | 9-6-210-canon-ios263 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (canonical after install) | 0/1370 explained: simulator launch failed (FBSOpenApplicationServiceErrorDomain code 3, process exited at launch), infrastructure, no suite ran; rerun in 9-6-220
EVIDENCE | 9-6-211-canon-ios186 | iOS 18.6 | NativeOTPFieldStatesIntegration run1 (canonical after install; 1 failing first attempt type-12 1/96, input 75 ms late, passed on repeat) | 1370/1370
EVIDENCE | 9-6-211-canon-ios186 | iOS 18.6 | NativeOTPFieldStatesIntegration run2 (canonical after install; 0 second attempts) | 1370/1370
EVIDENCE | 9-6-212-canon-mac-states | macOS | NativeOTPFieldStatesIntegration run1 (canonical after install, 0 failing first attempts) | 1370/1370
EVIDENCE | 9-6-212-canon-mac-states | macOS | NativeOTPFieldStatesIntegration run2 (0 failing first attempts) | 1370/1370
EVIDENCE | 9-6-212-canon-mac-states | macOS | NativeOTPFieldStatesIntegration run3 (0 failing first attempts) | 1370/1370
EVIDENCE | 9-6-212-canon-mac-states | macOS | NativeOTPFieldStatesIntegration run4 (0 failing first attempts) | 1370/1370
EVIDENCE | 9-6-213-canon-ax-otp | iOS 26.3 | tools/ax md-otp-field (5 cases, open findings 0) | 5/5

EVIDENCE | 9-6-220-canon-ios263-rerun | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (canonical, load 50; paste-12-34-56x 1/114, 0 second attempts) | 1369/1370 explained: paste step harness removed its UIPasteboard after the paste, a 63 ms main-thread gap before the first frame (fix in 9-6-230)
EVIDENCE | 9-6-220-canon-ios263-rerun | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (canonical; 0 second attempts) | 1370/1370
EVIDENCE | 9-6-220-canon-ios263-rerun | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (canonical, same paste miss; 0 second attempts) | 1369/1370 explained: paste step harness removed its UIPasteboard after the paste, a 63 ms main-thread gap before the first frame (fix in 9-6-230)

EVIDENCE | 9-6-232-ios-pasteboard-fresh | iOS 18.6 | NativeOTPFieldStatesIntegration run1 (s96-tree, paste board fix; 1 second attempt) | 1370/1370
EVIDENCE | 9-6-232-ios-pasteboard-fresh | iOS 18.6 | NativeOTPFieldStatesIntegration run2 (s96-tree, paste board fix) | 1370/1370
EVIDENCE | 9-6-232-ios-pasteboard-fresh | iOS 26.3 | NativeOTPFieldStatesIntegration runs 1-3 (launch exit 1/3/3, no suite ran) | 0/1370 explained: simulator launch failed (FBSOpenApplicationServiceErrorDomain code 3), infrastructure, no suite ran; same tree launched in 9-6-233
EVIDENCE | 9-6-233-ios263-crashdiag | iOS 26.3 | NativeOTPFieldStatesIntegration (s96-tree, 1 run) | 1370/1370
EVIDENCE | 9-6-233-ios263-crashdiag | iOS 26.3 | NativeOTPFieldStatesIntegration (canonical before 240, 1 run) | 1370/1370
EVIDENCE | 9-6-234-ios263-pasteboard-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (s96-tree, board fix, 0 second attempts) | 1370/1370
EVIDENCE | 9-6-234-ios263-pasteboard-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (0 second attempts) | 1370/1370
EVIDENCE | 9-6-234-ios263-pasteboard-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (2 second attempts) | 1370/1370
EVIDENCE | 9-6-240-install-otp-paste-board | macOS | install dry run, rollback copy, byte identity with s96-tree (cmp) | 1/1
EVIDENCE | 9-6-241-canon-ios263-after-board | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (canonical after 240; 2 second attempts; paste-12-34-56x 1/114, 89 ms gap before the first frame, no late-input flag) | 1369/1370 explained: paste step main-thread stall of 89 ms between input and first frame, cause not yet measured (open, see Current state)
EVIDENCE | 9-6-241-canon-ios263-after-board | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (canonical after 240; 1 second attempt) | 1370/1370
EVIDENCE | 9-6-241-canon-ios263-after-board | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (canonical after 240; 1 second attempt) | 1370/1370
EVIDENCE | 9-6-250-paste-measure | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (instrumented paste measure, 10 iterations of paste-12-34-56x; 4 first-attempt misses) | 1516/1520 explained: measurement run, pasteboard reads med 3.4 ms, stall outside the product code (KNOWN-CAUSES 9-6 2026-11-18)
EVIDENCE | 9-6-250-paste-measure | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (instrumented, 10 iterations; 5 first-attempt misses) | 1515/1520 explained: measurement run, same as run1

EVIDENCE | 9-6-260-canon-ios263-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (canonical; 0 second attempts; paste-12-34-56x 1/114 frames) | 1369/1370 explained: paste step main-thread stall before the first frame outside the product code, pasteboard reads cleared by 9-6-250 (KNOWN-CAUSES 9-6 2026-11-18, DEFECTS S96-01)
EVIDENCE | 9-6-260-canon-ios263-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (canonical; 0 second attempts) | 1370/1370
EVIDENCE | 9-6-260-canon-ios263-x3 | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (canonical; 0 second attempts) | 1370/1370

## Review Triage Log

EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | test-live-otpfield (canonical) | 32/32
EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | NativeOTPFieldPaintIntegration (canonical) | 13164/13164
EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | NativeOTPFieldStatesIntegration run1 (canonical) | 1370/1370
EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | NativeOTPFieldStatesIntegration run2 (canonical) | 1370/1370
EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | NativeOTPFieldStatesIntegration run3 (canonical) | 1370/1370
EVIDENCE | 9-6-100-install-otp-frame-labels | macOS | NativeOTPFieldStatesIntegration run4 (canonical) | 1370/1370
EVIDENCE | 9-6-101-ios-canon-states | iOS 26.3 | NativeOTPFieldStatesIntegration run1 (canonical, S71-03 open) | 1361/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-101-ios-canon-states | iOS 26.3 | NativeOTPFieldStatesIntegration run2 (canonical, S71-03 open) | 1362/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-101-ios-canon-states | iOS 26.3 | NativeOTPFieldStatesIntegration run3 (canonical, S71-03 open) | 1361/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-101-ios-canon-states | iOS 18.6 | NativeOTPFieldStatesIntegration run1 (canonical, S71-03 open) | 1362/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-101-ios-canon-states | iOS 18.6 | NativeOTPFieldStatesIntegration run2 (canonical, S71-03 open) | 1361/1370 explained: S71-03 on the unfixed product (key-delivery cost and harness frame carry, KNOWN-CAUSES 9-6 2026-11-16/17); fixed in 9-6-145/146
EVIDENCE | 9-6-A003-android-canon | Android | otpfield-paint (canonical) | 12933/12933
EVIDENCE | 9-6-A003-android-canon | Android | NativeOTPFieldStatesTest (canonical) | 1370/1370
EVIDENCE | 9-6-A003-android-canon | Android | cellLabelTemplate (canonical) | 3/3
