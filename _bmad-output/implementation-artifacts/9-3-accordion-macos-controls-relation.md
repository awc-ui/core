---
title: 'md-accordion on macOS: the header's `controls` relation (s7-8-03)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-3-accordion-macos-controls-relation'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d3 · no Android lane · no simulator'
lab: 'work/s93-lab (create it; private tree work/s93-tree = a copy of canonical; reviewer evidence work/audit/s7-8/out/ax)'
depends_on: ['7-8-recheck-containment']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** tools/ax reports an open `relation` finding for md-accordion on macOS in both cases (`default`, `exclusive`), 3 of 3 runs: the Web header button `controls` its panel, and macOS exposes no linked element. iOS and Android pass because UIKit and Compose have no element relation (the R6-09 convention). There is no accepted expectation.

**Approach:** Map the header's `aria-controls` to the panel's accessibility element on macOS the way md-tab does (`NativeFocusBridge.swift` `accessibilityLinkedUIElements`; NativeTabs.swift near line 1086). The tools/ax compare is the failing test.

## Boundaries & Constraints

**Always:** tools/ax md-accordion compare on Web, macOS, iOS and Android ends with 0 open findings. Accordion paint and states on macOS stay at the s7-8 counts. The rules in project-context.md apply.

**Never:** Do not add a tools/ax expectation for this relation. Do not touch the floating-panel stacking code (story 9-4) or md-stepper (story 5-3 owns its relation findings).

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- row s7-8-03; `work/audit/s7-8/out/ax/md-accordion/report.md`
- `packages/native-ios/Sources/AWCUI/NativeFocusBridge.swift`, `NativeTabs.swift` (the md-tab link), the accordion renderer
- jobs `s7-8-007-ax-lab`, `s7-8-011-ax-accordion-rerun` (how the reviewer ran tools/ax)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce the 2 open findings with tools/ax on a fresh copy of canonical
- [x] Implement the link on macOS in the private tree; tools/ax compare twice with 0 open; accordion paint and states on macOS
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check`; refresh and confirm the md-accordion checkpoint

**Acceptance Criteria:**
- Given tools/ax on md-accordion, when the compare runs twice on macOS after the fix, then it reports 0 open findings and no new expectation was added
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- All tasks done. Fix installed in canonical by main-queue job 9-3-accordion-macos-controls-relation-100-install-controls (dry run, backup, byte identical with work/s93-tree 2/2, canonical builds, rollback not needed).
- tools/ax md-accordion + md-tabs compare: 0 open in 3 tree runs and 2 canonical runs; 14 accordion macOS suites pass on the tree; iOS compile 0 errors; checkpoints refreshed and confirmed (md-accordion, md-tabs), 4177 restarted and probed (200).
- DEFECTS.md s7-8-03 carries the status line `ready for re-check` (9-3, 2026-11-15). The gate-7 reviewer flips the verdict.
- Nothing in flight. Next: coordinator review.

### Notes
- Cause of the open finding: the header bridge had no `controls`. First attempt (002) linked only an AXGroup: no match, because SwiftUI exposes the accordion panel region as the content's AXScrollArea named like the header (003-debug AX dump). The search accepts both roles for the accordion; md-tab keeps AXGroup only.
- No tools/ax expectation was added. iOS (UIKit) and Android have no element relation (R6-09); the anchor compiles to an empty view on UIKit.
- Suite counts that vary between runs (Renderer 566-569, Shift, States, Floating) are frame-sampled counts; all pass fully. Renderer 566 once in 002 (fi-911 also had 566).
- Timing-slot waits of 25-45 min per tools/ax or states run were normal (4 shared slots).

### Evidence
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | tools/ax md-accordion compare run 1 (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | tools/ax md-accordion compare run 2 (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | tools/ax md-tabs compare (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionAppearanceIntegration | 1478/1478
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionPartsIntegration | 8272/8272
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionRendererIntegration | 567/567
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionInitializationIntegration | 100/100
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionPlaceholderIntegration | 368/368
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionScrollingIntegration | 278/278
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionStateIntegration | 65/65
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionMotionIntegration | 716/716
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionReorderIntegration | 628/628
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionLiftIntegration | 280/280
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionShiftIntegration | 16552/16552
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionStatesIntegration | 45178/45178
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeAccordionFloatingIntegration | 44702/44702
EVIDENCE | 9-3-accordion-macos-controls-relation-004-fix-scrollarea | macOS | NativeStackingIntegration | 12/12
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | macOS | tools/ax md-accordion compare, final tree (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | macOS | tools/ax md-tabs compare, final tree (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | macOS | NativeAccordionPartsIntegration | 8272/8272
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | macOS | NativeAccordionRendererIntegration | 567/567
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | macOS | NativeTabsPaintIntegration | 16111/16111
EVIDENCE | 9-3-accordion-macos-controls-relation-005-final-tree | iOS | xcodebuild AWCUI generic iOS Simulator (compile, 0 errors; no simulator run needed: UIKit path unchanged) | 1/1
EVIDENCE | s7-8-A007-ax-android-compare | Android | tools/ax md-accordion compare (earlier session, code unchanged by this story) | 2/2
EVIDENCE | s7-8-A007-ax-android-compare | iOS | tools/ax md-accordion compare (earlier session, code unchanged by this story) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | tools/ax md-accordion compare, canonical run 1 (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | tools/ax md-accordion compare, canonical run 2 (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | tools/ax md-tabs compare, canonical (0 open) | 2/2
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | NativeAccordionPartsIntegration canonical | 8272/8272
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | NativeAccordionRendererIntegration canonical | 568/568
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | NativeAccordionAppearanceIntegration canonical | 1478/1478
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | NativeTabsPaintIntegration canonical | 16111/16111
EVIDENCE | 9-3-accordion-macos-controls-relation-100-install-controls | macOS | NativeTabsStatesIntegration canonical | 137124/137124

## Review Triage Log

