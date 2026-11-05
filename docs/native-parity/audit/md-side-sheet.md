# md-side-sheet — gate 7 independent audit

**Verdict: FAIL (findings R4-04, R4-05, R4-17, R4-19, R4-20)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-side-sheet (no supporting tags; native modal layer shared with md-dialog and md-bottom-sheet). Snapshot audited:
`work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time, job r4-001). Re-runs by r4 on that snapshot (Mac lane r4,
Android lane a6 / emulator-5566, simulator AWC-r4 = iPhone 17 Pro, iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

Swift checkpoint (md5): `ModalScope.swift`, `NativeBottomSheet.swift`, `NativeDialog.swift`, `NativeSideSheet.swift` differ
from canonical → stale. Android checkpoint hashes match (Kotlin renderers unchanged since 2026-10-24) but `AWCComponent.kt`
changed 2026-10-30 23:12; iOS r8 predates the shared dispatch/focus changes. Counts below are r4 re-runs. Oracles
`side-sheet-web-*.json` / `SideSheetWeb*.json` + modal stack byte-identical and equal to the outputs web-oracle.

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: 12 properties, 4 events, 3 methods, 5 slots, 9 hooks, 9 parts (AUDIT 12/4/3/5/9).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 12 properties (`open`, `variant`, `side`, `headline`, `closeable`, `showBack`, `scrimDismissible`, `topDivider`, `bottomDivider`, `detached`, `sheetAriaLabel`, `density`) | NativeSideSheet.swift | NativeSideSheet.kt | modal-appearance.js + retained updates | side-sheet-web-paint, motion (+ reduced), host tests |
| 4 events (`mdOpen`, `mdClose`, `mdCancel`, `mdBack`) | yes | yes | event stream | motion runs, `sideSheetEdgesBackScrimAndTypedWidth` |
| 3 methods (`show`, `whenClosed`, `close`) | controller | controller | lifecycle methods with callIds | motion/methods runs |
| 5 slots (default, `back`, `headline`, `close`, `actions`) | yes | yes | content slots | paint cases |
| 9 hooks / 9 parts | `AWCSideSheetAppearance` / parts | same | Styles panel | paint cases |

All rows have all four (`matrix/md-side-sheet.txt`). The five open decisions listed in md-side-sheet.md (Escape protection
across the family, colour hook spanning two defaults, back wrapper without a part, hard-coded English names,
`:host-context` RTL motion) have no recorded decision in the source review (R4-04).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeSideSheetPaintIntegration` | 3,057/3,057 | **3,057/3,057** | r4-003 |
| macOS `NativeSideSheetMotionIntegration` | 8,640/8,640 | **9,639/9,639** (per-frame count) | r4-003 |
| macOS `NativeModalStackIntegration` | 149/149 | **149/149** | r4-003 |
| Android `NativeSideSheetParityTest` | 2,703/2,703 | **2,703/2,703** | r4-A003 |
| Android `NativeSideSheetMotionTest` | 4,258/4,258 | **4,258/4,258** | r4-A003 |
| Android `NativeModalStackTest` | 149/149 | **149/149** | r4-A003 |
| iOS sim paint | 3,057/3,057 | **3,057/3,057** | r4-010 |
| iOS sim motion | 11,947/11,949 (2 event-timing checks open) | **11,867/11,871** (r4-010) and **11,914/11,916** (r4-036): `mdCancel`/`mdClose` 40–44 ms after the step (R4-19) | r4-010 |

Test-side allowance reviewed: for the standard variant the Swift test checks only the *set* of controls Tab reaches
(`NativeSideSheetMotionIntegration.swift:198-203`) because AppKit orders the key-view loop geometrically (R4-05).

## Gate 3 — Laboratory

- 4177 probe (r4-002a): SwiftUI + Compose; update `{headline}`; `show()` → `mdOpen`, `close()` → `mdClose`; method-results
  `fulfilled` on both.
- **R4-17**: Android no-op update `{closeable:true}` (default) → 502, session lost (r4-006b); `{closeable:false}` succeeds; SwiftUI accepts both.
- Examples 111 + 111 (modal set): Swift typecheck 0 errors; Compose BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced); Studio 110/110; Android
  `LivePreviewModalHostTest` 8/8; `test-live-modal` 63/63.

## Gate 6 — runtime and accessibility

- iOS re-run on iPhone 17 Pro 26.3 only (table). Documented r8: iPhone 15,153/15,155 and iOS 18.6 15,072/15,075 had open
  event-timing checks; iPad 15,170/15,170; all predate the 2026-10-30 shared-file changes.
- tools/ax re-run: 1 case (open, standard variant: `region`): macOS pass, iOS pass, Android pass; the modal variant (`role=dialog`, `aria-modal`) has no tools/ax case (R4-20). Touch-target info entries (40 pt close, 134×40 launcher) follow the source sizes: informational.
- Focus order: R4-05.

## Exceptions

None proposed. The geometric Tab order is not accepted as a platform difference: the library already routes Tab itself for
the modal variant.

## Findings

- **R4-04** (gate 1, docs): open decisions not recorded.
- **R4-05** (gate 6/4, macOS + iOS): standard-variant Tab order geometric, order not asserted.
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- **R4-19** (gate 6, iOS): event-timing checks fail in both r4 runs (and in the documented r8 iPhone / iOS 18.6 runs).
- **R4-20** (gate 6): tools/ax has no case for the modal variant (`role=dialog`, `aria-modal`).
- R4-18 (hygiene): stale checkpoints; duplicate gate-6 AUDIT entries; "UIKit branches written, not executed" is stale.
