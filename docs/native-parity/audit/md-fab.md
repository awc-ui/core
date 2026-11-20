# md-fab — gate-7 independent audit (re-check 3)

Reviewer: gate-7 reviewer s7-7 (story 7-7), re-check of 2026-11-15, after the round-3/4 fixes R1-12, R1-13, R1-14, R1-16 and the doc/evidence items R1-09, R1-10
(installed by main-queue fx-128-install-tick-nil, 2026-11-14). Everything below was re-run by s7-7 on a fresh snapshot `work/audit/s7-7-tree`
(taken 2026-11-15 11:35 Mac time; latest install fx-128; manifest `work/audit/s7-7/snap/`). Outputs `work/audit/s7-7/` (swift/, ios/, android/, lab/, web/, ax/, examples/, gate1/).
Jobs: s7-7-001-snapshot, -002-sim, -003-swift, -004-ios, -005-lab-web, -006-ax-mac-ios, -007-gate1, -008-ios18-rerun, a1: s7-7-A001-android, -A003-examples-kotlin, -A004-ax-android.
Simulators AWC-fi2 (iPhone 17 Pro, iOS 26.3.1) and AWC-fi2-ios18 (iPhone 16 Pro, iOS 18.6); Android emulator-5556. Timing runs through `tools/slot.sh timing 4`.
Host load: the iOS job started at load average 122 (it fell to 12-19 later), so the runs are, if anything, harsher than the fix jobs'.

## Re-run counts (claimed -> re-run)
| Suite | Claimed (DEFECTS / checkpoint) | s7-7 re-run |
|---|---|---|
| Family paint (Chrome 153 oracles) macOS / iOS 26.3 / Android | 974 | 974/974 / 974/974 / 974/974 |
| Family states macOS | 27819 (fx-127), 29358 canonical (fx-128, other suites included) | 29186/29186 |
| Family states Android | 18241 (fx-A084) | 18241/18241; device classes 133/133; unit 195/195 |
| Family states iOS 26.3 x3 | 26346, 26387, 26279 | 26018, 26659, 26522: all pass (one accepted BRACKET match each, R1-14) |
| Family states iOS 18.6 x5 | 27276, 27660, 27192 | 27073/27074 (1 FAIL), 27519, 27769, 27876, 26730: all other runs pass |
| md-button paint / states (shared fixtures) | 1086 / 645 | 1086/1086 macOS and iOS; 646/646 iOS 26.3; Android 712 / 645 |
| Laboratory 4177 probes (iOS and Android, 9 tags) | retained updates, clicks, methods | all 200; setMenuIcon, show/whenClosed/close fulfilled; split 232.5 |
| Studio / compiler / Web spec / Web e2e | | 878/878, 12/12, 612/612, all 9 tags pass |
| Examples (copied Swift / Kotlin) | | Swift typecheck 13/13 files exit 0; Kotlin compile 13 files, 364 cases, BUILD ok |
| tools/ax macOS+Web+iOS+Android | 0 open | 0 open findings on every tag; reports identical to the installed ones |
| Checkpoints (R1-10) | regenerated | all six checkpoint.json current against the snapshot (0 differing files) |

## Gate 1 matrix
Regenerated with r1's extractors (`work/audit/s7-7/gate1/`): identical to r1's round-2 matrix. The only unmatched rows are matcher artefacts already reviewed by r1:
md-segmented-button `segmentIndex`/`segmentTotal` (set-managed, covered through the set tests) and md-split-button `leading-state-layer`/`trailing-state-layer`
(built by name concatenation in `NativeSplitButton.swift` line 150 and asserted by `split-button-integration.test.mjs`). No new gap.

## Exceptions
None proposed; none accepted.

## Component evidence
FAB: `NativeFabViewIntegration` 94/94 (macOS and iOS 26.3), live host script pass; Android `NativeFabParityTest` 10/10; fab-extend-motion and click2 samples (R1-12, R1-13) pass in every family-states run.

## Findings
No blocking finding. R1-09 stays PARTIAL (non-blocking): the `Status:` line of this doc still says iOS execution and the final audit remain pending, which the evidence above supersedes.

## Verdict
PASS (gate 7, s7-7, 2026-11-15).
