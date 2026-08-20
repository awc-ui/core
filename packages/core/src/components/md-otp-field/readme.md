# md-otp-field

<!-- llm:meta
tag: md-otp-field
category: text-input
status: custom
m3-guidelines: none — M3 has no OTP page
m3-derived-from: https://m3.material.io/components/text-fields/guidelines
behavior-model: contiguous value, one sanitizing pipeline, whole-value paste, declarative transform
form-associated: true
depends-on: none
used-by: none
-->

**One-time-code entry.** Renders `length` real `<input>` cells in its own
shadow root (it owns the inputs, so every cell carries full ARIA), routes all
entry — typing, paste, SMS autofill — through one sanitizing pipeline, and
participates in forms via `ElementInternals` with the full
constraint-validation API. No hidden input, no wrapper `md-text-field`.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md), shipped beside these manuals in
> the package's `docs/` folder. Quick start:
> `import '@awc-ui/core/define';`

---

## When to use

- SMS / email verification codes (`validation-type="numeric"`, the default).
- Recovery / backup codes (`validation-type="alphanumeric"` +
  `transform="uppercase"`).
- PIN entry on a shared screen (`mask`).
- Any short fixed-length code where per-character boxes communicate progress.

## When NOT to use

| Situation | Use instead |
|---|---|
| Free-form text, emails, passwords | `md-text-field` |
| Variable-length or long codes (> ~8 chars) | `md-text-field` with `restrict` |
| Search-as-you-type | `md-search` / `md-autocomplete` |
| Choosing from known options | `md-select` |

## Decision cues

| Need | Setting |
|---|---|
| 6-digit SMS code | defaults (`length="6"`, numeric) |
| 4-digit PIN, hidden | `length="4" mask` |
| `XXX-XXX` visual grouping | `group-size="3"` |
| Recovery code `A1B2C3D4` | `length="8" validation-type="alphanumeric" transform="uppercase"` |
| Verify the instant the code is complete | listen to `mdComplete`, or `auto-submit` inside a `<form>` |
| Partial entry must fail form validation with its own message | `required incomplete-label="…"` |

## API contract

```html
<md-otp-field
  length="6"
  validation-type="numeric|alpha|alphanumeric|none"   <!-- default: numeric -->
  transform="none|uppercase"                          <!-- default: none -->
  mask auto-submit
  group-size="0"
  inputmode=""                       <!-- override; derives from validation-type -->
  name="code" required
  incomplete-label="…" value-missing-label="…"
  disabled | readonly
  error error-text="…" supporting-text="…"
  label="One-time code"
  cell-label-template="Character {index} of {length}"
  density="-1|-2|-3|-4"              <!-- default: 0 (uncompacted) -->
  reserve-supporting-space
></md-otp-field>
```

**Slots** — `separator` (custom content between groups; falls back to a dot.
Slotted content is assigned to the FIRST gap; additional gaps repeat the
built-in dot — style `::part(separator)` when you need identical custom
content in every gap).

**Events**

