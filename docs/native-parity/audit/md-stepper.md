# Gate 7 audit — md-stepper (+md-step)

**Verdict: PASS** — gate-7 reviewer s7-16, 2026-11-16 (re-check of s7-5-01, s7-5-02, s7-5-03; the other s7-5 results stand).

Scope: `md-stepper` and `md-step`. Independent re-run on the snapshot `work/audit/s7-16-tree` (canonical copy taken after fix 9-12-stepper-ios-width-from-host).
Logs `work/claude-runner/done/s7-16-*.log`; evidence `work/audit/s7-16/`. Earlier reviews: r6 (2026-10-31 FAIL), s7-5 (2026-11-16 FAIL, s7-5-01).

## Re-runs

| Suite | Claimed / earlier | Re-run (job) |
| --- | --- | --- |
| macOS `NativeFaViewsIntegration` | 506/506 | 506/506, 8 skipped (`s7-16-002-macos`) |
| macOS `NativeStepperIntegration` / `NativeSliderRatingIntegration` | 222 / 444 | 222/222, 444/444 (`s7-16-002-macos`) |
| iPhone 26.3 `NativeStepperIntegration` | 222/222 | 222/222 (`s7-16-003-ios-iphone`) |
| **iPhone 26.3 `NativeFaViewsIntegration`** (was 406/494) | 506/506 | **506/506 twice** (`s7-16-003-ios-iphone`, two runs) |
| iPad 26.3 / iOS 18.6 iPhone `NativeFaViewsIntegration` | 506/506 | 506/506 each (`s7-16-004-ios-ipad-ios18`) |
| Android `StepperParityTest` (emulator-5566) | paint 142+6+25, states 20+20+4 | same counts, ok (`s7-16-A001-android`) |
| Android `StepperViewsTest` / `FaViews` | 93 | 93/93, ok (`s7-16-A001-android`) |
| Android `LivePreviewStepperHostTest` | 4 methods | `stepperHooksMethodsAndUpdates` ok, `standaloneStepHooksAndUpdates` ok on rerun (`s7-16-A002-android-standalone`); the one failure in A001 was "Native PixelCopy failed code 2", KNOWN-CAUSES row 12 flake |
| Laboratory live host / snapshot JS | 38 / 6 | 38 / 6 (`s7-16-005-lab`) |
| Lab probe via 4177, iOS and Android md-stepper / md-step | ok | 8/8 sessions: session, property update, next/prev/reset, Android events (`s7-16-007-lab-rerun`) |
| Examples (SwiftUI typecheck, 47 views) | ok | exit 0 (`s7-16-005-lab`) |
| tools/ax | md-step 0 open; md-stepper 4 Web `controls` relation | same (`s7-16-006-ax`); iOS pass |

Load note: A001 ran at load 182-745; every run credited here passed, no failure was excused by load.

## Findings re-checked

- s7-5-01 VERIFIED fixed: the iPhone 26.3 views run is 506/506 twice, iPad and iOS 18.6 also 506/506.
- s7-5-02 VERIFIED: Laboratory Android preview available after coordinator restart 881; Android probe passes.
- s7-5-03 closed as probe expectation: `reset()` at active 0 and `goTo` into unreachable steps emit nothing, matching Web; the corrected probe is 8/8.

## Exceptions

None proposed or accepted; typed part targets exist on both platforms.

## Open, non-blocking

The 4 Web `controls` relation findings in tools/ax (DEFECTS, 5-3) remain listed as open on the Web side; they are not native defects.
