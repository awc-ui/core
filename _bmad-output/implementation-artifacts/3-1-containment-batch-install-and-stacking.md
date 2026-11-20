---
title: 'Containment: land batch 3 and window-level stacking'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '3-1-containment-batch-install-and-stacking'
epic: 3
model: 'sonnet'
wave: 1
lanes: 'mac lane d3 · android lane a5 (emulator-5564) · simulator AWC-d3'
lab: 'work/d3-lab (install2.sh, install3.sh, PROGRESS.md)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Most r3 findings and R4-03 are fixed in d3's tree but some are marked FIXED* because their canonical install (batch 3, including the Web fixes r3-25 and r3-26) has not run. r3-19 (floating accordion panel and dragged card stack only among siblings) is designed but not finished.

**Approach:** Finish the batch-3 rehearsal and install. Then implement r3-19 in the order d3 planned: mechanism 1 with tests on both platforms, then mechanism 2.

## Boundaries & Constraints

**Always:** Keep `AWCHiddenHost` root behaviour (R2-D11). Stacked content keeps its Tab order, accessibility order and state. The rules in project-context.md apply.

**Never:** Do not reproduce the Web stale-tab-stop bug natively; fix it in the Web source test-first (r3-25).

</intent-contract>

## Code Map

- `work/d3-lab/PROGRESS.md` -- batch status and the r3-19 design (mechanism 1 and 2, test names NativeStackingIntegration / NativeStackingTest)
- `work/d3-lab/install2.sh`, `install3.sh` -- install chains with backup and rollback
- `work/claude-runner/done/d3-06*.log`, `d3-A01*.log` -- rehearsal results
- `work/audit/DEFECTS.md` -- r3 status table (FIXED* rows)

## Tasks & Acceptance

**Execution:**
- [x] Read the rehearsal results; make the batch-3 dry run clean on a fresh canonical copy
- [x] Queue the batch-3 install in the main queue; verify paint, states and live hosts for the six components on canonical; core dist rebuilt for the Web fixes
- [x] r3-19 mechanism 1 with NativeStackingIntegration (SwiftUI) and NativeStackingTest (Compose); regression: accordion floating, accordion states, card lifecycle
- [x] r3-19 mechanism 2, same tests extended; install through the main queue -- replaced by the exception proposal (coordinator decision 2026-11-15; install `3-1-016-install-r3-19-exception-docs`, text in the accordion doc and under r3-19 in DEFECTS.md; gate-7 story 7-8 accepts or rejects)
- [x] Update DEFECTS.md (r3-19, r3-24, r3-25, r3-26, R4-03 and every FIXED* row), docs, checkpoints

**Acceptance Criteria:**
- Given a floating accordion panel or a dragged card inside nested app containers, when it overlaps content outside its parent, then it paints above it as in Chrome on SwiftUI and Compose
- Given the batch-3 install, when the r3 suites run on canonical, then every count equals the rehearsal's
- Given the DEFECTS.md r3 table, when read after the story, then no row is FIXED* and each FIXED row cites an installed job
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.
- Lane a5 runs again and started `3-1-A005-triage-three` at 15:50 UTC: read its result first.
- If the three Android failures reproduce on plain canonical, they are not this story's. Record each in `work/audit/DEFECTS.md` with the evidence path and route it: `NativeAppBarStatesTest` to story 6-4, `NativeDatePickerPaintTest` `hook-year-block-size` to story 1-5, `NativeMultiSelectPaintTest` ConcurrentModificationException to story 6-1. Do not fix them here.
- `NativeTableStatesIntegration` `tb-sort-rtl` belongs to story 4-2; keep it out of the install's fixture list, as you proposed.
- Then: the batch-3 install through the main queue, byte identity, checkpoints, `update-defects-batch3.py`, and r3-19 mechanism 2.

### Coordinator note (2026-11-15 09:30 UTC)

