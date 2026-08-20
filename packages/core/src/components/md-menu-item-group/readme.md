# md-menu-item-group

<!-- llm:meta
tag: md-menu-item-group
category: navigation
status: sub-component
parent: md-menu
standalone: false
m3-guidelines: https://m3.material.io/components/menus/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-menu-item, md-sub-menu-item
-->

**A labelled section within a `md-menu`.** Groups related rows under a heading
so a long menu stays scannable, and scopes radio exclusivity to the section.

> 🧩 **Sub-component.** Only valid inside `md-menu` — its parent. The section-card
> look additionally needs the menu set to `variant="standard"` or `"vibrant"`
> plus `layout="grouped"` and `use-gap`.

---

## When to use

- Inside `md-menu`, the parent that owns it, when the menu is long enough that
  rows benefit from **named sections**: "Sort by", "View", "Danger zone".
- Around a set of `type="radio"` items that belong to one choice — the group is
  the exclusivity scope.

## When NOT to use

| Situation | Use instead |
|---|---|
| A short, flat menu | Plain `md-menu-item` children |
| Purely visual separation | `divider` on a `md-menu-item` |
| Nested, expandable actions | `md-sub-menu-item` |
| Grouping list rows | `md-list` with `list-style="segmented"` |
| A section of a page | A heading element |

## API contract

```html
<md-menu anchor="trigger" variant="standard" layout="grouped" use-gap>
  <md-menu-item-group
    label="Sort by"          <!-- default: "" -->
    density="-1|-2|-3|-4"    <!-- default: 0 (uncompacted; there is no density="0" rule) -->
  >
    <md-menu-item headline="Newest" type="radio" selected></md-menu-item>
    <md-menu-item headline="Oldest" type="radio"></md-menu-item>
  </md-menu-item-group>

  <md-menu-item-group label="View">
    <md-menu-item headline="Compact" type="checkbox" keep-open></md-menu-item>
  </md-menu-item-group>
</md-menu>
```

**Events** — none. **Methods** — none. **Parts** — none.

**Slot** — `(default)`: the `md-menu-item` / `md-sub-menu-item` rows.

### Behavioral contract worth knowing

- **The group is the radio-exclusivity scope.** A `md-menu-item` with
  `type="radio"` deselects its `type="radio"` siblings within the nearest
  enclosing `md-menu-item-group`; without a group it falls back to the whole
  `md-menu`. Two independent radio sets in one menu therefore need one group
  each — that is the reason to reach for this component beyond the label.
- The host is `role="group"` and takes `aria-label` from `label`. The label is
  *not* a heading element, and an empty `label` leaves the group unlabelled
  (and `aria-label` unset).
- **It groups; it does not lay itself out.** The visible section styling comes
  from the parent menu: the divider between groups is drawn by this component,
  but the card background, radius and padding only apply when the menu
  propagates `data-variant="standard"`/`"vibrant"` **and** `data-use-gap`, which
  it does from `variant` + `use-gap`. `layout="grouped"` is itself ignored while
  the menu is `variant="baseline"`.
- When the menu is in gap mode the between-group divider is suppressed and the
  cards are separated by a real gap instead.
- A group's rows count toward the menu's `empty-text` bookkeeping: the menu
  looks inside groups for a visible row before showing its empty state.

---

## Do / Don't

