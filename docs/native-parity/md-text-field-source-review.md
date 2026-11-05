# Text field source review (md-text-field)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried below.
* `md-text-field` itself needed no behaviour fix. One documentation fix (the
  `density` JSDoc and readme row now list −4 = 40px) is mirrored into
  `packages/core/src`. The family fixes D1–D7 live in the number field, OTP
  field and search (see their reviews).
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac
(Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.


Native checkpoint (2026-10-31): Mac Chrome 153 oracles (job n3-001); dedicated SwiftUI and Compose renderers, the Laboratory integration and the accessibility evidence are installed and recorded — see [md-text-field.md](md-text-field.md) (open items listed there).
## Composition

One shadow root, form-associated through `ElementInternals`:

* `part=container` holds the state layer, the leading icon slot, the
  input-wrap (floating `part=label`, `part=chips` slot row, prefix, the native
  `<input>`/`<textarea>` `part=input`, suffix) and the trailing cluster (clear,
  password toggle, speech, error icon, `trailing-icon` slot).
* Filled draws `.md-text-field__indicator` (1px, 3px focused); outlined draws a
  `<fieldset>`/`<legend>` notch. Neither is a part.
* Below the container: `part=supporting-text` (`role=alert` while in error)
  and `part=counter`.
* Shared internals used elsewhere: md-number-field wraps one; md-select,
  md-multi-select and md-autocomplete use it as their trigger (the
  `input-role="combobox"`, `input-expanded`, `input-aria-autocomplete`,
  `appear-focused`, `chips` and `data-md-anchor-box` hooks exist for them),
  as do the date and time pickers and md-transfer-list.

## Public contract

* **Variants:** `filled` (default), `outlined`. `density` 0 / −1 / −2 / −3 / −4
  gives 56 / 52 / 48 / 44 / 40px; a `data-density` ancestor gives the same
  ladder (both drive `--md-sys-density-scale`).
* **Label:** floats when focused, filled, autofilled, with a placeholder
  while focused, or when chips are slotted. Resting 16/24 on-surface-variant,
  floated 12/16; primary while focused, error in error.
  * Prefix and suffix show only while the label floats.
  * The text sits at inset-lg + 7px (23px at density 0), deliberately
    deeper than M3's 16px so it lines up with the select family's caret
    column. Supporting text sits at 16px.
* **Trailing affordances:**
  * `clearable`: `internal` clears the value; `external` only emits `mdClear`.
    The bare attribute means `internal`. The button is disabled when empty,
    disabled or read-only.
  * `password-toggle`: `internal` or `external`, labelled
    `show-password-label` / `hide-password-label`, with `aria-pressed`.
  * `speech-to-text`: `internal` (Web Speech, `speech-lang`) or `external`.
  * The error icon shows in error.
* **Multiline:** `multiline="auto-grow"` (textarea grows with content) or
  `fixed` (`rows`).
* **Input shaping:**
  * `restrict`: the presets `numeric`, `integer`, `decimal`, `alpha` and
    `alphanumeric`, or a regex character class. It runs before
    `max-length`, which is then enforced in JS.
  * `formatter` / `parser` with `format-on` `blur` (raw while focused) or
    `input`.
  * All shaping is skipped while an IME composition is active; the pipeline
    runs once on `compositionend`.
* **Search emission:** `mdSearch` fires on typing and clearing, gated by
  `debounce` (trailing) and/or `throttle` (leading and trailing), and is
  distinct-until-changed. With neither set it is synchronous.
* **Validity and forms:**
  * Native constraints are forwarded: `required`, `pattern`, `min-length`,
    `max-length`, `min`, `max`, `step`, `type`.
  * Messages appear in the field's own error state (no browser bubble).
    `mdValidityChange` fires only when validity moves (bubbles, not
    composed).
  * The form value is the raw value; `formDisabledCallback` and reset are
    supported.
  * Enter submits the owning form (not from a textarea or mid-composition).
  * `reserve-supporting-space` holds the row open.
* **Focus look:** `focus-border-width` (default 3) and `appear-focused`
  (visual only).
* **Chips:** the `chips` slot plus `chips-wrap`.
* **ARIA:**
  * `input-role="combobox"` with `input-expanded` and
    `input-aria-autocomplete`.
  * `aria-haspopup` is mirrored.
  * The label is linked by `for`; supporting text and the counter by
    `aria-describedby`.
* **Events:** `mdInput` (string, every keystroke, clear and speech),
  `mdChange` (native `change`, clear, end of speech), `mdSearch`, `mdClear`,
  `mdPasswordToggle {visible}`, `mdSpeechResult {transcript, listening}` and
  `mdValidityChange`. The host re-dispatches a bubbling `change`.
* **Methods:** `setFocus`, `select`, `getInputElement`, `getValidity`,
  `checkValidity`, `reportValidity` and `setCustomValidity`.
* **CSS hooks (17):** `--md-text-field-{active-indicator-color,
  container-color, container-shape, cursor, error-color, filled-pill,
  focus-border-width, focus-inset, icon-color, icon-size, input-color,
  label-color, optical-nudge, outline-color, padding-inline-start,
  padding-inline-end, supporting-text-color}`.

## Layout reference (DPR 1, Roboto, light, 320px host)

| | Filled | Outlined |
|---|---|---|
| Container | 56 high, radius 4px 4px 0 0, `#E6E0E9` | 56 high, 1px `#79747E` outline, radius 4 |
| Resting label | x 23, y 16, 16/24 | x 23, y 16 |
| Floated label | x 23, y 8, 12/16 | x 23, y −8 (on the notch, legend 37 wide) |
| Input line | x 23, y 24, 24 high | x 23, y 16, 24 high |
| Indicator / outline focused | 3px primary `#6750A4` | 3px primary |
| Supporting row | y 60, 16 high, text at x 16, counter end-aligned at 16 | same |
| Clear button | 40×40 at x 263, y 8 | same |

RTL mirrors every x (the floated label sits at x 268 in a 320 field).
Density −1…−4 shrinks the container by 4px per rung and the side inset with the
spacing tokens.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Filled container | `#E6E0E9` | `#36343B` |
| Input text | `#1C1B1F` | `#E6E1E5` |
| Label, indicator, icons (rest) | `#49454F` | `#CAC4D0` |
| Focus (label, indicator/outline) | `#6750A4` | `#D0BCFF` |
| Error (label, outline, text) | `#B3261E` | error token |
| Disabled | on-surface at 38% (container 4%) | |

Every theme × direction × variant × density × state is screenshotted in the
oracle (`tf-*`).

## Interaction and motion reference

Runs: `tf-focus-type-blur-{filled,outlined}-{ltr,rtl}`, dark outlined,
`tf-placeholder-label`, `tf-clear`, `tf-password-toggle`,
`tf-required-validity`, `tf-restrict-numeric-maxlength`, `tf-debounce-300`,
`tf-throttle-200` and `tf-multiline-autogrow`.

* **Typing:** each keystroke emits `mdInput "H"`, then `mdSearch "H"`, then
  the native `input` event. Select-all + Backspace emits
  `mdInput ""` / `mdSearch ""`.
* **Clear:** the ✕ button and Escape (internal only) emit `mdInput ""`,
  `mdChange ""`, `mdSearch ""`, then `mdClear`, and keep focus in the input.
  Escape on an empty field does nothing.
* **Password toggle:** `mdPasswordToggle {visible:true}` and then `false`.
  The label and `aria-pressed` both change.
* **Restrict:** typing `a1b2c3d4e5` into `restrict=numeric max-length=4`
  gives `1234`.
* **Debounce and throttle:**
  * `debounce=300`: `mdSearch` fires 300ms after the last key.
  * `throttle=200`: a leading emit, then at most one emit per 200ms.
* **Motion:**
  * The label animates `top`, `font-size` and `line-height` over 250ms
    `cubic-bezier(.2,0,0,1)` (16→12px over about 250ms in the frame
    samples). Its colour animates over 100ms `ease`.
  * Outline colour, the legend notch (`max-width` and padding) and the
    indicator animate over 250ms.
  * **Reduced motion:** the label and outline jump to their end state in
    the first frame.

## Source changes

* `md-text-field.tsx` and `readme.md`: the `density` documentation now lists
  −4 (40px). There is no behaviour change and no test (documentation only).

## Observed, not changed (decisions needed)

1. **Text inset:** the text sits at 23px where M3 specifies 16px. This is
   deliberate, to align with the select caret. Do native fields copy 23 or
   keep 16?
2. **Password toggle:** it changes its label *and* sets `aria-pressed`, so
   screen readers say "Hide password, toggle button, pressed". Keep one
   signal or the other (APG recommends a stable label with `aria-pressed`).
3. **Hard-coded English:** the clear button (`"Clear"`) and the speech
   button (`"Start voice input"` / `"Stop listening"`) have no label props,
   unlike the password toggle.
4. **Clearing fires no host DOM events:** it emits `mdInput` and `mdChange`
   but no host `input` or `change` DOM event, so form-level
   `change`/`input` delegation misses a clear.
5. **Every field emits `mdSearch`:** it fires on every keystroke for every
   field, not just search fields. Composites must contain it (that was
   defect D7 in md-number-field). md-select and md-autocomplete already
   contain it.
6. **Field role in the select family** (from that fork's report):
   md-select and md-multi-select expose a read-only textbox. Moving them to
   `input-role="combobox"` trips five axe tests while the menu is open.
   Decide whether to accept that axe exception or change the text field.

## Decisions (autonomous, 2026-10-27, reversible)

Each open question above was settled for the native renderers so that parity work could continue. Every decision follows the
source as it stands; none changes the Web component. Each one names the alternative and how to revert.

1. **Text inset.** SwiftUI and Compose keep the source's 23px start (`--md-text-field-padding-inline-start` unset), because the
   paint gate measures them against Chrome. *Alternative:* M3's 16px. *Revert:* change the source default first and re-capture
   the oracle; both native styles (`AWCTextFieldStyle.padStart`, `TextFieldStyle.padStart`) read the same `inset-lg + 7`
   rule and follow the new fixture.
2. **Password toggle.** Native keeps both signals, as the source does: the label switches between `showPasswordLabel` and
   `hidePasswordLabel`, and the pressed state is exposed (SwiftUI `.isSelected`, Compose `selected`). *Alternative:* a stable
   label with the pressed state only (APG). *Revert:* pass one fixed label to `actionButton` in `NativeTextField.swift` and
   `FieldActionButton` in `NativeTextField.kt` once the source changes.
3. **Hard-coded English.** The clear and speech buttons use the source's strings ("Clear", "Start voice input", "Stop
   listening"), so the accessibility names match Chrome's tree. *Alternative:* `clearLabel` / `speechStartLabel` /
   `speechStopLabel` properties in the source and both renderers. *Revert:* nothing to undo; the properties would be additive.
4. **Clearing.** Native emits `mdInput` then `mdChange` (and `mdClear` for Escape), exactly the source's events; there are no
   host DOM `input`/`change` events to mirror outside the browser. *Revert:* not applicable.
5. **`mdSearch` on every field.** A standalone native field emits `mdSearch` with the source's debounce/throttle (Swift on the
   run loop, Compose on the frame clock). The number and OTP fields contain it, as the source does (defect D7). *Alternative:*
   emit only for `type="search"` (a source change). *Revert:* drop the `rt.search.send` wiring in both renderers.
6. **Field role in the select family.** `input-role="combobox"` maps to the platform combo-box role (AppKit `.comboBox`;
   expanded/collapsed as the state on iOS and Compose). md-select and md-multi-select stay on their current read-only textbox until
   the source decides. *Revert:* remove `AWCFieldAXState.awcRole` and the Compose `stateDescription` branch.
7. **iOS focus on touch release.** A UIKit text field becomes first responder on touch-up; Chrome's mouse focuses on press. The
   native field keeps UIKit's behaviour (a touch-down focus would fight the text interaction: loupe, scroll cancel); the iOS states
   test aligns a tap on its release. *Alternative:* a custom touch-down gesture that calls `becomeFirstResponder`. *Revert:* not
   applicable (no code path to remove).
8. **Step base of `type="number"`.** Chrome 153 ([`tf-step-check.json`](../../outputs/native-parity/md-text-field/source-tests/tf-step-check.json))
   shows the source writes `value` as a property, so the inner input has no value attribute and the step base is `min`, else 0
   (`value="1" step="2"` accepts 2 and rejects 3; with `min="1"` it rejects 2 and accepts 3). Native validation does the same.
   `NativeBehaviorViewIntegration` authored the base as the value; its fixture now states it as `min: 1`, so the assertions as
   written hold under Chrome's rule and the field is valid at rest. *Revert:* drop `"min": 1` from that fixture (and use the
   authored value as the base in `AWCTextFieldModel.validity`).
