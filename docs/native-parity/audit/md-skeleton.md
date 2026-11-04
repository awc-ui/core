# `md-skeleton` — gate 7 independent audit

**Verdict: PASS WITH ACCEPTED EXCEPTIONS (extreme-input bounds; native busy-indicator role on macOS/iOS)**

Every gate is met by current evidence, including the fresh default-palette comparison, which I re-ran on Swift (1,974) and Android (212 configurations).

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
| 1 Source contract | PASS | 10 properties (variant, animation, lines, width, height, fullWidth, fullHeight, ariaLabelProp→`aria-label`, announce, density), 11 hooks, parts shape/line/line-last (`AWCSkeletonPart.LineLast` cascades after `Line`): complete in SwiftUI, Compose, Laboratory (`skeleton-appearance.js`, `skeleton-length.js`, retained `SKELETON_UPDATE_PROPERTIES`) and tests |
| 2 Implementation | PASS | `AWCSkeletonLength` keeps pt/%/em/rem/ch/calc; entrance, pulse, wave, reduced motion |
| 3 Laboratory | PASS | Retained update (`lines: 5`) applied in place on both platforms; 27+27 examples compile |
| 4 Behaviour | PASS | Web 17/17; Swift 25 contracts; Android 14 unit methods (135 CSS motion samples) + 6 device methods |
| 5 Visual | PASS | 106 configurations per theme under the recorded maps, **and** the fresh font-only default palette (light + dark): Swift 1,974/1,974 with no token injection, Android `all212PristineDefaultPaletteCasesMatchWithoutTokenInjection`. The original oracle was captured before the 20:20 TSX change (web-evidence.json records the older TSX hash); the default-palette capture (21:08) post-dates that change and passes |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 2 cases, 0 open (macOS and iOS one accepted convention each) |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E3, E4 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 24/24 rows complete. The part `line-last` is `AWCSkeletonPart.LineLast` (Compose) / `.lineLast` (SwiftUI).

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + axe | 17 | 17/17 | r2-009 |
| Swift macOS `NativeSkeletonViewIntegration` | 3,714 (25 + 3,689) | 3714/3714 | r2-002 |
| iOS iPhone 17 Pro 26.3 / iPad Pro 26.3 / iPhone 16 Pro 18.6 | 3724 / 3714 / 3724 | 3724 / 3714 / 3724, 0 FAIL (frame-sampled totals depend on the device) | r2-003, r2-008 |
| Swift default palette (`AWC_SKELETON_NATIVE_DEFAULT_PALETTE=1`, oracle `outputs/native-parity/md-skeleton/default-palette`) | 1,974 | 1974/1974 | r2-004 |
| Swift live host `test-live-skeleton.mjs` | 42 | 42/42 | r2-004 |
| Android device `NativeSkeletonParityTest` (incl. 212 pristine default-palette cases) + host (2) | 3 + 2 host methods | 4/4 + 2/2 | r2-A001, r2-A002 |
| Android unit `NativeSkeletonContractTest`, `NativeSkeletonMotionOracleTest` | 14 methods | 13/13 + 1/1 | r2-A001 |
| Generated examples | 27 + 27 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 118 / 82 | component 59/59 (incl. 2 skeleton files), shared 173/173 | r2-010 |
| tools/ax | macOS/iOS pass with 1 accepted each, Android pass | same, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: sessions open on both platforms with the recipe (lines 3, wave, fullWidth in the 260×160 parent). `update {lines: 5}` is applied to the mounted root (200; the next frame has the new revision). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-skeleton/report.md`: announce/silent, 0 open. On macOS and iOS the announced skeleton is the platform busy indicator named "Loading" (expected `extra`/`role` entries), and the decorative case is hidden. Android exposes the polite status.

## Exception decisions

**E4 — Loading role on macOS/iOS (tools/ax expectations) — ACCEPTED as a platform convention.** Web: role=status "Loading" (polite). SwiftUI cannot set the AXApplicationStatus subrole (macOS), and UIKit has no status trait. Both platforms present loading placeholders as their busy/activity indicator named with the authored label and announce it politely on appear (macOS announcement observed by tools/ax). Decorative (`announce=false`) skeletons are hidden on every platform. Re-verified in r2-006.

**Extreme-input representable bounds (proposed as explicit boundaries in the platform audits) — ACCEPTED.** Source: absurd finite lengths (for example `1e308px`) saturate at Chrome's layout limit (16,777,214 units). Affected: Compose layout constraints (32,766 physical pixels, the Constraints encoding limit), SwiftUI/CoreGraphics allocation (bounded at the measured Chrome limit). Technical reason: a native layout cannot measure or allocate beyond its constraint encoding; the source itself saturates. User impact: none for representable sizes; the inputs involved are millions of pixels. Tested native equivalent: finite saturation with applied geometry reported by inspection (Swift caps text rows at 4,096 and Android at 8,192 rows; both bound lengths before allocation (platform audits)). Scope: inputs beyond the platform's representable layout range only.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None blocking. Doc note: `md-skeleton.md` still says iOS execution is outstanding; the gate-6 section and these re-runs close that.
