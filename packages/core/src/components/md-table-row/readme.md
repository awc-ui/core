# md-table-row

<!-- llm:meta
tag: md-table-row
category: data
status: sub-component
parent: md-table-head, md-table-body, md-table-foot
standalone: false
m3-guidelines: none — M3 has no data-table page
form-associated: false
depends-on: none
used-by: none
accepts-children: md-table-cell
-->

**One row of a `md-table`.** A real grid box that spans the table's tracks and
lays its `md-table-cell` children onto them with `grid-template-columns:
subgrid`, so hover, stripes, dividers, selection tint, sticky rows and focus
rings all paint on the row itself.

> 🧩 **Sub-component.** Belongs inside `md-table-head`, `md-table-body` or
> `md-table-foot` (a row loose under `md-table` is treated as a body row).

---

## When to use

- Every row of a hand-authored `md-table`, including header and footer rows —
  the parents that own it are `md-table-head`, `md-table-body` and
  `md-table-foot`.

## When NOT to use

| Situation | Use instead |
|---|---|
| A list row | `md-list-item` |
| A collapsible section outside a table | `md-accordion-item` |
| A card in a grid | `md-card` |

## Decision cues

| Need | Setting |
|---|---|
| Row identity in selection events | `value="…"` |
| Row is clickable as a whole | `clickable` (+ listen for `mdRowClick`) |
| Row is excluded from the selection totals | `selectable="false"` |
| Row reveals detail | `expandable` + content in the `expanded` slot |
| Open that detail programmatically | `expanded` or `await row.toggle()` |
| Draw attention to one row | `highlight` |
| Row is inert | `disabled` |
| Head/foot styling for a row used outside `md-table` | `rowgroup="head"` / `"foot"` |

## API contract

```html
<md-table-body>
  <md-table-row
    rowgroup="head|body|foot"   <!-- default: body; md-table stamps this -->
    value="inv-1"               <!-- default: "" -->
    selected                    <!-- default: false -->
    selectable="false"          <!-- default: true -->
    clickable                   <!-- default: false -->
    disabled                    <!-- default: false -->
    expandable                  <!-- default: false -->
    expanded                    <!-- default: false -->
    highlight                   <!-- default: false -->
  >
    <md-table-cell>Acme</md-table-cell>
    <div slot="expanded">…detail…</div>
  </md-table-row>
</md-table-body>
```

**Events** (all bubble and cross shadow boundaries) — `mdRowClick`
`{ value, row }`, `mdRowSelectionChange` `{ selected, value }`,
`mdRowExpandedChange` `{ expanded }`.

**Methods** — `toggle(): Promise<void>` — flips `expanded`. It is a no-op unless
`expandable` is set.

**Slots** — the default slot takes the `md-table-cell` children; `expanded`
takes the detail panel (rendered only when `expandable`).

**Parts** — `expanded` (the detail panel).

### Behavioral contract worth knowing

- **`rowgroup` is stamped by `md-table`** from the wrapping rowgroup, on load and
  on every slot change — you do not have to set it. Keeping it in markup is
  still worth it for head/foot rows: the prop reflects its `body` default until
  the first stamp, so explicit markup avoids a first-paint flash.
- **`value` is the row's identity** in `md-table`'s selection state. Without it
  the table falls back to the row's index *within the selected set*, which is
  unstable — always set a `value` on selectable rows.
- **`mdRowClick` only fires when `clickable` is set**, and it is suppressed for
  clicks that land on an interactive descendant (`md-checkbox`, `md-radio`,
  `md-button`, `md-icon-button`, `md-switch`, `md-fab`, `md-chip`, `button`,
  `a`, `input`, `select`, `textarea`). A `clickable` row is a tab stop
  (`tabindex="0"`) and Enter / Space activate it.
- `disabled` removes the tab stop, blocks click and key activation, sets
  `aria-disabled="true"` and kills pointer events.
- **`mdRowSelectionChange` fires on every change to `selected`, programmatic
  ones included** — the parent table uses it to coordinate selection, so in
  `selection="single"` setting `selected` on one row deselects the others.
- **`selectable="false"` excludes a body row from the selection *totals*, not
  from `selectAll()`.** It drops out of `count`, `total`, `values`, `all` and
  `indeterminate` in `mdSelectionChange` / `getSelection()`, and it stops
  carrying `aria-selected`. But `selectAll()` and the select-all checkbox still set
  `selected` on it (only `disabled` is skipped), so it *will* tick and take the
  selected background. Use `disabled` for a row that must stay unchecked under
  select-all. Head and foot rows are excluded from selection automatically; you
  do not need `selectable` there.