9. **Throttle window and a keystroke at the same instant.** Chrome dispatches input before a timer due at the same time, so a
   keystroke landing exactly at the end of a `throttle` window is still inside it. Native closes the window 1 ms after its end
   (Swift `AWCSearchEmitter`, Compose `SearchEmitter`). *Alternative:* the exact end (the order then depends on the run loop).
   *Revert:* drop the `+ 1` in both emitters.
10. **Masked value on macOS.** AppKit's secure field exposes no value; native reports one bullet per character, as Chrome (and
   UIKit) expose a password input. *Alternative:* AppKit's empty value. *Revert:* remove the `.value` branch of
   `AWCFieldNSSecureTextField` / `AWCFieldSecureTextCell.accessibilityAttributeValue`.
11. **Composite hooks.** The internal `AWCFieldHooks` gains `editingKeys` (Backspace / Delete / ← / → (/ Home / End) to the
   composite first; unhandled keys keep their editing) and `readOnlyKeys` (Space / printable characters in a read-only input,
   as Chrome still dispatches keydown there), and Compose routes Tab / Shift+Tab to the composite's key hook as SwiftUI does —
   the select family's keyboard contract (n2). *Revert:* not applicable to a standalone field (all default off).

## Evidence

* Oracle: `outputs/native-parity/md-text-field/web-oracle-cloud/` (394 paint
  cases, 13 runs, 13 reduced-motion runs, `SHA256SUMS`).
* Source diff, mirror manifests and test logs for the whole family:
  `outputs/native-parity/md-text-field/source-changes/` and
  `outputs/native-parity/md-text-field/source-tests/`.
* Tests: the family's own suites went from 613/613 (25 suites) to 633/633
  (29 suites). The 9 text-field suites are unchanged and pass.
