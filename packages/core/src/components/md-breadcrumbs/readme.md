# md-breadcrumbs

<!-- llm:meta
tag: md-breadcrumbs
category: navigation
status: custom
m3-guidelines: none — M3 has no breadcrumbs page
form-associated: false
depends-on: none
used-by: none
accepts-children: md-breadcrumb-item
-->

**Where the user is in a hierarchy, and the way back up.** Wraps a trail of
`md-breadcrumb-item` children in a labelled navigation region, keeps their
position data in sync, and can collapse the middle of a long trail behind an
overflow control.

> ⚠️ **Not a Material Design 3 component.** M3 has no breadcrumbs page; the
> Do / Don't below is house rules plus general navigation practice.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- A **hierarchical** structure the user navigates into and back out of: file
  trees, category pages, nested settings.
- The path itself carries meaning and users need to jump to an ancestor.

## When NOT to use

| Situation | Use instead |
|---|---|
| A flat site with 2–3 destinations | `md-navigation-bar` / `md-tabs` |
| A linear process | `md-stepper` |
| Sibling views within a screen | `md-tabs` |
| Top-level navigation | `md-navigation-rail` / `md-navigation-bar` |
| Undo/back only | A back `md-icon-button` in `md-app-bar` |
| A single level deep | Nothing — the header says it |

## Decision cues

| Need | Setting |
|---|---|
| Show the whole trail, however long | `max-items="0"` (the default) |
| Collapse a long trail | `max-items="4"` |
| How many leading crumbs stay visible | `items-before-collapse` (default 1) |
| How many trailing crumbs stay visible | `items-after-collapse` (default 2, floor 1) |
| Custom separator glyph or text | `separator="›"` |
| An SVG separator | `::part(separator)` on both this and `md-breadcrumb-item` |
| Localized overflow control name | `expand-label` |
| Name the navigation region | `label` |
| Compact trail | `density="-1…-4"` |

## API contract

```html
<md-breadcrumbs
  label="Breadcrumb"                            <!-- default: Breadcrumb -->
  separator="/"                                 <!-- default: / -->
  max-items="4"                                 <!-- default: 0 — collapsing off -->
  items-before-collapse="1"                     <!-- default: 1 -->
  items-after-collapse="2"                      <!-- default: 2 -->
  expand-label="Show full breadcrumb trail"     <!-- default: Show full breadcrumb trail -->
  density="-1|-2|-3|-4"                         <!-- default: 0 — the uncompacted rung, which is inert -->
>
  <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
  <md-breadcrumb-item href="/docs">Docs</md-breadcrumb-item>
  <md-breadcrumb-item>Buttons</md-breadcrumb-item>
</md-breadcrumbs>
```

**Events** — `mdExpand` with detail
`{ expanded: boolean; itemCount: number }`. Bubbles and is composed. The
visibility change has already happened when it fires, so `preventDefault()`
does nothing.

**Methods** — `expand() => Promise<void>`, `collapse() => Promise<void>`.

**Slots** — `(default)`: the `md-breadcrumb-item` children. There is **no**
`separator` slot — see below.

**Parts** — `list` (the `<ol>`), `overflow` (the "…" list item),
`overflow-button` (the button inside it), and `separator` — which on *this*
element matches only the separator drawn inside the overflow item. The
separators between crumbs belong to `md-breadcrumb-item`.

### Behavioral contract worth knowing

- **`max-items="0"` (the default) means no collapsing** — show everything. It
  does not mean "show none".
- Collapsing keeps the first `items-before-collapse` and the last
  `items-after-collapse` crumbs, with the overflow control between them. The
  after count is floored at **1**, so `items-after-collapse="0"` behaves as
  `1`. With `items-before-collapse="0"` the overflow's leading separator is
  dropped so nothing dangles at the start of the trail.
- If `items-before-collapse + items-after-collapse` is at least the number of
  crumbs, **no crumb is hidden but the overflow button still renders** —
  because the button's condition is only "more crumbs than `max-items`". Keep
  the two counts below the trail length.
- Activating the overflow control expands the trail and **removes the control
  from the DOM**; from then on the only way back to the collapsed view is the
  `collapse()` method.
- `expand()` / `collapse()` are no-ops when the trail is already in that state.
  Otherwise they flip it and emit `mdExpand` — including when `max-items="0"`,
  where nothing visible changes.
- **The last crumb is promoted to `current` automatically.** The component
  clears `current` from every other crumb — unless you explicitly set `current`
  on a crumb that is *not* last, which switches the auto-promotion off entirely
  and leaves your markup alone.
- Position data (`item-index`, `item-total`) is written onto every crumb by
  this component, and re-written on slot change and whenever the collapse props
  change. `md-breadcrumb-item` uses it to decide whether to draw its own
  leading separator.
- Only **direct** `md-breadcrumb-item` children are collected — crumbs
  forwarded through a wrapper component's `<slot>` are not seen. Render the
  items directly inside `md-breadcrumbs`.
