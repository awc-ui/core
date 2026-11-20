# Transfer list parity checkpoint

**Status.** Dedicated SwiftUI (`NativeTransferList.swift`, `TransferListModel.swift`, `AWCKeyViewGroup.swift`) and Compose
(`NativeTransferList.kt`, `NativeTransferListModel.kt`) renderers replace the generic transfer adapters in production dispatch
(`AWCNativeView`, `AWCComponent`). All 24 properties, both events and both methods are released on both platforms, with the
twenty `--md-transfer-list-*` hooks as a typed appearance API and the `::part()` names (the ten source parts, the columns also by side) as a typed part API. Paint,
interaction, motion and lifecycle are compared with the Chrome 153 oracles on macOS, the iOS simulator and the Android
emulator; the Laboratory integration (gate 3) and the accessibility comparison (tools/ax) are in place. No exception is proposed. Not the separate final audit.

Source review and decisions: [md-transfer-list-source-review.md](md-transfer-list-source-review.md). Plan:
[md-transfer-list-native-plan.md](md-transfer-list-native-plan.md).

## Contract and implementation

**Data.** `items` as an array or its JSON string (`value`, `label`, `description`, `disabled`); `value` (the target side,
controlled: the component never writes it, `mdChange` carries the next value). Checked rows are internal state per side,
pruned when their item leaves the side or disappears; searches filter by label and description (case-insensitive).

**Layout** — the source's CSS grid (`1fr auto 1fr` with the gap; a `minmax(0, 1fr)` row that is the host's block size), from
a shared model:
- columns: border 1, the container shape, `min-inline-size` hook; searchable columns have the definite cap
  (`--md-transfer-list-column-max-block`, else the height hook, else 360px), non-searchable ones the cap as a maximum (TL6);
  `full-width` / `full-height` (read as `fullWidth` / `fullHeight`, as on md-card);
- header (select-all md-checkbox, title, count pill with the count template), search (outlined md-text-field, label = the
  placeholder, the leading search icon, internal clear), the list (rows: inert md-checkbox, label + description with
  ellipsis), the empty state (icon + text, polite status);
- the movers: md-icon-buttons — move-all tonal, move-checked filled (only the two filled ones with `singleStepOnly`), centred;
  at `max-width: 640px` the grid stacks and the movers turn 90° (RTL: mirrored in the column layout);
- Roboto advances, density on every spacing/size the source derives from it.

**Interaction.** A row click or Space/Enter toggles it (disabled rows and a disabled list exempt); select-all toggles the
eligible visible rows (indeterminate when some); movers move the checked rows (or all eligible) and emit `mdChange` (next
value) then `mdMove {direction, moved, target}`; the controller methods `moveSelectedRight()` / `moveSelectedLeft()` do the same
(nothing to move: no events). The row checkbox is inert (no focus, presses go to the row).

**Focus** (as Chrome):
- a press focuses a row without the ring (`:focus-visible` after a mouse focus); keys show it;
- Tab follows the source order (source select-all, search, rows, movers, target select-all, search, rows), whatever the
  layout: AppKit and UIKit order key views by geometry (rows first), so the list keeps a key-view group in source order
  (`AWCKeyViewGroup`; on UIKit applied over canonical's `AWCDocumentTabOrder`, whose document order does not cover text
  inputs); Compose's one-dimensional order is the composition order;
