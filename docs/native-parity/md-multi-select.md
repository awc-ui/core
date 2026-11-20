# md-multi-select native checkpoint

Status: **dedicated renderers installed in canonical 2026-11-04 (n2-059); follow-ups 2026-11-07 (n2-072: in-flow menu outside a
scope, caret accessibility on iOS); Laboratory gate 3 + Android follow-ups 2026-11-08 (main-queue n2-082-install-select-gate3; evidence work/n2-lab/install-main/j82, n2-lab/out/j76 j80 j81 a45 a46 a51 a52)**, verified against Mac Chrome 153 oracles on macOS
SwiftUI, the iOS simulator and the Android emulator. Open items are listed under Remaining. Source contract:
[md-multi-select-source-review.md](md-multi-select-source-review.md); plan:
[md-multi-select-native-plan.md](md-multi-select-native-plan.md). Built from md-text-field (trigger), md-chip (chips) and md-menu
(listbox with the pinned "Select all" row), as the source composes its primitives.

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer | `AWCNativeView(tag: "md-multi-select", …)` (`NativeMultiSelect.swift`) | `AWCComponent("md-multi-select", …)` (`NativeMultiSelect.kt`) |
| The 38 `--md-multi-select-*` hooks | `AWCMultiSelectAppearance` (hook map `.init(["chip-height": "28px"])`, `init(css:)`, `init(values:)`) + `.awcMultiSelectAppearance(_:for:)` | `AWCMultiSelectAppearance(mapOf("chip-height" to "28px"))` / `fromCss` / `fromValues` + `AWCMultiSelectAppearanceScope` |
| Methods `show`, `close`, `focusTrigger`, `reset`, `loadOptions`, `setQuery`, `getLabels`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` | `AWCMultiSelectController` + `.awcMultiSelectController(_:for:)` | `AWCMultiSelectController` + `AWCMultiSelectControllerScope` |
| Display | chips (bottom / top / left / right, inline), count, text; overflow count or wrap; the button trigger; select-all; max-selected; filterable search; clear and chip remove | same |
| Presentation | the nearest `AWCMenuScope`; outside a scope the menu renders in flow | same |

Unsupported (policy): `virtualize`, `filterMode`, `rowHeight`, `searchingLabel`, the `countFormatter` closure; the slots
`trigger-leading`, `trigger-trailing`, `menu-header`, `menu-loader`.

## Evidence

| Platform | Paint | States (events, end states, per-frame motion) | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 1,212 / 1,222 | 872 / 872 | n2-060, n2-067, n2-072, n2-080 |
| iOS simulator (AWC-n2, iOS 26.3) | — | open: keyboard paths (see Remaining) | n2-060, n2-073 |
| Android emulator (emulator-5558) | 1,222 / 1,222 | 872 / 872 | n2-A040, n2-A046, n2-A051, n2-A052 |

## Laboratory (gate 3)

Studio module `select-appearance.js` (the 38 hooks as a hook map: lengths, colours, padding shorthands, the empty-state font
shorthand), registry, theme options, render validation, retained updates of every supported property, the eleven methods
with results, method examples, policies; studio 27/27, SwiftUI live host (`test-live-select.mjs`), Android host
(`LivePreviewSelectHostTest`, multi case ok, n2-A044 / A045), copyable examples typecheck / compile on both platforms.

## Accessibility (tools/ax)

Cases: chips, open, count. Capture waits for an unlocked macOS console (macOS phase first).

Fixed 2026-11-08 (i5): Android paint `multi-inline-overflow-wrap` chips box — the inspection measured inside the chips row's
4 px block padding; it now records the padded box (Chrome's border box), n2-A046. Android states `select-all flat pixels`
(+0.05 layer at the +597 ms shot): Compose md-menu-item started the pointer wave two frames after the press, so its release fade
also began a frame late; it now starts one frame after the press, as SwiftUI since R4-16 (n2-A051: multi 872 / 872, menu
states unchanged).

## Remaining

- macOS paint 10 / 1,222: `chips-inline` wrap needs the inner md-text-field to take the chips container's height (n3).
- iOS states: keyboard open from the trigger and the pointer motion envelope — see n2-073.
- tools/ax capture (macOS console locked).
- Independent final audit.

## Status 2026-11-16 (story 6-1-select-family-finish)

The accessibility, key-window and paint patches (g4, g6 swift/ax/android) are installed on canonical (job 6-1-select-family-finish-021-install-integration, byte identity checked). Canonical runs: macOS select states 1030/1030 x3 and multi-select states 872/872 x3 (030), select paint 1577/1577, multi-select paint 1222/1222, menu paint 9092/9092, menu states 2524/2524 (021); Android select/multi-select/menu states 3/3 x3 (A031) and paint 4/4 (A032); tools/ax 0 open on Web, macOS, iOS and Android (story 6-7, job 011). The Android menu-item press wave is Chrome's two-frame start with a span-of-frames shot comparison (n2-A053/A054, patch-menu-ripple-kt-2f, patch-states-shot-span-kt), green in A031. Open: iOS simulator states (select 1030, multi-select 872; story 6-6 timing patches, `swift-ios-hop`) and the independent gate-7 audit. checkpoint.json confirmed current.
