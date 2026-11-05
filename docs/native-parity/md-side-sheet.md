# Side Sheet parity checkpoint

Status: dedicated renderers implemented and verified against the Chrome oracles, in both presentations:

- **SwiftUI:** verified on macOS. The UIKit branches are written but not executed.
- **Jetpack Compose:** verified on the AwcNative emulator.
- **Modal variant:** runs in the shared [native modal layer](native-modal-layer.md).

The source contract is in [md-side-sheet-source-review.md](md-side-sheet-source-review.md), and the oracles are listed in [md-side-sheet-native-plan.md](md-side-sheet-native-plan.md).

## Contract and implementation

| | SwiftUI (`NativeSideSheet.swift`) | Compose (`NativeSideSheet.kt`) |
|---|---|---|
| Renderer | `AWCNativeView` `md-side-sheet` → `nativeSideSheet` (inside an `AWCModalScope`) | `AWCComponent` `md-side-sheet` → `NativeSideSheet` |
| Hooks (9) | `AWCSideSheetAppearance` (`AWCSideSheetShape`; `width`/`maxWidth` as `AWCSkeletonLength`, fractions of the containing block) + `.awcSideSheetAppearance(_:for:)` | `AWCSideSheetAppearance` + `AWCSideSheetAppearanceScope` |
| Parts (9) | `AWCSideSheetPart` + `.awcSideSheetPartAppearance(_:part:for:)` | `AWCSideSheetPart` + `AWCSideSheetPartAppearanceScope` |
| Methods | `AWCSideSheetController` `show()`, `close()`, `whenClosed() async` | same, with `suspend whenClosed()` |
| Slots | `AWCSideSheetSlots` (content, headline, back, close, actions) | authored slot registry |

**Standard variant**

- An inline region in the authored layout: `inline-size: min(width, 100%)`, capped by `min(max-width, 100%)`, block size 100%.
- Divider-coloured 1 pt border on the content-facing edge.
- Detached: 16 pt margins, radius 16 and elevation 1.
- No modal resources and no focus move or trap; hidden when closed.

**Modal variant**

- Fixed overlay on the logical side.
- Width: `min(width, room)`, capped by `min(max-width, room)`.
- Detached: room is `100% − 32`, block inset `max(8, 16+2d)`, elevation 3.
- Motion: `translateX(±100%)` keyed on the resolved direction, with transform, opacity and scrim at 300 ms; reduced motion removes them.

**Header, content and actions**

- Back (modal with `showBack`) and close, both icon buttons at `max(32, 40+4d)` pulled by −12−d.
- Title-large headline on one line with an ellipsis.
- Content padding `max(12, 24+2d)` × `max(8, 12+d)`.
- Actions with a `max(40, 72+4d)` minimum height.

**Events**

- `mdOpen` and `mdClose` on every open change.
- The fallback close emits `mdCancel` then `mdClose` in both variants.
- Modal Escape, Android back and the scrim emit them only when `scrimDismissible`.
  - A protected Escape is consumed.
  - A protected scrim click moves focus to the document.
- Back emits `mdBack` and stays open.
- `close()` emits `mdClose` only.
- `whenClosed()` resolves after the exit motion.

**Variant switch while open:** acquires or releases the session without events. Focus moves to the opener when switching to standard, and to the first tabbable when switching to modal.

## Evidence

Evidence lives in `outputs/native-parity/md-side-sheet/native-{swift,android}/`, each with a `checkpoint.json`.

| Suite | Swift | Android |
|---|---|---|
| Paint and geometry (178 cases): every part and the standard host, page column, back, body, role/label, radius, initial focus, flat pixels | 3,057 / 3,057 | 2,703 / 2,703 |
| Motion, events, focus, methods and variant switch (17 runs + 2 reduced) | 8,640 / 8,640 | 4,258 / 4,258 |

The mixed modal stack (13 runs with dialogs and both sheets) passes on both platforms; see [md-dialog.md](md-dialog.md).

## Laboratory (gate 3)

Installed with md-dialog and md-side-sheet; the shared details and results are in
[md-dialog.md](md-dialog.md#laboratory-gate-3). For this component: nine hooks (the corner value as `sheetShape`, applied to detached sheets; widths as affine lengths) and nine parts; methods `show`, `close` and `whenClosed`; `mdBack` from the back control; the live hosts present it in the preview viewport through `AWCModalScope`.

## Platform differences and open decisions

- **Standard-variant Tab order.** A standard sheet does not trap Tab.
  - Traversal is the host's key-view loop.
  - On macOS it is geometric, not DOM order, so the Swift test checks that Tab reaches the same controls as Chrome.
  - On Android the order is the composition order, which matches Chrome's order exactly.
- **Hidden with focus inside.**
  - A standard sheet hidden with focus inside moves focus to the document, as in Chrome.
  - On Android this uses the scope's document focus target, so keyboard mode does not move focus to a default control.
- **Open decisions recorded from the source review:**
  - Escape protection is inconsistent across the family.
  - The colour hook spans two defaults: surface for standard, surface-container-low for modal.
  - The back wrapper has no part.
  - Accessible names are hard-coded English: "Back", "Close side sheet", "Side sheet".
  - RTL motion relies on `:host-context`; native keys the offset on the resolved direction.

## Remaining work

- iOS simulator execution is done (section below). A manual VoiceOver/TalkBack pass remains outside the automated tree
  evidence ([accessibility.md](accessibility.md)).

## Session note (2026-10-24)

The mixed stack, the Laboratory and the live hosts are complete (see [md-dialog.md](md-dialog.md)).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeModalStackIntegration` | **149/149** | **149/149** | no result |
| `NativeSideSheetMotionIntegration` | 11947/11949 | **11964/11964** | 12015/12018 |
| `NativeSideSheetPaintIntegration` | **3057/3057** | **3057/3057** | **3057/3057** |
| **Total** | 15153/15155 | **15170/15170** | 15072/15075 |

Event timing: one `mdCancel` / `mdClose` 41–43 ms after its click (Chrome + 40 ms allowed) on iOS 26.3 and 18.6 with three simulators busy; with fewer, iPhone 11850/11850 (`r8i2-`), iOS 18.6 2 checks (`r8o2-`).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
