---
title: 'macOS test harness: the test window loses key status during states runs (shared)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '6-5-macos-harness-key-window-loss'
epic: 6
model: 'opus'
wave: 2
lanes: 'mac lane d2b (second lane d4b for the two-suites-at-once runs) · no Android lane · no simulator'
lab: 'work/n2-lab (story 6-1 jobs 011 and 012: key-window patches v1 and v2, and tree work/n2-full; copy it, never edit it)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** During macOS states runs the test window loses key status: story 6-1 counted up to 40 losses in one run even on a quiet Mac (jobs `6-1-select-family-finish-011-keywindow` and `-012-keywindow-v2`). Pointer picks are then lost and select states fall from 1030/1030 to 1018-1029, multi-select from 872/872 to 867-871. Every component's macOS states suite uses the same harness, and several stories run macOS suites at the same time, so this can be the cause behind other findings recorded as flaky on macOS.

**Approach:** Find what takes key status (log the frontmost application and the key window at every loss, on a quiet Mac and with a second macOS suite running in another lane). Then make the shared harness independent of it: deliver input to the test window in a way that does not need key status, or prove before every step that the window is key and re-acquire it otherwise. A reproducer that takes key status away on purpose comes first.

## Boundaries & Constraints

**Always:** Work in your own copy of `work/n2-full` named `work/s65-tree`. The fix goes into the shared macOS test harness, not into a component. Add the cause and the fix to `work/claude-runner/KNOWN-CAUSES.md` row 9. The rules in project-context.md apply.

**Never:** No retries that hide a lost input: a step whose input was lost must be detected, not silently repeated. Do not change product behaviour. Do not edit `work/n2-full` or the n2 lab patches (story 6-1 owns them).

</intent-contract>

## Code Map

- Story 6-1 Dev Agent Record, sessions 2-4, and `claude-runner/done/6-1-select-family-finish-011-keywindow.log`, `-012-keywindow-v2.log`
- The shared macOS states harness under `packages/native-ios/Tests` (find the window and event-delivery helpers with grep for `makeKey`, `isKeyWindow`, `sendEvent`)
- `work/claude-runner/tools/slot.sh` -- how timing runs are limited today

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: select states five times with a logger of the frontmost application and the key window; record who takes key status and when, on a quiet Mac and with a second macOS states suite running in lane d4b
- [x] Reproducer: a helper that takes key status away during a run makes the select states suite fail every time on the unpatched harness
- [x] Fix the shared harness; the reproducer passes; select 1030/1030 and multi-select 872/872, three runs each
- [x] Regression: macOS states of six other components (button family, md-list, md-tabs, md-text-field, md-table, md-date-picker) with unchanged failing sets, and two suites at once in lanes d2b and d4b, three times, with no key-window loss
- [x] Install through the main queue (dry run, rollback, byte identity); update KNOWN-CAUSES.md; put a dated note in story 6-1's Handover

