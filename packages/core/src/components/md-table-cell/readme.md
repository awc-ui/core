# md-table-cell

<!-- llm:meta
tag: md-table-cell
category: data
status: sub-component
parent: md-table-row
standalone: false
m3-guidelines: none — M3 has no data-table page
form-associated: false
depends-on: none
used-by: none
-->

**One cell of an `md-table`.** Renders as a data cell, a column header or a row
header depending on `head` and `scope`, with alignment, spanning, sticky
pinning and truncation options. It is a dumb surface: row state (selected,
disabled, header) arrives as inherited CSS custom properties cast by
`md-table-row`.

> 🧩 **Sub-component.** Only valid inside `md-table-row`.

---

## When to use

- Every cell of a hand-authored `md-table`, header cells included.

## When NOT to use

| Situation | Use instead |
|---|---|
| A list row's content | `md-list-item` |
| A layout box | CSS Grid / flex |

## Decision cues

| Need | Setting |
|---|---|
| Column header | `head` + `scope="col"` |
| Row header (first column identifies the row) | `head` + `scope="row"` |
| Numbers | `numeric` (aligns and tabular-figures them) |
| Checkbox column | `padding="checkbox"` |
| Edge-to-edge content (an image) | `padding="none"` |
| Pinned column | `sticky="start"` / `"end"` |
| Span columns/rows | `colspan` / `rowspan` |
| Truncate long text | `ellipsis` (plus `min-width="0"` on `md-table` when the column track is content-sized) |
| Secondary/meta text | `variant="meta"` |
| Hide the pin badge on a pinned header | `no-pin-indicator` |

## API contract

```html
<md-table-row>
  <md-table-cell
    head                            <!-- default: false -->
    scope="col|row|colgroup|rowgroup"     <!-- default: "" -->
    align="start|center|end|justify"      <!-- default: start -->
    numeric                         <!-- default: false -->
    padding="default|none|checkbox"       <!-- default: default -->
    sticky="start|end"              <!-- default: "" (not sticky) -->
    colspan="1" rowspan="1"         <!-- default: 1 / 1 -->
    ellipsis                        <!-- default: false -->
    variant="body|meta"             <!-- default: body -->
    no-pin-indicator                <!-- default: false -->
    pin-icon=""                     <!-- default: "" (built-in push-pin SVG) -->
    density="-1|-2|-3|-4"           <!-- default: 0 = no local rung -->
  >Ada Lovelace</md-table-cell>
</md-table-row>
```

**Events** — none. **Methods** — none.

**Slots** — the default (unnamed) slot: the cell's content.

**Parts** — `content` (the text wrapper), `pin` (the pinned-column badge, only
rendered while it is shown).

### Behavioral contract worth knowing

- **`head` + `scope` is what makes a cell a header.** `head` switches the host
  `role` to `columnheader`; `scope="row"` or `scope="rowgroup"` makes it
  `rowheader` instead. `scope` reflects onto the host whether or not `head` is
  set, but on its own it changes nothing: a cell without `head` stays
  `role="cell"`, so don't put `scope` on a body cell.
- `colspan` / `rowspan` above 1 set `grid-column: span N` / `grid-row: span N`
  **and** mirror to `aria-colspan` / `aria-rowspan`. The attribute names are
  the HTML-style all-lowercase `colspan` / `rowspan` (the JS properties are
  `colSpan` / `rowSpan`).
- `numeric` does more than align to the end — it applies `tabular-nums` so
  columns of numbers line up.
- **A pinned header cell grows a pin badge automatically.** It renders when
  `head` and `sticky` are both set, `padding` is not `checkbox`, and
  `no-pin-indicator` is not set. `pin-icon` swaps the built-in SVG for a
  Material Symbols ligature; `md-table`'s own `pin-icon` prop casts that value
  down to every pinned header cell, so set it there rather than per cell.
- A `sticky` cell is **already opaque**: `md-table-row` casts
  `--md-table-cell-sticky-bg` down to it (stripe-aware), falling back to
  `--md-sys-color-surface`. Override it only when the surface behind the table
  is not the standard one.
- **`ellipsis` needs a column that can't grow.** The cell host and its content
  wrapper already carry `min-inline-size: 0`, so `ellipsis` truncates as-is in
  a **fixed** track — `column-template="120px 1fr"` truncates the 120px column
  with no other setting. It is content-sized tracks (`auto`, `fr`,
  `max-content`, and the derived template you get with no `column-template`)
  that never truncate: `md-table` defaults the grid to
  `min-inline-size: max-content` ("scroll, don't squish"), so the track just
  widens and the table overflows horizontally instead. For those, add
  `min-width="0"` on the parent `md-table` to let the grid shrink below its
  max-content width — that switches the **whole** table from scrolling to
  squishing, so prefer a fixed track for the one column you want truncated.
- Header cells never wrap: `head` forces `white-space: nowrap` on the content,
  so a long header widens the column rather than growing the row.
