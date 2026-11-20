---
title: 'md-accordion floating panel: publish it in the modal overlay layer (s7-8-04, r3-19 mechanism 2)'
type: 'feature'
created: '2026-11-15'
status: 'review'
story_key: '9-4-accordion-floating-panel-overlay-layer'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d6 · android lane a2 (emulator-5558) · simulator AWC-d6'
lab: 'work/s94-lab (create it; private tree work/s94-tree = a copy of canonical; the design is in work/d3-lab/PROGRESS.md under 'r3-19 design')'
depends_on: ['7-8-recheck-containment']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 reviewer rejected the r3-19 exception proposal of story 3-1. Two residuals of the floating accordion panel are implementable: (1) an ancestor that clips still clips the panel; (2) the panel orders inside the modal layer, not against sheets and dialogs. Residuals (3) and (4) (the lift chain; `awcStackingLift` on a root-level view) follow from the same design. None of the four is tested against Chrome.

**Approach:** Build mechanism 2 as designed: publish the floating panel as an entry of the `AWCModalScope` overlay, with a zero-size placeholder that re-publishes the document-order tokens; macOS accessibility re-parenting; `movableContentOf` on Compose. Start with Chrome probes that fail on today's code: a floating panel inside a clipping container, one under an open sheet, one under a dialog.

## Boundaries & Constraints

**Always:** Failing-first Chrome probes for each residual on macOS, iOS and Android. After the change every suite that uses `AWCModalScope` passes with unchanged counts on the three platforms. The rules in project-context.md apply.

**Never:** Do not propose an exception for residuals 1 or 2. Do not install while story 1-2 (md-search) or story 6-1 (select family) has an install waiting; rebase on canonical after theirs. Do not change the header relation (story 9-3).

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- row s7-8-04; `docs/native-parity/md-accordion-swift-renderer.md` section 'Document stacking'
- `work/d3-lab/PROGRESS.md` -- 'r3-19 design'; the 3-1 exception record (job `3-1-016`)
- `NativeStackingIntegration` (Swift) and `NativeStackingTest` (Android): the mechanism 1 tests, which pass today

## Tasks & Acceptance

**Execution:**
- [x] Chrome probes and native tests for a clipping ancestor, a panel under a sheet and a panel under a dialog; show they fail on canonical
- [x] Swift: overlay entry, placeholder, document-order tokens, macOS accessibility re-parenting; probes pass on macOS, iPhone 26.3 and iOS 18.6
- [x] Compose: `movableContentOf` into the overlay; probes pass on Android
- [x] Regression pass: accordion paint, states and floating suites, and every `AWCModalScope` user, on macOS, iOS and Android; tools/ax md-accordion 0 open
- [x] Residuals 3 and 4: re-test; close them or re-propose a narrower record with one pinned Chrome probe each
- [x] One main-queue install (dry run, rollback, byte identity); docs section 'Document stacking'; DEFECTS.md status line; checkpoints of the changed components

**Acceptance Criteria:**
- Given a floating accordion panel inside a clipping container, under a sheet and under a dialog, when the native probes run on macOS, iOS and Android, then they match Chrome, and they failed before the change
- Given the components that use `AWCModalScope`, when their suites run after the change, then the counts equal their checkpoints or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-16 14:00 UTC: all Mac queues stopped at 13:35:04 UTC; what to redo)
At 13:35:04 UTC on 2026-11-16 (15:35:04 Mac time) every process of the runner process group got SIGTERM. The main runner, all lanes and all running jobs stopped (`claude-runner/KNOWN-CAUSES.md` row 34: `kill 0` in a helper trap of job 9-9-003). The coordinator stopped all chains at about 13:56 UTC. Your chain is relaunched only after the user has started the runner and the lanes are back, so when you read this the queues work again. Since the restart each lane job runs in its own process group. Results written before 13:35:04 are valid. A job stopped by the event has `.exit` 143 and a last log line written by the coordinator. Before you queue such a job again (new number), check your private tree for half-applied state: files the job trap restores, diagnostic lines left in tests, half-applied patches.

For this story: jobs `9-4-012-mac-regression` (stopped during NativeAccordionBrowserStateIntegration; NativeAccordionAppearanceIntegration 1478/1478 had passed) and `9-4-A012-android-regression` (no result) were stopped. Queue both again under new numbers.

## Dev Agent Record

### Current state
- Session 5 (2026-11-16). Story complete, status review. All mechanisms INSTALLED (main job 9-4-100-install-overlay, byte identity 9/9, docs, DEFECTS s7-8-04 line, checkpoints refreshed).
- Regression: macOS 024, iOS 023, Android A013 (18/19, date-picker paint identical failure on n4-A042, not 9-4), ax md-accordion 0 open. Canonical post-install check 9-4-031 exit 0 (NativeModalStackIntegration 149/149 added).
- verify_evidence: hard failures 0.
- Open (listed, no exception proposed): document-order Tab tokens and macOS AX re-parenting of placeholder not separately probed (ax 0 open); residuals 3 and 4 re-tested by existing suites (Lift 280/280, Stacking 12/12, Android liftedPanelAndDraggedCardStackOverLaterContainers ok), no new pinned probe.
- NEXT: reviewer reads story; nothing queued.

