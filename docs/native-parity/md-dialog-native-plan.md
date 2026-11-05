# Dialog native implementation plan and Chrome oracles

Status: preparation only. This covers the contract inventory, the native gap analysis and trusted-input Chrome oracles, which were captured on 2026-10-23 with Chrome 153.0.8010.36 headless at DPR 1. No native code has changed. This document also holds the **shared modal-family infrastructure** recommendation for Dialog, [Bottom Sheet](md-bottom-sheet-native-plan.md) and [Side Sheet](md-side-sheet-native-plan.md). The verified source contract remains [md-dialog-source-review.md](md-dialog-source-review.md).

## Contract inventory

**Properties (13):**

| Property | Default and values |
|---|---|
| `open` | `false`; mutable, reflected |
| `headline` | `''` |
| `dialogAriaLabel` (attribute `aria-label`) | `''` |
| `icon` | `''` (Material Symbols name) |
| `fullscreen` | `false`; reflected |
| `scrimDismissible` | `true` |
| `locale` | `'en-US'` |
| `closeLabel`, `cancelLabel`, `okLabel` | `''` (derived from `locale`) |
| `divider` | `false`; reflected |
| `headerDivider` | `false`; reflected |
| `density` | `0`; values 0…−4, reflected |

**Events (3):**
- `mdOpen`, `mdClose` and `mdCancel` carry no payload (detail `null`). They are bubbling, composed and cancelable, but `preventDefault()` does not veto anything.
- User dismissal emits `mdCancel` and then `mdClose` in the same task. User dismissal means Escape, an enabled scrim, the fullscreen close button or the fallback Cancel button.
- The fallback OK button and `close()` emit `mdClose` only.
- A repeated `show()` while open emits nothing.
- `mdOpen` is synchronous with the open change; it fires before the first open frame.

**Methods (3):**
- `show()` waits for the shared overlay readiness, then sets `open`.
- `close()` cancels a pending `show()`.
- `whenClosed()` resolves after the shell exit motion has finished. Measured: about 318 ms after `close()` with motion; immediately under reduced motion.

**Slots (5):**
- default: the body
- `headline`, which also works in fullscreen
- `icon`: basic only
- `actions`: replaces both fallback buttons
- `header-action`: fullscreen only

Slot presence follows the host's direct children and updates dynamically.

**Parts (11):** `scrim` (basic only), `container`, `header`, `icon`, `headline`, `content`, `divider`, `actions`, `cancel-button`, `ok-button`, `close-button`.

**CSS hooks (10):**
- `--md-dialog-container-color` / `-container-shape` / `-headline-color` / `-content-color` / `-icon-color` / `-icon-size` / `-scrim-color` / `-divider-color`
- `--md-dialog-z-index` (default 2147483647)
- `--md-dialog-scrim-z-index` (default 2147483646)

**Basic layout, measured at density d:**
- **Container:** centred at (50%, 50%), inline size `calc(100% − 48px)` clamped to 280–560. Max block size is `100vh − 96`.
  - At 800×600 it is 560×212 (60 px body). At 360 it is 312 wide.
  - At 240 the min-width wins: 280 wide at x = −20, overflowing both edges.
- **Radius:** `max(16, 28+2d)`.
- **Surface:**
  - light: surface-container-high `#ECE6F0`
  - dark: `rgb(43,41,48)`
  - shadow: elevation 3, `0 4 8 3 / .15` plus `0 1 3 0 / .3`
  - scrim: `rgba(0,0,0,.32)`
- **Header:**
  - padding `max(12,24+2d)` on top/inline, gap `max(8,16+2d)`, header height 56 at d0
  - icon present: centred column; otherwise start-aligned
  - headline: `max(18,24+d)` / `max(24,32+2d)`, weight 400
- **Content:**
  - padding `max(8,16+2d)` × `max(12,24+2d)`
  - type: `max(12,14+.5d)` / `max(16,20+d)`, tracking .25
  - only the content scrolls; the shell uses `overflow: clip`
