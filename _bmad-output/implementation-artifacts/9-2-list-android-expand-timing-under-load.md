---
title: 'md-list on Android: expand and caret samples late under load (s7-8-02)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-2-list-android-expand-timing-under-load'
epic: 9
model: 'opus'
wave: 6
lanes: 'mac lane d4 · android lane a4 (emulator-5562) · no simulator'
lab: 'work/s92-lab (create it; private tree work/s92-tree = a copy of canonical; earlier work: story 3-1 jobs 3-1-A006 to 3-1-A009 in work/d3-lab; reviewer evidence work/audit/s7-8/out/android)'
depends_on: ['7-8-recheck-containment']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `NativeListStatesTest.listInteractionsMatchChrome` fails on Android when the Mac is busy and passes in isolation. There are three independent occurrences: story 3-1 (`3-1-A008`: 2 of 3 runs fail; `3-1-A009`: 3 of 3 fail on a plain copy under load; `3-1-A007`: 3 of 3 pass unloaded) and the reviewer (`s7-8-A002`: 2 of 175282 checks, `expand-expand-standard-none-dark-rtl r1`, panel opacity 0.850 against Chrome [0.018, 0.797] and caret 128.7 against [0.28, 108.3] at web 2016 ms). The cause is not proven: the product's frame pacing or the fixture's clock.

**Approach:** First make it fail on demand: run the test under a fixed synthetic load (the 3-1-A008 recipe) until it fails in most runs. Then log, for the failing phase, the toggle delivery time, the animation start time and every sampled frame time against the emulator's frame clock. The trace shows whether the animation starts late (product: start it from the toggle's delivery time, as was done for iOS, ios-harness.md items 31 and 34) or the fixture samples late (fixture: drive the animation from the test's virtual clock). Fix the proven cause only.

## Boundaries & Constraints

**Always:** The loaded recipe is the test: it fails in most runs before the fix and passes 5 of 5 after it. Record the load numbers with every run. The rules in project-context.md apply.

**Never:** Do not widen a tolerance or add retries. Do not explain a failure by load without a measurement from the same run. Do not use emulator-5554.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- row s7-8-02 and the story 3-1 finding (job `3-1-017`)
- `work/d3-lab` -- job scripts A006 to A009 (the loaded recipe); `work/audit/s7-8/out/android/timing-*`
- `work/claude-runner/KNOWN-CAUSES.md` row 13 (load numbers)
- the Compose list renderer and `NativeListStatesTest` under `packages/native-android/`

## Tasks & Acceptance

**Execution:**
- [x] Loaded reproducer: failure rate over 5 runs before any change, with load numbers
- [x] Trace of the failing phase: toggle delivery, animation start, frame times, sample times
- [x] Fix the proven cause in the private tree; loaded recipe 5 of 5 and unloaded 3 of 3; list paint and states unchanged; if a shared animation helper changes, run the Android states suites of every component that uses it
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status lines for s7-8-02 and the 3-1 finding; KNOWN-CAUSES.md row; refresh and confirm the md-list checkpoint

**Acceptance Criteria:**
- Given the loaded recipe, when NativeListStatesTest runs five times after the fix, then all five pass, and the same recipe failed in most runs before the fix
- Given the cause, when the story file is read, then it is backed by a trace of toggle, start, frame and sample times
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-15 23:13 UTC)
- On your question about the load recipe: keep the recipe. With a failure rate of 6 in 13 loaded runs before the fix, five passing loaded runs after it would still happen by chance about once in twenty times. So the sample after the fix must be ten loaded runs: A013 gives five; queue one more job with five loaded runs on fix 4 (same recipe, same emulator) and count ten of ten. State both rates in the Dev Agent Record (before: 6 of 13; after: n of 10).
- If A013, the second loaded job and A014 are green: EVIDENCE lines, the install (`install-010.sh`, main queue, dry run and byte identity), DEFECTS.md lines for s7-8-02 and the 3-1 finding, KNOWN-CAUSES row 20, checkpoint refresh and confirm for md-list, then `review`.
- If a loaded run still fails on fix 4, record which check and frame, and continue the cause finding from the lag histogram; do not install.

