# md-divider

<!-- llm:meta
tag: md-divider
category: containment
status: md3-mapped
m3-guidelines: https://m3.material.io/components/divider/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A thin rule that separates content.** Full-bleed or inset, horizontal or vertical.
The host always exposes `role="separator"` with a matching `aria-orientation`;
the painted hairline lives inside the shadow root, so a page-level
`* { margin: 0 }` reset cannot wipe its insets.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- Separating **interactive from non-interactive** areas of a container — the
  actions row of a card from its content.
- Marking a **hierarchy** boundary in a list or menu, where whitespace alone
  isn't enough.
- Interleaved between `md-list-item` rows to add hairline separators to a
  `list-style="standard"` list.

## When NOT to use

| Situation | Use instead |
|---|---|
| Spacing between unrelated blocks | Whitespace / margin |
| A section heading | A heading element |
| A decorative flourish | Nothing |
| A container edge | The container's own border or elevation |
| Every row of a list | Nothing — M3 warns against clutter |
| A progress track | `md-progress-indicator` |

## Decision cues

| Need | Setting |
|---|---|
| Full-bleed rule | no attributes |
| Indented both ends (list rows with leading icons) | `inset` |
| Indented at the start only | `inset-start` |
| Indented at the end only | `inset-end` |
| Column separator | `vertical` |

## API contract

```html
<md-divider
  inset          <!-- 16px inset on BOTH sides -->
  inset-start    <!-- 16px leading inset, 0 trailing -->
  inset-end      <!-- 0 leading inset, 16px trailing -->
  vertical       <!-- column separator instead of a row rule -->
></md-divider>
```

Every attribute is a boolean and defaults to `false`. Realistic usage is one
at a time, optionally combined with `vertical`:

```html
<md-divider></md-divider>
<md-divider inset></md-divider>
<md-divider inset-start></md-divider>
<md-divider vertical inset></md-divider>
```

**Events** — none.

**Methods** — none.

**Slots** — none. The component renders no `<slot>`; anything you put inside
`<md-divider>…</md-divider>` is never displayed.

**Parts** — `divider` (the painted hairline inside the shadow root, not the
host).

### Behavioral contract worth knowing

- **The role is built in.** The host renders `role="separator"` and
  `aria-orientation="horizontal"` (or `"vertical"`) on every instance. Don't
  add your own `role`; to make a purely decorative rule silent, put
  `aria-hidden="true"` on the host.
- **No `density` prop** — one of the few components without one. Size it with
  `--md-divider-thickness` and the inset properties.
- `inset` is equivalent to `inset-start` + `inset-end`; when several inset
  attributes are set at once the CSS source order means `inset-end` wins over
  `inset-start`, which wins over `inset`. Set exactly one.
- The insets are **logical** margins on the inner rule. In `vertical` mode the
  same custom properties become block-start / block-end margins, so
  `--md-divider-inset-start` indents the top of a vertical rule.
- `vertical` switches the host to `inline-flex` with `align-self: stretch`,
  `block-size: auto` and `min-block-size: 1em`. In a flex row it therefore
  stretches to the row's height even when the parent says
  `align-items: flex-start` (`align-self` on the item wins). Outside a flex
  container there is nothing to stretch against and it falls back to `1em`.
- Inside an `md-list` / an `md-list-item` `expanded-content` slot, the parent
  sets `aria-hidden="true"` on interleaved dividers automatically, because a
  `list` / `listbox` may not own a `separator`.

---

## Do / Don't

