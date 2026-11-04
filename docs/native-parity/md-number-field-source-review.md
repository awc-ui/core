# Number field source review (md-number-field)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried below.
* Two source defects are fixed test-first and mirrored into
  `packages/core/src` (D1 and D7).
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux, and must be recaptured on the Mac (Chrome 153) and diffed before it
gates native work. No native code has changed.


Native checkpoint (2026-10-31): Mac Chrome 153 oracles (job n3-001); dedicated SwiftUI and Compose renderers, the Laboratory integration and the accessibility evidence are installed and recorded — see [md-number-field.md](md-number-field.md) (open items listed there).
## Composition

* An inner `md-text-field` (`part=field`) supplies the label, variant,
  density, supporting and error text, and focus. Its input is a plain text
  input with `inputmode` numeric or decimal. It is deliberately **not**
  `type=number` and **not** `role=spinbutton`.
* Steppers are `md-icon-button`s (`part=increment` / `part=decrement`,
  `tabindex=-1`):
  * `inline`: both at the trailing end, inside the field.
  * `split`: decrement at inline-start and increment at inline-end, outside
    the field.
  * `none`.
* Form-associated. The form value is the raw number; empty submits nothing.

## Public contract

* **Value:** `value` is a number or `null`. The text is display state:
  `locale` plus `format-options` (`Intl.NumberFormat` options, as an object
  or JSON).
  * Typing is filtered to the locale's characters and kept verbatim.
  * `mdInput` fires whenever the parsed value moves.
  * Blur and Enter reformat. They also clamp, unless
    `allow-out-of-range`.
* **Steps:**
  * Sizes: `step` (1), `small-step` (0.1, Alt) and `large-step` (10, Shift).
  * Keys: ArrowUp / ArrowDown step; Home / End jump to a defined `min` /
    `max`.
  * `snap-on-step` snaps to multiples of the step.
  * Stepping always clamps and commits (`mdInput` + `mdChange`).
  * Holding a stepper repeats after 400ms, then about every 60ms.
* **Wheel:** `allow-wheel-scrub`, only while the input is focused. Ctrl+wheel
  is never taken. Down decrements; Shift steps by `large-step` and Alt by
  `small-step`. A horizontal-only scroll is left to the page (fix D1).
* **Validity:** `required` (`value-missing-label`), range errors, `error` /
  `error-text`, `reserve-supporting-space`, and `mdValidityChange` (not
  composed).
* **Events:** `mdInput` / `mdChange`
  `{value, formattedValue, reason}`, where `reason` is `input-change`,
  `input-clear`, `input-blur`, `keyboard`, `increment-press`,
  `decrement-press`, `wheel` or `none`. Plus `mdValidityChange`. The inner field's events are contained
  (fix D7).
* **Methods:** `setFocus`, `select`, `stepUp(n)`, `stepDown(n)`,
  `getValidity`, `checkValidity`, `reportValidity` and
  `setCustomValidity`.
* **Labels:** `increment-label` ("Increment") and `decrement-label`
  ("Decrement").
* **CSS hooks:** `--md-number-field-{min-width, split-stepper-size,
  stepper-color, stepper-icon-size, width}` plus every text-field hook
  through `part=field`.

## Layout and paint reference

* **Field:** the text-field ladder (56…40px).
  * **Inline steppers:** 28×28 buttons at x 252 and 284 in a 320 field
    (y 14), on-surface-variant `#49454F`.
  * **Split steppers:** 40×40 secondary-container (`#E8DEF8`) circles at
    x 0 and 280 (y 8), with an 8px gap to a 224-wide field.
  * At `min` / `max` the matching stepper is disabled: an on-surface 12%
    fill with a 38% glyph.
* **Locales:** de-DE `1.234,50`; en-US currency `$1,234.50`; fr-FR percent
  `25,6 %`; ar-EG Arabic-Indic digits; en-IN `12,34,567`; unit `72 kg`.
* RTL mirrors the stepper order. The number text itself stays in its
  locale's direction.

## Interaction reference

Runs: `nf-keyboard-{inline,split}-{ltr,rtl}`, `nf-steppers-pointer`,
`nf-wheel-scrub` and `nf-locale-de-typing`.