- Batch 3 is installed and verified. Three things are left before `review`:
- 1. iOS card lifecycle `authored-keyboard` fails 31/32 on canonical (`3-1-010-canonical-ios`; also fi-245, fi-505, fi-915). md-card is this epic's component and nobody else owns the failure: find the cause and fix it test-first, or show with evidence that it is a harness problem.
- 2. Android `NativeListStatesTest.listInteractionsMatchChrome` failed 1 of 175283 once (caret sample, `3-1-A006`). Find the cause; limit 4 Android job iterations. If it stays unexplained, leave it as an open finding in DEFECTS.md with the captured frames.
- 3. r3-19 mechanism 2 (viewport layer). Decision: do not build it in this story. Write a complete exception record proposal for the residuals, as AUDIT.md's Exception policy requires (what differs, why, the user-visible effect, evidence, the alternative considered and its cost), in the accordion doc and under r3-19 in DEFECTS.md. Tick the task with the words `replaced by the exception proposal`. The gate-7 reviewer of story 7-8 accepts or rejects it; if rejected, mechanism 2 becomes its own story.

## Dev Agent Record

### 2026-11-15 (agent 4, session 1 of the second round) - handover items 1-3
- Item 1 (iOS `authored-keyboard`): cause found, it is a test timing defect, not a product defect. Debug copy of the fixture (`d3-lab/dbg/Tests/NativeCardLifecycleDebug.swift`, job `3-1-013-ios-card-keyboard-dbg`, lane d3, exit 0): the field becomes first responder (`makeFirstResponder=true`), the keys reach it, but the text appears in the SwiftUI binding late: after the space `state.text` is "" and after a further 0.3 s pump it is " a" (and " ab" after a third key). The fixture checks `state.text` 0.05 s after the second key. Fix (test, wait up to 1 s for the binding; expected text unchanged): `d3-lab/edit-card-keyboard-wait.py`, main-queue install `3-1-014-install-card-keyboard-wait` (dry run, backup, macOS card lifecycle through test-native-views.sh, rollback). Results: install `3-1-014-install-card-keyboard-wait` exit 0 (dry run, backup, macOS card lifecycle 32/32, byte identical with the dry-run copy); iOS 26.3 (AWC-d3) `3-1-018-ios-card-lifecycle` run 1 32/32, run 2 32/32 (`3-1-015` exited 5 because it started before the install). DEFECTS.md status line: `3-1-019-install-defects-cardkb` (queued last; if absent, the line is only missing there).
- Item 2 (Android list states 1 of 175283): reading `NativeListStatesTest.kt`: time is the Compose manual main clock, so a late sample is not wall-clock jitter; the window is Chrome's own samples at -34..+40 ms, then -50..+56 ms. Not reproduced in 3 isolated runs (`3-1-A007`). Job `3-1-A008-liststates-underload` (lane a5): 3 runs under 4 busy loops started and killed by the job. Iterations used: A006, A007, A008 (limit 4).
- Item 2 result: `3-1-A008-liststates-underload` (lane a5, chain tree, 4 busy loops): run 1 FAIL (4 of 175253, drag handle 0.756/0.676/0.627 vs Chrome 1.0), run 2 ok, run 3 FAIL (3 of 175286, expand panel opacity 0.764 and caret 95.7 vs Chrome 0..0.665 / 0..57). `3-1-A009-liststates-underload-base` (plain pre-chain canonical copy d3-base, same load): 3 of 3 FAIL with the same expand samples. So the class is load-sensitive and independent of batch 3; only time-aligned transition samples fail, never paint or end states; cause below that unproven. Four iterations used (A006-A009). Finding text: `d3-lab/edit-defects-liststates.py`, install `3-1-017-install-defects-liststates` (main queue), owner md-list.
- Item 3 (r3-19 mechanism 2): replaced by the exception proposal. Text `d3-lab/exception-r3-19.md`; install `3-1-016-install-r3-19-exception-docs` writes it into `docs/native-parity/md-accordion-swift-renderer.md` ("Document stacking") and under r3-19 in `work/audit/DEFECTS.md`.
- Main queue was busy with story 1-5's install for more than 25 minutes (3-1-014 and 3-1-016 waiting at that time).

