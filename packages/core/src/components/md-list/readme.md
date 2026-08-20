# md-list

<!-- llm:meta
tag: md-list
category: containment
status: md3-mapped
m3-guidelines: https://m3.material.io/components/lists/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-list-item
-->

**A vertical set of related rows.** It owns the container role and selection.
Roving focus, arrow-key and typeahead navigation, and optional drag-to-reorder
are all coordinated here on behalf of its `md-list-item` children.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- A **vertical collection of similar records**: contacts, files, messages,
  settings.
- Rows that may be selectable, activatable, or reorderable.
- Content that reads top-to-bottom rather than comparing across columns.

## When NOT to use

| Situation | Use instead |
|---|---|
| Rich, self-contained items with their own actions | `md-card` collection |
| A contextual popup of actions | `md-menu` |
| Options in a picker | `md-select` / `md-multi-select` |
| Collapsible content sections | `md-accordion` |
| Navigation destinations | `md-navigation-rail` / `md-navigation-bar` |
| Moving items between two pools | `md-transfer-list` |
| Column-comparable data | `md-table` |

## Decision cues

| Need | Setting |
|---|---|
| One connected chassis, square middle rows | `list-style="standard"` (default) |
| Individually rounded tiles with a gap | `list-style="segmented"` |
| Rows select one at a time | `selection-mode="single-select"` |
| Rows multi-select | `selection-mode="multi-select"` |
| Rows just activate (navigate/open) | `selection-mode="none"` (default) + `type` on the rows |
| A row has several distinct controls | `interaction-mode="multi-action"` |
| Drag to reorder | `reorderable` |
| Name the list | `label`, or `labelledby` pointing at a heading's id |
| Wire the list into a menu pattern | `role-override="menu"` |
| Hairlines between rows | Interleave `<md-divider>` children |

## API contract

```html
<md-list
  list-style="standard|segmented"                    <!-- default: standard -->
  selection-mode="none|single-select|multi-select"   <!-- default: none -->
  interaction-mode="single-action|multi-action"      <!-- default: single-action -->
  reorderable                                        <!-- default: false -->
  label="Contacts"                                   <!-- default: "" -->
  labelledby="contacts-heading"                      <!-- default: "" -->
  role-override=""                                   <!-- default: "" -->
  density="-1|-2|-3|-4"                              <!-- default: 0 (uncompacted) -->
>
  <md-list-item headline="Ada Lovelace"></md-list-item>
  <md-list-item headline="Grace Hopper"></md-list-item>
</md-list>
```

**Events** — all three bubble and are composed.

| Event | Detail | Fires |
|---|---|---|
| `mdSelect` | `{ index, value, selected, item, childIndex?, expanded? }` | Selection changed **through user input** (click / Enter / Space). `value` is the row's `headline`, falling back to its text content. `childIndex` / `expanded` are present only when the selected row lives in an expandable parent's `expanded-content`. |
| `mdActivate` | `{ index, item }` | The active (roved) row **changed** — click, arrow key, `Home`/`End`, typeahead. Not an "open this" signal. |
| `mdReorder` | `{ from, to, order }` | A drag or `Alt+Arrow` reorder completed. `order[newPosition] === originalPosition` against the as-authored order. |

**Methods**

| Method | Returns | Notes |
|---|---|---|
| `activateNext()` | `Promise<HTMLMdListItemElement \| null>` | Roving focus forward, wraps at the end |
| `activatePrevious()` | `Promise<HTMLMdListItemElement \| null>` | Roving focus back, wraps at the start |
| `selectItem(index)` | `Promise<void>` | No-op when `selection-mode="none"`; **does not emit `mdSelect`** |
| `getSelectedIndices()` | `Promise<number[]>` | Indices of rows whose `selected` is true |

**Slots** — `(default)`: `md-list-item` children, optionally interleaved with
`md-divider`.

**Parts** — `drop-placeholder` (the ghost slot shown under the insertion point
during a pointer reorder; only in the DOM while dragging).

### Behavioral contract worth knowing

- **Only direct `md-list-item` children count.** Rows are found with
  `children.filter(el => el.tagName === 'MD-LIST-ITEM')`, so wrapping rows in a
  `<div>` for layout hides them from indexing, roving focus and reordering. A
  `MutationObserver` re-syncs when children are added or removed.
- **`mdActivate` is a focus/roving signal, not an "open this" signal.** It
  fires whenever the active row *changes*; clicking the row that is already
  active emits nothing. Navigate from the row's own `type="link"`/`type="button"`
  behaviour, or from `mdSelect`, not from this.
- **Selection and activation are different.** `mdSelect` means "the selected set
  changed"; a list can do one, both, or neither.
