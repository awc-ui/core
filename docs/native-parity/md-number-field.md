# md-number-field native checkpoint

Status: **installed in canonical 2026-10-31 (n3-051); follow-ups 2026-11-05 (n3-078); gates 2–3 and accessibility run on macOS SwiftUI, the iOS simulator and the
Android emulator** against Mac Chrome 153 oracles. Open items are listed under Remaining. Independent final audit pending. Source contract:
[md-number-field-source-review.md](md-number-field-source-review.md); plan: [md-number-field-native-plan.md](md-number-field-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer (composes the md-text-field primitive, as the source composes md-text-field) | `AWCNativeView(tag: "md-number-field", …)` (`NativeNumberField.swift`, `NumberFieldModel.swift`) | `AWCComponent("md-number-field", …)` (`NativeNumberField.kt`) |
| Hooks (`--md-number-field-*`; the inner field takes the md-text-field hooks) | `AWCNumberFieldAppearance` + `.awcNumberFieldAppearance(_:for:)` | `AWCNumberFieldAppearance` + `AWCNumberFieldAppearanceScope` |
| `::part(field)` (the inner md-text-field: its `--md-text-field-*` hooks, background, opacity — one composited group) | `AWCNumberFieldPartAppearance` + `.awcNumberFieldPartAppearance(_:for:)` | `AWCNumberFieldPartAppearance` + `AWCNumberFieldPartAppearanceScope` |
| Methods `setFocus`, `select`, `stepUp(n)`, `stepDown(n)`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` | `AWCNumberFieldController` + `.awcNumberFieldController(_:for:)` | `AWCNumberFieldController` + `AWCNumberFieldControllerScope` |

Behaviour mirrors the source: `Intl.NumberFormat` formatting and locale parsing (`locale`, `formatOptions`), min / max / step /
small-step / large-step with clamping (`allowOutOfRange`), inline / split / no steppers, ArrowUp / ArrowDown (Shift = large,
Alt = small), Home / End to the bounds, press-and-hold (400 ms, then every 60 ms), wheel scrub while focused
(`allowWheelScrub`), commit on blur / Enter with `mdChange` and `reason`, `mdInput`, `mdInvalidInput`, `mdValidityChange`,
required validation with `valueMissingLabel` / `errorText`, density rungs, disabled / read-only steppers.

## Evidence

Oracles: Mac Chrome 153, `outputs/native-parity/md-number-field/web-oracle-mac/` (jobs n3-001, n3-061 for `::part(field)`: 220 paint cases, 12 with part rules; typing runs use Meta+A on macOS).

| Platform | Paint | States | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 8,815 / 8,815 | 1,538 / 1,538 (hold ticks timed per press) | n3-079, n3-081 |
| iOS simulator (AWC-n3, iOS 26.3.1) | 8,815 / 8,815 | 1,392 / 1,392 (hold ticks timed per press) | n3-076, n3-079 |
| Android emulator (emulator-5560) | 8,203 / 8,203 | 1,096 / 1,096 | n3-A035 |

## Laboratory (gate 3)

Studio module (`number-field-appearance.js`), retained updates of every property, the eight methods with results (`stepUp` /
`stepDown` take the optional count), examples, policies, SwiftUI live host 33/33 (n3-080; incl. ArrowUp / Shift+ArrowDown in the never-key preview window), Android host passes (n3-A036).

## Accessibility (tools/ax)

Six cases (inline, split, required, error, none, disabled): iOS and Android 0 open findings (n3-047). macOS: roles, names, values and focus match Chrome in every capture, but in some fresh host processes SwiftUI's macOS accessibility bridge reports its default action set (AXIncrement, AXDecrement, AXDelete, AXShowMenu, AXCancel, AXPress) on the field's top-level elements (stepper groups or buttons, support text): 5–6 of 16 processes, persistent in 3 (n3-072). Every variant tried shows it at the same rate — no press gesture, no wheel monitor, an AX-silent wheel monitor, explicit stepper buttons, an explicit container, no inspection (n3-067…n3-072; probe through the Accessibility API as tools/ax reads it, `work/n3-lab/debug/NFAXProbe3.swift`, logs in `work/n3-lab/lab-out/probe/`); performing those actions does nothing. Earlier captures: `outputs/native-parity/_ax-n3`, `_ax-n3-nf1`, `_ax-n3-nf2`, `_ax-n3-nf-fix1…3`. Decision (2026-11-07, n3, screen unlocked): **SwiftUI platform behaviour, documented; no field-side fix.** Evidence in `outputs/native-parity/_ax-n3-nf-decision/`: tools/ax with the canonical host shows it in 5/24 case processes (the affected group can also drop its AXButton child, which tools/ax then reports as a missing "Decrement"); lab-only host builds that remove the field's remaining own factors — the inner md-text-field sharing the field's node id, the `::part(field)` compositing group, the host inspection metrics, and all three together — give 7/48, 8/48 and 8/48 against 7/48 for the unchanged build (`bisect`, `bisect2`); AWCUI registers none of these actions on these views (no onMoveCommand / onDeleteCommand / onExitCommand / contextMenu / accessibilityAction); the same host shows 0/24 for md-icon-button and 0/10 for md-text-field; and a SwiftUI app without AWCUI composed like the field (AppKit text field, AppKit bridge buttons over hidden SwiftUI content as background or overlay, launch-time AXObserver, root identifier, duplicate identifiers, post-appear state updates, compositing group) shows it in 0/272 processes (`repro.jsonl`, `v2/`, `v3/`; sources `work/n3-lab/ax/repro*`). The actions come from SwiftUI's synthesized accessibility nodes, nondeterministically per process for this view tree. User impact: in an affected process VoiceOver lists extra actions on a stepper group or the support text and can miss one stepper button; the value stays adjustable through the input (ArrowUp / ArrowDown, Shift / Alt), and the steppers are `tabindex=-1` pointer conveniences in the source. Recorded expectations: the inline steppers are 28 px
pointer conveniences with `tabindex=-1` in the source (touch-target checks), the supporting text is the field's next TalkBack
stop on Android.

## Exceptions (proposed; reviewer acceptance pending)

None proposed. Recorded expectation (not an exception): the field boundary reads 1.00:1 non-text contrast (#e6e0e9 on #e6e0e9) on every platform exactly as in Chrome (tools/ax expectations).

## Decisions

See "Decisions (autonomous, 2026-10-27, reversible)" in the source review: role, stepper reach, wheel direction, pointer focus.

- 6-3 (2026-11-14): macOS Home / End did not reach the composite: FieldTextInput's `scrollToBeginning/EndOfDocument:` cases (Chrome's caret
  move to start / end) matched before the navigation-key route, so `NativeNumberFieldStatesIntegration` failed 1306/1506
  (`nf-keyboard-inline-ltr End` / `Home`: value to max / min). The composite takes the key first; the caret moves only when it does not
  (1538/1538 after).

## Remaining

- macOS accessibility: SwiftUI platform behaviour (decision 2026-11-07, see Accessibility; twelve variants and a standalone
  repro measured). Report it to Apple with the repro and re-check on each macOS / Xcode update (tools/ax md-number-field ×4, macOS).
- Independent final audit.
