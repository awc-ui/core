# md-table-foot

<!-- llm:meta
tag: md-table-foot
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

**The summary rowgroup — `<tfoot>` for `md-table`.** A marker element that groups
totals and aggregate rows. `md-table` reads it to give those rows the footer
surface and its own top divider, and to keep them out of the selection model.
It has no author-settable props and no box of its own.

> 🧩 **Sub-component.** Only valid inside `md-table`.

---

## When to use

- **Totals, subtotals or aggregate** rows that summarise the body above — the
  parent that owns it is `md-table`.
- A summary row that should stay visible while the body scrolls
  (`sticky-footer` on `md-table`).

## When NOT to use

| Situation | Use instead |
|---|---|
| Data rows | `md-table-body` |
| Header rows | `md-table-head` |
| Pagination | `md-table-pagination` in `md-table-container`'s `bottom` slot |
| Table-level actions | `md-table-toolbar` |
| A caption or note | `md-table`'s `caption` / `summary` |

## API contract

```html
<md-table sticky-footer column-template="2fr 1fr" label="Invoices">
  <md-table-foot>
    <md-table-row rowgroup="foot">
      <md-table-cell head scope="row">Total</md-table-cell>
      <md-table-cell numeric>$4,320.00</md-table-cell>
    </md-table-row>
  </md-table-foot>
</md-table>
```

**No author-settable props, no events, no methods and no CSS parts.**

**Slots** — one unnamed default slot; put `md-table-row` elements in it.

**Internal props — never set these by hand:** `presentational`. `md-table`
stamps it in `frozen-header` mode, where the foot renders inside a wrapper that
is already the `role="rowgroup"`; the attribute drops this element to
`role="presentation"` so rowgroups do not nest. Setting or removing it yourself
desynchronises the ARIA tree.

### Behavioral contract worth knowing

- **`display: contents`** — the rows land on the table's own grid tracks; this
  element is not a box you can size, pad or make sticky.
- **Foot rows are never part of selection.** `md-table` computes its selection
  model over rows that are not inside `md-table-head` or `md-table-foot`, so
  `selectAll()` and `getSelection()` skip a totals row automatically —
  `selectable="false"` is not needed here.
- `md-table` stamps `rowgroup="foot"` on every row inside it, on load and on
  every slot change. Keeping `rowgroup="foot"` in your markup is still worth it:
  the row reflects its `body` default until the first stamp, so explicit markup
  avoids a first-paint flash of body styling.
- The foot row draws the **divider above itself** (`border-block-start`) and the
  table drops the last body row's bottom divider so the two never double up.
- Sticky behaviour comes from `md-table`'s `sticky-footer`, not from here.
- Pagination is **not** a footer row — it belongs in `md-table-container`'s
  `bottom` slot, outside the scroll region, where the container can also bracket
  page changes with the table's FLIP motion.
- Internally it relays its shadow `slotchange` as a bubbling
  `mdRowgroupSlotChange` event so `md-table` notices row changes (`slotchange`
  is not composed). That is plumbing; you do not listen to it.

---

## Do / Don't

House rules, informed by the WAI table patterns — M3 has no data-table page.

| ✅ Do | ❌ Don't |
|---|---|
| Use it for totals and aggregates | Don't put ordinary data rows in the foot |
| Label the total with a `head scope="row"` cell | Don't leave the aggregate unlabelled |
| Use `md-table`'s `sticky-footer` to keep it visible | Don't try to make this element sticky |
| Keep footer columns aligned with the body | Don't change a column's meaning in the footer |
| Put pagination in the container's `bottom` slot | Don't fake pagination as a footer row |
| Use `numeric` on aggregate figures | Don't misalign totals against their column |
| Let it stay `display: contents` | Don't give it padding, borders or a height |

## Patterns

