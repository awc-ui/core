# md-autocomplete native checkpoint

Status: **Installed 2026-11-12 (main-queue d4-080); final audit pending.** Dedicated SwiftUI (macOS, iOS) and Compose renderers verified against the Mac Chrome 153 oracles; Laboratory
gate 3 and the accessibility cases are listed below. Source contract: [md-autocomplete-source-review.md](md-autocomplete-source-review.md)
(decisions under "Decisions (autonomous, 2026-11-06, reversible)"); plan: [md-autocomplete-native-plan.md](md-autocomplete-native-plan.md).
Owner: fork d4 (taken over from fa, 2026-11-06).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Renderer | `AWCNativeView(tag: "md-autocomplete", …)` (`NativeAutocomplete.swift`) | `AWCComponent("md-autocomplete", …)` (`NativeAutocomplete.kt`) |
| The eleven `--md-autocomplete-*` hooks | `AWCAutocompleteAppearance` + `.awcAutocompleteAppearance(_:for:)` (values, CSS text) | `AWCAutocompleteAppearance` + `AWCAutocompleteAppearanceScope` |
| Methods `focusInput`, `showMenu`, `closeMenu`, `loadOptions`, `getLabels`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity`; the `filterer` property | `AWCAutocompleteController` + `.awcAutocompleteController(_:for:)` | `AWCAutocompleteController` + `AWCAutocompleteControllerScope` |
| Slots `loader`, `dropdown-icon` | node children with `slot:` | the content lambda's slot |
| The suggestions | present in the nearest `AWCMenuScope` (anchored below the field; outside a scope they render in flow) | same (`AWCMenuScope`) |

Composition (as the source composes its primitives, reusing the installed renderers rather than copies): the field is
md-text-field (`AWCNativeTextField` / `NativeTextField`, editable, `combobox` role, `aria-expanded`, `aria-autocomplete=list`,
through the composite hooks `AWCFieldHooks`); the listbox is md-menu (`autoFocus` false, `listbox`, persistent when
`disableCloseOnSelect`) of md-menu-item option rows (radio / checkbox rows, check at the start, keep-open); input chips are
md-chip in md-multi-select's chip flow (`AWCMultiChipsFlow`); the option model, caret and scope frames are md-select's
(`AWCSelectOptionData`, `AWCSelectCaret`, `AWCSelectScopeFrame`). The clear button is an md-icon-button (28 × 28, 18 glyph).

Behaviour mirrors the source: typing opens and filters without moving focus (only what was typed since the popup opened
filters; label, value and supporting text, case-insensitive; `limitResults`; the `filterer` closure), one `mdInput` per edit,
the polite "{count} suggestions available" status; ArrowDown / ArrowUp open and move real focus to the first / last enabled
row; printable keys and Backspace on a row return to the input and extend the query; Enter picks (or commits free-solo text);
Escape closes and puts the committed label back (strict single mode); a click on the field toggles the popup, on the caret
toggles it; multiple keeps the popup open, clears the text, shows chips below / top / left / right / inline, Backspace in an
empty input removes the last chip, `maxSelected` caps the picks; clear empties the value (`mdClear`) and keeps focus in the
input; `clearOnBlur`; loading replaces the caret with a spinner and shows the loading bar; `mdOpen`, `mdClose`,
`mdValidityChange`; required validation ("Please make a selection", `errorText` wins); forms through `AWCFormScope`.

## Evidence

Oracles: Mac Chrome 153, `outputs/native-parity/md-autocomplete/web-oracle/` (n2's capture): 60 paint cases, 8 interaction runs
(+ 8 reduced motion). Shared fixtures (byte-identical on both platforms): `ac-web-paint.json` (+ PNGs), `ac-web-states.json`,
`ac-web-states-reduced.json` (+ phase PNGs) in `packages/native-ios/Tests/Fixtures/` and the androidTest assets.

| Platform | Paint | States (interaction, per-frame motion, events, focus, pixels) | Jobs |
| --- | --- | --- | --- |
| macOS (SwiftUI, arm64) | 511/511 | 1,472/1,472 (5 slot runs: d4-079 run 1, d4-087 x3 with the shot-span compare; earlier runs beside other timing jobs: 1,471 — one pick-apple frame before that compare, or one stalled menu-exit frame) | d4-079, 087 |
| iOS simulator (iPhone 17 Pro, iOS 26.3) | 511/511 | 1,469/1,472: three caret frames right after the input takes focus (the harness delivers no inspection for ~80 ms; Remaining) | d4-079, 087 |
| Android (Compose, emulator API 36) | 511/511 | 1,472/1,472 (2 runs) | d4-a22 |

Lifecycle and methods (the source's api / spec contracts: showMenu / closeMenu, loadOptions, getLabels, an options update replacing loaded options, value modes, loading, validity, unmount / remount): macOS 31/31, iOS 31/31, Android 28/28 (`NativeAutocompleteLifecycleTest`); `LivePreviewAutocompleteHostTest` passes.

Test notes:
1. Chrome's frames of `ac-multiple-ltr` escape are labelled one capture slot (33.4 ms) late: the phase has no +33 ms frame and its exit opacity and caret series sit 33 ms after those of its RTL twin and of every other close, while its `mdClose` (+166.8 ms, the end of the 150 ms exit) matches them. Both states harnesses read that phase 33.4 ms earlier (`oracleSlotLate`).
2. Typing phases type on Chrome's own `mdInput` schedule (kiwi at +0 / 17 / 50 / 83 ms).
3. The phase-end shot is compared against each native frame of the capture window and against the span of consecutive frames (per channel the value nearest Chrome's within the two frames): Chrome's capture lands between two native frames, and a press wave fading ~0.03 per frame is 5–6 levels apart between them (n2's analysis, `CardWeb.between` on Compose; the same compare in the Swift harness). The window takes one more frame after the phase end.
4. On iOS a phase's frames and events are timed from the delivery of each pointer input (ios-harness item 31); key presses carry no delivery stamps.
5. The lifecycle fixture forces one view update after each wait, so a preference change made in the last layout pass reaches the inspection.

## Laboratory (gate 3)

Studio module `autocomplete-appearance.js` (the eleven hooks as typed length / colour fields in five groups, registry, theme
options, render validation), retained updates of every source property except the `filterer` closure and the three
virtualization properties, the nine methods with results (`loadOptions(options)`, `getLabels(values)` → `{ value: label }` in
its own result envelope, the validity record), method examples, released policies (iOS / Android). Live hosts: SwiftUI
`apps/native-ios-playground/scripts/test-live-autocomplete.mjs` 42/42 (d4-075, 078, 079: six runs); Compose `LivePreviewAutocompleteHostTest`
passes (d4-a19, a21, a22). Compiled examples 37 SwiftUI (typecheck) and 37 Compose (compile) (usage, theme, copied recipe, all hooks and their defaults, each hook, multiple
inline, free solo, outlined / density / placement, loading, every method / event / slot; generator
`d4-lab/ac/lab/examples-autocomplete.mjs`). Studio suite after the install (d4-080): 869/872 — the three failing tests are `chart-integration` / `orgchart-integration`, failing
identically on canonical without md-autocomplete (d4-092; reported to d5); `autocomplete-integration.test.mjs` 4/4.

## Accessibility (tools/ax)

Seven cases (`empty`, `value`, `open`, `multiple`, `required`, `error`, `disabled`) on Web, macOS, iOS and Android: 0 open findings (work/d4-lab/ac/runs/079/ax, 26 reviewed conventions in `tools/ax/expectations.mjs`): the editable combobox is the platform's text input on iOS and Android (UIKit has no combobox trait; Android's Spinner is not editable — the EditText carries the collapsed / expanded state description and expand / collapse actions that open and close the suggestions); the listbox is md-menu's surface (a named group on macOS, the popup window on Android); `aria-controls` has no SwiftUI link; the polite status ("{count} suggestions available") is a visually hidden text while it has words and is announced when it changes; the caret is hidden from assistive technology; in a disabled field the clear button is a disabled Tab stop, as in Chrome. Fixed on the way: the caret's glyph name was read as text, an empty live region had no speakable text on Android, the clear button was not reported disabled, Tab from the input did not reach the clear button in the Laboratory, the iOS probe did not present the suggestions (it shared one menu scope across cases).

## Exceptions (proposed; reviewer acceptance pending)

- **E1 — Virtualized option list (`virtualize`, `filterMode`, `rowHeight`, `loadOptions(OptionRowSource)`)** (proposed).
  Source: above 200 options (`virtualize="auto"`) or with `virtualize="always"`, md-autocomplete hands the dataset to a
  WASM option store and renders a windowed list with fixed (or first-row measured) row heights; that path filters by
  `filter-mode` (`substring`, `prefix`, `fuzzy`) and `loadOptions()` also accepts a row factory `{ count, getRow }`.
  Platform / API: SwiftUI and Compose renderers (`NativeAutocomplete.swift`, `NativeAutocomplete.kt`); the three properties
  are listed as unsupported in the released policies. Technical reason: the native listbox is md-menu, whose rows are real
  focusable option views (roving focus, typeahead, accessibility elements per option); there is no native WASM option store
  and md-menu has no windowed mode for an autocomplete (its `setVirtualProvider` serves md-menu's own virtual list). User
  impact: every matching option renders as a row (thousands of options cost layout time; `limitResults` caps the rows);
  filtering is always the source's default `substring` (case-insensitive on label, value and supporting text) — prefix or
  fuzzy matching needs the `filterer` closure; a row factory must be materialised into an array. Tested native equivalent:
  substring filtering, `limitResults` and the `filterer` closure in the states, lifecycle and Laboratory host suites;
  `loadOptions(array)` (replaces the list) in the lifecycle and host suites. Evidence: this document's Evidence table; the
  released policies' notes. Reviewer / acceptance: pending.

## Decisions

See "Decisions (autonomous, 2026-11-06, reversible)" in the source review: Tab while open, no `mdRemove`, chip-position
vocabulary, Escape twice, carrier rules, Space on a row, clear button size, loaded options, accessibility while open.

Shared changes made with this component (reported in `work/n2-lab/REQUESTS.md` and `work/n3-lab/REQUESTS.md`): md-menu's
row-key claim (`rowKeyClaim`, Swift and Kotlin; Backspace key name on Compose); Swift md-menu exit timers measured from the
close request; AppKit Tab reads a right-to-left row from the trailing edge (focus bridges carry SwiftUI's layout direction);
md-text-field's Compose composite hook `AWCFieldHooks.expand` (a `role="combobox"` field's TalkBack expand / collapse
actions; fields without the hook are unchanged); the Compose states harness's shot-span compare (`CardWeb.between`, n2's edit,
taken unchanged). Laboratory: the SwiftUI host settles a retained md-autocomplete update until its inspection arrives (gate-7
R4-26, d2's generic settle) and sends Tab from the input as a keyboard does; the tools/ax iOS probe renders md-autocomplete in a
menu scope of its own per case.

## Remaining

- **iOS harness (di):** three caret frames right after the input becomes first responder (`ac-multiple-*` click-open, `ac-keyboard-ltr` type-a): no inspection reaches the fixture for ~80 ms (the sampled value jumps 0 → 0.84 between two samples) while the native rotation is on time; touch delivery is 5–15 ms (reported in `work/di-lab/REQUESTS.md`).
- **macOS beside other timing jobs:** a single menu-exit frame can stall past the envelope (the same value over three samples
  while no frame is drawn; the motion itself is time-based). Slot runs pass (d4-076 run 3, 077, 079 run 1, 087).
- A manual VoiceOver / TalkBack pass ([accessibility.md](accessibility.md)).
