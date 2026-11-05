# `md-status-dot` — gate 7 independent audit

**Verdict: FAIL (gate 5: default palette not compared; gate 3: no in-place property updates)**

All re-runs pass. Colours have been compared only under the recorded mixed Laboratory palette (R2-D5), and Laboratory edits restart the session, so the source's 200 ms state colour transition cannot be seen (R2-D6).

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
| 1 Source contract | PASS | 7 properties (state 6 values, size 3 values, inline, shape, live, label, density), 8 hooks, no events/methods/slots/parts: complete in SwiftUI (`NativeStatusDot.swift`, `StatusDotAppearance.swift`), Compose, Laboratory (`status-dot-appearance.js`; source-derived enum controls) and tests |
| 2 Implementation | PASS | Logical-corner/rim anchoring, inline mode, exterior pulse halo with two eased intervals, state colour transition (Swift L169-195, Kotlin L127-132) |
| 3 Laboratory | **FAIL** | Sessions open on both platforms, but there is no retained update: every edit restarts the session, so the source's 200 ms state colour transition (`md-status-dot.css` L75-81) and the running live pulse cannot be seen across an edit (R2-D6). Examples 11+11 compile |
| 4 Behaviour | PASS | Web 36/36; Swift 1,687 contracts; Android 5 unit + 4 device methods |
| 5 Visual | **FAIL** | 200 fixtures match, but only with the recorded Laboratory token maps injected (`NativeStatusDotViewIntegration.swift` L87). outline, surface and on-surface-variant are overridden there, and the "dark" map holds light values (tertiary #4b6178, primary-container #225344) (R2-D5) |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open |
| 7 Final audit | FAIL | R2-D5, R2-D6 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 15/15 rows complete (the source declares no parts).

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + axe | 36 | 36/36 | r2-009 |
| Swift macOS `test-native-status-dot.sh` | 1,687 contract + 1,001 actual | 1687 + 1001 passed | r2-002 |
| iOS ×3 runtimes | 1687/1687 ×3 | 1687 + 1001 ×3, 0 FAIL | r2-003, r2-008 |
| Swift live host `test-live-status-dot.mjs` | 15 | 15/15 | r2-004 |
| Android device `NativeStatusDotParityTest` + host `statusDotCapturesAnchors…` | 3 + 1 | 3/3 + 1/1 | r2-A001, r2-A002 |
| Android unit `NativeStatusDotContractTest` | 5 methods (91-test suite) | 5/5 | r2-A001 |
| Generated examples | 11 + 11 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 165 | component 59/59 (incl. status-dot), shared 173/173 | r2-010 |
| tools/ax | pass ×3 | pass ×3, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: sessions open on both platforms with the recipe (state online, label). The retained update is rejected (400); the restart with `state: busy` opens 200. A Web author toggling `state` sees a 200 ms colour transition, while the native preview shows a fresh mount (R2-D6). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-status-dot/report.md`: online/inline/live, 0 open on all platforms; the label is accessibility-only and live status is polite.

## Exception decisions

No proposed exceptions. The extreme-length bound shared with the other renderers is covered by E3 in md-meter/md-progress-indicator/md-skeleton (not exercised by this component's record).

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- **R2-D5 (blocking, gate 5):** fresh default light/dark palette comparison missing.
- **R2-D6 (blocking, gate 3):** no retained in-place property updates (state transition not observable).