```html
<md-table column-template="2fr 1fr" sticky-footer label="Invoices">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">Client</md-table-cell>
      <md-table-cell head scope="col" numeric>Amount</md-table-cell>
    </md-table-row>
  </md-table-head>

  <md-table-body>
    <md-table-row value="1">
      <md-table-cell>Acme</md-table-cell>
      <md-table-cell numeric>$1,200</md-table-cell>
    </md-table-row>
    <md-table-row value="2">
      <md-table-cell>Globex</md-table-cell>
      <md-table-cell numeric>$3,120</md-table-cell>
    </md-table-row>
  </md-table-body>

  <md-table-foot>
    <md-table-row rowgroup="foot">
      <md-table-cell head scope="row">Total</md-table-cell>
      <md-table-cell numeric>$4,320</md-table-cell>
    </md-table-row>
  </md-table-foot>
</md-table>
```

```html
<!-- Keep the total in sync with the selection -->
<md-table id="invoices" column-template="2fr 1fr" selection="multiple" label="Invoices">
  <md-table-body>
    <md-table-row value="a"><md-table-cell><md-checkbox></md-checkbox> Acme</md-table-cell><md-table-cell numeric>1200</md-table-cell></md-table-row>
    <md-table-row value="b"><md-table-cell><md-checkbox></md-checkbox> Globex</md-table-cell><md-table-cell numeric>3120</md-table-cell></md-table-row>
  </md-table-body>
  <md-table-foot>
    <md-table-row rowgroup="foot">
      <md-table-cell head scope="row">Selected total</md-table-cell>
      <md-table-cell numeric id="total">0</md-table-cell>
    </md-table-row>
  </md-table-foot>
</md-table>

<script type="module">
  const table = document.getElementById('invoices');
  const amounts = { a: 1200, b: 3120 };
  table.addEventListener('mdSelectionChange', (e) => {
    document.getElementById('total').textContent = e.detail.values
      .reduce((sum, v) => sum + (amounts[v] ?? 0), 0);
  });
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Adding `selectable="false"` to keep a totals row out of select-all | Just put it in `md-table-foot` | `selectable="false"` does not stop `selectAll()` anyway; foot rows are outside the selection model entirely. |
| Pagination as a footer row | Container's `bottom` slot | It would land on the table's grid tracks and scroll with the rows. |
| Padding or borders on `md-table-foot` | Style the cells | It is `display: contents` — it has no box. |
| `position: sticky` here | `sticky-footer` on `md-table` | The table owns pinning. |
| Setting `presentational` yourself | Leave it alone | It is internal; `md-table` owns it in frozen mode. |
| Data rows in the foot | `md-table-body` | They would lose hover, striping and selection. |
| A footer with a different column meaning | Keep the columns aligned | The summary stops being readable. |

## Accessibility, RTL, density, i18n

**Accessibility** — the element carries `role="rowgroup"` (or
`role="presentation"` in `frozen-header` mode, where the table's scroll wrapper
is the rowgroup instead), so a screen reader can distinguish summary rows from
data rows. A `head scope="row"` cell on the label ("Total") associates the
aggregate with its row. Foot rows never receive `aria-selected`, because they
are outside the selection model.

**RTL** — nothing of its own; the table mirrors.

**Density** — nothing of its own; foot rows use the table's body row height.

**i18n** — the totals text is your content; format numbers with `Intl.NumberFormat`.

## Related components

`md-table` · `md-table-head` · `md-table-body` · `md-table-row` ·
`md-table-cell` · `md-table-pagination` · `md-table-container`

## Theming

No custom properties of its own — its stylesheet only sets `display: contents`.
The footer band is themed on `md-table`:

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-foot-bg` | Footer row background | `--md-sys-color-surface-container-low` |
| `--md-table-divider-color` | The rule above the footer | `--md-sys-color-outline-variant` |

**CSS parts** — none.

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Foot (`<tfoot>`).

Pure presentational rowgroup for footer rows (totals, summaries).
Children flow into the parent grid via `display: contents`.

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
