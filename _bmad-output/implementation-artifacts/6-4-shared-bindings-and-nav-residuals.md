---
title: 'Shared closure bindings and navigation residuals'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '6-4-shared-bindings-and-nav-residuals'
epic: 6
model: 'sonnet'
wave: 2
lanes: 'mac lane n5 · android lane a3 (emulator-5560) · simulator AWC-n5'
lab: 'work/n5-lab and work/d4-lab'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** d4 found that closure-based `open` bindings made sheets republish every frame and get stuck; `AWCNativeView.swift` (around lines 147 and 152) still builds closure-based bindings for other controls. Separately, Android app-bar states `leading-pointer-light-ltr leave` failed twice under load, and the rail's first modal expand starts 12-16 ms beyond two frames on macOS.

**Approach:** Audit the remaining closure-based bindings, convert the risky ones to location-based bindings with a regression test, and find the cause of the two navigation residuals.

## Boundaries & Constraints

**Always:** Any change to `AWCNativeView.swift` is an anchored edit verified by the full Swift fixture sweep. The rules in project-context.md apply.

**Never:** No compensation in test harnesses for product-side lateness.

</intent-contract>

## Code Map

- `docs/native-parity/native-modal-layer.md` -- d4's note on the binding failure; `work/d4-lab/PROGRESS.md`
- `packages/native-ios/Sources/AWCUI/AWCNativeView.swift`
- `work/n5-lab/PROGRESS.md` -- app-bar and rail open items; `work/n5-lab/handoff/DEFECTS-note-md-app-bar.md` (apply it to DEFECTS.md)

## Tasks & Acceptance

**Execution:**
- [x] List every closure-based binding handed to a view that publishes preferences; convert them; add a stuck-state probe test
- [x] Android app-bar leave: reproduce under load, find the cause, fix
- [x] Rail first modal expand: find the product-side cause of the late start; remove the harness compensation if the product is fixed
- [x] Full Swift fixture sweep on macOS, focused iOS and Android runs; install; apply n5's DEFECTS note; confirm checkpoints for app-bar, rail, toolbar

**Acceptance Criteria:**
- Given the converted bindings, when the full Swift fixture sweep runs, then no suite regresses
- Given 20 loaded runs of Android app-bar states, when they finish, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-15 09:30 UTC)

- Routed here by story 3-1: Android `NativeAppBarStatesTest` fails intermittently on plain canonical (one flat pixel at one frame; `3-1-A005-triage-three`, also d3-A025). Find the cause.

### Coordinator note (2026-11-15 11:45 UTC)

- Three sessions ran; none ticked a task. Continue from your Current state block and the open items of session 3: read A002 and A003 (hover log), the sweep 6-4-005, the probe 6-4-006.
- The app-bar flat pixel reproduces only under load, and the Mac's load was 120 to 550 today. Decide with the A003 hover log whether it is a harness artefact or late exit delivery; check KNOWN-CAUSES.md first.
- `NativePreviewPresentationIntegration` aborting at md-autocomplete belongs to story 6-7; do not fix it here.

### Coordinator note (2026-11-15 16:50 UTC)
- Job 6-4-005-swift-sweep is still running on lane n5 (82 of 106 fixtures at 16:46 UTC, every finished fixture rc=0 so far: check with `grep -c "rc=" claude-runner/done/6-4-005-swift-sweep.log` and `grep -v "rc=0" ...`). Do not wait for it. Job 6-4-006-rail-first-expand-probe is queued behind it on the same lane.
- Work the Android part first (lane a3, emulator-5560): read the results of 6-4-A002 and 6-4-A003-appbar-hoverlog-repro, then find the cause of the `leading-pointer-light-ltr leave` flat pixel (hover layer still at 0.08) with the hover-event log. The failure counts as explained only with a trace of the hover events and the sampled frame; KNOWN-CAUSES.md row 13 holds the load numbers.
- When the sweep ends, record its result per fixture group as EVIDENCE lines and go on with the iOS runs of the binding conversion, then the install.

