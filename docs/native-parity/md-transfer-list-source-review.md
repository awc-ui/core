# Transfer list source review (md-transfer-list)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
five source defects are fixed test-first and mirrored into `packages/core/src`
(one adds a prop), and a browser reference (paint, per-frame interaction,
reduced-motion and forced-colours oracles) is captured. The oracle is
**provisional**: it was captured in headless Chromium 141 on Linux while the
Mac runner was blocked, and must be recaptured on the Mac (Chrome 153) and
diffed before it gates native work. No native code has changed. This is not a
native completion record.

## Public contract

**Props.**

* Data: `items` (`{value, label, description?, disabled?}[]`, or a JSON
  string attribute), `value` (`string[]`, mutable, **property only**: there is
  no `value` attribute). Source = items not in `value`; target = items in
  `value`; both columns list items in `items` order.
* Search: `searchable` (true, reflected), `source-search-placeholder`
  ("Search choices"), `target-search-placeholder` ("Search chosen"),
  `search-icon` ("search"). The query matches label **or description**,
  case-insensitively, trimmed.
* Headers: `source-title` ("Choices"), `target-title` ("Chosen"),
  `show-select-all` (true, reflected), `count-template`
  ("{checked}/{total} selected"; only the first `{checked}` and the first
  `{total}` are replaced), `select-all-label` ("Select all {title}", **new**,
  every `{title}` replaced; TL3).
* Movers: `move-right-label` ("Move selected to target"), `move-left-label`
  ("Move selected to source"), `move-all-right-label` ("Move all to target"),
  `move-all-left-label` ("Move all to source"), the four `move-*-icon`s
  (`chevron_right`, `chevron_left`, `keyboard_double_arrow_right`,
  `keyboard_double_arrow_left`), `single-step-only` (hides the two move-all
  buttons, reflected).
* Empty state: `empty-text` ("No items"), `empty-icon` (none).
* `density` (0 … −4, reflected), `disabled` (reflected). CSS-only attributes
  `full-width`, `full-height`.

**Events** (`bubbles`, `composed`):

* `mdChange` — detail: the new `value` array.
* `mdMove` — detail `{direction: 'right' | 'left', moved: string[], target:
  string[]}`, dispatched right after `mdChange` from the same move.
* Nothing is emitted for checks, select-all, searches, or controlled
  `value`/`items` changes. Inner `md-text-field` / `md-checkbox` /
  `md-icon-button` events are contained (TL1). Native composed `click` and
  `input` events still bubble out retargeted to the host.

**Methods.** `moveSelectedRight()`, `moveSelectedLeft()` (same as the movers;
no-op with nothing eligible).

**Move rules.**

* Selected moves take only **visible, enabled, checked** items of that side;
  a checked item hidden by the filter is not moved, and its check is cleared
  with the rest of that side (documented).
* Move-all takes every enabled item of that side, **ignoring the filter**.
* Right moves append to `value` in check order (`Set` insertion order); left
  moves remove. `moved` lists items in that same order.
* A move with nothing eligible does nothing (no events). After a move the
  side's checks are cleared.
* Checks are per side and are dropped when an item leaves that side or the
  pool by a controlled `value` / `items` change (TL4).

**Parts.** `column` (+ `column-source` / `column-target`), `header`,
`header-title`, `count`, `search`, `list`, `item`, `empty`, `empty-icon`,
`controls`. (`column`, `column-source` and `column-target` are missing from
the CEM.)

**CSS hooks.** `--md-transfer-list-width`, `-min-width`, `-max-width`,
`-height`, `-min-height`, `-max-height`, `-column-min-width` (260px),
`-column-max-block` (360px or the configured height), `-container-shape`
(16px), `-container-color`, `-header-color`, `-header-text-color`,
`-item-inset` (6px), `-item-padding`, `-item-gap`, `-divider-color`,
`-controls-gap`, `-empty-icon-size` (32px tapering), `-control-size`,
`-control-icon-size` (the last two are not in the header).

**Anatomy and geometry** (DPR 1, light, density 0, 900px container):

* Host grid `1fr auto 1fr`, gap 16: columns 410, controls 48.
* Column: surface-container-low, 1px outline-variant border, radius 16. With
  `searchable` the column has a definite height (360), so filtering never
  collapses it.
* Header 73 tall, padding 12/16, surface-container fill, bottom divider:
  select-all `md-checkbox` (48 target; checked / indeterminate / disabled when
  nothing eligible), title 14/500/20, count pill 11/500/16 on
  secondary-container.
* Search: outlined `md-text-field`, internal clear button, leading search
  icon; 80 tall with its padding.
