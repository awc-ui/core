# `md-progress-indicator` — gate 7 independent audit

**Verdict: FAIL (gate 5: default palette not compared) — accepted exception: extreme-input bounds**

All re-runs pass, including retained Laboratory updates. The component's own record already lists the fresh default-palette comparison as pending, and it is still missing (R2-D4).

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
| 1 Source contract | PASS | 14 properties, event `mdComplete` (void, exactly once), 13 hooks, parts track/stop-indicator/active-indicator: complete in SwiftUI (`NativeProgressIndicator.swift`, geometry/motion/appearance), Compose (`NativeProgressIndicator.kt`, `NativeProgressPath.kt`, …), Laboratory (`progress-indicator-appearance.js`, retained `PROGRESS_UPDATE_PROPERTIES`) and tests; initial `complete=true` inert as in the source |
| 2 Implementation | PASS | Real wave paths, four-colour cycling, completion sequences, RTL phase |
| 3 Laboratory | PASS (note) | Retained update applied on both platforms; one transient Android 502 on open right after another session closed, 5/5 later opens fine (R2-D9, non-blocking); 20+20 examples compile |
| 4 Behaviour | PASS | Web 193/193; Swift 51 contracts; Android 6 unit + 12 device methods |
| 5 Visual | **FAIL** | 2,757 native checks against 92 configurations per theme + 52 edges, all under the recorded Laboratory maps. primary, primary-container, secondary-container and tertiary are overridden, and the "dark" track colour is the light #d5e8df. The AUDIT row itself lists "default-palette … pending" (R2-D4) |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open |
| 7 Final audit | FAIL | R2-D4 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 31/31 rows complete. The parts `stop-indicator` and `active-indicator` are addressed as `stopIndicator`/`activeIndicator` enum cases on both platforms.

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + axe + frames | 193 | 193/193 | r2-009 |
| Swift macOS `NativeProgressIndicatorViewIntegration` | 2,808 (51 + 2,757) | 2808/2808 | r2-002 |
| iOS ×3 runtimes | 2808/2808 ×3 | 2808/2808 ×3, 0 FAIL | r2-003, r2-008 |
| Swift live host `test-live-progress.mjs` | 39 | 39/39 | r2-004 |
| Android device `NativeProgressParityTest`, `NativeProgressPathOracleTest`, host (2), `NativeInteractionTest#genericProgressUsesSourceDefaultMaximum` | 9 + 4 focused + 8 host | 5/5 + 4/4 + 2/2 + 1/1 | r2-A001, r2-A002 |
| Android unit `NativeProgressContractTest` | 6 methods (112-case suite) | 6/6 | r2-A001 |
| Generated examples | 20 + 20 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 119 | component 59/59 (incl. 2 progress files), shared 173/173 | r2-010 |
| tools/ax | pass ×3 | pass ×3, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json` + `lab-probe-progress-android.json`: the SwiftUI session opens (300×10), and `update {value: 20}` is applied in place (200, revision advanced, same root). On Android the first open in r2-005 returned 502 `ANDROID_HOST_FAILED` immediately after the md-meter session closed; four repeated opens and a full pass (r2-007) all succeeded and the retained update applied. Completion behaviour (`complete` toggling) is covered by the live-host and Android host tests (39 and 2 methods). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-progress-indicator/report.md`: determinate/indeterminate/circular, 0 open on all platforms.

## Exception decisions

**Extreme-input representable bounds (proposed as explicit boundaries in the platform audits) — ACCEPTED.** Source: absurd finite lengths (for example `1e308px`) saturate at Chrome's layout limit (16,777,214 units). Affected: Compose layout constraints (32,766 physical pixels, the Constraints encoding limit), SwiftUI/CoreGraphics allocation (bounded at the measured Chrome limit). Technical reason: a native layout cannot measure or allocate beyond its constraint encoding; the source itself saturates. User impact: none for representable sizes; the inputs involved are millions of pixels. Tested native equivalent: finite saturation with applied geometry reported by inspection (Android `extremeFiniteCircleSizeAndStrokeUseAppliedFiniteDimensions`, Swift extreme-size checks inside the main fixture). Scope: inputs beyond the platform's representable layout range only.

Named native equivalents, not waivers: explicit forced-colors palette (tested) for CSS `forced-colors`; isolated reduced-motion overrides.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- **R2-D4 (blocking, gate 5):** fresh default light/dark palette comparison missing (already "pending" in the ledger).
- R2-D9 (non-blocking): transient Android live-host 502 on open.
