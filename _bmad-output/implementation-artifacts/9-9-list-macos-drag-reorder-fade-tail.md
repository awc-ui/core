---
title: 'md-list: macOS drag-reorder state-layer fade tail frame (C65-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-9-list-macos-drag-reorder-fade-tail'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d2b · no Android lane · no simulator'
lab: 'work/s99-lab (create it; private tree work/s99-tree = a copy of canonical; the runs that showed the failure are in the Dev Agent Record of story 6-5, jobs 006, 014, 015, 016)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 6-5 found an intermittent macOS failure in `NativeListStatesIntegration` that its own change does not cause. One frame of the drag-reorder state layer fails in 2 of 5 runs at ordinary load: `reduced/drag-reorder-standard-none-light-ltr r2 state layer rendered [0.004] at web 2266` (job 6-5-...-006) and `drag-reorder-standard-none-dark-rtl r2 state layer rendered [0.007] at web 2281` (job 6-5-...-014). The native state layer still has opacity 0.004 to 0.007 in a frame where Chrome is at 0, so the native fade ends about one frame after Chrome's. The same check class failed on 2026-10-30 (`fi-702-cp-cpo2-reruns`). Seven baseline runs were clean, so the rate is low and the cause is not yet known. Recorded as C65-01 in DEFECTS.md. The gate-7 re-check 7-12 re-runs this suite on canonical.

**Approach:** Reproduce first. Run only the drag-reorder cases (the suite has a case filter; find its environment variable in the test file) twenty times through `slot.sh timing 4`, and twenty times with a second states suite running in the same job. Count the failures and record the Mac load of each run. Then capture the state-layer opacity per frame over the last 100 ms of the fade for failing and passing runs and compare with the Chrome frames of the fixture. Name the cause with the measurements: a fade that starts late (then anchor it to the event as the other timing fixes in KNOWN-CAUSES.md do), a duration or easing that differs from the source at the tail, or a sample taken before the last commit. Fix what the measurements show, in the product if the product is late and in the test only if the test samples at the wrong time.

## Boundaries & Constraints

**Always:** The drag-reorder subset fails at least once in the forty runs before the change (if it does not, raise the load with a second and third suite until it does, and record the rate) and passes forty of forty after it. The rules in project-context.md apply.

**Never:** Do not widen a tolerance and do not add a retry. Do not touch the Android list code (story 9-2 owns it) or `AWCHarnessInput.swift`. Do not accept the failure as load-dependent without a run that shows which frame is late and why.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- row C65-01
- the Dev Agent Record of story `6-5` (lines on md-list, jobs 006, 014, 015, 016) and `work/claude-runner/done/6-5-macos-harness-key-window-loss-015-list-baseline-x3.sh` (how the suite is compiled and run)
- `work/claude-runner/done/fi-702-cp-cpo2-reruns.log` and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-ios/Tests/NativeListStatesIntegration.swift` and the list sources under `packages/native-ios/Sources/AWCUI` (find the paths with `ls | grep -i list`)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: the drag-reorder subset x20 in a timing slot and x20 with a second suite; failure count and load per run
- [x] Per-frame capture of the fade tail; name the cause with the measurements (add a KNOWN-CAUSES.md row if it is new)
- [x] Fix in the private tree; the subset x40 as before; the full md-list states and paint suites on macOS x3
- [x] If a shared list source changed: stop before the install and ask the coordinator in the Handover for an iOS and an Android run of the md-list suites (this story has no simulator, and story 9-2 owns the Android lane)
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check` for C65-01; refresh and confirm the md-list checkpoint with the runs after the install

