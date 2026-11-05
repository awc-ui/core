# md-bottom-sheet — gate 7 independent audit

**Verdict: FAIL (findings R4-01, R4-02, R4-03, R4-04, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-bottom-sheet (no supporting tags; shares the native modal layer with md-dialog and md-side-sheet). Snapshot
audited: `work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time, job r4-001). Re-runs by r4 on that snapshot (Mac
lane r4, Android lane a6 / emulator-5566, simulator AWC-r4 = iPhone 17 Pro, iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

`outputs/native-parity/md-bottom-sheet/native-swift/checkpoint.json` (md5): `ModalScope.swift`, `NativeBottomSheet.swift`,
`NativeDialog.swift`, `NativeSideSheet.swift` differ from canonical → the macOS evidence is stale. The Android checkpoint
hashes still match (the Kotlin renderers are unchanged since 2026-10-24), but `AWCComponent.kt` changed 2026-10-30 23:12.
iOS r8 (`fi-tree-r8`) has the current sheet files but older shared dispatch/focus files. Counts below are r4 re-runs.
Oracles `bottom-sheet-web-*.json` / `BottomSheetWeb*.json` and `modal-web-stack.json` / `ModalWebStack.json` are
byte-identical to each other and to `outputs/native-parity/md-bottom-sheet/web-oracle/` (sha256 matches the checkpoints).

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: 13 properties, 3 events, 2 methods, 4 slots, 16 hooks, 11 parts (AUDIT 13/3/2/4/16).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 13 properties (`open`, `variant`, `headline`, `showDragHandle`, `closeable`, `scrimDismissible`, `topDivider`, `bottomDivider`, `sheetAriaLabel`, `scrollShadow`, `headlineAlign`, `contentAlign`, `density`) | NativeBottomSheet.swift | NativeBottomSheet.kt | modal-appearance.js + retained updates | bottom-sheet-web-paint (126 cases), motion (15 + 2 runs), host tests |
| 3 events (`mdOpen`, `mdClose`, `mdCancel`) | yes | yes | event stream (probe: `mdOpen`/`mdClose`) | motion runs, stack |
| 2 methods (`show`, `close`; no `whenClosed` in source) | `AWCBottomSheetController` | same | lifecycle methods with callIds | motion runs, `bottomSheetGeometryVariantsAppearanceAndMethods` |
| 4 slots (default, `headline`, `close`, `actions`) | `AWCBottomSheetSlots` | slot registry | content slots | paint cases |
| 16 hooks / 11 parts | `AWCBottomSheetAppearance` / `AWCBottomSheetPart` | same | Styles panel | paint cases |

All rows have all four (`matrix/md-bottom-sheet.txt`). Open decisions (dialog-over-sheet paint order — native follows
Chrome's z-index order through `AWCModalPaintOrder.sourceZIndex`; the 0.8 dragging-indicator opacity Chrome never renders;
Escape consistency) are not recorded as decisions in the source review (R4-04).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeBottomSheetPaintIntegration` | 1,948/1,948 | **1,948/1,948** | r4-003 |
| macOS `NativeBottomSheetMotionIntegration` | 13,430/13,430 | **15,021/15,021** (per-frame count) | r4-003 |
| macOS `NativeModalStackIntegration` (13 mixed runs) | 149/149 | **149/149** | r4-003 |
| Android `NativeBottomSheetParityTest` | 1,807/1,807 | **1,807/1,807** | r4-A003 |
| Android `NativeBottomSheetMotionTest` | 7,378/7,378 | **7,378/7,378** | r4-A003 |
| Android `NativeModalStackTest` | 149/149 | **149/149** | r4-A003 |
| iOS sim paint | 1,948/1,948 | **1,948/1,948** | r4-010 |
| iOS sim motion | 21,594/21,594 | **21,282/21,282** (per-frame count) | r4-010 |
| iOS sim modal stack | 149/149 | **149/149** | r4-010 |

Test-side allowances reviewed:
- Slotted body height not compared when Chrome shrinks it — the renderers keep the authored height (R4-01).
- Android `local-density-wins` parts skipped (resolved-density hand-off, R4-02).
- Hover follows real pointer movement only (Chrome does not re-hit-test a moving sheet): accepted, measured browser
  behaviour mirrored. Android first drag move reported as Exit (drag distance from the captured pointer): accepted.

## Gate 3 — Laboratory

- 4177 probe (r4-002a): SwiftUI + Compose sessions; update `{headline:'Audit headline'}`; `show()` (callId) accepted →
  `mdOpen`; `close()` → `mdClose`; method-results `fulfilled` on both platforms.
- **R4-17**: on Android a no-op retained update (`{scrimDismissible:true}`, the default) returns `502 ANDROID_HOST_FAILED` and drops the session (r4-006b); a changing value (`false`) succeeds; SwiftUI accepts both.
- Examples 111 + 111 (modal set, regenerated, byte-identical): Swift typecheck 0 errors (r4-007); Compose BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced).
  Studio 110/110 (r4-008); Android `LivePreviewModalHostTest` 8/8 (r4-A003); SwiftUI `test-live-modal` 63/63 (r4-020).

## Gate 6 — runtime and accessibility

- iOS re-run on iPhone 17 Pro 26.3 only. Documented iPad r8 runs exist; the iOS 18.6 `NativeModalStackIntegration` has
  "no result" in the r8 table (harness crash, reran 149/149 per ios-harness.md) and all r8 runs predate the 2026-10-30
  shared-file changes.
- tools/ax re-run: 1 case (open): macOS "pass" only through the two Decision-7 expectations (rejected here, R4-03), iOS pass, Android pass (`dialog:Project details`).
- Expectations: "role dialog → group" and "modal: true → ∅" on macOS (Decision 7) are **rejected** — implementable through
  an AppKit accessibility container, as the library already does for `AXMenu` (R4-03). The 40 pt close-button touch target
  info entry follows the source size: informational.

## Exceptions

None proposed with the required fields. "Decision 7" in accessibility.md functions as a waiver and is rejected (R4-03).

## Findings

- **R4-01** (gates 2/5): slotted content does not shrink; test compares origin/width only.
- **R4-02** (gates 2/5, Android): local density case skipped.
- **R4-03** (gate 6, macOS): dialog role/modal state not exposed; expectation rejected.
- **R4-04** (gate 1, docs): open decisions not recorded.
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-18 (hygiene): stale checkpoints; duplicate gate-6 AUDIT entries; md-bottom-sheet.md still says UIKit branches were
  never executed.
