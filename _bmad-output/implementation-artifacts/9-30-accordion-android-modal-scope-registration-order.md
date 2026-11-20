---
title: 'md-accordion Android: inside a modal scope (dialog, sheet) the items are still not registered when the first toggle event is built (s7-20-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-30-accordion-android-modal-scope-registration-order'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n4 · android lane a4 (emulator-5562; the audit 7-2 uses the same lane later, jobs in a lane run one after the other) · no simulator'
lab: 'work/s930-lab (create it; private tree work/s930-tree = a copy of canonical; the reviewer's probe is in work/audit/s7-20: script bin/android.sh, results out/modal1.txt to modal3.txt and out/android/modal1-xml, the probe test copies are in the snapshot work/audit/s7-20-tree; the lab of story 9-24 is work/s924-lab)'
depends_on: ['7-20-recheck-accordion-2']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-20 (2026-11-18) kept md-accordion at FAIL with finding s7-20-01 (DEFECTS.md, open and blocking, gates 2 and 5, Android). Story 9-24 fixed s7-12-01 outside a modal scope: the two test classes pass there (5 of 5 and 3 of 3 in the reviewer's jobs A001 and A002). But `AccordionFloatingLayer` still composes the panel through `movableContentOf` whenever `LocalAWCModalSession` is not null, that is inside every `AWCModalScope` (dialog, bottom sheet, side sheet). The reviewer copied `NativeAccordionInitializationTest` and `NativeAccordionDispatchTest`, replaced the Box wrapper by `AWCModalScope`, and ran them three times (job 7-20-recheck-accordion-2-A003-modal-scope-probe, emulator-5558): both fail 3 of 3. `twentyWebInitializationTracesMatchThroughNativeScopes`: 20 of 80 traces differ; in the first `mdItemToggle` capture event of a defaultExpanded initialisation the native items read first expanded false index -1 and second expanded false index -1, Chrome reads first expanded true index 0 and second index 1. `itemsWrappedInAnotherLayoutAreNeverOwnedNotEvenAtConnection` line 77: the wrapped item w0 is Expanded, expected Collapsed. This is the signature of s7-12-01 (KNOWN-CAUSES: movableContentOf attaches the item nodes after the connection SideEffect). An accordion inside a dialog or a sheet is ordinary use, so md-accordion stays FAIL at gate 7 until this is fixed and guarded by product tests.

**Approach:** Reproduce first: copy the reviewer's two probe classes from the snapshot into a copy of canonical and run them three times on your emulator; keep the XML. Read in the Dev Agent Record of story 9-24 how the path outside a modal scope guarantees the order, and why the modal path was left on `movableContentOf` (story 9-4 put the floating panel into the overlay entry of the modal session). Log the order for one failing trace inside the modal scope: registration of each item (id, index, expanded), the defaultExpanded pass, the building of the first `mdItemToggle` event with its items. Then give the modal path the same guarantee: an item is registered with its index and expanded value before the first toggle event of the connection pass is built, and an item wrapped in another layout is never owned, also not during the defaultExpanded pass. Two ways the reviewer names: compose the panel inline and let the modal entry host the already composed content, or register the item markers inside the movable content before the connection effect runs. Pick the one that keeps the overlay behaviour of story 9-4 and say why. Then make the guard permanent: add the modal-scope variants of both classes to the NativeAccordion test family, and one test that puts a defaultExpanded accordion into a real dialog and into a real bottom sheet and reads the first `mdItemToggle` (index 0 and 1, first expanded true).

## Boundaries & Constraints

**Always:** The two modal-scope classes fail 3 of 3 runs before the change and pass 5 of 5 after it with 0 differing traces of 80; with the fix reverted in a second private tree the new product tests fail. The rules in project-context.md apply.

**Never:** Do not edit the two original tests or their Web traces; they are the contract. Do not undo the overlay entry of story 9-4 or the fix of story 9-24: the original two classes still pass and `NativeAccordionFloatingTest` still passes with 0 fails (write its check count; the last audit counted 16466 checks). Do not change the Swift accordion sources. Do not add a delay, a retry or a second composition to make the registration appear earlier.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- s7-20-01, s7-12-01 and s7-8-04
- `work/audit/s7-20/bin/android.sh`, `work/audit/s7-20/out/modal1.txt` and the probe test copies in `work/audit/s7-20-tree` (find them with `grep -rl AWCModalScope work/audit/s7-20-tree/packages/native-android/src --include=*Accordion*`)
- the Dev Agent Records of story `9-24` (cause, fix, install job) and story `9-4` (overlay entry); `work/claude-runner/KNOWN-CAUSES.md` (the movableContentOf row)
- `packages/native-android/src/main/java/dev/awc/nativeui/NativeAccordion.kt`, `NativeAccordionFloating.kt`, `NativeAccordionItem.kt`, `NativeAccordionState.kt`, `AWCModalScope.kt`; the accordion test classes

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: the two modal-scope probe classes x3 on a copy of canonical; the order log for one failing trace and for the wrapped item
- [x] Fix in the private tree; the two modal-scope classes x5; the two original classes x3; every Android test class whose name starts with NativeAccordion once (unit and instrumented); the accordion paint and states suites on Android once
- [x] The Android dialog, bottom-sheet and side-sheet test classes once (the modal and overlay set of story 9-4), because the modal entry is shared
- [x] Product tests: the modal-scope variants of both classes and the real dialog and real bottom-sheet test in the NativeAccordion family; with the fix reverted in a second private tree they fail
- [x] One main-queue install (dry run, rollback, byte identity); the new and the original classes once on canonical after the install; DEFECTS.md status line `ready for re-check` for s7-20-01; KNOWN-CAUSES.md row; refresh and confirm the md-accordion and md-accordion-item checkpoints

**Acceptance Criteria:**
- Given the two modal-scope classes, when they run five times after the change, then every run passes and the initialisation class shows 0 differing traces of 80; before the change they fail 3 of 3
- Given a defaultExpanded accordion inside a real dialog and inside a real bottom sheet, when the first `mdItemToggle` event is read, then its items carry index 0 and 1 and the first is expanded; the test is part of the product test family and fails with the fix reverted
- Given every Android test class of the accordion family, the accordion paint and states suites and the dialog, bottom-sheet and side-sheet classes, when they run once after the change, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- All tasks done (session 3, 2026-11-18). Fix installed on canonical by 9-30-100-install-fix (dry run ok, byte identity 4/4). Canonical re-run 9-30-004-canon: 13/13 tests, floating 16466 checks 0 failures, initialization and modal-initialization 0 of 80 differing. Checkpoints md-accordion and md-accordion-item confirmed by 9-30-101-confirm (exit 0). DEFECTS.md s7-20-01 `ready for re-check` and KNOWN-CAUSES row 9-30 written.
- Next: coordinator routes s7-20-01 to the gate-7 re-check (audit 7-2, lane a4). Nothing left for this story.

### Evidence (so far)
EVIDENCE | 9-30-001-repro | android | (old sources) NativeAccordionModalInitializationTest+ModalDispatchTest+ModalHostTest, expected red before the fix, 2 of 5 methods fail in 3 of 3 runs | 3/3
EVIDENCE | 9-30-002-fix | android | (old sources) NativeAccordionModalHostTest page-in-scope methods red 2 of 2 runs (hostpre1, hostpre2) | 2/2
EVIDENCE | 9-30-002-fix | android | fix1..fix5 NativeAccordionModal{Initialization,Dispatch,Host}Test each 7 tests 0 failures (modal-initialization 0 of 80 differing) | 5/5
EVIDENCE | 9-30-002-fix | android | orig1..orig3 NativeAccordionInitializationTest+NativeAccordionDispatchTest 3 tests 0 failures | 3/3
EVIDENCE | 9-30-003-family | android | 18 NativeAccordion* instrumented classes (incl. 3 modal classes, Floating, States, Appearance) | 39/39
EVIDENCE | 9-30-003-family | android | NativeAccordion unit tests | 38/38
EVIDENCE | 9-30-003-family | android | dialog, bottom-sheet, side-sheet, ModalStack, Stacking classes | 9/9
EVIDENCE | 9-30-004-canon | android | canonical after install: 3 modal classes, original Initialization+Dispatch, Floating (16466 checks 0 failures), others | 13/13
EVIDENCE | 9-30-100-install-fix | macos | canonical install byte identity with tested tree | 4/4
EVIDENCE | 9-30-101-confirm | macos | checkpoint confirm md-accordion, md-accordion-item (exit 0) | 1/1

## Review Triage Log