### Coordinator note (2026-11-15 17:12 UTC)
- The previous session was stopped by the coordinator at 17:12 UTC to switch this story to the short-session rules (project-context.md, section 'Sessions and tokens'). It could not write its last notes. Its jobs keep running. Read the summary lines of the jobs below first (grep and tail, not whole logs), then continue from them.
- Notes are current to 16:59 UTC. Queued in queue-a3: 6-4-A004-appbar-hoverdiag-repro. Job 6-4-005-swift-sweep is still running on lane n5.

### Coordinator note (09:11 UTC 2026-11-16, decision on task 3)
- Decision on task 3: it is not accepted as load-induced without a measurement, and you do not need a window from the coordinator: you make the load yourself, as job 6-4-006 did.
- One job on your lane, through `slot.sh timing 4`: the first modal expand (modal-ltr) 40 times under the load of 6-4-006, and standard-ltr 40 times as the control, alternating in the same job. For each run log, around the first expand: the time of the toggle write; the time of the first frame of the expand animation that the product receives; the display ticks between the two; and how long the main thread spends in product code between the two (time the expand handler and the first layout of the scrim or overlay).
- Then decide by these rules. (a) In the stalled runs the main thread is busy in product code for more than about 4 ms: that is the product-side cause. Fix it, repeat the 40 + 40 runs, remove the harness compensation and run the rail states suite three times. (b) The display skips a tick while product code took less than about 2 ms, and the control stalls at a similar rate: the host is late, not the product. Task 3 then closes as "load-induced, measured": the compensation stays, KNOWN-CAUSES.md gets a row with the numbers, and DEFECTS.md gets one line that the 7-4 reviewer can check. (c) No stall in 80 runs: close as in (b) with the rate written down (0 of 80 loaded, plus the earlier 1 of 5).
- After that: verify_evidence.py, then `review`. The stale md-toolbar checkpoint is not yours; story 8-1 confirms it. The abort of NativePreviewPresentationIntegration at md-autocomplete stays with story 6-7.
- If two measured attempts do not separate (a) from (b), return `escalate: true`.

