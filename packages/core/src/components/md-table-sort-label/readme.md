# md-table-sort-label

<!-- llm:meta
tag: md-table-sort-label
category: data
status: sub-component
parent: md-table-cell
standalone: false
m3-guidelines: none — M3 has no data-table page
form-associated: false
depends-on: none
used-by: none
-->

**The sortable-column affordance.** Goes inside a header cell, shows the
current sort direction, and emits a **request** to sort — the parent `md-table`
turns that request into sort state and hands it back.

> 🧩 **Sub-component.** Lives inside an `md-table-cell head scope="col"`.

---

## When to use

- Marking a column of `md-table` as sortable and showing its current direction.

## When NOT to use

| Situation | Use instead |
|---|---|
| A filter control | `md-select` / `md-chip` in the toolbar |
| A general button | `md-button` / `md-icon-button` |
| A non-sortable header | Plain header cell content |

## Decision cues

| Need | Setting |
|---|---|
| Identify the column in the event | `column="amount"` (required) |
| Newest/largest first on the first click | `default-order="desc"` |
| Arrow before the label | `icon-position="start"` |
| A different glyph | `icon="north"` (any Material Symbols ligature) |
| Show the header but remove the affordance | `disabled` |

## API contract

```html
<md-table-cell head scope="col">
  <md-table-sort-label
    column="name"                 <!-- default: "" — required, no column = no event -->
    default-order="asc|desc"      <!-- default: asc -->
    icon-position="start|end"     <!-- default: end -->
    icon=""                       <!-- default: "" (built-in SVG arrow) -->
    active                        <!-- default: false — pushed by md-table -->
    order="asc|desc|none"         <!-- default: none — pushed by md-table -->
    disabled                      <!-- default: false -->
    density="-1|-2|-3|-4"         <!-- default: 0 = no local rung -->
  >Name</md-table-sort-label>
</md-table-cell>
```

**Events** — `mdSortRequest` `{ column, defaultOrder }`, bubbling and composed.
Inside an `md-table` it is **consumed there** (`stopPropagation`), so nothing
above the table sees it; listen for the table's `mdSortChange` instead.

**Methods** — none.

**Slots** — the default (unnamed) slot: the column label.

**Parts** — `label` (the text), `icon` (the arrow).

### Behavioral contract worth knowing

- **It requests; `md-table` decides.** On click (or `Enter` / `Space`) the label
  emits `mdSortRequest`. The enclosing `md-table` catches it, computes the next
  order, updates its own `sort-by` / `sort-order`, and **pushes `active` and
  `order` back into every sort label** — you never set them by hand inside a
  table.
- **The cycle is three-state**, starting from `default-order`: e.g. with
  `default-order="asc"` a column goes `asc → desc → none`, and `none` clears
  the table's `sort-by` to `""`. The table then emits
  `mdSortChange` `{ column, order }` — `column` is `""` when `order` is
  `"none"`.
- **You still do the sorting.** `mdSortChange` is where you reorder your rows;
  the table only tracks and displays the state.
- Reorder **synchronously** inside the `mdSortChange` handler: the table
  captures row positions before emitting and plays the FLIP animation right
  after, so an async mutation settles as a no-op (and no
  `animateNextChange()` call is needed for this path).
- `aria-sort` is written by `md-table` onto the enclosing **`md-table-cell`**,
  not onto the label — the label's `role="button"` ignores it. Sortable but
  inactive columns get `aria-sort="none"`.
- Outside an `md-table`, nothing consumes the event: `mdSortRequest` bubbles to
  you and `active` / `order` become display state you own.
- **The arrow is hidden at rest.** It fades in at 60% opacity on hover or
  keyboard focus of a sortable column, and stays fully opaque and tinted with
  `--md-table-sort-label-active-color` while the column is `active`.
  `order="desc"` rotates it 180°, and the rotation applies to a custom `icon`
  too — so pick an "ascending-pointing" glyph.
- `column=""` makes the label inert: the click handler returns without emitting.
- `disabled` removes pointer events, drops the host to `tabindex="-1"`, and
  sets `aria-disabled="true"`, while the label text stays readable.

---

## Do / Don't

House rules — M3 has no data-table guidelines page.