Sourced from [M3 · Divider · Guidelines](https://m3.material.io/components/divider/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use full-width dividers to separate interactive from non-interactive areas of a container (e.g. in a card) | Don't scatter full-width dividers everywhere — too many make the interface look cluttered |
| Combine inset and full-width dividers to express hierarchy | Don't use one uniform divider for every boundary |
| Accept that some content needs **no** divider | Don't add a rule between every pair of elements |
| Use `inset` where rows have leading icons/avatars, aligning to the text | Don't full-bleed a divider through an icon column |
| Let whitespace do the work when it can | Don't reach for a divider first |

---

## Patterns

```html
<!-- Card: separate content from actions -->
<md-card>
  <p>Content…</p>
  <md-divider></md-divider>
  <md-button variant="text">Action</md-button>
</md-card>
```

```html
<!-- List with leading avatars: inset aligns to the text column -->
<md-list label="Contacts">
  <md-list-item headline="Ada Lovelace" leading-avatar-name="Ada Lovelace"></md-list-item>
  <md-divider inset></md-divider>
  <md-list-item headline="Grace Hopper" leading-avatar-name="Grace Hopper"></md-list-item>
</md-list>
```

```html
<!-- Vertical separator: the parent supplies the height -->
<div style="display: flex; align-items: stretch; gap: 8px;">
  <span>Draft</span>
  <md-divider vertical></md-divider>
  <span>Edited 2m ago</span>
</div>
```

```html
<!-- Custom inset and a heavier rule -->
<md-divider inset style="--md-divider-inset-start: 72px;"></md-divider>
<md-divider style="--md-divider-thickness: 2px;"></md-divider>

<!-- Purely decorative: silence the built-in separator role -->
<md-divider aria-hidden="true"></md-divider>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| A divider between every list row | Group with insets, or use whitespace | M3: too many dividers clutter. |
| `<md-divider role="separator">` | `<md-divider>` | The role is already on the host. |
| `<md-divider><span>or</span></md-divider>` | Lay the label out yourself around two dividers | The component renders no `<slot>`. |
| `inset inset-start inset-end` together | Pick one | They target the same margins; the last rule in the stylesheet wins. |
| Looking for a `density` prop | Use `--md-divider-thickness` and the inset properties | It has none. |
| `<hr>` styled by hand | `md-divider` | Consistency with the tokens. |
| Full-bleed divider through an icon column in a list | `inset` | Aligns to the text. |
| A divider standing in for a section heading | Use a heading | Semantics. |
| A `vertical` divider in a plain block container, expecting full height | Put it in a flex row, or give it an explicit `block-size` | Outside a flex container `align-self: stretch` does nothing and it falls back to `min-block-size: 1em`. |

## Accessibility, RTL, density, i18n

**Accessibility**
- Every divider is already a `separator` with the right `aria-orientation`. No
  extra ARIA is needed for a structural boundary.
- For a purely **decorative** rule, add `aria-hidden="true"` on the host so it
  isn't announced.
- Don't rely on a divider alone to communicate grouping; headings and
  `aria-label`led groups do that better.
- Under Windows High Contrast the hairline repaints as `CanvasText`, so it
  stays visible when `--md-divider-color` would be dropped.

**RTL** — `inset-start` / `inset-end` map to `margin-inline-start` /
`margin-inline-end`, so they follow `dir` automatically.

**Density** — no `density` prop and no `--md-sys-density-scale` reads. Adjust
`--md-divider-thickness` and the inset properties instead.

**i18n** — no text content.

## Related components

`md-list` · `md-list-item` · `md-card` · `md-menu` · `md-menu-item-group` ·
`md-toolbar`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-divider-color` | Line colour | `--md-sys-color-outline-variant` (`#CAC4D0`) |
| `--md-divider-thickness` | Line thickness (host block-size, or inline-size when `vertical`) | `1px` |
| `--md-divider-inset-start` | Leading inset for `inset` / `inset-start` | `16px` |
| `--md-divider-inset-end` | Trailing inset for `inset` / `inset-end` | `16px` |

**CSS parts** — `divider`.

```css
md-divider.heavy {
  --md-divider-color: var(--md-sys-color-outline);
  --md-divider-thickness: 2px;
}
```

<!-- Auto Generated Below -->


## Properties

| Property     | Attribute     | Description                                         | Type      | Default |
| ------------ | ------------- | --------------------------------------------------- | --------- | ------- |
| `inset`      | `inset`       | Middle-inset: 16px margin on both sides             | `boolean` | `false` |
| `insetEnd`   | `inset-end`   | Inset end only: 0px leading margin, 16px trailing   | `boolean` | `false` |
| `insetStart` | `inset-start` | Inset start only: 16px leading margin, 0px trailing | `boolean` | `false` |
| `vertical`   | `vertical`    | Vertical orientation                                | `boolean` | `false` |


## Shadow Parts

| Part        | Description |
| ----------- | ----------- |
| `"divider"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
