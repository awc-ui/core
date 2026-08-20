# md-table-container

<!-- llm:meta
tag: md-table-container
category: data
status: sub-component
parent: none — wraps md-table
standalone: false
m3-guidelines: none — M3 has no data-table page
form-associated: false
depends-on: none
used-by: none
accepts-children: md-table, md-table-toolbar, md-table-pagination
-->

**The surface around a `md-table`.** It supplies elevation, shape and the
scroll region, plus the `top` / `bottom` bands where a toolbar and pagination
sit outside the scroll. It also brackets pagination changes with the table's
built-in motion.

> 🧩 **Sub-component.** Belongs with `md-table`. It gives the table a card-like
> container and a stable scroll box.

---

## When to use

- Wrapping a `md-table` so it reads as one surface, especially with a toolbar
  and/or pagination attached.
- Constraining a tall table's height (`max-height`) so the page doesn't scroll
  forever — and so `sticky-header` has something to stick inside.
- Whenever pagination drives the rows: the container is what arms the table's
  FLIP motion for page changes.

## When NOT to use

| Situation | Use instead |
|---|---|
| A bare table with no chrome | `md-table` on its own |
| A general content container | `md-card` |
| A list surface | `md-list` |
| Density, striping, dividers | Props on `md-table` |

## Decision cues

