# Multi select source review (md-multi-select)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried. The shared option carrier is covered in
  [md-select-source-review.md](md-select-source-review.md).
* Two source defects are fixed test-first here (D4, and D6 shared with
  the other pickers), and the carrier fix D1 changes what this picker
  lists and selects. Both are mirrored into
  `packages/core/src`.
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac
(Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.

## Composition

Everything `md-select` composes (a readonly `md-text-field` trigger, an
`md-menu` surface, carriers or `options`, the WASM path above 200 options),
plus:

* **Value display** (`display-mode`): `chips` (default: the field shows "N
  selected" and removable `md-chip`s sit in a row outside it), `chips-inline`
  (chips inside the field; `chip-overflow="count"` collapses the overflow
  into a "+N" counter button, `wrap` grows the field), `count` ("N
  selected", or `countFormatter`), `text` (comma-joined labels).
* **Chip row placement** (`chip-position`): `bottom` (default), `top`,
  `left`, `right`. Left/right force the field to `density="-3"`.
* **Triggers** (`trigger`): `field` (default), `button` (an outlined
  `md-button` with `trigger-icon` and `trigger-label`), or any element in
  `slot="trigger"`. Button and slotted triggers always show chips.
* **Menu extras:** a `menu-header` slot; a search header when `filterable`
  (focus moves into it on open); a "Select all" row (`show-select-all`,
  tri-state, honours `max-selected`, skipped on the virtual path and while
  loading); `no-options` / `no-results` slots.
* **Rows** are `type="checkbox"` `md-menu-item`s with `aria-selected`; the
  menu stays open across picks.
* A polite live region (`part=live-region`) announces "None selected" /
  "N selected" on every change.

## Public contract

| Property | Default and values |
|---|---|
| `value` | `[]`; `string[]`, **JS property only** (no attribute) |
| `options` | `[]`; JS array or JSON-array attribute; ignored when carriers exist |
| `display-mode` | `chips` \| `chips-inline` \| `count` \| `text` |
| `chip-overflow` | `count` \| `wrap` (chips-inline only) |
| `chip-position` | `bottom` \| `top` \| `left` \| `right` |
| `trigger`, `trigger-icon` (`add`), `trigger-label` (falls back to `label`) | `field` \| `button` |
| `max-selected` | `0` = no cap; picks past the cap are rejected and the row is reverted |
| `show-select-all`, `select-all-label` (`Select all`) | |
| `countFormatter` | JS function `(n) => string` |
| `filterable`, `filter-mode`, `filter-label`, `search-placeholder`, `searching-label` | As `md-select` |
| `clearable`, `clear-icon`, `clear-label` | As `md-select` |
| `loading`, `loading-text`, `no-results-text`, `no-options-text` | As `md-select` |
| `virtualize`, `row-height`, `placement`, `match-trigger-width`, `max-height` | As `md-select` |
| `label`, `placeholder`, `supporting-text`, `error`, `error-text`, `variant` (`outlined`), `density`, `name`, `required`, `value-missing-label`, `reserve-supporting-space` | As `md-select`; `error-text` doubles as the validation message |
| `disabled`, `soft-disabled` | Soft-disabled keeps the trigger focusable but blocks every interaction |
| `open` | Reflected; a change opens (an initial `open` opens without focus) |

Events (composed unless noted): `mdChange` (`string[]`, the whole
selection), `mdRemove` (the value a chip removed; fires before its
`mdChange`), `mdClear` (after its `mdChange`), `mdOpen`, `mdClose`,
`mdValidityChange` (not composed, not on mount, deduplicated).

Methods: as `md-select` (`show`, `close`, `focusTrigger`, `reset`,
`loadOptions`, `setQuery`, `getLabels`, validity API). `reset()` emits
`mdChange([])` but no `mdClear`.

Slots: default (carriers), `trigger`, `trigger-leading`, `trigger-trailing`,
`menu-header`, `no-options`, `no-results`, `loader`, `menu-loader`,
`dropdown-icon`.

Parts: `frame`, `field`, `button`, `button-desc`, `caret-box`, `caret`,
`clear`, `chips`, `chip`, `overflow-chip`, `menu`, `menu-header`,
`listbox`, `option`, `option-selected`, `option-icon`, `select-all`,
`select-all-item`, `search-wrap`, `search`, `search-spinner`, `empty`,
`loading-spinner`, `loading-bar`, `loading-progress`, `live-region`;
forwarded `field-container`, `field-input`, `field-label`, `chip-remove`,
`chip-label`, `menu-surface`, `empty-text`.

Hooks: 38 `--md-multi-select-*` properties (width, min-width,
trigger-width, frame-gap; chip gap/radius/height/outline; inline-chips
block-start; caret colour/size/box; clear colour, background, hover
background, size, radius, icon size, focus-ring colour/width/offset; option
icon colour/size; search background, colour, placeholder colour, padding,
border colour/width, spinner size; empty colour/font/padding; spinner,
loader and loading-padding; select-all divider colour/width). Every hook
with a resting-state effect painted its sentinel in the oracle
(`multi-hook-*`); `clear-hover-bg` and `clear-focus-ring-*` only paint in
hover and focus states, which the paint matrix does not drive.

**Keyboard:** ArrowDown, **ArrowUp**, Enter and Space open; in the list,
Space and Enter toggle the focused row and keep the menu open; Escape closes
and returns focus to the trigger. Chip ✕ buttons are tab stops; removing a
chip moves focus to the chip that takes its place (or the new last chip),
and to the trigger when no chip remains.

## Layout reference (DPR 1, Roboto, light theme)

* **Field:** the `md-select` ladder (56 / 52 / 48 / 44 / 40). Caret 24×24
  in a 24 caret box at inline-end 16.
* **Clear:** a round 28×28 button (18px glyph) ending 0px before the caret
  box (x 316–344 in a 360 field).
* **Chips (chips mode):** 32 high, radius 8, label-large 14px, 4px gaps,
  the row 8px under the field (y 88 for a field ending at 80). At −4 the
  chips are 24 high with 12px labels and the frame gap is 6.
* **Chips-inline:** chips start at inline 23 inside the field, top 12; the
  "+N" counter is 44×32. At width 280 with four values the field shows one
  chip and "+3".
* **Left/right chips:** the field shrinks to the remaining width at
  density −3 (44 high); chips are vertically centred against it.
* **Button trigger:** a 32-high outlined button (primary label), chips 8px
  below.
* **Menu:** as `md-select` (4px under the field, trigger-wide). Search
  header 44 high, "Select all" row 48 plus a 1px divider, option rows 48
  (26–29 at −4), a 40px check column, option icons **20px** (24px in
  `md-select`).
* **Empty:** a 44-high `part=empty` status row in on-surface-variant 14px.

## Paint reference

As `md-select` for the field, caret, rows and selected-row fill
(`#E8DEF8` / dark `#4A4458`), plus:

| Element | Light | Dark |
|---|---|---|
| Chip (input variant) | outline-variant `#CAC4D0` 1px outline, on-surface-variant label `#49454F`, ✕ | outline-variant `#49454F`, label `#CAC4D0` |
| "+N" counter | same outline and label colours | |
| Select-all row | tri-state: empty, dash (some), check (all eligible) | |
| Select-all divider | outline-variant 1px | |
| Filter header | surface-container `#F3EDF7`, placeholder on-surface-variant | |
| Empty text | on-surface-variant 14px | |

## Interaction and motion reference

Runs (LTR and RTL): `multi-pointer`, `multi-keyboard`,
`multi-open-focus-with-value`.

* **Pointer** (`show-select-all clearable`): opening focuses the "Select
  all" row; each pick toggles, keeps the menu open, adds a chip and updates
  the live region ("1 selected", "2 selected"). "Select all" with two of
  three eligible selected selects all three (Cherry is disabled). Escape
  closes to the trigger. A chip ✕ emits `mdRemove "a"` then
  `mdChange ["b","d"]` and focus moves to the next chip's ✕. Clear emits
  `mdChange []` then `mdClear` and focus returns to the trigger input (fix
  D6; it fell to the document before).
* **Keyboard** (`max-selected="2"`): ArrowDown opens on Apple; Space
  toggles Apple on; ↓ ↓ reaches the disabled Cherry, where Enter does
  nothing; ↑ Space adds Banana (the cap is now reached); Escape closes; Tab
  moves to the first chip's ✕.
* **Open focus with a value:** `value=["d"]` opens on Apple.
* **Motion** (shared by the three pickers):
  * Menu open: opacity 0 → 1 and `scaleY(0.8)` → none, 150ms
    `cubic-bezier(.05,.7,.1,1)`; close: the reverse, 150ms
    `cubic-bezier(.3,0,.8,.15)`.
  * Caret: `rotate(180deg)` over 200ms `cubic-bezier(.2,0,0,1)` while open.
  * Field: the floating label and outline colours run 250ms
    `cubic-bezier(.2,0,0,1)` (label colour 100ms `ease`).
  * Rows: selected fill 150ms `cubic-bezier(.2,0,0,1)`; state layer 100ms
    (hover .08); ripple 450ms press / 150ms release.
  * **Reduced motion:** no menu, caret, label or outline motion; only the
    ripple, the row state layer and the icon colour remain.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix.

* **D4. `--md-multi-select-chip-outline` and `--md-multi-select-chip-height`
  did not reach the value chips** (`md-multi-select.css`).
  * The defect: both hooks are documented as the chip outline colour and
    chip height, but only the "+N" overflow counter read them. The value
    chips kept `md-chip`'s defaults, so a themed picker drew counter and
    chips in different styles (oracle before the fix: 0 sentinel pixels on
    the chips).
  * Fix: two private host variables resolve the hook, then any
    `--md-chip-container-height` / `--md-chip-outline-color` inherited from
    an ancestor, then the input-chip defaults (32px, outline-variant). The
    value chips (below the field, inline, and the hidden measurement row, so
    overflow maths stays right) and the counter all read them. Readme rows
    and the CSS header updated.
  * A first version mapped the hooks straight onto the `md-chip`
    properties; the ancestor guard below caught that it broke page-level
    `--md-chip-*` theming (an unresolved `var()` in a custom property does
    not inherit), so it was reworked before mirroring.
  * Test: `md-multi-select.chip-hooks.e2e.ts`, 4 tests:
    * chips mode: both chips draw `rgb(21,101,192)` outlines at 28px;
    * chips-inline mode: the same;
    * guard: with no hooks, ancestor `--md-chip-*` values still reach the
      chips (36px, `rgb(46,125,50)`);
    * guard: with nothing set the chips keep the 32px default.
* **D6 (shared with md-select). Clicking clear (✕) left focus on the document**
  (`md-select.tsx`, `md-multi-select.tsx`, `md-autocomplete.tsx`, new
  `refocusAfterClear`).
  * The defect: the click focuses the ✕ button, which unmounts once the
    value is empty, so focus fell to `<body>` (WCAG 2.4.3). `md-select`
    never moved focus. `md-multi-select` and `md-autocomplete` called
    `host.focus()` on the field, which is a no-op with `delegatesFocus`
    while focus is already inside the host: the button is slotted into the
    field.
  * Fix: all three call the field's `setFocus()` (it focuses the inner
    input directly), falling back to `focus()` for a non-field trigger.
  * Test: `md-select/clear-focus.e2e.ts`, 4 tests (one per picker, two for
    autocomplete single and multiple): a trusted click on ✕ empties the
    value and leaves focus on `<tag>>md-text-field>input`.
* **D1 (carrier, shared with md-select)** — a `hidden` carrier is no longer
  listed or swept up by "Select all" (`['a','c']`, not `['a','b','c']`).
  Test in `md-select-option.hidden.e2e.ts`.

## Observed, not changed (decisions needed)

* **The trigger is a read-only textbox**, not a combobox (same finding and
  same axe trade-off as `md-select`; the proposed test covers both tags).
* **Opening focuses the first row** ("Select all" when shown), not the
  first selected option (shared, `md-menu`). Oracle
  `multi-open-focus-with-value-*`.
* **Tab while the menu is open loses focus to the document** (shared,
  `md-menu`; see `md-select`).
* **`--md-multi-select-chip-height` is a fixed height on the counter** but a
  density-scaled base on `md-chip`, so at density −4 with the hook set the
  chips taper and the counter does not.
* **Drift against `md-select`:** a 28px round clear button (24px there),
  20px option icons (24px there), ArrowUp opens (it does not there),
  `soft-disabled` exists (it does not there).
* **The CSS header comment** omits the `trigger` slot that the readme and the
  component support (documentation only).

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo
  patch). Totals are in the Gate 1 report and
  `outputs/native-parity/md-multi-select/source-tests/`.
* **Oracle:** `outputs/native-parity/md-multi-select/web-oracle-cloud/` (see
  its README):
  * `paint.json`: 92 cases (theme × direction × variant × display mode,
    chip positions, inline overflow, button trigger, density, states, the
    open matrix, cap, empty, 38 single hooks plus all-hooks), with a PNG per
    case;
  * `states.json` and `states-reduced.json`: 6 runs each, sampled every
    frame, with a PNG per phase.
