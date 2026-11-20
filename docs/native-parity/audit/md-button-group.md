# md-button-group — gate-7 independent audit (re-check 4)

Reviewer: gate-7 reviewer s7-13 (story 7-13), re-check of 2026-11-16, after story 9-5 (R1-17, display frame lost mid-motion on iOS 18.6) fixed the
family-states sampler (installed by main-queue 9-5-button-group-ios18-lost-frame-100-install) and corrected the R1-09 `Status:` lines.
Scope of this re-check: R1-17 and the R1-09 Status lines. The other s7-7 re-check 3 results for md-button-group stand (Laboratory probes, tools/ax, examples, gate-1 matrix,
studio/compiler/Web suites); the product sources they cover are unchanged since the s7-7 snapshot (see "What changed since s7-7").
Everything below was re-run by s7-13 on a fresh snapshot `work/audit/s7-13-tree` (job s7-13-001-snapshot, 2026-11-15 22:26-22:36 UTC, 256 installs, latest
1-2-md-search-finish-and-install-A033-ax5-android). Outputs `work/audit/s7-13/` (ios/, swift/, android/, snap/).
Jobs: Mac lane fi2 s7-13-001-snapshot, -002-ios18-x5, -003-ios26-x3, -004-macos, -005-repro-ios18, -006-repro2-ios18, -007-repro3-fix-ios18; Android lane a1 s7-13-A001-android.
Simulators AWC-fi2 (iPhone 17 Pro, iOS 26.3) and AWC-fi2-ios18 (iPhone 16 Pro, iOS 18.6); Android emulator-5556. Timing runs through `tools/slot.sh timing 4`.
Host load at the end of each run (1-minute average, job logs): iOS 18.6 runs 135, 37, 239, 21, 17; iOS 26.3 runs 24, 137, 60 (three of the eight above the load of the failing s7-7 run, 122).

## What changed since s7-7
- Product code: none. `packages/core/src/components/md-button-group` identical; the button-family Swift sources (`NativeButton*`, `NativeFab*`, `NativeSegmented*`, `NativeSplit*`) identical between `s7-7-tree` and `s7-13-tree`.
  Android: `AWCComponent.kt`, `NativeTable.kt`, `NativeTransferList*.kt` differ (other stories); the Android family suites below were re-run on the new snapshot anyway.
- Test: `packages/native-ios/Tests/NativeButtonFamilyStatesIntegration.swift` (sha256 be6ceabb...6218, identical to the 9-5 tree). Diff against the s7-7 tree: `work/audit/s7-13/snap/sampler-fix.diff`.
  The sampler now remembers the box samples read since the display last ticked; when the next tick shows a gap over 1.5 frames, those samples are compared back to the start of the stall
  (`lateStallBoxes`) like samples read after 1.5 frames of it. Tolerance (1.5) and `minimumInterval` are untouched; no Chrome window was widened.

## Re-run counts (claimed -> re-run)
| Suite | Claimed (9-5 / DEFECTS) | s7-13 re-run |
|---|---|---|
| Family states iOS 18.6 x5 (AWC-fi2-ios18) | 5/5 pass (9-5 -008 and -005) | **5/5 pass**: 27479/27479, 27739/27739, 29440/29440, 27881/27881, 27614/27614; 0 FAIL lines; 62-77 display stalls and 16-24 main-thread holds per run absorbed |
| Family states iOS 26.3 x3 (AWC-fi2) | 3/3 pass (9-5 -009, -006) | **3/3 pass**: 26614/26614, 26711/26711, 26588/26588; 0 FAIL |
| Family states macOS | 28517 (9-5 -007) | 28766/28766 (s7-13-004); family paint 974/974; `NativeButtonGroupViewIntegration` 87/87 |
| Family paint / states Android (emulator-5556) | 974 / 18241 (9-5 -A001) | 974/974 / 18241/18241; device classes 133/133 (0 fail); unit 195/195; md-button paint 712, states 645 |
| R1-17 reproducer (`AWC_FAMILY_STATES_DROP_FRAME=bg-keyboard-standard/key3-Enter:<from>:<ms>`), iOS 18.6, only `fab-pointer-surface,bg-keyboard-standard` | old fails, fix passes (9-5 -006b: 681/682 vs 683/683) | old behaviour (`AWC_FAMILY_STATES_STALL_LATE=0`), drop 43:32: 682/682 pass in -005 (box already at 223.40 when frozen), **FAIL in 2 of 2 in -006** (221.90 vs Chrome 223.92-225.05 at +61 ms, the s7-7 box); drop 30:45: pass 2/2. With the fix: drop 43:32 pass 4 of 4 (678, 683, 686, 685 checks; one frozen at the rest width 221.93, the failing situation); drop 30:45 pass 2/2 |