- `padding="none"` removes all padding; `padding="checkbox"` keeps a 4px
  inline-start inset and centres the control.
- `data-md-col-hidden` is stamped on cells by `md-table`'s
  `setColumnVisibility()` and hides them with `display: none`. It is internal —
  never set it by hand.

---

## Do / Don't

House rules — M3 has no data-table guidelines page.

| ✅ Do | ❌ Don't |
|---|---|
| Set `head` **and** `scope` on header cells | Don't style a body cell to look like a header |
| Use `scope="row"` on the identifying first column | Don't leave row headers as plain cells |
| Use `numeric` on number columns | Don't left-align numbers or mix figure widths |
| Let the row cast the pinned background | Don't force a transparent background on a sticky cell |
| Provide the full text when using `ellipsis` | Don't truncate with no way to see the rest |
| Use `padding="checkbox"` for the selection column | Don't leave default padding around a checkbox |
| Keep cell content short | Don't put paragraphs in a cell |
| Use `variant="meta"` for secondary text | Don't shrink text with ad-hoc CSS |

## Patterns

```html
<md-table column-template="48px 2fr 1fr 1fr" sticky-header>
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col" padding="checkbox"></md-table-cell>
      <md-table-cell head scope="col" sticky="start">Name</md-table-cell>
      <md-table-cell head scope="col" numeric>Amount</md-table-cell>
      <md-table-cell head scope="col">Status</md-table-cell>
    </md-table-row>
  </md-table-head>

  <md-table-body>
    <md-table-row value="1">
      <md-table-cell padding="checkbox">
        <md-checkbox aria-label="Select Acme Corporation"></md-checkbox>
      </md-table-cell>
      <md-table-cell head scope="row" sticky="start">Acme Corporation</md-table-cell>
      <md-table-cell numeric>$1,200.00</md-table-cell>
      <md-table-cell><md-chip label="Paid" color="success"></md-chip></md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

```html
<!-- Truncation with the full value still reachable.
     The track here is `1fr` (content-sized), so min-width="0" on the table is
     required: without it the column keeps its max-content width and `ellipsis`
     has nothing to cut. A fixed track (e.g. column-template="240px") truncates
     without it. -->
<md-table min-width="0" column-template="1fr">
  <md-table-body>
    <md-table-row>
      <md-table-cell ellipsis>
        <md-tooltip text="A very long description that is truncated in the cell">
          <span>A very long description that is truncated in the cell</span>
        </md-tooltip>
      </md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

```html
<!-- Spanning: an empty-state row across every column -->
<md-table column-template="2fr 1fr 1fr">
  <md-table-body>
    <md-table-row>
      <md-table-cell colspan="3" align="center" variant="meta">No results</md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `head` without `scope` | Set both | Without `scope` the header isn't associated with its column or row. |
| Bold CSS instead of `head` | Use the prop | Styling isn't semantics — `head` is what sets `role="columnheader"`. |
| Left-aligned numbers | `numeric` | Alignment plus tabular figures. |
| `col-span="2"` | `colspan="2"` | The attribute is all-lowercase, matching HTML. |
| `ellipsis` on a content-sized (`auto` / `fr`) column | Give that column a fixed track, or set `min-width="0"` on `md-table` | A content-sized track widens to fit, so nothing truncates. |
| `ellipsis` with no other access to the text | Add a tooltip or an expandable row | Truncation alone loses information. |
| A paragraph inside a cell | Summarise; put detail in the expanded row | Rows become unreadable. |
| `md-table-cell` outside `md-table-row` | Nest it in a row | There is no grid track to occupy. |
| Setting `data-md-col-hidden` by hand | Call `md-table.setColumnVisibility()` | The table owns column visibility and the grid template. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host carries `role="cell"`, or `columnheader` /
`rowheader` once `head` (and `scope`) are set; that pairing is what lets a
screen reader announce "Amount, $1,200" rather than a bare value. A checkbox in
a selection cell needs a row-specific `aria-label` ("Select Acme Corporation"),
not a generic "Select". Truncated (`ellipsis`) content must be available
another way. `aria-sort` is written onto the header **cell** by `md-table`
when the cell contains an `md-table-sort-label` — don't set it yourself.

**RTL** — `align="start"/"end"` and `sticky="start"/"end"` are logical and
mirror automatically; padding uses logical properties throughout.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung; rung 0 is the uncompacted default and has no rule of its own. Cells
normally inherit the rung from `md-table`, so set it there.

**i18n** — cell content is yours; translated text widens columns, so prefer
`fr` tracks plus `ellipsis` and a tooltip over fixed widths (an `fr` track needs
`min-width="0"` on `md-table` before `ellipsis` bites). The pin badge's
native `title` ("Pinned left" / "Pinned right") is fixed English, but it is
`aria-hidden` and never announced.

## Related components

`md-table-row` · `md-table` · `md-table-head` · `md-table-body` ·
`md-table-sort-label` · `md-table-expand-toggle` · `md-checkbox` · `md-chip` ·
`md-tooltip`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-cell-color` | Text colour | Cast by `md-table-row`, else `inherit` |
| `--md-table-cell-background` | Cell background | `transparent` |
| `--md-table-cell-padding-inline` | Horizontal padding | Cast by `md-table`, else `16px` |
| `--md-table-cell-padding-block` | Vertical padding | Cast by `md-table`, else `8px` |
| `--md-table-cell-min-height` | Minimum cell height | Cast by the row/table, else `52px` |
| `--md-table-cell-sticky-bg` | Pinned-cell background | Cast by `md-table-row` (stripe-aware), else `--md-sys-color-surface` |
| `--md-table-cell-sticky-transition` | Pinned-cell background transition | `150ms` effects spring |
| `--md-table-cell-pin-display` | Pin badge `display` | `inline-flex` |
| `--md-table-cell-pin-color` | Pin badge colour | `--md-sys-color-primary` |
| `--md-table-cell-pin-size` | Pin badge box | `16px` (SVG) / `14px` (ligature) |

