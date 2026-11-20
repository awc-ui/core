---
title: 'iPadOS: keyboard focus entry and wrap when nothing is focused (shared focus bridge)'
type: 'bugfix'
created: '2026-11-14'
status: 'review'
story_key: '1-4-ipad-focus-entry-shared'
epic: 1
model: 'opus'
wave: 2
lanes: 'mac lane di · no Android lane · simulator AWC-di-ipad (create it as a clone of iPad Pro 11-inch (M5), iOS 26.3, the way AWC-n1-ipad was made)'
lab: 'work/n1-lab (st-out/*.orig-1-1; story 1-1 Dev Agent Record, Session 3) and tree work/n1-tl (copy it, never edit it)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** On iPad, when no AWC view is first responder, the UIKit focus system picks the entry view itself: Shift+Tab from the page's first control re-enters at that control's neighbour instead of wrapping to the last stop, and Tab after a tap on empty space enters near the tap or at the remembered row (in RTL at the target search) instead of the first stop in loop order. md-transfer-list fails 25 of 136 states checks and 6 of 2388 paint checks on iPad because of it (jobs 1-1-...-019, 021, 024). The cause is in shared code: `AWCNativeButtonFocusView` in `NativeFocusBridge.swift`, with the same pattern in `AccordionScrollBridge.swift`.

**Approach:** Reproduce on an own iPad clone with a copy of the transfer-list tree, find which UIKit mechanism chooses the entry view, and make the shared bridge choose the stop Chrome's oracle shows. Two options story 1-1 recorded but did not try: learn the Tab direction from the hardware key and redirect the nil-entry; or a priority `UIKeyCommand` on the host so Tab and Shift+Tab with no responder never reach the focus engine. Then prove no regression for the other users of the bridge and hand the patch to story 1-1.

## Boundaries & Constraints

**Always:** Work in your own copy of `work/n1-tl` named `work/s14-tree`. The failing iPad cases of the md-transfer-list states and paint suites are the tests; they fail first. Record each attempt and its measured result in this file. The rules in project-context.md apply.

**Never:** Do not edit `work/n1-tl`, lane n1 or the simulator AWC-n1-ipad (story 1-1 owns them). Do not repeat the three approaches story 1-1 ruled out (a `shouldUpdateFocus` veto: never called; a `didUpdateFocus` redirect: no effect; bridges focusable only on explicit requests: worse, 95/136). Do not loop: after 8 iPad job iterations without a full pass, restore the product files, set `blocked`, and write a complete exception record proposal (AUDIT.md Exception policy) with the measurements for a gate-7 reviewer.

</intent-contract>

## Code Map

- `NativeFocusBridge.swift` (`AWCNativeButtonFocusView`) and `AccordionScrollBridge.swift` under `packages/native-ios` -- the shared focus bridge
- `Tests/NativeTransferListStatesIntegration.swift` in `work/n1-tl` -- the fixture; story 1-1 moved its page buttons on screen for iPad
- Story 1-1's Dev Agent Record, Session 3, and `claude-runner/done/1-1-md-transfer-list-finish-and-install-0{14,19,21,24,26}-*.log` -- cause analysis and evidence
- `docs/native-parity/ios-harness.md` -- iPad harness rules (delivered-input timing, item 31)

## Tasks & Acceptance

**Execution:**
- [x] Read story 1-1 Session 3 and the logs of jobs 019, 021, 024, 026; copy `work/n1-tl` to `work/s14-tree`; create the iPad clone; reproduce states 111/136 and paint 2382/2388
- [x] Trace which UIKit mechanism chooses the entry view when no AWC view is first responder, and record the trace here
- [x] Implement the entry and wrap rule in the shared bridge: Tab enters at the first stop in loop order, Shift+Tab at the last, and after a tap on empty space the stop the oracle shows, in LTR and RTL
- [x] md-transfer-list on iPad: states 136/136 three times and paint 2388/2388; iPhone 26.3 and macOS unchanged (138/138 and 2388/2388)
- [x] Regression on iPad for the other users of the bridge: list them with grep and run their states suites on the iPad clone (at least the button family, md-list, md-tabs, md-toolbar, md-accordion); counts equal their last recorded iPad runs
- [x] Hand over: an anchored patch script with pre-image checks at `work/n1-lab/patches/s14-ipad-focus.py` and a dated note with the evidence in story 1-1's Handover section. If md-transfer-list is already installed in canonical by then, install the fix through the main queue instead (dry run, rollback, byte identity)

