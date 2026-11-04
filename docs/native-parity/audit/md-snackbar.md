# `md-snackbar` — gate 7 independent audit

**Verdict: FAIL (documentation only: the component checkpoint doc is missing) — all behavioural, visual, runtime and accessibility gates pass; platform differences accepted**

Re-run results match every claimed count. `docs/native-parity/md-snackbar.md` does not exist, so the AUDIT row's links (including the gate-6 anchor) are dead, and the platform differences are recorded only in the platform audit (R2-D7). Once that doc lands, the verdict becomes PASS WITH ACCEPTED EXCEPTIONS.

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
| 1 Source contract | PASS | 11 properties, events mdOpen (void) / mdAction (void) / mdClose `{reason: auto|action|close}`, methods show()/hide(reason), slots default/action/close, 7 hooks, parts surface/message/actions/close/close-icon: complete in SwiftUI (`NativeSnackbar.swift`, `SnackbarController.swift`, `SnackbarScope.swift`, …), Compose (`NativeSnackbar.kt`, `AWCSnackbarController.kt`, …), Laboratory (catalog controls, `snackbar-appearance.js`, retained `SNACKBAR_UPDATE_PROPERTIES`, lifecycle methods with call IDs, default text slot; action/close are structural slots documented with copyable per-slot examples) and tests |
| 2 Implementation | PASS | Root scope with nine positions, 600 pt compact breakpoint, timers, peer ordering, 250/200 ms emphasized motion, reduced motion |
| 3 Laboratory | PASS | Retained update; `show()` and `hide("action")` accepted and fulfilled on both platforms, with `mdClose {"reason":"action"}` delivered; 38+38 examples compile |
| 4 Behaviour | PASS | Web 80/80; Swift controller 27; Android 12 unit + 13 device methods |
| 5 Visual | PASS | Checked-in fixtures are the font-only default-token captures (61 per theme + 48 part cases + motion); Swift injects no tokens; Android `all122PristineDefaultPaletteCasesPaintWithoutInjectedTokens` |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open (iOS touch-target info only); macOS announcement "Changes archived" observed |
| 7 Final audit | **FAIL (docs)** | R2-D7 |

## Gate 1 — source contract matrix

Built by `work/audit/r2/tools/contract.py` (TSX `@Prop/@Event/@Method`, `<slot>`, `part=`, CSS `var(--md-…)` versus `packages/native-compiler/generated/catalog.json`; catalog source hash = sha256(TSX + CSS) matches today's source) and `tools/matrix.mjs` (each row located in the SwiftUI sources, Compose sources, Laboratory module and Swift/Android/Studio tests), followed by manual inspection of every zero cell. Result: 31/31 rows complete. The part `close-icon` is `AWCSnackbarPart.CloseIcon` / `.closeIcon`.

## Re-run counts (claimed → r2)

| Suite | Claimed | r2 result | Job |
|---|---|---|---|
| Web spec + axe | 80 | 80/80 | r2-009 |
| Swift macOS `NativeSnackbarViewIntegration` / `NativeSnackbarControllerIntegration` | 2,987 / 27 | 2987/2987, 27/27 | r2-002 |
| iOS ×3 runtimes (view / controller) | 2987 + 27 (= 3014) ×3 | 2987 + 27 ×3, 0 FAIL | r2-003, r2-008 |
| Swift live host `test-live-snackbar.mjs` | 51 | 51/51 | r2-004 |
| Android device: Parity 4, Parts 2, Interaction 2, Motion 1, `LivePreviewSnackbarHostTest` 4 | 13 methods | 13/13; `snackbarSlotReplacesMessage…` (presentation) 1/1 | r2-A001, r2-A002 |
| Android unit `NativeSnackbarLifecycleTest` | 12 | 12/12 | r2-A001 |
| Generated examples | 38 + 38 | byte-identical; Swift macOS + iOS-sim typecheck; Kotlin compile | r2-004, r2-A002 |
| Studio tests | 240 shared | component 59/59 (incl. 2 snackbar files), shared 173/173 | r2-010 |
| tools/ax | pass ×3 | pass ×3, 0 open | r2-006, r2-A003 |

## Gate 3 — Laboratory

`../../../../audit/r2/runs/lab/lab-probe.json`: sessions open on both platforms (`mdOpen null` on open). `update {message}` is applied in place. `show()` → `methodCall accepted`, then `method-results` → `fulfilled`. `hide("action")` → fulfilled, with event `mdClose {"reason":"action"}`. After hiding, the SwiftUI root moves off-canvas (y 240) and the Compose inspection is empty (closed).

## Gate 6 — runtime and accessibility

tools/ax `../../../../audit/r2/runs/ax/md-snackbar/report.md`: open/assertive/message-only, 0 open on all platforms. Tab order Undo → Dismiss matches Web, assertive is exposed as an alert, and the macOS host observed the announcement of the updated message. iOS reports 40×40 / 65×40 touch targets as info: these are the source's own 40 px controls.

## Exception decisions

**E5 — Overlay ownership and authored labels (platform audit `packages/native-ios/audits/md-snackbar.md`, "Platform boundaries") — ACCEPTED.** Source: snackbars in one document share a stack owned by the document overlay; a message slot's announcement text is its DOM `textContent`. Platform/API: one `AWCSnackbarScope` root per native window/scene (SwiftUI and Compose); arbitrary native view builders. Technical reason: native windows/scenes have no shared document, and a native view has no textContent to derive. User impact: snackbars in different windows do not stack together; an author who supplies a custom view must pass `accessibilityLabel`. Tested equivalent: peer ordering, Escape across peers, detach/reattach and announcement text in `NativeSnackbarViewIntegration` and the Android interaction/host tests (re-run above). Scope: cross-window stacking, and the announcement text of arbitrary native slot views. These must be copied into the component doc requested by R2-D7.

Named native equivalents, not waivers: explicit forced-colors border option (tested), system reduced motion.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

- **R2-D7 (blocking, documentation):** write `docs/native-parity/md-snackbar.md` (contract, evidence, E5 record, gate-6 section).