- **There is no `separator` slot.** A single named slot can only project into
  one position in the shadow tree, and a trail needs an identical separator
  between *every* pair of crumbs — so each `md-breadcrumb-item` reads the
  parent's `separator` string and draws its own.
- Crumbs enter with a staggered fade-and-slide; the stagger is pre-baked for
  the first 12 items and the whole animation is disabled under
  `prefers-reduced-motion: reduce`.

---

## Do / Don't

House rules, informed by general navigation practice — no M3 breadcrumbs page
exists.

| ✅ Do | ❌ Don't |
|---|---|
| Let the last crumb be the current page, without an `href` | Don't make the current page a link |
| Keep crumb labels short — the page's own name | Don't repeat the full page title in each crumb |
| Collapse long trails with `max-items` | Don't wrap a long trail onto three lines |
| Keep the trail in real hierarchy order | Don't reorder crumbs by recency — that's history, not hierarchy |
| Localize `label` and `expand-label` | Don't ship the English defaults |
| Use breadcrumbs **in addition to** primary navigation | Don't make breadcrumbs the only way to navigate up |
| Pick a separator with clear visual meaning | Don't use a glyph that reads as content |
| Keep them near the top of the content region | Don't bury the trail mid-page |

---

## Patterns

```html
<md-breadcrumbs id="crumbs" label="Breadcrumb">
  <md-breadcrumb-item href="/" icon="home">Home</md-breadcrumb-item>
  <md-breadcrumb-item href="/library">Library</md-breadcrumb-item>
  <md-breadcrumb-item href="/library/data">Data</md-breadcrumb-item>
  <md-breadcrumb-item>Tables</md-breadcrumb-item>
</md-breadcrumbs>

<script type="module">
  const crumbs = document.getElementById('crumbs');
  crumbs.addEventListener('mdExpand', (e) => {
    console.log('expanded:', e.detail.expanded, 'of', e.detail.itemCount);
  });
</script>
```

```html
<!-- Deep trail: Home … Data / Tables -->
<md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
  <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
  <md-breadcrumb-item href="/a">Projects</md-breadcrumb-item>
  <md-breadcrumb-item href="/a/b">2026</md-breadcrumb-item>
  <md-breadcrumb-item href="/a/b/c">Q3</md-breadcrumb-item>
  <md-breadcrumb-item href="/a/b/c/d">Data</md-breadcrumb-item>
  <md-breadcrumb-item>Tables</md-breadcrumb-item>
</md-breadcrumbs>
```

```html
<!-- Chevron separator: a string prop, not a slot -->
<md-breadcrumbs separator="›">
  <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
  <md-breadcrumb-item>Settings</md-breadcrumb-item>
</md-breadcrumbs>

<style>
  /* Or draw it yourself. Both parts are needed: the item renders the
     separators between crumbs, the parent renders the one in the
     overflow control. */
  md-breadcrumb-item::part(separator),
  md-breadcrumbs::part(separator) {
    font-size: 0;
    inline-size: 16px;
    block-size: 16px;
    background: center / contain no-repeat url('/chevron.svg');
  }
</style>
```

```html
<!-- Localized region and control names -->
<md-breadcrumbs label="Fil d'Ariane" expand-label="Afficher le chemin complet" max-items="4">
  <md-breadcrumb-item href="/">Accueil</md-breadcrumb-item>
  <md-breadcrumb-item href="/bibliotheque">Bibliothèque</md-breadcrumb-item>
  <md-breadcrumb-item>Tableaux</md-breadcrumb-item>
</md-breadcrumbs>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `max-items="0"` expecting everything hidden | `0` disables collapsing | Same "0 means off" trap as elsewhere. |
| `items-before-collapse` + `items-after-collapse` ≥ the crumb count | Keep them smaller | Nothing gets hidden, yet the "…" button still renders. |
| `items-after-collapse="0"` to show only leading crumbs | Use `1` and mean it | The value is floored at 1. |
| Setting `current` on the last crumb "to be safe" | Leave it off | It is promoted automatically; setting it on a *non-last* crumb disables that promotion. |
| Giving the last crumb an `href` | Leave it link-less | It's the page you're already on. |
| Wrapping the crumbs in your own component's `<slot>` | Render them as direct children | Only direct children are collected. |
| Expecting the "…" button to re-collapse the trail | Call `collapse()` | The button is removed once expanded. |
| Breadcrumbs as the only up-navigation | Pair with real navigation | Not a primary nav pattern. |
| Trail built from browsing history | Use the real hierarchy | Breadcrumbs are structural. |
| Default English `label` / `expand-label` in a localized app | Translate them | They're the region and control names. |
| Breadcrumbs on a flat site | Drop them | They imply depth that isn't there. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host is `role="navigation"` named by `label` (default `"Breadcrumb"`) —
  translate it. Inside, the crumbs sit in an `<ol>`.
- The current page is exposed via `aria-current="page"` on the last crumb; that
  happens automatically, so don't reimplement it.
- Separators are `aria-hidden` and never announced.
- The overflow control is a real `<button>` with `aria-expanded` and the name
  from `expand-label`; give it a meaningful, localized value.
- Keep crumb order in the DOM identical to the visual order — the collapse
  logic reorders visually with CSS `order`, which does not change reading
  order.
- Under `forced-colors` the separator uses `GrayText` and the overflow button
  gains a `CanvasText` border.

**RTL** — set `dir="rtl"` on the element or an ancestor: the trail direction
mirrors, the entrance animation slides from the opposite side, and separator
glyphs get `unicode-bidi: plaintext`. A directional glyph (`›`, `→`) must be
swapped by you; a neutral `/` needs nothing.

**Density** — `density="-1…-4"` tightens the gap between crumbs and the
separator glyph size (crumb padding is on `md-breadcrumb-item`, which takes the
same rung). Only those four rungs exist. Rung `0` is the uncompacted default
and is inert — `density="0"` does **not** opt the trail out of an ancestor's
`data-density` rung; use `style="--md-sys-density-scale: 0"` for that (the
ancestor's `--md-sys-spacing-*` payload still inherits).

**i18n** — translate `label`, `expand-label`, and each crumb's text. Long
translated crumbs are exactly when `max-items` earns its keep.

## Related components

`md-breadcrumb-item` · `md-app-bar` · `md-tabs` · `md-navigation-rail` ·
`md-stepper` · `md-menu`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-breadcrumbs-gap` | Space between crumbs and separators | `calc(8px + density * 2px)` |
| `--md-breadcrumbs-separator-color` | Separator glyph colour | `--md-sys-color-on-surface-variant` |
| `--md-breadcrumbs-text-color` | Trail text colour (inherited by crumbs) | `--md-sys-color-on-surface-variant` |
| `--md-breadcrumbs-stagger` | Per-item entrance delay | `40ms` |