- The row **is a real grid box** spanning all the table's tracks, unlike the
  rowgroups, which are `display: contents`. Any direct child that is not an
  `md-table-cell` consumes a column track — put toggles, checkboxes and links
  *inside a cell*, and detail content in the `expanded` slot.
- The `expanded` panel is exposed as a full-width `role="cell"` with
  `aria-colspan` equal to the row's cell count. While collapsed it is `inert`
  and `aria-hidden`, so focusable content inside it is not tab-reachable.
- An `expandable` row carries `aria-expanded`, which is only valid inside a
  `treegrid` — `md-table` therefore promotes itself from `role="table"` to
  `role="treegrid"` as soon as any row is expandable.
- `md-table` also stamps `data-stripe`, `data-sticky`, `data-last`,
  `data-adjacent-foot`, `aria-rowindex` and `aria-selected` on rows. Those are
  the table's to write; do not set them yourself.

---

## Do / Don't

House rules, informed by the WAI table patterns — M3 has no data-table page.

| ✅ Do | ❌ Don't |
|---|---|
| Give every selectable row a stable `value` | Don't rely on DOM index for identity |
| Put detail content in the `expanded` slot | Don't inject a second row as the detail panel |
| Use `clickable` for a row-level action | Don't nest an `<a>` that wraps the whole row |
| Put interactive controls inside a cell | Don't drop them in as bare row children |
| Use `highlight` for one row at a time | Don't highlight half the table |
| Keep every row's cell count equal to the column count | Don't leave a short row — subgrid skews it |
| Pair `expandable` with an `md-table-expand-toggle` | Don't leave the disclosure state unreachable |

## Patterns

```html
<md-table id="invoices" column-template="auto 2fr 1fr" selection="multiple" label="Invoices">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head padding="checkbox"><md-checkbox></md-checkbox></md-table-cell>
      <md-table-cell head scope="col">Client</md-table-cell>
      <md-table-cell head scope="col" numeric>Amount</md-table-cell>
    </md-table-row>
  </md-table-head>

  <md-table-body>
    <md-table-row value="inv-1" clickable>
      <md-table-cell padding="checkbox"><md-checkbox></md-checkbox></md-table-cell>
      <md-table-cell>Acme Corp</md-table-cell>
      <md-table-cell numeric>$1,200</md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>

<script type="module">
  document.getElementById('invoices').addEventListener('mdRowClick', (e) => {
    console.log('open', e.detail.value);
  });
</script>
```

```html
<!-- Expandable detail row -->
<md-table column-template="auto 2fr 1fr" label="Invoices">
  <md-table-body>
    <md-table-row value="inv-1" expandable>
      <md-table-cell padding="checkbox">
        <md-table-expand-toggle></md-table-expand-toggle>
      </md-table-cell>
      <md-table-cell>Acme Corp</md-table-cell>
      <md-table-cell numeric>$1,200</md-table-cell>
      <div slot="expanded">Line items, notes, anything.</div>
    </md-table-row>
  </md-table-body>
</md-table>
```

```html
<!-- Open a detail row from code -->
<script type="module">
  const row = document.querySelector('md-table-row[expandable]');
  await customElements.whenDefined('md-table-row');
  await row.toggle();
  row.addEventListener('mdRowExpandedChange', (e) => console.log(e.detail.expanded));
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Selectable rows without `value` | Set a stable `value` | Otherwise `getSelection().values` reports positional indexes. |
| `md-table-expand-toggle` as a bare row child | Put it inside an `md-table-cell` | A non-cell child consumes a column track and skews the row. |
| Wrapping cells in a `<div>` | Cells as direct children | The subgrid only sees direct children. |
| A second row used as the detail panel | The `expanded` slot | Keeps the detail owned by, and inert with, its row. |
| `<a>` wrapping the whole row | `clickable` + `mdRowClick` | Nested interactive controls; also the row is already the tab stop. |
| Expecting `mdRowClick` from a checkbox click | Listen for the control's own event | Clicks on interactive descendants are deliberately ignored. |
| `selectable="false"` on a foot row | Nothing needed | Foot rows are already outside the selection model. |
| Setting `aria-selected` / `data-stripe` yourself | Let `md-table` stamp them | The table rewrites them on every sync. |
| Expecting a `density` prop here | Set `density` on `md-table` | Row height is the table's decision. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host is `role="row"`; its cells supply the cell and
columnheader roles. `aria-disabled` follows `disabled`, and `aria-expanded`
appears only on `expandable` rows (inside the `treegrid` the table promotes
itself to). `aria-selected` and `aria-rowindex` are written by `md-table`, only
on selectable body rows of a selection-enabled table. A `clickable` row is
keyboard-activatable and shows a 2px inset focus ring — check that a sticky
header or footer does not cover it while scrolling.

**RTL** — cell order, dividers and pinning mirror with the table; the row itself
uses logical properties throughout.

**Density** — no prop here; row height comes from `md-table`'s `density` and the
`--md-table-row-height-*` properties.

**i18n** — cell content is yours. The `expanded` panel is plain slotted content.

## Related components

`md-table` · `md-table-cell` · `md-table-head` · `md-table-body` ·
`md-table-foot` · `md-table-expand-toggle` · `md-list-item`

## Theming

The row reads two custom properties directly; everything else it inherits from
`md-table` (set the knobs there).

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-row-hover-color` | Hover state-layer color, also blended into pinned cells | `--md-sys-color-on-surface` |
| `--md-table-surface` | Opaque base behind pinned (sticky) cells | `--md-sys-color-surface` (set per variant by `md-table-container`) |

