---
title: 'md-accordion Android: items are not registered when the first toggle event of a defaultExpanded initialisation is built; a wrapped item is expanded at connection (s7-12-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-24-accordion-android-registration-before-first-toggle-and-wrapped-items'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n4 · android lane a4 (emulator-5562; the audit 7-2 uses the same lane later, jobs in a lane run one after the other) · no simulator'
lab: 'work/s924-lab (create it; private tree work/s924-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-12: script bin/android.sh, results out/android/adx1-xml and out/android/paint2-xml)'
depends_on: ['7-12-recheck-avatar-list-accordion']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-12 (2026-11-17) found two Android accordion tests that fail on canonical 3 of 3 times and that no dev story had re-run (story 9-3 was macOS only; story 9-4 ran only `NativeAccordionFloatingTest` and the modal and overlay set). Finding s7-12-01 in DEFECTS.md, open and blocking, gates 2 and 5. (a) `NativeAccordionInitializationTest.twentyWebInitializationTracesMatchThroughNativeScopes`: 20 of 80 traces differ (defaults-pass, exclusive-authored-pass, keep-one-pass, exclusive-union-pass and their prevent and stop variants). In the first `mdItemToggle` capture event of a `defaultExpanded` initialisation the native `items` snapshot reads first expanded false index -1 and second expanded false index -1; Chrome reads first expanded true index 0 and second expanded false index 1. So the items are not yet registered and indexed when the event is built. (b) `NativeAccordionDispatchTest.itemsWrappedInAnotherLayoutAreNeverOwnedNotEvenAtConnection` (line 77): in frame 1 the wrapped item `w0` is Expanded, the test expects Collapsed, so the defaultExpanded pass touched an item that is wrapped in another layout. The test files are unchanged since 2026-10-23. `NativeAccordion.kt` and `NativeAccordionFloating.kt` were changed by the install of story 9-4 on 2026-11-16 at 13:23 (overlay entry for the floating panel); the reviewer names that change as the likely cause, not as a proven one. md-accordion stays FAIL at gate 7 until this is fixed.

**Approach:** Reproduce first: run the two test classes alone on your emulator three times on a copy of canonical and keep the XML. Then prove which change introduced the failure: take the sources of `NativeAccordion.kt` and `NativeAccordionFloating.kt` from before the 9-4 install (the rollback copy of its install job, or the lab of story 9-4) into a second private tree and run the same two classes there. If they pass there, the 9-4 change is the cause and the difference between the two versions is the place to read; if they fail there too, look for the older change with the file dates and the install logs. Then name the order with a log in the private tree: for one failing trace print, in order, the registration of each item (id, index, expanded), the defaultExpanded pass and the building of the first `mdItemToggle` event with its `items` snapshot, and compare that order with the Chrome trace of the fixture. Fix the order in the product: an item is registered with its index and expanded value before the first toggle event of the connection pass is built, and an item wrapped in another layout is never owned, also not during the defaultExpanded pass. Keep the overlay entry of story 9-4.

## Boundaries & Constraints

**Always:** The two test classes fail 3 of 3 runs before the change and pass 5 of 5 runs after it; the initialisation test shows 0 differing traces of 80 after it. The rules in project-context.md apply.