**CSS parts** — `content`, `pin`.

```css
/* A quieter, tighter meta column. */
md-table-cell.audit-trail {
  --md-table-cell-color: var(--md-sys-color-on-surface-variant);
  --md-table-cell-padding-inline: 8px;
}
```

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Cell.

The visual surface for a single grid cell. Renders as either a `cell`
(default) or `columnheader` / `rowheader` based on `head` / `scope`.

Props are intentionally MUI-compatible:
  - `align="start" | "center" | "end" | "justify"`
  - `numeric` (right-aligns + tabular numbers)
  - `padding="none" | "checkbox" | "default"`
  - `head` (renders as `<th>` semantics with `scope="col"|"row"`)
  - `sticky="start" | "end"` (sticky first / last column)
  - `colspan` / `rowspan` (grid spans)

The cell is a dumb surface: row state (selected / disabled / header
context) arrives as inherited CSS custom properties cast by
`<md-table-row>` — no observers, no DOM queries.

## Properties

| Property         | Attribute          | Description                                                                                                                                                                                                                                                                  | Type                                               | Default     |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| `align`          | `align`            | Text alignment within the cell.                                                                                                                                                                                                                                              | `"center" \| "end" \| "justify" \| "start"`        | `'start'`   |
| `colSpan`        | `colspan`          | Number of columns this cell spans (CSS Grid `grid-column: span N`).                                                                                                                                                                                                          | `number`                                           | `1`         |
| `density`        | `density`          | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                        | `-1 \| -2 \| -3 \| -4 \| 0`                        | `0`         |
| `ellipsis`       | `ellipsis`         | Disable text-wrap (single-line, ellipsis).                                                                                                                                                                                                                                   | `boolean`                                          | `false`     |
| `head`           | `head`             | Render as a column / row header.                                                                                                                                                                                                                                             | `boolean`                                          | `false`     |
| `noPinIndicator` | `no-pin-indicator` | Suppress the automatic pin indicator that a sticky header cell shows. By default a frozen (sticky) column always advertises that it's pinned with a small pin icon in its header; set this to opt out (e.g. a sticky checkbox column — which is auto-skipped anyway).        | `boolean`                                          | `false`     |
| `numeric`        | `numeric`          | Right-align + tabular figures (for monetary / numeric data).                                                                                                                                                                                                                 | `boolean`                                          | `false`     |
| `padding`        | `padding`          | Padding mode (MUI parity).                                                                                                                                                                                                                                                   | `"checkbox" \| "default" \| "none"`                | `'default'` |
| `pinIcon`        | `pin-icon`         | Custom pin-indicator icon: a Material Symbols ligature (e.g. "anchor", "keep"). Empty = the built-in 45° push-pin SVG. Usually set ONCE on md-table via its `pin-icon` prop, which casts the value to every pinned header cell; setting it here directly overrides the cast. | `string`                                           | `''`        |
| `rowSpan`        | `rowspan`          | Number of rows this cell spans (CSS Grid `grid-row: span N`).                                                                                                                                                                                                                | `number`                                           | `1`         |
| `scope`          | `scope`            | Header scope (used when `head` is true).                                                                                                                                                                                                                                     | `"" \| "col" \| "colgroup" \| "row" \| "rowgroup"` | `''`        |
| `sticky`         | `sticky`           | Sticky positioning — `start` for first column, `end` for last column.                                                                                                                                                                                                        | `"" \| "end" \| "start"`                           | `''`        |
| `variant`        | `variant`          | Optional content variant: `body` \| `meta` (smaller, dimmer).                                                                                                                                                                                                                | `"body" \| "meta"`                                 | `'body'`    |


## Shadow Parts

| Part        | Description |
| ----------- | ----------- |
| `"content"` |             |
| `"pin"`     |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