- **The list writes props onto its children** at load and on every child-list
  mutation: `selectionMode`, `interactionMode`, `reorderable`, and
  `containerRole`. Don't set those on `md-list-item` yourself — they will be
  overwritten. `density` is *not* pushed as a prop; it cascades as the
  `--md-sys-density-scale` custom property.
- **The container role is derived**, in this order: `role-override` if set →
  `listbox` when a selection mode is on → but back to `list` if any direct row
  is `expandable` (those rows own nested option semantics instead) → otherwise
  `list`. `aria-multiselectable="true"` is added only when the role really
  resolves to `listbox`.
- **Interleaved `md-divider`s are hidden from AT automatically** when the role
  is `list` or `listbox`, because those containers may not own a `separator`.
  Under a `role-override` such as `menu` they keep their separator semantics.
- **Keyboard**, handled on the list: `ArrowDown`/`ArrowUp` move roving focus and
  wrap; `Home`/`End` jump to the ends; any printable character starts a
  typeahead that matches the prefix of a row's `headline` (or text content) and
  clears after 500 ms of inactivity; `Alt+ArrowUp`/`Alt+ArrowDown` reorder when
  `reorderable`.
- The list **stops handling arrow keys entirely** when it is inside an
  `md-search`, which owns that navigation.
- With `selection-mode="none"`, focusable rows are those whose `type` is not
  `text`. Turning on a selection mode (or `reorderable`) makes **every**
  non-disabled row focusable, including plain `type="text"` rows.
- `single-select` clears the other rows' `selected` before setting the new one;
  `multi-select` toggles the clicked row only.
- `selectItem(index)` changes state **without** emitting `mdSelect` — use it to
  mirror external state, and don't wait for an event you won't get.
- `reorderable` moves the rows in the DOM and emits `mdReorder`; **nothing is
  persisted.** Apply `detail.order` to your data. Disabled rows can't be picked
  up.

---

## Do / Don't