### Note from story 1-3 (2026-11-16)
- `NativeDatePickerPaintIntegration` on macOS failed 606 checks (37183/37789) in your sweep because the test applied the Decision 9 year-scroll tolerance only with env `AWC_DP_D9`. The test now defaults to the motion capture (installed canonical, job `1-3-md-date-picker-finish-and-install-100-install-paint-test`): run it without env for 37183/37183 and with `AWC_DP_PAINT_NAME=datepicker-web-paint-reduced` for 37789/37789. Not a product regression.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 14 (2026-11-16). All 4 tasks ticked. Task 3: product cause (first draw of blurred elevation shadow, ~15 ms) fixed by shadow opacity floor 0.0004 in NativeNavigationRail.swift; harness compensation removed. Installed canonical byte-identical to n64-tree: job 6-4-020-install-rail-shadow-warm (exit 0). KNOWN-CAUSES row 29, DEFECTS line, md-navigation-rail checkpoint refreshed.
- Next: run `python3 $HOME/mnt/p/work/bmad-coord/verify_evidence.py 6-4-shared-bindings-and-nav-residuals`, fix any hard failure, then set status review.
- EVIDENCE | 6-4-016-rail-first-expand-cpu | macOS | rail modal-ltr 40 loaded runs before fix, explained: 35 without stall, 5 stall runs are the product cause fixed in 6-4-020 | 35/40
- EVIDENCE | 6-4-018-rail-shadow-warm-verify | macOS | rail modal-ltr 40 + standard 40 loaded, runs without stall | 80/80
- EVIDENCE | 6-4-018-rail-shadow-warm-verify | macOS | NativeNavigationRailStatesIntegration run 1 compensation removed | 543649/543649
- EVIDENCE | 6-4-018-rail-shadow-warm-verify | macOS | NativeNavigationRailStatesIntegration run 2 compensation removed | 543369/543369
- EVIDENCE | 6-4-018-rail-shadow-warm-verify | macOS | NativeNavigationRailStatesIntegration run 3 compensation removed | 543649/543649
- EVIDENCE | 6-4-018-rail-shadow-warm-verify | macOS | NativeNavigationRailPaintIntegration | 19563/19563
- EVIDENCE | 6-4-020-install-rail-shadow-warm | macOS | NativeNavigationRailStatesIntegration installed canonical run 1 | 543649/543649
- EVIDENCE | 6-4-020-install-rail-shadow-warm | macOS | NativeNavigationRailStatesIntegration installed canonical run 2 | 543649/543649
- EVIDENCE | 6-4-020-install-rail-shadow-warm | macOS | NativeNavigationRailPaintIntegration installed canonical | 19563/19563
- EVIDENCE | 6-4-A005-appbar-exitsync-loaded | android emulator-5560 | NativeAppBarStatesTest loaded 20 runs with exit sync, explained: 0 leave flat-pixel failures, 3 failures are capture flakes (KNOWN-CAUSES row 12 PixelCopy, forceRedraw) | 17/20
- (older evidence lines below remain valid)
- EVIDENCE | 6-4-002-binding-probe | macOS | NativeBindingStuckProbe n64-tree | 120/120
- EVIDENCE | 6-4-008-ios-focused | iOS simulator AWC-n5 | NativeBottomSheetMotionIntegration | 21605/21605
- EVIDENCE | 6-4-008-ios-focused | iOS simulator AWC-n5 | NativeSideSheetMotionIntegration | 11877/11877
- EVIDENCE | 6-4-008-ios-focused | iOS simulator AWC-n5 | NativeBottomSheetPaintIntegration | 1948/1948
- EVIDENCE | 6-4-008-ios-focused | iOS simulator AWC-n5 | NativeSideSheetPaintIntegration | 3057/3057
- EVIDENCE | 6-4-A007-appbar-exitidle-loaded | android emulator-5560 | NativeAppBarStatesTest loaded 12 busy loops, exit sync + idle | 20/20
- EVIDENCE | 6-4-A002-appbar-full-loaded | android emulator-5560 | NativeAppBarStatesTest loaded pre-fix, explained: failing run is the harness exit-delivery cause fixed in A007 | 19/20
- EVIDENCE | 6-4-005-swift-sweep | macOS | full fixture sweep n64-tree, explained: 7 non-zero fixtures identical on baseline (6-4-007), pre-existing | 99/106
- EVIDENCE | 6-4-007-sweep-fail-rerun | macOS | 7 non-zero fixtures rerun: identical on n64-base (pre-existing) | 7/7
- EVIDENCE | 6-4-010-rail-prewarm-ab | macOS | NativeNavigationRailStatesIntegration modal-ltr n64-tree, runs without STALL | 15/15
- EVIDENCE | 6-4-012-install-bindings-nav | macOS | rail modal-ltr installed canonical | 40873/40873
- EVIDENCE | 6-4-012-install-bindings-nav | macOS | NativeBindingStuckProbe installed canonical | 120/120

### Session 1 (2026-11-15, agent s1) notes

