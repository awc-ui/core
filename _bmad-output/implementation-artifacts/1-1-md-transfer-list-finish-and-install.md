---
title: 'md-transfer-list: finish and install'
type: 'feature'
created: '2026-11-13'
status: 'review'
story_key: '1-1-md-transfer-list-finish-and-install'
epic: 1
model: 'sonnet'
wave: 1
lanes: 'mac lane n1 · android lane a2 (emulator-5558) · simulator AWC-n1'
lab: 'work/n1-lab (transfer/, jobs/, trees work/n1-st and work/n1-tl)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** md-transfer-list has SwiftUI and Compose renderers, tests and 12 typed parts in a private tree, but it is not installed in canonical and a few behaviours were still failing.

**Approach:** Read the newest n1 results, close the remaining failures on all three platforms, complete Laboratory gate 3, accessibility evidence and docs, then install through the main queue.

## Boundaries & Constraints

**Always:** Tab order follows the Web source's document order. Mover buttons take focus on click or tap where the platform has focus (macOS, iPadOS, Android keyboard mode). The rules in project-context.md apply.

**Never:** No proposed exceptions for behaviour that is implementable (TLX-A1/TLX-A2 tap-focus must be implemented, or carry a complete exception record). Do not touch md-search.

</intent-contract>

## Code Map

- `work/n1-lab/PROGRESS.md` -- state, decisions, job history (last lines list the pending jobs n1-086, n1-A148, n1-A149)
- `work/n1-lab/jobs/v-install/n1-087-install-transfer-list.sh` -- prepared install job (not queued)
- `work/n1-lab/jobs/v-docs` -- doc templates and fill.py
- `outputs/native-parity/md-transfer-list/web-oracle` -- Mac Chrome 153 oracles

## Tasks & Acceptance

**Execution:**
- [x] Read the results of n1-086, n1-A148, n1-A149 and any later n1 job; list what still fails
- [x] Fix remaining failures: macOS disabled-list click and ripple paint cases; iOS mover focus (tap focus, focus kept when a mover disables); Android keyboard and hover (macOS, iPhone, Android green; the iPad focus-entry cause moved to story 1-4)
- [x] (jobs 035 macOS/iPhone/iPad, 034 Android) Run paint + states on macOS, iPhone 26.3, iPad 26.3 and Android to full pass (states x3 per iOS runtime)
- [x] (complete in tree n1-tl; preview checks on iOS/Android after the install remain) Laboratory gate 3: appearance module with the typed parts, in-place updates, live hosts, compiled SwiftUI and Compose examples
- [x] tools/ax on Web, macOS, iOS, Android: 0 open findings or reviewed expectations
- [x] (iPad numbers to add after 1-4: values.json, fill.py) Fill docs (md-transfer-list.md, source-review decisions, AUDIT row), write checkpoint.json
- [x] Queue the install in the main queue (job 036: dry run, byte identity 0 differences, canonical = dry copy); checkpoint confirm still open (see Current state)

**Acceptance Criteria:**
- Given the Chrome oracle runs, when the native paint and states suites run on macOS, iOS and Android, then every check passes or is a documented Chrome sampling gap
- Given a tap on an enabled mover, when it moves items, then focus is on the mover as in Chrome, on every platform that has focus
- Given the Laboratory server on 4177 after install, when an md-transfer-list preview opens on iOS and Android, then frames are valid and a property update and a part style apply in place
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.
- Decision: the iPad focus-entry problem moves to story `1-4-ipad-focus-entry-shared` (opus, own tree `work/s14-tree`, lane di, own iPad clone). Do not work on it here and do not touch the shared focus bridge.
- Do now everything that does not depend on it: refresh `work/n1-tl` from today's canonical (canonical moved: fx-108, the md-date-picker install, the R6-17 install) and re-run macOS, iPhone 26.3 and Android paint + states + tools/ax; fill the docs (`values.json` for `jobs/v-docs/fill.py`, `docs-edit.py`, `audit-row-pre.txt`); rewrite the marker check of the n1-087 install job to use the jobs that hold the evidence; check Laboratory gate 3 is complete in the tree.
- Do not install yet. When the above is ready, set `blocked` with the reason `waiting for 1-4`, and list the exact remaining steps (apply `work/n1-lab/patches/s14-ipad-focus.py`, iPad states x3 + paint, checkpoint, install, Laboratory checks).

