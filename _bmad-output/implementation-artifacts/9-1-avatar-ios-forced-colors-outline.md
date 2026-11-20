---
title: 'md-avatar on iOS: forced-colors outline row (s7-8-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-1-avatar-ios-forced-colors-outline'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane fi3 · no Android lane · simulators AWC-fi3 and AWC-fi3-ios18'
lab: 'work/s91-lab (create it; private tree work/s91-tree = a copy of canonical; the reviewer's evidence is in work/audit/s7-8)'
depends_on: ['7-8-recheck-containment']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-7 re-check s7-8 failed md-avatar. `NativeForcedAppearanceIntegration` fails 4 checks on iOS in every run: 228/232 on iPhone 26.3 (3 of 3 runs) and on iOS 18.6, while macOS passes 232/232. The checks are avatar `av` and `avn`, light and dark, forced colors, probe `[20, 0.25]`: native [233,233,233] against Chrome [255,255,255]. The sample lies on the top edge of the 40 pt circle.

**Approach:** Decide between the two candidate causes by measurement: (a) the iOS forced-colors outline is drawn half a point too high or straddles the edge, while macOS draws it inside the circle; (b) the fixture samples a 3x pixel row against the 2x oracle. Dump the native pixel rows around the probe at the simulator's scale and compare them with the oracle rows. Fix the product for (a). For (b) record the sampling decision and change only the fixture's sampling.

## Boundaries & Constraints

**Always:** The failing check is the test: it fails before the change and passes after. macOS stays at 232/232. The rules in project-context.md apply.

**Never:** Do not widen the tolerance. Do not change the Chrome oracle. Do not touch md-list or md-accordion files.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- section 'Gate-7 re-check s7-8', row s7-8-01
- `work/audit/s7-8/out/ios*/console-NativeForcedAppearanceIntegration.log`; jobs `s7-8-005-ios26`, `s7-8-008-ios-forced-rerun`; re-check scripts in `work/audit/s7-8/bin`
- the avatar renderer and `NativeForcedAppearanceIntegration` under `packages/native-ios/` (find the files with `ls | grep -i`)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce 228/232 on a fresh copy of canonical (iPhone 26.3); dump the pixel rows around probe [20, 0.25] for native and oracle
- [x] Name the cause with the measurements; add a KNOWN-CAUSES.md row if it is a fixture-scale cause
- [x] Fix in the private tree; NativeForcedAppearanceIntegration on iPhone 26.3 x3, iOS 18.6 x1 and macOS; avatar paint and states on macOS, iOS and Android
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check`; refresh and confirm the md-avatar checkpoint

**Acceptance Criteria:**
- Given the forced-appearance fixture, when it runs three times on iPhone 26.3 and once on iOS 18.6, then it passes 232/232 each time
- Given the fix, when the md-avatar suites run on macOS, iOS and Android, then the counts equal the s7-8 counts or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE. Cause: forced-colors outline was stroked inside the clipped ZStack, so its outer edge was anti-aliased twice (3x top row 233 vs Chrome 255); not an offset, not a 2x/3x sampling issue. KNOWN-CAUSES row 17.
- Fix: outline drawn as `.overlay` after `.clipShape` in `NativeAvatar.swift`; test and tolerance untouched. Before: job 001 228/232. After: 232/232 on iPhone 26.3 x3, iOS 18.6, macOS (job 003, 004).
- Installed once (main queue job 005): dry run, backup, byte identity with `work/s91-tree`, canonical build, 3 macOS suites, playground build, md-avatar checkpoints refreshed and confirmed (3 current).
- DEFECTS.md s7-8-01 line: ready for re-check. Android: renderer untouched, no Android lane; s7-8-A001 avatar-parity 3124/3124 relied on.
- Note: the new probe value is 244 vs 255 (Delta 11 of 12 allowed), the remaining gap is the single 3x edge anti-alias; margin is thin but deterministic (3 of 3 runs).
- Next: reviewer re-check of s7-8-01. No open work for this story.

### Evidence
Before the fix (failing test first): job 001-repro-dump, iOS 26.3, NativeForcedAppearanceIntegration 228/232, the 4 avatar forced probes [20, 0.25] at 233 vs 255.
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-002-fix1-overlay | iOS 26.3 | NativeForcedAppearanceIntegration (with dump patch) | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 26.3 | NativeForcedAppearanceIntegration run 1 | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 26.3 | NativeForcedAppearanceIntegration run 2 | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 26.3 | NativeForcedAppearanceIntegration run 3 | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 26.3 | NativeAvatarIntegration | 2950/2950
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 26.3 | NativeAvatarLazyIntegration | 3/3
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 18.6 | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-003-ios-verify | iOS 18.6 | NativeAvatarIntegration | 2950/2950
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-004-mac-verify | macOS | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-004-mac-verify | macOS | NativeAvatarIntegration | 2950/2950
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-004-mac-verify | macOS | NativeAvatarLazyIntegration | 3/3
EVIDENCE | s7-8-A001-android-paint | Android | avatar-parity (earlier session, renderer untouched, no Android lane) | 3124/3124
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-005-install-avatar-outline | macOS | NativeForcedAppearanceIntegration (canonical after install) | 232/232
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-005-install-avatar-outline | macOS | NativeAvatarIntegration (canonical after install) | 2950/2950
EVIDENCE | 9-1-avatar-ios-forced-colors-outline-005-install-avatar-outline | macOS | NativeAvatarLazyIntegration (canonical after install) | 3/3


## Review Triage Log

