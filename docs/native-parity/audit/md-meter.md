# `md-meter` — gate 7 independent audit

**Verdict: FAIL (gate 5: default palette not compared; gate 3: no in-place property updates) — accepted exceptions: Android Arabic fallback width, extreme-input bounds, iOS meter text convention**

All re-runs pass, including 450 Android ICU formatter comparisons. The blocking items are R2-D3 and R2-D6.

Reviewer: gate-7 reviewer r2, 2026-10-31. Independent of the implementing forks; no product code, tests or fixtures were changed.

Snapshot: `work/audit/r2-tree`, an rsync of the canonical tree taken 2026-10-31 00:12 UTC by job `r2-001-snapshot`
(42 install jobs present, latest `fx-072-install-orgchart-apk`), build products excluded and rebuilt privately.
Runtimes: macOS 15.6.1 (24G90) arm64, Swift 6.1.2; iOS simulators iPhone 17 Pro iOS 26.3.1 (`AWC-r2`), iPad Pro 11-inch (M5)
iOS 26.3.1 (`AWC-r2-ipad`), iPhone 16 Pro iOS 18.6 (`AWC-r2-ios18`); Android 16 / API 36 emulator `emulator-5564` (AwcNative6);
Chrome 153.0.8010.36 for tools/ax Web captures. Raw outputs: [`work/audit/r2/runs`](../../../../audit/r2/runs); job logs: [`claude-runner/done/r2-*`](../../../../claude-runner/done).

Evidence freshness: the component's recorded manifests were produced on earlier trees. Their source hashes still match the
component's own TSX/CSS, but shared native files (for example `AWCNativeView.swift`, `Theme.swift`, `AWCComponent.kt`) changed
afterwards, so every count below was re-run on the snapshot. No `checkpoint.json` exists for this component; the per-suite
manifests (`*-evidence.json`, `examples/verification.json`, platform audits) play that role.

## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 14 properties (value, min, max, label, showLabel, showValue, valueText, locale, formatOptions, color incl. custom roles, variant, size, thickness, density), 7 hooks, parts circular/track/indicator/value/label: complete; `formatOptions` absent vs `{}` kept distinct in transport and examples |
| 2 Implementation | PASS | Native Intl/ICU formatting, finite extreme ranges, RTL fill mirroring with clockwise arcs; value glide implemented (`MeterMotion.swift`, Android motion test) |
| 3 Laboratory | **FAIL** | Sessions open on both platforms, but there is no retained update: editing `value` restarts the session, so the source's 300 ms value glide (`md-meter.css` L136-138, L180-183) can never be seen (R2-D6). Examples 24+24 compile |
| 4 Behaviour | PASS | Web 51/51; Swift 225 contracts; Android 3 unit + 7 device methods incl. 75×6 ICU branch comparisons |
| 5 Visual | **FAIL** | 196 configurations match under the recorded Laboratory token maps only. primary, secondary-container, on-surface and on-surface-variant are overridden there, and the dark map keeps light secondary-container #d5e8df (R2-D3) |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open (iOS 3 accepted conventions) |
| 7 Final audit | FAIL | R2-D3, R2-D6 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 26/26 rows complete.

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + axe | 51 | 51/51 | r2-009 |
| Swift macOS `NativeMeterViewIntegration` | 2,669 (225 + 2,444) | 2669/2669 | r2-002 |
| iOS ×3 runtimes | 2669/2669 ×3 | 2669/2669 ×3, 0 FAIL | r2-003, r2-008 |
| Swift live host `test-live-meter.mjs` | 19 | 19/19 | r2-004 |
| Android device `NativeMeterParityTest`, `NativeMeterFormatTest`, host `meterUsesActual300DpParent…` | 6 + 4 safety methods | 4/4 + 2/2 (incl. `nativeIcuCompatibilityBranchesMatch75IndependentIntlCases` = 450 outputs) + 1/1 | r2-A001, r2-A002 |
| Android unit `NativeMeterContractTest` | 3 methods (106-case suite) | 3/3 | r2-A001 |
| Generated examples | 24 + 24 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 140 | component 59/59 (incl. meter), shared 173/173 | r2-010 |
| tools/ax | macOS pass, iOS pass (3 accepted), Android pass | same, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: sessions open with the recipe (value 72, label, showValue) at 300×28 on both platforms. The retained update is rejected (400); the restart with `value: 30` opens 200 with the same 300×28 root. The value-glide transition a Web user sees when the value changes cannot be reproduced in the native preview (R2-D6). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-meter/report.md`: default/valuetext/circular, 0 open. Three iOS `text-extra` findings ("72%", "40%", "3 of 5 stars") match the reviewed expectation "UIKit has no meter trait: the meter is a static text read with its value". Accepted below.

## Exception decisions

**E2 — Arabic fallback glyph width on Android (recorded as awaiting final review in `md-meter.md`) — ACCEPTED.** Source: meter text uses the platform's fallback font for Arabic digits/percent (`٣٨٪؜`); macOS Chrome resolves Geeza Pro (19.33 px box). Platform/API: Compose text shaping with the system fallback `/system/fonts/NotoNaskhArabic-Regular.ttf` (16 dp). Technical reason: the bundled Roboto has Latin glyphs only and the fallback font is an OS choice. Apple's font cannot be shipped, and Chrome on Android would use the same Noto Naskh. User impact: the Arabic value text is about 3 units narrower; formatting, line height 16, host height 24 and track placement are unchanged. Tested equivalent: `NativeMeterParityTest` checks the exact string, line box and placement and logs `METER_ARABIC_WIDTH_BOUNDARY` (L84-88) rather than widening a global tolerance. Re-verified r2-A001. Scope: Arabic-script glyph advances on Android only (macOS/iOS CoreText resolve Geeza Pro and match).

**E4 — iOS meter role (tools/ax expectation) — ACCEPTED as a platform convention.** Web role=meter (macOS AXLevelIndicator matches). UIKit has no meter or level-indicator trait, so the native element is static text whose label carries the value or valueText. Evidence: r2 tools/ax iOS captures.

**Extreme-input representable bounds (proposed as explicit boundaries in the platform audits) — ACCEPTED.** Source: absurd finite lengths (for example `1e308px`) saturate at Chrome's layout limit (16,777,214 units). Affected: Compose layout constraints (32,766 physical pixels, the Constraints encoding limit), SwiftUI/CoreGraphics allocation (bounded at the measured Chrome limit). Technical reason: a native layout cannot measure or allocate beyond its constraint encoding; the source itself saturates. User impact: none for representable sizes; the inputs involved are millions of pixels. Tested native equivalent: finite saturation with applied geometry reported by inspection (Android `extremeFiniteCircleSizeAndStrokeUseAppliedFiniteDimensions`, Swift extreme-size checks inside the main fixture). Scope: inputs beyond the platform's representable layout range only.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- **R2-D3 (blocking, gate 5):** fresh default light/dark palette comparison missing.
- **R2-D6 (blocking, gate 3):** no retained in-place property updates (value glide not observable).
