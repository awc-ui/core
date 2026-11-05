# `md-loading-indicator` — gate 7 independent audit

**Verdict: FAIL (gate 5: default palette not compared; gate 3: no in-place property updates)**

All re-runs pass. Colour parity has only been established under the recorded mixed Laboratory palette (R2-D2), and Laboratory edits restart the continuous morph (R2-D6).

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
| 1 Source contract | PASS | 3 properties (variant uncontained|contained, label "Loading", density), no events/methods/slots, 5 hooks, part `shape`: complete in SwiftUI (`NativeLoadingIndicator.swift`, `LoadingIndicatorMotion.swift`, `LoadingIndicatorAppearance.swift`), Compose, Laboratory (`loading-indicator-appearance.js`) and tests |
| 2 Implementation | PASS | Source polygons and 4.55 s morph with overshoot/rotation; reduced-motion equivalent; zero geometry preserved |
| 3 Laboratory | **FAIL** | Sessions open on both platforms, but there is no retained update: every edit restarts the native session and resets the morph phase, which the Web element keeps (R2-D6). Examples 15+15 compile |
| 4 Behaviour | PASS | Web 23/23; Swift 1,195 contracts; Android 5 unit + 4 device methods |
| 5 Visual | **FAIL** | 84 configurations + 16 motion samples match, but only under the recorded Laboratory token maps. Every painted role (primary, primary-container, on-primary-container, secondary) is overridden there, and the "dark" map is not the library dark palette (R2-D2) |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 2 cases, 0 open |
| 7 Final audit | FAIL | R2-D2, R2-D6 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 9/9 rows complete.

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec | 23 | 23/23 | r2-009 |
| Swift macOS `NativeLoadingIndicatorViewIntegration` | 1,798 (1,195 contracts + 603 native) | 1798/1798 | r2-002 |
| iOS iPhone 17 Pro 26.3 / iPad Pro 26.3 / iPhone 16 Pro 18.6 | 1798/1798 ×3 | 1798/1798 ×3, 0 FAIL | r2-003, r2-008 |
| Swift live host `test-live-loading-indicator.mjs` | 9 | 9/9 | r2-004 |
| Android device `NativeLoadingIndicatorParityTest` + host `loadingHooksAndShortComponents…` | 6 methods (5 + focused retry) | 3/3 + 1/1 | r2-A001, r2-A002 |
| Android unit `NativeLoadingIndicatorContractTest` | 5 methods (103-case suite) | 5/5 | r2-A001 |
| Generated examples | 15 + 15 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 110/140 shared | component 59/59 (incl. loading), shared 173/173 | r2-010 |
| tools/ax | pass ×3 | pass ×3, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: SwiftUI and Compose sessions open with the recipe (`variant: contained`). The retained update is rejected (400, "Retained property updates are unavailable for this component."); the restart with `variant: uncontained` opens 200 on both. Because each edit starts a new native host, the continuously running morph restarts from phase 0. On Web the element keeps animating across attribute changes (R2-D6). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-loading-indicator/report.md`: default and contained cases, 0 open findings on macOS, iOS and Android, with no expectations used.

## Exception decisions

No proposed exceptions in the component record. Platform notes reviewed: native contrast preferences versus CSS forced-colors (explicit native forced palette, tested) are a named native equivalent, not a waiver.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- **R2-D2 (blocking, gate 5):** fresh default light/dark palette comparison missing.
- **R2-D6 (blocking, gate 3):** no retained in-place property updates.
- Doc note: `md-loading-indicator.md` still says the UIKit bridge is "uncompiled"; it is now compiled and executed by the iOS harness on all three runtimes.