**Never:** Do not edit the two tests or their Web traces; they are the contract. Do not undo the overlay entry of story 9-4: `NativeAccordionFloatingTest` stays at 35 of 35 and finding s7-8-04 stays fixed. Do not change the Swift accordion sources. Do not add a delay, a retry or a second composition to make the registration appear earlier.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- s7-12-01 (the last lines of the file) and s7-8-04
- `work/audit/s7-12/bin/android.sh` and `work/audit/s7-12/out/android/adx1-xml/debug/` (how the reviewer ran the two classes; the failing XML)
- the Dev Agent Record of story `9-4` (what the overlay entry changed, the name of its install job and its rollback copy) and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-android/src/main/java/dev/awc/nativeui/NativeAccordion.kt`, `NativeAccordionFloating.kt`, `NativeAccordionItem.kt`, `NativeAccordionState.kt`; the two test classes (find them with `grep -rl NativeAccordionInitializationTest packages apps`)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: the two classes x3 on a copy of canonical; then the same two classes on a tree with the accordion sources from before the 9-4 install; name the change that introduced the failure
- [x] Order log for one failing trace of (a) and for the wrapped item of (b); compare with the Chrome trace; add a KNOWN-CAUSES.md row
- [x] Fix in the private tree; the two classes x5; every Android test class whose name starts with NativeAccordion once (unit and instrumented), `NativeAccordionFloatingTest` 35 of 35, the accordion paint and states suites on Android once
- [x] One main-queue install (dry run, rollback, byte identity); the two classes once on canonical after the install; DEFECTS.md status line `ready for re-check` for s7-12-01; refresh and confirm the md-accordion and md-accordion-item checkpoints

**Acceptance Criteria:**
- Given the two test classes, when they run five times after the change, then every run passes, and the change that introduced the failure is named with a run on the older sources
- Given every Android test class of the accordion family and the accordion paint and states suites, when they run once after the change, then all pass, and `NativeAccordionFloatingTest` is still 35 of 35
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 23:16 UTC: start note; side task md-dialog Android ax)
Start note. One side task on your Android lane, because the re-check 7-12 saw it outside its scope and did not look into it: in its ax compare run (job 7-12-recheck-avatar-list-accordion-015-ax-compare, results under work/audit/s7-12/out/ax) md-dialog on Android shows 7 open. In the same audit the 10 open of md-list came from a stale capture and were 0 after a fresh one. Make a fresh Android ax capture of md-dialog once (tools/ax as the reviewer's bin scripts do), compare, and report the count in the Handover: 0 open = stale capture, add one line to KNOWN-CAUSES.md; more than 0 = write the rows as a new finding into DEFECTS.md (open, for the coordinator to route). Do not fix md-dialog in this story.

## Dev Agent Record

### Current state
- DONE (sessions 1-2, 2026-11-18). Cause: 9-4 movableContentOf attaches item nodes after the connection SideEffect; fix = inline panel when no modal session. Installed by 9-24-100-install-fix (byte identity ok); checkpoints confirmed by 9-24-101-confirm (exit 0, current).
- Verified on canonical: two classes once, NativeStackingOverlayTest, NativeStackingTest, NativeAccordionFloatingTest (9-24-006-stacking-canon).
- md-dialog Android ax: 0 open (stale capture), see notes.
- Next: coordinator re-check of s7-12-01 (DEFECTS line `ready for re-check`). Open risk: accordion inside AWCModalScope still uses movableContentOf (covered by NativeStackingOverlayTest).

### Notes (session 1)
- Cause (measured): the 9-4 install, NativeAccordionFloating.kt `AccordionFloatingLayer` wraps the panel in `movableContentOf`; items' layout nodes are attached after the group's connection SideEffect. Order log (job 9-24-002-order-log, evidence work/s924-lab/out/ord-new-evidence.log vs ord-old-evidence.log): new sources: `register` x2 (marker=false), `effect connected=false direct=[id:null:false ...] groupMarker=null`, `connect children=[id:true:-1, id:false:-1]` (index -1, provisionally owned), toggle with index 1 then 0. Old sources: same registers, `effect` sees `isDirectChildOf=true, marker attached, groupMarker=true`. `direct()` treats null (detached) as direct, so before the first measure every composed item, also a wrapped one, is owned and gets index -1.
- Older sources (9-4 install-backup of NativeAccordion.kt + NativeAccordionFloating.kt, tree work/s924-tree-old): both classes pass 3 of 3. Canonical copy (work/s924-tree): fails 3 of 3 (2 of 3 test methods fail).
- Fix: with no modal session (`session==null`) the panel is composed inline (`panel()`); with a session the movable content is kept (overlay entry of 9-4 unchanged). Residual risk: an accordion inside an AWCModalScope still composes via movableContentOf; record in open items if a test shows it.

EVIDENCE | 9-24-001-repro | android | (rep-new1..3, canonical copy) NativeAccordionInitializationTest+NativeAccordionDispatchTest (red before, explained: expected failure before the fix, 2 of 3 methods fail in 3 of 3 runs) | 1/3
EVIDENCE | 9-24-001-repro | android | (rep-old1..3, sources before 9-4 install) NativeAccordionInitializationTest+NativeAccordionDispatchTest | 3/3
EVIDENCE | 9-24-003-fix-x5 | android | fix1..fix5 each tests 3 failures 0 (initialization 0 of 80 differing) | 5/5
EVIDENCE | 9-24-004-family | android | all 15 NativeAccordion* instrumented classes (incl. NativeAccordionStatesTest 3/3, MotionRender 2/2, Appearance 1/1, Floating 1/1) | 32/32
EVIDENCE | 9-24-004-family | android | unit tests dev.awc.nativeui.NativeAccordion* (:native-ui:testDebugUnitTest) | 38/38
EVIDENCE | 9-24-005-dialog-ax | android | ax md-dialog fresh capture on emulator-5562, compare open findings 0 (macOS pass, iOS pass, Android pass 2 accepted) | 1/1
EVIDENCE | 9-24-006-stacking-canon | android | NativeStackingOverlayTest+NativeStackingTest+NativeAccordionFloatingTest on canonical | 3/3
EVIDENCE | 9-24-006-stacking-canon | android | NativeAccordionInitializationTest+NativeAccordionDispatchTest on canonical, initialization 0 of 80 differing | 3/3
EVIDENCE | 9-24-006-stacking-canon | android | Stacking tests on tested tree | 2/2
EVIDENCE | 9-24-101-confirm | macos | checkpoint confirm md-accordion, md-accordion-item (current) | 2/2
- md-dialog Android ax side task (coordinator note): fresh capture (job 9-24-005-dialog-ax, work/s924-lab/out/ax/md-dialog) shows 0 open findings, so the 7 open of the 7-12 compare run were a stale capture (as md-list). Not a product finding; KNOWN-CAUSES line added at install time.

## Review Triage Log

