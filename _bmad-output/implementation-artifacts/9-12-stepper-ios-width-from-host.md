---
title: 'md-stepper: the iOS layout width comes from the host, not from the screen (s7-5-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-12-stepper-ios-width-from-host'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane fa · android lane a1 (emulator-5556) · simulators AWC-fa (iPhone 26.3), AWC-fa-ipad and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s912-lab (create it; private tree work/s912-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-5)'
depends_on: ['7-5-recheck-slider-rating-stepper']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check s7-5 (2026-11-16) left md-stepper (with md-step) at FAIL. Finding s7-5-01: `NativeFaViewsIntegration` on the iPhone 26.3 simulator passes 406 of 494. The 88 failing cases are the horizontal md-stepper paint cases, the same in 2 of 2 runs, while iPad 26.3, macOS and Android pass. Cause named by the reviewer: `Stepper/NativeStepper.swift` (`input(now:)`) sets `viewportWidth = UIScreen.main.bounds.width` on iOS (402 pt on the iPhone; macOS uses a fixed 1200), so on a phone-width screen the mobile layout replaces the horizontal list that the 820 px Chrome oracle shows. `NativeStepperIntegration` uses its own width and does not see it. Story 5-3 reported the views fixture at 494/494 on iPhone; the reviewer's runs on iPhone 17 Pro 26.3 do not confirm that, and the views fixture was not run on iOS 18.6. The mobile layout itself has no Chrome comparison on any platform.

**Approach:** First settle the meaning from the Web source: read how md-stepper chooses the mobile layout (a viewport media query, a container query or a measured width) and write it down with file and line. The native value must mean the same thing. Then make the width an input instead of a screen read: by default the hosting width (in an app, the width of the window scene), and a value that the fixture sets to the oracle viewport, as macOS does today. Add Chrome oracle cases for the mobile layout at a phone viewport (390 px) with the fixture generator of the views suite, and compare them on iPhone, iPad, macOS and Android, so that the mobile layout is checked on every platform and not only where the screen happens to be narrow. Check how Android chooses the layout and align it with the same meaning if it differs.

## Boundaries & Constraints

**Always:** `NativeFaViewsIntegration` on iPhone 26.3 fails the 88 horizontal stepper cases before the change and passes every case after it. The new phone-viewport cases fail when the mobile layout is forced off. The rules in project-context.md apply.

