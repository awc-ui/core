# Gate 7 audit (s7-4, 2026-11-16): md-app-bar

**Verdict: PASS WITH ACCEPTED EXCEPTIONS** (the exceptions are the reviewed tools/ax conventions below; no `::part` exception, no blocking finding).

Reviewer: gate-7 reviewer s7-4, 2026-11-16, snapshot `work/audit/s7-4` (job `s7-4-001`). Rails of the same story (md-navigation-rail) are in `md-navigation-rail.md`.

## Re-run counts
| Suite | Platform | Result | Job |
|---|---|---|---|
| NativeAppBarPaintIntegration | macOS | 2217/2217 | s7-4-002-macos |
| NativeAppBarStatesIntegration | macOS | 1397/1397 | s7-4-002-macos |
| NativeAppBarPaintIntegration / States | iPhone 26.3 | 2217/2217; 1397/1397 x3 | s7-4-003-ios-iphone |
| NativeAppBarPaintIntegration / States | iPad 26.3 | 2217/2217; 1397/1397 x2 | s7-4-006-ios-pad |
| NativeAppBarStatesIntegration | iOS 18.6 | 1397/1397 | s7-4-007-ios18 |
| NativeAppBarPaintTest, NativeAppBarStatesTest | Android (emulator-5566) | 1/1 + 1/1 | s7-4-A001-android |
| Laboratory (test-live-nav 19 checks x2, probe 4177) | Laboratory | pass | s7-4-005-lab-ax |
| Compiled examples (Swift typecheck / Kotlin compile) | | 68/68 / BUILD SUCCESSFUL | s7-4-005, s7-4-A004 |
| tools/ax | macOS, web, iOS, Android | pass, 0 open findings | s7-4-005-lab-ax, s7-4-008-ax-android-compare |

## Exception decisions (tools/ax expectations, tools/ax/expectations.mjs)
- `banner` landmark has no macOS/iOS/Android counterpart: accepted as a platform convention (SwiftUI has no banner subrole, an AppKit bridge would drop slotted content; UIKit and Compose expose landmarks only as containers). Not a hidden defect: the bar's controls, headline and search field are exposed.
- Android search role `searchbox` -> `textbox` and the matching Tab-order row: accepted (Compose has no searchbox role, the order is identical).

## Findings
None blocking. Matrix (gate1.json): all app-bar rows have Swift, Kotlin, Laboratory and test coverage.