- a press focuses a mover (Chrome focuses a button on mousedown): AppKit's button bridge; UIKit on touch / pointer down;
  Compose outside touch mode (a mouse or keyboard user's window; in touch mode Android has no pointer focus);
- a mover that becomes disabled while focused stays the focused element (Tab continues from it; Space and Enter do nothing):
  `_retainFocus` on the shared focus bridge (AppKit / UIKit; `AWCNativeView` leaves such controls outside SwiftUI's subtree
  `.disabled`, which makes UIKit resign the first responder); Compose soft-disables the mover while it holds focus;
- movers are keyed by slot (the source re-renders its unkeyed buttons in place: focus keeps the slot when
  `singleStepOnly` changes the set);
- a disabled list keeps its scroll region focusable (`tabindex=0` in the source): a press in it focuses the scroller.

**Paint and motion.** Row state layer (hover 0.08, focus 0.12, checked tint in primary), the md-ripple wave under the row
checkbox, the focus ring; the row background transition `background-color 100ms ease`, interpolated in premultiplied Oklab
like Chrome, starting at the frame that draws the change (an interrupted transition continues from the running one's value
at that frame). A row that leaves (moved, filtered) drops its transition and hover, as the source's keyed rows do. Reduced
motion removes the transition.

**Appearance.** `AWCTransferListAppearance` (20 fields = the source hooks; lengths px/pt/dp, colours `#RRGGBB[AA]`, the item
padding as `AWCTransferListInsets` — the CSS shorthand's physical sides). Swift `.awcTransferListAppearance(_:)`; Compose
`AWCTransferListAppearanceScope`. Nested scopes merge field by field (inner wins).

**Typed `::part()` API.** `AWCTransferListPartAppearance` holds one `AWCTransferListPartStyle` (`backgroundColor`, `color`,
`borderColor`, `shape`, `size`, `opacity`) per source part, plus `columnSource` / `columnTarget` over `column` (the columns by side, as `::part(column-source)` / `::part(column-target)`: 12 typed names); Swift `.awcTransferListPartAppearance(_:)`, Compose
`AWCTransferListPartAppearanceScope`; nested scopes merge part by part, field by field. Part values come from the outer
tree, so they win over the hooks and every state rule, as `::part()` declarations do.

| Part | Typed fields (CSS property) |
|---|---|
| `column` | `backgroundColor`, `borderColor` (`border-color`), `shape` (`border-radius`) |
| `header` | `backgroundColor`, `borderColor` (`border-block-end-color`: the divider under it) |
| `header-title` | `backgroundColor` |
| `count` | `backgroundColor`, `color`, `shape` |
| `search` | `backgroundColor` (the field's padded box) |
| `list` | `backgroundColor` |
| `item` | `backgroundColor` (replaces the hover / checked / focus layers), `shape` (the row, its focus ring and ripple) |
| `empty` | `backgroundColor`, `color` (text and icon) |
| `empty-icon` | `color`, `size` (`font-size`), `opacity` |
| `controls` | `backgroundColor` |

Verified against Chrome's own `::part()` rendering: `web-reference/tl-parts.html` (15 cases: each part, all parts in light
LTR and dark RTL, and a baseline case that is pixel-identical to `paint.json`'s shot of the same steps) →
`web-oracle/parts.json`, shared as `transferlist-web-parts(.json)` = `TransferListWebParts(.json)`.

**Accessibility.** Web: a `group` (aria-disabled) with two multiselectable `listbox`es named by their titles, `option`s
(selected, disabled), select-all checkboxes named by the select-all label, search fields, named movers, the empty `status`.
SwiftUI: options through the shared focus bridge (`roleOverride: option`, selected, disabled), the lists labelled by their
titles, the empty state as a combined updating element. Compose: collection lists (`CollectionInfo`) named by the titles,
rows selected/disabled with an onClick action, the empty state a polite live region, the whole a traversal group.
tools/ax compares the four platforms: an Android option is named once (label, then description) and the Tab order on macOS follows the source order.

**Inspection.** `AWCTransferListInspectionScope` / `.environment(\.awcTransferListInspector)` give the parity probe (parts,
per-row state, snapshot, toggles and searches); the Laboratory inspection exports the same parts (columns, headers, counts,
searches, lists, rows, movers, controls) under the component root on both platforms.

## How the oracles are compared

- **Paint.** Every part box within 1 px and every flat pixel of the clip; the harness steps are replayed at Chrome's own
  times from the oracle's input timeline, on a replay clock that row transitions and md-ripple waves render on (the shot
  pauses Chrome's animations at its frame, so the native frame is rendered at that instant: `AWCRippleTestClock` on Swift,
  the Compose test clock). The oracle's park move (1190, 600) ends the row's `:hover` (in the 500 px stacked cases it falls
  outside the viewport: the release is that move). Keyboard-focus cases replay the oracle's Tabs.
- **States.** Per phase the settled sample must match exactly (value, rows: label / checked / background / ring, counts,
  select-all, queries, empty texts, movers, the focused part) and events by order, phase and payload. Every Chrome frame in
  between is compared group by group with the native frames one frame either side. Chrome's samples are read in rAF, before
  Stencil re-renders, so what is read from the DOM (rows, counts, select-all, empty texts, movers, rings) trails the property
  by up to two frames; a row's background must lie within the native row's values over those frames (a transition Chrome
  starts on a forced style recalc runs a fraction of a frame ahead); a row that has already left natively is not compared;
  the focused part may be one the replay passes through between those frames; keys less than a frame apart (the oracle's
  nine Shift+Tabs in 15 ms) go in together.
- **Android focus.** Outside touch mode an Android window always keeps a focused view, so the fixture's page body is a focus
  target: the window's first focusable from the top (where the platform hands focus when the focused row leaves, as Chrome's
  body takes it) and the target of a press outside every focusable part or on a disabled mover.
- **Platform fonts** (the [md-avatar](md-avatar.md) method). The Arabic count (`tl-locale-ar-rtl`) has no Roboto glyphs: its
  advances come from the platform's fallback font (Chrome: macOS; Android: Noto). On Android the pill is compared with the
  same run measured by the device's own fonts where CSS places it (inline-start edge, top and height as Chrome's; width = the
  run + the 16 px padding); Chrome's width is reported. Swift shares Chrome's macOS fonts and compares strictly.

