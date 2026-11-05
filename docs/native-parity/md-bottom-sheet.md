# Bottom Sheet parity checkpoint

Status: dedicated renderers implemented and verified against the Chrome oracles: SwiftUI on macOS (the UIKit branches
are written but not executed) and Jetpack Compose on the AwcNative emulator. They run inside the shared
[native modal layer](native-modal-layer.md). The source contract is in
[md-bottom-sheet-source-review.md](md-bottom-sheet-source-review.md), and the oracles are listed in
[md-bottom-sheet-native-plan.md](md-bottom-sheet-native-plan.md).

## Contract and implementation

| | SwiftUI (`NativeBottomSheet.swift`) | Compose (`NativeBottomSheet.kt`) |
|---|---|---|
| Renderer | `AWCNativeView` `md-bottom-sheet` → `nativeBottomSheet` (inside an `AWCModalScope`) | `AWCComponent` `md-bottom-sheet` → `NativeBottomSheet` |
| Hooks (16) | `AWCBottomSheetAppearance` (`AWCBottomSheetShape`, `AWCSkeletonLength` sizes) + `.awcBottomSheetAppearance(_:for:)` | `AWCBottomSheetAppearance` + `AWCBottomSheetAppearanceScope` |
| Parts (11) | `AWCBottomSheetPart` + `.awcBottomSheetPartAppearance(_:part:for:)` | `AWCBottomSheetPart` + `AWCBottomSheetPartAppearanceScope` |
| Methods | `AWCBottomSheetController` `show()`, `close()` (the source has no `whenClosed`) | same |
| Slots | `AWCBottomSheetSlots` (content, headline, close, actions) | authored slot registry |

Behaviour follows the source:

- **Geometry:**
  - Width: 100% below 640, else 640 capped at 100% − 112; detached keeps 16 margins.
  - Height: clamped between the intrinsic size, `min-height` and 80vh.
  - Bottom safe area: padding equal to the part of the system inset inside the scope.
- **Spacing:** the md3.css density rungs (inset-sm/lg/xl, gap-sm) by nearest rung.
- **Header and close button:** the header and fallback close follow the density calcs. The close button pulls by −12−d.
  Its label is "Close bottom sheet".
- **Motion:**
  - `translateY(100%)` at 400 ms emphasized; opacity and scrim at 300 ms standard; reduced motion removes all three.
  - The indicator's 100 ms transition is kept under reduced motion.
- **Drag to dismiss:**
  - A handle drag released strictly beyond 100 dp dismisses (`mdCancel`, `mdClose`) from the dragged offset.
  - At 100 dp or less, the sheet snaps back without an event.
  - Upward drags clamp to 0.
  - Cancel, lost capture or being covered by another owner returns the sheet without an event.
- **Events:**
  - Escape (always), an enabled scrim and the fallback close emit `mdCancel` then `mdClose`.
  - `close()` emits `mdClose` only.

## Evidence

Evidence lives in `outputs/native-parity/md-bottom-sheet/native-{swift,android}/`, each with a `checkpoint.json`.

| Suite | Swift | Android |
|---|---|---|
| Paint and geometry: 126 cases, every part, body, role/label, focus, flat pixels | 1,948 / 1,948 | 1,807 / 1,807 |
| Motion, drag, events and focus: 15 runs + 2 reduced, per frame within Chrome's envelope | 13,430 / 13,430 | 7,378 / 7,378 |

The mixed modal stack (13 runs with dialogs and both sheets) passes on both platforms; see [md-dialog.md](md-dialog.md).

## Laboratory (gate 3)

Installed with md-dialog and md-side-sheet; the shared details and results are in
[md-dialog.md](md-dialog.md#laboratory-gate-3). For this component: sixteen hooks (the corner value as `sheetShape`, the six sizes as affine lengths resolved against the viewport) and eleven parts; methods `show` and `close` (the source has no `whenClosed`); the live hosts present it in the preview viewport through `AWCModalScope`.

## Platform differences and open decisions

- **The 0.8 dragging indicator (open decision).** Chrome never renders the source's `--dragging` indicator opacity (0.8)
  during a handle drag. Only hover (0.6) and rest (0.4) appear, so native follows Chrome.
- **Slotted content shrinks as in the source (gate-7 R4-01, 2026-11-04).** The content is a flex column: slotted blocks shrink by
  their basis down to their minimum before the content scrolls (SwiftUI `AWCSheetFlexColumn`, Compose `AWCSheetFlexColumn` with
  min/max intrinsic heights). The sheet's natural height stays the unshrunk content. Both paint tests compare the full body box.
- **Android density hand-off.** `AWCComponent` hands renderers only the resolved density. A local rung that defines
  fewer spacing tokens than the inherited one therefore uses the defaults (`local-density-wins` case, reported as a
  deviation).
- **Hover.**
  - Native `:hover` follows pointer movement over an open sheet only. Chrome does not re-hit-test a sheet that moves
    under a still pointer.
  - On Android, the first move of a drag past the handle's bounds is reported as Exit. The drag distance is therefore
    taken from every event of the captured pointer, in root coordinates.

## Remaining work

- iOS simulator execution is done (section below). A manual VoiceOver/TalkBack pass remains outside the automated tree
  evidence ([accessibility.md](accessibility.md)).

## Session note (2026-10-24)

The mixed stack, the Laboratory and the live hosts are complete (see [md-dialog.md](md-dialog.md)). Pressing the drag handle now focuses the sheet container without a ring on SwiftUI too (Chrome focuses the nearest
focusable ancestor); the Android live host's inspection now reports a retained `variant` change at once (its snapshot follows Compose's layout).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeBottomSheetMotionIntegration` | **21594/21594** | **21899/21899** | **22929/22929** |
| `NativeBottomSheetPaintIntegration` | **1948/1948** | **1948/1948** | **1948/1948** |
| `NativeModalStackIntegration` | **149/149** | **149/149** | no result |
| **Total** | **23691/23691** | **23996/23996** | 24877/24877 |

Bottom-sheet motion and paint pass on all three runtimes (r8).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
