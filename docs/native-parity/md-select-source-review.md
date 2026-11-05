# Select source review (md-select, md-select-option)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried, for `md-select` and for the
  `md-select-option` carrier shared by all three pickers.
* Four source defects are fixed test-first and mirrored into
  `packages/core/src` (D1, D3, D5, D6 below).
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac
(Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.

## Composition

`md-select` re-uses three primitives instead of drawing its own:

* **Trigger:** a `readonly` `md-text-field` (`part=field`). Label, variant,
  density, supporting and error text, focus ring and `appear-focused` while
  open all come from the text field. The trailing cluster (`part=trailing`)
  holds the clear `md-icon-button` (`part=clear`, `clearable` and a value) and
  the caret (`part=caret`, `arrow_drop_down`, rotated 180° while open). While
  `loading`, an `md-loading-indicator` (`part=loading-spinner`, or the
  `loader` slot) replaces the caret.
* **Surface:** an `md-menu` (`part=menu`) anchored to the trigger, holding a
  `role=listbox` wrapper. Every option is a `type="radio"` `md-menu-item`
  (`part=option`, plus `option-selected` on the chosen row) with
  `role=option` and `aria-selected`. The menu supplies positioning, motion,
  roving focus, type-ahead, Home/End and Escape.
* **Data:** `md-select-option` children (hidden carriers) or the `options`
  array, collected by `utils/select-options.ts` `collectOptions`. Slotted
  children win outright; the array is read only when there are none.
* **Scale:** `virtualize="auto"` switches to the WASM-backed
  `VirtualSelectController` above 200 options (`always` / `never`
  override). Virtual rows keep label, supporting text and selection only.

## Public contract

### md-select

| Property | Default and values |
|---|---|
| `value` | `''` (nothing selected); single string; reflected |
| `options` | `[]`; JS array or JSON-array attribute; ignored when carriers exist |
| `label`, `placeholder`, `supporting-text`, `error` + `error-text` | Forwarded to the field |
| `variant` | `outlined` \| `filled` |
| `density` | `0` … `-4` (field 56 / 52 / 48 / 44 / 40 high) |
| `name`, `required`, `value-missing-label` | Form-associated through `ElementInternals` |
| `clearable`, `clear-icon` (`close`), `clear-label` (`Clear selection`) | Clear button while a value is set |
| `dropdown-icon` | `arrow_drop_down`; slot `dropdown-icon` overrides |
| `filterable`, `filter-mode` (`substring` \| `prefix` \| `fuzzy`), `filter-label`, `search-placeholder` (`Search…`), `searching-label` | In-menu search box |
| `no-results-text` (`No results`), `no-options-text` (`No options`) | Empty states |
| `loading`, `loading-text` (`Loading…`) | Trigger spinner, `aria-busy`, wavy bar in the menu |
| `virtualize` (`auto`), `row-height` | WASM path |
| `placement` (`bottom-start`), `match-trigger-width` (`true`), `max-height` | Forwarded to `md-menu` |
| `full-width`, `reserve-supporting-space`, `disabled` | |
| `open` | Reflected; honoured as a change only (an initial `open` attribute does not open) |

Events: `mdChange` (string), `mdOpen`, `mdClose` (bubble, composed);
`mdValidityChange {valid, validationMessage, flags}` (bubbles, **not**
composed, never on mount, never repeated).

Methods: `show()`, `close()`, `focusTrigger()`, `reset()`,
`loadOptions(source)`, `setQuery(q)`, `getLabels(values)` (virtual path only;
`{}` otherwise), `getValidity()`, `checkValidity()`, `reportValidity()`,
`setCustomValidity(msg)`.

Slots: default (carriers), `dropdown-icon`, `loader`.

Parts: `field`, `field-container`, `trailing`, `clear`, `caret`,
`loading-spinner`, `loading-bar`, `loading-progress`, `menu`, `option`,
`option-selected`, `option-icon`, `search`, `search-wrap`, `search-spinner`.

Hooks (all eight painted their sentinel in the oracle, `select-hook-*`):
`--md-select-width` (100%), `-min-width` (0), `-caret-color`
(on-surface-variant), `-caret-size` (24px), `-clear-color` (the caret colour),
`-trailing-gap` (2px), `-option-icon-color` (on-surface-variant),
`-spinner-size` (22px).

**Selection rules:**

* Picking a different option sets `value`, emits `mdChange`, closes and
  returns focus to the trigger. Re-picking the selected option closes and
  emits nothing.
* Clear (✕) and `reset()` set `''` and emit `mdChange('')`; `reset()` is a
  no-op when empty. A form reset restores the load-time value silently.
  The ✕ is out of the tab order; after a click on it focus returns to the
  trigger input (D6).
* A carrier's `selected` is adopted only at load, only while `value` is
  empty, and only the first enabled one.
* `required` is published through `ElementInternals`; `setCustomValidity`
  wins over it.

**Keyboard (trigger):** ArrowDown, Enter and Space open; Escape closes and
returns focus. Inside the list, arrows, Home/End, type-ahead and Enter/Space
come from `md-menu`.

**Accessibility (as shipped):** the focusable element is the field's
`<input>`, exposed as a **read-only textbox** named by `label` (or the host's
`aria-label` / `aria-labelledby`, flattened and forwarded). The host carries
`aria-haspopup=listbox` with no role. The listbox and options live in the
select's shadow root. With `filterable`, the search input is a
`role=combobox` with `aria-controls` / `aria-activedescendant` inside the same
root.

### md-select-option

Properties: `value`, `label` (falls back to the trimmed slotted text),
`disabled`, `selected` (load-time hint; ignored by `md-autocomplete`), `icon`,
`icon-color` (dropped on the virtual path), `supporting-text`. Event
`mdSelectOptionChange` (void, bubbles, composed) is the internal sync channel,
fired on connect, disconnect and any watched change. The host is
`display:none`, `role=option`, `aria-hidden=true`. Only **direct children**
are read.

After this gate (D1, D3):

* The global **`hidden`** attribute removes an option from every picker: not
  rendered, not reachable, not selectable, not counted by "Select all". Its
  label still names an `md-select` trigger while it is the current value, so
  `<md-select-option value="" hidden selected>Choose one</md-select-option>`
  is a working placeholder row.
* Toggling `hidden` and editing the slotted text at runtime are both picked
  up.

## Layout reference (DPR 1, Roboto, light theme)

* **Field:** 56 high at density 0, then 52 / 48 / 44 / 40 at −1 … −4 (the
  same ladder for all three pickers). Width follows the host (`--md-select-width`
  100%).
* **Trailing cluster:** caret 24×24 at inline-end 16 (x 304 in a 320 field);
  clear 24×24 immediately before it with a 2px gap (x 278). At −4 the clear
  glyph is 20px. RTL mirrors: caret at inline-start 16, clear inside it.
* **Menu:** opens 4px under the field (y 84 for a field ending at 80),
  trigger-wide by default. Option rows are 48 high at density 0 (two-line
  rows with supporting text too), 26–29 at −4. The leading icon sits at
  inline-start 52 (after the 40px selection-check column) and is 24px (20px
  at −4). The filter box, when present, is a 44-high header row.
* **Placement** `top-start` opens above; `match-trigger-width="false"`
  shrinks the menu to content.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Caret, clear, option icon | on-surface-variant `#49454F` | `#CAC4D0` |
| Option text | on-surface `#1C1B1F` | `#E6E1E5` |
| Selected row | secondary-container `#E8DEF8` + leading ✓ | `#4A4458` |
| Disabled option | on-surface at 38% | |
| Filter box | surface-container `#F3EDF7`, text on-surface | |
| Field (outlined / filled) | text-field tokens; primary outline and label while open | |

Screenshots for every theme × direction × variant × density × state are in
the oracle (`select-*`).

## Interaction and motion reference

Runs (LTR and RTL, identical apart from mirroring): `select-pointer`,
`select-keyboard`, `select-open-focus-with-value`, `select-closed-keys`,
`select-filterable`.

* **Pointer:** a click opens (`mdOpen`) with focus on the first row (no
  ring for pointer opens); picking Banana emits `mdChange "b"`, then
  `mdClose` 150ms later, and focus returns to the trigger input. Reopening
  still focuses Apple, not the selected Banana. An outside click closes and
  leaves focus on the document.
* **Keyboard:** Tab in → ArrowDown opens on the first row (the selected
  Apple here) with the ring; ↓ ↓ stops on the disabled Cherry; type-ahead
  "d" moves to Date; Enter picks it, emits `mdChange "d"` then `mdClose`,
  focus on the trigger (after fix D5). Space and Enter on the trigger open;
  Escape closes to the trigger; Tab while open closes and **loses focus to
  the document**.
* **Closed keys:** type-ahead and ArrowUp do nothing while closed.
* **Open focus with a value:** `value="d"` still opens on Apple (keyboard
  and pointer).
* **Filterable (plain list):** focus opens on the first row, so typing "an"
  drives type-ahead and leaves all rows; ↓ Enter picks Banana and closes.
* **Clear:** focus returns to the trigger input after the ✕ (fix D6).
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

* **D1. `hidden` options were listed, reachable and selectable**
  (`utils/select-options.ts` `collectOptions`, new `hiddenOptionLabel`;
  `md-select.tsx` `renderTrigger`; `md-select-option.tsx`).
  * The defect: `collectOptions` ignored the global `hidden` attribute, so a
    `hidden` carrier appeared as a live row in all three pickers, could be
    picked, and was swept up by `md-multi-select`'s "Select all". `hidden` is
    not a Stencil prop, so toggling it at runtime was never re-read either.
    The natural placeholder idiom (`value="" hidden selected`) therefore
    showed "Choose one" as a selectable row.
  * Fix: hidden carriers are filtered out of the option set (the
    `<option hidden>` semantics); `md-select` still resolves the trigger
    text from a hidden carrier that matches the current value; the carrier
    observes its own `hidden` attribute and re-announces itself.
  * Test: `md-select-option.hidden.e2e.ts` (5 of its 6 tests):
    * md-select does not list a hidden option;
    * md-select names the trigger from a hidden selected placeholder;
    * md-multi-select neither lists nor "selects all" a hidden option
      (`['a','c']`, not `['a','b','c']`);
    * md-autocomplete does not suggest a hidden option;
    * a runtime `hidden` toggle is picked up both ways.
* **D3. Editing an option's slotted text was not re-read**
  (`md-select-option.tsx`).
  * The defect: the label falls back to the slotted text, but only prop
    changes fired `mdSelectOptionChange`, so `opt.textContent = 'Alpha
    renamed'` left the trigger and the row showing the old label until some
    unrelated re-read.
  * Fix: the carrier's `MutationObserver` also watches its character data and
    child list (subtree), and re-announces on change; it is disconnected on
    removal.
  * Test: `md-select-option.hidden.e2e.ts` › "text content", 1 test (trigger
    and row both show the new text).
* **D5. Committing a row from the keyboard reopened the menu**
  (`md-select.tsx` `handleKeyDown`).
  * The defect: Enter or Space on a focused row picked it and closed the
    menu, then the same keydown bubbled to the host, where the trigger rule
    "Enter / Space opens while closed" reopened it in the same task. The
    value changed, but the menu stayed open with focus on the first row and
    no `mdClose` fired (oracle before the fix: `enter` phase open, active
    Apple, events `mdOpen`, `mdChange d`, then Space re-picked Apple). Pointer
    picks were unaffected.
  * Fix: keydowns whose composed path runs through the menu are left to the
    menu.
  * Test: `md-select.keyboard-commit.e2e.ts`, 3 tests:
    * Enter on a row picks it, closes, returns focus to the trigger input,
      events `mdOpen`, `mdChange:b`, `mdClose`;
    * the same for Space;
    * guard: Enter on the trigger still opens.
* **D6. Clicking clear (✕) left focus on the document**
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

## Observed, not changed (decisions needed)

* **The trigger is exposed as a read-only textbox, not a combobox.** Screen
  readers announce "Fruit, read-only edit text, Banana" with no popup state;
  `aria-haspopup` sits on the role-less host where it is ignored. The WAI-ARIA
  select-only combobox (and a native `<select>`) expose `combobox` +
  `aria-expanded`. `md-autocomplete` already promotes its input through
  `md-text-field`'s `input-role` / `input-expanded` and element reflection, so
  the fix fits in `md-select.tsx` / `md-multi-select.tsx`. It was applied and
  reverted: the new test (`proposed/md-select.trigger-role.e2e.ts`, 2 tests)
  passes, but five existing `md-select` axe tests then fail
  `aria-required-attr` while open, because axe reads the empty
  `aria-controls=""` that element reflection leaves behind (the same caveat
  `md-autocomplete`'s readme documents). Decide whether to accept that axe
  exception for the select family, or to wait for an `md-text-field` change
  that can publish a real `aria-controls`.
* **Tab while open loses focus to `<body>`** (shared, `md-menu`): the menu
  closes and restores focus to the anchor, but the browser's default Tab move
  still runs from inside the closing menu (no `preventDefault()`) and
  focus ends on the document. The menu's scroll viewport
  (`div[menu-viewport]`) is a keyboard-focusable scroller in Chromium: the
  autocomplete Tab run lands on it directly. It needs `tabindex="-1"`.
  Expected: close and move to the next control after the trigger. Oracle
  `select-closed-keys-*` › `tab-while-open`; `md-multi-select` behaves the
  same.
* **Opening focuses the first row, not the selected one** (shared,
  `md-menu` `focusFirstItem`). With `value="d"`, ArrowDown opens on "Apple".
  A native select and the APG pattern open on the selected option. Oracle
  `select-open-focus-with-value-*`.
* **Closed-state keys:** printable type-ahead does nothing and ArrowUp does
  not open (native `<select>` changes the value on type-ahead; the APG opens
  on ArrowUp). `md-multi-select` opens on ArrowUp. Oracle
  `select-closed-keys-*`.
* **A plain `filterable` select opens with focus on the first row, not in
  the search box** (documented), so typing right after opening drives
  type-ahead instead of the filter (oracle `select-filterable-*`: "an"
  leaves all four rows). `md-multi-select` focuses its search box on open
  on both paths.
* **No `soft-disabled`** on `md-select`, while `md-multi-select` and
  `md-autocomplete` have it.
* **An unknown `value`** (`value="zz"` with no such option) is kept and the
  field shows nothing; the component never reconciles it against the option
  set.
* **Arrow keys stop on disabled options** (focusable, not selectable:
  open, ↓, ↓, Enter over Alpha / Bravo(disabled) / Charlie picks Charlie).
  This is `md-menu`'s policy; the APG allows either, but native platforms
  skip them, so the native plan must choose.
* **Three different clear buttons:** 24×24 square-ish `md-icon-button` here,
  28×28 round with an 18px glyph in `md-multi-select`, 28×28 with a 16px
  glyph and 16px radius in `md-autocomplete`. Option icons are 24px here and
  20px in `md-multi-select`.
* **`md-select-option` removal under `md-autocomplete`** still goes
  unnoticed (documented: there is no default slot there, and the disconnect
  event fires from a detached element).

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo
  patch). Totals are in the Gate 1 report and
  `outputs/native-parity/md-select/source-tests/`.
* **Oracle:** `outputs/native-parity/md-select/web-oracle-cloud/` (see its
  README):
  * `paint.json`: 197 cases (theme × direction × variant × density × 7
    states, the open matrix, 8 single hooks plus all-hooks, width,
    placement, hidden placeholder), with a PNG per case;
  * `states.json` and `states-reduced.json`: 10 runs each, sampled every
    frame, with a PNG per phase.
