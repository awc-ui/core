# Color picker native implementation plan (md-color-picker)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-color-picker-source-review.md](md-color-picker-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-color-picker/web-oracle-cloud/`. Recapture it on the
  Mac (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Inputs.swift`, `colorPicker`;
preview channels in `PreviewPickers.swift`, `AWCPreviewColorPicker`; hex
parsing in `Theme.swift`, `Color(awcHex:)`):

* A `VStack`: the system `ColorPicker(label, selection, supportsOpacity:
  alpha)` (a swatch well that opens the system sheet), or in previews three
  R/G/B `Slider`s with a 48 × 32 swatch.
* Below it, `Text(value)` (read-only, monospaced) when `showHex`, and a row of
  32pt preset circles (`Button`, `accessibilityLabel` = the preset string).
* Every selection change sets `value` to `#RRGGBB` and emits `mdInput` **and**
  `mdChange` together. Alpha is never written to the hex; `format` is
  ignored.
* `Color(awcHex:)` reads 6- and 8-digit hex only. `#FFF` becomes 0x000FFF
  (dark blue), and `rgb()` / `hsl()` fall back to #6750A4.
* `presets` must be an array or a JSON string; the Web comma-separated
  attribute form yields no presets.
* Not wired: `variant`, `open` / `mdOpenChange` / `show()` / `close()`,
  `dismissOnOutsideClick`, `showInputs`, `disabled` (beyond the shared
  modifier), `density`, `locale`, preset selection state.
* The label default is "Color" (Web "Color picker").

**Android** (`packages/native-android/.../AWCOverlays.kt`, `PickerComponent`,
branch `"md-color-picker"`; `awcColor` in `AWCModel.kt`):

* Always a **built-in `OutlinedButton` trigger** (palette glyph + the value or
  "Choose color") that opens an `AWCAlertDialog` titled `ariaLabelProp` or
  "Choose color". There is no inline variant.
* The dialog holds a 64dp swatch, R/G/B `Slider`s, an Alpha slider when
  `alpha`, an `OutlinedTextField` "Hex" when `showHex`, and a `FlowRow` of
  36dp preset circles; "Apply" and "Cancel" buttons.
* Events: `mdInput` on every slider/text/preset change; `mdChange` **only on
  Apply**; `mdOpenChange {open}` on open and close.
* Output: lowercase `#rrggbb` (+ alpha byte when `alpha` and a < 1), channels
  truncated (`toInt()`), not rounded; `format="rgb"` gives `rgba(r, g, b,
  <float>)` even at alpha 1; `hsl` is not supported. The text field emits the
  raw typed text (no validation, no canonical form).
* Cancel does not revert: the sliders already wrote the local `value`.
* `dismissOnOutsideClick` defaults to **true** (Web false).
* `awcColor` handles `rgb()`, 4- and 8-digit hex and Android colour strings;
  3-digit hex and `hsl()` fall back (presets show grey).
* Not wired: `variant`, `showInputs`, `density`, `locale`, preset selection
  state, plate/hue model, keyboard steps.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Variants | `inline` (default, no trigger) and `popover` (consumer-slotted trigger, 296-wide floating panel) | System swatch well + sheet; no inline panel | Built-in button + modal dialog; no inline |
| Colour model | HSV plate (S × V) + hue track + optional alpha track | System picker (grid/spectrum/sliders) or RGB sliders | RGB sliders + alpha slider |
| Plate | 256 × 176, mirrored in RTL, drag with capture, clamps outside | None | None |
| Hue / alpha | 200 × 14 tracks, `role=slider`, mirrored in RTL; hue 0…360 | None | Alpha slider only |
| Keyboard | Plate arrows ±1/±10, Home/End S, PgUp/PgDn V; hue ±1/±15 wrapping; alpha ±0.01/±0.1 | System | Compose slider defaults (no plate) |
| Output format | `hex` (uppercase, alpha byte when a < 1), `rgb()/rgba()`, `hsl()/hsla()` | `#RRGGBB` only; alpha dropped | lowercase hex, `rgba()` always with float, no `hsl` |
| Accepted input | 3/4/6/8 hex with or without `#`, `rgb[a]()`, `hsl[a]()` | 6/8 hex only (`#FFF` wrong) | rgb, 4/6/8 hex; not 3-digit or hsl |
| Hex field | Editable; emits on each parseable keystroke; invalid → `aria-invalid`, snaps back on blur | Read-only text | Editable; emits raw text, no validation |
| Channel fields | R/G/B (+A) or H/S/L (+A) number fields, commit on `change` | None | None |
| Presets | Comma string or array; `listbox`/`option`; `aria-selected` by parsed colour; spring hover/press; dimmed when disabled | Array/JSON only; no selection state | Array/JSON only; no selection state |
| Events | `mdInput` while changing, `mdChange` on commit (release, key, blur, preset), `mdOpenChange` | Both on every change | `mdInput` live, `mdChange` on Apply |
| Popover lifecycle | Trigger toggles; Escape closes (consumed inside, so a parent dialog stays); focus returns to trigger; outside click opt-in | System sheet | Dialog; outside tap closes by default |
| Methods | `show()`, `close()` | None | None |
| Density | Panel padding/gaps 20 → 12, fields 53 → 43 | None | None |
| RTL | Plate, tracks, gradients and arrow keys mirror | System | None specific |
| Locale | `ar`, `ro` built-in labels | None | None |
| Reduced motion | Pop-in, springs, thumb press at 0.01ms | System | None |
| Forced colours / high contrast | Swatches keep their colours, fields get CanvasText borders | System | None |

## Plan

1. **Shared colour core** (both platforms). Port `color-utils.ts`
   (`parseColor`, `formatColor`, `hsvaToHex`, `rgbToHsv`, `hsvaToHsl`) with its
   spec cases, so input acceptance, rounding, uppercase hex and the alpha byte
   rule match bit for bit. Replace `Color(awcHex:)` / `awcColor` in this
   component only.
2. **Panel view** (inline and popover body): plate (S×V with the two overlays,
   mirrored in RTL), hue and alpha tracks, preview, hex field, channel fields
   per `format`, presets. Geometry and colours from `paint.json` (296 wide,
   padding 20, plate 176, tracks 14, thumbs 22, presets 32).
3. **Gestures and keys**: plate and track drags with clamping and release
   outside; keyboard steps and endpoints exactly as recorded in
   `states.json` (including the hue End → 0 wrap until that decision is made).
4. **Events**: `mdInput` only when the formatted string changes; `mdChange` on
   commit, including the no-change commits Web emits today (or as decided).
   Match the order recorded in the oracle (`mdInput` then `mdChange`).
5. **Popover variant**: consumer trigger (no built-in one), anchored panel,
   `open` / `mdOpenChange`, `show()` / `close()`, Escape/back closes and returns
   focus to the trigger, outside tap only with `dismissOnOutsideClick`.
   Android: replace the dialog for `variant="popover"`; keep no dialog for
   inline.
6. **Accessibility**: plate as an adjustable element with a value description
   (Web has none today; see decisions), hue/alpha as adjustable sliders,
   presets as selectable options with the selected trait, localized labels
   (`en`, `ar`, `ro`).
7. **Density, RTL, reduced motion, high contrast** per the oracle.
8. **Contracts**: add the parity tests per platform against the recaptured
   oracle (paint matrix, per-frame drag samples, keyboard sequences, event
   order).

## Open decisions to settle before native work

* Enter in the hex field: keep the blur (focus to body) or commit in place.
* `mdChange` without a change (blur without edit, re-click, endpoint keys).
* Alpha typed while `alpha=false`; hex text canonicalisation on commit.
* Hue end-point: pointer 360 vs End → 0.
* Grey colours resetting the hue.
* Plate accessible value text; preset arrow-key navigation / roving tabindex;
  popover focus on open and `aria-modal`.
* Popover close animation (documented, never applied) and placement
  (flip/clamp).
* Whether reduced motion should also remove the 200ms preview colour fade.
* Translatable field labels.
