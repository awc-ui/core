# Date picker native implementation plan (md-date-picker)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-date-picker-source-review.md](md-date-picker-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-date-picker/web-oracle-cloud/`. Recapture it on
  the Mac (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Inputs.swift`, `temporalPicker`,
shared with `md-time-picker`; preview in `PreviewPickers.swift`):

* Trigger: a plain `Button` (calendar symbol, `label` or "Choose date", the
  raw ISO `value` or "Select") in a 10pt rounded rectangle; `clearable` adds a
  separate "Clear" button that emits `mdChange {value: "", date: null}`.
* Sheet (detents medium / large): headline, a system `DatePicker` in
  `.graphical` style bounded by `min` / `max` (preview: a 7-column grid with
  month chevrons), Cancel / OK.
* Every selection emits `mdInput {value}` and `mdSelected`; with
  `commitOnSelect` also `mdChange` and close; `required` re-validates.
  OK emits `mdChange` (filling today when empty). Cancel and sheet dismissal
  emit `mdCancel`.
* Supported per NativeSupport.json: value, label, min, max, open, required,
  clearable, clearLabel, error, errorText, supportingText, headline,
  cancelLabel, okLabel, commitOnSelect, valueMissingLabel, disabled, name.
  Unsupported: `variant`, `fieldVariant`, `placeholder`, `locale`,
  `dateSeparator`, `firstDayOfWeek`, every navigation / toggle label,
  `yearGridLabel`, `scrimDismissible`, `outsideClickDismissible`,
  `isDateDisabled`, `density`, `mdViewChange`, `mdMenuOpen`, `mdMenuSelect`,
  `mdModeChange`, all methods, the slots.

**Android** (`packages/native-android/.../AWCOverlays.kt`, `PickerComponent`
`"md-date-picker"`):

* Trigger: `OutlinedButton` (calendar glyph, value or label), supporting text,
  error text.
* M3 `DatePickerDialog` with `DatePicker(state)` (its own input-mode toggle and
  year list); `SelectableDates` from `min` / `max` (UTC).
* OK (enabled only with a selection) emits `mdSelected` **then** `mdChange`
  and closes; dismiss honours `scrimDismissible` and emits `mdCancel` +
  `mdClose`; `mdOpen` on open.
* Supported per support.json: cancelLabel, disabled, error, errorText, label,
  max, min, name, okLabel, open, required, scrimDismissible, supportingText,
  value; events mdCancel, mdChange, mdClose, mdOpen, mdSelected.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Variants | `modal-input` (default; field + modal), `modal` (no trigger), `docked` (field + anchored panel with month / year menus) | One sheet | One dialog |
| Trigger | M3 text field (outlined / filled), typed entry parsed per locale, clear and calendar buttons | Button | Button |
| Typed entry | Trigger field (modal-input, docked) and the modal's entry mode; invalid → `invalid-date-label` | None | M3 input mode (own strings) |
| Locale / format | `locale`, `date-separator`, `first-day-of-week` | System | System |
| Day grid | 6 rows, outside days, today ring, `min` / `max`, `isDateDisabled` | System | System; no `isDateDisabled` |
| Selection model | Day click stages (`mdSelected`); OK commits (`mdChange`); `commit-on-select` hides the action row | Every change = `mdSelected`; OK commits | **Both events at OK** |
| Year / month selection | Modal year grid (3 columns, roving, keyboard); docked month and year menus | System | M3 year list |
| Keyboard | Arrows (mirrored in RTL: fixed D1), Home / End, Page ± month, Shift+Page ± year, Alt+arrows, Enter / Space; year grid (fixed D3); Shift+M / Shift+Y in docked | System | System |
| Labels | 21 label props | Headline, Cancel, OK, Clear | Cancel, OK |
| Events | `mdOpen`, `mdSelected`, `mdChange`, `mdCancel`, `mdClose`, `mdInput`, `mdViewChange`, `mdMenuOpen`, `mdMenuSelect`, `mdModeChange`, `mdValidityChange` | No view / menu / mode events | No input / view / menu / mode / validity events |
| Dismissal | Cancel, Escape, scrim (`scrim-dismissible`), outside click on docked (`outside-click-dismissible`) all `mdCancel`; `close()` does not | Cancel / swipe | Cancel / scrim |
| Methods | `show`, `close`, `clear`, `focusInput`, validity methods | None | None |
| Form | ISO value; `required`; reset to first-render value | Matches | Matches |
| Motion | Panel scale 300ms / bloom 450ms in, 200ms out; month slide 300ms; menu and year-grid blooms 450 / 200ms; calendar bloom 300ms; chevron / caret fades 150ms | System | System |
| Reduced motion | All removed (fixed D2) | System | System |
| Density | −1…−4; day cells 40→28 | No | No |
| RTL | Grid, chevrons, field and docked alignment mirror | System | System |

## Plan

1. **Shared model** (data-only): ISO value; locale parse / format with
   `date-separator`; week start; 6-row month matrix with outside days;
   `min` / `max` / disabled predicate; staging vs commit; the event order in
   the source review; year-list bounds (±100 years or `min` / `max`).
2. **Decide the variant mapping** (open decision): native modal ↔
   `modal` / `modal-input`; docked ↔ an anchored popover (iPad / large
   screens) or a sheet. Then build the trigger as a field (outlined / filled)
   with typed entry, clear and calendar buttons.
3. **iOS**: a custom M3 calendar (the system graphical picker cannot show the
   Web anatomy or emit the staging / view / menu events): header + mode
   toggle, nav row, weekday row, day grid (accessibility: one element per
   day, selected / today traits, adjustable rows), modal year grid, docked
   month / year lists, Cancel / OK, label props.
4. **Android**: keep the M3 `DatePicker` for the modal path if staging can be
   reported (`state.selectedDateMillis` changes → `mdSelected`; OK →
   `mdChange`), add `isDateDisabled` via `SelectableDates`, `firstDayOfWeek` /
   locale through the `CalendarLocale`, label props; build the docked variant
   (M3 Compose has `DatePicker` with `showModeToggle = false` inside a
   popup). Emit `mdViewChange` from `displayedMonthMillis`.
5. **Motion** (Web values above), gated on reduce-motion / animator scale.
6. **Verification**: diff against the recaptured Mac oracle (paint matrix,
   per-frame panel / grid / year-grid / menu samples, keyboard and pointer
   event sequences, reduced-motion runs).

## Open decisions to settle before native work

* The variant mapping above, and whether a native docked variant exists.
* Whether keyboard month changes should emit `mdViewChange` (Web: only
  chevrons and menus do; its source union has no keyboard source).
* The docked month / year menus overflow the panel and scroll the page (D4,
  open; see the source review). Natives should scroll the list inside the
  panel; the Web needs a fix first.
* Android's `mdSelected` timing (at OK) vs Web (at the day click).
* Natives should copy the corrected Web event counts (D5–D7: one `mdCancel`
  per Escape, one `mdSelected` per Enter / Space, no string-detail
  `mdInput` / `mdChange` from inner fields, no `mdChange` for an unchanged
  re-commit).
* Focus targets after a docked pick and on first open (D8, open on the Web).
