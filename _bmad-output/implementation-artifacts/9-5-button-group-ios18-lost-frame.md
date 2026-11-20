---
title: 'md-button-group on iOS 18.6: width sample across a lost display frame (R1-17)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-5-button-group-ios18-lost-frame'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane fi2 · no Android lane (Android re-run on lane a1, emulator-5556) · simulators AWC-fi2 and AWC-fi2-ios18'
lab: 'work/s95-lab (create it; private tree work/s95-tree = a copy of canonical; reviewer evidence work/audit/s7-7/ios)'
depends_on: ['7-7-recheck-button-family']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-7 re-check s7-7 failed md-button-group. In 1 of 5 family-states runs on iOS 18.6, `bg-keyboard-standard/key3-Enter` box at +62 ms was 221.90 wide against Chrome 223.92-225.05 (tolerance 1.5). The native frame id stayed at 9989 for the samples at +43, +53 and +63 ms, so one display frame was lost; the width reaches 224.37 at +75 ms. The three iOS 26.3 runs and the four other 18.6 runs pass. The host load was 122 during the failing run.

**Approach:** The reviewer's suggested fix: time the group's width from the press, independent of the display tick (as `AWCNativeFabExtendMotion` does), or bracket the sample across a lost display frame as for click2 (R1-14). First build a reproducer that drops one display frame at that phase on purpose, so the fix has a failing test.

## Boundaries & Constraints

**Always:** The lost-frame reproducer fails before the fix and passes after. Family states pass on iOS 18.6 x5 and iOS 26.3 x3 after the fix; macOS family states and Android stay at the s7-7 counts. The rules in project-context.md apply.

**Never:** Do not widen the tolerance. Do not undo the `minimumInterval` fix of fx-128. Do not touch story 2-2's files (NativeButtonLoading, NativeStatusDot, NativeSkeleton, NativeMeter, NativeLoadingIndicator).

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- R1-17, and R1-14 and R1-16 for the bracket pattern
- `work/audit/s7-7/ios/console-g7s77-o-familystates-1.log` lines 7-8; re-check scripts in `work/audit/s7-7`
- `packages/native-ios/Sources/AWCUI/NativeButtonGroup.swift`, `AWCNativeFabExtendMotion`
- `work/claude-runner/KNOWN-CAUSES.md` rows 1 and 13

## Tasks & Acceptance

**Execution:**
- [x] Reproducer: drop one display frame at key3-Enter between +43 and +63 ms; show the check fails on canonical
- [x] Fix in the private tree (press-timed width or bracketed sample; state which and why)
- [x] iOS 18.6 family states x5, iOS 26.3 x3, macOS family paint and states, Android family states
- [x] Docs: correct the stale Status lines of md-button-group.md, md-fab.md, md-icon-button.md, md-split-button.md and md-fab-menu.md (R1-09)
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status lines; refresh and confirm the md-button-group checkpoint

**Acceptance Criteria:**
- Given a display frame lost at the key3-Enter phase, when the family states suite samples the group width, then the check passes, and it failed on canonical with the same lost frame
- Given the fix, when family states run five times on iOS 18.6 and three times on iOS 26.3, then every run passes
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Status review (session 1, 2026-11-15). All tasks done. No jobs in flight.
- Installed: main-queue 9-5-button-group-ios18-lost-frame-100-install (dry run, rollback, byte identity of the test file and 5 docs with work/s95-tree, DEFECTS.md lines for R1-17 and R1-09, checkpoint refreshed); 9-5-...-101-checkpoint-confirm: md-button-group checkpoint current.
- Installed test file sha256 be6ceabb...6218; the iOS final runs 008/009 and macOS 007 ran on the same tree content (only later edits: none).
- Open for the reviewer: gate-7 re-check of R1-17 (DEFECTS.md says "Needs the reviewer's re-check"); AUDIT.md row untouched (coordinator/reviewer own the verdict).
- Note: check counts vary per run (iOS 26.3 26.0k-28.1k, 18.6 27.2k-28.7k, macOS 28517 vs 29186 in s7-7) because the per-sample box checks depend on the number of samples taken; all runs have 0 failures.
- Android was not re-run after the install; Android code is untouched (A001 ran on the s95-tree copy: same counts as s7-7, 18241/18241).