Sourced from [M3 · Menus · Guidelines](https://m3.material.io/components/menus/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Give every group a short, meaningful `label` | Don't ship an unlabelled group |
| Use groups when a menu has genuinely distinct sections | Don't group a five-item menu |
| Put one choice-set per group for radio items | Don't spread one radio choice across two groups |
| Set the menu to `variant="standard"` + `layout="grouped"` + `use-gap` for cards | Don't expect card styling from `layout="grouped"` alone |
| Keep labels to one or two words | Don't write a sentence as a section heading |
| Let the group scope radio exclusivity | Don't re-implement it in a click handler |

## Patterns

```html
<!-- Two independent radio sets — one group each keeps them exclusive separately -->
<md-icon-button id="sort-btn" icon="sort" aria-label="Sort"></md-icon-button>

<md-menu anchor="sort-btn" variant="standard" layout="grouped" use-gap>
  <md-menu-item-group label="Sort by">
    <md-menu-item headline="Name"     type="radio" selected></md-menu-item>
    <md-menu-item headline="Modified" type="radio"></md-menu-item>
  </md-menu-item-group>

  <md-menu-item-group label="Direction">
    <md-menu-item headline="Ascending"  type="radio" selected></md-menu-item>
    <md-menu-item headline="Descending" type="radio"></md-menu-item>
  </md-menu-item-group>
</md-menu>

<script type="module">
  // Exclusivity is automatic; just read the state after a pick.
  document.querySelector('md-menu').addEventListener('mdClick', () => {
    const picked = [...document.querySelectorAll('md-menu-item[type="radio"]')]
      .filter((i) => i.selected)
      .map((i) => i.headline);
    console.log(picked);        // e.g. ["Name", "Ascending"]
  });
</script>
```

```html
<!-- Plain baseline menu: the group still labels and scopes, just without cards -->
<md-menu anchor="sort-btn">
  <md-menu-item-group label="Danger zone">
    <md-menu-item headline="Archive"></md-menu-item>
    <md-menu-item headline="Delete"></md-menu-item>
  </md-menu-item-group>
</md-menu>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Hand-writing a radio-exclusivity handler | Wrap the radio rows in one group | The group already scopes it. |
| Two radio sets in one group | One group per choice-set | They would deselect each other. |
| `layout="grouped"` with the default `variant="baseline"` | Add `variant="standard"` (or `"vibrant"`) and `use-gap` | `layout` is ignored on the baseline variant. |
| `md-menu-item-group` outside `md-menu` | Nest it | No propagation, no styling, no keyboard model. |
| An empty `label` | Provide one, or use `divider` on a row instead | An unnamed group adds nothing and sets no `aria-label`. |
| Grouping a short menu | Keep it flat | Overhead without benefit. |
| Using it for a page section | Use a heading element | It is menu-scoped. |
| Styling it with `::part(...)` | Style the rows, or the menu's `surface` part | The group exposes no parts. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host is `role="group"`, labelled by `label` via
`aria-label`, so screen-reader users can navigate a long menu by section. The
parent `md-menu` still owns roving focus and typeahead; grouping does not change
the keyboard model. Because the group scopes radio exclusivity, a correctly
grouped menu can never announce two checked radios in the same set.

**RTL** — the group is a plain column; alignment follows the inherited
`dir="rtl"` along with the rest of the menu.

**Density** — inherited from the menu's rung; a local override is
`density="-1"` through `density="-4"`. `0` is the uncompacted default and has no
rule of its own, so it cannot opt the group out of an inherited rung — use
`style="--md-sys-density-scale: 0"` for that, and note the ancestor's
`--md-sys-spacing-*` values still inherit.

**i18n** — translate `label`. Keep it short; the label sits above the rows and a
long translation widens the whole menu surface.

## Related components

`md-menu` · `md-menu-item` · `md-sub-menu-item` · `md-list` · `md-divider`

## Theming

The group reads one custom property of its own, and the spacing between group
cards is set on the parent `md-menu`.

| Custom property | Purpose | Default | Set on |
|---|---|---|---|
| `--md-menu-group-container-shape` | Corner radius of the group card (gap mode, `standard`/`vibrant`) | `12px` | `md-menu-item-group` |
| `--md-menu-group-gap` | Space between group cards | `4px` | `md-menu` |

**CSS parts** — none; the group renders no `part` attributes.

```css
md-menu {
  --md-menu-group-gap: 8px;
}
md-menu-item-group {
  --md-menu-group-container-shape: 16px;
}
```

<!-- Auto Generated Below -->


## Properties

| Property  | Attribute | Description                                                                                                                                                                                           | Type                        | Default |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------- |
| `density` | `density` | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact. | `-1 \| -2 \| -3 \| -4 \| 0` | `0`     |
| `label`   | `label`   | Optional label shown above the group items.                                                                                                                                                           | `string`                    | `''`    |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