* List `role="listbox"`, `aria-multiselectable`, named by the column title,
  padding 4; rows `role="option"` with `aria-selected` and `aria-disabled`,
  64 tall with a description (inset 6, padding 8/10, gap 12, radius 8), label
  14px, description 12px on-surface-variant, an inert decorative
  `md-checkbox` and an `md-ripple`.
* Row states: hover on-surface 8%; checked primary 8%; checked + hover primary
  12%; keyboard focus 3px secondary outline (offset −3) with on-surface 12%,
  or primary 12% when checked (TL5); disabled row 0.38, no pointer events.
* Movers: `md-icon-button` 40 × 40, icon 24, gap 12; move-all tonal, single
  filled; each disabled when it has nothing to move. In RTL they are mirrored
  (`scaleX(-1)`).
* Empty state `role="status"`: text 14px on-surface-variant, optional 32px
  icon.
* Density −1…−4: movers 40 → 24, select-all target 48 → 32, rows 64 → 40,
  header 73 → 51, search 80 → 56.
* Viewport ≤ 640px (a **viewport** media query): one column, controls in a
  64-tall row between the lists, movers rotated 90° in both directions (TL2).

**Interaction.**

* Row click, Space or Enter toggles the check (disabled rows ignore it).
  Every enabled row is a Tab stop; arrow keys do nothing (documented).
* Select-all toggles the visible enabled items of its side; checked when all
  are checked, indeterminate when some are.
* Tab order: select-all, search, enabled rows, enabled movers, then the
  target column. After a move the focused mover becomes disabled and keeps
  focus; Tab continues from it.
* Search: typing filters live; Escape (or the clear button) clears; the count
  and select-all follow the visible rows.
* Disabled host: rows `tabindex=-1`, lists become focusable scroll regions,
  movers and checkboxes disabled.
* Motion: row background 100ms ease, ripple, the inner components' own
  transitions. Reduced motion removes the row transition (the nested ripple
  and icon-button morph keep their own timing).

## Paint reference

`paint.json` holds 105 cases: light/dark × LTR/RTL × 11 states (default,
checked + indeterminate, all checked, filtered, filtered empty with icon,
target empty with icon, target empty text, disabled, not searchable, no
select-all, single-step-only), densities −1…−4 in both directions, two dense
empty states, the stacked 500px layout (both themes and directions, host and
ancestor RTL), host `dir`, keyboard focus on select-all/search/row/checked
row/mover in both directions, row hover (plain, checked, disabled) in both
themes, `ro` and `ar` localisation (all labels and templates), custom icons,
long labels, a 30-item scrolling list, `full-width`, `full-height`, all
visual hooks together and each hook alone. `paint-forced-colors.json` adds 5
forced-colours cases.

## Interaction and motion reference

`states.json` holds 9 runs (84 phases, 1,598 per-frame samples, 86 events,
707 animation records): pointer toggles, disabled row, every mover and
select-all in LTR and RTL with event payloads; the full keyboard sequence (Tab
order, Space/Enter toggles, ArrowDown, mover activation, focus after a move);
search typing, select-all over a filter, empty result, Escape clear,
description match, clear button, a move with a hidden checked item and target
search; single-step-only; disabled host; `moveSelectedRight/Left()`,
controlled `value`/`items`/`countTemplate`; and the stacked 500px layout in
both directions. `states-reduced-motion.json` repeats a row toggle and a move
with `prefers-reduced-motion: reduce`.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix. The
tests are in `md-transfer-list.contract.e2e.ts` (5 tests, all failing before
their fixes).

* **TL1. Inner component events leaked as the host's API**
  (`md-transfer-list.tsx`). Typing in a search field, clearing it, toggling
  select-all or pressing a mover dispatched composed `mdInput`, `mdSearch`,
  `mdChange` (a string, or `{checked}`), `mdClear` and `mdClick` from the
  nested components; a host `mdChange` listener received non-array details
  (50 extra records in the test).
  * Fix: the nested listeners stop propagation at the boundary.
  * Test: only `[mdChange (array), mdMove]` reach a host listener.
* **TL2. In the stacked layout, RTL movers were mirrored instead of
  rotated** (`md-transfer-list.css`). The rotate rule came before the RTL
  `scaleX(-1)` rule with equal specificity, so source order kept the flip.
  * Fix: the stacked rule moves after the RTL rule.
  * Test: host-RTL, ancestor-RTL and LTR at 500px rotate; at 1100px RTL
    mirrors and LTR has none.
* **TL3. The select-all accessible name was hard-coded English**
  (`md-transfer-list.tsx`). Every other label is a prop.
  * Fix: new `select-all-label` prop ("Select all {title}").
  * Test: default and Romanian names.
