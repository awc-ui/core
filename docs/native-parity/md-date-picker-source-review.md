# Date picker source review (md-date-picker)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
six source defects are fixed test-first and mirrored into `packages/core/src`
(hash-checked against the live files), and a browser reference (paint matrix,
per-frame open / close, grid, year-grid and menu runs, keyboard sequences,
reduced motion) is captured. One further layout defect (D4) is confirmed but
left open. The oracle is **provisional**: it was captured in headless
Chromium 141 on Linux while the Mac runner was blocked, and must be recaptured
on the Mac (Chrome 153) and diffed before it gates native work. No native code
has changed. This is not a native completion record.

## Public contract

**Variants.** `modal-input` (default: field trigger + modal dialog), `modal`
(no trigger; open with `show()` or `open`), `docked` (field trigger + anchored
panel with month / year menus). `field-variant` `outlined` (default) | `filled`.

**Props.**

* Value: `value`, `min`, `max` (ISO `YYYY-MM-DD`), `isDateDisabled` (JS
  property, per cell), `required`, `name`, `disabled`, `open` (mutable).
* Format: `locale` (drives `Intl` month / weekday names, field format, default
  week start), `date-separator` (display and parsing only), `first-day-of-week`
  (−1 = locale, 0 = Sunday), `placeholder` (modal entry field only).
* Behaviour: `clearable`, `commit-on-select` (stages and commits on click; no
  action row), `scrim-dismissible`, `outside-click-dismissible`.
* Field: `label`, `supporting-text` (empty → locale format hint; a space
  blanks it), `error` / `error-text` (mutable), `reserve-supporting-space`,
  `calendar-icon`, `density` (−1 … −4).
* Labels (21, English defaults): `headline`, `cancel-label`, `ok-label`,
  `select-date-label`, `enter-dates-label`, `invalid-date-label`,
  `value-missing-label`, `clear-label`, `previous-month-label`,
  `next-month-label`, `previous-year-label`, `next-year-label`,
  `choose-month-label`, `choose-year-label`, `choose-month-year-label`,
  `choose-month-and-year-label`, `toggle-calendar-label`, `toggle-text-label`,
  `open-calendar-label`, `close-calendar-label`, `year-grid-label`.
* Slots: `leading-icon`, `calendar-icon`, `header`, `actions`. Parts: the
  hand-written list in the readme (the generated table misses the computed
  `day*`, `year*`, option and chevron parts).

**Calendar.** Six-row month matrix with outside days; today ring
(`aria-current="date"`); `min` / `max` / `isDateDisabled` cells are disabled
(not just greyed). Day cells are `md-button` with `role="gridcell"`,
`aria-selected`, a full localized name, and one roving tab stop.

**Selection model.** A day click or Space stages (`mdSelected`); OK commits
(`mdChange`) and closes; Enter on a day stages and commits. `commit-on-select`
collapses the two. Typed entry: the trigger field (modal-input, docked)
commits on Enter / blur; the modal's entry mode (mode toggle,
`mdModeChange`) parses on Enter / toggle back; an unparsable or disabled date
sets `error` + `invalid-date-label`.

**Year / month.** Modal: the month toggle swaps the day grid for a 3-column
year grid (±100 years, or `min` / `max`), bloom in / out; picking returns to
the days. Docked: month and year buttons open inline `md-menu` lists; chevrons
step month and year; Shift+M / Shift+Y toggle the menus from the keyboard.

**Keyboard** (verified by tests and the oracle):

* Day grid: arrows by day / week — **horizontal arrows follow the visual
  direction, mirrored in RTL (fixed D1)**; Home / End to the month's first /
  last day; Page Up / Down by month; Shift+Page by year; Alt+↑ / ↓ as Page;
  Enter commits; Space stages; navigation clamps at `min` / `max`.
* Year grid (**fixed D3**): one tab stop; focus moves to the current year on
  open; arrows ±1 / ±3 (mirrored in RTL), Home / End in the row, Ctrl+Home /
  Ctrl+End to the list ends, Page ±6 rows, disabled years skipped; Enter /
  Space picks and focus returns to the day grid.