| ✅ Do | ❌ Don't |
|---|---|
| Give every sortable column a `column` key | Don't rely on the label text as the key |
| Sort your rows in the table's `mdSortChange` | Don't try to sort in `mdSortRequest` inside a table |
| Reorder synchronously in the handler | Don't `await` before mutating — the animation is lost |
| Let `md-table` own `active` / `order` | Don't fight it by setting them yourself |
| Use `default-order="desc"` for dates and amounts | Don't make the first click on a date column ascending |
| Only add it to genuinely sortable columns | Don't put a sort affordance on a column you can't sort |
| Keep the label text the column name | Don't append "(sortable)" to the label |
| Put it inside `md-table-cell head scope="col"` | Don't drop it straight into a row |

## Patterns

```html
<!-- Inside a table: md-table owns the state, you own the data. -->
<md-table id="grid" column-template="2fr 1fr" label="Invoices">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">
        <md-table-sort-label column="name">Name</md-table-sort-label>
      </md-table-cell>
      <md-table-cell head scope="col" numeric>
        <md-table-sort-label column="amount" default-order="desc">Amount</md-table-sort-label>
      </md-table-cell>
    </md-table-row>
  </md-table-head>
  <md-table-body id="rows"></md-table-body>
</md-table>

<script type="module">
  const grid = document.getElementById('grid');
  const rows = document.getElementById('rows');

  const DATA = [
    { name: 'Acme Corporation', amount: 1200 },
    { name: 'Globex', amount: 340 },
    { name: 'Initech', amount: 8800 },
  ];

  function render(list) {
    rows.innerHTML = list
      .map((r) => `<md-table-row value="${r.name}">` +
                  `<md-table-cell head scope="row">${r.name}</md-table-cell>` +
                  `<md-table-cell numeric>${r.amount}</md-table-cell></md-table-row>`)
      .join('');
  }

  // Synchronous: the table brackets this call with its row animation.
  grid.addEventListener('mdSortChange', (e) => {
    const { column, order } = e.detail;
    if (order === 'none' || !column) return render(DATA);
    const dir = order === 'asc' ? 1 : -1;
    render([...DATA].sort((a, b) => (a[column] > b[column] ? dir : -dir)));
  });

  render(DATA);
</script>
```

```html
<!-- Set the sort programmatically (e.g. restoring a saved view). -->
<script type="module">
  const grid = document.getElementById('grid');
  await customElements.whenDefined('md-table');
  await grid.setSort('amount', 'desc');   // updates the labels and emits mdSortChange
</script>
```

```html
<!-- Standalone: no md-table, so you own active/order. -->
<md-table-sort-label id="lbl" column="name">Name</md-table-sort-label>

<script type="module">
  const lbl = document.getElementById('lbl');
  lbl.addEventListener('mdSortRequest', (e) => {
    const { defaultOrder } = e.detail;
    lbl.order = lbl.active && lbl.order === defaultOrder
      ? (defaultOrder === 'asc' ? 'desc' : 'asc')
      : defaultOrder;
    lbl.active = true;
  });
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Expecting the label to sort the table | Sort your data in `mdSortChange` | It only emits a request; the table only tracks state. |
| Setting `active` / `order` yourself inside a table | Let `md-table` push them | The table overwrites them on the next sync. |
| Listening for `mdSortRequest` above `md-table` | Listen for `mdSortChange` | The table calls `stopPropagation()`, so no ancestor ever sees it. (A listener on the `md-table` node itself does still fire — but it carries the raw request, not the order the table resolved.) |
| `await fetch(...)` before reordering the rows | Reorder synchronously, then update async | The FLIP animation settles as a no-op. |
| Calling `animateNextChange()` around a sort | Nothing — it's automatic | The table already brackets `mdSortChange`. |
| Using the label text as the sort key | Set `column` | Labels are translated; keys aren't. |
| Leaving `column` empty | Always set it | An empty `column` emits nothing at all. |
| Two labels `active` at once | Exactly one | Ambiguous sort state (the table enforces this itself). |
| Setting `aria-sort` on the label | Leave it to `md-table` | It belongs on the columnheader cell. |
| A sort label on an unsortable column | Remove it | It promises behaviour you don't have. |
| `md-table-sort-label` as a direct row child | Put it in `md-table-cell head scope="col"` | Rows are grid containers — a bare child eats a column track. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host is `role="button"` with `tabindex="0"`, activated
by click, `Enter` and `Space`. Its slotted text is the accessible name, so keep
it the column's name. A visually hidden `aria-live="polite"` region inside the
component announces "sorted ascending" / "sorted descending" when the column
becomes active, and `md-table` keeps `aria-sort` on the enclosing header cell in
step. `disabled` yields `aria-disabled="true"` and an unfocusable host. The
focus ring is a 3px `secondary` outline at 2px offset.

**RTL** — `icon-position="start"/"end"` is logical and mirrors under
`dir="rtl"`; the label and arrow are laid out with logical spacing.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung (rung 0 is the uncompacted default and has no rule of its own). Normally
the rung is inherited from `md-table`, so set it there.

**i18n** — translate the slotted label; keep `column` untranslated, since it is
the key echoed to your sort code. The live-region strings ("sorted ascending" /
"sorted descending") are fixed English — mirror the sort state into your own
localized live region if that matters for your audience.

## Related components

`md-table` · `md-table-cell` · `md-table-head` · `md-table-row` ·
`md-table-toolbar`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-sort-label-color` | Resting label + arrow colour | `--md-sys-color-on-surface` |
| `--md-table-sort-label-active-color` | Hover / active colour | `--md-sys-color-primary` |
| `--md-table-sort-label-icon-size` | Size of the arrow's **box** only — the glyph itself is a hard-coded 18px | `18px` |
| `--md-table-sort-label-gap` | Space between label and arrow | `--md-sys-spacing-gap-xs` (4px) |