Sourced from [M3 · Lists · Guidelines](https://m3.material.io/components/lists/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Place supporting visuals (thumbnails, avatars) at the **leading** edge to aid scanning | Avoid visuals in the centre of a row — it makes the list hard to scan |
| Use segmented gaps and filled items to define a list group | Don't over-divide a contained list |
| Limit dividers to **uncontained** lists | Don't put a divider between every row of a segmented list |
| Adjust margins for a comfortable line length | Don't scale the list without adjusting text length — long lines hurt readability |
| Use a multi-column layout to break up content when it helps | Don't force a single narrow column on a wide screen |
| Keep rows structurally consistent | Don't mix wildly different row shapes in one list |
| Name the list | Don't ship an unnamed list |

---

## Patterns

```html
<!-- Simple activatable list -->
<md-list label="Contacts">
  <md-list-item type="button" headline="Ada Lovelace" supporting-text="Engineering"></md-list-item>
  <md-list-item type="button" headline="Grace Hopper" supporting-text="Research"></md-list-item>
</md-list>

<script type="module">
  const list = document.querySelector('md-list');
  list.addEventListener('mdActivate', (e) => highlight(e.detail.index));
</script>
```

```html
<!-- Multi-select with trailing controls -->
<md-list id="files" label="Files"
         selection-mode="multi-select" interaction-mode="multi-action">
  <md-list-item headline="report.pdf">
    <md-icon-button slot="trailing" icon="more_vert"
                    aria-label="More actions for report.pdf"></md-icon-button>
  </md-list-item>
  <md-list-item headline="notes.txt">
    <md-icon-button slot="trailing" icon="more_vert"
                    aria-label="More actions for notes.txt"></md-icon-button>
  </md-list-item>
</md-list>

<script type="module">
  const list = document.getElementById('files');
  list.addEventListener('mdSelect', async () => {
    console.log(await list.getSelectedIndices());
  });
</script>
```

```html
<!-- Reorderable: the list moves the DOM, you persist the order -->
<md-list id="playlist" label="Playlist" reorderable>
  <md-list-item headline="Track one"></md-list-item>
  <md-list-item headline="Track two"></md-list-item>
  <md-list-item headline="Track three"></md-list-item>
</md-list>

<script type="module">
  document.getElementById('playlist').addEventListener('mdReorder', (e) => {
    // e.detail.order[newPosition] === originalPosition
    savePlaylist(e.detail.order);
  });
</script>
```

```html
<!-- Segmented tiles, and hairlines via interleaved dividers -->
<md-list list-style="segmented" label="Quick actions">
  <md-list-item type="button" headline="Share" leading-icon="share"></md-list-item>
  <md-list-item type="button" headline="Archive" leading-icon="archive"></md-list-item>
</md-list>

<md-list list-style="standard" label="Settings">
  <md-list-item type="button" headline="Notifications"></md-list-item>
  <md-divider inset></md-divider>
  <md-list-item type="button" headline="Privacy"></md-list-item>
</md-list>
```

```html
<!-- Named by a visible heading -->
<h2 id="contacts-heading">Contacts</h2>
<md-list labelledby="contacts-heading">
  <md-list-item type="button" headline="Ada Lovelace"></md-list-item>
</md-list>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Setting `selection-mode` / `interaction-mode` / `reorderable` on `md-list-item` | Set them on `md-list` | The list overwrites them on load and on every child mutation. |
| Wrapping rows in `<div>`s for layout | Keep `md-list-item` as direct children | Row discovery filters direct children by tag name. |
| Waiting for `mdSelect` after calling `selectItem()` | Update your state directly | The method deliberately does not emit. |
| Treating `mdActivate` as "the user opened this row" | Use the row's `type="link"`/`type="button"`, or `mdSelect` | It only reports a roving-focus change. |
| Expecting `reorderable` to persist order | Save `e.detail.order` | The list only moves the DOM and reports. |
| Trailing buttons with `interaction-mode="single-action"` | Use `multi-action` | The row treats the whole body as one target otherwise. |
| A list with no `label`/`labelledby` | Name it | Screen-reader navigation depends on it. |
| `aria-multiselectable` set by hand | Use `selection-mode="multi-select"` | The list writes it, and only when the role really is `listbox`. |
| `role="separator"` expected from interleaved dividers | Accept that they are `aria-hidden` in a `list`/`listbox` | A list may not own a separator. |
| Using a list for column-comparable data | `md-table` | Wrong structure. |
| Dividers between every segmented row | Reserve dividers for uncontained lists | M3 explicit rule. |
| Centre-aligned thumbnails | Leading edge | M3 explicit rule. |

## Accessibility, RTL, density, i18n

**Accessibility**
- Give the list an accessible name (`label`, or `labelledby` pointing at a
  visible heading). It is the single most common defect here.
- The list manages roving focus: one tab stop for the whole list, arrows to
  move within it, `Home`/`End` to jump, typeahead to seek.
- With `multi-action` rows, every embedded control needs a name that identifies
  **which** row it belongs to ("More actions for report.pdf", not "More
  actions").
- Drag-to-reorder has a built-in keyboard equivalent: `Alt+ArrowUp` /
  `Alt+ArrowDown` on the focused row.
- Selection state is exposed by the rows (`aria-selected` on `role="option"`),
  not by the container.
- Reach for `role-override` only when you are deliberately wiring a different
  ARIA pattern (e.g. `menu`); the rows adapt their own roles to match.

**RTL** — leading/trailing regions and padding are logical and mirror under
`dir="rtl"`. Reordering is vertical only, so it is unaffected.

**Density** — `density="-1…-4"` on the list sets `--md-sys-density-scale`,
which inherits into the rows, so one value compacts the whole list. Rung `0` is
the uncompacted default and has no rule of its own; to pin one row back to full
size, set `style="--md-sys-density-scale: 0"` on it. Verify touch targets at
deep rungs.

**i18n** — translate `label` and all row content. Longer translations increase
row height; M3's line-length guidance matters more in verbose languages.

## Related components

`md-list-item` · `md-divider` · `md-table` · `md-card` · `md-menu` ·
`md-accordion` · `md-transfer-list`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-list-container-color` | List chassis background | `transparent` (both `standard` and `segmented`) |
| `--md-list-container-shape` | Corner radius of the list chassis | `0px` |
| `--md-list-padding-block` | Block padding | `--md-sys-spacing-inset-sm` (`8px`) in `standard`; `0px` in `segmented` |
| `--md-list-padding-inline` | Inline padding | `0px` |
| `--md-list-segmented-gap` | Gap between tiles in `list-style="segmented"` | `2px` |
| `--md-list-drop-placeholder-color` | Drop-target fill | 45% `--md-sys-color-primary-container` |
| `--md-list-drop-placeholder-outline-color` | Drop-target outline | 55% `--md-sys-color-primary` |
| `--md-list-drop-placeholder-outline-width` | Drop-target outline width | `2px` |
| `--md-list-drop-placeholder-shape` | Drop-target radius | `--md-sys-shape-corner-large` (`16px`) |
| `--md-list-drop-placeholder-opacity` | Drop-target opacity | `1` |

**CSS parts** — `drop-placeholder`.

Row appearance is themed separately with the `--md-list-item-*` properties —
see the `md-list-item` readme.

```css
md-list.card {
  --md-list-container-color: var(--md-sys-color-surface-container);
  --md-list-container-shape: 16px;
  --md-list-padding-inline: 8px;
}
```

<!-- Auto Generated Below -->


## Properties

| Property          | Attribute          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Type                                          | Default           |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------- |
| `density`         | `density`          | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `-1 \| -2 \| -3 \| -4 \| 0`                   | `0`               |
| `interactionMode` | `interaction-mode` | Row interaction pattern for the whole list. A list uses exactly one interaction mode at a time (per the M3 Lists spec).  - `single-action` (default): each row is one tappable area — leading   icon + label activate together. Use `type="button"` (or selection   mode) on items. - `multi-action`: rows expose a primary action (the row body) plus   optional secondary actions in `slot="trailing"` (e.g. `md-icon-button`).   Clicks on trailing controls do not activate the primary row action;   each secondary control keeps its own focus stop and keyboard behavior.                                                                                                                                                                                                                                          | `"multi-action" \| "single-action"`           | `'single-action'` |
| `label`           | `label`            | Optional aria-label for the container.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `string`                                      | `''`              |
| `labelledby`      | `labelledby`       | Optional aria-labelledby for the container.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `string`                                      | `''`              |
| `listStyle`       | `list-style`       | Visual style of the list.  - `standard` (default, M3 Expressive): rows share a single rounded   chassis with **no gap** between them. The first row rounds its   top corners, the last rounds its bottom corners, and middle rows   are square so the stack reads as one continuous shape — the M3   "connected" pattern. Best for settings panels, option groups,   and iOS-style sectioned tables. To add hairline separators   between rows, interleave `<md-divider>` elements. - `segmented` (M3 Expressive): rows are individually rounded "tiles"   separated by a small gap. Each tile rounds all four corners. Best   for action sets, quick-action menus, and card-like sections where   each row should read as its own affordance.                                                                            | `"segmented" \| "standard"`                   | `'standard'`      |
| `reorderable`     | `reorderable`      | Enable drag-to-reorder. Each row renders a trailing drag handle (grab it to drag the row to a new position); rows can also be moved with `Alt + ArrowUp / ArrowDown` while focused. On drop the list reorders its children in the DOM and emits {@link mdReorder}. Disabled rows can't be picked up. Works alongside `single-action` / `multi-action` and selection modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                | `boolean`                                     | `false`           |
| `roleOverride`    | `role-override`    | Override the auto-computed ARIA role. Useful when wiring the list into a wider widget pattern (e.g. `role="menu"` for a dropdown). Leave empty to use the role implied by `selectionMode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `string`                                      | `''`              |
| `selectionMode`   | `selection-mode`   | Selection coordination across child rows.  - `none` (default): each row stands alone and the container is always   `role="list"` (rows are `listitem`s). Interactive rows (`type="button"` /   `type="link"`) expose their widget role on an inner primary element, so   the list validly owns only `listitem`s while still providing the same   roving-tabindex + arrow-key navigation. `type="text"` rows stay   non-focusable. - `single-select`: the container behaves as `role="listbox"`, items   become `role="option"`, and exactly one item carries `aria-selected`. - `multi-select`: same as above plus `aria-multiselectable="true"`.  Switching to a selection mode also auto-promotes plain `type="text"` rows to focusable so users can pick from a list of label-only rows without authoring extra props. | `"multi-select" \| "none" \| "single-select"` | `'none'`          |


## Events

| Event        | Description                                                                                                                                                                                                                                                                                                                                               | Type                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mdActivate` | Emitted whenever roving focus lands on a different row.                                                                                                                                                                                                                                                                                                   | `CustomEvent<{ index: number; item: HTMLMdListItemElement; }>`                                                                                                      |
| `mdReorder`  | Emitted after a drag (or keyboard) reorder completes.  - `from` / `to`: the moved row's old and new positions (item indices,   ignoring non-item children like dividers). - `order`: the new order expressed as the original (as-authored) indices,   so `order[newPosition] === originalPosition`. Use it to reorder a   backing data array in one pass. | `CustomEvent<{ from: number; to: number; order: number[]; }>`                                                                                                       |
| `mdSelect`   | Emitted when selection changes via user input (click / Enter / Space).                                                                                                                                                                                                                                                                                    | `CustomEvent<{ index: number; value: string; selected: boolean; item: HTMLMdListItemElement; childIndex?: number \| undefined; expanded?: boolean \| undefined; }>` |


## Methods

### `activateNext() => Promise<HTMLMdListItemElement | null>`



#### Returns

Type: `Promise<HTMLMdListItemElement | null>`



### `activatePrevious() => Promise<HTMLMdListItemElement | null>`

Move roving focus to the previous focusable item, wrapping at the start.
Returns the newly active item, or `null` when no items are focusable.

#### Returns

Type: `Promise<HTMLMdListItemElement | null>`



### `getSelectedIndices() => Promise<number[]>`

Returns the indices of all currently selected items.

#### Returns

Type: `Promise<number[]>`



### `selectItem(index: number) => Promise<void>`

Programmatically toggle selection on the item at `index` according
to the current `selection-mode`. Does not emit `mdSelect` (use it
to sync external state without a user action).

#### Parameters

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `index` | `number` |             |

#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part                 | Description |
| -------------------- | ----------- |
| `"drop-placeholder"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
