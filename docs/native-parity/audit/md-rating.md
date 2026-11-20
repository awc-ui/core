# Gate 7 audit — md-rating

**Verdict: PASS** — gate-7 reviewer s7-5, 2026-11-16.

Scope: `md-rating`. Independent re-run on the snapshot `work/audit/s7-5-tree` (canonical copied 2026-11-16 02:16 Mac time, 270 installs, latest
5-3-stepper-landmark-and-wrapper-parts-052). Job logs `work/claude-runner/done/s7-5-*.log`; evidence `work/audit/s7-5/`. Findings:
[work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (s7-5 section). Earlier reviewer: r6 (2026-10-31 FAIL).

## Re-runs

| Suite | Claimed | Re-run (job) |
| --- | --- | --- |
| macOS `NativeSliderRatingIntegration` | 444/444 (fa) | 444/444 identical (`s7-5-002-macos`) |
| macOS `NativeFaViewsIntegration` (rendered views vs Chrome shots) | 494/494 | 494/494, 8 skipped (`s7-5-002-macos`) |
| iOS iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 / iPad 26.3 `NativeSliderRatingIntegration` | 444/444 | 444/444 on all three (`s7-5-003-ios`) |
| iOS iPad 26.3 `NativeFaViewsIntegration` | 494/494 | 494/494 (`s7-5-003-ios`) |
| iOS iPhone 26.3 `NativeFaViewsIntegration` | 494/494 | 406/494: the 88 failures are all md-stepper cases, none slider/rating (`s7-5-003-ios`, `s7-5-006-iphone-views-rerun`) |
| Android `SrParityTest` + `SrViewsTest` (emulator-5566) | slider paint 188+18, states 22/22, lifecycle 18/18; rating paint 113+10, states 16/16 + 4/4, lifecycle 13/13; views 115 checks | same counts, 10 tests 0 failures (`s7-5-A005-android-sr`) |
| Android `FaViewsParityTest` | 491 | 491/491 rendered cases, 11 skipped (`s7-5-A003-android`) |
| Laboratory live host JS tests | sr 27 checks, snapshot 6 | 27 / 6 pass (`s7-5-004-lab`) |
| Copied examples | 47 + 47 | Swift typecheck 47 ok (`s7-5-004-lab`), Compose compile 47 composables ok (`s7-5-A002-kotlin-ax`) |
| tools/ax macOS / Web / iOS / Android compare | 0 open | 0 open on all (`s7-5-005-ax`, `s7-5-A004-ax-android`) |

## Gate 1 — matrix

`work/audit/s7-5/gate1/matrix.md` (r6 matrix helper on the snapshot; hits are pointers). Every R6-11 hook of this component has a Chrome oracle case
(`paint-extra2.json` / `states-extra*.json` / `web-states-extra*.json`, grep-checked) and the suites above pass on them.

## R6 re-check

- R6-03 (typed parts): VERIFIED — part paint cases (`sliderPaintParts`, `ratingPaintParts`) pass on Android; macOS/iOS paint 444/444.
- R6-04 (`inset-icon` slot, md-slider): VERIFIED — the slot cases of `paint-extra2` pass on macOS 444/444, iOS, Android (slider paint extra 18/18) and the rendered views.
- R6-05 (rendered views vs Chrome): VERIFIED for slider and rating on macOS, iPad, iPhone 26.3 (no slider/rating failure in 406/494) and Android 491/491.
- R6-07 (iOS runtimes): VERIFIED — 444/444 on iPhone 26.3, iOS 18.6, iPad 26.3.
- R6-11 (hooks without tests): VERIFIED for the slider / rating hooks (value-font-family, value-line-height, min-track-length, rating state-layer-color, icon-font-family).

## Exceptions

None proposed or accepted. No `::part` exception: typed part targets exist on both platforms (`SliderRatingParts.swift`, `SliderRatingParts.kt`, `StepperParts.swift`).

## Findings

No blocking finding. Observation s7-5-02 (non-blocking, environment): the running Laboratory server 4177 has no Android SDK, so the Android live preview could not be probed through 4177 on 2026-11-16 (503 ANDROID_ADB_UNAVAILABLE); the iOS/macOS preview probe passes (session, property update, `focusRating()` on rating) and the Android live-host path is covered by `LivePreviewStepperHostTest` / the JS live-host tests. Re-probe after the coordinator restarts 4177 with ANDROID_HOME.

Staleness: the checkpoint hashes of the component's source files match canonical except the shared `tools/ax/expectations.mjs` (changed by a later install; tools/ax was re-run on the snapshot).