| Need | Setting |
|---|---|
| Card-like table on a plain page | `variant="elevated"` (default) |
| Table on an already-elevated surface | `variant="flat"` or `"outlined"` |
| A specific shadow step | `elevation="0"`…`"5"` (overrides the variant's) |
| Corner radius | `shape="extra-large\|large\|medium\|small\|none"` |
| Bounded, scrollable table | `max-height="60vh"` |
| Keep an empty state from collapsing | `min-height="240px"` |
| Tinted, high-emphasis table | `vibrant` |

## API contract

```html
<md-table-container
  variant="elevated|outlined|filled|flat"        <!-- default: elevated -->
  shape="extra-large|large|medium|small|none"    <!-- default: large -->
  elevation="0|1|2|3|4|5"                        <!-- default: unset (variant decides) -->
  max-height="60vh"                              <!-- default: "" (unbounded) -->
  min-height="240px"                             <!-- default: "" -->
  vibrant                                        <!-- default: false -->
>
  <md-table-toolbar slot="top" headline="Invoices"></md-table-toolbar>
  <md-table column-template="2fr 1fr" label="Invoices">…</md-table>
  <md-table-pagination slot="bottom" count="120"></md-table-pagination>
</md-table-container>
```

**Events** — none of its own.

**Methods** — none.

**Slots** — the default slot holds the `md-table`; `top` holds the toolbar band;
`bottom` holds the pagination band.

**Parts** — `top`, `scroll`, `bottom`.

### Behavioral contract worth knowing

- **`top` and `bottom` sit outside the scroll region**, so a toolbar and
  pagination stay put while the table scrolls. Put them in the default slot and
  they scroll away with the rows. An unused wrapper collapses to zero height,
  so it costs nothing.
- `max-height` is what makes the scroll region finite — without it the container
  grows and the page scrolls instead, which defeats `sticky-header`. Horizontal
  overflow always scrolls; vertical only once `max-height` is set.
- **A slotted `md-table[frozen-header]` owns its own body scroll.** The
  container detects the attribute (live — it re-checks when it changes), stops
  scrolling itself, and hands `max-height` down to the table's body area
  instead, so the scrollbar spans only the rows. `max-height` controls the
  size; `frozen-header` on the table controls the architecture.
- **Pagination motion is wired here, not on the table.** The container listens
  in the capture phase for `mdPageChange` / `mdRowsPerPageChange` coming from a
  slotted `md-table-pagination` and arms the slotted table's FLIP animation
  before your handler mutates the rows. The listener is on the container host,
  so it catches a `md-table-pagination` anywhere inside the container — slot it
  into `bottom` to keep it out of the scroll region, not to get the motion.
  Pagination placed *outside* the container loses that bracketing.
- `elevation` overrides the shadow implied by `variant`; leave it unset unless
  you need a specific step. `variant="outlined"` and `"flat"` have no shadow
  until you set it.
- `vibrant` re-tints the whole table by setting the `--md-table-*` custom
  properties (header, hover, selection, divider, stripe) that cascade into the
  slotted `md-table`.
- **No `density` prop.** Density belongs on `md-table`.

---

## Do / Don't

House rules, informed by the M3 surface and elevation guidance — M3 has no
data-table page.

| ✅ Do | ❌ Don't |
|---|---|
| Put the toolbar in `slot="top"` and pagination in `slot="bottom"` | Don't put them in the default slot — they'd scroll with the rows |
| Set `max-height` for long tables | Don't let a 500-row table stretch the page |
| Pair `max-height` with the table's `sticky-header` | Don't expect sticky headers to work without a bounded scroll box |
| Let a `frozen-header` table own its scroll | Don't add a second scroll box around it |
| Pick one `variant` per screen | Don't mix elevated and outlined tables side by side |
| Use `flat`/`outlined` inside an already-elevated surface | Don't stack elevation on elevation |
| Let `md-table` own density | Don't look for density here |

## Patterns

```html
<!-- Toolbar + bounded scroll + pagination, all in one surface -->
<md-table-container variant="outlined" max-height="60vh">
  <md-table-toolbar slot="top" headline="Invoices" supporting-text="Last 30 days"></md-table-toolbar>

  <md-table id="invoices" sticky-header column-template="2fr 1fr 1fr" label="Invoices">
    <md-table-head>
      <md-table-row rowgroup="head">
        <md-table-cell head scope="col">Client</md-table-cell>
        <md-table-cell head scope="col" numeric>Amount</md-table-cell>
        <md-table-cell head scope="col">Status</md-table-cell>
      </md-table-row>
    </md-table-head>
    <md-table-body id="invoice-rows">
      <md-table-row value="inv-1">
        <md-table-cell>Acme Corp</md-table-cell>
        <md-table-cell numeric>$1,200</md-table-cell>
        <md-table-cell>Paid</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>

  <md-table-pagination slot="bottom" count="120" rows-per-page="25"></md-table-pagination>
</md-table-container>

<script type="module">
  // The container has already armed the table's motion by the time this runs.
  document
    .querySelector('md-table-pagination')
    .addEventListener('mdPageChange', (e) => renderPage(e.detail.page));
</script>
```

```html
<!-- Frozen header: the TABLE scrolls its body, the container just sizes it -->
<md-table-container variant="elevated" max-height="420px">
  <md-table frozen-header column-template="2fr 1fr 1fr" label="Invoices">…</md-table>
</md-table-container>
```

```html
<!-- Flat, inside an already-elevated card -->
<md-card>
  <md-table-container variant="flat">
    <md-table column-template="2fr 1fr" label="Invoices">…</md-table>
  </md-table-container>
</md-card>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Toolbar or pagination in the default slot | `slot="top"` / `slot="bottom"` | They scroll away with the rows instead of staying put. |
| `sticky-header` with no `max-height` | Bound the container | There is no finite scroll box to stick inside. |
| `max-height` on a `frozen-header` table expecting the container to scroll | Let the table scroll its body | The container hands the height to the table and stops scrolling. |
| Pagination outside the container | Slot it into `bottom` | Only slotted pagination arms the FLIP motion. |
| Looking for `density` here | Set it on `md-table` | Not a prop on the container. |
| `variant="elevated"` inside a `md-card` | `flat` or `outlined` | Doubled elevation. |
| Setting `--md-table-container-color` to recolor the surface | Set `--md-table-surface` | Every `variant` rule re-sets the background from `--md-table-surface`. |
| Using it as a general card | `md-card` | It is a table-specific surface. |

## Accessibility, RTL, density, i18n

**Accessibility** — the container is presentational; the grid semantics live on
`md-table`. Keeping the toolbar and pagination outside the scroll area is an
accessibility benefit: those controls stay reachable without scrolling back. A
bounded scroll region must stay keyboard-scrollable — with `frozen-header` the
table provides a focusable body scroller for exactly that reason.

**RTL** — shape, padding and the scroll region use logical properties and mirror
automatically.

**Density** — none here; set `density` on `md-table`.

**i18n** — no text of its own.

## Related components

`md-table` · `md-table-toolbar` · `md-table-pagination` · `md-card`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-surface` | Container background, and the opaque base behind pinned cells | `--md-sys-color-surface-container-low` (`--md-sys-color-surface` for `outlined` / `flat`) |
| `--md-table-container-elevation` | Shadow used by `variant="elevated"` | `--md-sys-elevation-1` |
| `--md-table-container-outline-color` | Border color for `variant="outlined"` | `--md-sys-color-outline-variant` |
| `--md-table-container-outline-width` | Border width for `variant="outlined"` | `1px` |
| `--md-table-container-color` | Base background — but every `variant` rule re-sets the background from `--md-table-surface`, so set that instead | `--md-sys-color-surface-container-low` |
| `--md-table-container-shape` | Base radius — but the `shape` class always wins, so use the `shape` prop or override the `--md-sys-shape-corner-*` token | `--md-sys-shape-corner-extra-large` |

The container also cascades table-level properties into the slotted `md-table`;
`vibrant` works by setting `--md-table-head-bg`, `--md-table-head-color`,
`--md-table-row-hover-color`, `--md-table-row-selected-bg`,
`--md-table-row-selected-color`, `--md-table-divider-color` and
`--md-table-stripe-color`. Set any of them yourself to theme the table from the
container.

**CSS parts** — `top`, `scroll`, `bottom`.

```css
md-table-container::part(scroll) {
  scroll-behavior: smooth;
}
```

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Container

The outer surface that wraps a `<md-table>`, optional `<md-table-toolbar>`
and `<md-table-pagination>`. Provides elevation, shape, and the scroll
context (with optional max-height) for sticky headers / columns.

Compose freely:

```html
<md-table-container variant="elevated" max-height="480px">
  <md-table-toolbar headline="Users"></md-table-toolbar>
  <md-table>…</md-table>
  <md-table-pagination></md-table-pagination>
</md-table-container>
```

## Properties

| Property    | Attribute    | Description                                                                                                                                                                                                                                   | Type                                                        | Default      |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| `elevation` | `elevation`  | Explicit MD3 elevation level (0–5), overriding the variant's default shadow. Handy to raise/flatten the surface without changing `variant` (e.g. `variant="outlined" elevation="2"`). Also settable via `--md-table-container-elevation`.     | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| undefined`                   | `undefined`  |
| `maxHeight` | `max-height` | If set, the table area becomes scrollable up to this max-height (e.g. `"480px"`, `"60vh"`). Required for sticky header / column.                                                                                                              | `string`                                                    | `''`         |
| `minHeight` | `min-height` | If set, the table area becomes scrollable up to this min-height (useful to keep an empty-state visible).                                                                                                                                      | `string`                                                    | `''`         |
| `shape`     | `shape`      | Container shape — large for dashboards, medium for dense, small for compact. Maps to MD3 `--md-sys-shape-corner-{size}` tokens.                                                                                                               | `"extra-large" \| "large" \| "medium" \| "none" \| "small"` | `'large'`    |
| `variant`   | `variant`    | Visual surface variant. - `elevated` — surface-container-low + box-shadow - `outlined` — surface + 1px outline - `filled`   — surface-container-low, no shadow / outline - `flat`     — transparent (use when nesting inside another surface) | `"elevated" \| "filled" \| "flat" \| "outlined"`            | `'elevated'` |
| `vibrant`   | `vibrant`    | Vibrant tonality: tints the whole table with primary/tertiary container tones (coloured header, primary hover, tertiary selection, primary-tinted surface). Cascades to the contained md-table via CSS custom properties.                     | `boolean`                                                   | `false`      |


## Shadow Parts

| Part       | Description |
| ---------- | ----------- |
| `"bottom"` |             |
| `"scroll"` |             |
| `"top"`    |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
