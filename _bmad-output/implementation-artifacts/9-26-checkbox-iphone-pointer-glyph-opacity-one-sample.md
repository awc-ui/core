---
title: 'md-checkbox iPhone 26.3: one glyph-opacity check fails in every states run of the pointer-light cases (S7-6-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-26-checkbox-iphone-pointer-glyph-opacity-one-sample'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and an iPhone on iOS 18.6 for lane d3 (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s926-lab (create it; private tree work/s926-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-6 and in claude-runner/done/s7-6-003-ios26.log, s7-6-004-ios18.log)'
depends_on: ['7-6-recheck-checkbox-menu-sheets']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-6 (2026-11-17) kept md-checkbox at FAIL with finding S7-6-01 (DEFECTS.md, open and blocking, gate 5). `NativeCheckboxStatesIntegration` on iPhone 26.3 (canonical, shim v5 with key arrivals and the onScreen clock fix) fails exactly one check in each of 3 runs: 17851/17852, 17971/17972, 17977/17978. It is the same kind of check on a different case each time (`pointer-light-ltr-unchecked`, `pointer-light-ltr-unchecked-d4`, `pointer-light-rtl-checked`): glyph opacity rendered 1.0 at a Web time between 2680 and 3230 where Chrome's envelope is 0.0 to 0.95. So on one sample the native glyph is fully opaque where Chrome is at 0.95 or lower. iOS 18.6 passes 17480/17480 in one run; live selection passes 20 of 20. The end state is right; one sample of a fade is off by a few milliseconds. The reviewer puts it in the family of S918-01 and S61-IOS-01 (first native frame after an input one frame late on the phone); that is a reading, not a measurement, and the direction is not yet clear: a fade-out that starts one frame late and a fade-in that ends one frame early both give this fail line.

**Approach:** Reproduce first: the states suite ten times on iPhone 26.3 and five times on iOS 18.6 on a copy of canonical through `slot.sh timing`, with the Mac load at the start of each run; count the runs that fail and list the failing cases. Then capture per frame, for the failing phase of three failing cases and of the same cases in passing runs: the glyph opacity, the time of the pointer event as the shim reports it, the time of each native commit, and the main-thread gaps (the gap trace of story 9-20, tree work/s920-tree, GapRec; job 9-20-008 shows how). Put the Chrome frames of the fixture next to them. Say for each failing sample in which direction the native fade is off (starts late, ends early, or the sample itself is taken at the wrong time) and by how many milliseconds. Then name the cause: the product starts or ends the fade at another time than the source (fix it in the product, anchored to the event), the suite samples before the last commit (fix the sampling as story 9-18 did for the stale frames), or the main thread is blocked (say what runs in the block; a block inside UIKit belongs to story 9-23: report it and do not move product code around it). If Chrome's own value at that sample varies, show it with 20 Chrome captures of the case before touching the envelope.

## Boundaries & Constraints

**Always:** The suite fails in at least 8 of 10 runs on iPhone 26.3 before the change (the reviewer saw 3 of 3) and passes 20 of 20 after it; a build whose glyph fade starts 33 ms late fails after it. The rules in project-context.md apply.

**Never:** Do not widen the envelope or a tolerance without the 20 Chrome captures that show the spread. Do not add a retry. Do not change AppKitShim.swift (a shim change is reported and installed by its own story). Do not change the Android checkbox.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S7-6-01 (near the end of the file), S918-01 and S61-IOS-01
- `work/claude-runner/done/s7-6-003-ios26.log` (console-g7s76-s1..s3-NativeCheckboxStatesIntegration.log) and `s7-6-004-ios18.log`; `work/audit/s7-6/` (how the reviewer built and ran the suite)
- the Dev Agent Record of stories `9-18` (stale frames in states suites), `9-20` (gap trace, job 008) and `9-14` (onScreen clock) and `work/claude-runner/KNOWN-CAUSES.md`
- `packages/native-ios/Tests/NativeCheckboxStatesIntegration.swift` and the checkbox sources under `packages/native-ios/Sources/AWCUI` (find the paths with `ls | grep -i checkbox`)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: the suite x10 on iPhone 26.3 and x5 on iOS 18.6 with the load per run; failing cases per run
- [x] Per-frame capture with pointer time, commits and main-thread gaps for three failing cases and the same cases in passing runs; direction and size of the offset; name the cause (KNOWN-CAUSES.md row)
- [x] Fix in the private tree; the suite x20 on iPhone 26.3, x5 on iOS 18.6, x3 on macOS and once on the iPad; the 33 ms mutation fails; checkbox paint and live selection once
- [x] One main-queue install (dry run, rollback, byte identity); the suite x3 on canonical after the install; DEFECTS.md status line `ready for re-check` for S7-6-01; refresh and confirm the md-checkbox checkpoint

**Acceptance Criteria:**
- Given the checkbox states suite on iPhone 26.3, when it runs twenty times after the change, then every run passes, and the cause is named with a per-frame capture that shows the direction of the offset
- Given a build whose glyph fade starts 33 ms late, when the suite runs, then it fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- Done: cause named (KNOWN-CAUSES row 9-26): first render after `checked` flips, before apply() sets glyphStart, drew the glyph at the END of the entrance (fade-in finished one frame early on a 22 ms gap; job 003-trace). Fix in s926-tree NativeCheckbox.swift (patch-fix.py). 004-fix: 20/20 iPhone 26.3, 5/5 iOS 18.6 (before: 4 of 10 fail). 005-verify read: macOS states x3, paint, iPad, iPhone paint pass; mutation (fade 33 ms late) fails 2/2. Tasks 1-3 ticked.
- In flight: nothing. 006 install (IDENTICAL), 007 canon, 008 DEFECTS S7-6-01 'ready for re-check' + checkpoint refresh/confirm all exit 0. All tasks ticked.
- Next: coordinator routes S7-6-01 to gate-7 re-check. Android: no change (no Android lane).
- Android: no change (story has no Android lane).


_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-002-repro | iPhone 26.3 | NativeCheckboxStatesIntegration run6 (explained: pre-fix defect, cause in KNOWN-CAUSES row 9-26) | 18054/18056
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-002-repro | iPhone 26.3 | NativeCheckboxStatesIntegration run7 (explained: pre-fix defect, cause in KNOWN-CAUSES row 9-26) | 17995/17996
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-002-repro | iPhone 26.3 | NativeCheckboxStatesIntegration run8 (explained: pre-fix defect, cause in KNOWN-CAUSES row 9-26) | 18049/18050
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-002-repro | iPhone 26.3 | NativeCheckboxStatesIntegration run10 (explained: pre-fix defect, cause in KNOWN-CAUSES row 9-26) | 18001/18002
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-002-repro | iOS 18.6 | NativeCheckboxStatesIntegration run1-5 | 18122/18122

EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-004-fix | iPhone 26.3 | NativeCheckboxStatesIntegration x20 (all pass) | 20/20
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-004-fix | iOS 18.6 | NativeCheckboxStatesIntegration x5 (all pass) | 5/5

EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | macOS | NativeCheckboxStatesIntegration r1 | 33968/33968
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | macOS | NativeCheckboxStatesIntegration r2 | 34844/34844
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | macOS | NativeCheckboxStatesIntegration r3 | 34466/34466
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | iPhone 26.3 | mutation fade 33 ms late ((must fail, explained: mutation fails as required)) run1 | 18050/18092
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | iPhone 26.3 | mutation fade 33 ms late ((must fail, explained: mutation fails as required)) run2 | 18009/18056
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | macOS | NativeCheckboxPaintIntegration | 6019/6019
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | iPad | NativeCheckboxStatesIntegration | 18080/18080
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-005-verify | iPhone 26.3 | NativeCheckboxPaintIntegration | 6019/6019
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | macOS | NativeCheckboxStatesIntegration canon r1 | 34856/34856
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | macOS | NativeCheckboxStatesIntegration canon r2 | 34934/34934
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | macOS | NativeCheckboxStatesIntegration canon r3 | 33272/33272
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | macOS | NativeCheckboxPaintIntegration canon | 6019/6019
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | iPhone 26.3 | NativeCheckboxStatesIntegration canon run1 | 17966/17966
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | iPhone 26.3 | NativeCheckboxStatesIntegration canon run2 | 17978/17978
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | iPhone 26.3 | NativeCheckboxStatesIntegration canon run3 | 18002/18002
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-007-canon | macOS | Selection live host canon | 38/38
EVIDENCE | 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-008-defects-checkpoint | macOS | DEFECTS status line + checkpoint refresh/confirm md-checkbox (exit 0) | 1/1

## Review Triage Log