- **Actions:** padding 24 with no top padding, unless `divider` restores it; row height 64, or 88 with a divider. Default buttons are text Cancel (75.5×40) and filled OK (58×40).
- **With icon and divider:** 560×277 at d0, 560×205 at d−4.
- **Short viewports** clip the header and actions. At 800×180 the container is 84 high.

**Fullscreen layout:**
- The container is `inset:0` and fills the viewport, with radius 0, no shadow and no scrim.
- Header height `max(48,64+4d)`; close button 40×40 with a 24 px glyph and hover/press tints of 8 % and 12 % (100 ms transitions); headline is one line with an ellipsis, `max(16,22+d)` / `max(22,28+d)`.
- Content top padding is `max(12,24+2d)`.
- Actions have a min height of `max(40,56+4d)` on a content box: 72 outer at d0, 48 at d−4.

**Motion:**
- Opacity and transform run 300 ms `cubic-bezier(.2,0,0,1)` (standard).
- Basic enters from `translate(-50%, calc(-50% + 20px))` with opacity 0. Fullscreen enters from `translateY(30px)`.
- The scrim fades over the same 300 ms. Reduced motion removes the shell transitions (oracle: zero transition records).

**Modality:**
- Shared `ModalSession` owner stack per document:
  - body `overflow: hidden` while any modal owns it, with the original value and priority restored
  - only the top owner handles Escape, Tab and scrim
  - the opener is restored when the last owner closes, and a lower modal closing first forwards its opener
- **Focus:**
  - The first tabbable gets focus one frame after open; with none, the container gets it.
  - Tab and Shift+Tab wrap through the composed tabbables. Measured order: basic Cancel→OK; fullscreen close→header-action→Cancel→OK.
  - Focus that escapes is pulled back on `focusin`.
- **Escape** is handled on bubbling, so an authored child can consume it. It always dismisses, even with `scrimDismissible=false`.
- **Roles:** basic is `role=alertdialog`, fullscreen `role=dialog`. Both set `aria-modal=true`, `aria-labelledby` to the headline (an explicit label wins) and `aria-describedby` to the content. Closed dialogs are `inert` and `aria-hidden`.

**Locale labels:** 14 languages plus an English fallback. Oracle examples: de *Abbrechen/OK*, ja *キャンセル/OK*, ro *Anulează/OK*, ar *إلغاء/موافق*, xx *Cancel/OK*. Explicit labels win.

## Current native state

**Swift** (`Overlays.swift` → `sheet`, presented through `awcPreviewSheet` / `PreviewScope.swift`, or the system `.sheet` outside the Laboratory):
- **Wrong presentation:** an "Open dialog" button followed by a generic sheet. Outside the preview it is a system sheet with `presentationDetents([.large])`. Inside the preview it is a 540 pt panel with radius 20, a 0.28 black scrim and white or 0.13-grey paint.
- **Missing visuals:**
  - the theme tokens: container colour, radius 28+2d, elevation 3, .32 scrim
  - the 280–560 / `vw−48` / `vh−96` geometry, the header/content/actions metrics and typography (it uses `.title2.bold()` with 20 pt spacing and padding 24)
  - icon-centred headers; dividers are only `Divider()`
  - the fullscreen layout: 64 pt header, close glyph, header-action, bar actions
- **Missing behaviour:**
  - density, the 14-language label table and the 10 hooks; there are no parts
  - the motion values and reduced motion
  - roles: alertdialog vs dialog, the explicit-label priority, describedby
  - focus-on-open, the focus trap and order, opener restoration, the modal owner stack, the scroll-lock analogue, Escape bubbling semantics, `whenClosed`
- **Wrong events:** any system dismissal emits `mdCancel` through the binding setter. Fallback buttons are generic. The icon/header-action/headline slots are flattened into one row.

