# Text field native implementation plan (md-text-field)

Status: Gate 1 plan. No native code has changed. It is based on the Web
contract in `md-text-field-source-review.md` and the provisional cloud oracle,
which must be recaptured on the Mac (Chrome 153) first.

## Current adapters

* **iOS** (`AWCUI/Inputs.swift` `inputField`, routed from
  `AWCNativeView.swift` for `md-text-field`, `md-otp-field` and
  `md-number-field`):
  * A caption `Text` label above (`" *"` when required) and an `HStack` of
    prefix, `leading-icon` slot, `TextField` / `SecureField` / vertical
    `TextField` (multiline, 1…10 lines), suffix, clear (`xmark.circle.fill`,
    "Clear"), password eye and `trailing-icon` slot.
  * Padding 14, a single rounded 8pt surface with a 1pt primary-at-40% or
    error stroke.
  * `mdInput` on every change, with `maxLength` as a UTF-16 prefix.
  * `mdChange` only on Return (`onSubmit`); `mdSearch` only for
    `type=search` on Return. Required validation and form submit on Return.
  * `NativeSupport.json` lists 25 properties, 6 events and 2 slots.
* **Android** (`AWCInputs.kt` `TextInput`, used for all four tags):
  * Material3 `TextField` (`variant=filled`) or `OutlinedTextField`, with
    label, placeholder, supporting text or error, trailing steppers,
    password eye, clear and the `trailing-icon` slot.
  * `PasswordVisualTransformation`, and keyboard type from `type`.
  * `mdInput` and `mdSearch` on every change, matching the Web.
    `mdChange` on blur and on IME action.
  * `support.json` lists 26 properties, 5 events and 1 slot.

## Gap analysis

| Contract | Web | iOS | Android |
|---|---|---|---|
| Filled / outlined container | M3 filled (indicator) and outlined (notch) | one generic rounded box for both | real M3 `TextField` / `OutlinedTextField` |
| Floating label + motion (250ms, reduced motion) | yes | static caption above the field | M3 label motion (Compose's own timing) |
| Density 0…−4 (56→40) | yes | no | no |
| Text inset 23px | yes | 14pt padding | M3 16dp |
| Prefix / suffix only while floated | yes | always shown | not mapped |
| Leading icon slot | yes | yes | no |
| Clear: internal / external, Escape | yes, `mdInput`, `mdChange`, `mdSearch`, `mdClear` | yes (no Escape; disabled when read-only) | `clearable` boolean only; emits `mdInput`, `mdSearch`, `mdClear`, `mdChange` |
| Password toggle labels + `aria-pressed` | yes | labels | labels |
| Speech-to-text | internal (Web Speech) / external | no | no |
| Multiline auto-grow / fixed rows | yes | vertical axis, rows…10 | `minLines` = rows, no auto-grow cap |
| `restrict`, `formatter` / `parser`, `format-on` | yes | no | no |
| `debounce` / `throttle` for `mdSearch` | yes | no (`mdSearch` only on Return for `type=search`) | no (every change) |
| `mdChange` timing | native `change` (blur / Enter) + clear | Return only | blur + IME action |
| `mdValidityChange`, inline validation | yes | listed, partial | no |
| `focus-border-width`, `appear-focused` | yes | no | no |
| Chips slot / `chips-wrap` | yes | no | no |
| `input-role=combobox` hooks | yes | n/a (select adapters don't reuse the field) | n/a |
| Error icon | yes | no | M3 error colours only |
| CSS hooks (17) | yes | none | none |

## Plan

1. **Shared field primitive (both platforms).** Build one native M3 field
   used by text, number, OTP, search and the select family:
   * filled and outlined geometry from the oracle (56/52/48/44/40);
   * the label animator (250ms emphasized, colour 100ms, instant under
     Reduce Motion);
   * leading and trailing slots, prefix and suffix while floated;
   * supporting and counter row, plus an error icon;
   * the inset decided in open decision 1.
2. **Events.** Match the Web order on both platforms:
   * typing: `mdInput` (string), then `mdSearch` through a shared
     debounce/throttle/distinct helper;
   * commit: `mdChange` on focus loss and Return;
   * clear: `mdInput ""`, `mdChange ""`, `mdSearch ""`, then `mdClear`.

   iOS must emit `mdChange` on blur; Android must stop emitting `mdChange`
   after `mdClear` and order it as the Web does.
3. **Input shaping.** Port `restrict` (presets and regex class, applied
   before `maxLength`, skipped while marked text or an IME composition is
   active), plus `formatter` / `parser` / `format-on` as closures in the
   native API.
4. **Validity.** Wire `mdValidityChange` (fired only on change), the
   constraint set and inline error presentation into
   `AWCFormScope`/`AWCFormState`. Android currently lacks
   `mdValidityChange`.
5. **Password and speech.** Make the toggle labels and `aria-pressed`
   follow the outcome of open decision 2 (VoiceOver: `.isSelected` trait;
   TalkBack: `stateDescription`). Map speech to `SFSpeechRecognizer` /
   `SpeechRecognizer` under `speech-to-text="internal"`, and the external
   mode to events only.
6. **Appearance hooks.** Expose the 17 hooks as appearance-scope fields
   (`AWCTextFieldAppearance`) like the accordion and list.
7. **Verification.** Diff the native snapshots against the Mac-recaptured
   oracle cases `tf-*` (paint), `tf-focus-type-blur-*` (label frames) and
   `tf-clear` / `tf-password-toggle` / `tf-required-validity` (event order).

## Open decisions to settle before native work

1. **Text inset:** 23px (Web, aligned with the select caret) or M3's 16?
2. **Password toggle semantics:** a changing label or `aria-pressed`, not
   both.
3. **Clear and speech labels:** add translatable label props on the Web
   first so the native APIs can mirror them.
4. **Host events on clear:** should clearing dispatch host `input` /
   `change`?
5. **`mdSearch` on every text field** (not just search-like ones): keep it,
   or opt in?