### Decisions
- Cause: not the product. A display tick lost for 32 ms leaves the group's box at the previous frame for samples read before the sampler can know about the stall (it detects a stall only 1.5 frames after the last tick). Chrome shows the same stale frame there. R1-17 sample +62 ms was read 19 ms after the last tick.
- Fix chosen: bracket across the lost frame in the test (family-states sampler): when the display ticks again after a gap over 1.5 frames, the boxes read since the previous tick get the same compare-back-to-the-stall rule (hold = gap, max 50 ms) as boxes read later in the stall (R1-14 pattern). Press-timed width as in AWCNativeFabExtendMotion was not chosen: the widths come from the SwiftUI frame that is drawn, a lost display frame draws nothing in either design. Tolerance (1.5) untouched, minimumInterval nil untouched, no product file touched.
- Reproducer: AWC_FAMILY_STATES_DROP_FRAME=<case>/<phase>:<from ms>:<ms> (box and display frame kept for the stretch, last tick counted as just seen), AWC_FAMILY_STATES_STALL_LATE=0 = old behaviour.

### Evidence
EVIDENCE | 9-5-button-group-ios18-lost-frame-005b-repro4-ios18 | iOS 18.6 | superseded drop-at-tick reproducer (passes on old behaviour, not a valid reproducer) | 733/733
EVIDENCE | 9-5-button-group-ios18-lost-frame-006b-repro5-ios18 | iOS 18.6 | lost-frame reproducer, fix on (bg-keyboard-standard) | 683/683
EVIDENCE | 9-5-button-group-ios18-lost-frame-006b-repro5-ios18 | iOS 18.6 | lost-frame reproducer, old behaviour, expected FAIL: the one failure is the reproduced R1-17 box at +61 ms (explained) | 681/682
EVIDENCE | 9-5-button-group-ios18-lost-frame-005-ios18-family-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run 1 | 28265/28265
EVIDENCE | 9-5-button-group-ios18-lost-frame-005-ios18-family-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run 2 | 28410/28410
EVIDENCE | 9-5-button-group-ios18-lost-frame-005-ios18-family-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run 3 | 28531/28531
EVIDENCE | 9-5-button-group-ios18-lost-frame-005-ios18-family-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run 4 | 28358/28358
EVIDENCE | 9-5-button-group-ios18-lost-frame-005-ios18-family-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run 5 | 28271/28271
EVIDENCE | 9-5-button-group-ios18-lost-frame-006-ios26-family-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration run 1 | 27594/27594
EVIDENCE | 9-5-button-group-ios18-lost-frame-006-ios26-family-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration run 2 | 26473/26473
EVIDENCE | 9-5-button-group-ios18-lost-frame-006-ios26-family-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration run 3 | 26729/26729
EVIDENCE | 9-5-button-group-ios18-lost-frame-A001-android | Android | NativeButtonFamilyStatesTest (button-family-states checks) | 18241/18241
EVIDENCE | 9-5-button-group-ios18-lost-frame-A001-android | Android | device tests of the button family | 133/133
EVIDENCE | 9-5-button-group-ios18-lost-frame-A001-android | Android | native-android unit tests | 195/195
EVIDENCE | 9-5-button-group-ios18-lost-frame-007-macos | macOS | NativeButtonFamilyPaintIntegration | 974/974
EVIDENCE | 9-5-button-group-ios18-lost-frame-007-macos | macOS | NativeButtonGroupViewIntegration | 87/87
EVIDENCE | 9-5-button-group-ios18-lost-frame-008-ios18-final-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration final tree run 1 | 28411/28411
EVIDENCE | 9-5-button-group-ios18-lost-frame-008-ios18-final-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration final tree run 2 | 27685/27685
EVIDENCE | 9-5-button-group-ios18-lost-frame-008-ios18-final-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration final tree run 3 | 27283/27283
EVIDENCE | 9-5-button-group-ios18-lost-frame-008-ios18-final-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration final tree run 4 | 28717/28717
EVIDENCE | 9-5-button-group-ios18-lost-frame-008-ios18-final-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration final tree run 5 | 27612/27612
EVIDENCE | 9-5-button-group-ios18-lost-frame-009-ios26-final-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration final tree run 1 | 26716/26716
EVIDENCE | 9-5-button-group-ios18-lost-frame-009-ios26-final-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration final tree run 2 | 26593/26593
EVIDENCE | 9-5-button-group-ios18-lost-frame-009-ios26-final-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration final tree run 3 | 28063/28063
EVIDENCE | 9-5-button-group-ios18-lost-frame-007-macos | macOS | NativeButtonFamilyStatesIntegration | 28517/28517

### Evidence (install and checkpoint)
- 9-5-button-group-ios18-lost-frame-100-install exit 0: dry run ok, byte identity ok, DEFECTS lines added, checkpoint refreshed.
- 9-5-button-group-ios18-lost-frame-101-checkpoint-confirm exit 0: md-button-group verdict current, stale components none.
- Work files: work/s95-lab (patch-lostframe.py is the first version of the test patch; the final test is the installed file; docs-status.py; install-100.sh; ios/ and swift/ and android/ logs).

## Review Triage Log

