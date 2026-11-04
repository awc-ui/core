# Multi select native implementation plan (md-multi-select)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-multi-select-source-review.md](md-multi-select-source-review.md); the
  shared option model and field are planned in
  [md-select-native-plan.md](md-select-native-plan.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-multi-select/web-oracle-cloud/`. Recapture it on
  the Mac (Chrome 153) before any native parity diff.

## Current adapters

Both platforms use the shared picker adapter described in the
`md-select` plan (iOS `Options.swift` `optionPicker`, Android `AWCInputs.kt`
`SelectInput`), with `multiple` true for this tag. On top of the `md-select`
gaps (option precedence, carriers ignored on Android, sheet or in-flow
surface, no field anatomy):

**iOS:**

* The search field is shown **always** for this tag (Web: only with
  `filterable`).
* Chips: unless `displayMode == "count"`, a horizontal `ScrollView` of
  capsules (caption font, `xmark.circle.fill` remove button labelled
  "Remove \<value\>", using the **value**, not the label). No inline chips,
  no "+N" counter, no `chipPosition`, no button or slotted trigger; the
  trigger text is always the joined labels (Web: "N selected" in chips and
  count modes).
* "Select all" sets the value to the first `maxSelected` enabled
  **filtered** options. It never toggles back to none and has no
  indeterminate state.
* A pick toggles with the cap; a chip ✕ emits `mdChange` **then**
  `mdRemove` (Web: `mdRemove` then `mdChange`).
* Clear (text button) emits `mdChange`, then `mdClear`.
* No live region, no `softDisabled`.

**Android:**

* Rows carry a `Checkbox`; a pick toggles with the cap
  (`selected.size < limit`); the surface stays open.
* "Select all" (`TextButton`) sets every enabled option, ignoring the
  filter, capped by `maxSelected`; no toggle-off, no tri-state.
* Chips: a `FlowRow` of `InputChip`s under the field (all display modes),
  close glyph labelled "Remove". A chip click emits `mdChange` then
  `mdRemove`.
* The filter emits `mdInput` (Web: no such event on this tag).
* Clear emits `mdChange([])` then `mdClear`.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Value display | `chips` (field "N selected" + chip row), `chips-inline` (+N counter or wrap), `count` (`countFormatter`), `text` | Joined labels + chip strip (none in count) | Joined labels + chip row always |
| Chip row | 32 high (density-tapered), radius 8, 4 gap; `chip-position` bottom/top/left/right (left/right force density −3); D4 hooks | Caption capsules, horizontal scroll | `InputChip` flow row |
| Trigger | Field, outlined button (`trigger-icon`, `trigger-label`), or slotted element | Button | Outlined button |
| Rows | Checkbox `md-menu-item`s, menu stays open, 20px icons | Checkmark rows | Checkbox rows |
| Select all | Tri-state row + divider; toggles all ↔ none; capped by `max-selected`; hidden on the virtual path and while loading | Sets a capped prefix of the filtered list | Sets all enabled, ignores filter |
| Cap | `max-selected`; rejected picks revert the row | Enforced | Enforced |
| Filter | Only with `filterable`; focus moves to it on open | Always shown | Only with `filterable`; emits `mdInput` |
| Chip removal | `mdRemove(value)` then `mdChange`; focus to the replacing chip or the trigger | `mdChange` then `mdRemove`; label uses the value | `mdChange` then `mdRemove` |
| Clear | Round 28px ✕ in the field; `mdChange([])` then `mdClear`; focus to the trigger | Text button | Text button |
| Live region | Polite "None selected" / "N selected" | None | None |
| Keyboard | ArrowDown/ArrowUp/Enter/Space open; Space/Enter toggle; Escape | None | None |
| Disabled | `disabled`, `soft-disabled` (focusable, inert) | `disabled` | `enabled` |
| Hooks | 38 `--md-multi-select-*` | None | None |

## Plan

1. **Shared selection model** on top of the `md-select` option model: the
   toggle with cap and revert; select-all tri-state and toggle (eligible =
   enabled, unfiltered, non-virtual; capped); the removal event order
   (`mdRemove`, then `mdChange`); clear (`mdChange([])`, then `mdClear`);
   `reset()` (no `mdClear`); the "N selected" formatter hook.
2. **Field and chips** (both platforms): reuse the native select field;
   value display modes; a chip row component (input chips, 32/28/24 by
   density, radius 8, gap 4, hooks for height and outline as fixed in D4)
   placed bottom/top/left/right; an inline variant with a measured "+N"
   counter (`ViewThatFits` / `SubcomposeLayout`) and a wrap variant.
3. **Triggers:** the field; an outlined button trigger; a custom trigger
   slot that only wires open/close and anchoring.
4. **Surface:** the anchored menu overlay, checkbox rows (20pt icons), the
   select-all row with its divider, the filter header only when
   `filterable`, the empty slots/texts; stays open across picks.
5. **Semantics:** list `selectableGroup()` / rows `toggleableState` on
   Android, `.isSelected` and a "selected, N of M" value on iOS; chip remove
   actions labelled "Remove \<label\>"; a polite announcement of the count
   on change (`UIAccessibility.post(.announcement)` / a
   `liveRegion = Polite` node); focus to the replacing chip after removal.
6. **Native fixtures:** theme × direction × variant × display mode; chip
   positions; inline overflow (count, wrap); button trigger; density;
   disabled, soft-disabled, error, loading; the open matrix with select-all
   and filter; cap; empty; hooks. Diff against `paint.json`, then the
   pointer, keyboard and open-focus runs against `states.json` /
   `states-reduced.json`.

## Open decisions to settle before native work

The trigger role, initial focus on open (first row vs first selected),
Tab while open, and the chip-height hook under density. All are listed in
the source review; the first three are shared with `md-select`.
