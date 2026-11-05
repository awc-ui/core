# Side Sheet native implementation plan and Chrome oracles

Status: preparation only. This covers the contract inventory, gap analysis and trusted-input Chrome oracles (Chrome 153.0.8010.36, DPR 1, 2026-10-23). No native code has changed.
- The shared modal-family infrastructure is specified in [md-dialog-native-plan.md](md-dialog-native-plan.md#shared-modal-infrastructure-all-three-components).
- The verified source contract is [md-side-sheet-source-review.md](md-side-sheet-source-review.md).

## Contract inventory

**Properties (12):**

| Property | Default and values |
|---|---|
| `open` | `false`; mutable |
| `variant` | `standard` \| `modal` |
| `side` | `end` \| `start` |
| `headline` | `''` |
| `closeable` | `true` |
| `showBack` | `false`; modal only |
| `scrimDismissible` | `true` |
| `topDivider` | `false` |
| `bottomDivider` | `false`; only with actions |
| `detached` | `false` |
| `sheetAriaLabel` (attribute `aria-label`) | `''` |
| `density` | `0`; values 0…−4 |

**Events (4):** `mdOpen`, `mdClose`, `mdCancel`, `mdBack`. They are void, bubbling, composed and cancelable, with no veto.
- Modal sheets emit `mdCancel` then `mdClose` on:
  - Escape and scrim click, **only when `scrimDismissible`**; when it is false, Escape is consumed (`preventDefault` + `stopPropagation`) but the sheet stays open
  - the fallback close button, always, in both variants
- The back button emits `mdBack` and leaves the sheet open.
- `close()` emits `mdClose` only.

**Methods (3):** `show()` (overlay readiness), `close()` and `whenClosed()`. Measured: about 314 ms for a modal sheet, about 31 ms for a standard one (no motion).

**Slots (5):**
- default: the body
- `headline`
- `back`: modal with `showBack` only; an authored back owns its own action
- `close`
- `actions`

**Parts (9):** `scrim`, `container`, `header`, `headline`, `close`, `divider-top`, `divider-bottom`, `content`, `actions`. There is no part on the back wrapper.

**CSS hooks (9):**
- `--md-side-sheet-container-color`, `-container-shape` (detached only), `-headline-color`, `-content-color`, `-scrim-color`, `-divider-color`, `-icon-color`
- `-width`: default `max(280, 360+16d)`
- `-max-width`: default `max(320, 400+16d)`

**Standard variant** (inline region, in normal flow):
- **Sizing:** host `inline-size: min(width, 100%)`, block size 100%. Hidden (`display:none`) when closed, with no transition.
- **Divider:** a 1 px `outline-variant` border on the content-facing edge: inline-start for `end`, inline-end for `start`. `side` selects the divider edge, not a position.
- **Surface:** `surface` (`#FFFBFE` light, `#1C1B1F` dark), no shadow.
- **Detached:** 16 px margins, radius 16, elevation 1, no border.
- **Behaviour:** `role=region`, no modal resources, no focus move or trap. Tab flows through the page and the sheet. Closing while focus is inside drops focus to `<body>`.

**Modal variant** (fixed overlay):
- **Geometry:** full height, `inline-size: min(width, 100%)` (360 at d0, 296 at d−4, 280 at a 280 viewport).
- **Surface:** surface-container-low; elevation 1 when flush, 3 when detached; scrim .32.
- **Detached:** inline inset 16, block inset `max(8,16+2d)`, height `100% − 2×inset`, radius 16, width `min(w, 100%−32)`.
- **Placement:** logical side follows direction. `end` in LTR is on the right; in RTL it is on the left.
- **Motion:** slide-in from `translateX(±100%)` with transform and opacity at 300 ms `cubic-bezier(.2,0,0,1)`. The scrim fades over 300 ms. Reduced motion removes all three.
- **Focus:** the first tabbable one frame after open (back or close), with guards wrapping and the opener restored.
- **Semantics:** `role=dialog`, `aria-modal`.

**Header and body:**
- Header padding `max(12,24+2d)` inline/top and `max(8,12+d)` bottom, with gap `max(4,12+2d)`. Header height 76 at d0, 56 at d−4.
- Headline is title-large `max(16,22+d)` / `max(22,28+d)`, on-surface-variant, one line with an ellipsis.
- Fallback back/close are `md-icon-button` at `max(32,40+4d)` with a `max(18,24+d)` glyph and −12−d edge margins. Their labels are "Back" and "Close side sheet" (English).
- Content padding `max(12,24+2d)` × `max(8,12+d)`; body-medium type with density calc; `overflow-y: scroll`.
- Actions: min height `max(40,72+4d)` (72/56), gap `max(4,8+d)`, start-aligned.
- Label: explicit label, else headline, else "Side sheet".

**Variant switch while open:** acquires or releases the modal session without `mdOpen`/`mdClose`. The oracle shows focus returning to the opener on standard and moving to the first tabbable on modal.

## Current native state

**Swift** (`Overlays.swift` `sheet` with placement `.trailing`):
- **No standard variant:** it always presents as an overlay — a system sheet, or a trailing 360 pt preview panel with radius 20.
- **Missing visuals:** `side` (only trailing exists), `detached`, logical RTL placement, the token surfaces and elevations, header/typography metrics, density, the 9 hooks and parts.
- **Missing behaviour:** the slide motion and reduced motion; Escape protection when `scrimDismissible=false`; focus guards and the owner stack; `whenClosed`.
- **Wrong events:** the close button is a text button that emits `mdClose` without `mdCancel`. The back button emits `mdBack`, which is correct.

**Android** (`AWCOverlays.kt` → full-screen `Dialog` with `Surface(fillMaxWidth(.85f), tonalElevation=4)`):
- **No standard inline variant:** it is always a dialog window.
- **Wrong geometry:** the width is 85% instead of the 360/400 rule. There is no detached shape, no slide motion and no scrim colour control.
- **Wrong events:** the close button emits `mdClose` only. Back and scrim are gated by `scrimDismissible` in `onDismissRequest`; Escape semantics are not distinguished.
- **Missing:** focus guards and the owner stack.

## Implementation plan

1. **`AWCNativeSideSheet` / `NativeSideSheet` with two presentations:**
   - **Standard:** an inline view in the authored layout, with no modal session and logical divider edges.
   - **Modal:** in the shared modal scope.
2. **Appearance:** `AWCSideSheetAppearance` (9 fields; width/max-width as affine lengths with % of the viewport or parent) and `AWCSideSheetPartAppearance` (9 parts).
3. **Motion:** physical slide offsets resolved from `side` and direction, plus opacity tracks. Instant under reduced motion and for the standard variant.
4. **Events and controller:** exactly as above, including Escape consumption when protected, `mdBack`, the variant switch without events and `whenClosed` timing.
5. **Tests and Laboratory:** same structure as Dialog and Bottom Sheet.

## Oracle → contract coverage

Everything below lives in `outputs/native-parity/md-side-sheet/web-oracle/` (manifest in `oracle-manifest.json`). The pages are in `md-side-sheet/web-reference/`.

| Oracle | Content | Covers |
|---|---|---|
| `web-paint.json` + 178 PNGs (`native-paint.html`) | **modal matrix** 96: end/start × flush/detached × light/dark × LTR/RTL × density 0/−2/−4 × 360×640/800×600 with back, close, dividers and actions; **standard matrix** 32: end/start × flush/detached × themes × directions × density 0/−4, placed inline in a flex page; density 8; viewport 8 (280/1024 × 4 presentations); hooks 8 (all 9) + 9 single; width 4 (`calc(60% − 12px)`, max-width 220 over width 500); slots 2; header 3 (`showBack` ignored on standard, not closeable, no headline); label 1; overflow 2; `::part` styling 2; closed/hidden 3 | Part boxes with paint/typography/padding/radius/border/shadow, semantics (region vs dialog), controls, slotted children, focus, body overflow, page layout |
| `web-motion.json` + 70 PNGs (`native-motion.html`) | 17 runs, 70 phases, 1,328 frame samples, 52 events, 115 transition records | Keyboard cycle with guards; open/Escape for every side × direction × 360/800; detached scrim and close; back then close; protected Escape and scrim then close; standard (no trap, close drops focus to body); standard and modal methods with `whenClosed`; variant switch while open; dark |
| `web-motion-reduced.json` + 6 PNGs | 2 runs under reduced motion | Instant shell |
| Stack runs in `md-dialog/web-oracle/web-modal-stack.json` | Modal side sheet with Dialog and Bottom Sheet in both orders | Owner stack, paint order, focus chain |

## Source/CEM drift and surprising behaviour

- **A modal side sheet opened from a Dialog renders under it** (z-index 1001 vs 2147483647) while owning focus and keys. See the Dialog plan.
- **Escape protection is inconsistent across the family.** With `scrimDismissible=false`, Escape is swallowed here but still dismisses Dialog and Bottom Sheet.
- **Clicking a protected scrim moves focus to `<body>`.** The trap does not recapture it.
- **Closing a standard sheet with focus inside leaves focus on `<body>`.** There is no restoration.
- **RTL motion relies on `:host-context([dir=rtl])` or `dir` on the host.** Chrome supports `:host-context`, but other engines (Safari, Firefox) do not, so an ancestor-only `dir` there would slide the sheet from the wrong edge. This is a source portability issue. Native should key the physical offset on the resolved layout direction.
- **The colour hooks are inconsistent.** `--md-side-sheet-container-color` is applied directly on the modal container (default surface-container-low) but through `--_container-color` (default surface) on standard, so one hook spans two different defaults.
- **The back wrapper has no part**, unlike the close wrapper (`close`).
- **Built-in accessible names are hard-coded English**, unlike Dialog's locale table.
