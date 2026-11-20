# Gate 7 audit — `md-divider`

Reviewer: gate-7 reviewer s7-8, 2026-11-15 (re-check of the r3 audit of 2026-10-31). Independent of the implementing forks; no product code changed.

**Verdict: PASS** — every gate met by current re-runs.

All 22 earlier findings that touch the divider (r3-01 forced colours, r3-02 dark theme, r3-03 retained updates) re-checked: forced-colors case in `NativeForcedAppearanceIntegration` macOS 232/232 and iOS divider rows pass; Laboratory `update {vertical:true}` returns 200 on iOS and Android (`s7-8-007-ax-lab`, lab probe).

## Method

- Snapshot `work/audit/s7-8-tree` (job `s7-8-001-snapshot`, 2026-11-15 13:18 Mac time, canonical after `3-1-019-install-defects-cardkb`). Reviewer lanes: Mac fi3, Android a2 (emulator-5558), simulators AWC-fi3 (iPhone 17 Pro, iOS 26.3) and AWC-fi3-ios18 (iPhone 16 Pro, iOS 18.6).
- Contract: gate-1 presence matrix regenerated from `packages/core` and the inventory (`s7-8-009-inventory`, `audit/s7-8/tools/matrix.py`, `audit/s7-8/out/matrix.txt`): every property, event, method, slot, part and hook of the tag has SwiftUI, Compose and Laboratory hits; the 59 hooks and parts of md-list-item / md-list / md-accordion-item that have no token hit in Swift/Kotlin test sources are all named in the Chrome oracle fixture JSON (list-web-fixtures / list-web-paint / accordion-web-appearance) and covered by the parts and paint suites.
- Everything below was re-run on the snapshot, not taken from earlier docs. Timing suites ran through `tools/slot.sh timing 4`. Machine load average was 25-45 during the runs.

## Re-run evidence

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | `test-native-divider.sh` (45 hydrated Chrome fixtures, pixels) | `s7-8-003-swift-paint` | 276/276 |
| iOS 26.3 | `NativeDividerViewIntegration` | `s7-8-005-ios26` | 276/276 |
| Android | `NativeDividerParityTest` (paint class set, 28 classes) | `s7-8-A001-android-paint` | pass (73/73 tests of the set) |
| Laboratory | lab probe: open + `update {vertical:true}` on both platforms | `s7-8-007-ax-lab` | all 200 |
| Examples | 8 Swift examples typecheck, Kotlin compile | `s7-8-0065-playground-live-examples`, `s7-8-A008-examples-kotlin` | 0 errors |
| tools/ax | 2 cases, macOS/iOS/Android | `s7-8-007-ax-lab`, `s7-8-A007-ax-android-compare` | pass, 2 accepted conventions on each platform, 0 open |

## Open items

None.

Previous audit: r3, 2026-10-31 (FAIL; r3-01..r3-26 all re-checked above). Findings and suggested fixes: `work/audit/DEFECTS.md`, section "Gate-7 re-check s7-8".