**Task 1 (binding audit), analysis done.** Closure-based `Binding(get:set:)` in `packages/native-ios/Sources/AWCUI`, classified:
- Hand to a view that publishes preferences (risky): `awcPreviewSheet(isPresented:)` call sites `Overlays.swift:7` (`sheet`, the LIVE legacy path of md-dialog / md-bottom-sheet / md-side-sheet without an AWCModalScope), `Inputs.swift:127` (`temporalPicker`) and `Options.swift:53` (`optionPicker`); the last two are dead code (no caller; dedicated NativeDatePicker/TimePicker/Select exist). `AWCPreviewSheetModifier` publishes `AWCPreviewPresentedKey` / `AWCPreviewPresentationsKey` from the body that takes the binding: same failure class as d4's.
- Not preference-publishing, kept: `AWCNativeView.swift` `textBinding` / `boolBinding` (feed TextField/Toggle only), Actions.swift:115 Toggle, Containers.swift:53 TextField, DataViews.swift:116 Picker, Inputs.swift:37/51/78/108/153/171 fields, sliders, pickers, Overlays.swift:42, PreviewPickers.swift, NativeMultiSelect/NativeSelect search fields (text), NativeNavigationRail.swift:1313 popover (runtime object), NativeTimePicker.swift:397 platform `.sheet` (the picker body publishes a preference but the binding reads an @Observable runtime and the preference does not depend on it; revisit only if the probe shows a stuck state).
- Fix (private tree `work/n64-tree`, from canonical snapshot job 6-4-001): `awcPreviewSheet` gets `onChange: ((Bool)->Void)?` (called on presentation-driven changes: scrim, Escape, system sheet dismissal); the three call sites pass `$local[awcBool: "open"]` and emit mdCancel/mdOpen/mdClose in `onChange`. No change to `AWCNativeView.swift` was needed. Probe: `Tests/NativeBindingStuckProbe.swift` (20 open/close cycles per tag in AWCPreviewScope, surface must shrink after each close). Job 6-4-002-binding-probe runs it on the baseline (`work/n64-base`, canonical closures) and on n64-tree.

**Evidence so far (macOS, Mac lane n5).** 6-4-001-snapshot-tree exit 0 (work/n64-tree). 6-4-002-binding-probe: `NativeBindingStuckProbe` 120/120 checks on the baseline (closure bindings, n64-base) AND 120/120 on n64-tree: the probe does NOT fail on the baseline, so for these preview-scope sheets the closure binding did not reproduce d4's stuck state (the failing-test-first step cannot be shown; the conversion is preventive, recorded as such). `NativePreviewPresentationIntegration` aborts at "md-autocomplete: embedded content must size the capture surface" on n64-tree (6-4-002) AND on the baseline (6-4-003, same message): pre-existing, not caused by this change; it hides every check after md-autocomplete (md-date-picker, md-time-picker, color picker, production sheet), so the sweep below must not rely on it. Still to do: full Swift fixture sweep (`Scripts/test-native-views.sh`, all fixtures) on n64-tree, iOS focused run, install job, checkpoints.

**Task 2 (Android app-bar leave), analysis so far.** Failing shot (d3-base, `3-1-A005`): `leading-pointer-light-ltr leave` flat pixels at +384, worst (85,69) web 255 native 237 = exactly the md-icon-button hover layer at full 0.08 on-surface (255-0.08*(255-28)=237), so the leading button is still HOVERED 384 ms after the pointer left, not mid-fade. Hover exit is injected by `NativeAppBarStatesTest.act` (`moveTo` clamped to base+530 then `exit()`); the product reads hover via `collectIsHoveredAsState` in `NativeIconButton.kt:126`. Hypothesis to test: a view-driven re-dispatch of the last pointer event (AndroidComposeView resends the last motion event after layout changes on a real-time post) after `shiftScene` (real `Thread.sleep(60)`, view.invalidate) re-enters the button: it happens only when the post lands late under load. n5-A044 (8 and 11 runs, unloaded) never reproduced. Next: a loaded repro job with a load generator started and killed by the job itself (trap), 20 runs of `-PappBarStatesOnly=leading-pointer-light-ltr` on a3 (emulator-5560, private project copy from n64-tree), logging the hovered flag at the shot.

