# md-otp-field native checkpoint

Status: **installed in canonical 2026-10-31 (n3-051); gates 2–3 and accessibility run on macOS SwiftUI, the iOS simulator and the
Android emulator** against Mac Chrome 153 oracles. Open items are listed under Remaining. Independent final audit pending. Source contract:
[md-otp-field-source-review.md](md-otp-field-source-review.md); plan: [md-otp-field-native-plan.md](md-otp-field-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer (one platform text input per cell, as the source's one `<input>` per cell) | `AWCNativeView(tag: "md-otp-field", …)` (`NativeOTPField.swift`, on `FieldTextInput.swift` with editing keys and paste) | `AWCComponent("md-otp-field", …)` (`NativeOTPField.kt`) |
| The seven `--md-otp-field-*` hooks | `AWCOTPFieldAppearance` + `.awcOTPFieldAppearance(_:for:)` | `AWCOTPFieldAppearance` + `AWCOTPFieldAppearanceScope` |
| Methods `setFocus`, `clear`, `getValidity`, `setCustomValidity`, `checkValidity`, `reportValidity` | `AWCOTPFieldController` + `.awcOTPFieldController(_:for:)` | `AWCOTPFieldController` + `AWCOTPFieldControllerScope` |
| `separator` slot | node children with `slot: "separator"` | the `separator` slot of the content lambda |

Behaviour mirrors the source: one sanitizing pipeline (strip whitespace → transform → validation type → clamp) for typing,
paste, autofill and programmatic writes; the contiguous value; a click lands on the first empty cell; select-on-focus overtype;
Backspace / Delete / ArrowLeft / ArrowRight / Home / End across cells (the row stays LTR in RTL locales); every cell a Tab stop;
whole-value paste from cell 0; `mdInput`, `mdChange` on leaving the group, `mdComplete` (and auto-submit), `mdInvalidInput`,
`mdValidityChange`; mask, grouping with the separator, density, error / disabled / read-only borders and the 100 ms border
transition; required / incomplete validation.

## Evidence

Oracles: Mac Chrome 153, `outputs/native-parity/md-otp-field/web-oracle-mac/` (job n3-001): 168 paint cases, 4 interaction runs
(+ reduced motion).

| Platform | Paint | States | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 12,344 / 12,344 | 1,370 / 1,370 | n3-047 |
| iOS simulator (AWC-n3, iOS 26.3.1) | 12,344 / 12,344 | 1,360 / 1,370 (open: frames of runs whose keystrokes reach the simulator up to 86 ms late) | n3-047 |
| Android emulator (emulator-5560) | 12,176 / 12,176 | 1,370 / 1,370 | n3-A029, n3-A031 |

## Laboratory (gate 3)

Studio module (`otp-field-appearance.js`), retained updates, the six methods with results, examples, policies, SwiftUI live host
27/27 (canonical, n3-051), Android host passes (n3-A029).

## Accessibility (tools/ax)

Five cases (empty, partial, error, mask-groups, disabled): 0 open findings on every platform (n3-047, n3-A025; `outputs/native-parity/_ax-n3/md-otp-field`). Masked cells expose one bullet per character (as Chrome);
on macOS each textbox reports the bordered cell as its frame; the group is named by `label`.

## Exceptions (proposed; reviewer acceptance pending)

- **Hover tint on iOS touch** (proposed). Source: a cell under the mouse pointer shows the `:hover` border (on-surface). Platform/API: iOS UIKit touch input (no pointer hover without a pointing device; SwiftUI `onHover` still applies with an iPad pointer). Technical reason: touch has no hover state. User impact: none on touch. Tested native equivalent: the hover border on macOS (pointer) and Android (mouse) in the states suites. Evidence: the iOS states suite skips the Chrome frames of the pointer-rested cell and reports them (`hoverFramesUnsupportedOnTouch`, n3-047). Reviewer / acceptance: pending.

## Decisions

See "Decisions (autonomous, 2026-10-27, reversible)" in the source review: editing a complete code, Tab stops, IME, paste into a
masked cell on macOS, hover on iOS.

## Remaining

- iOS simulator: runs whose keystrokes arrive up to 86 ms late (simulator input latency) leave frames outside the envelope.
- Independent final audit.