**Android** (`AWCOverlays.kt` → Material 3 `AlertDialog` through `AWCAlertDialog`):
- **Close to the source:** M3 defaults are near the source on the 28 dp radius, surface-container-high and the 280–560 width.
- **Wrong layout and buttons:** paddings, typography, icon placement and the fallback button styles (`TextButton` ×2 instead of text + filled) differ. Authored actions are composed *before* the fallback OK instead of replacing both buttons.
- **No fullscreen layout:** fullscreen is only `usePlatformDefaultWidth=false` (no header, close button, header-action or bar actions).
- **Wrong dismissal gating:** `onDismissRequest` is gated by `scrimDismissible`, so Escape/back cannot dismiss a protected dialog; the source always dismisses on Escape.
- **Missing:** dividers, density, the locale table, hooks, parts, the source motion (platform dialog animation is used instead), the focus contract, owner-stack semantics with the sheets, roles and `whenClosed`.
- **Laboratory:** previews go through `AWCPreviewScope`, which does not reproduce placement.

## Shared modal infrastructure (all three components)

Build one family layer instead of three ad-hoc presentations:

1. **`AWCModalScope` (SwiftUI) / `AWCModalScope` (Compose).** It hosts presented modals in the application's real root viewport, following the `AWCSnackbarScope`/`AWCTooltipScope` and accordion viewport pattern.
   - It provides the CSS viewport (for vw/vh, the bottom sheet's 640 px breakpoint and the side sheet's 100% caps), the safe areas and keyboard insets.
   - It paints each modal's scrim and surface above content.
   - It does **not** use platform windows/sheets in production. They cannot match geometry, motion or stacking, and they hide focus order.
   - Platform back (Android) and the Escape key route into it.
2. **`AWCModalSession`** is the owner stack, a port of `ModalSession`:
   - the top owner alone handles dismissal and keyboard
   - the underlying content is blocked from interaction and scrolling (the scroll-lock analogue)
   - the opener is captured and restored, with forwarding when a lower owner closes first
   - an `onCovered` callback (used by the bottom sheet to cancel an active drag)
   - adoption/reconnect safety
   - z-order by session order **or** by the source z-index rule (see the drift below; this needs a decision)
3. **Focus trap.** Composed traversal over native focusable descendants (the AWC focus bridge, `AWCButtonFocusHandle` and its siblings): first-focus one frame after open, container fallback, wrap in both directions, recapture of escaped focus, restoration.
4. **Key routing.** Escape is delivered to the deepest consumer first; the modal acts only if nothing consumed it, matching the bubbling listener.
5. **Shared painters and timing.** Reuse `AWCCSSTransitionTrack` for 300/400 ms cubic-bezier transitions with retargeting (close interrupted mid-open), `AWCNativeBoxShadow` (now σ = b/2 via r = b/√2), corner shapes, density calc helpers, the Material Symbols glyph renderer, and the native `md-button` / `md-icon-button` renderers for fallback controls.
6. **Pointer capture.** Drag-to-dismiss gestures (bottom sheet) reuse the accordion chassis capture views, with pointer cancel and lost-capture handling.

## Implementation plan

1. **`AWCNativeDialog` / `NativeDialog` renderers** inside the modal scope, with `AWCDialogAppearance` (10 hooks; z-index hooks become scope ordering keys) and `AWCDialogPartAppearance` (11 parts).
2. **Basic and fullscreen layouts** exactly as measured above, including the overflow behaviour: min-width overflow at 240 and header/actions clipping at short heights.
3. **Events and methods:** a `show/close/whenClosed` controller; event order and payloads as above; the label table; roles and accessibility relations.
4. **Tests against the oracles below:**
   - geometry and flat-pixel paint per case (mask authored UA buttons)
   - per-frame opacity, transform and scrim values at render time inside Chrome's envelope
   - event and focus logs, and the stack scenarios
   - reduced motion
5. **Laboratory:** `dialog-appearance.js`, live hosts, compiled examples, support policies and regenerated IR.

## Oracle → contract coverage

