# `md-tooltip` — gate 7 independent audit

**Verdict: PASS WITH ACCEPTED EXCEPTIONS (Android tooltip description → live-region convention; extreme-allocation bounds)**

Every gate is met by current evidence. One intermittent tools/ax Android focus finding (1 of 3 runs) is recorded as non-blocking R2-D8.

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
| 1 Source contract | PASS | 12 properties (position 12 placements), events mdOpen/mdClose (void, cancelable, non-bubbling), methods show()/hide(), slots default (anchor)/subhead/content/actions, 11 hooks, parts popup/subhead/supporting-text/actions/text: complete in SwiftUI (`NativeTooltip.swift`, controller, scope, geometry), Compose (`NativeTooltip.kt`, `AWCTooltipController.kt`, …), Laboratory (catalog controls, `tooltip-appearance.js`, retained `TOOLTIP_UPDATE_PROPERTIES`, subhead/content text slots, lifecycle methods; the actions slot is structural and documented with copyable examples) and tests |
| 2 Implementation | PASS | Independent overlay with flip/clamp/offset/RTL, delays, Escape suppression, focus restoration |
| 3 Laboratory | PASS | Retained update; `show()`/`hide()` fulfilled with `mdOpen null` / `mdClose null` on both platforms; 42+42 examples compile |
| 4 Behaviour | PASS | Web 75/75; Swift controller 39; Android 14 unit + 13 device methods |
| 5 Visual | PASS | Default-token captures: Swift main fixture uses the generated theme (no injection), 2,600 checks + 7,156 supplemental; Android `all204NativeLayoutsMatchDefaultPaletteWebReference`, `all204NativeDefaultPaint…`, 104 supplemental |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 2 cases: 0 open in 2 of 3 Android runs (R2-D8 intermittent), 2 accepted Android conventions |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E4, E3 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 36/36 rows complete. Android tests apply the 11 hooks through the CSS-suffix mapping in `NativeTooltipParityTest.appearance()` (L28-34).

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + dynamic | 75 | 75/75 | r2-009 |
| Swift macOS controller / view / supplemental (`AWC_TOOLTIP_SUPPLEMENT_ONLY=1`) / `NativeListTooltipIntegration` | 39 / 2,590 / 7,156 / 8 | 39/39, **2600/2600**, 7156/7156, 8/8 | r2-002, r2-004 |
| iOS ×3 runtimes (view + controller) | 2600 + 39 (= 2639) ×3 | 2600 + 39 ×3, 0 FAIL (+ list tooltip 8/8 on iPhone) | r2-003, r2-008 |
| Swift live host `test-live-tooltip.mjs` | 42 | 42/42 | r2-004 |
| Android device: Parity 4, Interaction 4, `LivePreviewTooltipHostTest` 4, `NativeListTooltipTest` 1 | 13 methods | 13/13; tooltip text-slot check (presentation) passed | r2-A001, r2-A002 |
| Android unit `NativeTooltipContractTest` | 14 | 14/14 | r2-A001 |
| Generated examples | 42 + 42 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 30 | component 59/59 (incl. tooltip), shared 173/173 | r2-010 |
| tools/ax | macOS/iOS pass; Android pass, 2 accepted | macOS/iOS pass; Android: run 1 one open focus finding, reruns 1 and 2 pass with 2 accepted | r2-006, r2-A003, r2-A004 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: sessions open on both platforms (the Android recipe opens with `mdOpen null`). `update {text}` is applied in place. `show()`/`hide()` are accepted and fulfilled, with `mdOpen null` / `mdClose null` delivered through `method-results` on SwiftUI and Compose.

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-tooltip/report.md` (plain/rich): macOS and iOS pass (iOS 149×40 anchor target is info; it is the source's 40 px button). Android: both cases pass in reruns 1 and 2 (r2-A004, `_rerun-*-tooltip`). In the first batch run (r2-A003, `_first-run-tooltip`) case plain reported "android has extra Tab stops: button:", where Tab left the anchor for the Compose root. This is intermittent (R2-D8) and does not change the verdict. The two accepted Android entries are E4 below.

## Exception decisions

**E4 — Tooltip description on Android (tools/ax expectations `description` and `extra status`) — ACCEPTED as a platform convention.** Source: the anchor is described by the tooltip text (`aria-describedby`). Platform/API: Compose semantics have no description/tooltip-text property; `AccessibilityNodeInfo.tooltipText` is not reachable from Compose semantics. Native equivalent: the popup is a polite live region announced when shown (tested by `NativeTooltipInteractionTest` and tools/ax). macOS/iOS expose the description directly. User impact: TalkBack users hear the tooltip when it opens instead of as the anchor's hint. Scope: Android description channel only.

**E3 (scoped) — native extreme-allocation bounds — ACCEPTED** as in md-meter/md-progress-indicator: lengths beyond the platform's representable layout range saturate. The source's own limitation with arbitrary transformed (scaled/rotated) containing blocks is a Web-source boundary, not a native gap.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- R2-D8 (non-blocking): intermittent Android tools/ax focus finding (1/3 runs).
- Doc note: `md-tooltip.md` and the AUDIT row say "2,590 renderer" checks; the current fixture runs 2,600 (as the iOS gate-6 rows already show).