**Acceptance Criteria:**
- Given a states run on macOS, when another window or application takes key status, then no input is lost, or the loss is detected and reported by name
- Given two macOS states suites running at once in two lanes, when each finishes, then neither lost an input to the other
- Given the fix, when the select and multi-select states suites run three times, then all runs pass
- Given the six regression components, when their macOS states run on the patched harness, then no check fails that passed before

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-15 22:06 UTC)
- Accepted: the story stays `blocked` and no further session runs here. Story 6-1 owns the two multi-select `select-all flat pixels` checks; after its install it runs multi-select three times on canonical, adds the EVIDENCE lines here, ticks task 3 and sets this story to `review` (note in 6-1, same time).
- The md-list drag-reorder `state layer rendered` frame is recorded as C65-01 in DEFECTS.md and has its own story, `9-9-list-macos-drag-reorder-fade-tail`; the re-check 7-12 covers it.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Status blocked (2026-11-16): only the multi-select part of task 3 / AC3 (872/872 three times) is left, and it waits on story 6-1 (see below). Nothing is running or queued by this story.
- Done: cause, reproducer (`s65-lab/probe/thief.swift`), fix `Sources/AWCUI/AWCHarnessInput.swift` + select/multi suite edits INSTALLED on canonical by main-queue job `-013-install-harness-input-v2` (byte-identical 3/3, select 1030/1030, multi 871/872 with 0 lost input; checkpoints md-select/md-multi-select report stale none). KNOWN-CAUSES rows 9 and 20; 6-1 Handover "Note from story 6-5".
- AC1: 0 lost input in every patched run (select and multi, incl. thief runs with 13-64 key losses); a press that would be swallowed is reported as `[key-window] input lost ... during '<phase>'`.
- AC2: lanes d2b (011) + d4b (012) x3, 0 lost input in all six runs.
- AC3: select 1030/1030 in 11 patched runs. Multi: 872/872 in 012 runs 1-2; other runs fail 1-2 pre-existing `select-all flat pixels` checks (rtl worst 171 at (46,25), 35 px primary: probably the NSTextView caret; ltr tone drift at (25,89)) that also fail with the window key all run (005 multi-1) -> select-family paint, owned by 6-1.
- AC4: 004 vs 006 no new failure in 5 suites; md-list A/B (015, 016): baseline 7/7 clean, patched 3/6 clean with failures of a pre-existing class (fi-702, 2026-10-30) in a suite that runs no harness code.
- Next (after 6-1 fixes the two multi checks): re-run multi-select three times on canonical: a lane job that compiles `Tests/NativeMultiSelectStatesIntegration.swift` with swiftc against canonical AWCUI (recipe in `claude-runner/done/6-5-macos-harness-key-window-loss-013-install-harness-input-v2.sh` step 4), runs it from `work/awc-native/packages/native-ios` through `slot.sh timing 4`, x3; add EVIDENCE; tick task 3; set review.

