# OTP field native implementation plan (md-otp-field)

Status: Gate 1 plan. No native code has changed. It is based on
`md-otp-field-source-review.md` and the provisional cloud oracle, which must
be recaptured on the Mac (Chrome 153) first.

## Current adapters

* **iOS** (`Inputs.swift` `otpField`):
  * A row of decorative `Text` boxes (`accessibilityHidden`), 48pt high,
    radius 8, a primary stroke at 70% when filled and 20% when empty, `–`
    for empty and `•` for masked.
  * Below them, one real `TextField` (`.oneTimeCode`, rounded border style)
    that filters by `validationType`, applies uppercase and clamps to
    `length`.
  * Every change emits `mdInput` and `mdChange`, plus `mdComplete` at
    length. A rejection emits `mdInvalidInput`.
  * `incompleteLabel` / `required` are validated on change.
* **Android** (`AWCInputs.kt` `TextInput` with `otp=true`):
  * One M3 text field (`KeyboardType.NumberPassword`, a content description
    from `label`).
  * The whole input is **rejected** if any character fails validation (the
    Web filters instead).
  * `transform` also accepts `lowercase` (not a Web value).
  * Every change emits `mdInput` and `mdChange`, and `mdComplete` at length.
  * `mask` uses `PasswordVisualTransformation`.

## Gap analysis

| Contract | Web | iOS | Android |
|---|---|---|---|
| Visible per-character cells (48×56, gap 8, radius 8, 3px primary focus) | yes | decorative cells + a separate text field | no cells (a single field) |
| One editable surface per cell, ←/→/Home/End | yes | no | no |
| Contiguous model; Backspace/Delete semantics | yes | text-field semantics | text-field semantics |
| Overtype of a filled cell (D5) | yes | n/a | n/a |
| Filter vs reject | filters, reports `mdInvalidInput` | filters + reports | rejects the whole edit + reports |
| Whitespace stripped | yes | yes | no |
| Paste replaces from cell 0; complete paste re-emits `mdComplete` | yes | via field (no forced re-emit) | via field (no forced re-emit) |
| SMS / one-time-code autofill | cell 0 `autocomplete=one-time-code` | `.oneTimeCode` | none (`KeyboardType.NumberPassword` only) |
| `mdChange` timing | focus leaves the group, or completion | every change | every change |
| `auto-submit` | `requestSubmit()` after `mdComplete` | no | no |
| `group-size` separator + slot | yes | no | no |
| `cell-label-template` per-cell labels | yes | n/a | n/a |
| Density, CSS hooks (7) | yes | no | no |
| `mdValidityChange`, `value-missing-label` / `incomplete-label` | yes | validity on change | `incompleteLabel` only |
| RTL: row pinned LTR | yes | inherits layout direction | inherits |

## Plan

1. **Single input model, cell rendering.**
   * Keep one hidden-but-focusable native text input (it gets the system
     one-time-code autofill and IME for free) and draw the cells from its
     value.
   * The caret cell is the first empty cell (or the last cell). Tapping a
     cell moves the caret to the fill point, as the Web does.
   * Cell geometry and paint come from `otp-*` paint cases; the row is
     pinned LTR.
2. **One sanitize pipeline** (shared helper): strip whitespace, then
   transform (`none` / `uppercase` only), filter (not reject), clamp, and
   report `mdInvalidInput {attempted, reason}` with `input-change` or
   `input-paste`. Remove Android's whole-edit rejection and its `lowercase`.
3. **Events to the Web contract:**
   * `mdInput` per value change;
   * `mdChange` on focus loss or completion only;
   * `mdComplete` when the code becomes complete, and on a complete paste
     even when unchanged;
   * `auto-submit` → form submit after `mdComplete`.
4. **Separators and labels:** `group-size` dots; a VoiceOver/TalkBack label
   for the group, and a value read as characters.
5. **Autofill:** Android needs the SMS User Consent / Retriever hook or the
   `AutofillType` for one-time codes (Compose `autofill` semantics).
6. **Verification** against `otp-keyboard-*` (event order and the active
   cell) and `otp-paste-autosubmit`.

## Open decisions to settle before native work

1. **Completion on edit:** should `mdComplete` re-fire when a complete code
   is edited by typing? (On the Web it does not; only a paste does.)
2. **Tab stops:** six Tab stops on the Web versus one field natively. Keep
   per-cell stops on the Web?
3. **`mdChange` per keystroke** on both native adapters is a contract break.
   Confirm the Web timing is the target.