Everything below lives in `outputs/native-parity/md-dialog/web-oracle/`; `oracle-manifest.json` holds the hashes. The pages are in `md-dialog/web-reference/`:
- `modal-oracle.js` is the shared harness.
- `modal-oracle-runner.mjs` is a copy of the Claude runner that adds modifier chords (Shift+Tab).

Every case runs in a same-origin iframe pinned at (0,0), so the iframe is the CSS viewport and trusted CDP input lands in viewport coordinates.

| Oracle | Content | Covers |
|---|---|---|
| `web-paint.json` + 150 PNGs (`native-paint.html`) | **matrix** 72: basic/basic-icon+divider/fullscreen+header-divider+header-action × light/dark × LTR/RTL × density 0/−2/−4 × 360×640/800×600; **density** 8 (−1/−3 plus inherited `data-density=-4` and local −1 winning); **viewport** 14 (240/280/560/608/1024 widths, 180 px short and 700 px tall heights with long bodies); **hooks** 8 (all 10 hooks with alpha × variants × themes × directions) plus 10 single hooks; dividers 8; header combinations 6; slots 4; locales 6; labels 3; overflow/long headline 4; empty 2; `::part` styling 2; closed/hidden 3 | Every case records part boxes with computed paint/typography/padding/radius/shadow, container semantics (role, aria-*, inert, resolved label text), control labels and boxes, slotted child boxes, the focused element plus `:focus-visible` (open-on-load focuses the first button with a visible ring), and body overflow |
| `web-motion.json` + 73 PNGs (`native-motion.html`) | 17 runs, 73 phases, 1,320 frame samples, 49 events, 135 transition records, focus log | Pointer open from the opener; Tab/Shift+Tab cycles (basic and fullscreen); Escape; scrim; Cancel; OK; protected scrim then Escape; fullscreen close hover/press/release tints; a dialog with no focusables (focus stays on the container); `show/close/whenClosed` timing and idempotent `show`; authored actions (Accept does not close); Enter on OK; 360/800, RTL, dark |
| `web-motion-reduced.json` + 6 PNGs | 2 runs under `prefers-reduced-motion: reduce` | Zero shell transition records and instant values |
| `web-modal-stack.json` + 55 PNGs (`modal-stack.html`) | 13 runs: all 6 ordered pairs of dialog / bottom sheet / modal side sheet, each normal and lower-closes-first; bottom-sheet drag cancelled when covered | Event order per owner, Escape reaching only the top, focus restoration chain (lower-first forwards to the original opener), body overflow, paint order |

## Source/CEM drift and surprising behaviour

- **A dialog paints above any sheet opened on top of it.** The dialog surface/scrim z-index is 2147483647/6, while the sheets use 1001/1000. With a sheet opened from inside a dialog, the sheet is the top owner (it has focus, Escape and Tab), but it is drawn *under* the dialog's scrim and surface (`stack-shots/dialog-then-*-2-openB.png`). This is a source defect candidate. The native ordering policy needs a decision (match the source z-index or the owner order).
- **Clicking a protected scrim drops focus to `<body>`.** This applies with `scrimDismissible=false`. The trap's `focusin` handler never fires for a blur-to-body. Escape still works through the document listener.
- **Roles differ.** Basic uses `role="alertdialog"` even for non-alert content; fullscreen uses `dialog`.
- **The readme omits `dialogAriaLabel` (`aria-label`).** CEM and source have it.
- **The family API is uneven.** Dialog and Side Sheet expose `whenClosed()` and use `OverlayLifecycle`; Bottom Sheet has neither. Dialog localises its built-in labels; the sheets hard-code English ("Close bottom sheet", "Close side sheet", "Back", "Bottom sheet", "Side sheet").
- **Fallback buttons animate on first render.** Their md-button corner-radius transitions (400 ms, `cubic-bezier(.05,.7,.1,1)`) start on first render and appear in the transition records. They are an md-button behaviour, not the dialog's.
