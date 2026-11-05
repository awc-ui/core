# Transfer list native implementation plan (md-transfer-list)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-transfer-list-source-review.md](md-transfer-list-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-transfer-list/web-oracle-cloud/`. Recapture it on
  the Mac (Chrome 153) before any native parity diff.
* The new `select-all-label` prop is not in the generated native contracts
  yet: regenerate the CEM and run `native-compiler` first.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/DataViews.swift`,
`transferList` / `transferColumn` / `moveTransfer`):

* A `VStack`: the two columns side by side in an `HStack`, then **the movers
  in a row below** (Web: between the columns).
* Each column: headline title, a rounded-border `TextField` (placeholder
  fallback "Search"), a `Button("Select all (n)")` (hard-coded English, only
  adds, never toggles off, no indeterminate state), the empty text, and one
  plain `Button` row per item (SF Symbol checkbox + label; no description).
* Items are read as `{value, label, disabled, icon, supportingText}`; Web's
  `description` is ignored, and search matches the label only.
* One **shared** `selectedIDs` set for both sides; it is never pruned when
  `value` or `items` change from outside.
* Movers are SF Symbols (`chevron.right.2` …) with labels defaulting to
  "Move all right" / "Move selected right" / … (Web "… to target" / "… to
  source"); they are never disabled; icons props are ignored.
* `moveTransfer` writes `value` **sorted alphabetically** and emits `mdChange`
  then `mdMove {direction, moved, target}` **even when nothing moved**.
  Selected moves ignore the search filter.
* Not wired: `disabled` (beyond the shared modifier), `density`,
  `countTemplate`, `selectAllLabel`, `emptyIcon`, `searchIcon`, RTL mirroring,
  the stacked layout, row selected/focus/hover states, listbox semantics.

**Android** (`packages/native-android/.../AWCData.kt`, `TransferList`):

* A `Column`: two `OutlinedCard` columns in a `Row`, then the movers in a row
  below, ordered **≪ ← → ≫** (Web: ⇉ → ← ⇇) as `TextButton`s with text glyphs
  and content descriptions defaulting to "Move all left" / … .
* Each column: title, `OutlinedTextField` search (label only), a select-all
  `Checkbox` (two-state; no indeterminate, no accessible name) with an
  `n/m` count (no template), the empty text, and clickable rows with a
  checkbox, label and description.
* One shared `checked` set; never pruned on external changes.
* Search matches the label only. **Move-all honours the filter** (Web ignores
  it). Movers are only disabled with the host. `move` emits `mdChange` then
  `mdMove` even when nothing moved; `value` keeps insertion order but `moved`
  follows item order.
* Not wired: `density`, `countTemplate`, `selectAllLabel`, icons, empty icon,
  RTL, stacked layout, row state paint, listbox/option semantics (rows are
  clickable without a selected state).

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Layout | Grid: source · movers · target (16 gap); ≤640px viewport stacks with movers between, rotated 90° | Columns, movers below | Columns, movers below |
| Column | 360 tall (searchable), radius 16, 1px border, header 73 with select-all + title + count pill | Plain stack, min 150 | Outlined card |
| Rows | 64/48 tall, inset 6, radius 8, checkbox + label + description; hover 8%, checked primary 8%, checked+hover 12%, focus outline 3px | Plain button rows, no description | Clickable rows with description, no state paint |
| Select-all | Checkbox with indeterminate, toggles visible enabled, localised name (`select-all-label`) | "Select all (n)" button, add-only | Two-state checkbox, unnamed |
| Count | `count-template` "{checked}/{total} selected" of visible enabled items | None | "n/m" |
| Search | Label or description, trimmed, case-insensitive; internal clear + Escape | Label only | Label only |
| Selected move | Visible enabled checked items; appends in check order; side checks cleared | All checked of that side (ignores filter); value sorted | Visible checked; item order |
| Move-all | Every enabled item of the side, ignoring the filter | Ignores filter | **Honours** filter |
| Empty move | No events | Emits | Emits |
| Mover state | Disabled when nothing to move; single-step-only hides move-all | Never disabled | Disabled only with host |
| Mover order/icons | ⇉ → ← ⇇, `move-*-icon` props, mirrored in RTL | SF Symbols, fixed | Text glyphs, reversed order |
| Labels | "Move selected to target" … all props | Different defaults | Different defaults |
| Checks | Per side; pruned on controlled `value`/`items` changes | Shared, never pruned | Shared, never pruned |
| Events | `mdChange(value[])`, then `mdMove {direction, moved, target}`; nothing for checks/search | Same names; extra empty moves | Same names; extra empty moves |
| Methods | `moveSelectedRight()`, `moveSelectedLeft()` | None | None |
| Semantics | `group` host; `listbox` (multiselectable) per side; `option` + `aria-selected`/`aria-disabled`; empty `status` | Buttons | Clickable rows |
| Density | Movers 40→24, rows 64→40, header 73→51, search 80→56 | None | None |
| Disabled | Rows unfocusable, lists scrollable, movers/checkboxes disabled | Shared modifier | `enabled` |
| Reduced motion | Row transition removed | System | None |

## Plan

1. **Model** (shared rules, both platforms): per-side check sets pruned on
   `value`/`items` changes; filter on label + description; selected move =
   visible enabled checked, appended in check order; move-all = every enabled
   item ignoring the filter; no events for an empty move; side checks cleared
   after a move. Unit-test against the event payloads in `states.json`.
2. **Layout**: source · movers · target with the measured sizes; stacked
   layout below the 640px breakpoint (decide viewport vs container first)
   with rotated movers; RTL order and mirroring.
3. **Header**: select-all with indeterminate and `select-all-label`, title,
   count pill from `count-template`; search field with icon, clear and
   Escape.
4. **Rows**: checkbox + label + description, state paint (hover, checked,
   checked + hover, focus, checked + focus, disabled) from `paint.json`;
   toggles on tap/Space/Enter.
5. **Movers**: icon props, labels, disabled rules, single-step-only; focus
   stays on the mover after a move.
6. **Semantics**: listbox per side, selectable options with selected and
   disabled traits, a status for the empty state, named select-all and
   movers; localisation via the label props.
7. **Density, disabled, reduced motion, high contrast** per the oracle.
8. **Contracts**: parity tests per platform for the move rules, event order
   and payloads, keyboard sequence and paint matrix against the recaptured
   oracle.

## Open decisions to settle before native work

* Native composed `input` leaking from the search fields (library-wide).
* `count-template`: replace every token, not just the first.
* `moved` / `value` order: check order (today) or item order.
* Move-all vs filter, and dropping a hidden checked item's check on a move.
* Stacked layout: viewport media query vs container query.
* Host accessible name, announcing count changes, roving focus / arrow keys
  in the lists, localising the search clear button (needs `md-text-field`).