### 2026-11-14 (agent 3, fresh session) - batch 3 INSTALLED and verified; BLOCKED only on r3-19 mechanism 2
- Triage `3-1-A005-triage-three` (a5): AppBarStates passes on d3-fresh and fails on plain canonical d3-base (flaky, story 6-4); DatePickerPaint `hook-year-block-size` fails on both (story 1-5); MultiSelectPaint passes on both (intermittent CME, story 6-1). None from the chain. Recorded and routed in `work/audit/DEFECTS.md` (2026-11-14 section).
- Install attempt 1 `3-1-004-install-batch3` (main queue): rolled back cleanly on NativeTablePaintIntegration (RTL flat-pixel cases). `3-1-006-table-paint-canonical` (plain canonical, d3 lane): 7394/7397 with other failing cases, so it is pre-existing and not the chain's; routed to table (story 4-2) in DEFECTS.md.
- Install attempt 2 `3-1-007-install-batch3` (main queue, exit 0, backup `d3-lab/backup3-1114-1914`): fixture list without NativeTablePaintIntegration. Web spec 185/185, e2e md-list 28/28 and md-list-item 12/12, core dist rebuilt, Chrome oracles on the installed dist equal fixtures. macOS: stacking 12/12, list roving 198/198, methods 31/31, parts 285/285, card lifecycle 32/32, accordion floating 47648/47648, dialog paint 2249/2249, modal stack 149/149, cursor/hidden 56/56, container AX 22/22, toolbar paint 8416/8416. Gradle compile + installDebug on emulator-5554, playground rebuilt, live list/card/accordion ok, 4177 server restarted (/ and both status probes 200), studio 878 pass / 0 fail.
- Byte identity: 31 of 33 installed files are identical to the rehearsed tree d3-fresh. The two differing files are generated `NativeSupport.json` and `support.json` (compiler output; canonical carries other stories' entries, e.g. toolbar). Source files byte-identical.
- Android on canonical `3-1-A006-canonical-verify` (a5/emulator-5564): 49 classes (accordion x15, card x4, list x6, stacking, 3 live-host): 48 ok, 1 FAIL: `NativeListStatesTest.listInteractionsMatchChrome` 1 of 175283 (caret sample). `3-1-A007-liststates-rerun`: same class 3/3 ok. Intermittent, cause not proven; recorded in DEFECTS.md. Rehearsal `3-1-A004`: 316 tests, 3 failures, all triaged as not ours.
- iOS 26.3 (AWC-d3) on canonical: `3-1-010-canonical-ios`: stacking 11/11, list roving 198/198, card lifecycle 31/32 (`authored-keyboard`, identical to fi-245/fi-505/fi-915; pre-existing). Note: `3-1-008`/`009` failed to launch because run-fixture.sh needs its own `AWC_IOS_STAGE` (use /tmp/awc-ios-d3/stage) and `bash` not exec.
- DEFECTS.md updated by `d3-lab/update-defects-batch3.py` (backup `d3-lab/DEFECTS.before-batch3.bak`): r3-19, r3-24, r3-25, r3-26, R4-03 rows cite installed job `3-1-007-install-batch3`; no FIXED* rows remain in the r3 table. Checkpoints: `3-1-011-checkpoints` refreshed 24 and confirmed md-list, md-accordion, md-card (all current except md-accordion/laboratory, which was always unpinned).
- NOT DONE: r3-19 mechanism 2 (viewport layer: floating accordion panel published as an entry of the `AWCModalScope` overlay with a document-order placeholder, macOS accessibility re-parenting, Compose `movableContentOf` with a focus-group placeholder; design in `d3-lab/PROGRESS.md` "r3-19 design"). It rewires the modal scope, preferences, focus and macOS AX on both platforms and needs its own failing-first tests; I did not start it. The three r3-19 paint criteria are met by mechanism 1 (installed); the residuals are listed in DEFECTS.md ("r3-19, what is not implemented"). Decision for the coordinator: accept those residuals and move this story to review, or assign mechanism 2 to a dedicated story/agent. If it is built, `update-defects-batch3.py`'s r3-19 note and `docs/native-parity/md-accordion-swift-renderer.md` ("Document stacking") need the matching update.

### 2026-11-14 - progress and BLOCKED again (lane a5 exited: "7d limit; lane a5 exiting")
- A026 re-queued as `3-1-A002` (exit 0 but BUILD FAILED): `rovingOverExpandableRowsMatchesChrome` 2 of 198 failed (single/multi-select "Tab again": focus d0 vs Chrome after). Cause: `focusProperties { onEnter = cancelFocusChange() }` on the collapsed list panel does not stop Tab into the retained child row d0 (the modifier sits on a non-group layout node). Test-first, the oracle already was red. Fix: `Modifier.focusProperties { canFocus=false }` on the collapsed panel (propagates to descendant focus targets). Changed in `d3-lab/patch-list-collapsed-native.py` and in `d3-fresh` NativeList.kt (batch-3 chain now carries it). `3-1-A003-list-canfocus` (exit 0, BUILD SUCCESSFUL): paint 80s ok, interactions ok, roving ok (198/198), tooltip x2 ok, parts ok, NativeStackingTest ok (lane a5, emulator-5564).
- Canonical moved since d3-087 (AWCNativeView.swift, ModalScope.swift, AWCComponent.kt, test-native-views.sh, support jsons were changed by other stories), so `3-1-002-dry3` reported 6 files differing from the old d3-fresh. Batch-3 chain still applies cleanly and is idempotent. I re-snapshotted and re-ran the whole rehearsal: `3-1-003-batch3-rehearsal` (exit 0; Web spec 185/185, e2e md-list 28/28 and md-list-item 12/12, dist rebuilt, oracles equal fixtures; Swift: stacking 12/12, roving 198/198, methods 31, parts 285, tooltips 9, card lifecycle 32, card paint 6912, card states 170543, accordion floating 44288, renderer 563, reorder 628, states 44862, parts 8272, dialog paint 2249, dialog motion 9954, modal stack 149, bottom sheet 1948, side sheet 3057, cursor/hidden 56, forced 232, container AX 22, toolbar 8006, nav bar 16159, org chart 1644, button family 974, color picker 13685, menu 9092, snackbar 2987, tabs 15379, list paint 29418, list states 118309; studio 878 pass / 0 fail). Timing-dependent counts (card states, floating, dialog motion, list states) differ slightly from the earlier rehearsal; run under the orphaned CPU-hog window.
- One Swift failure: NativeTableStatesIntegration `tb-sort-rtl [4] Tab-to-fat-label` (focus none vs sort-label, sort icon opacity). Identical failure is in canonical-only logs (`4-1-r5-post-install-verification-002-mac-canonical`, n4-015/023..027), so it is not caused by this chain (other owner: table).
- Android full suite on the fresh snapshot: `3-1-A004-batch3-rehearsal` 316 tests, 3 failures: NativeAppBarStatesTest.appBarInteractionsMatchChrome (1 of 1281 flat pixel at one frame; same message was in d3-A025), NativeDatePickerPaintTest (606 of 32042, hook-year-block-size; same failure in story 1-3's own logs), NativeMultiSelectPaintTest (ConcurrentModificationException). NOT yet proven independent of the chain: triage job `queue-a5/3-1-A005-triage-three.sh` (the 3 classes on d3-fresh and on a plain canonical copy d3-base) is queued but lane a5 has exited.
- NOT done: main-queue install of batch 3 (`bash d3-lab/install3.sh`; rolls back on failure; ask: wait for a5 triage first), byte-identity, checkpoint refresh, update-defects-batch3.py, r3-19 mechanism 2, FIXED* rows in DEFECTS.md. Note the install job's own default fixture list must not include NativeTableStatesIntegration (pre-existing failure) or it will roll back.

### 2026-11-13 - BLOCKED: Android lane a5 is hung
- Read project-context, story, PARALLEL.md, d3-lab/PROGRESS.md. Batch 3 state is as PROGRESS.md "batch 3 state (resume here)": Swift/iOS rehearsal evidence complete (stacking 12/12, iOS AWC-d3 11/11, roving 198/198, etc.; dry3 d3-087 exit 0, chain differs from verified tree in 0 files, idempotent). Android full suite d3-A025 exit 0 (done 2026-11-12 ~09:38 lane time).
- Blocker: previous job `d3-A026-list-collapsed` (Android list classes with the r3-26 collapsed-panel fix) started in lane a5 at 09:38:45 (lane time; file mtime 2026-11-12 07:38 UTC) and has no `.exit`, an empty `.log` and no end line in `lane-a5.log` after ~35 h. The runner never reached its timeout. Probe jobs: `3-1-001-lane-probe` in queue-d3 ran at once (exit 0, so the Mac lane works); `3-1-A001-lane-probe` in queue-a5 was not picked up (still queued) because the lane is stuck behind A026. Rules say not to restart lanes, so I stopped.
- Nothing installed, no product files changed. Left to do: (1) someone with lane control kills/clears A026 (and checks emulator-5564), then re-queue A026 and remove the stale probe `queue-a5/3-1-A001-lane-probe.sh`; (2) main-queue install of install3.sh (batch 3), byte-identity check, dist rebuild, checkpoint refresh, update-defects-batch3.py; (3) r3-19 mechanism 2 (viewport layer) per the d3-lab design, with NativeStackingIntegration/NativeStackingTest extended; (4) DEFECTS.md FIXED* rows.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

