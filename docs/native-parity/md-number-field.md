# md-number-field native checkpoint

Status: **installed in canonical 2026-10-31 (n3-051); gates 2–3 and accessibility run on macOS SwiftUI, the iOS simulator and the
Android emulator** against Mac Chrome 153 oracles. Open items are listed under Remaining. Independent final audit pending. Source contract:
[md-number-field-source-review.md](md-number-field-source-review.md); plan: [md-number-field-native-plan.md](md-number-field-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer (composes the md-text-field primitive, as the source composes md-text-field) | `AWCNativeView(tag: "md-number-field", …)` (`NativeNumberField.swift`, `NumberFieldModel.swift`) | `AWCComponent("md-number-field", …)` (`NativeNumberField.kt`) |
| Hooks (`--md-number-field-*`; the inner field takes the md-text-field hooks) | `AWCNumberFieldAppearance` + `.awcNumberFieldAppearance(_:for:)` | `AWCNumberFieldAppearance` + `AWCNumberFieldAppearanceScope` |
| Methods `setFocus`, `select`, `stepUp(n)`, `stepDown(n)`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` | `AWCNumberFieldController` + `.awcNumberFieldController(_:for:)` | `AWCNumberFieldController` + `AWCNumberFieldControllerScope` |

Behaviour mirrors the source: `Intl.NumberFormat` formatting and locale parsing (`locale`, `formatOptions`), min / max / step /
small-step / large-step with clamping (`allowOutOfRange`), inline / split / no steppers, ArrowUp / ArrowDown (Shift = large,
Alt = small), Home / End to the bounds, press-and-hold (400 ms, then every 60 ms), wheel scrub while focused
(`allowWheelScrub`), commit on blur / Enter with `mdChange` and `reason`, `mdInput`, `mdInvalidInput`, `mdValidityChange`,
required validation with `valueMissingLabel` / `errorText`, density rungs, disabled / read-only steppers.

## Evidence

Oracles: Mac Chrome 153, `outputs/native-parity/md-number-field/web-oracle-mac/` (job n3-001; typing runs use Meta+A on macOS).

| Platform | Paint | States | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 8,080 / 8,259 (open: 179 cases read a stale input-text inspection while AppKit shows the value) | 1,544 / 1,544 | n3-052, n3-055 |
| iOS simulator (AWC-n3, iOS 26.3.1) | 8,259 / 8,259 | 1,398 / 1,398 | n3-052 |
| Android emulator (emulator-5560) | 7,675 / 7,675 | 1,096 / 1,096 | n3-A029 |

## Laboratory (gate 3)

Studio module (`number-field-appearance.js`), retained updates of every property, the eight methods with results (`stepUp` /
`stepDown` take the optional count), examples, policies, SwiftUI live host 29/29 (canonical, n3-051), Android host passes (n3-A029).

## Accessibility (tools/ax)

Six cases (inline, split, required, error, none, disabled): iOS and Android 0 open findings; macOS open: in each capture one case (a different one each time) exposes the support text and the stepper groups with the host's AXIncrement / AXDecrement / AXDelete / AXShowMenu / AXCancel / AXPress (read as an option) and a stepper button can be missing (n3-047, n3-053; `outputs/native-parity/_ax-n3`, `_ax-n3-nf1`, `_ax-n3-nf2`). Recorded expectations: the inline steppers are 28 px
pointer conveniences with `tabindex=-1` in the source (touch-target checks), the supporting text is the field's next TalkBack
stop on Android.

## Exceptions (proposed; reviewer acceptance pending)

None proposed. Recorded expectation (not an exception): the field boundary reads 1.00:1 non-text contrast (#e6e0e9 on #e6e0e9) on every platform exactly as in Chrome (tools/ax expectations).

## Decisions

See "Decisions (autonomous, 2026-10-27, reversible)" in the source review: role, stepper reach, wheel direction, pointer focus.

## Remaining

- macOS paint: the input-text inspection of 179 cases is stale (the AppKit field shows the value); n3-055 re-reads it after a forced layout.
- macOS accessibility: the intermittent host actions on the support text / stepper groups (see above).
- Independent final audit.
