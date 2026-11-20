---
title: 'Colour and time pickers: audit readiness'
type: 'chore'
created: '2026-11-13'
status: 'blocked'
story_key: '6-2-pickers-audit-readiness'
epic: 6
model: 'sonnet'
wave: 2
lanes: 'mac lane fi · android lane a1 (emulator-5556) · simulator AWC-fi'
lab: 'work/fi-lab'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** md-color-picker and md-time-picker are installed and pass on macOS and Android, but have no gate-7 verdict. Their checkpoints may be stale, their contract matrix has not been checked row by row, and iOS still misses 4-26 dial-tap hand samples per device.

**Approach:** Make both pickers audit-ready: confirm checkpoints, verify every contract row has an implementation, Laboratory exposure and a test, and settle the iOS dial-tap residual with a probe.

## Boundaries & Constraints

**Always:** Typed parts for every `::part`. iOS timing from delivered input (ios-harness.md item 31). The rules in project-context.md apply.

**Never:** No env-lead timing hacks.

</intent-contract>

## Code Map

- `work/fi-lab/PROGRESS.md` -- last section; `docs/native-parity/md-time-picker.md`, `md-color-picker.md`
- `docs/native-parity/ios-harness.md` items 29-47 -- delivered-input timing and frame-blend rules

## Tasks & Acceptance

**Execution:**
- [ ] Contract matrix for both pickers (properties, events, methods, slots, hooks, parts): fill gaps with implementation and tests
- [ ] iOS dial-tap samples: probe whether the miss is capture timing or the hand transition start; fix whichever it is
- [ ] Run paint and states on macOS, iPhone 26.3, iPad 26.3, iOS 18.6 and Android; tools/ax on all platforms
- [ ] Refresh and confirm both checkpoints; update docs and AUDIT rows

**Acceptance Criteria:**
- Given both pickers' states suites, when run on the three iOS runtimes, then they pass in full or each remaining sample is a documented Chrome sampling gap proven by a probe
- Given the contract matrix, when a reviewer checks any row, then it has an implementation, a Laboratory control and a test
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-15 11:45 UTC)

- Job `6-2-pickers-audit-readiness-003-ios-evidence` hung in the iPad colour-picker states run (no output from 11:06 UTC) and blocked lane fi. The coordinator killed it at 11:37 UTC (`871-unstick-fi-and-load`, exit code of the job 143) and shut down the fi simulators. Lane fi runs again.
- Re-run only what is missing (iPad colour-picker states, iOS 18.6 time picker and colour picker), each fixture run wrapped in `with-timeout.sh`. Then the open items in your Current state block.
- The iOS misses (hand, popover, mode-toggle, 1-2 frames): check KNOWN-CAUSES.md rows 1 to 5 before anything else, and re-run on a quiet machine first: the Mac's load was 120 to 550 during your runs.

### Coordinator note (2026-11-15 17:12 UTC)
- The previous session was stopped by the coordinator at 17:12 UTC to switch this story to the short-session rules (project-context.md, section 'Sessions and tokens'). It could not write its last notes. Its jobs keep running. Read the summary lines of the jobs below first (grep and tail, not whole logs), then continue from them.
- Notes are current to 16:43 UTC. In the main queue: 6-2-pickers-audit-readiness-009-install-tap-shift (queued 16:42). Done: -010-ax-mac. Running at 17:06 UTC: -011-ax-mac (lane fi).

### Coordinator note (2026-11-15 22:48 UTC)
- (a) The iOS keyboard/mode misses are NOT accepted as a residual, and no exception record is to be written for them now. Story 6-6 is measuring the same pattern with a stronger model (its jobs 007-012, KNOWN-CAUSES rows 21 and 22): on iOS, after each key or press, the fixture takes no sample and SwiftUI draws no frame for 60-110 ms, because the main thread is blocked in the shim's commit on every pump (`Shim/AppKitShim.swift`). Its job 012 tests the suite without that flush. Do not work on (a) until the coordinator writes the result here; then re-run the iOS picker states with the change in a private tree.
- (b) The oracle generator is `outputs/native-parity/md-time-picker/web-oracle-cloud/oracle-src/` (next to `work/`, not inside it): `README.md`, `run-all.sh`, `oracle.mjs`, `server.mjs`, and the cases in `tp-paint.html` / `tp-states.html`. The Mac capture is `outputs/native-parity/md-time-picker/web-oracle-mac/` (`paint.log` shows how it was run), and `work/fi-lab/tp/convert.py ORACLE_DIR OUT_DIR` condenses it into the shared fixtures. Add one paint case per missing label prop (headlineInputLabel, valueMissingLabel, rangeUnderflowLabel, rangeOverflowLabel, rangeOutsideLabel, toggleDialLabel, periodLabel), capture in Chrome on the Mac in a copy of that folder (never edit the originals), check that the existing cases come out unchanged (same component build: `build-hashes.txt`), then add the Swift and Compose cases. Each new case must fail when the label is ignored (one mutation run per label).
- (c) `period-am-ripple` / `period-pm-ripple`: write an exception proposal in the form AUDIT-PROTOCOL.md asks for, with the Chrome measurement that shows the empty box and the test that covers the ripple's behaviour (press wave on am and pm), and mark it "pending gate-7 review". The reviewer of story 7-3 decides it; do not present it as accepted.
- Then docs and AUDIT rows through a main-queue install and the checkpoint confirm. If only (a) is left, stop with `status: blocked` and say so.

### Coordinator note (2026-11-15 23:42 UTC, result of 6-6)
- Result from story 6-6 (KNOWN-CAUSES rows 21 and 23): the flush on every pump is NOT the cause (job 6-6-012). Measured causes of the 60-110 ms without a sample after a key on iOS: (a) in the select family, the UIKit first-responder hop between the field and a menu row (input views reloaded, 20-90 ms); (b) in the shared shim, the 30 ms key await (`AWC_IOS_KEY_AWAIT`) always times out, because HID keys never count as delivered presses. (b) applies to every iOS states suite that sends keys.
- Cheap diagnostic you can run now: your iOS states suite once as it is and once with `AWC_IOS_KEY_AWAIT=0` in the environment, same simulator, in a timing slot. Record which failing checks disappear and whether any passing check fails. This is a diagnostic only (RESULT lines, not EVIDENCE).
- The shim fix itself is story `9-10-ios-shim-key-await-regression-and-install`; do not edit the shim in your tree. Your acceptance runs on iOS follow its install.

