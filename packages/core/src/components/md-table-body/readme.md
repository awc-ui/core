# md-table-body

<!-- llm:meta
tag: md-table-body
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

**The data rowgroup — `<tbody>` for `md-table`.** A marker element that groups
the data rows. `md-table` reads it to decide which rows are body rows (striping,
selection and hover apply only to them), and it is the group the built-in FLIP
motion animates. It has no author-settable props and no box of its own.

> 🧩 **Sub-component.** Only valid inside `md-table`.

---

## When to use

- Wrapping the data rows of a hand-authored `md-table` — the parent that owns
  it is `md-table`.

## When NOT to use

| Situation | Use instead |
|---|---|
| Header rows | `md-table-head` |
| Totals / summary rows | `md-table-foot` |
| A scroll box around the table | `md-table-container[max-height]` |

## API contract

```html
<md-table column-template="2fr 1fr" label="People">
  <md-table-body>
    <md-table-row value="1">
      <md-table-cell>Ada</md-table-cell>
      <md-table-cell>Eng</md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

**No author-settable props, no events, no methods and no CSS parts.**

**Slots** — one unnamed default slot; put `md-table-row` elements in it.

**Internal props — never set these by hand:** `presentational`. `md-table`
stamps it in `frozen-header` mode, where the body renders inside a wrapper that
is already the `role="rowgroup"`; the attribute drops this element to
`role="presentation"` so rowgroups do not nest. Setting or removing it yourself
desynchronises the ARIA tree.

### Behavioral contract worth knowing

- **`display: contents`** — the rows land on the table's own grid tracks. Do not
  try to size, pad, or scroll this element; bound `md-table-container` (or use
  `frozen-header` on the table) instead.
- A row is a **body row** unless it sits inside `md-table-head` or
  `md-table-foot` — including a row placed loose under `md-table`. Striping
  parity, hover, `aria-selected` and the selection model (`getSelection()`,
  `selectAll()`) cover exactly those rows; head and foot rows are excluded
  automatically.
- `md-table` stamps `rowgroup="body"` on every row inside it, on load and on
  every slot change. That is also the row's default, so plain markup is already
  correct.
- The table's expressive motion (`motion="expressive"`, the default) FLIPs the
  rows of **the first `md-table-body`** around sort and pagination changes.
- Several `md-table-body` elements in one table are allowed, but each is a real
  rowgroup for assistive tech — and only the first one is FLIP-animated.
- Internally it relays its shadow `slotchange` as a bubbling
  `mdRowgroupSlotChange` event so `md-table` notices row additions and reorders
  (`slotchange` is not composed). That is plumbing; you do not listen to it.

---

## Do / Don't

House rules, informed by the WAI table patterns — M3 has no data-table page.

| ✅ Do | ❌ Don't |
|---|---|
| Wrap data rows in `md-table-body` | Don't leave rows loose under `md-table` |
| Give each row a stable `value` | Don't rely on DOM position for identity |
| Scroll via `md-table-container[max-height]` or `frozen-header` | Don't try to scroll this element |
| Keep one body per logical dataset | Don't split one dataset into many rowgroups for looks |
| Let it stay `display: contents` | Don't give it padding, height or `overflow` |
| Keep every row's cell count equal to the column count | Don't mix row shapes — pinning and subgrid depend on it |

## Patterns

```html
<md-table column-template="2fr 1fr" label="People">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">Name</md-table-cell>
      <md-table-cell head scope="col">Team</md-table-cell>
    </md-table-row>
  </md-table-head>

  <md-table-body>
    <md-table-row value="1">
      <md-table-cell head scope="row">Ada</md-table-cell>
      <md-table-cell>Eng</md-table-cell>
    </md-table-row>
    <md-table-row value="2">
      <md-table-cell head scope="row">Grace</md-table-cell>
      <md-table-cell>Research</md-table-cell>
    </md-table-row>
  </md-table-body>
</md-table>
```

```html
<!-- Rows replaced from data; the table FLIP-animates the body on sort/paging -->
<md-table id="people" column-template="2fr 1fr" label="People">
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell head scope="col">Name</md-table-cell>
      <md-table-cell head scope="col">Team</md-table-cell>
    </md-table-row>
  </md-table-head>
  <md-table-body id="people-body"></md-table-body>
</md-table>

<script type="module">
  const body = document.getElementById('people-body');
  const render = (rows) => {
    body.innerHTML = rows
      .map(
        (r) =>
          `<md-table-row value="${r.id}">` +
          `<md-table-cell>${r.name}</md-table-cell>` +
          `<md-table-cell>${r.team}</md-table-cell>` +
          `</md-table-row>`,
      )
      .join('');
  };
  render([
    { id: '1', name: 'Ada', team: 'Eng' },
    { id: '2', name: 'Grace', team: 'Research' },
  ]);
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Padding or borders on `md-table-body` | Style the rows/cells | It is `display: contents` — it has no box. |
| `overflow: auto` here | Bound `md-table-container` | This element can never be a scroll box. |
| Setting `presentational` yourself | Leave it alone | It is internal; `md-table` owns it in frozen mode. |
| Header rows inside the body | `md-table-head` | They would be striped, hoverable and selectable. |
| Rows loose under `md-table` | Wrap them in `md-table-body` | They still behave as body rows, but the FLIP motion and the frozen-header rowgroup wiring both key off `md-table-body`. |
| Expecting props | It has none you set | Marker element by design. |

## Accessibility, RTL, density, i18n

**Accessibility** — the element carries `role="rowgroup"` (or
`role="presentation"` in `frozen-header` mode, where the table's scroll wrapper
is the rowgroup instead). Row and cell semantics come from `md-table-row` and
`md-table-cell`; `aria-selected` is stamped by `md-table` only on selectable
body rows of a selection-enabled table.

**RTL** — nothing of its own; the table mirrors.

**Density** — nothing of its own; row height follows `md-table`.

**i18n** — cell text is your content.

## Related components

`md-table` · `md-table-head` · `md-table-foot` · `md-table-row` ·
`md-table-cell`

## Theming

No custom properties of its own — its stylesheet only sets `display: contents`.
Body appearance is themed on `md-table`:

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-stripe-color` | `striped` alternate-row overlay | `on-surface` at half the hover-layer opacity |
| `--md-table-divider-color` | Rule between rows | `--md-sys-color-outline-variant` |
| `--md-table-row-hover-color` | Row hover state-layer color | `--md-sys-color-on-surface` |
| `--md-table-row-height-standard` | Body row height | `calc(52px + density scale × 4px)` |

**CSS parts** — none.

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Body (`<tbody>`).

Pure presentational rowgroup. Children flow into the parent grid via
`display: contents`.

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
