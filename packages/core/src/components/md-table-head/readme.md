# md-table-head

<!-- llm:meta
tag: md-table-head
category: data
status: sub-component
parent: md-table
standalone: false
m3-guidelines: none — M3 has no data-table page
form-associated: false
depends-on: none
used-by: none
accepts-children: md-table-row
-->

**The column-header rowgroup — `<thead>` for `md-table`.** A marker element that
groups the header row(s). `md-table` reads it to decide which rows are header
rows, and in `frozen-header` mode projects it into the separate header grid.
It has no props and no box of its own.

> 🧩 **Sub-component.** Only valid inside `md-table`.

---

## When to use

- Wrapping the header row(s) of a hand-authored `md-table` — the parent that
  owns it is `md-table`.

## When NOT to use

| Situation | Use instead |
|---|---|
| Body rows | `md-table-body` |
| Footer / totals rows | `md-table-foot` |
| A toolbar above the table | `md-table-toolbar` |

## API contract

```html
<md-table column-template="2fr 1fr" label="Invoices">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">Name</md-table-cell>
      <md-table-cell head scope="col" numeric>Amount</md-table-cell>
    </md-table-row>
  </md-table-head>
</md-table>
```

**No props, events, methods or CSS parts.** It is a marker element.

**Slots** — one unnamed default slot; put `md-table-row` elements in it.

### Behavioral contract worth knowing

- It renders with **`display: contents`**, so its rows land directly on the
  table's grid tracks. It is not a box you can size, pad or make sticky, and its
  own stylesheet sets nothing else.
- **`md-table` stamps `rowgroup="head"` on every row inside it** (on load and on
  every slot change), so the rows style and announce as header rows. Writing
  `rowgroup="head"` yourself is still worth it: the row reflects its `body`
  default until the table's first stamp, so explicit markup avoids a
  first-paint flash of body styling.
- **The header surface is painted by the rows**, not by this element — a head
  row's background comes from `--md-table-head-bg` via `md-table`.
- Header semantics come from the cells: set `head` and `scope="col"` on each
  `md-table-cell`. The wrapper does not confer them.
- With `frozen-header` on the table, `md-table` sets `slot="head"` on this
  element itself so it renders in the separate header grid. **Never set
  `slot="head"` by hand** — the table adds and removes it as the prop changes.
- Internally it relays its shadow `slotchange` as a bubbling
  `mdRowgroupSlotChange` event so `md-table` notices row reorders (`slotchange`
  is not composed). That is plumbing; you do not listen to it.

---

## Do / Don't

House rules, informed by the WAI table patterns — M3 has no data-table page.

| ✅ Do | ❌ Don't |
|---|---|
| Wrap header rows in `md-table-head` | Don't leave header rows loose in the table |
| Set `head` + `scope="col"` on the cells | Don't rely on position to imply "header" |
| Let `md-table` own stickiness (`sticky-header` / `frozen-header`) | Don't try to make this element sticky yourself |
| Keep it to header rows | Don't put body rows in it |
| Let it stay `display: contents` | Don't give it padding, borders or a height |
| Use `scope="colgroup"` on a spanning group header | Don't leave grouped columns unscoped |

## Patterns

```html
<md-table column-template="2fr 1fr" sticky-header label="Invoices">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">
        <md-table-sort-label column="name">Name</md-table-sort-label>
      </md-table-cell>
      <md-table-cell head scope="col" numeric>Amount</md-table-cell>
    </md-table-row>
  </md-table-head>
  <md-table-body>
    <md-table-row value="inv-1">
      <md-table-cell>Acme Corp</md-table-cell>
      <md-table-cell numeric>$1,200</md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

```html
<!-- Two header rows (grouped columns) -->
<md-table-head>
  <md-table-row rowgroup="head">
    <md-table-cell head scope="colgroup" colspan="2">Q1</md-table-cell>
  </md-table-row>
  <md-table-row rowgroup="head">
    <md-table-cell head scope="col">Jan</md-table-cell>
    <md-table-cell head scope="col">Feb</md-table-cell>
  </md-table-row>
</md-table-head>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Styling `md-table-head` with padding or a border | Style the cells | It is `display: contents` — it has no box. |
| Omitting `head` / `scope` on header cells | Set both | Otherwise they announce as ordinary cells. |
| Making this element `position: sticky` | Use the table's `sticky-header` | The table owns pinning. |
| Setting `slot="head"` on it yourself | Set `frozen-header` on `md-table` | The table assigns and removes that slot. |
| Body rows inside the head | `md-table-body` | Wrong region and wrong styling. |
| Looking for props | It has none | Marker element by design. |

## Accessibility, RTL, density, i18n

**Accessibility** — the element carries `role="rowgroup"`. The header semantics
themselves come from the cells (`head` + `scope`), and the rows are stamped
`rowgroup="head"` by `md-table`. For grouped columns use `scope="colgroup"` on
the spanning cell. When a column is sortable, put an `md-table-sort-label`
inside the cell — the table mirrors `aria-sort` onto the cell for you.

**RTL** — nothing of its own; column order mirrors with the table.

**Density** — nothing of its own; header height follows `md-table`
(`--md-table-header-height`).

**i18n** — header text is your content.

## Related components

`md-table` · `md-table-body` · `md-table-foot` · `md-table-row` ·
`md-table-cell` · `md-table-sort-label`

## Theming

No custom properties of its own — its stylesheet only sets `display: contents`.
The header band is themed on `md-table` / `md-table-container`:

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-head-bg` | Header row background | `--md-sys-color-surface-container` |
| `--md-table-head-color` | Header text color | `--md-sys-color-on-surface-variant` |
| `--md-table-header-height` | Header row height | `max(40px, 56px + density scale × 4px)` |

**CSS parts** — none.

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Head (`<thead>`).

Pure presentational rowgroup used to mark a region of column-header rows.
Paints nothing itself — the head surface comes from the rows — and ensures
children flow into the parent `<md-table>`'s CSS Grid via `display: contents`.

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
