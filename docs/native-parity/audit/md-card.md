# Gate 7 audit — `md-card`

Reviewer: gate-7 reviewer s7-8, 2026-11-15 (re-check of the r3 audit of 2026-10-31). Independent of the implementing forks; no product code changed.

**Verdict: PASS** — every gate met by current re-runs.

The two items the coordinator asked to check: the iOS card lifecycle `authored-keyboard` check passes (`NativeCardLifecycleIntegration` 32/32 on iPhone 26.3 and on iOS 18.6, `s7-8-005-ios26`, `s7-8-006-ios18`; macOS 32/32); the card's r3-09/r3-10/r3-11 fixes hold (cursor/hidden 56/56, touch slop, iOS dragClick states pass on both runtimes). The dragged card has no stacking residual (it stays in its slot, as in Chrome).

## Method

- Snapshot `work/audit/s7-8-tree` (job `s7-8-001-snapshot`, 2026-11-15 13:18 Mac time, canonical after `3-1-019-install-defects-cardkb`). Reviewer lanes: Mac fi3, Android a2 (emulator-5558), simulators AWC-fi3 (iPhone 17 Pro, iOS 26.3) and AWC-fi3-ios18 (iPhone 16 Pro, iOS 18.6).
- Contract: gate-1 presence matrix regenerated from `packages/core` and the inventory (`s7-8-009-inventory`, `audit/s7-8/tools/matrix.py`, `audit/s7-8/out/matrix.txt`): every property, event, method, slot, part and hook of the tag has SwiftUI, Compose and Laboratory hits; the 59 hooks and parts of md-list-item / md-list / md-accordion-item that have no token hit in Swift/Kotlin test sources are all named in the Chrome oracle fixture JSON (list-web-fixtures / list-web-paint / accordion-web-appearance) and covered by the parts and paint suites.
- Everything below was re-run on the snapshot, not taken from earlier docs. Timing suites ran through `tools/slot.sh timing 4`. Machine load average was 25-45 during the runs.

## Re-run evidence

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | `NativeCardPaintIntegration` / `NativeCardStatesIntegration` / `NativeCardLifecycleIntegration` | `s7-8-003-swift-paint`, `s7-8-004-swift-timing` | 6912/6912, 172561/172561, 32/32 |
| iOS 26.3 | same three | `s7-8-005-ios26` | 6912/6912, 190616/190616, 32/32 |
| iOS 18.6 | same three | `s7-8-006-ios18` | 6912/6912, 178844/178844, 32/32 |
| Android | paint 6699, states 55810, lifecycle 30 checks, `NativeCardInteractionTest`, `LivePreviewCardHostTest` | `s7-8-A001-android-paint`, `s7-8-A002-android-timing` | 0 failures |
| Laboratory | live card host (click, drag events) | `s7-8-0065` (`test-live-card`) | pass |
| Examples | 37 Swift typecheck, Kotlin compile | `s7-8-0065`, `s7-8-A008` | 0 errors |
| tools/ax | 3 cases | `s7-8-007-ax-lab`, `s7-8-A007-ax-android-compare` | pass on all platforms |

## Open items

iPad 26.3 was not re-run in this session (covered by the earlier di evidence for r3-11); no blocking findings.

Previous audit: r3, 2026-10-31 (FAIL; r3-01..r3-26 all re-checked above). Findings and suggested fixes: `work/audit/DEFECTS.md`, section "Gate-7 re-check s7-8".
