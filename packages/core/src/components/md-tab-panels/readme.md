# md-tab-panels

<!-- llm:meta
tag: md-tab-panels
category: navigation
status: sub-component
parent: none — pairs with md-tabs
standalone: false
m3-guidelines: https://m3.material.io/components/tabs/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-tab-panel
-->

**The content container that pairs with a `md-tabs` strip.** It finds the
strip, follows its `mdTabChange`, drives `active` / `inert` on its
`md-tab-panel` children, and wires the tab↔panel ARIA in both directions.

> 🧩 **Sub-component.** Meaningless without `md-tabs` and `md-tab-panel`.

---

## When to use

- As the content half of a tabbed view, alongside `md-tabs`. It is what makes
  the panels switch without any script of your own.

## When NOT to use

| Situation | Use instead |
|---|---|
| Collapsible sections | `md-accordion` |
| Steps in a flow | `md-stepper` |
| Routed pages | Your router's outlet |
| A single content region | A plain container |

## Decision cues

| Need | Setting |
|---|---|
| The region must not resize when tabs change | `sizing="stable"` (default) |
| The region should shrink-wrap the visible panel | `sizing="active"` |
| The strip is the immediately preceding sibling | omit `for` |
| The strip is elsewhere in the same DOM scope | `for="<strip id>"` |

## API contract

```html
<md-tabs id="strip" aria-label="Sections">
  <md-tab label="Overview"></md-tab>
  <md-tab label="Activity"></md-tab>
</md-tabs>

<md-tab-panels
  for="strip"              <!-- default: '' — falls back to the nearest preceding md-tabs sibling -->
  sizing="stable|active"   <!-- default: stable -->
>
  <md-tab-panel>Overview content</md-tab-panel>
  <md-tab-panel>Activity content</md-tab-panel>
</md-tab-panels>
```

**Events** — none. **Methods** — none. **Parts** — none (the component exposes
no `part` attribute).

**Slots** — `(default)`: `md-tab-panel` children, one per tab, **in tab order**.

### Behavioral contract worth knowing

- **Panels are paired with tabs by position**, not by id: the nth
  `md-tab-panel` belongs to the nth `md-tab`. Keep the two lists in the same
  order and the same length.
- The container **finds the strip itself**: by `for` (looked up in its own root
  node, then in the document), and otherwise by walking back to the nearest
  preceding `md-tabs` sibling. It then listens for `mdTabChange` and rebinds
  after a reconnect.
- On every sync it sets `active` on the matching panel and `inert` on the rest,
  assigns any missing `id`s (`md-tab-panels-<rand>-panel-<n>` /
  `-tab-<n>`), sets `aria-labelledby` on each panel, and sets `controls` on
  each tab **only if that tab has neither `controls` nor `aria-controls`
  already** — an explicit `controls` you wrote is never overwritten.
- **`sizing="stable"` (the default) stacks every panel in one CSS grid cell**,
  so the region is always as wide *and* as tall as the largest panel and the
  surrounding layout never jumps. Inactive panels keep their box and are
  hidden with `visibility`. `sizing="active"` hides them with `display: none`
  instead, which is more compact but shifts layout on every switch.
- The initial index comes from the strip's `activeTabIndex` property, falling
  back to its `active-tab-index` attribute, falling back to `0`.
- Panels forwarded through a wrapper component's own `<slot>` are still
  managed.
- Panels are **not lazily rendered**: inactive panel content is in the DOM.
  Mount expensive content yourself on first activation.
- Neither this component nor `md-tab-panel` has a `density` prop.

---

## Do / Don't