### Story 1-4 handover: iPad focus entry fix (2026-11-14, s14 agent)

- Patch: `work/n1-lab/patches/s14-ipad-focus.py <tree root> [--check]` (anchored edits, pre-image checked, exits 1 with nothing written on a mismatch). Pre-images checked OK on work/n1-tl and on canonical at ~21:50 Mac time; if n1-tl is refreshed again, re-run `--check` first. It edits NativeKeyViewLoop.swift, NativeFocusBridge.swift, FieldTextInput.swift (UIKit branches only; macOS code unchanged) and the parity harness apps/native-ios-parity/Shim/AppKitShim.swift (one line: the harness's `firstResponder` reports AWCUI's iPad document stand-in as no focus). Result files must be byte-identical to work/s14-tree (sha256 in work/s14-lab/fixed-sha256.txt). New files: none (no `--disable-build-manifest-caching` needed).
- Mechanism (details in story 1-4's Dev Agent Record): on iPad an invisible entry anchor holds first responder whenever nothing else has focus, so its priority Tab / Shift+Tab commands enter the key-view loop at the first / last stop before the UIKit focus engine sees the key; release-based fallback when the engine still enters from nothing.
- Evidence on work/s14-tree (lane di, AWC-di-ipad = iPad Pro 11-inch (M5) iOS 26.3; AWC-s14-iphone = iPhone 17 Pro iOS 26.3): jobs `1-4-ipad-focus-entry-shared-010-claim` and `-011-verify-matrix`: iPad transfer-list states 138/138 x4 (010 + 011 x3), paint 2388/2388 x2; iPhone states 138/138, paint 2388/2388; macOS states 138/138, paint 2388/2388. Baseline before the fix (job 001): iPad 111/136, 2382/2388. Regression of the other bridge users on iPad: jobs 012 (baseline tree) / 013 (fixed tree), see 1-4's record.
- Your fixture change (page buttons on screen) is kept: the fix was measured with it.
- Addendum 2026-11-15 (s14 agent): story 1-4 is in `review`. Pre-images re-checked OK today on work/n1-tl and canonical (`--check`). Apply: `python3 work/n1-lab/patches/s14-ipad-focus.py <tree root> --check` then without `--check`; verify sha256 against work/s14-lab/fixed-sha256.txt. iPad regression of the other bridge users (jobs 1-4-...-012 base / -013 fix, 18 states suites on AWC-di-ipad): no new failure; fails base -> fix: Button 1 -> 1 (same snapshot-frame check), Table 3 -> 3 (known pagination click-prev finding), Radio 2 -> 0 (base-only press-scale timing), all other 15 suites 0 -> 0 (ButtonFamily 28207, List 76584, Tabs 132004, Toolbar 2396, Accordion 55870, Card 190407, Chip 156915, Breadcrumbs 76465, NavigationBar 189386, NavigationRail 541432, Menu 2524, Checkbox 17774, Switch 16563, TextField 2025, NumberField 1392 checks, all passed).

### Coordinator note (2026-11-15 09:30 UTC)

- This session starts only after story 1-4 reached `review`. Read 1-4's Dev Agent Record and its note in this Handover, then do open items 1-5 of your Session 4: apply the patch; prove no regression on macOS, iPhone and Android; iPad states x3 and paint; put the iPad numbers into the docs; install n1-087 on the main queue; checkpoint; DEFECTS lines; the Laboratory checks on iOS and Android.

### Coordinator note (2026-11-15 13:35 UTC)
- The coordinator runs the Laboratory probe and the checkpoint confirm in main-queue job 872-s11-lab-probe-and-checkpoint (probe script work/n1-lab/jobs/1-1-lab-probe.mjs, unchanged). No agent action is needed. The coordinator sets the status after reading the job log.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- INSTALLED in canonical: main-queue job 1-1-md-transfer-list-finish-and-install-036-install-transfer-list exit 0 (dry run ok, 53 files, 0 differ from verified tree n1-tl, canonical = dry copy; core build 0, compiler 0, studio 886/886, macOS states 138/138, live host 22 checks, Android compile ok, APK on emulator-5554, 4177 restarted, 6 routes 200, checkpoint.json written with 23 pins, AUDIT row 87 written).
- Verified before install (tree n1-tl = canonical + bundle + story 1-4 patch): macOS, iPhone, iPad, Android all green (EVIDENCE lines below).
- Laboratory gate 3 and checkpoint: done by coordinator main-queue job 872-s11-lab-probe-and-checkpoint (exit 0, 2026-11-15 13:37 UTC). Probe through 4177: iOS 6/6 and Android 6/6 checks ok (session, second frame, property update in place, frame after update, typed appearance session, appearance frame). `checkpoint-refresh.py confirm md-transfer-list` done; report: current, 23/23 pins. DEFECTS.md: no md-transfer-list lines. Nothing open; status set to review by the coordinator.

### Session 1 (2026-11-13/14) - state read from logs, nothing queued yet
Evidence on private tree work/n1-tl (not canonical):
- macOS n1-086 + n1-088: states 138/138, paint 2388/2388, live SwiftUI host 22 checks, studio transfer 8/8, source e2e 7/7.
- iOS 26.3.1 iPhone (AWC-n1) n1-086 + n1-088: states 138/138, paint 2388/2388.
- Android n1-A148 (emulator-5558): states 138/138, retained-update test ok, paint 2386/2388 (tl-locale-ar-rtl count-source/target width 61.0 vs Chrome 59.625); TLX-A2 (ArrowDown) still proposed.
Open: (1) queue n1-A150 (work/n1-lab/jobs/v-a150) on lane a2; (2) macOS tools/ax n1-088: 4 open Tab-order findings (default, not-searchable, single-step, empty-target: Tab from search -> nothing, then wrap; evidence outputs/native-parity/_ax-n1-mac/md-transfer-list/*.macos.json keyboardFocus; suspect AWCKeyViewGroup monitor from the field editor via LiveRenderer main.swift md-transfer-list Tab path); (3) iPad 26.3 states+paint; (4) tools/ax iOS + Android (n1-A149 never run); (5) docs fill (tl-final/docs), checkpoint, install n1-087 (needs markers st-out/A149/finished and the n1-088 changes in the bundle); (6) Laboratory iOS/Android preview checks after install.
Note: timing runs from 11-12 08:45 to 11-14 00:06 ran under orphaned CPU hogs; re-run before judging timing failures.


### Session 2 (2026-11-14) - evidence found in done/ logs (earlier agent's jobs were never recorded)
- Mac lane n1, jobs 1-1-...-002..011 (tree work/n1-tl): tools/ax macOS Tab order. Root cause: AWCKeyViewRegionView/Box in AWCKeyViewGroup.swift - a view SwiftUI was tearing down (stacked/columns switch) still got updateNSView and took the box back. Fix: weak box on the view, update only when box.view == nil, dismantle releases (macOS + iOS variants; orig saved in st-out/AWCKeyViewGroup.swift.orig-1-1; same bytes in tl-final/fxtree).
  - job 011: tools/ax md-transfer-list compare 6 cases, 0 open findings (was 4); states 138/138; paint 2388/2388 (macOS).
- Android lane a2, job 1-1-...-150-android-ax-round (A150 script, emulator-5558): BUILD OK, 3 tests 0 failures; states 138/138 (all runs settledFails 0, motionFails 0), paint 2388/2388 (Arabic count pill by platform-font run, CSS letter-spacing), retained-update/methods test ok, host test ok, 34 Compose examples compiled; proposed exceptions: none (TLX-A2 replaced by Web-like arrow keys on rows).
- Queued: 1-1-...-012-ios-matrix (iPhone AWC-n1 + iPad AWC-n1-ipad, states x3 + paint each, n1-tl) on lane n1; 1-1-...-013-ax-ios-android (lane a2, waits for 012) tools/ax on all four platforms.
- Remaining: docs fill (tl-final/docs via jobs/v-docs/fill.py), checkpoint, install n1-087 (markers 086/finished, A148/finished, A149/finished: A149 never ran, replaced by 1-1-013), Laboratory iOS/Android checks after install.

### Session 3 (2026-11-14) - verification of sessions 1-2, iPad, Android names, ax; status blocked on iPad
Verified from logs (jobs under claude-runner/done/1-1-md-transfer-list-finish-and-install-NNN-*.log, tree work/n1-tl):
- macOS: job 011 states 138/138, paint 2388/2388, tools/ax 0 open; job 017/019/021/024 mac states 138/138 after my fixture change.
- iPhone 26.3 (AWC-n1): job 014 states 138/138 (x2; run 1 was a build race "bundle-module.swift was modified during the build", exit 2, not a test failure), paint 2388/2388; job 019/021 states 138/138 again.
- Android a2: job 015 states 138/138 + paint 2388/2388, but its tools/ax run had 27 open findings (option names duplicated "Analytics Analytics Dashboards": contentDescription + merged texts). Fix (NativeTransferList.kt row: clearAndSetSemantics, name = label + description once; orig in n1-lab/st-out/NativeTransferList.kt.orig-1-1). Job 022: 3 tests ok, states 138/138, paint 2388/2388, host test ok, 34 Compose examples compiled. Job 028: tools/ax md-transfer-list 6 cases, 0 open findings (summary-md-transfer-list.json open 0, expected 55), iOS + Android + macOS + Web.
- iPad (AWC-n1-ipad, iPad Pro 11-inch M5, iOS 26.3.1; created in job 014; job 012 failed to create it from the 12.9in type): NEVER GREEN. Job 014: states 96/136 (x3 identical), paint 2382/2388.
  Diagnosis (jobs 016-026, KEYDBG/DUF/SEL traces): (1) the states fixture put the page's "before"/"after" buttons at x=940, off the 834 pt iPad screen; the focus system then entered Tab at tl-all-s, one stop late for the whole keyboard run. Fixed in the fixture (NativeTransferListStatesIntegration.swift: before top-left x=0, after x=780; orig in st-out/NativeTransferListStatesIntegration.swift.orig-1-1): iPad states 96 -> 111/136, macOS and iPhone stay 138/138. (2) Remaining 25 states checks (tl-keyboard phases 17-27) and 6 paint cases (tl-ltr-focus-row-checked, tl-ltr-focus-mover, tl-rtl-focus-search/-row/-row-checked/-mover) have ONE cause: with no AWC first responder the iPad focus system (not AWCKeyViewLoop; UIFocusUpdateContext.focusHeading is 0, no key command or SwiftUI shortcut runs) picks the entry view by its own heuristic (Shift+Tab from the page's first control re-enters at "before" instead of wrapping to the last stop; Tab after a tap on empty space enters near the tap / at the remembered row / at the target search in RTL instead of the first stop in loop order). Chrome: first stop (Shift+Tab: last). Shared code (AWCNativeButtonFocusView in NativeFocusBridge.swift, same pattern in AccordionScrollBridge.swift), not md-transfer-list.
  Tried and reverted (product files restored byte for byte, cmp checked): shouldUpdateFocus veto (never called), didUpdateFocus redirect to the loop's first/last stop (no effect: heading is 0 so direction is unknown, and Shift+Tab from nothing is not seen by us), canBecomeFocused only on explicit requests (worse: engine then focuses the search UITextField, iPad states 95/136, paint 2380/2388).
  Open design options for whoever owns shared focus (fi/di): (a) learn the Tab direction from the hardware key (GCKeyboard shift state or a press observer) and redirect the system's nil-entry in didUpdateFocus; (b) an explicit UIKeyCommand with wantsPriorityOverSystemBehavior installed on the host's hosting controller so Tab/Shift+Tab with no responder never reach the engine; (c) a gate-7-accepted exception record (AUDIT.md Exception policy) for iPad nil-entry. Not done: no exception proposed by me.
Current tree state: product files unchanged vs. earlier sessions except NativeTransferList.kt (Android row semantics); only test fixture changed on Swift side. Debug code removed (NativeFocusBridge.swift and NativeKeyViewLoop.swift restored from st-out/*.orig-1-1).
NOT DONE (blocked behind iPad): docs fill (tl-final/docs is empty; needs values.json for jobs/v-docs/fill.py plus docs-edit.py, audit-row-pre.txt that n1-087 expects), checkpoint.json, the n1-087 install (also needs markers st-out/086/finished, A148/finished, A149/finished or a rewrite of that check to use jobs 011/014/022/028), post-install checks of the Laboratory on iOS/Android (property update + part style in place), the install's byte identity check. I did not queue any main-queue install: the definition of done needs iPad states+paint green (story task 3), and installing with an open iPad finding would contradict the AC.
Timing note: all jobs above ran after 11-14 00:06 (no hog load). iPad failures are deterministic (3 identical runs), not timing.

### Session 4 (2026-11-14, per the 16:00 UTC coordinator note) - refresh on today's canonical; everything independent of the iPad is done
Jobs (claude-runner/done/1-1-md-transfer-list-finish-and-install-NNN-*.log; tree work/n1-tl rebuilt from canonical incl. fx-108, md-date-picker, R6-17 installs, then the bundle applied; markers n1-lab/st-out/1-1-030|031|032/finished):
- 030 (lane n1, exit 0, 25 min): bundle tl-final synced with the two files changed after it was built (NativeTransferList.kt row semantics, NativeTransferListStatesIntegration.swift fixture); all anchors ok on today's canonical; core build 0; compiler 0; 36+36 examples generated; studio transfer 8/8, all studio 886/886 (canonical alone 878/878); swift package + playground builds 0; macOS states 138/138, paint 2388/2388; live SwiftUI host 22 checks; examples Swift typecheck 0; iPhone 17 Pro iOS 26.3.1 (AWC-n1) states 138/138, paint 2388/2388. No iPad run.
- 031 (lane a2, emulator-5558, exit 0): 3 tests 0 failures (states, paint, LivePreviewTransferListHostTest); states 138/138 (settledFails 0, motionFails 0), paint 2388/2388, proposed exceptions none, 36 Compose examples compiled.
- 032 (lane n1, exit 0): tools/ax md-transfer-list on Web, macOS, iOS, Android: 6 cases, 0 open findings (expected 55); evidence outputs/native-parity/_ax-n1/md-transfer-list.
Install bundle state (work/n1-lab/tl-final):
- docs/ filled: md-transfer-list.md, decisions.md (2026-10-30 + 2026-11-12 sections; TLX-A2 withdrawn, replaced by keyboard arrow handling), audit-row.txt (+ audit-row-pre.txt, docs-edit.py), checkpoint.json; source is n1-lab/jobs/v-docs (values.json, templates edited; originals *.orig-1-1). docs-edit.py --check ok on canonical.
- n1-087 install job rewritten (n1-lab/jobs/v-install/n1-087-install-transfer-list.sh; orig *.orig-1-1): marker check now 1-1-030/031/032 finished, evidence copied from those jobs, and it refuses to install while audit-row.txt or checkpoint.json still say "pending story 1-4". NOT queued.
Laboratory gate 3 in the tree: transferlist-appearance.js with 20 hooks + 12 typed part names, retained updates (studio 8/8, SwiftUI host 22 checks, Compose host test), 36+36 compiled examples; preview checks on iOS/Android against 4177 happen after the install.
Status: blocked, waiting for 1-4 (iPad focus entry).
Remaining steps, in order:
1. After 1-4 finishes: apply work/n1-lab/patches/s14-ipad-focus.py to work/n1-tl (and mirror any shared-file change as an anchored edit in the install bundle, or confirm 1-4 installs it itself), rebuild, re-run macOS + iPhone + Android states and paint (jobs like 030/031) to prove no regression.
2. iPad Pro 11-inch (AWC-n1-ipad, iOS 26.3.1): states x3 + paint; expected 138/138 and 2388/2388 (before: 111/136 and 2382/2388 with the entry problem).
3. Update n1-lab/jobs/v-docs/values.json (IOS_RESULT, audit_row: drop "[iPad pending story 1-4]", checkpoint ipad + pending), rerun `python3 jobs/v-docs/fill.py jobs/v-docs/values.json transfer/docs/decisions.md tl-final/docs`; add the iPad logs to the evidence copy lines of the install job.
4. Queue n1-087 (main queue; includes dry run, byte identity, rollback), then checkpoint-refresh.py and DEFECTS.md status lines for closed findings.
5. Post-install Laboratory checks on 4177: md-transfer-list preview on iOS and Android, frames valid, a property update and a part style apply in place.

### Session 5 (2026-11-15, coordinator note 09:30 UTC) - patch applied on a fresh tree, verification running
- Job 033 (lane n1, exit 2, 13 s): s14 patch applied but my sha256 check failed on FieldTextInput.swift: canonical's macOS branch moved after the s14 tree was made. Verified instead that the patch delta on FieldTextInput.swift (canonical -> n1-tl, 1 line) is identical to the s14 delta (orig -> s14-tree); the other 3 files match fixed-sha256.txt.
- Job 035 (lane n1, retry, tree refreshed from canonical + bundle + s14 patch; marker n1-lab/st-out/1-1-035/finished when done): macOS states 138/138, paint 2388/2388, live SwiftUI host 22 checks; then iPhone (AWC-n1) states+paint, then iPad AWC-n1-ipad paint + states x3. The iOS steps wait long for `slot.sh timing` (4 slots, all busy).
- Job 034 (lane a2, emulator-5558, exit 0, tree n1-tl after the patch): 3 tests 0 failures; states 138/138, paint 2388/2388, proposed exceptions none.
- n1-087 install job edited (orig n1-087-install-transfer-list.sh.orig-1-1-s5): apply() now also runs patches/s14-ipad-focus.py; markers 1-1-035, 1-1-034, 1-1-032; iPad logs copied from 1-1-035.
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | macOS | transfer-list states | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | macOS | transfer-list paint | 2388/2388
EVIDENCE | 1-1-md-transfer-list-finish-and-install-034-android-after-s14 | Android | transfer-list states | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-034-android-after-s14 | Android | transfer-list paint | 2388/2388

### Session 5 results (2026-11-15)
- s14 patch applied on a fresh tree from canonical (job 035; FieldTextInput.swift delta identical to the s14 tree, other 3 files sha256 equal).
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | macOS | transfer-list states | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | macOS | transfer-list paint | 2388/2388
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | macOS | SwiftUI live host | 22/22
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPhone 17 Pro iOS 26.3.1 | transfer-list states | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPhone 17 Pro iOS 26.3.1 | transfer-list paint | 2388/2388
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPad Pro 11-inch M5 iOS 26.3.1 | transfer-list paint | 2388/2388
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPad Pro 11-inch M5 iOS 26.3.1 | transfer-list states run 1 | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPad Pro 11-inch M5 iOS 26.3.1 | transfer-list states run 2 | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-035-patch-ipad-retry | iPad Pro 11-inch M5 iOS 26.3.1 | transfer-list states run 3 | 138/138
EVIDENCE | 1-1-md-transfer-list-finish-and-install-034-android-after-s14 | Android emulator-5558 | transfer-list host test | 3 tests 0 failures
EVIDENCE | 1-1-md-transfer-list-finish-and-install-036-install-transfer-list | canonical | studio all | 886/886
EVIDENCE | 1-1-md-transfer-list-finish-and-install-036-install-transfer-list | canonical macOS | transfer-list states | 138/138
EVIDENCE | 872-s11-lab-probe-and-checkpoint | ios | Laboratory probe 4177 md-transfer-list | 6/6
EVIDENCE | 872-s11-lab-probe-and-checkpoint | android | Laboratory probe 4177 md-transfer-list | 6/6
- Docs refilled with the iPad numbers (values.json, fill.py; no "pending story 1-4" left) and installed by job 036. Install job n1-087 was edited to apply patches/s14-ipad-focus.py and use markers 035/034/032.

## Review Triage Log