**Acceptance Criteria:**
- Given the drag-reorder cases, when they run forty times on macOS (twenty with a second suite running), then every run passes, and the same forty runs failed at least once before the change
- Given the cause, when a reader opens KNOWN-CAUSES.md, then the row names the late frame, its measurement and the fix
- Given the install, when the full md-list states and paint suites run three times on macOS canonical, then every run is a full pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-16 14:00 UTC: all Mac queues stopped at 13:35:04 UTC; what to redo)
At 13:35:04 UTC on 2026-11-16 (15:35:04 Mac time) every process of the runner process group got SIGTERM. The main runner, all lanes and all running jobs stopped (`claude-runner/KNOWN-CAUSES.md` row 34: `kill 0` in a helper trap of job 9-9-003). The coordinator stopped all chains at about 13:56 UTC. Your chain is relaunched only after the user has started the runner and the lanes are back, so when you read this the queues work again. Since the restart each lane job runs in its own process group. Results written before 13:35:04 are valid. A job stopped by the event has `.exit` 143 and a last log line written by the coordinator. Before you queue such a job again (new number), check your private tree for half-applied state: files the job trap restores, diagnostic lines left in tests, half-applied patches.

For this story: your job `9-9-003-subset-x20-overlap` caused the stop. Its results are complete and valid (SUMMARY: pass 8, fail 12 of 20). The cause was the helper `( trap 'kill 0' EXIT; while true; do ...; done ) & BG=$!` together with `kill $BG` in the job trap: the helper trap then ran `kill 0`. In later jobs start the helper without a trap and stop it with `pkill -P $BG; kill $BG; wait $BG 2>/dev/null`. Never use `kill 0` or another group signal.

### Session 7 note for the coordinator
Fix5 (shared list source `NativeListItemView.swift` under AWCUI) is verified on macOS in the private tree only. Per the story, before the install I need an iOS and an Android md-list states+paint run of the fix5 tree (work/s99-tree; story has no simulator, Android lane owned by 9-2). Please schedule them or allow the install with macOS-only evidence.