* Escape closes an open docked menu, otherwise dismisses (`mdCancel`).
  Modal variants trap Tab (oracle `modal-focus-trap`: day → Cancel → OK →
  mode toggle → month toggle → prev → next → …).

**Events** (all bubble and are composed except `mdValidityChange`). Observed
order:

* Open: `mdOpen`.
* Pointer commit: `mdSelected {value, date}` on the click, `mdChange {value,
  date}` on OK, `mdClose` after the 200ms exit (`commit-on-select`: all three
  on the click). Keyboard Enter: `mdSelected`, `mdChange`, then `mdClose`.
* Dismiss (Cancel, Escape, scrim, docked outside click): `mdCancel`, then
  `mdClose` after the exit. `close()` / `open = false` emit only `mdClose`.
* View: `mdViewChange {month, year, source}` for chevrons (`chevron-month`,
  `chevron-year`) and menu / grid picks (`month-menu`, `year-menu`); **not**
  for keyboard month changes (no keyboard source exists; open decision).
* Menus: `mdMenuOpen {type}`, `mdMenuSelect {type, value, label}` (then
  `mdViewChange`).
* Typing: `mdInput {value}` per keystroke; field commit `mdChange` once.
* Validity: `mdValidityChange` precedes `mdChange` when validity flips; reset
  restores the first-render value.
* `mdOpen` / `mdClose` from nested tooltips and menus are swallowed; after
  **D7** so are the inner fields' `mdInput` / `mdChange`.

**Methods.** `show()`, `close()`, `clear()`, `focusInput()`,
`getValidity()`, `checkValidity()`, `reportValidity()`,
`setCustomValidity()`.

**Validity and forms.** Form-associated; submits the ISO value under `name`;
`required` → value-missing with `value-missing-label`; `min` / `max` are not
validity constraints on `value` (they disable cells and reject typed dates).
Oracle `form-required`: submit blocked when empty; pick + OK → valid,
`FormData` `[["due","2025-06-13"]]`; reset → empty, invalid.

**Motion** (CSS tokens; JS timers use fixed constants, see open items):
modal panel scale-in 300ms emphasized; docked panel and menu blooms 450ms
emphasized-decelerate in, 200ms emphasized-accelerate out; panel exit 200ms;
calendar bloom after a pick 300ms; month slide 300ms emphasized (RTL
keyframes); scrim fades 150ms; nav chevron / menu caret fades 150ms.

**Reduced motion.** Every entrance, exit, bloom, slide and fade is removed
(**fixed D2**; JS also skips the slide and bloom states).

**Density.** −1…−4; day cells taper 40 → 28px; year cells and grid gap taper.

**RTL.** Grid, chevrons, field and docked alignment mirror; arrow keys follow
(D1, D3).

## Source changes (all in `src/components/md-date-picker/`)

| ID | Defect | Fix | Test (before → after) |
|---|---|---|---|
| D1 | In RTL the painted week runs right-to-left but ArrowRight moved to the next day (the cell on the left). | `handleCalendarKeyDown` mirrors the horizontal step when `isRtl()`. | `md-date-picker.keyboard-a11y.e2e.ts`: RTL day arrows fail → pass (LTR guard passes both). |
| D2 | `prefers-reduced-motion` selectors were less specific than the motion rules: the modal scale-in, docked bloom-in and visible chevron / caret fades still ran. | The reduced-motion block repeats each motion selector exactly. | `md-date-picker.reduced-motion.e2e.ts`: 3 fail → pass; 3 guards pass both. |
| D3 | Modal year grid: 201 tab stops, no arrow keys, focus not moved on open, focus dropped to `<body>` after a pick. | Roving `groupTabindex`, `handleYearGridKeyDown` (arrows mirrored in RTL, Home / End, Ctrl+Home / End, Page, skip disabled), focus on open (hydration-aware), focus to the day grid after a pick. | `md-date-picker.keyboard-a11y.e2e.ts`: 3 year-grid tests fail → pass; a Home / End / bounds test and a focus-after-pick assertion were added after the fix (not run on the original). |
| D5 | Escape in a modal emitted `mdCancel` twice (document capture handler and the panel handler). | `onPanelKeyDown` ignores an already-handled key. | `md-date-picker.events.e2e.ts` fail → pass. |
| D6 | Enter / Space on a day emitted `mdSelected` twice (the cell's own `md-button` activation re-selected; after Enter, after `mdChange`). | The grid handler calls `stopImmediatePropagation()` after handling Enter / Space (the cell's own listener is later on the same element). | `md-date-picker.events.e2e.ts` (2 tests) fail → pass. |
| D7 | The inner `md-text-field`s' composed `mdInput` / `mdChange` (string details) leaked out of the picker, and the field's blur re-committed an unchanged value (second `mdChange`). | Host listeners swallow nested `mdInput` / `mdChange`; the field commit emits only when `value` changes. | `md-date-picker.events.e2e.ts` fail → pass. |