| Event | Bubbles/composed | Detail | Fires |
|---|---|---|---|
| `mdInput` | yes/yes | `string` | Every user-driven value change |
| `mdChange` | yes/yes | `string` | Commit: completion, and focus leaving the group |
| `mdComplete` | yes/yes | `{ value }` | Every cell filled; a complete paste re-fires it even when unchanged |
| `mdInvalidInput` | yes/yes | `{ attempted, reason }` | Characters rejected by the charset filter |
| `mdValidityChange` | yes/**no** | `{ valid, validationMessage, flags }` | Only when validity changes; bind on the element |

**Methods** — `setFocus()` (focuses the first empty cell, or the last cell when
the code is complete), `clear()`, plus the constraint-validation set:
`getValidity()`, `setCustomValidity(message)`, `checkValidity()`,
`reportValidity()`.

**Parts** — `cells` (the `role="group"` row), `cell` (every `<input>`),
`separator` (each group gap), `supporting-text`.

### Behavioral contract worth knowing

- **Value pipeline** (every path — typing, paste, autofill, programmatic
  writes, authored attributes): strip whitespace → `transform` →
  `validation-type` charset filter → clamp to `length`. Filter rejects fire
  `mdInvalidInput` with the raw attempted string; clamping is silent.
  Normalization is **declarative**: `transform` is an attribute value, not a
  callback — a custom element attribute can't carry a function, and
  `uppercase` covers the documented use case (recovery codes).
- **The value is contiguous** — clearing a cell shifts later characters left
  (no holes), and a character typed into an empty cell beyond the fill point
  lands at the first empty position.
- **Keyboard**: typing auto-advances (last cell keeps focus); Backspace clears
  the current cell or walks back to the previous; Delete clears in place;
  Arrow keys / Home / End move focus. The cell row is pinned LTR even in RTL
  documents (codes read left-to-right everywhere), so arrows never flip.
- **Paste** anywhere replaces the whole value from position 0. A complete
  paste fires `mdComplete` even if the value didn't change (`mdInput` stays
  silent in that case) — the consumer re-runs verification either way.
- **Autofill**: `autocomplete="one-time-code"` sits on the first cell only;
  the cells carry **no `maxlength`**, so an SMS-autofill burst arrives intact
  and is distributed across cells by the pipeline.
- **Forms**: submits `value` under `name`; empty submits **no entry** (null).
  `required` + empty → `valueMissing` with `value-missing-label`. `required` +
  started-but-incomplete → invalid **only when** `incomplete-label` is
  non-empty (reported through the `valueMissing` flag with that message — the
  shared form helpers expose no `badInput` channel). Form reset **clears**
  the code (one-time codes are transient).
- `auto-submit` calls `form.requestSubmit()` (never `submit()`) **after**
  `mdComplete`, so the form's submit event and validation both run.
- `mask` renders `type="password"` cells; the value is never reflected to an
  attribute in any mode.
- **Programmatic writes are silent.** Setting `value` or calling `clear()`
  emits no `mdInput` / `mdChange` / `mdComplete`; only user-driven entry does.
  A programmatic write still runs the sanitizing pipeline, so an illegal
  character is dropped rather than stored.
- **`mdValidityChange` never fires on mount** — the first evaluation only
  primes the baseline, and a re-publish landing on the same state stays
  silent. Read the initial state with `await el.getValidity()`.
- `mdValidityChange` is **not composed**, so it does not leave the shadow root
  of a composite that embeds this field. `mdInput`, `mdChange`, `mdComplete`
  and `mdInvalidInput` are composed and do cross that boundary.
- **`length` is hardened**: a zero, negative, non-finite or fractional value
  floors to a whole number and clamps to a minimum of 1 cell.
- **`readonly` blocks every edit path** — typing, Backspace/Delete, and paste —
  while arrow/Home/End navigation and focus still work and the value is still
  submitted. `disabled` disables every cell and removes the control from
  submission and constraint validation. An ancestor `<fieldset disabled>` or
  disabled `<form>` disables the field too.
- **Focus selects the cell's character**, so a keystroke replaces rather than
  appends; clicking an already-focused cell re-selects it.
- **`group-size` slotting**: content in the `separator` slot is assigned to the
  **first** gap only (one slot element per name is filled in tree order).
  Later gaps keep the built-in dot. Style `::part(separator)` when every gap
  needs the same custom look.

---

## Do / Don't

House rules, informed by [M3 · Text fields](https://m3.material.io/components/text-fields/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Verify on `mdComplete` | Don't poll `mdInput` for a full-length value |
| Set `validation-type` to match the code you issue | Don't leave the numeric default on an alphanumeric code |
| Use `mask` only for PINs on shared screens | Don't mask an SMS code the user just read on their phone |
| Set `name` and let the form submit the value | Don't add a hidden `<input>` to carry the code |
| Translate `label`, `cell-label-template` and the `*-label` messages | Don't ship the English defaults |
| Keep codes short (4-8 cells) | Don't build a long free-text entry out of cells |
| Pair `auto-submit` with a form that shows progress | Don't auto-submit into a page that gives no feedback |
| Use `reserve-supporting-space` when an error can appear | Don't let the first error push the layout down |

---

## Patterns

```html
<!-- 6-digit SMS code, verified the moment it completes -->
<md-otp-field id="sms" name="code" label="Verification code"
              supporting-text="We sent a code to your phone"></md-otp-field>
<script type="module">
  const el = document.getElementById('sms');
  el.addEventListener('mdComplete', (e) => {
    console.log('verify', e.detail.value);
  });
</script>
```

```html
<!-- Auto-submitting form: requestSubmit() runs after mdComplete -->
<form id="verify">
  <md-otp-field name="code" required auto-submit
                value-missing-label="Please enter the complete code."
  ></md-otp-field>
</form>
<script type="module">
  document.getElementById('verify').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log(new FormData(e.target).get('code'));
  });
</script>
```

```html
<!-- 4-digit masked PIN, grouped 2-2 -->
<md-otp-field
  length="4" mask group-size="2" label="PIN"
  cell-label-template="Digit {index} of {length}"
></md-otp-field>
```

```html
<!-- Alphanumeric recovery code, upper-cased as typed -->
<md-otp-field
  length="8" group-size="4"
  validation-type="alphanumeric" transform="uppercase"
  label="Recovery code"
></md-otp-field>
```

```html
<!-- Partial entry must fail validation with its own message -->
<md-otp-field
  id="strict" name="code" required
  value-missing-label="Enter your code."
  incomplete-label="The code is 6 characters."
  reserve-supporting-space
></md-otp-field>
<script type="module">
  const el = document.getElementById('strict');
  const { valid, validationMessage } = await el.getValidity(); // silent on mount
  console.log(valid, validationMessage);
  el.addEventListener('mdValidityChange', (e) => console.log(e.detail.valid));
</script>
```

```html
<!-- Server rejected the code: show it, then clear on the next attempt -->
<md-otp-field id="checked" name="code" error
              error-text="That code is not valid"></md-otp-field>
<script type="module">
  const el = document.getElementById('checked');
  await el.setCustomValidity('That code is not valid');
  el.addEventListener('mdInput', async () => {
    el.error = false;
    await el.setCustomValidity('');
  });
</script>
```

```html
<!-- Custom separator in the first gap; ::part styles every gap -->
<md-otp-field length="6" group-size="3">
  <span slot="separator">-</span>
</md-otp-field>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Six `md-text-field`s wired together by hand | One `md-otp-field` | You would re-implement paste distribution, autofill, contiguity and per-cell ARIA. |
| Setting `maxlength` on the cells | Nothing to set | The cells deliberately carry no `maxlength`; one would truncate an SMS-autofill burst before the pipeline can distribute it. |
| Expecting `mdInput` after `el.value = '123456'` | Listen for user entry only, or act on the write you just made | Programmatic writes are silent by design. |
| Expecting `mdInput` when the same code is re-pasted | Listen for `mdComplete` | A complete paste re-fires `mdComplete`; the value did not move, so `mdInput` stays silent. |
| `transform` set to a function | `transform="uppercase"` | It is a declarative attribute value — an attribute cannot carry a function. |
| `required` alone to reject a half-typed code | `required` + `incomplete-label="…"` | Without a message, only a fully empty field is invalid. |
| Listening for `mdValidityChange` on a shadow ancestor | Listen on the `md-otp-field` | It is `composed: false` by design. |
| Reading validity on mount from `mdValidityChange` | `await el.getValidity()` | The first evaluation only primes the baseline. |
| One `slot="separator"` element expecting it in every gap | Style `::part(separator)` | Slotted content fills the first gap only. |
| `density="0"` to escape an inherited rung | `style="--md-sys-density-scale: 0"` | There is no `density="0"` rule; rung 0 is the default and is inert. |
| Using it for a password or a long token | `md-text-field` | Cells stop communicating progress past ~8 characters. |

## Accessibility, RTL, density, i18n

**Accessibility** — the cell row is a `role="group"` named by `label`
(`"One-time code"` by default). Every cell is a real `<input>` with its own
`aria-label` built from `cell-label-template` (`{index}` is 1-based,
`{length}` is the cell count), so a screen reader announces position while
navigating. `aria-required` is set on the first cell when `required`;
`aria-invalid` is set on every cell while `error` is true. The supporting line
is wired in through `aria-describedby` and carries `role="alert"` when `error`
is set with a message. Every cell is a tab stop, and arrows / `Home` / `End`
move between them. `reportValidity()` anchors the browser bubble on the first
cell. Deliberately **not** used: `maxlength` on the cells (it would truncate
autofill bursts) and a single visually-hidden input behind the cells (the real
inputs carry the ARIA instead).

**RTL** — the cell row is pinned `dir="ltr"` at the markup level and re-asserted
in CSS, because codes read left-to-right in every locale. Arrow keys therefore
never flip direction. Surrounding content (label, supporting text) still follows
the document direction.

**Density** — set `density="-1"` … `density="-4"` for a local override, or let
the field inherit an ancestor's `data-density` rung; both drive the same
`--md-sys-density-scale` signal, which tapers cell width, cell height and the
character size. There is no `density="0"` rule — rung 0 is the uncompacted
default.

**i18n** — translate `label`, `cell-label-template`, `supporting-text`,
`error-text`, `value-missing-label` and `incomplete-label`; all six ship
English defaults. `validation-type="numeric"` accepts ASCII digits only, so a
locale that renders native numerals still needs the user to type ASCII.

## Related components

`md-text-field` · `md-number-field` · `md-search` · `md-autocomplete` ·
`md-button`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-otp-field-cell-width` | Width of one cell | density-scaled, `48px` at rung 0 |
| `--md-otp-field-cell-height` | Height of one cell | density-scaled, `56px` at rung 0 |
| `--md-otp-field-cell-gap` | Gap between cells | `--md-sys-spacing-gap-sm` (8px) |
| `--md-otp-field-cell-shape` | Cell corner radius | `--md-sys-shape-corner-small` (8px) |
| `--md-otp-field-outline-color` | Resting cell outline | `--md-sys-color-outline` |
| `--md-otp-field-focus-color` | Focused cell outline | `--md-sys-color-primary` |
| `--md-otp-field-font-size` | Character size inside a cell | density-scaled, `24px` at rung 0 |

**CSS parts** — `cells`, `cell`, `separator`, `supporting-text`.

```css
md-otp-field {
  --md-otp-field-cell-width: 40px;
  --md-otp-field-cell-shape: 4px;
  --md-otp-field-focus-color: var(--md-sys-color-tertiary);
}
md-otp-field::part(separator) {
  opacity: 0.6;
}
```

<!-- Auto Generated Below -->


## Overview

`md-otp-field` — Material Design 3 one-time-code field.

Renders `length` real `<input>` cells in its own shadow root (it OWNS its
inputs, so every cell carries full ARIA), pipes all entry — typing, paste,
SMS autofill — through one sanitizing pipeline (strip whitespace →
`transform` → `validationType` charset filter → clamp to `length`), and
participates in forms via `ElementInternals` (no hidden input).

The value is a CONTIGUOUS string: clearing a cell shifts the characters
after it left (there are no holes), and a character typed into an empty
cell beyond the fill point lands at the first empty position.

Normalization is declarative: `transform` names the casing rule as an
attribute value rather than taking a callback, so the rule is authorable
from plain HTML and survives SSR — an element attribute cannot carry a
function.

## Properties

| Property                 | Attribute                  | Description                                                                                                                                                                                                             | Type                                               | Default                             |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| `autoSubmit`             | `auto-submit`              | Submit the owning form (`requestSubmit()`) when the code becomes complete.                                                                                                                                              | `boolean`                                          | `false`                             |
| `cellLabelTemplate`      | `cell-label-template`      | Per-cell `aria-label` template (translatable). `{index}` is 1-based, `{length}` is the cell count.                                                                                                                      | `string`                                           | `'Character {index} of {length}'`   |
| `density`                | `density`                  | Local density rung. Drives the same `--md-sys-density-scale` signal a global `data-density` ancestor sets; local wins. 0 = default, -4 = compact.                                                                       | `-1 \| -2 \| -3 \| -4 \| 0`                        | `0`                                 |
| `disabled`               | `disabled`                 | Disables every cell.                                                                                                                                                                                                    | `boolean`                                          | `false`                             |
| `error`                  | `error`                    | Error visual state — colors cells and swaps supporting text to `errorText`.                                                                                                                                             | `boolean`                                          | `false`                             |
| `errorText`              | `error-text`               | Translatable error message; replaces `supportingText` while `error` is true.                                                                                                                                            | `string`                                           | `''`                                |
| `groupSize`              | `group-size`               | Chunk the cells into groups of this size with a separator between groups. 0 = ungrouped.                                                                                                                                | `number`                                           | `0`                                 |
| `incompleteLabel`        | `incomplete-label`         | When non-empty AND `required`, a started-but-incomplete code is also invalid, reported with this message. Empty (default) = only a fully empty required field blocks submission.                                        | `string`                                           | `''`                                |
| `inputMode`              | `inputmode`                | Virtual-keyboard hint override. Empty derives from `validationType` (`numeric` → `numeric`, everything else → `text`).                                                                                                  | `string`                                           | `''`                                |
| `label`                  | `label`                    | Accessible group label (translatable). Rendered as `aria-label` on the cell group.                                                                                                                                      | `string`                                           | `'One-time code'`                   |
| `length`                 | `length`                   | Number of character cells.                                                                                                                                                                                              | `number`                                           | `6`                                 |
| `mask`                   | `mask`                     | Obscure the entered characters (cells render as `type="password"`).                                                                                                                                                     | `boolean`                                          | `false`                             |
| `name`                   | `name`                     | Form field name — ElementInternals submits the code under it.                                                                                                                                                           | `string`                                           | `''`                                |
| `readOnly`               | `readonly`                 | Value not user-changeable; cells stay focusable and arrow-navigable.                                                                                                                                                    | `boolean`                                          | `false`                             |
| `required`               | `required`                 | The code must be complete before the owning form submits.                                                                                                                                                               | `boolean`                                          | `false`                             |
| `reserveSupportingSpace` | `reserve-supporting-space` | Always reserve the supporting-text line so error text causes no layout jump.                                                                                                                                            | `boolean`                                          | `false`                             |
| `supportingText`         | `supporting-text`          | Translatable supporting text shown under the cells.                                                                                                                                                                     | `string`                                           | `''`                                |
| `transform`              | `transform`                | Case normalization as an attribute value, not a callback (attributes can't carry functions): `uppercase` upper-cases every accepted character (recovery-code entry).                                                    | `"none" \| "uppercase"`                            | `'none'`                            |
| `validationType`         | `validation-type`          | Which characters are accepted. `none` accepts anything (still whitespace-stripped).                                                                                                                                     | `"alpha" \| "alphanumeric" \| "none" \| "numeric"` | `'numeric'`                         |
| `value`                  | `value`                    | The current code. Mutable, deliberately NOT reflected — entered codes must never appear as a DOM attribute (value privacy, like md-text-field). Programmatic writes run through the same sanitizing pipeline as typing. | `string`                                           | `''`                                |
| `valueMissingLabel`      | `value-missing-label`      | Translatable constraint-validation message when `required` and empty.                                                                                                                                                   | `string`                                           | `'Please enter the complete code.'` |


## Events

| Event              | Description                                                                                                                                                                                                                                                                    | Type                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `mdChange`         | Commit event: fires when the code becomes complete and when focus leaves the whole group.                                                                                                                                                                                      | `CustomEvent<string>`                   |
| `mdComplete`       | Fires when every cell is filled. A complete paste re-fires it even if the value is unchanged.                                                                                                                                                                                  | `CustomEvent<MdOtpFieldCompleteDetail>` |
| `mdInput`          | Fires on every value change from user input (typing, clearing, paste, autofill).                                                                                                                                                                                               | `CustomEvent<string>`                   |
| `mdInvalidInput`   | Fires when typed/pasted characters are rejected by the `validationType` charset.                                                                                                                                                                                               | `CustomEvent<MdOtpFieldInvalidDetail>`  |
| `mdValidityChange` | Fires when this control's validity CHANGES — never on mount, never for a re-publish landing on the same state. `composed: false` by the library convention: each control reports only for itself; `bubbles: true` still reaches `<form>`-level listeners in the same DOM tree. | `CustomEvent<MdOtpFieldValidityDetail>` |


## Methods

### `checkValidity() => Promise<boolean>`

Constraint-validation API, matching md-text-field and the native contract.

#### Returns

Type: `Promise<boolean>`



### `clear() => Promise<void>`

Clear the code programmatically (no `mdInput`/`mdChange` — programmatic writes stay silent).

#### Returns

Type: `Promise<void>`



### `getValidity() => Promise<MdOtpFieldValidityDetail>`

Current validity: boolean, message and flags. Mirrors md-text-field.

#### Returns

Type: `Promise<MdOtpFieldValidityDetail>`



### `reportValidity() => Promise<boolean>`

Like checkValidity(), but also shows the browser's validation message.

#### Returns

Type: `Promise<boolean>`



### `setCustomValidity(message: string) => Promise<void>`

App/server-side validation: a non-empty message marks the control invalid until cleared with `''`.

#### Parameters

| Name      | Type     | Description |
| --------- | -------- | ----------- |
| `message` | `string` |             |

#### Returns

Type: `Promise<void>`



### `setFocus() => Promise<void>`

Focus the first empty cell (or the last cell when the code is complete).

#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part                | Description |
| ------------------- | ----------- |
| `"cell"`            |             |
| `"cells"`           |             |
| `"separator"`       |             |
| `"supporting-text"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