## Arrow keys on Android

Source behaviour: rows are individual tab stops with no roving; the component handles Space and Enter only, so in Chrome an
arrow key leaves focus where it is (the oracle's `ArrowDown-no-roving` phase). Compose: a key the focused row does not
consume is the platform's directional focus navigation. The row therefore consumes the four arrow keys when they come from a
keyboard (the list scrolls as in Chrome and focus stays), while a D-pad or other non-alphabetic device keeps directional
navigation (TV, remote and switch access have no other way through the rows). The earlier proposed exception TLX-A2 is
withdrawn: the states test records no proposed exception.

## Evidence

Everything is under `outputs/native-parity/md-transfer-list/`.

| Gate | Result | Evidence |
|---|---|---|
| Gate 1 source fix TL6 | contract test fails before, passes after (8 suites / 127 tests) | `source-tests/` |
| Chrome 153 oracles (Mac, TL6 build) | 105 paint cases (input timeline, shot frame), 15 `::part()` cases, 9 + 1 state runs | `web-oracle/` (v1 kept) |
| Shared fixtures | Swift `Tests/Fixtures/transferlist-web-{paint,parts,states}` = Android assets `TransferListWeb{Paint,Parts,States}` byte for byte | `checkpoint.json` |
| Swift paint (`NativeTransferListPaintIntegration`) | 2,388/2,388 on macOS (job 1-1-035) | `native-swift/` |
| Swift states (`NativeTransferListStatesIntegration`) | 138/138 on macOS (job 1-1-035) | `native-swift/` |
| iOS simulator (iPhone 17 Pro, iOS 26.3.1 (AWC-n1)) | iPhone: paint 2,388/2,388, states 138/138 (job 1-1-035); iPad Pro 11-inch (M5), iOS 26.3.1 (AWC-n1-ipad): paint 2,388/2,388, states 138/138 three times (job 1-1-035, with the story 1-4 focus-entry patch) | `native-swift/ios-*.log` |
| Android paint (`NativeTransferListPaintTest`) | 2,388/2,388 on emulator-5558 (job 1-1-034; Arabic count by the platform-font run) | `native-android/` |
| Android states (`NativeTransferListStatesTest`) | 138/138 on emulator-5558, settled and motion failures 0, no proposed exception (job 1-1-034) | `native-android/` |
| Accessibility (tools/ax, 6 cases) | 6 cases (default, not-searchable, single-step, disabled, empty-target, emptied) on Web, macOS, iOS and Android: 0 open findings (job 1-1-032) | `outputs/native-parity/_ax-n1/md-transfer-list/report.md` |

## Laboratory (gate 3)

- `transferlist-appearance.js`: the 20 hooks (asserted against `md-transfer-list.css`, the IR and both released policies)
  and `TRANSFER_LIST_PARTS` (the ten parts = the IR's `cssParts` = both policies' `visualParts`); Styles panels on
  Web/iOS/Android; the item padding as a four-side insets editor; invalid input keeps the last valid value.
- Retained updates for the 24 properties with their source types (Studio, SwiftUI host, Android host); methods through the
  hosts' controllers.
- Copyable examples: 36 SwiftUI examples type-checked and 36 Compose examples compiled (24 of them with typed parts).
- Live hosts: `test-live-transferlist.mjs` 22/22 checks (job 1-1-035); `LivePreviewTransferListHostTest` passes (job 1-1-034).
- `transferlist-integration.test.mjs` and the Studio suite: transferlist-integration 8/8, all Studio suites 886/886 (job 1-1-035).

## Decisions and open items

See the source review ("Decisions (autonomous, 2026-10-30, reversible)" and "Decisions (autonomous, 2026-11-12,
reversible)"). Pending: the independent final audit.