Readme: the Accessibility section documents the year-grid keyboard, the RTL
arrow mirroring and reduced motion.

## Tests

* New: `md-date-picker.keyboard-a11y.e2e.ts` (6), `md-date-picker.reduced-motion.e2e.ts`
  (6), `md-date-picker.events.e2e.ts` (4). On the original source: 7 of the
  first 11 fail (D1, D2, D3) and all 4 event tests fail (D5–D7).
* Own suites (date + time picker, serial): before 18 suites, 552 / 554 (the
  two time-picker environment failures); after 21 suites, **570 / 570**.
* Dependents (`md-text-field` spec, axe spec, inline-validation e2e;
  `md-tooltip` e2e): 4 suites, 238 / 238 on the original and on the fixed
  source (run before the last one-line D6 change, which only touches day-grid
  Enter / Space).
* Logs: `outputs/native-parity/md-date-picker/source-tests/`.

## Open (not fixed)

* **D4 — docked month / year menus overflow the panel.** The docked body has
  no `min-block-size: 0`, so the inline `md-menu` grows to its content: the
  year list is 9,648px tall in a 780px panel and opening it scrolls the page
  by ~4,569px (oracle `menu-year`: `pageScrollYBeforeShot` 4569,
  document 9,903px; the month list overflows 524 → 667px). Confirmed in the
  cloud oracle; needs a failing test and a layout fix in
  `md-date-picker.css` (and a check of `md-menu` inline-fill sizing).
* **First open focus.** On a page's first open the day cells are not yet
  hydrated, so the initial focus can land on `<body>` (oracle: the first run
  of a page). Same class as the time picker's hydration window.
* **Focus after a docked keyboard pick (D8, open).** In the oracle run
  `docked-keyboard`, Enter on a month option closes the menu and focus falls
  to `<body>`, so the following Shift+Y / Escape / Page Down are not routed to
  the picker. Probable cause: `focusFocusedDay()` focuses the re-mounted day
  cell after two animation frames, before its `md-button` has hydrated (the
  same class as the first-open focus above). Suggested fix: await the cell's
  `componentOnReady()` as `focusYearCell()` now does; needs a failing test.
* Keyboard month changes do not emit `mdViewChange`.
* JS state timers (`DOCKED_SELECTION_BLOOM_IN_MS` 450, `…_OUT_MS` 200,
  `PANEL_BLOOM_OUT_MS` 200, `DOCKED_CALENDAR_BLOOM_IN_MS` 300) do not follow
  the public duration hooks.
* `--md-date-picker-day-outline-color` is documented in the stylesheet header
  as deprecated and is inert.
* The CSS mixes in `:host-context([dir='rtl'])` slide keyframes that the
  reduced-motion block does not list; unreachable today because JS skips the
  slide under reduced motion.
* Stencil warns that `dockedPanelAlign` / `dockedPanelMaxBlockSize` change
  during render (positioning runs in `componentDidRender`).