## Dev Agent Record

### Current state
- Session 9. All tasks done; status review. Cause proven (racy inspection source: composition vs drawBehind); fix4 in NativeList.kt, composition-only.
- Loaded failure rate: before 6 of 13; after fix 10 of 10 (A013 5/5 + A015 5/5); unloaded 3/3; list regression suites green (A014).
- Install: 9-2-...-010-install-list-inspection exit 0, INSTALLED byte-identical. Job 011-checkpoint-defects: md-list checkpoints refreshed and confirmed (3 current), DEFECTS.md lines for s7-8-02 and 3-1-017 appended, KNOWN-CAUSES row 20 written.
- Next: coordinator review; reviewer re-check of s7-8-02.

### Trace (A002-A005, s92-tree-t)
- Product start is deterministic in virtual time: 266/266 transition starts `fromInput=true`, now = input time.
- Per-sample lag = mainClock.currentTime - row.frame for animating samples. Unloaded (A004, 2 runs): lag=0 never occurs (0/1530); all animating rows read the composed frame (lag 16). Loaded (A005, 4 runs): lag=0 in 1, 6, 2, 2 samples. Panel/caret series per frame are identical in passing and failing runs.
- Failing sample A005 run 2: `expand-expand-standard-none-dark-rtl t=1984 lag=0 panel=0.7645 caret=0.5319`; the next sample t=2000 (lag 16) holds the same value; unloaded the t=1984 sample is lag 16, panel 0.6980. The fixture read the next frame's value one frame early: the row's drawBehind (real-time view clock) wrote inspection before the test thread's sample() after advanceTimeByFrame.
- Conclusion: neither late product start nor late sampling; a racy inspection source (composition vs draw). Fix the source (composition only).

EVIDENCE | 9-2-list-android-expand-timing-under-load-A001-baseline-loaded | android | NativeListStatesTest loaded baseline (runs) | 3/5 explained: pre-fix failures, cause proven (see Trace)
EVIDENCE | 9-2-list-android-expand-timing-under-load-A002-trace-loaded | android | NativeListStatesTest loaded trace (runs) | 1/3 explained: pre-fix failures, cause proven (see Trace)
EVIDENCE | 9-2-list-android-expand-timing-under-load-A003-lag-loaded | android | NativeListStatesTest loaded lag trace (runs) | 2/4 explained: pre-fix failures, cause proven (see Trace)
EVIDENCE | 9-2-list-android-expand-timing-under-load-A004-lag-hist-unloaded | android | NativeListStatesTest unloaded lag trace (runs) | 2/2
EVIDENCE | 9-2-list-android-expand-timing-under-load-A005-lag-hist-loaded | android | NativeListStatesTest loaded lag trace (runs) | 2/4 explained: pre-fix failures, cause proven (see Trace)

EVIDENCE | 9-2-list-android-expand-timing-under-load-010-install-list-inspection | android | canonical install byte-identical (installs) | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-011-checkpoint-defects | macos | md-list checkpoints current | 3/3
EVIDENCE | 9-2-list-android-expand-timing-under-load-A013-fix4-all | android | NativeListStatesTest fix4 unloaded runs | 3/3
EVIDENCE | 9-2-list-android-expand-timing-under-load-A013-fix4-all | android | NativeListStatesTest fix4 loaded runs | 5/5
EVIDENCE | 9-2-list-android-expand-timing-under-load-A015-fix4-loaded-second | android | NativeListStatesTest fix4 loaded second runs | 5/5
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | LivePreviewListHostTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeListFocusSemanticsTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeListPaintTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeListPartsTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeListRovingTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeListTooltipTest | 2/2
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeTransferListPaintTest | 1/1
EVIDENCE | 9-2-list-android-expand-timing-under-load-A014-list-regression-fix4 | android | NativeTransferListStatesTest | 1/1

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

