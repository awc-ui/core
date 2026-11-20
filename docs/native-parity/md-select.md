# md-select native checkpoint

Status: **dedicated renderers installed in canonical 2026-11-04 (n2-059); follow-ups 2026-11-07 (n2-072: in-flow menu outside a
scope, `displayText` inspection key, caret accessibility on iOS); Laboratory gate 3 + Tab-while-open fix 2026-11-08 (main-queue n2-082-install-select-gate3; evidence work/n2-lab/install-main/j82, n2-lab/out/j76 j80 j81 a45 a46 a51 a52)**, verified against
Mac Chrome 153 oracles on macOS SwiftUI, the iOS simulator and the Android emulator. Open items are listed under Remaining.
Source contract: [md-select-source-review.md](md-select-source-review.md); plan: [md-select-native-plan.md](md-select-native-plan.md).
md-select-option is the option carrier (no renderer of its own). The composite is built from the library's own md-text-field
(trigger, through `AWCFieldHooks`) and md-menu (listbox), as the source composes its primitives.

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer | `AWCNativeView(tag: "md-select", …)` (`NativeSelect.swift`, `SelectSupport.swift`) | `AWCComponent("md-select", …)` (`NativeSelect.kt`) |
| Options | `md-select-option` children (they win), the `options` property (array or JSON text), `loadOptions` | same |
| The 8 `--md-select-*` hooks | `AWCSelectAppearance` + `.awcSelectAppearance(_:for:)` | `AWCSelectAppearance` + `AWCSelectAppearanceScope` |
| Inner field / menu styling | md-text-field's appearance and parts (`.awcTextFieldAppearance(_:for:)`), md-menu's appearance and parts | the same scopes |
| Methods `show`, `close`, `focusTrigger`, `reset`, `loadOptions`, `setQuery`, `getLabels`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` | `AWCSelectController` + `.awcSelectController(_:for:)` | `AWCSelectController` + `AWCSelectControllerScope` |
| Presentation | the nearest `AWCMenuScope` (anchored below the field); outside a scope the menu renders in flow below the field | `AWCMenuScope` / in flow |
| Forms | `AWCFormScope` (name / value, `required` → valueMissing with the source's `valueMissingLabel`) | `AWCFormScope` |

Unsupported (policy): `virtualize`, `filterMode`, `rowHeight`, `searchingLabel` (native lists are not virtualized; the
filter is the source's substring match).

## Evidence

Oracles: Mac Chrome 153 (headless, DPR 1, trusted CDP input): paint cases (theme × direction × variant × density × states,
every hook, filterable / loading / empty / no-results) and interaction runs (pointer, keyboard, closed keys, open-with-value,
filter), each also with reduced motion.

| Platform | Paint | States (events, end states, per-frame motion) | Jobs |
| --- | --- | --- | --- |
| macOS SwiftUI | 1,577 / 1,577 | 1,030 / 1,030 (two full runs) | n2-050, n2-067, n2-080, n2-081 |
| iOS simulator (AWC-n2, iOS 26.3) | 1,577 / 1,577 | open: keyboard paths (see Remaining) | n2-050, n2-060, n2-073 |
| Android emulator (emulator-5558) | 1,577 / 1,577 | 1,030 / 1,030 | n2-A032, n2-A051, n2-A052 |

## Laboratory (gate 3)

Studio module `select-appearance.js` (the eight typed hooks), registry and theme options, render validation, retained
updates of every supported property (validated per source type), the eleven methods with results (`getLabels` →
`{ value: label }`), method examples, policies (appearance + Laboratory note). Studio `select-integration.test.mjs` + `native-api-examples.test.mjs`
27/27 (n2-076); SwiftUI live host `test-live-select.mjs` (hooks, retained updates, all eleven methods, the in-flow menu);
Android host `LivePreviewSelectHostTest` 2/2 (n2-A045); copyable examples (`examples-select.mjs`: usage, theme, copied recipe,
appearance and defaults, every method and event) typecheck in Swift (n2-073) and compile in Kotlin (n2-A044). Outside a menu
scope the preview shows the open menu in flow below the field (`NativePreviewPresentationIntegration` checks it).

## Accessibility (tools/ax)

Cases in `tools/ax/cases.mjs`: closed, value, open, error, disabled. The run needs the macOS phase first (the Web and iOS
phases read its effective node), which waits for an unlocked console. iOS: the caret glyph is hidden (it was read as
"arrow_drop_down" through md-text-field's trailing accessory, d5; fixed in n2-072, tools/ax md-table-pagination n2-071).

## Decisions

See the source review's decisions: the composite reuses md-text-field and md-menu, English default labels, the in-flow
presentation outside a menu scope.

Fixed 2026-11-08: **Tab while open** (`tab-away`, `tab-while-open`, macOS): md-menu's Tab closes the tree and focuses the
anchor, then continues from it; with the select's text-field trigger as the anchor the continuation now runs from the field as
its own Tab does (document order, else AppKit's key-view loop, else the field resigns: Chrome leaves focus on the document), after
the anchor focus has landed (n2-080: select 8 checks, menu Tab runs 214 / 214). **Outside close** (macOS + Android, i5): the
oracle's outside press is a point click without the separate move of a targeted click (`oracleMouse('down')`,
`oracleMouse('up')`: press ~33 ms, release ~67 ms; the exit starts two frames after that click and `mdClose` fires at +233);
the native harnesses replayed it with the targeted click's timing (press 67, release 100), one round trip late. They now replay
it as recorded (n2-081, n2-A051); the component was right.

## Remaining

- iOS states (n2-073: 645 / 946): keyboard open from the read-only trigger (Space with `readOnlyKeys` installed, ArrowDown,
  typeahead) does not open the menu under the simulator's hardware keys, and the pointer motion envelope (touch release).
- macOS Shift+Tab from the trigger inside md-table-pagination continues forward (d5: md-table states `tb-keyboard [19]`,
  2026-11-07); the select's own runs have no Shift+Tab step — open, with n2.
- tools/ax capture (macOS console locked).
- Independent final audit.

## Status 2026-11-16 (story 6-1-select-family-finish)

The accessibility, key-window and paint patches (g4, g6 swift/ax/android) are installed on canonical (job 6-1-select-family-finish-021-install-integration, byte identity checked). Canonical runs: macOS select states 1030/1030 x3 and multi-select states 872/872 x3 (030), select paint 1577/1577, multi-select paint 1222/1222, menu paint 9092/9092, menu states 2524/2524 (021); Android select/multi-select/menu states 3/3 x3 (A031) and paint 4/4 (A032); tools/ax 0 open on Web, macOS, iOS and Android (story 6-7, job 011). The Android menu-item press wave is Chrome's two-frame start with a span-of-frames shot comparison (n2-A053/A054, patch-menu-ripple-kt-2f, patch-states-shot-span-kt), green in A031. Open: iOS simulator states (select 1030, multi-select 872; story 6-6 timing patches, `swift-ios-hop`) and the independent gate-7 audit. checkpoint.json confirmed current.

## Native differences: one frame, rare (story 9-29, user decision 2026-11-19)

Limits of measuring on the iPhone 26.3 simulator, recorded under the class 'one frame, rare' (PARALLEL.md, User decisions on classes, item e). Tests unchanged, no limit widened, nothing retried; counts as reported.

| case | check | runtime | k of n runs | size | shifted comparison | mutation |
|---|---|---|---|---|---|---|
| md-select select-keyboard-ltr arrowdown-open | opacity t=83 (web 0.934) | iPhone 26.3 | 4 of 30 (jobs 9-29-...-030: 2/10, -073: 1/10, -131: 1/10) | one frame (native 0.889 = web curve 16.7 ms earlier, 0.887) | within the 0.03 envelope when shifted by 16.7 ms (computed from the Chrome series t=50 0.807, t=83 0.934, t=117 0.982) | job 9-29-...-150-mut33-sel26: +33 ms of the open motion fails 3 of 3 |
| md-select select-keyboard-rtl arrowdown-open | opacity t=49 (web 0.807) | iPhone 26.3 | 5 of 30 (-030: 4/10 in 4 runs under GAPS hooks, -073: 1/10, -131: 0/10) | one frame (native 0.657 = web curve 16.7 ms earlier, 0.669) | within the envelope when shifted by 16.7 ms | job -150-mut33-sel26: fails 3 of 3 |

Not covered by the class and still open (owners): iPhone reduced-motion `enter` opacity t=33 (10 of 20 in -073) and iOS 18.6 select keyboard open misses larger than one frame (story 9-36); multi-select caret t=200 on iOS 18.6 and multi reduced gap (no mutation, story 9-36); autocomplete caret clock (story 9-34); select-all flat pixels (story 9-35).
