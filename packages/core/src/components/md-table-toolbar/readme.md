# md-table-toolbar

<!-- llm:meta
tag: md-table-toolbar
category: data
status: sub-component
parent: md-table-container
standalone: false
m3-guidelines: none — M3 has no data-table page
m3-derived-from: https://m3.material.io/components/toolbars/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**The band above a table.** Title and supporting text in the resting state; a
selection count and bulk actions once rows are selected. It is a presentation
band with two modes — it never selects anything itself.

> 🧩 **Sub-component.** Goes in `md-table-container`'s `top` slot so it stays
> put while the table scrolls.

---

## When to use

- Titling a table and hosting its table-level actions (search, filter, export).
- Showing **"n selected"** with bulk actions during a selection.

## When NOT to use

| Situation | Use instead |
|---|---|
| Page-level actions | `md-app-bar` |
| General local action clusters | `md-toolbar` |
| Pagination | `md-table-pagination` |
| Row-level actions | A cell with `md-icon-button` / `md-menu` |
| A table caption for assistive tech | `md-table`'s `label` / `caption` |

## Decision cues

| Need | Setting |
|---|---|
| Title + subtitle | `headline` + `supporting-text` |
| Selection state | `num-selected` (+ `label-selected`) |
| Wire selection with no glue code | `auto-bind` |
| Tighter band | `compact` |
| Custom title markup, no plain title | the `title-area` slot |
| Custom markup for an existing title | the `headline` / `supporting-text` slots |

## API contract

```html
<md-table-container>
  <md-table-toolbar
    slot="top"
    headline="Invoices"                  <!-- default: "" -->
    supporting-text="Last 30 days"       <!-- default: "" -->
    num-selected="0"                     <!-- default: 0 -->
    label-selected="%count% selected"    <!-- default: "%count% selected" -->
    auto-bind                            <!-- default: false -->
    compact                              <!-- default: false -->
    density="-1|-2|-3|-4"                <!-- default: 0 = no local rung -->
  >
    <md-icon-button slot="actions" icon="filter_list" aria-label="Filter invoices"></md-icon-button>
    <md-icon-button slot="selection-actions" icon="delete" aria-label="Delete selected invoices"></md-icon-button>
  </md-table-toolbar>
  <md-table label="Invoices" selection="multiple"></md-table>
</md-table-container>
```

**Events** — none. **Methods** — none.

**Slots** — `leading` (before the title; hidden in selection mode), `headline`
and `supporting-text` (markup replacements for the matching props),
`title-area` (free-form title region), `actions` (resting-mode actions),
`selection-actions` (shown instead of `actions` in selection mode).

**Parts** — `leading`, `main`, `headline`, `supporting-text`,
`selection-caption`, `actions`.

### Behavioral contract worth knowing

- **`num-selected > 0` switches the toolbar into selection mode**: the title
  block is replaced by the selection caption, `selection-actions` replace
  `actions`, the `leading` slot stops rendering, and the band swaps to
  `--md-sys-color-secondary-container`.
- `num-selected` is otherwise **controlled** — you keep it in sync from the
  table's `mdSelectionChange` event, whose `detail.count` is the number you
  want. Or set `auto-bind` and skip the wiring.
- `auto-bind` resolves the table **once, on load**, as
  `closest('md-table-container')?.querySelector('md-table')`. Both elements
  must already be inside the same `md-table-container`; a table swapped in
  later is not picked up.
- **The `headline` slot only renders while the `headline` prop is non-empty**,
  and the same holds for `supporting-text`. To slot arbitrary markup, either
  set the prop to any non-empty string (the slot replaces the text) or leave
  **both** props empty and use `title-area`, which only renders when neither
  prop is set.
- **`label-selected` uses `%count%`**, not `{count}` — a different token style
  from the rest of the library. The count is inserted with `toLocaleString()`,
  so large numbers are grouped for the page's locale.