* **Keyboard** from value 5 (min 0, max 100): ↑ 6, Shift+↑ 16, Alt+↓ 15.9,
  End 100, ↑ at max stays 100, Home 0, typed `12.5` + Enter 12.5, typed `250`
  then Tab clamps to 100. Each step emits `mdInput`, then `mdChange`.
* **Hold:** the first step lands on press. The repeats come at about 450,
  517 and 583ms, and stop at `max`.
* **Wheel:** an unfocused wheel is ignored. Up gives +1, down −1 and
  Shift+down −10. A horizontal pan is ignored and the page scrolls.
* **de-DE:** typing `9876,5` updates `value` live; Tab reformats to
  `9.876,50` and emits `mdChange`.
* **Reduced motion:** only the inner field's label and outline motion
  change (they become instant).

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix.

* **D1. Horizontal and Shift wheel always incremented**
  (`md-number-field.tsx` `handleWheel`; readme).
  * The bug: the direction came from `deltaY` only. A trackpad pan or tilt
    wheel (`deltaY` 0) counted as "up", so it stepped by +1 and the page
    could not scroll. Shift+wheel, which Chromium and WebKit deliver as
    `deltaX`, always went up by `large-step`.
  * The fix: a vertical delta steps. A horizontal-only delta steps only with
    Shift (in its own direction). Otherwise the event is left alone, not
    prevented.
  * Test: `md-number-field.wheel-axis.e2e.ts`, 5 tests. Two are guards that
    passed before the fix: Shift with `deltaY`, and a diagonal scroll.
* **D7. The inner text field's `mdSearch` escaped the host**
  (`md-number-field.tsx`: `onMdSearch` is now contained; readme).
  * The bug: every keystroke leaked an `mdSearch` with a string detail from
    the internal `md-text-field`. The first cloud oracle recorded it too, and
    the number-field state runs were recaptured after the fix.
  * Test: `md-number-field.events.e2e.ts`, 1 test.

## Observed, not changed (decisions needed)

1. **Role:** the field is not `role=spinbutton`, so assistive tech gets no
   value range and no increment/decrement actions. Native platforms expose
   adjustable or stepper semantics. Is this a deliberate parity break, or
   should the Web add `aria-valuenow/min/max` on a spinbutton?
2. **Stepper reach:** steppers are `tabindex=-1` (keyboard users use the
   arrows). Native steppers are focusable buttons.
3. **Wheel default:** the readme says wheel down decrements. macOS natural
   scrolling inverts the physical gesture. Keep the browser delta as is
   (today's behaviour)?

## Decisions (autonomous, 2026-10-27, reversible)

1. **Role.** Native exposes an editable text field with the formatted value, and two stepper buttons, the same tree Chrome
   builds (tools/ax: macOS, iOS and Android match Web on every case). No adjustable / spinbutton semantics are added.
   *Alternative:* a spinbutton in the source (`aria-valuenow/min/max`) and natively `accessibilityAdjustableAction` (SwiftUI) /
   `setProgress` with range info (Compose). *Revert:* nothing to undo; adding them is additive in `AWCNativeNumberField` and
   `NativeNumberField.kt`.
2. **Stepper reach.** The steppers are not keyboard stops (`groupTabindex -1`, as the source's `tabindex=-1`); the arrow keys step
   from the input, and assistive technologies still press the buttons. *Alternative:* focusable native buttons. *Revert:* drop the
   `groupTabindex` property from the two stepper nodes.
3. **Wheel.** macOS applies the browser's delta as is (wheel down decrements; with natural scrolling that is a two-finger swipe
   up, as in Chrome on the same Mac); iOS has no wheel (a touch scroll is not a wheel event); Android maps the mouse wheel axis
   like Chrome. *Alternative:* follow the physical gesture. *Revert:* flip the sign in the wheel handler of both renderers.
4. **Pointer focus.** A mouse press on a stepper focuses the input, and its release hands focus back even when the hold stopped
   at a bound first (the source's `pointerType !== 'touch'` branch); a touch never focuses it, so no keyboard is summoned on iOS
   and Android. *Revert:* not applicable (source behaviour).

## Evidence

* Oracle: `outputs/native-parity/md-number-field/web-oracle-cloud/` (208
  paint cases, 7 runs, 7 reduced-motion runs, `SHA256SUMS`).
* Tests: 7 suites, 69 tests, all pass. The baseline was 5 suites and 63
  tests.