**Never:** Do not skip or filter the horizontal cases on the phone. Do not hard-code a width for the test only: the fixture sets the same input that an app would set. Do not change slider or rating code. Do not widen a tolerance.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- s7-5-01 (and s7-5-03 for the probe expectation)
- `work/audit/s7-5/ios-iphone26/NativeFaViewsIntegration-console.log`, `work/claude-runner/done/s7-5-003-ios.sh` and `s7-5-006-iphone-views-rerun.sh` (the reviewer's runs)
- `packages/native-ios/Sources/AWCUI/Stepper/NativeStepper.swift` (the line with `UIScreen.main.bounds.width`), the Android stepper sources and the Web source of md-stepper (find them with `ls -R | grep -i stepper`)
- the Dev Agent Record of story `5-3` (jobs 045 and 049: how the suites are run and on which simulators)

## Tasks & Acceptance

**Execution:**
- [x] The Web meaning of the mobile breakpoint, with file and line; how Swift and Android choose the layout today
- [x] Reproduce on iPhone 26.3 (406/494); the width as an input (host or scene width by default, set by the fixture); iPhone 26.3 twice, iPad 26.3 and iOS 18.6 once: every case passes
- [x] Chrome oracle cases at a 390 px viewport for the mobile layout; compare on iPhone, iPad, macOS and Android; a mutation run that shows they fail with the mobile layout off
- [x] `NativeStepperIntegration` and the slider and rating cases of the views fixture on every platform (no change expected); tools/ax for md-stepper and md-step
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check` for s7-5-01; the width meaning in `docs/native-parity/md-stepper.md`; refresh and confirm the md-stepper checkpoint

**Acceptance Criteria:**
- Given the iPhone 26.3 simulator, when `NativeFaViewsIntegration` runs twice, then every case passes, and the same run failed 88 cases before the change
- Given the mobile layout, when the phone-viewport oracle cases run on iPhone, iPad, macOS and Android, then every case passes, and they fail in the mutation run
- Given the docs, when a reader opens md-stepper.md, then the width meaning and its Web source line are stated
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE, status review. Web meaning: md-step.css:608 `@media (max-width: 599px)` = layout viewport; native input `awcViewportWidth` (iOS default window-scene width, macOS 1200), fixtures set the case viewport.
- Evidence: macOS 004, iOS 005 (iPhone 26.3 x2, iPad 26.3, iOS 18.6: 506/506; was 406/494), Android A003 (503/503; mutation fails 10 compact cases on macOS and Android), ax 006 (md-stepper 4 open pre-existing relation findings vs 14 baseline; md-step 0).
- Android A001/A002 compact failures were a test-harness clip issue (host 390 in 374 clip), fixed in A003; Android product code unchanged.
- Canonical install `...-100-install` OK (byte identity, DEFECTS s7-5-01 `ready for re-check`, checkpoint refreshed and confirmed).
- Next: reviewer re-check of s7-5-01 (gate 7).

### Evidence
EVIDENCE | 9-12-stepper-ios-width-from-host-006-ax | macOS | tools/ax md-stepper,md-step (open findings: 4 and 0, baseline 14 and 0) | 1/1
EVIDENCE | 9-12-stepper-ios-width-from-host-100-install | macOS | install byte identity and checkpoint confirm | 1/1
EVIDENCE | 9-12-stepper-ios-width-from-host-004-macos | macOS | NativeFaViewsIntegration | 506/506
EVIDENCE | 9-12-stepper-ios-width-from-host-004-macos | macOS | NativeFaViewsIntegration mutation compact off (10 compact cases fail as required) (explained: expected failure) | 496/506
EVIDENCE | 9-12-stepper-ios-width-from-host-004-macos | macOS | NativeStepperIntegration | 222/222
EVIDENCE | 9-12-stepper-ios-width-from-host-004-macos | macOS | NativeSliderRatingIntegration | 444/444
EVIDENCE | 9-12-stepper-ios-width-from-host-005-ios-compact | iOS iPhone 26.3 run 1 | NativeFaViewsIntegration | 506/506
EVIDENCE | 9-12-stepper-ios-width-from-host-005-ios-compact | iOS iPhone 26.3 run 2 | NativeFaViewsIntegration | 506/506
EVIDENCE | 9-12-stepper-ios-width-from-host-005-ios-compact | iOS iPad 26.3 | NativeFaViewsIntegration | 506/506
EVIDENCE | 9-12-stepper-ios-width-from-host-005-ios-compact | iOS iPhone iOS 18.6 | NativeFaViewsIntegration | 506/506
EVIDENCE | 9-12-stepper-ios-width-from-host-A003-android-topstart | Android emulator-5556 | FaViewsParityTest | 503/503
EVIDENCE | 9-12-stepper-ios-width-from-host-A003-android-topstart | Android emulator-5556 | md-stepper web-paint-compact.json | 12/12
EVIDENCE | 9-12-stepper-ios-width-from-host-A003-android-topstart | Android emulator-5556 | StepperViewsTest | 93/93
EVIDENCE | 9-12-stepper-ios-width-from-host-A003-android-topstart | Android emulator-5556 | FaViewsParityTest mutation viewport fixed 1200 (10 compact cases fail as required) (explained: expected failure) | 493/503
EVIDENCE | 9-12-stepper-ios-width-from-host-001-snapshot-baseline | iOS iPhone 26.3 (before the change; 88 stepper cases fail) | NativeFaViewsIntegration (explained: expected failure) | 406/494
EVIDENCE | 9-12-stepper-ios-width-from-host-003-ios-fixed | iOS iPhone 26.3 | NativeStepperIntegration | 222/222
EVIDENCE | 9-12-stepper-ios-width-from-host-003-ios-fixed | iOS iPhone 26.3 | NativeSliderRatingIntegration | 444/444

## Review Triage Log