- The host is `role="toolbar"` and its accessible name is the `headline` prop,
  falling back to the fixed string `Table toolbar`. Slotted headline markup
  does **not** change that name.
- The toolbar is **not** the table's accessible name — set `label` or `caption`
  on `md-table` too.

---

## Do / Don't

House rules, informed by [M3 · Toolbars · Guidelines](https://m3.material.io/components/toolbars/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Put it in the container's `top` slot | Don't let it scroll away with the rows |
| Keep `num-selected` in sync (or use `auto-bind`) | Don't leave a stale count in selection mode |
| Put bulk actions in `selection-actions` | Don't mix bulk and normal actions in one slot |
| Keep the resting actions to the essentials | Don't overwhelm the band with controls |
| Also set `label`/`caption` on the table | Don't rely on the toolbar to name the grid |
| Translate `label-selected`, keeping `%count%` | Don't drop the token |
| Give every icon action an `aria-label` | Don't ship unlabelled icon buttons |
| Use `compact` in dense layouts | Don't shrink the band with ad-hoc CSS |

## Patterns

```html
<!-- Zero-glue selection: auto-bind finds the sibling table itself. -->
<md-table-container variant="outlined">
  <md-table-toolbar slot="top" headline="Invoices" supporting-text="Last 30 days" auto-bind>
    <md-icon-button slot="actions" icon="search" aria-label="Search invoices"></md-icon-button>
    <md-icon-button slot="actions" icon="filter_list" aria-label="Filter invoices"></md-icon-button>

    <md-icon-button slot="selection-actions" icon="download" aria-label="Export selected invoices"></md-icon-button>
    <md-icon-button slot="selection-actions" icon="delete" aria-label="Delete selected invoices"></md-icon-button>
  </md-table-toolbar>

  <md-table selection="multiple" label="Invoices">
    <md-table-body>
      <md-table-row value="inv-1">
        <md-table-cell>Acme Corporation</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
</md-table-container>
```

```html
<!-- Manual binding: the count is on the event detail. -->
<md-table-container>
  <md-table-toolbar id="bar" slot="top" headline="Invoices"></md-table-toolbar>
  <md-table id="grid" selection="multiple" label="Invoices"></md-table>
</md-table-container>

<script type="module">
  const bar = document.getElementById('bar');
  const grid = document.getElementById('grid');

  grid.addEventListener('mdSelectionChange', (e) => {
    bar.numSelected = e.detail.count;
  });
</script>
```

```html
<!-- Localized: keep the %count% token. -->
<md-table-toolbar
  headline="Factures"
  supporting-text="30 derniers jours"
  label-selected="%count% sélectionnées"
></md-table-toolbar>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `label-selected="{count} selected"` | `label-selected="%count% selected"` | This component uses `%count%`, unlike the `{…}` tokens elsewhere. |
| Toolbar in the container's default slot | `slot="top"` | It would scroll with the rows. |
| Bulk actions in `actions` | `slot="selection-actions"` | They would show when nothing is selected. |
| `toolbar.numSelected = await table.getSelection()` | `toolbar.numSelected = e.detail.count` | `getSelection()` resolves to a state object, not a number. |
| Never updating `num-selected` | Sync it, or use `auto-bind` | Selection mode never appears (or never leaves). |
| `auto-bind` with the table outside the container | Put both inside one `md-table-container` | The lookup is scoped to the container. |
| Slotting `headline` markup with the `headline` prop empty | Use the `title-area` slot | The `headline` slot isn't rendered while the prop is empty. |
| Relying on the headline as the table's accessible name | Set `label`/`caption` on `md-table` | They are different elements. |
| Unlabelled icon actions | Add `aria-label` | Icon-only buttons have no accessible name otherwise. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host is `role="toolbar"`, named by the `headline` prop
(fallback: `Table toolbar`). The selection caption is rendered inside an
`aria-live="polite"` region, so the count is announced when it changes; the
element is created when selection mode opens, so verify the first announcement
in your app and mirror the count into your own live region if it is missed.
Every icon action needs an `aria-label` that says what it acts on ("Delete
selected invoices", not "Delete").

**RTL** — leading, title and actions areas are laid out with logical
properties and mirror under `dir="rtl"`.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung (rung 0 is the uncompacted default and has no rule of its own). `compact`
is a separate, blunter switch: it forces 6px block padding and a 48px minimum
height, overriding both the density calc and
`--md-table-toolbar-padding-block` / `--md-table-toolbar-min-height`.

**i18n** — translate `headline`, `supporting-text`, `label-selected` (keeping
`%count%`), and every action's `aria-label`. The count itself is formatted with
`toLocaleString()`.

## Related components

`md-table` · `md-table-container` · `md-table-pagination` · `md-toolbar` ·
`md-app-bar` · `md-icon-button` · `md-menu`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-table-toolbar-color` | Resting foreground | `--md-sys-color-on-surface` |
| `--md-table-toolbar-bg` | Resting background | `transparent` |
| `--md-table-toolbar-selection-color` | Selection-mode foreground | `--md-sys-color-on-secondary-container` |
| `--md-table-toolbar-selection-bg` | Selection-mode background | `--md-sys-color-secondary-container` |
| `--md-table-toolbar-padding-block` | Vertical padding (ignored while `compact`) | `--md-sys-spacing-inset-md` (12px) |
| `--md-table-toolbar-min-height` | Band height (ignored while `compact`) | `64px`, tightening with the density rung |

**CSS parts** — `leading`, `main`, `headline`, `supporting-text`,
`selection-caption`, `actions`.

```css
md-table-toolbar.danger {
  --md-table-toolbar-selection-bg: var(--md-sys-color-error-container);
  --md-table-toolbar-selection-color: var(--md-sys-color-on-error-container);
}
```

<!-- Auto Generated Below -->


## Overview

Material Design 3 — Table Toolbar.

The header bar above a `<md-table>` (typically dropped into a
`<md-table-container slot="top">`). Shows a title + supporting text and
a row of action items. Switches into a "selection" mode when one or more
rows are selected (matching the MUI / MD3 data-table pattern).

Two modes:
  - Default — shows the headline + supporting text + actions
  - Selection — shows "%count% selected" + selection-actions (when
    `num-selected > 0`)

The toolbar can listen to its closest `<md-table>`'s `mdSelectionChange`
event automatically (via `auto-bind`) — set `auto-bind` on the toolbar
and selection state will track the table without any glue code.

## Properties

| Property         | Attribute         | Description                                                                                                                                                                                           | Type                        | Default              |
| ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| `autoBind`       | `auto-bind`       | Auto-bind to the closest `<md-table>`'s `mdSelectionChange` event so `numSelected` updates with no glue code.                                                                                         | `boolean`                   | `false`              |
| `compact`        | `compact`         | Compact density for the toolbar (smaller padding / type).                                                                                                                                             | `boolean`                   | `false`              |
| `density`        | `density`         | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact. | `-1 \| -2 \| -3 \| -4 \| 0` | `0`                  |
| `headline`       | `headline`        | Title displayed when no rows are selected.                                                                                                                                                            | `string`                    | `''`                 |
| `labelSelected`  | `label-selected`  | Custom label for the selection-mode caption. Tokens: `%count%`.                                                                                                                                       | `string`                    | `'%count% selected'` |
| `numSelected`    | `num-selected`    | Number of selected rows (controlled).                                                                                                                                                                 | `number`                    | `0`                  |
| `supportingText` | `supporting-text` | Optional supporting text under the headline.                                                                                                                                                          | `string`                    | `''`                 |


## Shadow Parts

| Part                  | Description |
| --------------------- | ----------- |
| `"actions"`           |             |
| `"headline"`          |             |
| `"leading"`           |             |
| `"main"`              |             |
| `"selection-caption"` |             |
| `"supporting-text"`   |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
