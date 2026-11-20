# Autocomplete source review (md-autocomplete)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried. The shared option carrier is covered in
  [md-select-source-review.md](md-select-source-review.md).
* Two source defects are fixed test-first here (D2, and D6 shared with
  the other pickers), and the carrier fix D1 changes what it suggests. Both are mirrored into
  `packages/core/src`.
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac
(Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.

`md-autocomplete` is not an M3 component; its API mirrors MUI Autocomplete.

## Composition

* **Trigger:** an **editable** `md-text-field` (`part=field`, default
  variant `filled`). Its `<input>` is promoted to the combobox through the
  text field's props: `input-role="combobox"`, `input-expanded`,
  `input-aria-autocomplete="list"`. The listbox is linked with ARIA element
  reflection (`input.ariaControlsElements`) while open, because an IDREF
  cannot cross into the text field's shadow root. The trailing cluster holds
  a clear `md-icon-button` (`clearable` defaults to **true**) and the caret.
* **Surface:** an `md-menu` opened without auto-focus (focus stays in the
  input while typing). Rows are `md-menu-item`s (`role=option`,
  `aria-selected`).
* **Chips** (`multiple`): removable `md-chip`s placed by `chip-position`
  (`below` default, `top`, `left`, `right`, `inline`).
* **Live region:** a polite status built from `status-template` ("{count}
  suggestions available") on every filter change.
* **Data:** carriers or `options` (carriers win; `description` is a legacy
  alias of `supportingText`); `filterer(options, {inputValue})` on the
  client path; the WASM path above 200 options filters by `filter-mode`
  instead and ignores `filterer` and `limit-results`.

## Public contract

| Property | Default and values |
|---|---|
| `value` | `''`, or `string[]` when `multiple` (array form is a JS property) |
| `input-value` | The text in the box; separate from `value` |
| `options`, `filterer` | JS array or JSON-array attribute; function property |
| `multiple`, `chip-position` | `below` \| `top` \| `left` \| `right` \| `inline` |
| `free-solo` | Enter commits the trimmed text as a value |
| `max-selected` | `0` = unlimited (`multiple`) |
| `clearable` (**true**), `clear-icon` (`close`), `dropdown-icon` (`arrow_drop_down`) | |
| `clear-on-blur` | Strict single mode only, popup closed |
| `disable-close-on-select` | Single mode stays open after a pick (`multiple` always stays open) |
| `filter-mode` (`substring`), `limit-results` (`0`) | |
| `virtualize` (`auto`), `row-height`, `placement`, `match-trigger-width`, `max-height` | As `md-select` |
| `loading`, `loading-text`, `no-options-text`, `no-results-text`, `status-template` | |
| `label`, `placeholder`, `supporting-text`, `error`, `error-text`, `variant` (`filled`), `density`, `name`, `required`, `value-missing-label`, `reserve-supporting-space` | |
| `disabled`, `soft-disabled`, `open` | |

Events (composed unless noted): `mdInput` (typed text), `mdChange`
(committed selection), `mdOpen`, `mdClose`, `mdClear`, `mdValidityChange`
(not composed, not on mount, deduplicated). **No `mdRemove`** for chips
(md-multi-select has one).

Methods: `focusInput()`, `showMenu()`, `closeMenu()`, `loadOptions()`,
`getLabels()`, the validity API. No `setQuery()`: the query is only what
was typed since the popup opened.

Slots: `loader`, `dropdown-icon`. **No default slot**: carriers are read
from the light DOM, so a removed carrier goes unnoticed (documented).

Parts: `field`, `chips`, `chip`, `clear`, `caret`, `menu`, `option`,
`option-selected`, `option-icon`, `loading`, `loading-spinner`,
`loading-progress`; forwarded `chip-remove`, `chip-label`.

Hooks: 11 `--md-autocomplete-*` properties (width, min-width, caret colour
and size, clear colour, chip gap and radius, option icon colour and size,
spinner size, loading colour); all 11 painted their sentinel in the oracle
(`ac-hook-*`).

**Rules worth knowing:**

* Typing never uncommits `value`. In strict single mode (no `multiple`, no
  `free-solo`) closing snaps `inputValue` back to the committed label, or
  `''`.
* Reopening shows the full list (a committed value does not filter the list
  to itself).
* `multiple`: each pick keeps the popup open and clears the typed text;
  Backspace in an empty input removes the last chip.
* Keyboard: ArrowDown / ArrowUp open and move **real focus** into the list
  (first / last row); typing on a row returns focus to the input and extends
  the query; Enter on a row commits; Enter in the input commits a
  `free-solo` value; Escape closes.

## Layout reference (DPR 1, Roboto, light theme)

* **Field:** the picker ladder (56 / 52 / 48 / 44 / 40), filled by default.
* **Trailing:** caret 24×24 at inline-end 16; clear **28×28** (16px glyph,
  radius 16) 2px before it (x 274 in a 320 field).
* **Chips:** 32 high, radius 8, 4 gap, 8 below the field (`below`); inline
  chips start at inline 23, and the field grows to 64.
* **Menu:** 4px under the field, trigger-wide, 48px rows; the list height
  follows the match count (200 for four rows, 104 for two, 56 for one, 52
  for the "No results" row).

## Paint reference

As `md-select` for the caret, rows, selected fill and dark theme; chips as
`md-multi-select`. "No results" is a 52-high status row in the menu.

## Interaction and motion reference

Runs (LTR and RTL): `ac-keyboard`, `ac-multiple`, `ac-tab-while-open`,
`ac-freesolo`. Events are recorded in the bubble phase above the component,
so they are exactly what an application listener receives.

* **Typing:** each keystroke emits one `mdInput` (plus the native composed
  `input`); the first opens the popup (`mdOpen`) without moving focus. The
  status reads "4 suggestions available", then "2 suggestions available";
  the list height follows (200 → 104).
* **Keyboard pick:** ↓ moves real focus to Apple, ↓ to Apricot, Enter emits
  `mdChange "b"` then `mdInput "Apricot"` and `mdClose`; focus is back in
  the input, which shows "Apricot".
* **Backspace** reopens with "Aprico" (one match, Apricot still selected);
  **Escape** closes and snaps the text back to "Apricot" (`mdInput
  "Apricot"`); a second Escape does nothing.
* **Multiple:** a click opens; picking Apple keeps the popup open, clears
  the text and adds a chip; typing "ba", ↓ and Enter adds Banana
  (`["a","d"]`); Escape closes; Backspace in the empty input removes the
  last chip (`["a"]`); clear emits `mdInput ""`, `mdChange []`, `mdClear`
  and focus returns to the input (fix D6).
* **Free solo:** "kiwi" shows "No results" and "0 suggestions available";
  Enter commits `mdChange "kiwi"` and closes.
* **Tab while open:** the first Tab goes to the clear button, the second to
  the menu's scroll viewport; the popup stays open throughout.
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

* **D2. The inner text field's events leaked out as md-autocomplete
  events** (`md-autocomplete.tsx`).
  * The defect: `md-text-field`'s `mdInput`, `mdChange` and `mdSearch` are
    composed, so a listener on `md-autocomplete` received them as well as
    the component's own. Typing "al" and picking Alpha produced
    `mdInput a` ×2, `mdSearch a`, `mdInput al` ×2, `mdSearch al`, an
    `mdChange "al"` (the typed text, fired when focus moved into the list)
    and then the real `mdChange "a"`. A consumer treating `mdChange` as the
    selection saw the typed text first.
  * Fix: the field's `mdInput` handler stops propagation before re-emitting
    through `applyTyped`; the field's `mdChange` and `mdSearch` are stopped
    at the boundary. Readme updated.
  * Test: `md-autocomplete.events.e2e.ts`, 1 test: listeners record
    `composedPath()[0]`; nothing arrives from a non-`md-autocomplete`
    origin, there is no `mdSearch`, `mdInput` is `['a','al','Alpha']` and
    `mdChange` is `['a']`.
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
* **D1 (carrier, shared)** — a `hidden` carrier is not suggested. Test in
  `md-select-option.hidden.e2e.ts`.

## Observed, not changed (decisions needed)

* **Tab with the popup open:** the first Tab moves to the clear button and
  the popup stays open; the second lands on the menu's scroll viewport
  (`md-menu` `div[menu-viewport]`, a keyboard-focusable scroller in
  Chromium) with the popup still open. Shared: the viewport needs
  `tabindex="-1"` in `md-menu`; the autocomplete should close when focus
  leaves the field cluster. Oracle `ac-tab-while-open-*`.
* **Chip removal emits no `mdRemove`** (only `mdChange`), unlike
  `md-multi-select`.
* **`chip-position` vocabulary differs:** `below` here, `bottom` in
  `md-multi-select`; `inline` here, `display-mode="chips-inline"` there.
* **Escape twice does not clear** the text (MUI's `clearOnEscape` has no
  equivalent); the second Escape is a no-op.
* **The `selected` carrier hint is ignored** (documented).
* **A removed carrier stays listed** (documented; no default slot).
* **All-hidden carriers fall back to `options`:** `refreshOptions` picks
  the source by "any visible carriers", so when every carrier is `hidden` it
  reads the `options` property (if set). `md-select` and `md-multi-select`
  decide by "any carriers" and show an empty list. A one-line change in
  `md-autocomplete.tsx` if the select rule is wanted.
* **Clear button size** differs from the other pickers (see `md-select`).
* **axe `aria-required-attr` while open** (documented trade-off of element
  reflection).

## Decisions (autonomous, 2026-11-06, reversible)

Taken by d4 for the native renderers against this source contract and MD3; each lists the alternative and how to revert.

1. **Tab with the popup open.** Native follows the source for the first Tab (focus moves to the clear button, the popup stays
   open) and does not reproduce the second: Chromium makes `md-menu`'s scroll viewport a keyboard-focusable scroller, which
   is an engine behaviour, not part of the source (Safari and Firefox skip it), so native Tab leaves the field cluster to the
   next control. *Alternative:* a focusable viewport stop natively (no accessible role or name; an empty stop). *Revert:* not
   applicable natively; the shared fix belongs in `md-menu` (`tabindex="-1"` on the viewport). The states harness compares
   Chrome's "menu-viewport" focus as "outside the component".
2. **Chip removal emits only `mdChange`** (no `mdRemove`), as the source. *Alternative:* add `mdRemove` as `md-multi-select`
   does (a source change first). *Revert:* emit `mdRemove` with the removed value in `removeChip` (Swift and Kotlin).
3. **`chip-position` vocabulary:** the autocomplete's own values (`below`, `top`, `left`, `right`, `inline`); unknown values
   fall back to `below`. *Alternative:* accept `md-multi-select`'s `bottom` / `chips-inline` as aliases. *Revert:* map the
   aliases in the chip-position read.
4. **Escape twice** does not clear the text (the second Escape is a no-op), as the source. *Alternative:* MUI's
   `clearOnEscape`. *Revert:* clear in `fieldKey("Escape")` when the popup is already closed.
5. **Carrier rules:** the `selected` hint of a carrier is ignored and all-hidden carriers fall back to `options`, as the source
   (visible carriers win). A carrier removed from the node tree disappears from the list natively (the node tree is re-read
   on every update; the source keeps it listed only because it has no slot to observe). *Alternative:* keep a removed
   carrier until the next `options` change. *Revert:* cache the collected carriers until `options` changes.
6. **Space on an option row** activates the row (APG listbox, `md-menu-item`) and is not appended to the query. Chrome also
   appends " " to the text, because the listbox keydown handler sees the key `md-menu-item` already handled; the other
   printable keys and Backspace on a row move focus back to the input and extend the query, as the source. *Alternative:*
   append the space too. *Revert:* allow " " in the row-key claim (`rowKey`, Swift and Kotlin).
7. **Clear button size** stays the autocomplete's own (28 × 28, 18 glyph, 2 margin), not `md-select`'s.
8. **Options replaced by `loadOptions()`** stay until the authored list changes (a new `options` value or a carrier change),
   as the source's `refreshOptions` watcher.
9. **Accessibility while open:** the native combobox exposes its expanded state and the listbox of options (named by the
   label); the axe `aria-required-attr` trade-off of the source's element reflection does not exist natively.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo
  patch). Totals are in the Gate 1 report and
  `outputs/native-parity/md-autocomplete/source-tests/`.
* **Oracle:** `outputs/native-parity/md-autocomplete/web-oracle-cloud/`
  (see its README):
  * `paint.json`: 60 cases (theme × direction × variant × empty, value,
    typed-open, multiple, multiple-inline; density; states; no-results; 11
    single hooks plus all-hooks), with a PNG per case;
  * `states.json` and `states-reduced.json`: 8 runs each, sampled every
    frame, with a PNG per phase.