**CSS parts** — `list`, `overflow`, `overflow-button`, `separator` (the
overflow one only).

Per-crumb colours use the `--md-breadcrumb-item-*` properties documented on
`md-breadcrumb-item`.

```css
md-breadcrumbs {
  --md-breadcrumbs-gap: 4px;
  --md-breadcrumbs-separator-color: var(--md-sys-color-outline);
  --md-breadcrumbs-stagger: 0ms;
}
```

<!-- Auto Generated Below -->


## Properties

| Property              | Attribute               | Description                                                                                                                                                                                                                      | Type                        | Default                        |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------ |
| `density`             | `density`               | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                            | `-1 \| -2 \| -3 \| -4 \| 0` | `0`                            |
| `expandLabel`         | `expand-label`          | Accessible name for the overflow ("…") toggle button. Surface this in your i18n layer so screen-reader users in non-English locales hear a localized announcement when collapsing is in effect.                                  | `string`                    | `'Show full breadcrumb trail'` |
| `itemsAfterCollapse`  | `items-after-collapse`  | How many items to ALWAYS show at the end of the trail when collapsed. Default 2.                                                                                                                                                 | `number`                    | `2`                            |
| `itemsBeforeCollapse` | `items-before-collapse` | How many items to ALWAYS show at the start of the trail when collapsed. Default 1.                                                                                                                                               | `number`                    | `1`                            |
| `label`               | `label`                 | Accessible name. Defaults to "Breadcrumb".                                                                                                                                                                                       | `string`                    | `'Breadcrumb'`                 |
| `maxItems`            | `max-items`             | When the number of crumbs exceeds `maxItems`, the middle ones collapse behind an "…" toggle. Set to `0` to disable collapsing.                                                                                                   | `number`                    | `0`                            |
| `separator`           | `separator`             | Separator glyph placed between items. Use any single character or short string (e.g. `/`, `›`, `→`, `»`). For SVG / icon separators, override `::part(separator)` from the light DOM with a CSS `background-image` — see readme. | `string`                    | `'/'`                          |


## Events

| Event      | Description                                                                                                                                                                                                                                                                                                                                                                                        | Type                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `mdExpand` | Fires when the user reveals the full breadcrumb trail by activating the overflow ("…") toggle, or when consumers programmatically call `expand()` / `collapse()`. Not cancelable — the visibility change has already happened. Use it for analytics or to react to a user who wants to see the full path.  Bubbles + composed, so consumers outside the shadow tree (the typical case) receive it. | `CustomEvent<MdBreadcrumbsExpandDetail>` |


## Methods

### `collapse() => Promise<void>`

Programmatically re-collapse the trail to the configured
before/after window. No-op when the trail is already collapsed. When
`maxItems` is `0` (collapsing disabled) nothing visible changes, but the
state still flips and `mdExpand` still fires.

#### Returns

Type: `Promise<void>`



### `expand() => Promise<void>`

Programmatically reveal the full breadcrumb trail. No-op when the trail
is already expanded. When `maxItems` is `0` (collapsing disabled) nothing
visible changes, but the state still flips and `mdExpand` still fires.

#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part                | Description |
| ------------------- | ----------- |
| `"list"`            |             |
| `"overflow"`        |             |
| `"overflow-button"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
