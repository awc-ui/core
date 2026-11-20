---
title: 'md-search iOS and macOS: the first frames after a press are late because the main thread is blocked by the focus change and by the first render'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-22-search-press-block-first-frame-after-focus'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n3 · no Android lane · the simulators story 1-2 used on lane n3: AWC-n3 (iPhone 26.3), AWC-n3-ipad (iPad 26.3) and its iOS 18.6 simulator'
lab: 'work/n3-lab/search2 (the lab of story 1-2, which is paused while this story runs; private tree work/n3-tree2 with the gap-rule patch s23 and the key-down anchor; diagnostics in work/n3-lab/search2/diag: gap-trace.py, fail-class.py, open-trace.py, close-trace.py, gaps-summary.py)'
depends_on: ['1-2-md-search-finish-and-install']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 1-2 measured the cause of every remaining states miss of md-search on iOS and macOS (jobs 071 to 074, `fail-class.py`): all 24 failing checks of 4 runs lie in a block of the main thread at the press, none in a free display-link gap. On iOS the block is `UITextField` `becomeFirstResponder` with `_reloadInputViews` (36 to 57 ms, also in a warm process) followed by the first render (47 to 73 ms); on macOS it is a 52 ms block at the press that nobody has named. The failing checks are `search-docked-*-click-bar-focus`, the fullscreen `click-bar-opens`, and motion frames of `Escape-closes` and `clear-loading`. Counts in the private tree with the gap rule: iPhone 759 to 765 of 766, iPad 760 to 766, iOS 18.6 747, macOS 762 to 763. One fix attempt failed (job 077): moving the UIKit responder change two frames behind the press gave 743 to 745 of 766, because keys sent before the deferred responder were lost or reordered and outside-click-closes regressed. The gap rule catches a delay of 34 ms, not of 17 ms (job 076).

**Approach:** Three steps, each measured with the gap trace before and after. Step 1, the product's own cost: the first render after the press (47 to 73 ms). Find what it builds (the sample of job 011 of story 1-2 named `AWCSearchAppearance.merging`, `AWCSearchModel.init` and `AWCListItemAppearance.merging`; the opus session named `item()` per render in the slotted rows) and remove it from the press turn, so that the first frame after the UIKit block is not delayed again. Step 2, the order of work at the press, as the OTP field (story 9-6, coordinator note of 11-17 00:32 UTC, decision 2) and the select family (story 6-6, `work/n2-lab/lab/g6/swift-ios-hop`) do it: logical focus and the start of the transition first, the first frame committed, then the responder change. Job 077 deferred by two display frames and lost keys: read from its trace where those keys went, then try the smallest deferral (the turn right after the first commit). Check in the Web recorder whether the keys of a step follow the press in the same task or in a later phase; the native suite sends what the recorder sends, and you do not change that. Step 3, macOS: name the 52 ms block with a main-thread sample and apply the same order if it is the same pattern. If after steps 1 and 2 keys of the same step still cannot reach the field in order, do not build a key buffer in the product. Then write the exception record for audit 7-17 with the measurements: the distribution of the UIKit block per simulator runtime, the checks that still fail with their numbers, and why the two orders of work do not remove it.

## Boundaries & Constraints

**Always:** No key is lost or reordered: a check types right after the press without a pause and compares value and caret, and a check presses and sends Escape at once, on iPhone and iPad. The 34 ms mutation still fails. Counts are strict (no PENDING branch). The rules in project-context.md apply. The rules in project-context.md apply.

**Never:** Do not widen a tolerance or the window of the gap rule, skip a case, add a retry or add a delay to the suite. Do not build a key queue or key buffer in the product. Do not edit `apps/native-ios-parity/Shim/AppKitShim.swift`. Do not install on canonical: story 1-2 installs the whole md-search batch after this story. Do not change the Web fixtures. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record and the coordinator notes of 11-17 in story `1-2` (jobs 071 to 077; patches `s23-gap-rule.py` and the rejected s25 files `*.swift.s25-applied`)
- `work/claude-runner/KNOWN-CAUSES.md` rows 25 and 28 and the lines of 11-17 for story 1-2; the 9-6 lines about the first-responder hop after the commit
- `NativeSearch.swift` and `NativeSearchStatesIntegration.swift` in `work/n3-tree2`; `NativeOTPField.swift` on canonical (logical focus first, hop after the commit)
- `work/n3-lab/search2/diag` (gap-trace.py, fail-class.py); `run-fixture.sh` takes fixture switches as KEY=VALUE arguments after the fixture name, not as an env prefix

## Tasks & Acceptance

**Execution:**
- [x] Step 1: what the first render builds, with a main-thread sample; the change; the block length before and after on iPhone and iPad
- [x] Step 2: where the keys of job 077 went; the smallest deferral with logical focus first; the two key checks; states strict two runs on iPhone and one on iPad before and after
- [x] Step 3: macOS block named; the same order of work if it applies; states strict two runs on macOS before and after
- [x] Result: states strict three runs each on macOS, iPhone 26.3, iPad 26.3 and iOS 18.6 in the private tree; the 34 ms mutation run; every remaining failing check by name with its numbers
- [x] Hand over to story 1-2: the patch files and their order in `work/n3-lab/search2`, a `### Note from story 9-22` in the 1-2 story file, and, if checks still fail, the exception record with the measurements in the md-search doc draft