Sourced from [M3 · Tabs · Guidelines](https://m3.material.io/components/tabs/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Keep `sizing="stable"` when panel sizes differ a lot | Don't let the page jump on every tab switch |
| Keep one panel per tab, in tab order | Don't leave a tab without its panel — the pairing is positional |
| Keep the panels adjacent to their strip in the DOM | Don't scatter panels across the page |
| Point `for` at the strip's `id` when they aren't siblings | Don't rely on sibling order across a refactor |
| Render heavy panel content on first activation | Don't mount every panel's widgets up front |
| Avoid swipeable content inside panels | Users may swipe the wrong component (M3) |

## Patterns

```html
<!-- The whole widget. No script at all. -->
<md-tabs id="strip" aria-label="Project">
  <md-tab label="Overview"></md-tab>
  <md-tab label="Activity"></md-tab>
</md-tabs>

<md-tab-panels for="strip">
  <md-tab-panel>Overview content</md-tab-panel>
  <md-tab-panel>Activity content</md-tab-panel>
</md-tab-panels>
```

```html
<!-- Siblings: `for` can be omitted entirely -->
<md-tabs aria-label="Project">
  <md-tab label="Overview"></md-tab>
  <md-tab label="Activity"></md-tab>
</md-tabs>
<md-tab-panels>
  <md-tab-panel>Overview content</md-tab-panel>
  <md-tab-panel>Activity content</md-tab-panel>
</md-tab-panels>
```

```html
<!-- Compact: the region follows the active panel (accepts layout shift) -->
<md-tab-panels for="strip" sizing="active">
  <md-tab-panel>Short</md-tab-panel>
  <md-tab-panel>A much taller panel…</md-tab-panel>
</md-tab-panels>
```

```html
<!-- Listening yourself is fine for side effects — just don't also set
     `active`; the container owns that. -->
<script type="module">
  const strip  = document.getElementById('strip');
  const panels = [...document.querySelectorAll('md-tab-panel')];

  strip.addEventListener('mdTabChange', (e) => {
    const panel = panels[e.detail.index];
    if (panel && !panel.dataset.loaded) {
      // stand-in for your own expensive render
      const chart = document.createElement('div');
      chart.textContent = 'chart ' + e.detail.index;
      panel.append(chart);
      panel.dataset.loaded = '1';
    }
  });
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Toggling `active` yourself from `mdTabChange` | Let the container do it | It already listens and will fight your writes. |
| More panels than tabs, or a different order | One panel per tab, in tab order | The pairing is positional. |
| `sizing="active"` with very different panel sizes | `stable` | The region resizes on every switch. |
| `for` naming a strip that lives inside a shadow root, from outside it | Keep strip and panels in the same DOM scope | The lookup is `getRootNode().getElementById()` then `document.getElementById()`, so it reaches *outward* into the document but never *into* another shadow root. |
| Splitting strip and panels across roots at all | Same DOM scope | Even where the lookup succeeds outward, the generated `aria-controls` / `aria-labelledby` IDREFs dangle across the boundary. |
| Expecting an event or method on this element | It has neither | It is driven entirely by the strip. |
| Mounting all panels' heavy widgets | Lazy-mount on activation | Inactive panels are still in the DOM. |
| Looking for a `density` prop | Neither this nor `md-tab-panel` has one | Set density on `md-tab`. |
| Two panels `active` at once | Exactly one | Ambiguous state. |
| Swipeable carousels inside panels | Avoid, or change the gesture axis | M3 explicit rule. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The container implements the APG tabs wiring for you: each panel gets
  `aria-labelledby` pointing at its tab, and each tab gets `aria-controls`
  pointing at its panel (unless you set `controls` yourself).
- Inactive panels are made `inert` and visually hidden, so they leave the
  accessibility tree and the tab order — don't override that with your own
  CSS.
- `sizing="stable"` also helps AT users: a stable container avoids content
  reflowing under a screen-magnifier viewport.
- The container itself has no role; it is a layout box around `role="tabpanel"`
  children.

**RTL** — content flow mirrors; the container itself is direction-agnostic.

**Density** — no prop here; set `density="-1…-4"` on the `md-tab` children, or
use a `data-density` rung on an ancestor.

**i18n** — all content is yours. With `sizing="stable"` the reserved box is the
largest translated panel — re-check per locale.

## Related components

`md-tabs` · `md-tab` · `md-tab-panel` · `md-accordion` · `md-stepper`

## Theming

No custom properties — it is a layout container with no colour of its own.
Style the content inside, and theme the strip via `--md-tabs-*` /
`--md-tab-*`.

**CSS parts** — none.

<!-- Auto Generated Below -->


## Overview

Panel region for `md-tabs`: place directly AFTER the tablist (or point
`for` at its id) with one `md-tab-panel` per tab, in tab order.

- Shows the panel matching the tabs' `activeTabIndex`, following
  `mdTabChange` automatically.
- `sizing="stable"` (default): all panels stack in one grid cell and
  inactive ones stay in layout (hidden), so the region — and any
  shrink-to-fit card around it — keeps the SAME width/height no matter
  which tab is active. `sizing="active"` sizes to the active panel only.
- Wires the APG ARIA contract both ways: each tab gets `aria-controls`,
  each panel gets `aria-labelledby`, ids auto-assigned where missing.

## Properties

| Property | Attribute | Description                                                                  | Type                   | Default    |
| -------- | --------- | ---------------------------------------------------------------------------- | ---------------------- | ---------- |
| `for`    | `for`     | id of the `md-tabs` to follow. Empty = nearest preceding md-tabs sibling.    | `string`               | `''`       |
| `sizing` | `sizing`  | stable = reserve the largest panel's box; active = size to the active panel. | `"active" \| "stable"` | `'stable'` |


## Slots

| Slot | Description                          |
| ---- | ------------------------------------ |
|      | `md-tab-panel` elements, one per tab |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
