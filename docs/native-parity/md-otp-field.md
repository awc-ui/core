# md-otp-field native checkpoint

Status: **installed in canonical 2026-10-31 (n3-051); follow-ups 2026-11-05 (n3-078); gates 2–3 and accessibility run on macOS SwiftUI, the iOS simulator and the
Android emulator** against Mac Chrome 153 oracles. Open items are listed under Remaining. Independent final audit pending. Source contract:
[md-otp-field-source-review.md](md-otp-field-source-review.md); plan: [md-otp-field-native-plan.md](md-otp-field-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer (one platform text input per cell, as the source's one `<input>` per cell) | `AWCNativeView(tag: "md-otp-field", …)` (`NativeOTPField.swift`, on `FieldTextInput.swift` with editing keys and paste) | `AWCComponent("md-otp-field", …)` (`NativeOTPField.kt`) |
| The seven `--md-otp-field-*` hooks | `AWCOTPFieldAppearance` + `.awcOTPFieldAppearance(_:for:)` | `AWCOTPFieldAppearance` + `AWCOTPFieldAppearanceScope` |
| `::part(cell)` (border colour / width, background, text, caret), `::part(cells)` (gap), `::part(separator)` (colour, opacity), `::part(supporting-text)` (colour) | `AWCOTPFieldPartAppearance` + `.awcOTPFieldPartAppearance(_:for:)` | `AWCOTPFieldPartAppearance` + `AWCOTPFieldPartAppearanceScope` |
| Methods `setFocus`, `clear`, `getValidity`, `setCustomValidity`, `checkValidity`, `reportValidity` | `AWCOTPFieldController` + `.awcOTPFieldController(_:for:)` | `AWCOTPFieldController` + `AWCOTPFieldControllerScope` |
| `separator` slot | node children with `slot: "separator"` | the `separator` slot of the content lambda |

Behaviour mirrors the source: one sanitizing pipeline (strip whitespace → transform → validation type → clamp) for typing,
paste, autofill and programmatic writes; the contiguous value; a click lands on the first empty cell; select-on-focus overtype;
Backspace / Delete / ArrowLeft / ArrowRight / Home / End across cells (the row stays LTR in RTL locales); every cell a Tab stop;
whole-value paste from cell 0; `mdInput`, `mdChange` on leaving the group, `mdComplete` (and auto-submit), `mdInvalidInput`,
`mdValidityChange`; mask, grouping with the separator, density, error / disabled / read-only borders and the 100 ms border
transition; required / incomplete validation.

## Evidence

Oracles: Mac Chrome 153, `outputs/native-parity/md-otp-field/web-oracle-mac/` (jobs n3-001, n3-061 for `::part`): 177 paint cases (9 with part rules), 4 interaction runs
(+ reduced motion).

| Platform | Paint | States | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 13,164 / 13,164 | 1,370 / 1,370 | n3-074, n3-080 |
| iOS simulator (AWC-n3, iOS 26.3.1) | 13,164 / 13,164 | 1,361–1,362 / 1,370 (open: simulator keystroke delivery, see Remaining) | n3-067, n3-076, n3-079 |
| Android emulator (emulator-5560) | 12,933 / 12,933 | 1,370 / 1,370 | n3-A035, n3-A036 |

## Laboratory (gate 3)

Studio module (`otp-field-appearance.js`), retained updates, the six methods with results, examples, policies, SwiftUI live host
27/27 (n3-080), Android host passes (n3-A036).

## Accessibility (tools/ax)

Five cases (empty, partial, error, mask-groups, disabled): 0 open findings on every platform (n3-047, n3-A025; `outputs/native-parity/_ax-n3/md-otp-field`). Masked cells expose one bullet per character (as Chrome);
on macOS each textbox reports the bordered cell as its frame; the group is named by `label`.

## Exceptions (proposed; reviewer acceptance pending)

None. The earlier proposal (hover tint on iOS touch) is withdrawn: the iPadOS pointer hovers a cell through `.onContinuousHover`, the native equivalent of `:hover`, and the iOS states suite now checks those frames (decision 5).

## Decisions

See "Decisions (autonomous, 2026-10-27, reversible)" in the source review: editing a complete code, Tab stops, IME, paste into a
masked cell on macOS, hover on iOS.

- 6-3 (2026-11-14): (1) reduced motion: the cell borders are drawn from their targets (every change snaps there), not from the colour
  tracks an `.onChange` sets after the render; before, `otp-keyboard-{ltr,rtl} (reduced) type-12` kept the borders one focus move
  behind in 3 of 10 runs (d4: 2 of 3). (2) A `value` written by a retained update is taken while the body evaluates, with the same
  update's length / validation / transform; the `.onChange` write alone was sometimes not followed by a render (live host
  `test-live-otpfield.mjs` canonical 14/20, patched 20/20 twice).

## Remaining

- iOS simulator: a hardware key reaches a UIKit text input through the keyboard 5–70 ms after the key-down (di, 2026-11-04; not a
  field defect). The states suite times each keystroke from its arrival (keys still in flight awaited, keys Chrome applies
  together compared from the first arrival); 8–9 frames stay outside in the reduced-motion RTL Backspace ×3 / Delete phases.
- Independent final audit.
