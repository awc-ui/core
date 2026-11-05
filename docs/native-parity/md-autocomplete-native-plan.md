# Autocomplete native implementation plan (md-autocomplete)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-autocomplete-source-review.md](md-autocomplete-source-review.md); the
  shared option model is planned in
  [md-select-native-plan.md](md-select-native-plan.md) and the chip row in
  [md-multi-select-native-plan.md](md-multi-select-native-plan.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-autocomplete/web-oracle-cloud/`. Recapture it on
  the Mac (Chrome 153) before any native parity diff.

## Current adapters

Both platforms render this tag with the shared picker adapter (iOS
`Options.swift` `optionPicker`, Android `AWCInputs.kt` `SelectInput`), so
**neither has an editable field**: the trigger is a button that opens a
list with a separate search box.

**iOS:**

* The trigger `Button` shows the joined selected labels or the
  placeholder; tapping it copies `inputValue` into the query and opens the
  sheet.
* In the sheet, the search `TextField` writes `inputValue` and emits
  `mdInput` on every change; Return commits the query when `freeSolo`.
* The filter is a label `contains`, ignores `filterMode` and the
  `filterer`, and applies `limitResults`.
* Single picks close unless `disableCloseOnSelect`; `multiple` toggles with
  `maxSelected`.
* Chips (when `multiple`): the same strip as multi-select; a chip ✕ emits
  `mdChange` only (matching the Web).
* Clear (text button) emits `mdChange` and `mdClear`, but does not clear
  `inputValue` (the Web clears both and emits `mdInput("")`).
* No status announcement, no `clearOnBlur`, no strict-mode snap-back, no
  Backspace chip removal, no `softDisabled`.

**Android:**

* The trigger is the `OutlinedButton`; the open surface holds an
  `OutlinedTextField` that emits `mdInput`.
* A single pick writes the label into the query and closes. `freeSolo` adds
  a "Use “…”" `TextButton` (the Web commits on Enter).
* Chips: `InputChip`s that emit `mdChange` **and `mdRemove`** (the Web
  autocomplete emits no `mdRemove`).
* Clear emits `mdChange` and `mdClear`; the query is kept.
* The form adapter skips `mdInput` when syncing the value
  (`AWCFormControls.kt`).

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Field | Editable text field (filled default), combobox role, `aria-expanded`, `aria-autocomplete=list`, listbox by element reflection | Button + search in a sheet | Button + search in an in-flow column |
| Typing | Opens the popup, filters, emits one `mdInput` per change; status "{count} suggestions available" | Filters inside the sheet; emits `mdInput` | Filters; emits `mdInput` |
| Value vs text | `value` and `inputValue` independent; strict single mode snaps the text back on close; `clear-on-blur` | Independent; no snap-back | Pick writes the label into the query |
| Filtering | `filterer`, or `filter-mode` on the WASM path; `limit-results` on the client path | Label contains; limit | Label contains; limit |
| Free solo | Enter commits the trimmed text | Return commits | "Use …" button |
| Multiple | Stays open, clears the text after each pick; Backspace on empty removes the last chip; `chip-position` below/top/left/right/inline | Toggles; chip strip | Toggles; chip flow row |
| Chip removal | `mdChange` only | `mdChange` only | `mdChange` + `mdRemove` |
| Clear | 28px ✕ in the field (default on); clears text and value; `mdInput("")`, `mdChange`, `mdClear` | Text button; value only | Text button; value only |
| Keyboard | ArrowDown/ArrowUp move real focus into the list; typing on a row returns to the input; Enter commits; Escape closes | Software keyboard only | Software keyboard only |
| Loading | Spinner in the field, busy list | `ProgressView` | Linear bar |
| Events | `mdInput`, `mdChange`, `mdOpen`, `mdClose`, `mdClear`, `mdValidityChange`; nothing from the inner field (D2) | Same names, plus no validity on clear | Plus `mdRemove` |
| Hooks | 11 `--md-autocomplete-*` | None | None |

## Plan

1. **Shared autocomplete model** (on top of the option model): `value` /
   `inputValue` separation; typed-since-open filtering (reopen shows all);
   strict single snap-back on close; `clear-on-blur`; free-solo commit on
   Enter; `multiple` (stay open, clear text, Backspace removes the last
   value); the cap; the status message from `status-template`; the event
   rules (one `mdInput` per change, `mdChange` only for commits, clear =
   `mdInput("")`, `mdChange`, `mdClear`; no `mdRemove`).
2. **Field:** the native text field, editable, with the trailing clear
   (28pt, on by default) and caret; the suggestion list as the anchored menu
   overlay **without taking focus** (iOS: an overlay under the field driven
   by `@FocusState`; Android: `ExposedDropdownMenuBox` with
   `MenuAnchorType.PrimaryEditable`, or a `Popup` that does not take focus).
3. **Chips:** reuse the multi-select chip row, with `below`/`top`/`left`/
   `right` and an inline variant inside the field.
4. **Semantics:** iOS: the text field keeps its native traits, and a
   suggestion-count announcement is posted after typing; rows `.isSelected`.
   Android: `semantics { role = Role.DropdownList }` is not right for an
   editable field: keep the text field role, expose the popup with
   `paneTitle`, and announce the count through a polite live region.
5. **Hardware keyboard:** arrows into the list, Enter, Escape, Backspace on
   empty (multiple).
6. **Native fixtures:** theme × direction × variant (filled, outlined) ×
   state (empty, value, typed-open, multiple, multiple inline); density;
   disabled, soft-disabled, error, loading; no-results; hooks. Diff against
   `paint.json`, then the keyboard, multiple, free-solo and Tab runs against
   `states.json` / `states-reduced.json`.

## Open decisions to settle before native work

`mdRemove` for chips, the `chip-position` vocabulary, Escape-twice clearing,
Tab with the popup open, and the all-hidden carrier fallback. All are listed
in the source review.
