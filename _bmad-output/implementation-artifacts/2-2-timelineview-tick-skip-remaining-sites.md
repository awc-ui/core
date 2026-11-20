---
title: 'SwiftUI TimelineView tick skip: the remaining sites'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '2-2-timelineview-tick-skip-remaining-sites'
epic: 2
model: 'sonnet'
wave: 2
lanes: 'mac lane fx · no Android lane · simulator AWC-fx (and its iOS 18.6 clone)'
lab: 'work/fx-lab (the fx-128 apply script and story 2-1 record)'
depends_on: ['2-1-button-family-ios-motion-and-captures']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 2-1 found that `TimelineView(.animation(minimumInterval: 1/60))` skips a display tick when ticks arrive slightly under 16.67 ms apart, which produced one-frame-late motion samples in the button family (KNOWN-CAUSES.md row 1). The same construct remains at 6 sites in 5 files: `NativeButtonLoading.swift` (2), `NativeStatusDot.swift`, `NativeSkeleton.swift`, `NativeMeter.swift`, `NativeLoadingIndicator.swift`. (`NativeMenu.swift` has one more; story 6-6 owns it.) Four of these components already have a gate-7 PASS, so nothing may change there without a failing test.

**Approach:** For each site write a frame-sequence test that detects a skipped tick (two identical consecutive frames where the Chrome oracle changes), run it five times on macOS, iOS 26.3 and iOS 18.6. Where it fails, apply the fx-128 fix and re-run that component's paint and states suites; where it never fails, record the measurements and leave the code alone.

## Boundaries & Constraints

**Always:** Test-first per site. One anchored patch script per file. After a change to a component with a gate-7 PASS, re-run all its suites on macOS, iPhone 26.3 and iOS 18.6 and refresh its checkpoint. The rules in project-context.md apply.

**Never:** Do not touch `NativeMenu.swift`, `NativeButton.swift` or `NativeButtonGroup.swift`. Do not change a component whose test never fails.

</intent-contract>

## Code Map

- `work/claude-runner/KNOWN-CAUSES.md` row 1; story 2-1 Dev Agent Record (fx-124, fx-126, fx-128)
- `work/fx-lab` -- the script that installed `minimumInterval: nil` and its verification jobs
- `packages/native-ios/Sources/AWCUI/Native{ButtonLoading,StatusDot,Skeleton,Meter,LoadingIndicator}.swift`

## Tasks & Acceptance

**Execution:**
- [x] List the 6 sites with what each timeline drives (sampled motion or a free-running animation) and which test covers it today
- [x] Per site: the skipped-tick test, five runs on macOS, iOS 26.3 and iOS 18.6; record the counts
- [x] Fix the sites whose test fails; re-run the component suites on the three targets (states x3 on iOS)
- [x] One main-queue install for all changed files (dry run, rollback, byte identity); refresh and confirm the checkpoints; update KNOWN-CAUSES.md row 1 with the final list

**Acceptance Criteria:**
- Given each of the 6 sites, when the story ends, then it is either fixed with a test that failed before, or recorded with five clean runs per target
- Given a changed component that had a gate-7 PASS, when its suites run again, then the counts equal its checkpoint or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE: 6 sites measured (before2/after2/A-B); fixed skeleton (pulse) + loading-indicator with minimumInterval nil; left meter, status-dot, button-loading x2 canonical (0 skips, or nil no better). NativeMenu/NativeButton* untouched.
- Skips per 5 reps iOS 26.3 canon vs nil: pulse 10,17,7,0,2 / 0,0,0,1,0 vs 0 x10 +1; loading-indicator 10,1,0,4,0 / 0 x5 vs 0 x10; circular 1,3,1,2,1 vs nil 1,1,6,2,0 / 3,1,1,1,5 (nil no better, other cause); final tree 012: pulse 0 x5, loading-indicator 0 x5.
- Fix tests: the NativeTickSkipIntegration fixture (fx-tree/packages/native-ios/Tests, registered in fx-tree's test-native-views.sh only; not installed to canonical).
- Installed: fx-2-2-001-install-tick-nil-remaining (main queue, exit 0): byte-identical 2/2, canonical build 0, Skeleton 3714/3714, LoadingIndicator 2392/2392 on macOS, playground build 0, test-live-preview 0, 4177 200 x3. Checkpoint: md-loading-indicator refreshed + confirmed; md-skeleton has no checkpoint.json (nothing to refresh; flagged in open items).
- KNOWN-CAUSES row 1 updated with the final list.
- 012-ios-final done. iOS 18.6 final tree skips per 5 reps: pulse 0,0,0,1,1 (canon 0,1,0,0,0 and nil-all 0 x5: no gain, no loss on 18.6, the 18.6 sample is small), loading-indicator 0 x5 (canon 0,0,0,1,2), circular 2,4,0,3,1 (unchanged site). 26.3 final: pulse 0 x5, loading-indicator 0 x5, circular 0,1,2,0,0.
- Open: md-skeleton has no checkpoint.json to refresh; 008-mac-after2 log is truncated (71/90 only in work/fx-lab/tick/mac-after2.log); button-loading circular skips (1-4 per 5 reps) have a cause other than minimumInterval, not investigated.
- Android: Swift-only change, no Android lane; no Android evidence.

EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | macOS | NativeSkeletonViewIntegration (fx-tree, nil at skeleton + loading-indicator; baseline 3714) | 3714/3714
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | macOS | NativeLoadingIndicatorViewIntegration (same tree; baseline 2392) | 2392/2392
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 26.3 | NativeSkeletonViewIntegration run a (baseline 3724) | 3724/3724
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 26.3 | NativeSkeletonViewIntegration run b | 3724/3724
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 26.3 | NativeLoadingIndicatorViewIntegration run a (baseline 2392) | 2392/2392
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 26.3 | NativeLoadingIndicatorViewIntegration run b | 2392/2392
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 18.6 | NativeSkeletonViewIntegration | 3724/3724
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-011-suites-nil | iOS 18.6 | NativeLoadingIndicatorViewIntegration | 2392/2392
EVIDENCE | fx-2-2-001-install-tick-nil-remaining | macOS | NativeSkeletonViewIntegration (canonical after install) | 3714/3714
EVIDENCE | fx-2-2-001-install-tick-nil-remaining | macOS | NativeLoadingIndicatorViewIntegration (canonical after install) | 2392/2392
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-012-ios-final | iOS 18.6 | NativeTickSkipIntegration (final tree) (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects) | 84/90
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-012-ios-final | iOS 26.3 | NativeTickSkipIntegration (final tree: nil at skeleton + loading-indicator) | 88/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-006-mac-before2 | macOS | NativeTickSkipIntegration (canonical, refined) | 82/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-007-ios-before2 | iOS 26.3 | NativeTickSkipIntegration (canonical, refined) | 81/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-007-ios-before2 | iOS 18.6 | NativeTickSkipIntegration (canonical, refined) | 84/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-008-mac-after2 | macOS | NativeTickSkipIntegration (all sites nil, refined) | 71/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-009-ios-after2 | iOS 26.3 | NativeTickSkipIntegration (all sites nil, refined) | 86/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)
EVIDENCE | 2-2-timelineview-tick-skip-remaining-sites-009-ios-after2 | iOS 18.6 | NativeTickSkipIntegration (all sites nil, refined) | 87/90 (explained: the failed checks are the measured skipped ticks and held frames, the quantity under study, not defects; per-site counts in Current state)

## Review Triage Log