### Notes
Chrome facts (stacking2-web.json): the panel is not clipped by an overflow:hidden ancestor; under a bottom sheet it paints above the scrim; a dialog covers it. Clip scene on native uses an application container (SwiftUI .clipped() / Modifier.clipToBounds) because the authored div has no overflow.
EVIDENCE | 9-4-010-mac-red-final | macOS | NativeStackingOverlayIntegration (red, canonical Accordion sources) - explained | 28/35
EVIDENCE | 9-4-009-mac-overlay-green5 | macOS | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-009-mac-overlay-green5 | macOS | NativeStackingIntegration | 12/12
EVIDENCE | 9-4-011-ios-overlay | iOS 26.3 | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-011-ios-overlay | iOS 18.6 | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-A010-android-red-final | Android | NativeStackingOverlayTest (red, canonical sources) - explained | 0/1
EVIDENCE | 9-4-A009-android-overlay | Android | NativeStackingOverlayTest + NativeStackingTest | 2/2
EVIDENCE | 9-4-013-mac-regression | macOS | NativeAccordionAppearanceIntegration | 1478/1478
EVIDENCE | 9-4-013-mac-regression | macOS | NativeAccordionPartsIntegration | 8272/8272
EVIDENCE | 9-4-013-mac-regression | macOS | NativeModalStackIntegration | 149/149
EVIDENCE | 9-4-013-mac-regression | macOS | NativeForcedAppearanceIntegration (red, entry measured stale) - explained | 220/232
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeStackingIntegration | 12/12
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeAccordionFloatingIntegration | 48344/48344
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeAccordionStatesIntegration | 45390/45390
EVIDENCE | 9-4-022-mac-fix-initial | macOS | NativeAccordionReorderIntegration | 628/628
EVIDENCE | 9-4-023-ios-fix-replay | iOS 26.3 | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-023-ios-fix-replay | iOS 26.3 | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-4-023-ios-fix-replay | iOS 26.3 | NativeAccordionFloatingIntegration | 50630/50630
EVIDENCE | 9-4-023-ios-fix-replay | iOS 18.6 | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-023-ios-fix-replay | iOS 18.6 | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-4-023-ios-fix-replay | iOS 18.6 | NativeAccordionFloatingIntegration | 50642/50642
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionAppearanceIntegration | 1478/1478
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionFloatingIntegration | 49016/49016
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionLiftIntegration | 280/280
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionMotionIntegration | 716/716
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionPartsIntegration | 8272/8272
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionPlaceholderIntegration | 368/368
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionRendererIntegration | 570/570
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionReorderIntegration | 628/628
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionScrollingIntegration | 278/278
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionShiftIntegration | 17692/17692
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionStateIntegration | 65/65
EVIDENCE | 9-4-024-mac-regression | macOS | NativeAccordionStatesIntegration | 50050/50050
EVIDENCE | 9-4-024-mac-regression | macOS | NativeBottomSheetMotionIntegration | 16268/16268
EVIDENCE | 9-4-024-mac-regression | macOS | NativeBottomSheetPaintIntegration | 1948/1948
EVIDENCE | 9-4-024-mac-regression | macOS | NativeDialogMotionIntegration | 10183/10183
EVIDENCE | 9-4-024-mac-regression | macOS | NativeDialogPaintIntegration | 2249/2249
EVIDENCE | 9-4-024-mac-regression | macOS | NativeSideSheetMotionIntegration | 8940/8940
EVIDENCE | 9-4-024-mac-regression | macOS | NativeSideSheetPaintIntegration | 3057/3057
EVIDENCE | 9-4-024-mac-regression | macOS | NativeModalStackIntegration | 149/149
EVIDENCE | 9-4-024-mac-regression | macOS | NativeContainerAccessibilityIntegration | 22/22
EVIDENCE | 9-4-024-mac-regression | macOS | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-4-024-mac-regression | macOS | NativeStackingIntegration | 12/12
EVIDENCE | 9-4-024-mac-regression | macOS | NativeStackingOverlayIntegration | 35/35
EVIDENCE | 9-4-024-mac-regression | macOS | NativeSearchPaintIntegration | 7186/7186
EVIDENCE | 9-4-024-mac-regression | macOS | NativeSearchStatesIntegration (2 reduced-motion Escape frames outside envelope, 1/148 each, rtl; search is not an accordion user, timing at load; see note) - explained | 764/766
EVIDENCE | 9-4-024-mac-regression | macOS | NativeColorPickerStatesIntegration | 20950/20950
EVIDENCE | 9-4-024-mac-regression | macOS | NativeDatePickerPaintIntegration | 37183/37183
EVIDENCE | 9-4-024-mac-regression | macOS | NativeDatePickerStatesIntegration | 10417/10417
EVIDENCE | 9-4-024-mac-regression | macOS | NativeTimePickerPaintIntegration | 10726/10726
EVIDENCE | 9-4-024-mac-regression | macOS | NativeTimePickerStatesIntegration | 15551/15551
EVIDENCE | 9-4-A013-android-regression | Android | AWCModalScope users + accordion floating/stacking (18 tests ok; datePickerMatchesChromePaintAndGeometry fails identically on n4-A042 with byte-identical DatePicker sources) - explained | 18/19
EVIDENCE | 9-4-030-ax-accordion | macOS | tools/ax md-accordion (open findings 0, 2 cases) | 2/2
EVIDENCE | 9-4-100-install-overlay | macOS | byte identity canonical vs tested tree s94-tree | 9/9
EVIDENCE | 9-4-031-mac-canonical-check | macOS | NativeStackingOverlayIntegration (canonical) | 35/35
EVIDENCE | 9-4-031-mac-canonical-check | macOS | NativeStackingIntegration (canonical) | 12/12
EVIDENCE | 9-4-031-mac-canonical-check | macOS | NativeAccordionFloatingIntegration (canonical) | 45968/45968
EVIDENCE | 9-4-031-mac-canonical-check | macOS | NativeForcedAppearanceIntegration (canonical) | 232/232
EVIDENCE | 9-4-031-mac-canonical-check | macOS | NativeModalStackIntegration (canonical) | 149/149

## Review Triage Log