The row **casts** `--md-table-cell-sticky-bg`, `--md-table-cell-sticky-transition`
and `--md-table-cell-pin-display` down to its slotted cells so a pinned column
matches the row's stripe / selection / hover tint. Override those on
`md-table-cell`, not here — the row recomputes them per state.

**CSS parts** — `expanded` (the detail panel; style its padding or background
with `md-table-row::part(expanded)`).

```css
md-table-row::part(expanded) {
  background: var(--md-sys-color-surface-container-low);
}
```

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Row.

A row inside a `<md-table>` that contains `<md-table-cell>` children.
The host is a REAL grid box that spans the table's tracks and lays its
cells on them via `grid-template-columns: subgrid` — so row hover,
stripes, dividers, selection tint, sticky rows and focus rings all work
on the row itself, and a wrong cell count skews one row, never the table.

The parent `<md-table>` stamps context (`rowgroup`, stripe parity,
stickiness) onto the row; the row casts typography/color context down to
its cells with `::slotted()` custom properties — no observers.

Behaviors:
- `selected` — selection state (visual + ARIA)
- `disabled` — non-interactive
- `clickable` — adds keyboard activation (Enter / Space) + emits `mdRowClick`
- `expandable` — toggles an "expanded details" zone (use the `expanded` slot),
  spring-animated via the grid-rows height pattern

## Properties

| Property     | Attribute    | Description                                                                                                                                                       | Type                         | Default  |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- |
| `clickable`  | `clickable`  | When true, treat the entire row as a button (Enter/Space activates `mdRowClick`).                                                                                 | `boolean`                    | `false`  |
| `disabled`   | `disabled`   | Disabled — row receives no hover/click handlers.                                                                                                                  | `boolean`                    | `false`  |
| `expandable` | `expandable` | Render an "expandable details" zone toggleable via `toggle()`.                                                                                                    | `boolean`                    | `false`  |
| `expanded`   | `expanded`   | Whether the expandable zone is open.                                                                                                                              | `boolean`                    | `false`  |
| `highlight`  | `highlight`  | Highlights the row using primary-container (e.g. for the focused row).                                                                                            | `boolean`                    | `false`  |
| `rowgroup`   | `rowgroup`   | Which rowgroup this row belongs to. Stamped automatically by the parent `<md-table>` (head / body / foot) — set it manually only when using rows outside a table. | `"body" \| "foot" \| "head"` | `'body'` |
| `selectable` | `selectable` | Whether this row counts as selectable (used by `<md-table>` selection coordination).                                                                              | `boolean`                    | `true`   |
| `selected`   | `selected`   | Selected (highlighted) state. Reflected.                                                                                                                          | `boolean`                    | `false`  |
| `value`      | `value`      | Identifier attached to selection / click events. Defaults to row index.                                                                                           | `string`                     | `''`     |


## Events

| Event                  | Description                                                                                | Type                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `mdRowClick`           | Fired when the user clicks (or Enter/Space-activates) the row.                             | `CustomEvent<{ value: string; row: HTMLElement; }>`  |
| `mdRowExpandedChange`  | Fired when the row's expanded state changes.                                               | `CustomEvent<{ expanded: boolean; }>`                |
| `mdRowSelectionChange` | Fired when the `selected` state changes (used by `<md-table>` for selection coordination). | `CustomEvent<{ selected: boolean; value: string; }>` |


## Methods

### `toggle() => Promise<void>`

Toggle the expanded zone.

#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part         | Description |
| ------------ | ----------- |
| `"expanded"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
