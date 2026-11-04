# Select native implementation plan (md-select, md-select-option)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-select-source-review.md](md-select-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-select/web-oracle-cloud/`. Recapture it on the
  Mac (Chrome 153) before any native parity diff.
* The surface reuses the menu work planned in
  [md-menu-native-plan.md](md-menu-native-plan.md) (anchored overlay,
  roving model, row metrics, motion).

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Options.swift`;
`AWCNativeView.swift` maps `md-select`, `md-multi-select` and
`md-autocomplete` to `optionPicker`, and `md-select-option` to
`selectOption`):

* **Options** (`options`):
  * **The `options` array wins over carriers**, the reverse of the Web rule.
  * Carriers become `AWCOption(id: value ?? node id, label: label ?? first
    text child, disabled, icon, supportingText)`. `hidden`, `selected` and
    `iconColor` are not read.
* **`optionPicker`** is an in-flow `VStack`:
  * a caption label (with " *" when `required`);
  * a plain `Button` trigger: the joined selected labels or `placeholder`
    (default "Select an option"), a spacer and the `dropdownIcon` symbol
    (default **`expand_more`**; Web `arrow_drop_down`), padded 14 on a
    10-radius surface with a 0.4 stroke. No outlined/filled variants, no
    floating label, no density, no error colour on the field;
  * `clearable`: a **text** button (`clearLabel`, default "Clear") under the
    field. It emits `mdChange`, and `mdClear` for the other two tags only;
  * the supporting text.
* **Surface:** `awcPreviewSheet` bound to `open` (medium/large detents), with
  a "Done" toolbar button and `navigationTitle(label)`.
  * A search `TextField` when `filterable` (also always for multi-select and
    autocomplete). It filters on the **label only**, ignores `filterMode`,
    and applies `limitResults`.
  * `loading` → `ProgressView(loadingText)`; empty → `noOptionsText` /
    `noResultsText`.
  * Rows: icon, label, supporting text, trailing `checkmark` when selected;
    `.disabled(option.disabled)`.
* **`chooseOption`:** single sets `value`, **always** emits `mdChange` (also
  on re-picking the selected option), validates `required`, and closes unless
  `disableCloseOnSelect`.
* **`selectOption`** (a standalone carrier) renders a tappable row that
  toggles its own `selected` and emits `mdSelectOptionChange`.

**Android** (`packages/native-android/.../AWCInputs.kt` `SelectInput`, for
all three tags; `md-select-option` is a `ListItem` in the same file):

* **Options:** `p.choices()` reads **only the `options` property**. Slotted
  `md-select-option` children are not collected. They are rendered by
  `slot?.invoke("")` inside the open surface as standalone `ListItem`s whose
  click emits `mdSelectOptionChange {value, selected: true}` and never
  changes the select's value. A markup-authored select is therefore empty
  on Android.
* **Trigger:** an `OutlinedButton` with the joined labels or `placeholder`
  (default "Select") and an `expand_more` glyph. No label, variants, density
  or error styling on the field.
* **Surface:** an **in-flow** tonal `Surface` that pushes the content below
  it (not a popup), scrolling at `maxHeight` (default 320, clamped 100–600).
  * A search field when `filterable`, which emits **`mdInput`** (Web
    `md-select` has no such event).
  * `LinearProgressIndicator` for `loading`; empty texts.
  * Rows: label and description, a `check` glyph for the selected row,
    `clickable(enabled = !disabled)`. A pick sets the value, emits
    `mdChange`, writes the label into the query and closes.
* **Clear:** a `TextButton` that emits `mdChange("")` **and `mdClear`**
  (Web `md-select` emits no `mdClear`).
* `mdOpen` / `mdClose` are emitted on toggle.
* Error text replaces supporting text.

Both platforms submit the value through their form adapters
(`NativeForms.swift`, `AWCFormControls.kt`); an empty `md-select` submits
nothing, as on the Web.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Option source | Carriers win over `options`; direct children only | `options` wins | `options` only; carriers render as inert rows |
| `hidden` carrier (D1) | Not listed, not selectable; still names the trigger when current | Listed | n/a (carriers ignored) |
| `selected` hint | First enabled hinted carrier, at load, only while `value` is empty | Ignored | Ignored |
| Carrier text edits (D3) | Re-read | Re-read on re-render | n/a |
| Trigger | Read-only text field: outlined/filled, floating label, density 56…40, error and supporting line, trailing clear + caret (rotates 180°), spinner while loading | Plain bordered button, caption label | Outlined button |
| Surface | Anchored `md-menu` popup, 4px under the field, trigger-wide, flips; `placement`, `match-trigger-width`, `max-height` | Sheet (medium/large) | In-flow column |
| Rows | Radio `md-menu-item`s 48 high (density-tapered), 40px check column, 24px icon, supporting line, selected secondary-container fill | Checkmark row | Check glyph row |
| Filter | `filterable`: in-menu search box; label **or** supporting text; `substring`/`prefix`/`fuzzy`; `setQuery()`; cleared on close | Label-only; mode ignored | Label-only; emits `mdInput` |
| Virtualization | WASM path above 200 options; `loadOptions`, `getLabels`, `row-height` | None (SwiftUI `List` is lazy) | None (`Column` + `verticalScroll`, not lazy) |
| Re-pick | Closes, emits nothing | Emits `mdChange` | Emits `mdChange` |
| Clear | ✕ icon button in the field; `mdChange('')` only | Text button; `mdChange` | Text button; `mdChange` + `mdClear` |
| Loading | Spinner in place of the caret, `aria-busy`, wavy bar in the menu | `ProgressView` in the sheet | Linear bar in the column |
| Keyboard | ArrowDown/Enter/Space open; arrows, Home/End, type-ahead, Enter; Escape returns focus | None | None |
| Validation | `required`, custom validity, `mdValidityChange` (not on mount, deduplicated), `value-missing-label` | `validate` on pick only | Form adapter only |
| Semantics | Read-only textbox today (combobox pending decision); listbox/option with `aria-selected` | Button | Button |
| Hooks | 8 `--md-select-*` hooks | None | None |
| Events | `mdChange`, `mdOpen`, `mdClose`, `mdValidityChange` | + `mdClear` (not for select) | + `mdClear`, `mdInput` |

## Plan

1. **Shared option model** (both platforms, data-only, headless tests):
   * collect options with the Web precedence (carriers, then `options`), the
     label fallback (`label` → trimmed text → `value`), `hidden` filtering
     and the hidden-current-label lookup (D1), and the load-time `selected`
     adoption;
   * the filter (label or supporting text; substring, prefix, fuzzy);
   * the selection rules: re-pick is silent; clear and `reset()` emit
     `mdChange('')` only; form reset restores silently; a keyboard pick
     closes exactly like a tap (D5); after clear, focus returns to the
     trigger (D6).
2. **Android carriers first.** Collect `md-select-option` children as data
   (do not render them through the slot), so markup-authored selects work.
   This is the largest functional gap.
3. **iOS `SelectField` / Android `SelectField`.**
   * Trigger: reuse the native text-field rendering (variants, floating
     label, density ladder 56/52/48/44/40, supporting/error line) in a
     read-only mode, with the trailing clear `IconButton` (24×24, 2pt gap)
     and caret (rotates 180°, 24pt).
   * Surface: the anchored menu overlay from the menu plan (4pt offset,
     trigger width, flip, `maxHeight` scroll), not a sheet or an in-flow
     column. Rows: 48pt with a 40pt check column, 24pt icon, supporting
     line, secondary-container fill on the selected row.
   * Open on the **selected** row (see decisions), scroll it into view.
   * Filter header (44pt) when `filterable`, cleared on close.
   * `loading`: spinner in place of the caret; indeterminate bar in the
     surface.
   * Lazy rows (`LazyVStack` / `LazyColumn`) instead of a WASM store; keep
     `loadOptions` and `getLabels` as API shims over the native list.
4. **Semantics.**
   * iOS: the trigger is a button-like element with the label as
     `accessibilityLabel`, the selected label as `accessibilityValue`, and a
     "collapsed/expanded" hint; rows get `.isSelected`; disabled rows are
     `.disabled`.
   * Android: `Role.DropdownList` on the trigger with `stateDescription`;
     `selectableGroup()` on the list and `selected` on rows; the popup
     `paneTitle` is the label.
5. **Keyboard** (hardware keyboards): ArrowDown/Enter/Space open; arrows,
   Home/End, type-ahead and Enter/Escape in the list, through the shared menu
   roving model.
6. **Events and validation** aligned to the table above: no `mdClear` and no
   `mdInput` from `md-select`; `mdValidityChange` deduplicated and silent on
   mount.
7. **Native fixtures:** theme × direction × variant × density × state
   (empty, placeholder, value, error, disabled, supporting, loading), the
   open matrix (plain and filterable), hooks, `match-trigger-width=false`,
   `placement=top-start`, the hidden placeholder. Diff against `paint.json`,
   then the pointer, keyboard, filter and open-focus runs against
   `states.json` / `states-reduced.json`.

## Open decisions to settle before native work

* Trigger role (combobox vs read-only textbox) and whether the Web side takes
  the axe exception.
* Initial focus on open: first row (Web today) or the selected row (native
  platforms and the APG).
* Whether arrows stop on disabled options (Web today) or skip them (native
  platforms).
* Tab while open (Web today: focus lost to the document).
* Closed-state type-ahead and ArrowUp.

All five are described in the source review.
