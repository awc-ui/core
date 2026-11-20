---
title: 'iOS RTL: the legend notch of outlined fields is on the wrong side (C66-01, AWCFieldOutlineShape mirrored twice)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-17-ios-rtl-outlined-field-notch-wrong-side'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s917-lab (create it; private tree work/s917-tree = a copy of canonical; the shots of story 6-6 are in work/n2-lab/out/s66-054)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 6-6 found a paint defect outside its scope (DEFECTS.md C66-01). On iOS in RTL the outlined field draws its legend notch on the left (x 29 to 60) while the label sits on the right; the Web shot has the notch at x 315 to 347, and native closes the top border there. `AWCFieldOutlineShape` already mirrors the gap for RTL, so on iOS the shape is mirrored twice. It was seen in md-multi-select, whose field is NativeTextField, so md-text-field and every other user of the shape is in scope. 35 px differ at (46,25) in every RTL run; alone this stays under the paint threshold, so no suite fails on it today and the defect is visible to a user.

**Approach:** Confirm it first where it is simplest: shots of an outlined RTL md-text-field with a label on iPhone 26.3 (empty, populated, focused) against the Web shots, with the x-range of the notch in each, and the same on macOS, where the notch may be right. Then find where the second mirroring comes from on iOS (the shape, the layout direction of the view that hosts it, or a wrapper of the select family) and fix it at that place, so that the gap is on the label side on iOS and macOS in LTR and RTL. List every user of the shape (`grep -rn AWCFieldOutlineShape packages --include=*.swift`). Because the whole-image threshold let this pass, add a check of the notch region to the outlined RTL paint case (pixel count inside the Web notch rectangle and inside the mirrored rectangle) and show that it fails on the unpatched tree.

## Boundaries & Constraints

**Always:** On iPhone 26.3 and on iOS 18.6 the notch of an outlined RTL field is on the label side for md-text-field and md-multi-select, and for every other user of the shape that has an outlined RTL paint case; the new notch-region check fails before the change and passes after it; LTR and macOS results do not change. The rules in project-context.md apply.

**Never:** Do not change a threshold of an existing check. Do not change the Web source. Do not edit the select, multi-select or menu sources that the patch sets of story 6-6 change (`g6/swift`, `g6/swift-ios-hop`): if the second mirroring comes from a select wrapper and not from the shared shape or NativeTextField, write a Handover line in story 6-1 and say so in `open_items`. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- C66-01; the Dev Agent Record of story `6-6` (the notes of job 054 about `AWCFieldOutlineShape`) and `work/n2-lab/out/s66-054/dump-*/`
- `AWCFieldOutlineShape` and its users: `grep -rn AWCFieldOutlineShape packages --include=*.swift`
- the paint suites of the users: `ls -R packages | grep -i PaintIntegration`; the Web shots they compare with
- `work/claude-runner/KNOWN-CAUSES.md` (search for `rtl`)

## Tasks & Acceptance

**Execution:**
- [x] Confirm on iPhone 26.3 and on macOS: shots of the outlined RTL md-text-field (empty with label, populated, focused) and of md-multi-select against the Web shots; the x-range of the notch in each
- [x] Find where the second mirroring comes from on iOS; fix it in the private tree; list every user of the shape
- [x] Add the notch-region check to the outlined RTL paint case; one run on the unpatched tree that fails on it and one run on the patched tree that passes
- [x] Regression: paint and states suites of text-field, number-field, select, multi-select and autocomplete once on iPhone 26.3; text-field and multi-select paint once on iOS 18.6 and on macOS; say why Android is not affected
- [x] One main-queue install as an anchored patch (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check` for C66-01; refresh and confirm the checkpoints of the components whose sources changed

**Acceptance Criteria:**
- Given an outlined RTL field with a label on iPhone 26.3 and on iOS 18.6, when the paint case runs, then the notch is on the label side and the notch-region check passes, and the same check fails on the unpatched tree
- Given the fix, when the paint and states suites of the users of the shape run once on iPhone 26.3 and the paint suites once on macOS, then no check fails that passed before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- Session 5. Fix + notch-region check INSTALLED in canonical by 9-17-100-install-notch-fix (exit 0, md5 byte-identical to s917-tree; NativeTextField.swift 3dccb4b9..., test 7f4f22e4...). DEFECTS.md C66-01 line `ready for re-check` written. Only user of AWCFieldOutlineShape: NativeTextField.swift (multi-select/select/number/autocomplete reach it via NativeTextField).
- Checkpoints: md-text-field, md-otp-field refreshed (stale-recorded); md-select/md-multi-select stale come from story 6-1's install, not mine. In flight: main-queue 9-17-101-checkpoint-confirm (confirm md-text-field).
- DONE: 9-17-101-checkpoint-confirm confirmed md-text-field (current). verify_evidence hard failures 0. Status review.

EVIDENCE | 9-17-004-patched-regression-users | macOS | NumberField paint | 8815/8815
EVIDENCE | 9-17-004-patched-regression-users | macOS | Select paint | 1577/1577
EVIDENCE | 9-17-004-patched-regression-users | macOS | MultiSelect paint | 1222/1222
EVIDENCE | 9-17-004-patched-regression-users | macOS | Autocomplete paint | 511/511
EVIDENCE | 9-17-004-patched-regression-users | iOS 26.3 | NumberField paint | 8815/8815
EVIDENCE | 9-17-004-patched-regression-users | iOS 26.3 | Select paint | 1577/1577
EVIDENCE | 9-17-004-patched-regression-users | iOS 26.3 | MultiSelect paint | 1222/1222
EVIDENCE | 9-17-004-patched-regression-users | iOS 26.3 | Autocomplete paint | 511/511
EVIDENCE | 9-17-004-patched-regression-users | iOS 26.3 | TextField states | 2052/2052
EVIDENCE | 9-17-005-notch-v3-unpatched-then-patched | macOS | TextField paint unpatched (notch check fails, explained: expected failure of the new check on the unpatched tree) | 3441/3522
EVIDENCE | 9-17-005-notch-v3-unpatched-then-patched | iOS 26.3 | TextField paint unpatched (notch check fails, explained: expected failure of the new check on the unpatched tree) | 3435/3516
EVIDENCE | 9-17-005-notch-v3-unpatched-then-patched | iOS 18.6 | TextField paint unpatched (notch check fails, explained: expected failure of the new check on the unpatched tree) | 3435/3516
EVIDENCE | 9-17-007-patched-notch-v3-marker | macOS | TextField paint | 3522/3522
EVIDENCE | 9-17-007-patched-notch-v3-marker | iOS 26.3 | TextField paint | 3516/3516
EVIDENCE | 9-17-007-patched-notch-v3-marker | iOS 18.6 | TextField paint | 3516/3516
EVIDENCE | 9-17-100-install-notch-fix | macOS | canonical byte identity NativeTextField.swift + paint test | 2/2
EVIDENCE | 9-17-004-patched-regression-users | Android | not affected (NativeTextField.kt explicit rtl gap rect, no auto mirroring) | 0/0

## Review Triage Log