Job 6-4-A001-appbar-leave-loaded (lane a3, emulator-5560, project n64-tree, exit 0): leading-pointer subset, 5 unloaded + 20 loaded (12 busy loops, killed by trap): 25 of 25 PASS (as n5-A044: the subset alone never reproduces; the failure needs the full suite's preceding cases). Results `work/n64-tree/out/A001/results.txt`. Next job 6-4-A002-appbar-full-loaded (FULL NativeAppBarStatesTest x20 with 12 busy loops; results `work/n64-tree/out/A002/results.txt`, per-run summaries `run<N>-summary.txt`). NOTE for the successor: the busy loops start BEFORE the first gradle build, so the build/first run is very slow; start load after a warm-up run if A002 is re-queued. If A002 reproduces a failure: capture which case/phase failed first, add the hovered flag of the leading md-icon-button to the harness sample (hypothesis above), and check whether the Exit hover reached the icon button (NativeIconButton.kt:126 `collectIsHoveredAsState`) before the +384 shot; if the exit arrives late relative to the paused test clock this is a harness delivery problem (fix in the test: wait for idle after `exit()`), not product lateness.

**State at the end of session 1 (for the successor).** Status stays `in-progress`; no task is ticked yet.
- Swift: edits are in `work/n64-tree` only (PreviewScope.swift, Overlays.swift, Inputs.swift, Options.swift, new Tests/NativeBindingStuckProbe.swift). Canonical is untouched. Still to do: add the probe to `scripts/test-native-preview.sh` (anchored edit in the install), full fixture sweep on n64-tree (`Scripts/test-native-views.sh`, every fixture, in one job), focused iOS simulator run (AWC-n5), then one main-queue install job (anchored, pre-image checks, byte identity), then docs (`native-modal-layer.md` note on the audit), DEFECTS.md note from `n5-lab/handoff/DEFECTS-note-md-app-bar.md`, `tools/checkpoint-refresh.py` for md-app-bar, md-navigation-rail, md-toolbar. The existing `NativePreviewPresentationIntegration` aborts at md-autocomplete on baseline and tree alike (6-4-003): decide whether to fix that expectation (md-autocomplete's dedicated renderer) or leave it to its owner.
- Android: 6-4-A002-appbar-full-loaded (lane a3) had produced no result after about 70 minutes: the Mac load average was 290-390 (6-4-004-a002-unstick log; I also killed A002's 12 own busy loops there, they were irrelevant against that load), `f-summary.txt` empty. Check `work/n64-tree/out/A002/results.txt` and `claude-runner/done/6-4-A002-appbar-full-loaded.log` first; if it never finishes, ask for a quieter window (do not requeue blindly).
- Rail first modal expand (task 3): not started. Read `work/n5-lab/PROGRESS.md` lines ~117 and the STALL lines in `claude-runner/done/n5-056*.log`; find what delays the first modal expand 12-16 ms (product side: first-use work in the rail modal state change) before touching the harness compensation.

### Session 2 (2026-11-15, agent s2) notes

- 6-4-A002-appbar-full-loaded (lane a3) is NOT stuck: it acquired timing slot 3 at 12:55 Mac time (it had waited for a slot) and is running; `n64-tree/out/A002/results.txt` gets one line per run ("loaded N pass"); 3 of 20 pass at 11:05 UTC, about 6 min per run, so it ends about 12:45 UTC. Per-run output in `n64-tree/out/android/f*.log`.
- Queued 6-4-005-swift-sweep (lane n5): full Swift fixture sweep on n64-tree, one fixture per `test-native-views.sh` call (106 fixtures, States/Motion/Lifecycle/Interaction/Stacking via `slot.sh timing 4`); results `n64-tree/out/sweep/results.txt` (line per fixture with rc and last log line, final `SWEEP total=N fail=M`). Any failing fixture must be re-run on `work/n64-base` to separate pre-existing failures.
- Task 3 (rail first modal expand) not started yet.

- Task 3 reading (no job yet): `NativeNavigationRailStatesIntegration.swift` ~l.304-330 holds the harness compensation (STALL when the first changed frame is > 8 ms beyond two frames; n5-063/064 logs: modal-ltr toggle-expand 11.6 / 15.6 ms, none for other cases). In the product the modal scrim and surface are already always in the tree (`NativeNavigationRail.swift` ~1336-1346), so first-view construction of the scrim is NOT the cause. Retarget is in `retarget()` ~1108 (idempotent, runs in body; `pendingFlip` ~954/1173). Untested hypothesis: first-use cost on the first expand (expanded-tab geometry `AWCRailTabGeometry.expanded` textWidth for expanded labels, or the modal surface shadow/`AWCTabsTrack` first evaluation). Next: probe job on lane n5 running the rail states fixture with `AWC_RAIL_ONLY=modal-ltr` and `AWC_RAIL_DEBUG=modal-ltr toggle-expand` (env vars in the fixture ~l.332/370), x10, via `slot.sh timing 4`, compare with `standard-ltr`; if a warm-up (pre-measuring the expanded text widths) removes the delay, fix it in product (precompute at first body) and delete the compensation.
- At the end of session 2: 6-4-A002 (Android) and 6-4-005 (Swift sweep) are both still running; session 3 must read their results first (`n64-tree/out/A002/results.txt`, `n64-tree/out/sweep/results.txt`), then do task 3, then iOS focused run (simulator AWC-n5), install job, DEFECTS note, checkpoints.

### Session 3 (2026-11-15, agent s3) notes

- A002 (full NativeAppBarStatesTest, 12 busy loops, lane a3): REPRODUCED the failure in loaded run 10 of 20: `leading-pointer-light-ltr leave flat pixels (frame +384 of [384])`, worst (85,69) native 237 = full 0.08 hover layer still on (identical signature to 3-1-A005 / d3-A025). Runs 1-9, 11, 12 passed (remaining runs: see `n64-tree/out/A002/results.txt`). The subset alone never reproduces, so the failure needs the full suite's preceding state; it is not caused by my Swift change.
- Diagnostic added to the private test `n64-tree/apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeAppBarStatesTest.kt` (not canonical): `view.setOnGenericMotionListener` logs every motion event the view dispatches (action, xy, test clock, real time) in `hoverLog`; the last 12 are appended to the "flat pixels" failure message. Queued `queue-a3/6-4-A003-appbar-hoverlog-repro.sh`: warm-up, 6 busy loops, up to 30 full runs until the first failure, the failing xml kept in `n64-tree/out/A003/fail-N-xml`, the hoverLog printed in its log. Reading: if after the HOVER_EXIT (action 10) there is no later event but the pixel still shows hover, the exit did not reach the icon button's interaction source before the shot (delivery/clock problem in harness: fix = wait for idle after exit()); if a HOVER_ENTER/MOVE (9/7) appears after the exit, the view re-dispatched the pointer (shiftScene's real-time sleep + invalidate) = harness artefact. Hypothesis from session 1 stays untested until A003 reports.
- Rail probe job queued: `queue-n5/6-4-006-rail-first-expand-probe.sh` (modal-ltr x5, standard-ltr x5, STALL lines); it waits behind 6-4-005 on lane n5 (the sweep takes about 3-5 min per fixture; 2 of 106 done at 11:25 UTC; fixtures so far: NativeAppBarStatesIntegration 1397/1397, NativeAppBarPaintIntegration 2217/2217, both rc=0 on n64-tree).

### Session 4 (2026-11-15, agent s4) notes

- A002 final: 19/20 loaded full runs pass, run 10 FAIL (signature as 3-1-A005). A003 reproduced in run 3 (hoverLog kept in `n64-tree/out/A003/fail-3-xml`): the view dispatched HOVER_ENTER (9) at clk 33262, then HOVER_EXIT (10 at 1060,1200) at clk 33822, i.e. the exit DID reach the view ~560 ms before the end of the phase, and the shot at +384 still showed 12 of 18 levels of the hover layer (partial, not just a stale full 0.08). So it is not a re-dispatched pointer (no event after the exit); the hover state change or its 100 ms fade did not progress on the paused test clock between exit delivery and the shot. This is NOT yet proof of harness vs product: A004 adds `AWCHoverDiag` (private tree only, `// 6-4 DIAG` in NativeIconButton.kt, remove before install) logging every change of hovered/pressed/opacity with test clock + real time, plus the shot clock/real time, to the failure message (`hoverDiag=`, `shots=`). Queued `queue-a3/6-4-A004-appbar-hoverdiag-repro.sh` (up to 40 loaded runs until first failure; lane a3 was busy with story 1-2's A030 first). Reading: if hovered=false is logged late (clk >= shot - 100 ms) while the exit event arrived early, the state flows through an async collector (collectIsHoveredAsState LaunchedEffect) that the paused clock did not run: fix = harness waits for idle / advances a frame after exit(); if hovered=false logged at the exit clock but opacity stays > 0 at the shot, it is the animation clock.

### Session 5 (2026-11-15, agent s5) notes

- CAUSE of the Android app-bar `leading-pointer-light-ltr leave` flat pixel FOUND (A004, run 6 of the loaded full suite; xml `n64-tree/out/A004/fail-6-xml`): the injected `exit()` (compose `performMouseInput`) reached the view only at test clk 33822 / real 36431, AFTER the last shot (clk 33790 / real 36145, shots at +384 of the phase). The product reacted 10 ms real after the delivery (hoverDiag: `h=false` logged at rt=36441, 10 ms after the HOVER_EXIT at rt=36431; opacity then fades 80 -> 0). Before the exit the hover layer was fully on (h=true, o=80 = 0.08), exactly the 237 pixel. So it is a harness delivery-order problem (test sampled before the injected exit arrived under load), not product lateness; no re-dispatched pointer after the exit. The A004 script printed `#6 FAIL:` empty only because its grep pattern broke on `&#64;`; the data is in the xml.
- Fix (harness, not compensation for product lateness): `NativeAppBarStatesTest.kt` in `n64-tree` (clean vs canonical): `mouseExit()` injects the exit and waits (real time, up to 3 s) until the view's generic-motion listener has seen ACTION_HOVER_EXIT. Product diag (AWCHoverDiag) removed from `NativeIconButton.kt` in n64-tree (identical to canonical again); diag copies in `n64-tree/out/A004/*.diag.kt`. Install = one anchored edit of the canonical test file only (3 spots: import MotionEvent, exitSpy listener in the content lambda, mouseExit helper + call site).
- Queued: `queue-a3/6-4-A005-appbar-exitsync-loaded` (warm-up + 6 busy loops, 20 full loaded runs with the fix, summary line `SUMMARY n pass of 20`, results `n64-tree/out/A005/results.txt`); `queue-n5/6-4-007-sweep-fail-rerun` (reruns every non-rc=0 sweep fixture on n64-tree and n64-base after 6-4-005 and 6-4-006).
- Sweep so far (97 of 106): non-zero fixtures NativeMenuStatesIntegration rc=142 (timeout), NativeButtonStatesIntegration 644/645, NativeButtonFamilyStatesIntegration rc=142, NativeTablePaintIntegration 7367/7397, NativeTableStatesIntegration 3830/3859. None touch the preview-sheet bindings; 6-4-007 decides pre-existing vs regression.

### Session 6 (2026-11-15, agent s6) notes

- 6-4-A005 (exit-sync fix, 20 loaded full runs): 17 pass, 3 FAIL (runs 9, 10, 11), none of them the flat pixel: run 9 `ComposeTimeoutException ... forceRedraw` (capture), runs 10 and 11 `Failed waiting for PixelCopy!` = KNOWN-CAUSES row 12 (emulator capture flake under load). Zero `leading-pointer-light-ltr leave` failures (pre-fix: 1 of 20 in A002, reproduced again in A003/A004). AC "20 loaded runs all pass" is NOT met literally: needs a rerun in a quieter window or acceptance of capture flakes by the coordinator.
- 6-4-005 sweep final: `SWEEP total=106 fail=7`: rc=142 timeouts NativeMenuStates, NativeButtonFamilyStates, NativeChartPaint (96/96 checks printed); rc=1 NativeButtonStates 644/645, NativeTablePaint 7367/7397, NativeTableStates 3830/3859, NativeDatePickerPaint 37183/37789. None touch preview-sheet bindings; 6-4-007 reruns them on tree and baseline.
- Queued `queue-n5/6-4-008-ios-focused` (AWC-n5: NativeBindingStuckProbe + Bottom/SideSheet Motion and Paint on n64-tree; output `n64-tree/out/ios/`). 6-4-006 (rail probe) started 23:16 Mac time and had no output yet.

## Review Triage Log