EVIDENCE | s7-13-002-ios18-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration x5 | 27479/27479, 27739/27739, 29440/29440, 27881/27881, 27614/27614
EVIDENCE | s7-13-003-ios26-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration x3 | 26614/26614, 26711/26711, 26588/26588
EVIDENCE | s7-13-004-macos | macOS | NativeButtonFamilyStatesIntegration | 28766/28766
EVIDENCE | s7-13-A001-android | Android | family states | 18241/18241

## Review of the fix
- Cause as established by s7-7 and 9-5: the display skipped a tick; the box samples read in that stretch show the previous frame, and the fixture learned of the stall only after the next tick (here 32 ms later).
  The width motion itself is timed from the press (R1-13), so this is a sampler attribution gap, not a renderer defect. The renderer is unchanged and the product's own frames agree with Chrome in every other run.
- The change widens what the sampler forgives only to samples that were read on one display frame before a gap over 1.5 frames, capped at 50 ms of hold, and only on iOS; macOS is unaffected. It does not touch the
  checks of the group's final width or the paint comparisons. Accepted as a test-harness correction.
- Reproducer caveat (non-blocking, recorded as a note under R1-17): the old-behaviour failure depends on the width the box has when the freeze starts (it failed when frozen at the rest width 221.9, passed when
  the native motion had already begun at 223.40), so the reproducer shows old-fails / fix-passes only in some runs (old failed 2 of 5 runs here, fix passed 6 of 6). A deterministic reproducer would freeze the box at the
  rest width explicitly. This does not change the verdict: the failing situation was reproduced and passes with the fix, and the full family states pass in 8 of 8 real runs.

## Gate 1 matrix
Unchanged: the Web contract (`packages/core/src/components/md-button-group`) is byte-identical to s7-7's snapshot and the s7-7 matrix stands (no new gap).

## Exceptions
None proposed; none accepted.

## Component evidence
Button group: `NativeButtonGroupViewIntegration` 87/87 (macOS, s7-13-004); and Android `LivePreviewButtonFamilyHostTest` 9/9 within the 133/133 device total (s7-13-A001). Laboratory 4177 probes and tools/ax were not repeated (no product change since s7-7; s7-7 results stand).

## R1-09 Status lines
`Status:` lines of md-button-group.md, md-fab.md, md-icon-button.md, md-split-button.md and md-fab-menu.md now state that iOS execution (iOS 26.3 and 18.6, gate 6) passed and point to the gate-7 verdict: verified in the canonical docs.
Residual (non-blocking): the AUDIT.md rows of md-fab, md-icon-button and md-split-button still contain "final audit pending" before the gate-6 sentence, next to their gate-7 verdict. The md-button-group row is corrected by this install.

## Findings
- **R1-17**: verified fixed (iOS 18.6 x5 and 26.3 x3 pass, macOS and Android unchanged, the reproducer's failing case passes with the fix). No new blocking finding.

## Verdict
PASS (s7-13, 2026-11-16). R1-17 closed; no exceptions.