* **TL4. Checks resurrected after controlled changes**
  (`md-transfer-list.tsx`). A checked item moved across by a controlled
  `value` and back, or removed from `items` and re-added, came back checked.
  * Fix: a `value` / `items` watcher prunes each side's checks.
  * Test: both round trips, and the count.
* **TL5. A checked row lost its selected tint while keyboard-focused**
  (`md-transfer-list.css`). The focus rule's neutral on-surface 12% layer
  out-ranked `--checked`, so after Space the row looked unselected apart from
  its checkbox glyph (hover already composed checked + hover as primary 12%).
  * Fix: `.md-transfer-list__item--checked:focus-visible` uses primary 12%.
  * Test: keyboard-focused checked row equals checked + hover; unchecked
    focused row differs.

The readme documents `select-all-label`, the check pruning, the event
containment and that native `click` / `input` still bubble.

## Observed, not changed (decisions needed)

* **Native composed `input` events** from the search fields bubble out of the
  host (one per keystroke, target = the host). Frameworks that bind `input`
  as a value event would read the host's `value` on every keystroke. This is
  the library-wide pattern for field-bearing components.
* **`count-template`** replaces only the first `{checked}` / `{total}`
  (`select-all-label` replaces all `{title}`s).
* **`moved` / `value` order follows check order**, not item order.
* **Move-all ignores the filter**, selected moves honour it, and a hidden
  checked item's check is dropped on a move (documented).
* **The stacked layout uses a viewport media query**, so a narrow container on
  a wide screen keeps the side-by-side grid (two 260px column minimums plus
  the controls need about 600px).
* **Accessibility**: the host `role="group"` has no name; count changes are
  not announced; each row is a Tab stop with no roving focus or arrow keys
  (documented); the search field's clear button is "Clear" from
  `md-text-field` and cannot be localised from here.
* **Forced colours**: the search label is hidden under the field's forced
  Canvas input background (an `md-text-field` concern), and the checked-row
  tint disappears (selection still shows in the checkbox).
* **Reduced motion** does not reach the nested `md-ripple` (450ms) or the
  icon-button morph (owned by those components).

## Decisions (autonomous, 2026-10-30, reversible)

* **TL6 (Gate 1, fixed test-first): the searchable column height follows the prop.** An authored `searchable="false"` keeps
  its attribute (Stencil removes only a reflected boolean attribute it wrote itself, i.e. `""`), so `:host([searchable])`
  still gave a non-searchable list the searchable list's fixed 360px columns, while the same list set by property got
  content-sized columns. The rule now keys on a host class (`md-transfer-list--searchable`) set from the prop. Contract test
  `sizes non-searchable columns by their content whether searchable="false" is authored or set (TL6)`: fails on the previous
  source (`source-tests/tl6-before.log`), passes after with the md-transfer-list and md-dialog suites
  (`source-tests/tl6-after.log`, 8 suites / 127 tests). The Mac Chrome 153 oracles were recaptured with this build (private
  review build `stencil.config.tl.ts`; the previous capture is kept in `web-oracle/v1/`): only the four not-searchable paint
  cases changed geometry.
* **Oracle input timeline and the shot instant.** The paint and states harnesses (`web-reference/cp-oracle.js`) record the
  trusted pointer and key events with their time stamps; the paint harness pauses every animation at the frame it shoots
  (`shotFrame`), because the capture's own latency reached ~250 ms (ripple waves had faded past the recorded frame in two
  cases). The native tests replay the harness steps at Chrome's times (md-ripple waves at Chrome's phase; a release with no
  move after it in the 500px stacked cases is the harness's move to (1190, 600), outside that viewport).
* **`full-width` / `full-height`** are host attributes (CSS sugar, not properties); natively they are read as the
  `fullWidth` / `fullHeight` properties, as on md-card. `full-height` makes the column cap 100% of the grid row.
* **`--md-transfer-list-item-padding`** is a padding shorthand: the native appearance takes its four physical sides
  (`AWCTransferListInsets`, top/right/bottom/left; one or two values expand as in CSS).