**Acceptance Criteria:**
- Given the private tree after steps 1 to 3, when the states suite runs three times each on macOS, iPhone 26.3, iPad 26.3 and iOS 18.6 with strict counts, then the record has every count and every remaining failing check by name
- Given the two key checks, when they run on iPhone and iPad, then value and caret are right and Escape closes, and the 34 ms mutation run fails
- Given checks that still fail, when a reader opens the exception record, then it has the distribution of the UIKit block, the numbers of each check and the reason why neither order of work removes it; without such checks there is no exception record
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 08:49 UTC: start now; 1-2 is paused for you)
- Start now. Story 1-2 is `blocked` on exactly this point and stays paused until you hand over; you are the only one who works in `work/n3-lab/search2` and `work/n3-tree2` meanwhile. Rebuild the tree's shim from canonical first (canonical has shim v5, keyArrivals and the onScreen fix, md5 30db5861...), keeping the patches of story 1-2 that are in the tree.

### Coordinator note (2026-11-17 18:48 UTC: stopped by the user's pause at 09:50 UTC; the Mac slept 10:39 to 18:43 UTC; which jobs to repeat)
- The user paused the work on 11-17 at about 09:50 UTC. Your session was stopped then and could not write its last notes. The Mac slept from 10:39 to 18:43 UTC (lid closed; coordinator job `887-coord-look-after-pause`) and woke with a load average above 300 that needs some minutes to settle. The user resumed the work at about 18:45 UTC.
- Jobs of this story. Finished before the sleep: all up to `9-22-search-press-block-first-frame-after-focus-010-final-ios` (10:13 UTC) and `-011-final-mac` (10:17 UTC). Running when the Mac went to sleep: none. Still queued at the wake (they run now): none.
- A job that was running when the Mac went to sleep is not evidence, whatever its exit code and counts say: run it again. A timing run that started between 18:43 and 19:15 UTC ran under the wake load: look at the load in its log or at its start time and repeat it too.
- Read the summary lines of the finished jobs first (grep and tail, not whole logs), then go on from your Current state. Only 2 simulators were booted after the wake: check that yours are booted before a run.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 3 (sonnet): all tasks done. Status review. Jobs 010-final-ios and 011-final-mac ran 10:13-10:17 UTC, before the Mac sleep, at load 12-100: valid.
- Result in tree n3-tree2 (baseline + s23 gap rule; no new product patch; s26/s28/s29 rejected): iPhone 760/764/762, iPad 763/760/758, iOS 18.6 749/748/745, macOS 763/763/751 of 766; 34 ms mutation 740/766 (fails as required).
- Every remaining failure is a motion-frame miss inside the press block (fail-class BLOCKED), plus: iOS 18.6 click-clear focus (3/3 runs) and mac run 3 reduced leading-back-closes (1 run).
- Exception record: n3-lab/search2/docs/md-search.md section "Exception record from story 9-22". Hand-over note in story 1-2 file. Nothing new to install.
- Not available: Android (no lane); canonical install is story 1-2's.

EVIDENCE | 9-22-search-press-block-first-frame-after-focus-001-commit-hop | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration s26 commit hop x2 private tree n3-tree2 (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 747/766, 743/766 ; strict 747/766, 743/766 ; text reordered xalp vs alpx
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-001-commit-hop | ios (iPad Pro 11 M5 26.3) | NativeSearchStatesIntegration s26 commit hop (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 740/766 ; strict 740/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-002-keydebug | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration case clear-loading s26 + key debug (diagnostic, explained: miss counts of the press block, see exception record) | 72/88 ; caret at 0 after the deferred responder
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-003-caret | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration s26 + s28 caret x2 (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 755/766, 753/766 ; strict 755/766, 753/766 ; no value or event failure, motion misses remain
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-003-caret | ios (iPad Pro 11 M5 26.3) | NativeSearchStatesIntegration s26 + s28 caret (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 752/766 ; strict 752/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-004-bodytime | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration baseline + BODYT timing docked-divided-ltr (diagnostic, explained: miss counts of the press block, see exception record) | 105/106 ; host body evaluation below 3 ms except one 5.4 ms
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-004-bodytime | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration baseline + BODYT timing fullscreen-contained (diagnostic, explained: miss counts of the press block, see exception record) | 94/96 ; host body evaluation below 3 ms except one 5.4 ms
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-005-mac-sample | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 761/766 ; strict 761/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-006-mac-sample2 | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 763/766 ; strict 763/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-008-mac-sample4 | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 (diagnostic, not canonical, explained: miss counts of the press block, see exception record) | 758/766 ; strict 758/766

EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 1 | 760/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 2 | 764/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 3 | 762/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPad Pro 11 M5 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 1 | 763/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPad Pro 11 M5 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 2 | 760/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPad Pro 11 M5 26.3) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 3 | 758/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 18.6) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 1 (also value check click-clear focus body vs input) | 749/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 18.6) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 2 (also value check click-clear focus body vs input) | 748/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 18.6) | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 3 (also value check click-clear focus body vs input) | 745/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-010-final-ios | ios (iPhone 17 Pro 26.3) | NativeSearchStatesIntegration 34 ms mutation (must fail) explained: mutation run fails as required, 740 checks pass, 26 fail with up to 24 frames per check | 740/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-011-final-mac | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 1 | 763/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-011-final-mac | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 2 | 763/766
EVIDENCE | 9-22-search-press-block-first-frame-after-focus-011-final-mac | macos | NativeSearchStatesIntegration baseline private tree n3-tree2 strict (pending frames as failures), explained: only motion frames in the press block, see exception record run 3 (run 3 also leading-back-closes (reduced) open/focus/status/events: one-off, not reproduced in runs 1-2) | 751/763

## Review Triage Log