### Note from story 9-10 (2026-11-16 22:15 Mac time)
- Shim key await measured (9-10 jobs 018, 025, 034). On canonical the await hits the 30 ms limit on every key (delivered=0). With shim v5 it ends at delivery (4 to 30 ms). Result for the pickers: Time picker (phone, job 025) before 15544 and 15546, after 15545 and 15544 of 15551: no difference beyond noise between equal runs. Date picker (034): 10417/10417 before and after, mean await 63.9 vs 63.5 ms; Color picker (034): 20944/20950 both, mean await 31.6 vs 25.2 ms. So the shim await does not explain the 14 to 33 ms native lag of the pickers; look elsewhere. Shim v5 is NOT installed: it waits for story 9-15 (iPad Table focus race C910-01). Table of all before/after pairs: story 9-10 Dev Agent Record, jobs 032 to 034.

### Note from story 9-10 (2026-11-17): iOS shim v5 is installed
- Job `9-10-ios-shim-key-await-regression-and-install-100-install` installed shim v5 (`apps/native-ios-parity/Shim/AppKitShim.swift`: the key await now ends at HID delivery) on canonical, byte-identical to the tested `work/s910-lab/shim.after5.swift` (dry run, rollback, cmp passed).
- Before the install, iPad Table 3 rounds before/after: 0 failures in all 6 runs (job `9-10-ios-shim-key-await-regression-and-install-040-ipad-table-fresh`); canonical keys hit the 30 ms limit 61 of 72, after the patch 0 undelivered. Expect iOS keyboard-phase timing (pickers, md-search open/close) to lose the up-to-30 ms blind gap after each key; repeat your iOS runs if you rely on older numbers.

### Coordinator note (2026-11-17 03:17 UTC: block lifted; how to settle the iOS key, mode and open misses)
- Shim v5 is on canonical (see the note from story 9-10 above), so the block is lifted: set the story to `in-progress`. Points (b) and (c) of the note of 2026-11-15 22:48 UTC still stand; do them if they are not done.
- Point (a), the iOS keyboard, mode-toggle and open misses of the time picker and the colour picker. Story 9-10 showed that the key await is not their cause. First get the residual set as it is now: both states suites on canonical with v5, iPhone 26.3 twice, iPad once, iOS 18.6 once, in a timing slot. Work only on what still fails.
- Key phases (Tab, Shift+Tab into the modal scope: no UIKit input event). Story 9-6 measured the same pattern for the OTP field (its KNOWN-CAUSES row and DEFECTS entry S71-03): on the simulator such a key reaches the app 11 to 16 ms after it is sent, and the phase clock started at the send. Its fix records the arrival time of each HID key in the shim (`AWCShimTouch.keyArrivals`, in `work/s96-tree`, installed by story 9-6 after this date) and starts the clock of such a phase at the arrival, in the suite only. Try exactly that in a private tree `work/s62-tree` (take the shim with `keyArrivals` from `work/s96-tree`), for phases whose key has no input event and for no other phase; show the counts before and after, and a mutation run (a phase that starts one frame late must still fail).
- Mode-toggle and open phases have an input event, so the arrival clock does not apply to them. Find the cause with a frame-level trace of one failing phase: time of the event, time of the state change, time of the first frame drawn with the change, against Chrome's frames. Stories 6-6 (menu close: `n2-lab/lab/g6/swift-ios-hop/patch-menu-close-delivered-time.py`) and 9-6 (deferred first-responder hop) are worked examples of the two usual causes. If the product starts the motion later than the event, the fix is in the product source of the picker. If two measured attempts do not name the cause, return `escalate: true`.
- These misses are still not accepted as a residual; no exception record for them.
- Your install order: after story 9-6 has installed `keyArrivals` (ask in the Handover of 9-6 if it is not there when you are ready, and set `blocked` with that reason).