### Session 1 (2026-11-15)
- Lab: `work/s65-lab/` (probe/, patches/, src/, out/NNN/). Tree: `work/s65-tree` (rsync of n2-full without build products; node_modules symlinked to n2-full), AWCUI built (job 001, 207 s).
- Job 001 probe (`s65-lab/probe/keyprobe.swift` + `thief.swift`, macOS 15.6.1, load 260): synthesized input posted through `NSApp.postEvent` while ANOTHER PROCESS is the active app:
  - plain NSHostingView: SwiftUI tap 0/5, SwiftUI Button 0/5, AppKit mouseDown 0/5 (every press swallowed); keys 5/5 (key events carry the window number and still reach the first responder).
  - host with `acceptsFirstMouse = true`: SwiftUI tap 5/5, Button 5/5; a plain AppKit view in the same window still 0/5.
  - overriding `NSWindow.isKeyWindow` (true) does not help (0/5); overriding `NSApplication.keyWindow/isActive` loses keys too (0/5) -> rejected.
  - in-process theft (second window made key, `NSApp.deactivate()` does not deactivate an accessory app): the first press on the non-key window is swallowed (tap 4/5), the press then makes the window key again.
  - SwiftUI `controlActiveState` is `inactive` whenever the process is not active, even with the isKeyWindow override (only NativeRipple reads it).
  - job 002 probe: during one probe the frontmost app was `NativeTimePickerStatesIntegration` (another lane's states suite): the states suites that call `NSApp.activate(ignoringOtherApps:)` at launch take activation from each other.
- Job 003 probe, window that cannot become key (plain borderless NSWindow, as the button-family / list / tabs / table states suites use): every press reaches SwiftUI AND plain AppKit views while another process is active (5/5 each); keys reach the first responder only through `window.sendEvent` (5/5; through NSApp 0/5), which is what those suites use. So the suites that never take key status are immune; the loss hits the suites with a key-capable window that activate themselves (select, multi-select, autocomplete, date-picker, number/otp/text-field, time-picker; the field and picker suites already accept first mouse).
- Task 1, job `6-5-macos-harness-key-window-loss-002-diag-select-x5` (unpatched select states + diag key logger `s65-lab/patches/diag-key-logger.py`, 5 runs, load 38-443): run1 954/1010 (one mid-run key loss at t=2605 in `select-pointer-rtl reopen`: `Claude` (regular app, the desktop app) activated, then `Google Chrome`; the window never became key again and every later pointer pick failed: 56 FAIL, all in pointer runs); runs 2,3,5 1030/1030 and run4 1029/1030 (`select-pointer-ltr click-open motion 2/56 frames` caret envelope at t=166, a timing failure, not key loss) with no mid-run loss (the only resign is at `window.close()`). Who takes key status: any app that activates while a suite runs: regular apps (the user's / Claude desktop, Chrome) and the other suites that call `NSApp.activate(ignoringOtherApps:)` (`NativeTimePickerStatesIntegration` was frontmost during one probe). One loss is enough: an activating suite never gets key status back by itself.
- Task 2, job `6-5-macos-harness-key-window-loss-003-reproducer`: reproducer = `s65-lab/probe/thief.swift` run as `thief 2400 1.5 <suite binary name>`: every 1.5 s, if the suite is the active app the thief activates itself (suite loses key/active status), if the thief is active it hands activation back; when any third app is active it does nothing (it never takes activation from other lanes or the user). Unpatched select + thief: 1006/1024 twice (identical 18 FAIL, all `select-pointer-* (reduced) pick-banana/reopen/outside` pointer picks lost; steals 23 and 37); patched select + thief: 1030/1030 twice (0 lost input; key losses 2 each: thief, `Google Chrome for Testing`, `Claude`); patched multi + thief: 871/872 (0 lost input; the one FAIL is `multi-pointer-ltr (reduced) select-all flat pixels (mean 1.158, >6: 0/32883, worst 4)`, which 6-1 job 012 run 1 and 011 run 1 also show with no key loss: a pre-existing paint drift, not key loss).
- Cause (mechanism): NSWindow.sendEvent hands a press on a window that is not key only to a hit view that accepts first mouse. md-select / md-multi-select suites host the fixture in a plain NSHostingView, so a press in a phase where another process holds activation is dropped (pointer pick lost, no trace). The 6-1 v1/v2 patches re-activated the app before each click/phase, which in turn takes activation from the other lanes' suites.
- Fix design: `Sources/AWCUI/AWCHarnessInput.swift` (DEBUG + AppKit only; product code never uses it): `AWCHarnessHost` (accepts first mouse; no re-activation), `AWCHarnessWindow` (sendEvent override: a press on a non-key window whose hit view does not accept first mouse is recorded as `[key-window] input lost: <event> at (x,y) on <view> during '<run phase>': window not key (app active, frontmost <app[pid]>)`), `AWCHarnessInput.watch(window)` (logs each key loss and which app activated) and `summary()`. Suites turn every record into a failed check named after the phase; nothing is retried. Suite patch: `s65-lab/patches/s65-harness-suites.py` (select + multi-select; anchors verified on n2-full and canonical copies).

### Session 2 (2026-11-15, from 16:10 UTC)
- Job 008 (install) rolled back cleanly (exit 7): the dry run and the install were byte-identical 3/3 and the canonical AWCUI build passed, but `test-native-views.sh` does not register the select suites ("Unknown native view fixture: NativeSelectStatesIntegration"), so the suite step found no result. Rollback restored the backup and rebuilt AWCUI (exit 0). Retry: main-queue job `-013-install-harness-input-v2` compiles the two suites with swiftc against canonical AWCUI (as jobs 005/006) and wraps the builds in `slot.sh build 2`.
- Job 009 produced no evidence: the 005 binaries load fixtures relative to the working directory and the job ran from canonical (`Tests/Fixtures/select-web-states.json` not found, both runs crashed at start). Replaced by the lane pair `-011-lanes-overlap-select` (d2b) + `-012-lanes-overlap-multi` (d4b): job 006 binaries run from `s65-canon/packages/native-ios`, two barrier files (before and inside the timing slot) make both lanes start together, x3.

- Job 013 (main queue) installed the fix on canonical, exit 0: pre-image ok, dry run 3/3 and install 3/3 byte-identical with s65-canon, canonical AWCUI build 0, select 1030/1030, multi 871/872 (0 lost input), playground build 0, checkpoint report md-select/md-multi-select: stale none (the checkpoints do not pin the test files, so no refresh/confirm was needed). Re-checked from the VM: the three canonical files equal s65-canon.
- Multi-select failures re-classified (all multi logs of jobs 003-013 compared, key-loss summary vs failure): `rtl select-all flat pixels worst 171 at (46,25)` occurs with the window key all run (005 multi-1: the only resign is the final tab-away) and `ltr select-all worst 4-7 at (25,89)` in the canonical baseline 004 -> neither is key loss; select-family paint/test issues routed to 6-1 (Handover note "Note from story 6-5"). AC3's multi part (872/872 x3) waits on them.
- KNOWN-CAUSES row 9 updated (installed by 013; cwd-relative fixtures; the two multi failures are not key loss). 6-1 Handover note written (drop the g5 key-window patches; rebase n2-full on the canonical suite files).

- Jobs 011 (d2b) + 012 (d4b), two lanes at once, x3 (exit 0 both): lost input 0 in all six runs. Overlap: run2 and run3 overlapped each other (start/end times in the logs); in run1 the d4b multi waited for a slot until the select had ended (barrier B timed out under slot starvation), but that select run overlapped the main-queue 013 multi-select run (it logged `activated by NativeMultiSelectStatesIntegration`). Other lanes' suites also took activation during these runs (NativeTextFieldStatesIntegration) with 0 lost input. Select 1030/1030 x3; multi 872, 872, 871 (the rtl caret-spot failure again, in a run whose window was never key: it fails both with and without key status).
- Slot starvation: a timing slot took 15-20 min to get at load 60-120 this evening. A job that holds a slot while waiting for a partner (009 design) can block others; 011/012 wait for the partner lane before taking a slot (barrier A) and only 20 min inside it.

- md-list: baseline 4/4 clean (004, 015 x3) vs patched 1/3 clean (006, 014 x2: one drag-reorder `state layer rendered` frame each). The two builds' sources differ only in AWCHarnessInput.swift (no global effect: no swizzling, observers only from `watch(window)`, which the list suite never calls) and the two select test files; binary size +40 KB from the linked harness objects. A/B alternating job `-016-list-ab-x3` (lane d4b) settles whether this is load timing or a real difference.

- Job 016 (A/B alternating, x3 each, exit 0): patched runs 2 and 3 clean, run1 72 FAILs at load 440 (many kinds: expand panel, custom-reorder, drag; overload), baseline 3/3 clean. Totals over the session: patched md-list clean in 3 of 6 runs (two single drag-reorder `state layer rendered` frames at 0.004/0.007 where Chrome is 0, one overloaded run), baseline 7/7 clean. Judgement for AC4: the list suite executes no harness code (AWCHarnessInput has no global effect and is only active through `watch(window)`, which only the select suites call), the builds differ only in that unreferenced file, and the same check class failed on 2026-10-30 before this story (`fi-702-cp-cpo2-reruns`: reduced drag-reorder r0 state layer rendered). So no failure attributable to the harness; the list drag-reorder state-layer fade-tail frame is a pre-existing intermittent list timing finding (open item for the list owner, not recorded in DEFECTS.md by this story).
- KNOWN-CAUSES: row 9 updated; row 20 appended (cwd-relative fixtures; holding a timing slot while waiting for a partner).

### Evidence
- EVIDENCE | 6-1-select-family-finish-030-macos-states-x3 | macOS | NativeMultiSelectStatesIntegration canonical run1 (lostInput=0) | 872/872
- EVIDENCE | 6-1-select-family-finish-030-macos-states-x3 | macOS | NativeMultiSelectStatesIntegration canonical run2 (lostInput=0) | 872/872
- EVIDENCE | 6-1-select-family-finish-030-macos-states-x3 | macOS | NativeMultiSelectStatesIntegration canonical run3 (lostInput=0) | 872/872
- EVIDENCE | 6-5-macos-harness-key-window-loss-002-diag-select-x5 | macOS | select states unpatched + diag logger run1 | 954/1010 explained: one mid-run key loss (Claude app, then Chrome activated); every later pointer pick lost (task 1 finding)
- EVIDENCE | 6-5-macos-harness-key-window-loss-002-diag-select-x5 | macOS | select states unpatched + diag logger run2 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-002-diag-select-x5 | macOS | select states unpatched + diag logger run3 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-002-diag-select-x5 | macOS | select states unpatched + diag logger run4 | 1029/1030 explained: caret motion envelope frame at t=166 (timing, no key loss)
- EVIDENCE | 6-5-macos-harness-key-window-loss-002-diag-select-x5 | macOS | select states unpatched + diag logger run5 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-003-reproducer | macOS | reproducer: select states UNPATCHED + thief run1 | 1006/1024 explained: expected failure, 18 pointer picks lost to the thief
- EVIDENCE | 6-5-macos-harness-key-window-loss-003-reproducer | macOS | reproducer: select states UNPATCHED + thief run2 | 1006/1024 explained: expected failure, the same 18 pointer picks lost
- EVIDENCE | 6-5-macos-harness-key-window-loss-003-reproducer | macOS | reproducer: select states PATCHED + thief run1 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-003-reproducer | macOS | reproducer: select states PATCHED + thief run2 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-003-reproducer | macOS | reproducer: multi-select states PATCHED + thief | 871/872 explained: 0 lost input; the FAIL is the pre-existing `multi-pointer-ltr (reduced) select-all flat pixels` drift (also in 6-1 jobs 011/012 runs without key loss)
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | button family states (canonical, before) | 27144/27144
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-list states (canonical, before) | 135327/135327
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-tabs states (canonical, before) | 137124/137124
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-text-field states (canonical, before) | 2028/2028
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-table states (canonical, before) | 3830/3859 explained: pre-existing baseline failures (tb-sort-rtl Enter sorts fat: focus none), the before set for the regression comparison
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-date-picker states (canonical, before) | 10417/10417
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-select states (canonical, before) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-004-regress-baseline | macOS | md-multi-select states (canonical, before) | 871/872 explained: pre-existing `select-all flat pixels` drift (see job 003 note), the before set
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | select states PATCHED pair1 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | select states PATCHED pair2 (overlapped with multi-select; 20 presses delivered while not key) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | select states PATCHED pair3 | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | select states PATCHED + thief (64 key losses, 12 presses while not key, 0 lost) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | multi-select states PATCHED pair1 | 871/872 explained: 0 lost input, window key all run; FAIL = pre-existing select-all flat pixels (also canonical baseline 004)
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | multi-select states PATCHED pair2 (overlapped with select) | 869/872 explained: 0 lost input (24 presses while not key; activated by SelectPatched, OTP suite, Chrome, Claude); FAILs = select-all flat pixels x2 (pre-existing) + caret envelope t=66 (timing)
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | multi-select states PATCHED pair3 | 870/872 explained: 0 lost input (24 presses while not key; OTP suite x4, Claude x4); FAILs = select-all flat pixels x2 (pre-existing)
- EVIDENCE | 6-5-macos-harness-key-window-loss-005-fix-pairs-x3 | macOS | multi-select states PATCHED + thief (13 key losses, 18 presses while not key, 0 lost) | 871/872 explained: FAIL = pre-existing select-all flat pixels
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | button family states (canonical + fix) | 28148/28148
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-list states (canonical + fix) | 131180/131181 explained: one new frame-timing FAIL `reduced/drag-reorder-standard-none-light-ltr r2 state layer rendered [0.004] at web 2266`; list source unchanged and does not use the harness; re-run in job 010
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-tabs states (canonical + fix) | 137124/137124
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-text-field states (canonical + fix) | 2028/2028
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-table states (canonical + fix) | 3830/3859 explained: the same 29 failures as the 004 baseline (masked comparison: 0 new, 0 gone)
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-date-picker states (canonical + fix) | 10417/10417
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-select states (canonical + fix) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-006-regress-patched | macOS | md-multi-select states (canonical + fix) | 870/872 explained: 0 lost input; both FAILs are the pre-existing multi `select-all flat pixels` drift (ltr reduced in the 004 baseline, rtl reduced here), not key loss
- EVIDENCE | 6-5-macos-harness-key-window-loss-013-install-harness-input-v2 | macOS | canonical install: dry run + installed files byte-identical with s65-canon | 3/3
- EVIDENCE | 6-5-macos-harness-key-window-loss-013-install-harness-input-v2 | macOS | md-select states (canonical after install; 13 presses while not key, 0 lost) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-013-install-harness-input-v2 | macOS | md-multi-select states (canonical after install; 18 presses while not key, 0 lost) | 871/872 explained: 0 lost input; FAIL = pre-existing `multi-pointer-rtl (reduced) select-all flat pixels` worst 171 at (46,25), which also fails in runs whose window stayed key (005 multi-1, 006): select-family paint, routed to 6-1
- EVIDENCE | 6-5-macos-harness-key-window-loss-011-lanes-overlap-select | macOS | md-select states lane d2b run1 (overlapped the main-queue 013 multi-select run; 8 presses while not key, 0 lost) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-011-lanes-overlap-select | macOS | md-select states lane d2b run2 (overlapped d4b multi run2 19:54-19:59; 24 presses while not key, 0 lost) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-011-lanes-overlap-select | macOS | md-select states lane d2b run3 (overlapped d4b multi run3 20:11-20:15; 0 lost) | 1030/1030
- EVIDENCE | 6-5-macos-harness-key-window-loss-012-lanes-overlap-multi | macOS | md-multi-select states lane d4b run1 (ran after select run1; window key all run) | 872/872
- EVIDENCE | 6-5-macos-harness-key-window-loss-012-lanes-overlap-multi | macOS | md-multi-select states lane d4b run2 (overlapped d2b select run2; 0 lost) | 872/872
- EVIDENCE | 6-5-macos-harness-key-window-loss-012-lanes-overlap-multi | macOS | md-multi-select states lane d4b run3 (overlapped d2b select run3, which activated at start; 24 presses while not key, 0 lost) | 871/872 explained: 0 lost input; FAIL = pre-existing `multi-pointer-rtl (reduced) select-all flat pixels` worst 171 at (46,25) (select-family paint, routed to 6-1)
- EVIDENCE | 6-5-macos-harness-key-window-loss-014-list-rerun-v2 | macOS | md-list states (canonical + fix, job 006 binary) rerun1 | 137544/137544
- EVIDENCE | 6-5-macos-harness-key-window-loss-014-list-rerun-v2 | macOS | md-list states (canonical + fix, job 006 binary) rerun2 | 136010/136011 explained: one frame `drag-reorder-standard-none-dark-rtl r2 state layer rendered [0.007] at web 2281` (same class as 006; the list suite does not use the harness; the same check class also failed in fi-702-cp-cpo2-reruns on 2026-10-30, before this story); baseline x3 in job 015
- EVIDENCE | 6-5-macos-harness-key-window-loss-015-list-baseline-x3 | macOS | md-list states UNPATCHED baseline binary (004) run1 | 132671/132671
- EVIDENCE | 6-5-macos-harness-key-window-loss-015-list-baseline-x3 | macOS | md-list states UNPATCHED baseline binary (004) run2 | 133476/133476
- EVIDENCE | 6-5-macos-harness-key-window-loss-015-list-baseline-x3 | macOS | md-list states UNPATCHED baseline binary (004) run3 | 135744/135744
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B patched run1 (load 440) | 98962/99034 explained: 72 timing FAILs across expand/custom-reorder/drag frames at load average 440 (machine-wide overload); the next patched runs at load 70-150 were clean
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B baseline run1 | 134374/134374
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B patched run2 | 133540/133540
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B baseline run2 | 131916/131916
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B patched run3 | 134009/134009
- EVIDENCE | 6-5-macos-harness-key-window-loss-016-list-ab-x3 | macOS | md-list states A/B baseline run3 | 134181/134181

## Review Triage Log