**CSS parts** — `label`, `icon`.

```css
md-table-sort-label {
  --md-table-sort-label-active-color: var(--md-sys-color-tertiary);
  --md-table-sort-label-gap: 8px;
}
```

`--md-table-sort-label-icon-size` sizes the box the arrow sits in, not the arrow:
the built-in SVG is `width="18" height="18"` and a ligature `icon` renders at a
fixed `font-size: 18px`. Values **below 18px shrink the box while the glyph keeps
its size**, so it overflows — use it to add room around the arrow, not to shrink
it.

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Sort Label.

A clickable header label with a sort indicator that reflects the current
sort state. Place inside a `<md-table-cell head>`.

Wiring:
  1. Set `column="<id>"`
  2. The parent `<md-table>` listens for `mdSortRequest` (auto-bubbled),
     updates its `sort-by` / `sort-order`, and PUSHES the resulting
     `active` / `order` back into every sort label — no observers.

The arrow is hidden at rest and fades in at 60% opacity on hover or keyboard
focus, so an unsorted column advertises sorting only when it is pointed at.
Once the column is the sort key the arrow stays fully opaque, tinted with the
active colour, and rotates 180° to point down for descending. The rotation
runs on the spatial spring, the colour/opacity on the effects spring.

## Properties

| Property       | Attribute       | Description                                                                                                                                                                                                                   | Type                        | Default  |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| `active`       | `active`        | Whether this column is the active sort. Pushed by the parent `<md-table>`.                                                                                                                                                    | `boolean`                   | `false`  |
| `column`       | `column`        | Column id — matched against the `<md-table>`'s `sort-by` value. Required.                                                                                                                                                     | `string`                    | `''`     |
| `defaultOrder` | `default-order` | Direction the arrow points by default (the value used when this column becomes the active sort for the first time).                                                                                                           | `"asc" \| "desc"`           | `'asc'`  |
| `density`      | `density`       | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                         | `-1 \| -2 \| -3 \| -4 \| 0` | `0`      |
| `disabled`     | `disabled`      | Disabled — non-interactive.                                                                                                                                                                                                   | `boolean`                   | `false`  |
| `icon`         | `icon`          | Custom sort-arrow icon: a Material Symbols ligature name (e.g. "north", "expand_less"). Empty = the built-in SVG arrow. The icon still rotates 180deg for descending via the same CSS, so pick an "ascending-pointing" glyph. | `string`                    | `''`     |
| `iconPosition` | `icon-position` | Visual position of the arrow icon relative to the label. - `end`   — after the label (default) - `start` — before the label                                                                                                   | `"end" \| "start"`          | `'end'`  |
| `order`        | `order`         | Active sort direction. Pushed by the parent `<md-table>`.                                                                                                                                                                     | `"asc" \| "desc" \| "none"` | `'none'` |


## Events

| Event           | Description                                          | Type                                                              |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| `mdSortRequest` | Fired when the user requests to sort by this column. | `CustomEvent<{ column: string; defaultOrder: "desc" \| "asc"; }>` |


## Shadow Parts

| Part      | Description |
| --------- | ----------- |
| `"icon"`  |             |
| `"label"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