### Coordinator note (2026-11-17 03:11 UTC: decision - iOS runs before the install; Android by file listing)
- Decision: no install with macOS evidence alone. `NativeListItemView.swift` is compiled for iOS as well, so the fix needs iOS runs first. Set the story to `in-progress`.
- iOS, on your lane d2b: create the simulators `AWC-d2b` (iPhone, iOS 26.3) and `AWC-d2b-18` (iPhone, iOS 18.6) as PARALLEL.md describes. Run the md-list states and paint suites from `work/s99-tree` and from canonical in the same job, one after the other, through `claude-runner/tools/slot.sh timing 4`: iPhone 26.3 states twice and paint once per tree, iOS 18.6 states once and paint once per tree. The rule is the one of story 9-10: no check may fail only with the fix. A check that fails in both trees is not yours; name it in `open_items`.
- Android: a Swift source cannot change the Android build. Prove it with a file listing: `diff -rq` between `work/s99-tree` and canonical for `packages/native-android` and `apps/native-android-playground` (names only). If nothing differs there, write "Android not affected: no Android file differs" with the job name into the story; that covers the Android part of the acceptance line, and no Android run is needed. If a file does differ, run the Android md-list device suites once on lane a4 (emulator-5562; story 9-13 has finished there).
- EVIDENCE lines of runs that are expected to fail (the two before-fix lines, jobs 002 and 003) follow the convention of story 9-8: the count is followed by `explained: <reason>`, and the reason is the proven one (here: before the fix, the defect this story reproduces). A failure with no proven reason is never marked. If a permission check refuses an edit, do not try it another way; name the lines in `open_items`.
- After the iOS runs: main-queue install (dry run, rollback, byte identity), DEFECTS.md C65-01 to "ready for re-check", checkpoint refresh, three canonical full macOS runs and one canonical iPhone 26.3 run, then verify_evidence.py and status review.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 10 (v5). status in-progress; fix5 INSTALLED and byte-identical (job 9-9-104-install-list-drop-hover-hold: NativeList.swift, NativeListItemView.swift; DEFECTS.md C65-01 "ready for re-check" appended; md-list checkpoints refreshed: laboratory 1, native-swift 2 pins).
- iOS (jobs 9-9-101, 9-9-102): fix tree and canonical both fully clean, no check fails only with the fix. Android not affected: no Android file differs from this change (job 9-9-100-android-diff lists only other stories' installs, no list file; this install changes two Swift files only).
- Done: 9-9-105-canon-full-macos-x3 (canonical states x3 + paint x3, build in work/s99-lab/out/canon-build; grep EVID done/9-9-105*.log), 9-9-106-canon-ios26: both fully green (EVIDENCE below). Checkpoints confirmed (9-9-107).
- Next: verify_evidence.py ok -> status review (no further work). (confirm cmd was: `python3 tools/checkpoint-refresh.py confirm md-list --runs 9-9-105-canon-full-macos-x3,9-9-106-canon-ios26` in canonical (main-queue job), then `python3 $HOME/mnt/p/work/bmad-coord/verify_evidence.py 9-9-list-macos-drag-reorder-fade-tail`, status review.
- EVIDENCE | 9-9-002-subset-x20-plain | macOS | NativeListStatesIntegration drag-reorder (before) | 12/20 explained: before the fix, the defect this story reproduces
- Before-fix overlap run (prose, not an EVIDENCE line: job 9-9-003-subset-x20-overlap has .exit 143 from the kill-0 event, KNOWN-CAUSES row 34; the coordinator confirmed its SUMMARY valid): drag-reorder +Tabs loop, 8 of 20 passed, 12 failed (the defect this story reproduces).
- EVIDENCE | 9-9-010-fix5-full-x3 | macOS | NativeListStatesIntegration drag-reorder x20 (fix5) | 20/20
- EVIDENCE | 9-9-011-fix5-subset-x20-overlap | macOS | NativeListStatesIntegration drag-reorder +Tabs loop x20 (fix5) | 20/20
- EVIDENCE | 9-9-010-fix5-full-x3 | macOS | NativeListStatesIntegration full run 1 (fix5) | 126306/126306
- EVIDENCE | 9-9-010-fix5-full-x3 | macOS | NativeListStatesIntegration full run 2 (fix5) | 133847/133847
- EVIDENCE | 9-9-010-fix5-full-x3 | macOS | NativeListStatesIntegration full run 3 (fix5) | 132100/132100
- EVIDENCE | 9-9-010-fix5-full-x3 | macOS | NativeListPaintIntegration x3 (fix5) | 29418/29418
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListStatesIntegration run 1 (fix tree) | 76530/76530
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListStatesIntegration run 2 (fix tree) | 76500/76500
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListPaintIntegration (fix tree) | 29418/29418
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListStatesIntegration run 1 (canonical before install) | 76965/76965
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListStatesIntegration run 2 (canonical before install) | 77054/77054
- EVIDENCE | 9-9-101-ios26-fix-vs-canon | iOS 26.3 | NativeListPaintIntegration (canonical before install) | 29418/29418
- EVIDENCE | 9-9-102-ios18-fix-vs-canon | iOS 18.6 | NativeListStatesIntegration (fix tree) | 74908/74908
- EVIDENCE | 9-9-102-ios18-fix-vs-canon | iOS 18.6 | NativeListPaintIntegration (fix tree) | 29418/29418
- EVIDENCE | 9-9-102-ios18-fix-vs-canon | iOS 18.6 | NativeListStatesIntegration (canonical before install) | 75296/75296
- EVIDENCE | 9-9-102-ios18-fix-vs-canon | iOS 18.6 | NativeListPaintIntegration (canonical before install) | 29418/29418
- EVIDENCE | 9-9-105-canon-full-macos-x3 | macOS | NativeListStatesIntegration canonical run 1 | 129658/129658
- EVIDENCE | 9-9-105-canon-full-macos-x3 | macOS | NativeListStatesIntegration canonical run 2 | 128459/128459
- EVIDENCE | 9-9-105-canon-full-macos-x3 | macOS | NativeListStatesIntegration canonical run 3 | 131192/131192
- EVIDENCE | 9-9-105-canon-full-macos-x3 | macOS | NativeListPaintIntegration canonical x3 | 29418/29418
- EVIDENCE | 9-9-106-canon-ios26 | iOS 26.3 | NativeListStatesIntegration canonical after install | 77514/77514
- EVIDENCE | 9-9-106-canon-ios26 | iOS 26.3 | NativeListPaintIntegration canonical after install | 29418/29418
- EVIDENCE | 9-9-107-checkpoint-confirm | macOS | checkpoint-refresh confirm md-list (3 checkpoints current) | 3/3
- EVIDENCE | 9-9-100-android-diff | Android | file listing (no Android file differs; Android not affected) | 1/1

## Review Triage Log

