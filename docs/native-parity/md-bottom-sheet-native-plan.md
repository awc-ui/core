# Bottom Sheet native implementation plan and Chrome oracles

Status: preparation only. This covers the contract inventory, gap analysis and trusted-input Chrome oracles (Chrome 153.0.8010.36, DPR 1, 2026-10-23). No native code has changed.
- The shared modal-family infrastructure (`AWCModalScope`, `AWCModalSession`, focus trap, key routing) is specified once in [md-dialog-native-plan.md](md-dialog-native-plan.md#shared-modal-infrastructure-all-three-components).
- The verified source contract is [md-bottom-sheet-source-review.md](md-bottom-sheet-source-review.md).

## Contract inventory

**Properties (13):**

| Property | Default and values |
|---|---|
| `open` | `false`; mutable, reflected |
| `variant` | `standard` \| `detached` |
| `headline` | `''` |
| `showDragHandle` | `true` |
| `closeable` | `false` |
| `scrimDismissible` | `true` |
| `topDivider` | `false` |
| `bottomDivider` | `false`; rendered only with actions |
| `sheetAriaLabel` (attribute `aria-label`) | `''` |
| `scrollShadow` | `true`; accepted, no effect |
| `headlineAlign` | `start` \| `center` \| `end` |
| `contentAlign` | `start` \| `center` \| `end` |
| `density` | `0`; values 0…−4 |

**Events (3):** `mdOpen`, `mdClose`, `mdCancel`.
- They are void, bubbling, composed and cancelable, but there is no veto.
- `mdCancel` then `mdClose` is emitted for: Escape (even with `scrimDismissible=false`), an enabled scrim, the fallback close button, and a drag release beyond the threshold.
- `close()` emits `mdClose` only.

**Methods (2):** `show()` and `close()` set state immediately. There is **no** `whenClosed()` and no `OverlayLifecycle`.

**Slots (4):**
- default: the body
- `headline`
- `close`: replaces the fallback; an authored close owns its own action
- `actions`

**Parts (11):** `scrim`, `container`, `drag-handle`, `drag-handle-indicator`, `header`, `headline`, `close`, `divider-top`, `divider-bottom`, `content`, `actions`.

**CSS hooks (16):**
- `--md-bottom-sheet-container-color`, `-container-shape`, `-content-color`, `-headline-color`, `-scrim-color`, `-drag-handle-color`, `-divider-color`, `-icon-color`
- `-width`, `-min-width`, `-max-width`, `-height`, `-min-height`, `-max-height`
- `-detached-margin`, `-content-padding-inline`

**Layout** (measured in the oracle, density d):

*Width*

| Viewport | Width |
|---|---|
| < 640 px | 100% (639 at 639) |
| ≥ 640 px | `min(640, vw−112)`, centred: 528 at 640, 640 at 800/1024 |

- **Detached:**
  - Inline and bottom insets of 16 px; width `min(max, 100%−32)` (328 at 360).
  - All corners rounded, elevation 3.
- **Standard:** top corners only, no shadow.
- **Radius:** `max(16, 28+2d)`. The custom shape value is used per corner on standard but as a shorthand on detached.

*Height*
- Intrinsic, max `80vh`.
- Short viewport 240: 192 high, chrome clipped.

*Fixture heights*
- Full fixture (handle, headline, close, 120 px body, dividers, two actions): 640×322 at d0, 640×249 at d−4.
- Basic fixture: 640×232.

*Parts*
- **Drag handle:** hit row `48+4.25d` (31 at d−4). Indicator `max(24,32+2d)` × `max(3,4+.25d)`, radius 2, on-surface-variant at opacity .4. Hover .6 and dragging .8, with 100 ms standard transitions.
- **No handle:** container top padding `max(12,24+2d)`.
- **Header:** inline padding `max(12,24+2d)`, bottom `max(4,8+d)`, gap `max(4,12+2d)`.
  - Headline `max(18,24+d)` / `max(24,32+2d)`, wraps.
  - Fallback close is an `md-icon-button` of 40 (min 32) with a 24 (min 18) glyph and a −12−d end margin. Its aria-label is "Close bottom sheet".
- **Content:**
  - Inline gutter `max(12,24+2d)` (hookable); block padding from the spacing tokens (8/16 at d0, 4/8 at d−4).
  - It is the only scroller, with a 4 px thin scrollbar.
- **Actions:** padding 24/16/24; height 80 at d0, 48 at d−4.

*Colours*
- Surface-container-low (`#F7F2FA` light); content and headline on-surface; scrim `.32`.
- Body typography inherits from the host (body-medium with density calc).

**Motion:**
- Opacity of the scrim and container: 300 ms, standard easing `cubic-bezier(.2,0,0,1)`.
- Container transform: `translateY(100%)` → 0 over 400 ms. The "emphasized" token resolves to the same `cubic-bezier(.2,0,0,1)` in this theme.
- Reduced motion removes the scrim and container transitions, but **not** the handle-indicator opacity transition. The oracle shows it still running.

**Drag-to-dismiss:**
- Applies to the primary button on the handle only, with pointer capture.
- `translateY(max(0, dy))` with transitions disabled while dragging.
- Release with dy > 100 dismisses, and the exit transition starts *from the dragged offset* (for example 150 → 232 px).
- dy ≤ 100 (exactly 100 included) snaps back over 400 ms.
- Upward drags clamp to 0.
- Pointer cancel, lost capture, hiding the handle, closing, disconnecting or being *covered by another modal* cancel silently.

**Modality and focus:**
- Both variants are modal.
- Focus goes to the first tabbable one frame after open (the close icon-button when `closeable`), otherwise to the container.
- Focus guards wrap Tab/Shift+Tab; focus that escapes is recaptured; the opener is restored on close.
- `role=dialog`, `aria-modal`. The label is an explicit label, else `aria-labelledby` = headline, else "Bottom sheet". Closed sheets are `inert` and `aria-hidden`.

## Current native state

**Swift** (`Overlays.swift` `sheet` with placement `.bottom`):
- **Wrong presentation:** a system `.sheet` with `presentationDetents([.medium, .large])` and the platform drag indicator. In the Laboratory preview it is a bottom-aligned 540 pt panel with radius 20 on all corners and a .28 scrim.
- **Wrong default:** `closeable` defaults to **true** (the source default is false).
- **Missing visuals:** the standard/detached chrome, the 640/`vw−112` breakpoint, the 80vh cap, the token colours, radius and elevation, the source handle metrics and states.
- **Wrong fallback close:** a "Close" text button instead of an icon button.
- **Missing behaviour:**
  - header/content/actions metrics and alignment props, density, the 16 hooks and the parts
  - the 300/400 ms motion and reduced motion
  - the >100 px drag rule with continuous exit
  - focus guards and the owner stack
- **Wrong events:** system interactive dismissal and the `interactiveDismissDisabled` gating do not follow the source rule that Escape always dismisses.

**Android** (`AWCOverlays.kt` → Material 3 `ModalBottomSheet` through `AWCModalBottomSheet`):
- **Close to the source:** M3 defaults are near the source in the 32×4 handle, the .32 scrim and the 640 dp max width.
- **Different gesture:** M3 has a partially-expanded state and velocity/positional-threshold dismissal, with its own spring/tween motion instead of the 400 ms transform and 300 ms fade.
- **Missing visuals:** no detached variant, no breakpoint rule (`vw−112`), no density, hooks or parts.
- **Wrong fallback close:** `closeable` defaults to **true**. Its `TextButton("Close")` emits `mdClose` without `mdCancel`.
- **Wrong header:** the headline is rendered even when empty.
- **Wrong dismissal gating:** back/Escape is gated by `scrimDismissible`.
- **Missing:** focus guards and the owner stack shared with Dialog/Side Sheet.

## Implementation plan

1. **`AWCNativeBottomSheet` / `NativeBottomSheet`** in the shared modal scope.
   - The viewport supplies the 640 breakpoint, vh and the safe-area bottom padding.
   - Add `AWCBottomSheetAppearance` (16 fields: lengths as affine CSS lengths with %/vw/vh where the source allows them; shape with per-corner semantics per variant) and `AWCBottomSheetPartAppearance` (11 parts).
2. **Drag:** a capture view on the handle (reuse the accordion chassis capture) with the exact threshold and cancellation rules. The covered callback comes from `AWCModalSession`.
3. **Motion tracks:** opacity 300 ms and transform 400 ms, both retargetable. The exit starts from the current drag offset. Under reduced motion the shell is instant but the indicator keeps its 100 ms transition.
4. **Events and focus:** exactly as above; the `scrollShadow` property is accepted with no effect.
5. **Tests:** the oracles below (geometry, flat-pixel paint, per-frame transforms and opacities at render time, drag phases, event/focus logs, stack runs), plus Laboratory integration as in the Dialog plan.

## Oracle → contract coverage

Everything below lives in `outputs/native-parity/md-bottom-sheet/web-oracle/` (manifest in `oracle-manifest.json`). The pages are in `md-bottom-sheet/web-reference/`; the harness and runner are shared from `md-dialog/web-reference/`.

| Oracle | Content | Covers |
|---|---|---|
| `web-paint.json` + 126 PNGs (`native-paint.html`) | **matrix** 48: standard/detached × light/dark × LTR/RTL × density 0/−2/−4 × 360×640/800×600 with the full fixture; basic 8; density 6 (−1/−3, inherited −4, local −1 wins); viewport 12 (280/639/640/1024 widths, 240 px short and 700 px tall heights); header combinations 8 (handle × closeable × headline); alignment 4; dividers 5; hooks 8 (all 16) + 16 single hooks; slots 2; label 1; overflow/long headline/scroll-shadow 3; `::part` styling 2; closed/hidden 3 | Part boxes with computed paint/typography/padding/radius/shadow, semantics, controls, slotted children, focus and `:focus-visible`, body overflow |
| `web-motion.json` + 72 PNGs (`native-motion.html`) | 15 runs, 72 phases, 1,489 frame samples, 40 events, 101 transition records | Pointer open; Tab/Shift+Tab through guards; Escape; scrim; fallback close; protected scrim then Escape. Drag: handle hover tint, snap-back from 60, dismiss from 150, 100 px (stays) vs 101 px (dismisses), upward clamp, detached RTL dismiss. Also no-handle, methods, dark detached, 360/800 |
| `web-motion-reduced.json` + 9 PNGs | 2 runs (open/Escape, drag dismiss) under reduced motion | Instant shell, live indicator transition |
| Stack runs in `md-dialog/web-oracle/web-modal-stack.json` | Bottom sheet over and under Dialog and Side Sheet; drag cancelled when covered | Owner stack, paint order, focus chain |

## Source/CEM drift and surprising behaviour

- **Z-order differs from ownership order.** Sheets use z-index 1000/1001 while Dialog uses 2147483646/7, so a bottom sheet opened from a dialog is the active owner yet painted beneath the dialog and its scrim (see the Dialog plan).
- **Reduced motion keeps the handle transition.** It disables the shell transitions but leaves the handle-indicator opacity transition running.
- **The width is discontinuous at the 640 px breakpoint.** It is 639 px wide at a 639 viewport and 528 px at 640.
- **The `emphasized` easing token equals the standard curve** in the shipped theme. Native should resolve the token, not hard-code the M3 emphasized curve.
- **There is no `whenClosed()`, unlike Dialog and Side Sheet,** and `show()` bypasses the shared overlay readiness.
- **Accessible names are hard-coded English:** "Close bottom sheet" and the fallback label "Bottom sheet".
- **Clicking a protected scrim moves focus to `<body>`** (shared trap gap; see Dialog).
