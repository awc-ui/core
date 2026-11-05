# Number field native implementation plan (md-number-field)

Status: Gate 1 plan. No native code has changed. It is based on
`md-number-field-source-review.md` and the provisional cloud oracle, which
must be recaptured on the Mac (Chrome 153) first.

## Current adapters

* **iOS** (`Inputs.swift` `numberField`):
  * Minus and plus buttons (labels "Decrease" / "Increase") around a centred
    `TextField` bound to `Double(text)`, padding 12, a rounded 10pt surface.
    The steppers appear for any `steppers` value except `none`, always in
    the split arrangement.
  * Typing emits `mdInput {value, formattedValue: text, reason}`. Return
    clamps to min/max, emits `mdChange` and submits the form.
  * Buttons step by `step`, clamp, and emit `mdInput` + `mdChange` with
    reason `increment-press` / `decrement-press`.
* **Android** (`AWCInputs.kt` `TextInput` with `number=true`):
  * An M3 field with `KeyboardType.Decimal`; input filtered to
    `[-+]?[0-9]*[.]?[0-9]*`.
  * Trailing −/+ `IconButton`s (default `"trailing"` placement). They step
    from the *text*, then emit `mdChange` before `mdInput`, with reason
    `step-up` / `step-down`.
  * Blur clamps unless `allowOutOfRange`, and emits `mdChange` with reason
    `blur`.

## Gap analysis

| Contract | Web | iOS | Android |
|---|---|---|---|
| Field look (filled/outlined, label motion, density) | via md-text-field | generic box, no label motion | M3 field, no density |
| `locale` + `format-options` (Intl) | yes; formatted on blur, raw while editing | no (`Double(text)`) | no (dot-decimal regex only) |
| Typed text kept verbatim, value updates when it parses | yes | value from `Double` on each change | free text, parsed on blur |
| Steps: `step`, `small-step` (Alt), `large-step` (Shift) | yes | `step` only | `step` only |
| Arrow keys, Home/End | yes | no (hardware keyboard) | no |
| Hold-to-repeat (400ms, then about 60ms) | yes | no | no |
| `snap-on-step` | yes | no | no |
| `allow-out-of-range` | yes | no (always clamps on Return) | yes |
| Wheel scrub (focus-gated, axis-aware) | yes | n/a (trackpad scroll on iPadOS: no) | n/a (mouse wheel on ChromeOS: no) |
| Steppers `inline` / `split` / `none` | inline is the default | always split | always trailing; the `"trailing"` default is not a Web value |
| Stepper disabled at min/max | yes | no | no |
| Event order / reason | `mdInput` → `mdChange`; `increment-press` / `decrement-press` / `keyboard` / `wheel` / `input-*` | matches for presses | `mdChange` → `mdInput`; reasons `step-up` / `step-down` / `blur` |
| Inner events contained | yes (D7) | n/a | n/a |
| `mdValidityChange`, `value-missing-label` | yes | no | no |
| Semantics | plain textbox (not spinbutton) | `TextField` + 2 buttons | `TextField` + 2 buttons |
| CSS hooks (5 + text-field) | yes | none | none |

## Plan

1. **Build on the shared field primitive** from the text-field plan, with
   the number keyboard (`.decimalPad` / `KeyboardType.Decimal`) and the
   locale decimal separator.
2. **Formatting.** Use `NumberFormatter` / `android.icu.text.NumberFormat`
   with the same options subset (`minimum`/`maximumFractionDigits`, style
   `currency` / `percent` / `unit`, grouping):
   * raw while editing, formatted on blur;
   * a lenient parse of the locale's characters;
   * oracle cases `nf-format-*` and `nf-locale-de-typing`.
3. **Stepping engine** (shared):
   * `step` / `smallStep` / `largeStep`, snap, clamp unless out of range;
   * reasons as on the Web;
   * order `mdInput` then `mdChange`;
   * repeat-on-hold 400ms / 60ms;
   * steppers disabled at the bounds.

   Map hardware keys (↑↓, Shift/Option, Home/End) through
   `UIKeyCommand` / `onPreviewKeyEvent`.
4. **Layouts.** `inline` (inside the field, trailing, 28pt targets with
   ≥44/48 touch area), `split` (40pt tonal circles outside, 8pt gap) and
   `none`. Map Android's `"trailing"` default to `inline`.
5. **Accessibility.**
   * iOS: `.accessibilityAdjustableAction` on the field (increment and
     decrement), with value and range in `accessibilityValue`.
   * Android: `progressBarRangeInfo` + `setProgress` semantics, or custom
     actions.

   This deliberately gives native the stepper semantics the Web lacks
   (open decision 1).
6. **Validity** through `AWCFormScope` (required, range, custom), with
   `mdValidityChange`.

## Open decisions to settle before native work

1. **Spinbutton semantics:** should the Web adopt `role=spinbutton`, or
   should native adjustable semantics be an accepted parity difference?
2. **Focusable steppers:** they are `tabindex=-1` on the Web. Native
   buttons are focusable (Full Keyboard Access / D-pad). Keep them
   focusable natively?
3. **Wheel direction under natural scrolling** (Web only today).
4. **Android `steppers="trailing"` default:** replace it with `inline`
   (source value) and treat `trailing` as an unknown value?