* **The row checkbox is inert** as in the source: out of the focus order and of hit testing (presses go to the row).
* **Focus visibility**: a press focuses the row without the ring (Chrome's `:focus-visible` after a mouse focus); a key on the
  focused row shows it.

## Decisions (autonomous, 2026-11-12, reversible)

* **`::part()` styling is a typed native API** (replaces the earlier open item). The ten source parts (column, header,
  header-title, count, search, list, item, empty, empty-icon, controls) take an `AWCTransferListPartStyle` each
  (`AWCTransferListPartAppearance`; Swift `.awcTransferListPartAppearance`, Compose `AWCTransferListPartAppearanceScope`), with
  the properties each part's own box paints: background colour on all but empty-icon; colour on count, empty and empty-icon;
  border colour on column (its border) and header (the divider under it); corner radius on column, count and item; size and
  opacity on empty-icon. Part values win over the hooks and every state rule, as declarations of the outer tree do
  (`::part(item) { background-color }` replaces the hover / checked / focus layers). Verified against Chrome's `::part()`
  rendering (`web-oracle/parts.json`, 15 cases: the columns also by side). Alternative: list the parts as unsupported visual parts. Revert: remove the
  two types, the environment / scope and the `visualParts` of the released policies.
* **Focus follows Chrome.** A press focuses a mover (AppKit bridge; UIKit touch / pointer down; Compose outside touch mode);
  a mover that becomes disabled while focused stays the focused element until focus moves on (`_retainFocus` on the shared
  focus bridge; `AWCNativeView` keeps such controls and the list outside SwiftUI's subtree `.disabled`; Compose soft-disables
  the mover while it holds focus); movers keep focus by slot; a disabled list's scroll region takes focus on a press; Tab
  follows the source order through a key-view group (`AWCKeyViewGroup`) where the platform orders key views by geometry.
  Alternative: platform defaults (focus leaves a disabled control; geometric Tab order). Revert: drop `_retainFocus`, the
  group and the press handlers.
* **Arrow keys on an Android row behave as on the Web for keyboards** (replaces the proposed exception TLX-A2, withdrawn). The
  component handles no arrow key; Chrome leaves focus on the row. Compose consumes the four arrows on a row when they come from
  a keyboard (focus stays, the list scrolls) and leaves D-pad and other non-alphabetic devices their directional focus
  navigation, so no user is trapped on a row. No exception is proposed. Alternative: the platform's directional navigation for
  every device (the exception TLX-A2). Revert: drop the keyboard-type check in the row's key handler.
* **Android has no unfocused state outside touch mode.** The parity fixtures model the page body as a focus target (the
  window's first focusable from the top, and the target of a press outside every focusable part or on a disabled mover), as
  Chrome's body takes focus; the renderer itself never clears focus. The runs execute outside touch mode (a mouse press or a
  key leaves it on Android) and restore it afterwards.
* **Forced colours are not compared.** The source has no `forced-colors` rule of its own; the five `paint-forced-colors.json`
  captures show Chrome's user-agent forced palette (system colours, `forced-color-adjust`) on the nested controls, a browser
  facility without a component contract. The platforms' own contrast settings act through the theme. The captures are kept
  as reference. Alternative: a forced-palette mode on the list and its nested md-checkbox / md-text-field / md-icon-button
  (Android's `AWCAccessibilityAppearanceScope(forcedColors)` exists per component). Revert: add that mode and compare the
  five cases.
* **How motion samples are compared.** Chrome's samples are read in rAF before Stencil re-renders and its input events carry
  CDP timestamps, so a frame-exact comparison would test the sampler: each observable group must match a native frame within
  one frame either side (what is read from the DOM may trail by two; a row's background within the native values over those
  frames; rows already gone natively are not compared; focus may be one the replay passes through; key bursts go in
  together). Settled samples and events stay exact. Alternative: frame-exact comparison of whole frames (fails on the
  sampler's own artefacts). Revert: `motionBad()` in both states harnesses.
* **Platform fonts for the Arabic count on Android** (the md-avatar method): compared with the device-font run where CSS
  places it; Chrome's width reported. Alternative: bundle an Arabic face identical to Chrome/macOS's fallback.

## CEM / source drift

* The CEM is missing the `column`, `column-source` and `column-target` parts
  and needs regenerating for `select-all-label` (the native generated
  contracts do not have it yet).
* The CSS header omits `--md-transfer-list-control-size` and
  `--md-transfer-list-control-icon-size`, and lists the `full-width` /
  `full-height` attributes inside the hooks block.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch,
  serial): own suites before 9 suites / 136 tests (both components); own +
  `md-dialog` before 14 / 233, after 16 / 244. Contract tests failed on the
  original source (`before-contract2.log`, `tl-focus-before.log`) and pass
  after (`final-own3.log`). See
  `outputs/native-parity/md-transfer-list/source-tests/`; the diffs are in
  `source-changes/`.
* **Oracle:** `outputs/native-parity/md-transfer-list/web-oracle-cloud/` (see
  its README): `paint.json` 105 cases, `paint-forced-colors.json` 5,
  `states.json` 9 runs / 84 phases / 1,598 frames,
  `states-reduced-motion.json` 1 run / 4 phases / 95 frames, 198 screenshots.
