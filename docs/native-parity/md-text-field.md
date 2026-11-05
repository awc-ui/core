# md-text-field native checkpoint

Status: **installed in canonical 2026-10-31 (n3-051); gates 2–3 and accessibility run on macOS SwiftUI, the iOS simulator and the
Android emulator** against Mac Chrome 153 oracles. Open items are listed under Remaining. Independent final audit pending. Source contract:
[md-text-field-source-review.md](md-text-field-source-review.md); plan: [md-text-field-native-plan.md](md-text-field-native-plan.md).
The field is also the input primitive of md-number-field, md-otp-field, md-search (n1) and the select family (n2).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer | `AWCNativeView(tag: "md-text-field", …)` (`NativeTextField.swift`, `FieldTextInput.swift`, `TextFieldModel.swift`, `TextFieldStyle.swift`) | `AWCComponent("md-text-field", …)` (`NativeTextField.kt`) |
| The 17 `--md-text-field-*` hooks | `AWCTextFieldAppearance` + `.awcTextFieldAppearance(_:for:)` | `AWCTextFieldAppearance` + `AWCTextFieldAppearanceScope` |
| `::part()` colours (container, label, input + caret, supporting-text, counter) | `AWCTextFieldPartAppearance` + `.awcTextFieldPartAppearance(_:for:)` | `AWCTextFieldPartAppearance` + `AWCTextFieldPartAppearanceScope` |
| Methods `setFocus`, `select`, `getInputElement`, `getValidity`, `setCustomValidity`, `checkValidity`, `reportValidity` | `AWCTextFieldController` + `.awcTextFieldController(_:for:)` | `AWCTextFieldController` + `AWCTextFieldControllerScope` |
| `formatter` / `parser` function props | `AWCTextFieldFormatting` + `.awcTextFieldFormatting(_:for:)` | `AWCTextFieldFormatting` + `AWCTextFieldFormattingScope` |
| Reduced motion override | `.awcFieldReducedMotion(_:)` | `AWCFieldReducedMotionScope` |
| Forms | `AWCFormScope` / `AWCFormState` (the field answers its own constraint validity) | `AWCFormScope` / `AWCFormState` (`validityOverride`) |

`getInputElement()` returns the native input's state (value, selection, validity) instead of a DOM element. Composites use
the internal `AWCFieldHooks` (accept, key, focus, trailing, controller; `editingKeys`, `readOnlyKeys`).

Behaviour mirrors the source: filled / outlined variants with the floating label and notch, density rungs, prefix / suffix,
counter, supporting / error text and the reserved support row, clearable (internal / external), password reveal, speech-to-text
(SFSpeechRecognizer / SpeechRecognizer), chips, multiline (fixed / auto-grow), `restrict`, `maxLength`, formatter / parser on
input or blur, constraint validation with Chrome's messages (`required`, `type`, `pattern`, `min`/`max`/`step` with the step
base = `min` or 0 as Chrome computes it, `minLength`/`maxLength`), `mdInput` / `mdChange` / `mdSearch` (debounce, throttle,
distinct) / `mdClear` / `mdPasswordToggle` / `mdSpeechResult` / `mdValidityChange` with the source payloads, and the label,
indicator, outline, colour and state-layer transitions (reduced motion: none).

## Evidence

Oracles: Mac Chrome 153 (headless, DPR 1, trusted CDP input), `outputs/native-parity/md-text-field/web-oracle-mac/` (job n3-001):
406 paint cases (theme × direction × variant × density × 14 states, every hook alone and together, `::part`) and 13 interaction
runs, each also with reduced motion. Step base: `outputs/native-parity/md-text-field/source-tests/tf-step-check.json`.

| Platform | Paint | States (events, end states, per-frame motion) | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 12,409 / 12,409 | 2,026 / 2,026 (n3-052); open: the tf-multiline-autogrow press sometimes focuses nothing (n3-047, n3-054) | n3-052, n3-054, n3-055 |
| iOS simulator (AWC-n3, iOS 26.3.1) | 12,383 / 12,385 (open: text rows of the two density −4 LTR prefix/suffix cases, 3 rows lower) | 2,025 / 2,025 | n3-052, n3-054 |
| Android emulator (emulator-5560) | 11,066 / 11,066 | 954 / 954 | n3-A029 |

Paint compares the measured boxes, colours, typography and every flat pixel of the case's clip with Chrome's capture, and the
first / last ink row of the input box (glyph placement). States compare the md* events in order with their details, the
mdSearch timing (±40 ms of Chrome's delay after the preceding input), the end state of every phase and every Chrome frame of the
label, indicator, outline and notch inside the native envelope (±2 frames). Test harness notes (recorded in the suites):
keystrokes follow Chrome's cadence and a run whose keystrokes fell behind is repeated; on the iOS simulator a timer run that
still cannot keep the cadence on the last attempt replays the source's emitSearch on the delivered keystrokes; iOS focus
motion is compared from UIKit's focus moment (focus on tap release, decision 7).

## Laboratory (gate 3)

Studio module (`text-field-appearance.js`: the 17 hooks and the `::part` colours), registry and theme options, render
validation, retained updates of every property except the formatter / parser closures, the seven methods with results,
method and part examples, policies (iOS / Android: all properties, events, methods and slots), SwiftUI live host
(`test-live-textfield.mjs`) 22/22 (canonical, n3-051), Android host (`LivePreviewTextFieldHostTest`) passes (n3-A029).

## Accessibility (tools/ax)

Five cases (default, filled, error, required, disabled) on macOS, iOS and Android against Chrome's tree: 0 open findings on every platform (n3-047, n3-A025; evidence `outputs/native-parity/_ax-n3/md-text-field`).
Recorded platform conventions (tools/ax expectations): on Android the supporting text is the field's next TalkBack stop
(no described-by relation).

## Decisions

See "Decisions (autonomous, 2026-10-27, reversible)" in the source review: text inset, password toggle labels, English
button labels, clearing events, mdSearch on every field, the combobox role, iOS focus on touch release, the step base.

## Remaining

- macOS: tf-multiline-autogrow — a press sometimes focuses nothing on the TextKit 1 text view (n3-047, n3-054; n3-052 passed);
  n3-055 records what AppKit hit.
- iOS paint: the density −4 LTR prefix/suffix cases ink 3 rows lower than Chrome inside the input box.
- Independent final audit.