**Acceptance Criteria:**
- Given no AWC view is first responder on iPad, when Tab or Shift+Tab is pressed on a hardware keyboard, then focus enters at the stop Chrome's oracle shows, in LTR and RTL
- Given a tap on empty space, when Tab is pressed, then the focused stop matches the oracle
- Given the fix, when the iPad states suites of the other bridge users run, then their counts are unchanged
- Given 8 iterations pass without a full pass, when the agent stops, then no product file is left changed and the story holds a complete exception record proposal with measurements

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.
- Story 1-1 runs in parallel on lane n1 and tree `work/n1-tl`: it refreshes that tree from canonical and prepares docs and the install, and waits for your patch. Copy the tree once at the start; if 1-1's refresh changes shared files you patch, re-check your pre-images before handing over.

### Coordinator note (2026-11-15 09:30 UTC)

- The previous agent was stopped at about 22:10 UTC on 11-14 while its jobs were running. They have all finished since; nothing is running or queued now. A fresh agent continues: read the Dev Agent Record and the newest `claude-runner/done/<story>-*.log` files first, and do not redo what the record holds.
- Story 1-1 starts right after this story reaches `review` and installs md-transfer-list with your patch. Make your note in story 1-1's Handover complete: patch path, how to apply it, the iPad evidence, and the regression counts.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Session 1 (2026-11-14, s14 agent; Mac lane di, simulator AWC-di-ipad 71FF7626-8056-494F-ACE4-340BD812F6D1)
Setup: work/s14-tree = rsync of work/n1-tl (no build products) made by job 001; helpers in work/s14-lab (ios.sh = run one fixture on AWC-di-ipad with stage /tmp/awc-ios/s14-stage; out/<job>/ logs; orig/ = pre-patch copies).
- Job `1-4-ipad-focus-entry-shared-001-setup-baseline` (failing tests first, unpatched tree): iPad states 111/136 (fails: tl-keyboard/17 x13, /18../27 x1 each, events mdChange/mdMove missing), paint 2382/2388 (tl-ltr-focus-row-checked, tl-ltr-focus-mover, tl-rtl-focus-search, tl-rtl-focus-row, tl-rtl-focus-row-checked, tl-rtl-focus-mover). Reproduces 1-1's jobs 019/021/024.
Trace (from 1-1 job 025's KEYDBG/DUF log, not re-run): with no first responder, Tab and Shift+Tab never reach AWC code; the iPad focus engine handles the key and performs an initial-focus update (didUpdateFocus prev=nil, heading 0, not our request) to its own preferred item: the top-leading focusable (`before`) for both directions, or the item it last focused (the pressed row; in RTL the target search). The SwiftUI keyboard shortcuts of `AWCKeyViewEntryShortcuts` (NativeKeyViewLoop.swift), which give iPhone its nil-entry, are ordinary key commands and lose to the focus engine's Tab handling. AWC views themselves are unaffected because their Tab key commands set `wantsPriorityOverSystemBehavior`.
- Attempt 1 (option b), jobs `-002-entry-commands` and `-003-entry-debug`: priority UIKeyCommands (Tab, Shift+Tab, wantsPriorityOverSystemBehavior) added with addKeyCommand to every view controller above the entry anchor (the UIHostingController and the root controller; job 003 confirms they were installed). Result: iPad states 111/136, paint 2382/2388, unchanged: with no first responder UIKit never consults any responder's key commands; the press goes straight to the focus engine. Also measured in 003: UIFocusSystem.didUpdateNotification for the wake has prev=nil, heading 0; GCKeyboard is connected but reports neither Tab nor Shift pressed at that moment (HID-synthesized keys do not reach GameController in the simulator), so option (a) cannot learn the direction from GameController.
- Diagnosis job `-004-anchor-debug` (debug build): (A) the release of the key the engine took is delivered to the item the engine focused, as its first responder, with the key and its modifiers (`pressesEnded` on `before`: "\t", shift=true, first responder) - the direction is knowable there; releases of keys an AWC view handled go to the view that got the press (no longer first responder). (B) the entry anchor cannot take engine focus (0x0 frame, engine refuses), so a focusable "document" anchor is not an option. States 111/136 in both (debug only).
- Attempt 2 (option a, direction from the release): `AWCKeyViewEngineEntry` in NativeKeyViewLoop.swift observes `UIFocusSystem.didUpdateNotification` (iPad only, installed by the entry anchor) and records an AWC key view the engine focused from nothing without an AWC request; that view's `pressesEnded` for Tab redirects to `AWCKeyViewLoop.select(from: nil, backward: shift)`. Hooks: AWCNativeButtonFocusView.pressesEnded (+ `requesting` around its own focus request, cleared on any key command), AWCFieldUITextField.pressesEnded. Patch: work/s14-lab/s14-ipad-focus.py (anchored, pre-image checked); pre-patch copies in work/s14-lab/orig/. Attempt 1 script kept as work/s14-lab/attempt1-vc-keycommands.py (not applied).
- Job `-005-release-entry` (attempt 2): iPad paint **2388/2388** (all six focus cases fixed); iPad states 112/138 (the events now appear, so the total is 138): tl-keyboard/17 ends one stop short (move-all-right instead of source row c) and /18-/27 follow from it. Job `-006-release-trace` (KEYDBG): the wake's release arrives after the harness has already read the focus (the shim reads it 20 ms after the press; the release, and so the redirect, lands later), so the fixture's wrap loop sees `before`, stops wrapping, and the run is one Shift+Tab short. On hardware the release follows the key by the hold time: the wrong item would show focus for that long. Next: look for the press at key-down (job 007: a window-level press-observing gesture recognizer, debug).
- Job `-007-press-spy` (debug): a press-observing gesture recognizer on the window sees no key press at all, so there is no key-down hook either (no responder, no recognizer, no GameController). The release fallback is therefore late by the key's hold time.
- Iteration count (strict: every iPad job after the baseline counts): 002, 003, 004, 005, 006, 007 = 6 of 8.
- Attempt 3 (job `-008-document-responder`, iteration 7): keep a first responder while nothing has focus, so a priority key command sees Tab before the engine. The entry anchor (`AWCKeyViewAnchorView`, 0x0, never engine-focusable) becomes first responder on iPad whenever no responder and no engine-focused item remain (after an AWC view leaves the loop, a blur, on attach); its priority Tab / Shift+Tab commands enter the loop at the first / last stop (`AWCKeyViewLoop.enter`). It stands for no focus: `AWCKeyViewEngineEntry.isDocumentResponder` (enter() and the parity harness's `firstResponder` treat it as none), it yields to any responder and resigns when the engine focuses a non-AWC item. The release redirect stays as fallback. Edits: NativeKeyViewLoop.swift, NativeFocusBridge.swift, FieldTextInput.swift, harness apps/native-ios-parity/Shim/AppKitShim.swift (one line). Script work/s14-lab/s14-ipad-focus.py (attempt 2 alone kept as attempt2-release-only.py).
- Job `-008-document-responder` (iteration 7): iPad states 112/138 (same as attempt 2), paint 2388/2388.
- Attempt 4, job `-009-park` (iteration 8): attempt 3 plus, past either end of the loop on iPad, the AWC focus bridge "parks" (keeps UIKit first responder and engine focus, blurred, priority Tab enters the loop; the harness treats a parked bridge as no focus). **iPad states 138/138, paint 2388/2388: first full pass.** Debug lines: states parked twice (after, before) and the anchor reclaimed 5 times; paint: anchor reclaimed 14 times and its priority Tab command entered the loop 4 times. So the anchor's priority commands do work once it is first responder; attempt 3 lost only because its reclaim waits for the engine's (deferred) focus-update notification after the resign, and the harness presses the next Shift+Tab before that. Park version saved in work/s14-lab/attempt4-park/ (script s14-park.py on top of s14-ipad-focus.py).
- Attempt 5 (job `-010-claim`): same result sought with less bridge state: at the loop's ends `AWCKeyViewLoop.select` makes the stand-in first responder synchronously (`AWCKeyViewEngineEntry.claim`) instead of parking; no parking code. Applies to every AWC key view class at a loop end, not only the button bridge.
- Job `-010-claim` (attempt 5): **iPad states 138/138, paint 2388/2388** with no parking. Chosen fix. (The states total is 138, not 136: the 136 of the failing runs lacked the two event checks, which only count once the run reaches the moves.)
- Final fix (work/s14-tree; script work/s14-lab/s14-ipad-focus.py, anchored edits with pre-image checks; pre-images verified OK on work/n1-tl and on canonical, 2026-11-14 ~21:50 Mac):
  - NativeKeyViewLoop.swift (UIKit part only): `AWCKeyViewEngineEntry` + the entry anchor `AWCKeyViewAnchorView` becomes the iPad "document stand-in" first responder (0x0, never engine-focusable, priority Tab / Shift+Tab -> `AWCKeyViewLoop.enter`); `select` past either end claims it synchronously; a `UIFocusSystem.didUpdateNotification` observer re-claims it (next run-loop turn) whenever no responder and no engine focus remain, and resigns it when the engine focuses a non-AWC item (host focus navigation keeps its keys); `enter()` treats it as no responder; release fallback (`released`) for an engine entry that still happens (e.g. before the first claim).
  - NativeFocusBridge.swift (UIKit `AWCNativeButtonFocusView`): `pressesEnded` fallback hook, `requesting` flag around its own focus request, `entered` cleared on any key command.
  - FieldTextInput.swift (`AWCFieldUITextField.pressesEnded`): fallback hook.
  - Harness apps/native-ios-parity/Shim/AppKitShim.swift: `NSWindow.firstResponder` reports the stand-in as no focus (`AWCKeyViewEngineEntry.isDocumentResponder`).
  - macOS compiled code is unchanged (all product edits are inside the UIKit branches); iPhone: no focus system, so no anchor claim (the SwiftUI shortcuts keep the nil entry there).
- Job `-011-verify-matrix` (s14-tree, attempt 5): iPad (AWC-di-ipad) transfer-list states 138/138 three times, paint 2388/2388; iPhone 17 Pro iOS 26.3 (AWC-s14-iphone 597FD43D-144A-478F-9CA4-E5042AD147F9, created by this job) states 138/138, paint 2388/2388; macOS (test-native-views.sh) states 138/138, paint 2388/2388. (Its macOS build ran without `-j 4`: the job was picked up before I could add the flag.)

### Session 2 (2026-11-15, s14 agent, no new jobs needed)
- Bridge users (grep in s14-tree AWCUI for AWCNativeButtonFocusView / AWCKeyViewLoop / AccordionScrollBridge): AWCKeyViewGroup, Actions, ColorPickerBridges, FieldTextInput, MenuController, NativeAccordion, NativeActionControl, NativeBreadcrumbs, NativeCard, NativeCheckbox, NativeChip, NativeDatePicker, NativeDialog, NativeDocumentOrder, NativeList(+ItemView), NativeLoadingIndicator, NativeMenu, NativeNavigationBar, NativeNavigationRail, NativeOrgChart, NativeRadio, NativeRipple, NativeSwitch, NativeTable*, NativeTabs, NativeToolbar, NativeTouchPress, NativeTransferList, Snackbar, ChartPlotFocusBridge, SliderRating, NativeStepper.
- Regression, iPad AWC-di-ipad, 18 states suites, same set on both trees (work/s14-lab/regress.sh): job `1-4-ipad-focus-entry-shared-012-regress-base` (work/s14-base = s14-tree with the pre-patch files, grep confirms 0 patch markers) vs `-013-regress-fix` (work/s14-tree). Logs: work/s14-lab/out/012, 013. Fails base -> fix: Button 1 -> 1 (same check: "iOS snapshot frame equals a direct capture (pointer-filled-sm-light-ltr rest)"), Table 3 -> 3 (same checks: tb-pagination-ltr/-rtl/reduced-rm [3] click-prev focus last-button vs prev-button = the known R5 pagination click-prev finding in DEFECTS.md line ~265, pre-existing), Radio 2 -> 0, all others 0 -> 0: ButtonFamily 28128/28128 -> 28207/28207, List 76351/76351 (gaps 10) -> 76584/76584 (gaps 9), Tabs 132004 -> 132004, Toolbar 2396 -> 2396, Accordion 55862 -> 55870, Card 189337 -> 190407, Chip 157247 -> 156915, Breadcrumbs 76465 -> 76465, NavigationBar 189386 -> 189386, NavigationRail 541460 -> 541432, Menu 2524 -> 2524, Checkbox 17762 -> 17774, Switch 16617 -> 16563, TextField 2025 -> 2025, NumberField 1392 -> 1392 (all full passes).
- Check totals vary run to run with the number of motion samples (e.g. earlier iPad Card states runs in done/ logs: 186209 .. 194113 checks), so "counts unchanged" is read as: same failing checks, no new failure. Met.
- Finding (not caused by the fix, base tree only): Radio iPad states, job 012, 2 fails "pointer-light-ltr-off container scale rendered 0.9756 at web 626 within Chrome [0.8449,0.9656]" and "0.9208 at web 643 within [0.8361,0.9160]" (press-scale sampled slightly ahead of Chrome); gone in 013. Timing finding for the radio owner / di, cause unknown; not filed by me (DEFECTS.md changes only through install jobs).
- Not in the regression set (no iPad states run here): date-picker, dialog, org-chart, color-picker, charts, slider/rating, stepper, snackbar, loading-indicator. Story 1-1's iPad/iPhone/macOS runs after applying the patch will cover transfer-list; the others are open for the gate-7 reviewers.
- Handover re-check 2026-11-15 ~09:30 UTC: `s14-ipad-focus.py --check` pre-images OK on work/n1-tl and on canonical; s14-tree matches work/s14-lab/fixed-sha256.txt (4/4 OK); work/n1-lab/patches/s14-ipad-focus.py is byte-identical to work/s14-lab/s14-ipad-focus.py. md-transfer-list is not installed in canonical (1-1 blocked waiting for this story), so the hand-over is the patch, not a main-queue install. Regression counts added to story 1-1's Handover.
- Iteration count: 10 iPad fix jobs (002-011) plus 2 regression jobs; the full pass came at iteration 8 (009) and the chosen fix at 010 (counted past 8 only as verification, per the full pass at 009).

## Review Triage Log