### Coordinator note (2026-11-17 06:12 UTC: keyArrivals is on canonical; rule for the event clock; job 029 result needs a measured explanation)
- `AWCShimTouch.keyArrivals` is on canonical since 11-17 06:07 UTC (job `9-6-201-install-otp-keyarrivals`, exit 0; `apps/native-ios-parity/Shim/AppKitShim.swift` md5 045d11b4...). The focus-trap Tab and Shift+Tab phases can use it now; rebuild your private trees on this shim before the next iOS numbers and say in each EVIDENCE line which shim the run used.
- Product patch `patch-modenextframe.py` (mode-in starts at the frame after the click, as Chrome does): good direction. Before an install, explain by measurement why it alone made the cold subset worse (job 029: 820/832, mutation 821/832). "030 passes" is not that explanation.
- Suite patch `patch-eventclock.py` (phase timed from the app's own `mdModeChange`): the rule of story 9-6 and KNOWN-CAUSES is that a phase starts when the input arrives in the app. The app's event may be the phase start only if the 23 to 26 ms between UIKit's delivery of the touch and `mdModeChange` is shown not to be time of this product. Measure it in the same harness and simulator with the same synthesized tap on (a) a plain UIKit `UIButton` with a target action and (b) a plain SwiftUI `Button` with an empty action, both outside the picker: time from touch delivery to the action, 20 taps each. Also say which start the click phases of the iOS suites that pass today (button, checkbox, menu) use. Then: same 23 to 26 ms on the plain buttons = cost of the touch path for every button; write a KNOWN-CAUSES row, use the same start as those suites, and show a mutation run in which the product's mode change is delayed by one frame after the action and the suite fails. Plain buttons fire within one frame and the picker does not = product latency; find the hop in the picker and fix it there, the suite stays as it is.
- First toggle of a process (50 ms with no frames): measured cause first (main-thread sample of that interval). A product fix or an exception record that holds the measurement; no warm-up toggle in the suite unless the Web oracle run does the same.
- The other misses of your list (dial-tap hour-7, dismiss-escape, colour-picker popover open) and points (b) and (c) of the note of 11-15 22:48 stand as written. End of this run: `review`, or `blocked` with each remaining miss named and what was measured for it.

### Note from story 9-6
- `AWCShimTouch.keyArrivals` is on canonical since 06:02 UTC (08:02 Mac time) 2026-11-17, job `9-6-201-install-otp-keyarrivals`, `AppKitShim.swift` md5 045d11b46d7008165195a9a485a855d3 (before: 39cdcd264a817a856e80043f3cd4ec7e; the diff is the two keyArrivals hunks only).

### Coordinator note (2026-11-17 09:06 UTC: priming conditions; shim change goes through a shim story; end this run with an install)
- Keyboard priming (KNOWN-CAUSES row 35, job 038): acceptable as a harness step under three conditions. (a) The stall is matched by console timestamps to the interval of a failing first phase, as your row says. (b) The throwaway key does not reach the product: show that no product handler and no inspection value changes after it. (c) It is a change of the shared shim (`AWCShimTouch.primeKeyboardOnce`), so every iOS suite gets it: do not install it yourself. If job 038 confirms it, write it as one anchored patch file in `work/s62-lab` (against the canonical shim, md5 30db5861...) and report it in the open items; the coordinator opens a shim story that runs the other iOS suites before and after and installs it. Go on in your private tree with priming on.
- Your `patch-tabarrival`: `AWCShimTouch.keyArrivals` is on canonical (story 9-6), so the shim hunk is not needed; keep the suite hunk only.
- The remaining points keep the rules of the note of 06:12 UTC: mode-toggle about 12 ms late (event clock only with the plain-button measurement of job 032 written into the record and a one-frame mutation; say what job 029 showed), tap-hour-7, Tab and Shift+Tab, dismiss-escape. For each: a measured cause, then a fix or a named finding.
- This is the third run of six sessions on this story today. Plan this run so that it ends with an install of what is proven (one main-queue job, anchored, byte identity) and canonical runs (iPhone 26.3 twice, iPad once, iOS 18.6 once, strict counts), and set `review` if every remaining miss is fixed, or `blocked` with each remaining miss named with its measured cause. Do not end `in-progress` again without an install.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: all up to `6-2-pickers-audit-readiness-041-prime-repeat` (09:49 UTC) and `-042-tabarrival-iphone` (10:22 UTC). Running when the Mac went to sleep: `6-2-pickers-audit-readiness-043-tabkeyat-iphone-ipad-mac`. Still queued at the wake (they run now): `-044-tabkeyat-ios18-iphone-cp`, `-045-releaseclock-mode`.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

### Coordinator note (2026-11-17 22:21 UTC: focusaftermode is not installed; the toggle gap goes to 9-23)
Decision on the focusaftermode patch (tree k). It moves the UIKit focus of the hour field to after the mode-in motion on iOS (about 0.5 s). That is a change of product behaviour, not only of timing: on the Web the hour field has the focus right after the toggle, and your own open item says that a key within 0.48 s of the toggle would reach the old responder. A suite rule 'no key phase within 0.48 s of a toggle' would hide that difference, so do not add it.
- Do not install focusaftermode in this run. If jobs 050 and 051 show that the macOS drop is the environment and not the tree, install the other hunks only (modenextframe, tabkeyat, the releaseclock suite hunk): build a private tree with these three and without focusaftermode, run the mutation subset and the full states on it, and take the install and the canonical runs from that tree.
- The toggle gap of job 048 (no frame for 40 to 42 ms after the toggle, becomeFirstResponder 17 to 28 ms inside it) is the cause class of story 9-23 (main-thread time inside UIKit's first-responder change; lane di, lab work/s923-lab). The coordinator has written your numbers into 9-23, so that its decision and its regression cover the mode toggle of the time picker. How the suites treat frames inside that time is decided there for all suites together and installed by the coordinator after the user has seen the numbers. Row 35 (first key) also stays with 9-23 (its step 4).
- If you hold that the later focus is the better behaviour on iOS anyway, make the case with measurements and not with a suite rule: one run in which a hardware key is sent 100 ms after the toggle on the Web fixture and on tree k (where does the digit land in each), and the time at which the software keyboard appears in each. Write it as a proposal in the Handover; the auditor of 7-3 and the coordinator decide. Without that it is not installed.
- Use the remaining sessions for the misses that are not this class: tap-hour-7, dismiss-escape tap-hour-5, the colour-picker presets and popover misses (1 to 3 per run): cause with measurements, fix or named open.
- End of this run: EVIDENCE lines from canonical after the install, verify_evidence.py. If the toggle gap or row 35 misses are the only ones left on canonical, end with status blocked and the line 'waits for the 9-23 install', with the count per platform; the coordinator relaunches this story for the final runs after that install. Do not end with review while iOS states runs still miss.

### Coordinator note (2026-11-18 04:30 UTC: link to the Mac was down 00:00-04:25 UTC; the Mac did not sleep; job results are valid)
Between about 00:00 and 04:25 UTC on 2026-11-18 the link between the agents and the Mac was down (device calls answered 'not connected to the bridge'). The Mac itself did not sleep: the power log has no sleep or wake line since 18:43 UTC on 11-17 (coordinator jobs 889 and 890), it was on AC power, and the lanes kept running jobs through the whole gap. Sessions that started in the gap ended without work, and the coordinator stopped the other runs at 00:13 UTC so that no session was spent on a dead link. Your jobs that were in flight have all finished; their results are valid under the usual rules (the load written next to each run). Nothing was restarted on the Mac. Continue from your Current state; read the logs of the jobs that finished in the gap first.

### Coordinator note (2026-11-18 05:28 UTC: three sessions to close the work up to the 9-23 install)
This story has had 23 sessions. This run has three sessions and closes its work up to the 9-23 install.
- Correction to your Current state: the canonical shim md5 starts with 30db5861 (checked by the coordinator at 05:28 UTC on 11-18; AppKitShim.swift is unchanged since the install of story 9-14 at 07:25 UTC on 11-17). Do not write 045d11b4 into EVIDENCE lines; if a tree of yours has that md5, it was copied before the 9-14 install - say which trees, and do not take evidence from them for phone click timing.
- Install 115 (cpshift) is on canonical (log: INSTALLED, byte-identical to s62-tree-p). Read job 116 and write the EVIDENCE lines for the canonical colour-picker runs.
- Then the paperwork in one go: docs and AUDIT rows through one main-queue install, checkpoint confirm, ripple exception marked as pending gate 7, verify_evidence.py.
- The remaining misses that are not in the class of 9-23 (time picker: tap-hour-7 t=1100, dismiss-escape tap-hour-5, focus-trap-dial Tab and Shift+Tab hand, drag-inner-14-to-17, dial-drag am period-am; colour picker: drag-plate thumb press t=100, presets click-5, popover-in-dialog show-and-focus): do not chase them one at a time in this run. Make one table from the canonical runs you already have after install 110 (jobs 111, 113, 116): per miss the suite, case and phase, the check, the platform, in how many of how many runs it showed, the load of those runs, and what is known about the cause. Write each row as a named finding into DEFECTS.md (open; say which you hold to be load-dependent and why), so that none is lost.
- End with status blocked and the line 'waits for the 9-23 install'. After that install the coordinator relaunches this story for canonical runs on every platform; what still misses then gets its own fix story with per-frame captures. Do not end with review while iOS states runs still miss.

### Coordinator note (Coordinator decision 2026-11-18 21:24 UTC: unblocked; there is no 9-23 install; canonical evidence runs, then a class per remaining miss)
The 9-23 result is in and nothing is installed from it (the harness helper added failures; -O changes nothing for text fields; a motion clock moved to the delivered input had no effect in the table and select stories). This story does not wait for an install any more. Set status in-progress. focusaftermode stays uninstalled.
Order for this run (4 sessions).
1. Canonical states for both pickers: iPhone 26.3 x2, iPad once, iOS 18.6 once, macOS once, in timing slots. Each iOS run waits until the 1-minute load is below 20 (at most 15 minutes, 30 s steps, no artificial load) and prints load1max (above 30 is a class of its own). Write the evidence lines.
2. For every remaining iOS miss (time picker: tap-hour-7, dismiss-escape tap-hour-5, focus-trap-dial Tab and Shift+Tab hand, drag-inner-14-to-17, dial-drag am period-am, open t=266, mode toggle; colour picker: drag-plate thumb press, popover open): its rate over the runs of step 1 and of earlier canonical jobs, one per-frame capture, and a class with proof: (a) UIKit turn at a focus change (a become or resign bracket inside the block of that attempt: the BRK hooks of work/s923-lab show it); (b) product clock or product work (say where the clock starts: at the state write, or at a later onChange or body pass; story 9-29 found exactly that for the autocomplete caret); (c) not classed. Show passing attempts of the same check too: a block that is the same in passing attempts does not explain the failing ones.
3. Fix in the private tree what is class (b) and small; anything larger goes into the table with file and function.
4. End: review only if all iOS runs of step 1 pass after the fixes; otherwise blocked with the words coordinator decision and the table (S62 id, check, rate, class, proof, fix or proposal). The coordinator makes fix stories from that table.
Before queueing a job, check that no file with the same name already sits in the lane queue.

### Coordinator note (Coordinator decision 2026-11-18 22:46 UTC: table accepted; the fix work moves to stories 9-32 and 9-33; one closing session later)
Your table is accepted as the record of the remaining iOS misses (job 120). The fix work moves to two new stories: 9-32 (time picker: S62-01 to S62-07) and 9-33 (colour picker: S62-09, S62-10 and the unnamed macOS miss of job 120). This story stays blocked until both are in review; then it gets one closing session: point the DEFECTS lines S62-01 to S62-10 to those stories, keep the evidence block as it is (0 hard failures), set review. Nothing else is to be done here; do not queue jobs.

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

### Coordinator note (Coordinator note 2026-11-19 20:40 UTC: stays blocked until 9-32 and 9-33 are in review)
Decision after the closing session of 2026-11-19 (class not establishable from the existing canonical runs: fewer than 10 runs per runtime, no canonical mutation 3 of 3): this story stays blocked until stories 9-32 (time picker; owns S62-01 to S62-08) and 9-33 (colour picker; owns S62-09 to S62-12) are in review. They run the sets the class needs on the tree that becomes canonical with their installs: at least 10 runs per iOS runtime and a +33 ms mutation that fails 3 of 3. Then this story gets one closing session: take their tables, check that every S62 line is either closed with its numbers or open with an owner, refresh the audit-readiness record, review. Do not queue runs from this story.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- STATUS blocked (closing session 2026-11-19, class 'one frame, rare' applied to EXISTING runs): the class cannot be established for any open line, so no line is closed and no docs install was made. Nothing in flight, nothing queued, no jobs run.
- Why (PARALLEL.md item e, condition 2: at most 1 of 5 runs over at least 10 runs per runtime): canonical runs after installs 110/115 are tp iPhone 4 (111a,b 120a,b), iPad 2, 18.6 2; cp iPhone 5 (111, 116a,b, 120, +1), iPad 3, 18.6 3. All below 10, so rate cannot be shown. Mutation (condition 3): only job 047 (jM33T 824/832, tree j, iPhone, mode-toggle), not 3 of 3 and not on canonical. Shifted comparison (condition 1): cp thumb press web 0.4 vs native 0.0-0.11 at t=100 (about 2 frames, fails size); tp hand misses are 2-frame tap lags.
- Table (S62 id | check | runtime k of n | size | mutation job | class result | owner):
  S62-01 tp dial-tap/tap-hour-7 hand t=1100 | iPhone 1 of 4, 18.6 1 of 2 | ~1-2 frames | none | not covered (n<10) | 9-32
  S62-02 tp dismiss-escape/tap-hour-5 hand | iPhone 1 of 4 (3 of 4 in 111) | 1-2 frames | none | not covered | 9-32
  S62-03 tp focus-trap-dial Tab/Shift+Tab hand | iPhone 4 of 4 (3-4 samples), iPad | 23-36 ms | none | not covered (>1 of 5); UIKit focus turn proof is jobs 042-043 only | 9-32
  S62-04 tp drag-inner-14-to-17 t=1899 | iPhone 3 of 4 | 1 sample | none | not covered (>1 of 5) | 9-32
  S62-05 tp dial-drag am period-am t=4699 | iPhone 4 of 4 | 1 sample | none | not covered (>1 of 5) | 9-32
  S62-06 tp open t=266 | iPad, 18.6 | 40-110 ms | none | UIKit focus turn (row 35, 9-23 note 2026-11-19: block located in UIKeyboardTaskQueue/becomeFirstResponder for first key; first open inconclusive in job 021) | 9-32
  S62-07 tp mode-toggle to-input/to-dial | iPhone 3 of 4, 18.6 | 40 ms gap | 047: jM33T 824/832 (iPhone, tree j) | UIKit focus turn proof job 048 (focushop 17-28 ms inside the gap); focusaftermode not installed | 9-32
  S62-09 cp drag-plate thumb press t=100/133 | iPhone 5 of 5 | ~2 frames | none | not covered (>1 of 5, >1 frame) | 9-33
  S62-10 cp popover open/show() | iPhone, iPad 5, 18.6; case moves between runs | 1-2 frames | none | not covered (n<10) | 9-33
  S62-08/12 macOS | not covered (class excludes macOS) | | | open | 9-33 (S62-12), unowned (S62-08)
- To use the class, per runtime at least 10 canonical runs and a 3-of-3 canonical +33 ms mutation are missing (about 6 more tp runs per iOS runtime plus cp, in a timing pool of 2). Coordinator: either queue those runs, or wait for 9-32/9-33 (both in-progress).
- NEXT: after 9-32 and 9-33 are in review, one closing session: point DEFECTS S62-01..10 to them; no command needed now.

### Evidence
- EVIDENCE | 6-2-pickers-audit-readiness-002-mac-evidence | macOS | paint tp | 10726/10726
- EVIDENCE | 6-2-pickers-audit-readiness-002-mac-evidence | macOS | paint cp | 13685/13685
- EVIDENCE | 6-2-pickers-audit-readiness-002-mac-evidence | macOS | states tp | 15551/15551
- EVIDENCE | 6-2-pickers-audit-readiness-002-mac-evidence | macOS | states cp | 20950/20950
- EVIDENCE | 6-2-pickers-audit-readiness-009-install-tap-shift | macOS | states tp canonical after install | 15551/15551
- EVIDENCE | 6-2-pickers-audit-readiness-A001-android | Android | 6 instrumented classes | 6/6
- EVIDENCE | 6-2-pickers-audit-readiness-A002-ax-android | Android | tools/ax cases both pickers | 5/5
- EVIDENCE | 6-2-pickers-audit-readiness-017-ax-compare | macOS | compare md-time-picker: 3 cases, 0 open findings | 3/3
- EVIDENCE | 6-2-pickers-audit-readiness-017-ax-compare | macOS | compare md-color-picker: 2 cases, 0 open findings | 2/2
- EVIDENCE | 6-2-pickers-audit-readiness-018-checkpoints | macOS | checkpoint-refresh report, both pickers current | 2/2
- EVIDENCE | 6-2-pickers-audit-readiness-024-labels-swift2 | macOS | paint tp label cases (7 new) in private tree | 398/398
- EVIDENCE | 6-2-pickers-audit-readiness-024-labels-swift2 | macOS | paint tp all cases incl. 7 label cases in private tree | 11124/11124
- EVIDENCE | 6-2-pickers-audit-readiness-101-install-labels | macOS | paint tp on canonical after label install | 11124/11124
- EVIDENCE | 6-2-pickers-audit-readiness-A005-canonical-tp-android | Android | canonical tp parity+interaction (NativeTimePickerParity, NativeTimePickerInteraction) | 2/2
- EVIDENCE | 6-2-pickers-audit-readiness-A004-labels-android2 | Android | NativeTimePickerParityTest incl. 7 label cases (private tree) | 1/1
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS iPhone 26.3 | states tp canonical shim 30db5861 run a (explained: open findings S62-01..08 in DEFECTS.md) | 15544/15551
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS iPhone 26.3 | states tp canonical shim 30db5861 run b (explained: open findings S62-01..08 in DEFECTS.md) | 15543/15551
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS iPad 26.3 | states tp canonical shim 30db5861 (explained: open findings S62-01..08 in DEFECTS.md) | 15546/15551
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS 18.6 | states tp canonical shim 30db5861 (explained: open findings S62-01..08 in DEFECTS.md) | 15539/15551
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | macOS | states tp canonical (explained: open findings S62-01..08 in DEFECTS.md) | 15550/15551
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS iPhone 26.3 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20947/20950
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS iPad 26.3 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20940/20950
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | iOS 18.6 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20941/20950
- EVIDENCE | 6-2-pickers-audit-readiness-111-canonical-runs | macOS | states cp canonical (explained: open findings S62-09..12 in DEFECTS.md) | 20948/20950
- EVIDENCE | 6-2-pickers-audit-readiness-113-mac-repeat | macOS | states tp canonical run a (quiet start, load 7) (explained: open findings S62-01..08 in DEFECTS.md) | 15549/15551
- EVIDENCE | 6-2-pickers-audit-readiness-113-mac-repeat | macOS | states tp canonical run b | 15551/15551
- EVIDENCE | 6-2-pickers-audit-readiness-113-mac-repeat | macOS | states cp canonical run a | 20950/20950
- EVIDENCE | 6-2-pickers-audit-readiness-113-mac-repeat | macOS | states cp canonical run b (explained: open findings S62-09..12 in DEFECTS.md) | 20949/20950
- EVIDENCE | 6-2-pickers-audit-readiness-116-canonical-cp | iOS iPhone 26.3 | states cp canonical after install 115, shim 30db5861 run a (explained: open findings S62-09..12 in DEFECTS.md) | 20948/20950
- EVIDENCE | 6-2-pickers-audit-readiness-116-canonical-cp | iOS iPhone 26.3 | states cp canonical after install 115, shim 30db5861 run b (explained: open findings S62-09..12 in DEFECTS.md) | 20947/20950
- EVIDENCE | 6-2-pickers-audit-readiness-116-canonical-cp | iOS iPad 26.3 | states cp canonical after install 115, shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20949/20950
- EVIDENCE | 6-2-pickers-audit-readiness-116-canonical-cp | iOS 18.6 | states cp canonical after install 115, shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20949/20950
- EVIDENCE | 6-2-pickers-audit-readiness-116-canonical-cp | macOS | states cp canonical after install 115 | 20950/20950
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS iPhone 26.3 | states tp canonical shim 30db5861 run a, load1 16-19 at start (explained: open findings S62-01..08 in DEFECTS.md) | 15537/15551
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS iPhone 26.3 | states tp canonical shim 30db5861 run b (explained: open findings S62-01..08 in DEFECTS.md) | 15545/15551
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS iPad 26.3 | states tp canonical shim 30db5861 (explained: open findings S62-01..08 in DEFECTS.md) | 15533/15551
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS 18.6 | states tp canonical shim 30db5861 (explained: open findings S62-01..08 in DEFECTS.md) | 15545/15551
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS iPhone 26.3 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20946/20950
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS iPad 26.3 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20945/20950
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | iOS 18.6 | states cp canonical shim 30db5861 (explained: open findings S62-09..12 in DEFECTS.md) | 20948/20950
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | macOS | states tp canonical | 15551/15551
- EVIDENCE | 6-2-pickers-audit-readiness-120-canonical-all | macOS | states cp canonical (explained: open findings S62-09..12 in DEFECTS.md) | 20949/20950
- EVIDENCE | 6-2-pickers-audit-readiness-118-install-docs | macOS | docs and AUDIT rows installed byte-identical to dry run; checkpoints both pickers current after re-pin | 2/2

### Session 1 (2026-11-15, agent s1) - orientation, lane check, contract-matrix pass 1
- status set to in-progress. Handover was empty; no earlier agent had touched this story. fi-lab/PROGRESS.md (to 2026-11-09) holds the history: dial-tap hand press fix installed by fi-926 (macOS tp states 15551/15551; iOS iPhone 15526, iPad 15543-15547, 18.6 15525 of 15551; cp states 20946-20950 of 20950). Open there: iOS residuals 4-26 per device (dial-tap hand samples: Chrome starts the transition at the frame timestamp before the pointer event, native hand starts at the event; r11/r12/r13 frame-start variants were worse and not installed).
- Lane check: job `6-2-pickers-audit-readiness-001-probe` (queue-fi) ran, exit 0, within 45 s, so lane fi is alive (Mac time 11:29). In job scripts `xcrun simctl` and `adb` are NOT on PATH by default: export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer (as fi-lab/harness2.sh does) and set the Android SDK platform-tools path (copy the env lines from claude-runner/done/fi-760-ipad-variance.sh and an A-test.sh job).
- Checkpoints: no checkpoint.json exists for either picker under outputs/native-parity/md-time-picker or md-color-picker (only web-oracle dirs; outputs/native-parity/md-date-picker has one). Task 4 must create them with awc-native/tools/checkpoint-refresh.py (read its usage first; see done/6-3-020-checkpoints.log for a recent run).
- Contract matrix (task 1): script `work/fi-lab/matrix/matrix.py` (reads docs/native-parity/baseline-inventory.json, greps Swift, Kotlin, playground and test files; JSON in fi-lab/matrix/matrix.json). Totals: tp 36 props, 7 events, 5 methods, 0 slots, 23 parts, 81 hooks; cp 13 props, 3 events, 2 methods, 1 slot, 20 parts, 11 hooks. Every row has Swift + Kotlin implementation except the items below. Laboratory exposure of every row is asserted generically by apps/native-playground/picker-integration.test.mjs ("both pickers cover every source hook, property, event, method, slot and part in both released policies"); the heuristic "no-lab" hits for parts are from that generic path (parts come from native-compiler generated catalog), not real gaps; re-run that test in a job for the evidence count.
- Real/likely gaps still to settle (tp): (a) props with no test naming them: headlineInputLabel, valueMissingLabel, rangeUnderflowLabel, rangeOverflowLabel, rangeOutsideLabel, toggleDialLabel, periodLabel (Swift reads them in TimePickerModel.swift lines 21-26; add a test per label: fixture value shows in the dialog / validity message, in Swift and Compose); 39 of 81 hooks not named in any test (hook paint cases exist for many via hooks-all-dial; verify by oracle case names before adding); (b) parts period-am-ripple / period-pm-ripple have no Swift/Kotlin inspect node: paint test skips them ("md-ripple reports an empty box in Chrome"). Needs a decision/record: typed part API where implementable, else the full exception record; (c) mdModeChange event: confirm a states-suite case. cp: parts field-r/g/b/s/l/a are built as "field-" + ch (implemented; test coverage present).
- Not started: iOS dial-tap probe (task 2), full reruns (task 3), checkpoint refresh + docs/AUDIT (task 4). No product files changed, no installs.
- Next agent: (1) finish matrix rows above and write the final matrix table into docs/native-parity/md-time-picker.md / md-color-picker.md; (2) probe task: use fi-lab/harness2.sh with NativeTimePickerStatesIntegration on AWC-fi (udid in fi-lab/udid, udid-ipad, udid-18) and compare the Chrome hand curve timestamps vs delivered input; (3) rerun suites; (4) checkpoints.


### Session 2 (2026-11-15, agent s2) - evidence jobs queued
- Queued on canonical copies (tree work/fi-tree-s62, logs fi-lab/run-s62/): `6-2-pickers-audit-readiness-002-mac-evidence` (queue-fi), `-003-ios-evidence` (queue-fi, iPhone 26.3 / iPad / 18.6 states for both pickers via harness2), `-A001-android` (queue-a1, 5 Android test classes on emulator-5556).
- 002 so far: picker-integration.test.mjs exit 0; macOS paint tp 10726/10726, cp 13685/13685. States and the rest pending when this note was written (check done/6-2-pickers-audit-readiness-00*.log and -A001).
- Still to do after the jobs: label tests (headlineInputLabel etc.), period-ripple part decision, mdModeChange case check, dial-tap probe, checkpoint pin (tools/checkpoint-refresh.py pin, no checkpoint.json exists), docs and AUDIT rows via a main-queue install.
- Results so far (Mac time 12:40): `-002`: picker-integration exit 0; macOS paint tp 10726/10726, cp 13685/13685; tp states 15551/15551 (screen locked: 94 presses while app inactive, so hand samples pass only there; dial-tap/tap-hour-7 chrome 1100 native 1100). `-A001` (emulator-5556, BUILD SUCCESSFUL 20m37s): 6 tests, 0 failures (NativeTimePickerInteraction/Parity, NativeColorPickerInteraction/Parity, LivePreviewPickersHost x2; logs fi-lab/s62-andr/A001*). cp states and iOS (-003) pending.
- More results (job `-002` done exit 0: macOS cp states 20950/20950; tp states 15551/15551). Job `-003` iOS states on canonical copy (logs outputs/native-parity/_ios/fi/console-s62-<dev>-<fixture>.log): iPhone 26.3 tp 15520/15551 (31 misses: dial-tap hand 4+3 samples, dial-drag hand 8, dismiss-escape hand 5, focus-trap-dial Tab/Shift+Tab hand 6, input-keyboard-24h-rtl open 4, mode-toggle/to-dial 1; native hand starts ~1-2 frames late in taps), iPhone cp 20944/20950 (6 misses, all timing: cp-drag-plate press thumb t=100/133 and cp-popover click-trigger-open t=133/166, Enter-on-trigger t=1200; cp was 20946-20950 before), iPad tp 15524/15551. iPad cp and 18.6 pending when written. The residuals are broader than the "4-26 dial-tap hand samples" in the AC wording (focus-trap Tab hand, rtl open, cp popover/press also miss): not yet shown to be Chrome sampling gaps; needs a probe (compare Chrome frame grid vs delivered-input time per sample) before the AC "documented gap" route is claimed.
- End of session 2 (status stays in-progress; no tasks ticked, no product files changed, nothing installed). Job `-003` was still running at Mac time ~13:25 (iPad cp, then iPhone-18.6 tp and cp remain; read `done/6-2-pickers-audit-readiness-003-ios-evidence.log` and grep "States.*:"). Android 6/6 passed (A001), macOS paint 10726 + 13685 and states 15551 + 20950 pass.
- Next agent: (1) read the rest of 003 and classify every iOS miss per device (script: grep "^FAIL" in console-s62-*.log); rerun iPhone cp alone to learn whether the 6 popover/press misses are load noise or a regression (cp was 20946-20950 before). (2) Probe (task 2): the misses are not only dial-tap; focus-trap-dial Tab hand, input-keyboard-24h-rtl open and cp popover also miss by 1-2 frames; compare Chrome oracle frame timestamps vs delivered-input time for those samples (harness2.sh with AWC_TP_DEBUG=1 prints anchors). Frame-start variants r11-r13 were already tried and were worse (PROGRESS.md 2026-11-08/09). (3) Gaps from session 1: label-prop tests (7 labels), period-ripple part record, mdModeChange case. (4) Checkpoints: none exist; use `python3 tools/checkpoint-refresh.py pin TAG --checkpoint outputs/native-parity/<tag>/checkpoint.json --sources ... --runs 6-2-pickers-audit-readiness-002-mac-evidence,...-003-ios-evidence,...-A001-android`, then tools/ax run (not yet run this story), docs and AUDIT rows by main-queue install.
- Job note: the tree for these runs is work/fi-tree-s62 (rsync copy of canonical, refreshed by each job's header).

### Session 3 (2026-11-15, agent s3) - wait and classification only
- Waited ~15 min for job 003; it did not progress past iPad tp (log mtime 13:06 Mac). Classified existing console logs (outputs/native-parity/_ios/fi/console-s62-*.log): iPhone tp 31 FAIL (dial-tap hand 7, focus-trap-dial Tab/Shift+Tab hand ~6, dial-drag hand 8, dismiss-escape hand 5, rtl keyboard open 4, mode-toggle 1); iPad tp 27 FAIL (focus-trap-dial Tab 10 + Shift+Tab 5, mode-toggle 5, others); iPhone cp 6 FAIL (popover click-trigger-open/Enter 4, plate thumb press 2). All are 1-2 frame timing misses of the hand/popover/mode transitions; none shown yet to be a Chrome sampling gap, so the AC "documented gap" route is not yet claimed. No product files changed; no tasks ticked.
- Status stays in-progress: tasks 1-4 all still open; session budget (3 of 3) used, needs a fresh story run after the coordinator checks lane fi.

### Session 4 (2026-11-15, agent s4) - iOS rerun, hand probe, tap-input finding
- Job `-004-ios-missing` (exit 0, Mac load 12-135): iPad cp 1 miss (cp-popover-ltr click-trigger-open t=133; the harness tail cut the summary line, `fails: 1` of 20950 in the run log); iOS 18.6 tp 15518/15551, cp 20938/20950; iPhone cp 20946/20950 (003 had 20944: load noise on the popover/press samples).
- Job `-005-ios-hand-probe` (exit 0; AWC_TP_DEBUG=1 plus a hand-anchor line per tap phase; test patched in the private tree only): iPhone tp 15521/15551, iPad 15537/15551, 18.6 15523/15551. Hand start (native minus Chrome's recorded hand start) per tap: iPhone +32/+36, 0 (hour-7), +9; iPad +11/+12/+17, -8, -15; 18.6 +28/+29/+44, +10, -3. The late ones track the touch delivery shift of the press (iPhone +26, 18.6 +35/+37, iPad +8..+14).
- Finding (cause, a test-planning defect, not a product one): the harness fires a tap press at the first animation the oracle's sampler SAW (`inPhase.first.start`: dial-tap hand 1100, number 1067), but Chrome's pointerdown handler ran earlier (mdInput t=1033 in phase 1000; for tap-minute-5: mdInput 1900, hand seen 1933). The oracle samples on a 33 ms grid, so the recorded animation start trails the input by up to 2 frames; the sample at t=1100 already reads 120.92 deg (about 2/3 of the hand move). Native cannot start before the press it is given, so tap hand samples miss by about 2 frames (~33 ms), matching the 5-sample runs of FAIL lines (dial-tap tap-hour-7 t=1100..1233, tap-minute-5 t=2000..2099, dial-drag-24h tap-outer-9 / tap-minute-20, dismiss-escape tap-hour-5).
- Fix under test (`work/fi-lab/s62-patch-tap-input.py`, one anchored line in plan(): `downAt = evs.first ?? inPhase.first?.start ?? t`): job `-006-tap-input-fix` (queue-fi) runs macOS + 3 iOS tp states with it. No env lead (story rule). If it improves without regression: install the test change through a main-queue job (anchored, byte identity), rerun, then write EVIDENCE.
- Job `-006-tap-input-fix` (exit 0; press fired at Chrome's first md* event): macOS tp 15532/15551 (REGRESSION from 15551: native hand now starts a frame ahead of Chrome on macOS, which has no delivery lag), iPhone 15539, iPad 15529, 18.6 15531. Rejected: the correct press time for macOS is the old one; only iOS has a delivery lag.
- Job `-007-tap-shift` (exit 0; patch `work/fi-lab/s62-patch-tap-shift.py`: a tap's hand samples are compensated with the delivery shift of the press, the first delivered input of the phase, instead of the later release's): iPhone 15538 (13 misses), 18.6 15538 (13), iPad 15482 (one-off: 40 misses all in the first phase `dial-drag-12h-ltr-light/open`, dialog/scrim/mode, unrelated to taps = load blip, rerun in 008). The tap-minute / tap-outer / tap-minute-20 hand misses are gone on iPhone and 18.6; left: focus-trap-dial Tab/Shift+Tab hand (keyboard, no delivered input to pair: 8 on iPhone), mode-toggle 2, tap-hour-7 1-2, drag-inner 1, dismiss-escape 1. The patch touches only the UIKit path (deliveryShift is empty on macOS).
- Job `-008-tap-shift-guard` queued: macOS + iPad + iPhone + 18.6 with the 007 patch. If macOS stays 15551 and no device is below its best earlier figure: install the test change by a main-queue anchored job.
- Label coverage (task 1): translated-label paint case `dial-labels-translated` sets headlineDialLabel, toggleInputLabel, cancel/ok/am/pm/hour/minute labels and `dial-headline` sets headline. Props in NO oracle case: headlineInputLabel, valueMissingLabel, rangeUnderflowLabel, rangeOverflowLabel, rangeOutsideLabel, toggleDialLabel, periodLabel. The oracle case generator was not found (not in awc-native apps/tools, fi-lab, done/*.sh by the case names); locate it (grep for "hooks-all-dial" fails too, so cases are likely built from tables) before adding cases.

### Session (run session 6, 2026-11-17) - mode-toggle frame trace, cause, fix under test
- Chrome oracle (outputs/native-parity/md-time-picker/web-oracle-mac/states.json, run mode-toggle): mdModeChange 1066.8 / 1933.43; mode-in animation startTime 1100.04 / 1966.68 (frame after the click), 450 ms linear keyframes with cubic-bezier(0.05,0.7,0.1,1); samples p=0 at 1100.13 and 0.5466 at 1133.4 = the curve at 33.4 ms (computed 0.547). The earlier "sampler jitter" hypothesis is wrong.
- Job 028 (canonical + suite trace, mode-toggle subset; diagnostic, RESULT not EVIDENCE): iPhone 825/832 x2, iPad 827/832, 18.6 829/832. Trace: iPad event 1118, first record 1125.9 p=0.214; 18.6 event 1126, first 1131.5 p=0.149; iPhone event 1137, first 1145 p=0 then no frame until 1195 (cold first toggle: input-hour focus). So the native clock starts at the event's body evaluation, ~8 ms before the first displayed tick; Chrome starts at the first frame (p=0 drawn). Second offset: the app raises mdModeChange 23-26 ms after UIKit delivered the touch.
- Fix candidate: modeAt = frameStart(now) + one frame in toggleMode (s62-lab/patch-modenextframe.py), same rule as the picker's non-immediate transitions. Jobs 029 (fix alone) and 030 (fix + suite clock from the app's mdModeChange) queued; mutation runs use +33 ms.

### Session (run session 7, 2026-11-17) - plain-button probe, g-tree trace
- Job 6-2-pickers-audit-readiness-031 failed to build (actor isolation in the probe); fixed in 032. RESULT (diagnostic, not EVIDENCE) 032, iPhone 26.3 canonical shim: swiftui 20/20 fired, last-delivery->action 0.3 ms; uikit 0.1 ms; md-button 0.3-0.6 ms; first-delivery->action 49.7 / 64.9 / 65.8 ms (= the 60 ms I put between down and up plus one frame).
- Job 033 RESULT (diagnostic): tree g mode-toggle subset iPhone 832/832, iPad 783/832 (first phase open, see Current state).

### Session (run session 12, 2026-11-17 Mac ~12:00) - Tab arrival clock refuted; Tab hand cause and product fix under test
- Job 042 (tree h = canonical shim 30db5861 + modenextframe + eventclock + patch-tabarrival2 suite hunk): iPhone focus-trap subset 1472/1484 (8 Tab hand, 4 Shift+Tab hand). Debug `keyarrival` lines: arrivals 0 for all 18 Tab / Shift+Tab phases. Reason (suite source, `key()`): in a modal the suite hands Tab to `AWCModalScope.tab` synchronously and `continue`s, no HID key is sent, so there is no delivery lag to compensate: the arrival clock (patch-tabarrival / -tabarrival2) does not apply and is dropped. The phase clock at the step is right.
- So the Tab hand lag is product time: anchor native-fired 23-36 ms (Chrome: hand at the frame after keydown). Code path: trapTab -> focusPart -> UITextField becomeFirstResponder -> focusChanged -> `rt.selecting` -> hand body -> `retarget(immediate)` with no pointer input = `now` of that later body evaluation.
- Fix under test `s62-lab/patch-tabkeyat.py`: trapTab stamps `rt.keyAt`; the hand's immediate retarget without pointer input starts at frameStart(keyAt) + 1 frame (Chrome rule, as modenextframe). Mutation = +33 ms; trace variant prints TPTRACE. Jobs 043 (iPhone ft trace + mutation, iPhone full, iPad full, macOS) and 044 (iOS 18.6, iPhone 2nd, cp iPhone + iPad) queued in queue-fi.

### Session 15 (2026-11-17 Mac ~22:35) - mutation sensitivity settled; mode-toggle miss = frame gap after the toggle
- Job 047 (separate build dir per tree, `fi-lab/ios-build-k-<tree>`; trees j / jM33 / jM66, each + patch-modetrace; iPhone 26.3, shim 30db5861, load 20-320). RESULT (diagnostic): jT 830/832 and 829/832; jM33T 824/832 (8 mode fails: to-input t=1133..1233, to-dial t=2000..2066); jM66T 815/832. So the suite DOES fail a one-frame late mode start. The 045 "mutation passes" (830/832) is explained by the shared build dir `ios-build-iphone` for trees j and jM in 045 (047 used one per tree and the mutation fails); rule: one FI_BUILD per tree.
- Trace (jT): to-input records 1134.3:p0, 1145.7:0.177, then NO frame until 1185.6:0.628 (40 ms); jTb 1149.6 -> 1189.3 (40 ms); to-dial 1996.7 -> 2038.7 and 2002.0 -> 2043.2 (41-42 ms). The remaining miss (to-input t=1166 at 1201, to-dial t=2033) is a native frame gap starting ~12-15 ms after the toggle, not the start time. Suspect: toggleMode's next-main-turn `input-hour.focus()` (UITextField becomeFirstResponder, the hop of KNOWN-CAUSES rows 23/25/28).
- Job 048 (queued, lane fi): trees jF (j + focus duration record `focushop`) and jD (same, focus deferred 0.5 s), iPhone x2, iPad x1 each; separate build dirs.

- Job 048 RESULT (diagnostic, iPhone 26.3, shim 30db5861, load 100-240): jF (focus timing only) 826 and 827/832, trace gap 1151->1193 with focushop 1169.4-1191.4 (22.0 ms) inside it, to-dial gap 2006->2051 with focushop 2021.9-2043.7 (21.8 ms); jFb focushop 27.6 / 26.9 ms in the gaps. jD (focus deferred 0.5 s) 830/832 (only the open-phase cold stall of row 35) with frames every 7-17 ms through to-input (1140, 1151, 1158, 1174, 1191) and to-dial, focushop now at 1650.9 / 2499.8 (17.6 / 19.0 ms, after the motion); jDb 822/832 (9 open-phase cold-stall fails, row 35, + to-dial t=2000 late first frame 2010 at load 184). MEASURED CAUSE of the remaining mode-toggle to-input/to-dial misses: the toggle's input-hour UIKit becomeFirstResponder (17-28 ms) inside the mode-in motion, plus ~15 ms of frameless time before it (the mode area remount) = a 40 ms frame gap. Product, not suite.
- Fix under test: `s62-lab/patch-focusaftermode.py` (iOS only; hour field shown focused on the next main turn via rt.focused/selecting, UIKit responder after modeSwap + 1 frame, Reduce Motion: next turn, skipped if focus moved). Same pattern as 6-6's installed select focus-after-open (KNOWN-CAUSES row 28). Risk to check: keys typed within 0.48 s of a toggle go to the previous responder.
- Job 049 (queued, lane fi): tree k (j + focusaftermode) and kM (+33 mutation) mode-toggle subsets, then k full tp states iPhone x2, iPad, iOS 18.6, macOS.

## Review Triage Log



---
Note from story 9-23 (2026-11-19, jobs 9-23-014..021, record: 9-23 Dev Agent Record): first key and first focus: the first press of a process on a text field blocks 370-425 ms in UIKeyboardTaskQueue wait plus becomeFirstResponder (jobs 019, 020), not keyboard creation and not product code; a UITextField warm-up does not remove it (014). Time picker first open (9-32) was sampled in job 021 without a located block: inconclusive. Helper to excuse bracketed time was rejected (v2 adds failures, job 009).
