# md-tab-panel

<!-- llm:meta
tag: md-tab-panel
category: navigation
status: sub-component
parent: md-tab-panels
standalone: false
m3-guidelines: https://m3.material.io/components/tabs/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**The content of one tab.** A single `active` flag decides whether it is shown;
everything else is your content, projected through the default slot.

> 🧩 **Sub-component.** Belongs inside `md-tab-panels`, which sets `active`,
> `inert` and the ARIA pairing with the matching `md-tab`.

---

## When to use

- The content region for one tab. `md-tab-panels` owns it — it is what sets
  `active`, applies `inert`, assigns ids and wires `aria-labelledby`.

## When NOT to use

| Situation | Use instead |
|---|---|
| A collapsible section | `md-accordion-item` |
| A step's content | `md-step` |
| A routed page | Your router's outlet |
| A generic container | `md-card` or a plain element |

## API contract

```html
<md-tab-panels for="strip">
  <md-tab-panel id="p1">Overview content</md-tab-panel>
  <md-tab-panel id="p2">Activity content</md-tab-panel>
</md-tab-panels>
```

```html
<!-- The only attribute — and inside md-tab-panels you do not set it -->
<md-tab-panel active></md-tab-panel>   <!-- boolean, reflected, default: absent -->
```

**Events** — none. **Methods** — none. **Parts** — none (the component exposes
no `part` attribute).

**Slots** — `(default)`: the panel content.

### Behavioral contract worth knowing

- **`active` is the entire API**, and inside `md-tab-panels` you do not set it.
  The panel has no wiring of its own; its container listens for `md-tabs`'
  `mdTabChange` and drives `active` and `inert` for you. Set `active` by hand
  only for a panel that is not inside `md-tab-panels`.
- The host is `role="tabpanel"` and takes `tabindex="0"` while active,
  `tabindex="-1"` otherwise — so an active panel with no focusable content is
  still reachable from the tab strip, as the APG tabs pattern requires.
- An inactive panel **keeps its layout box** and is hidden with
  `visibility: hidden` on an inner wrapper, so it disappears from paint,
  assistive tech and hit-testing while `md-tab-panels`' default
  `sizing="stable"` grid keeps the region the size of the largest panel. Under
  `sizing="active"` the parent hides it with `display: none` instead.
- Ids and the `md-tab` ↔ panel ARIA pairing are **auto-assigned** by
  `md-tab-panels` where you leave them off. Set an explicit `id` (and the
  matching `md-tab`'s `controls`) when you want stable, predictable names.
  Either way both must be in the same DOM scope — IDREFs don't cross shadow
  boundaries.
- Content of inactive panels **stays in the DOM**; nothing is lazily rendered.
  Mount expensive widgets yourself on first activation.
- No `density` prop.

---

## Do / Don't

Sourced from [M3 · Tabs · Guidelines](https://m3.material.io/components/tabs/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Give each panel a stable `id` matching its tab's `controls` | Don't leave the tab↔panel link implicit when you need predictable ids |
| Let `md-tab-panels` keep exactly one panel active | Don't set `active` yourself inside the container |
| Lazy-mount expensive content on first activation | Don't build every panel's widgets up front |
| Keep panel content structurally parallel across tabs | Don't make one panel a form and another a full page |
| Let `md-tab-panels` manage sizing | Don't hardcode panel heights |
| Avoid swipeable content inside a panel | Users may swipe the wrong component (M3) |

## Patterns

```html
<md-tabs id="strip" aria-label="Project">
  <md-tab label="Overview"></md-tab>
  <md-tab label="Chart"></md-tab>
</md-tabs>

<md-tab-panels for="strip">
  <md-tab-panel id="p1">Overview content</md-tab-panel>
  <md-tab-panel id="p2"></md-tab-panel>
</md-tab-panels>

<script type="module">
  const strip  = document.getElementById('strip');
  const panels = [...document.querySelectorAll('md-tab-panel')];

  // md-tab-panels already switches `active` — this listener is only here
  // for the lazy mount.
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

```html
<!-- Outside md-tab-panels, `active` is yours to set -->
<md-tab-panel id="solo" active>Standalone content</md-tab-panel>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Setting `active` from `mdTabChange` inside `md-tab-panels` | Let the container drive it | It already does, and your writes race it. |
| Shipping `active` on a panel inside `md-tab-panels` | Leave it off | The container re-derives it from the strip on first sync. |
| A tab whose `controls` points at a different panel | Keep the tab and panel orders identical | The container pairs them by position. |
| Two panels `active` | Exactly one | Ambiguous state. |
| Heavy widgets in every panel | Lazy-mount | Inactive content is still in the DOM. |
| `display: none` applied yourself | Use `active` | You'd bypass the component's AT hiding and the stable sizing grid. |
| Looking for a `density` prop | It has none | Set density on `md-tab`. |
| `md-tab-panel` outside `md-tab-panels` | Nest it | Sizing, hiding and ARIA wiring all come from the parent. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host is `role="tabpanel"`. The parent associates it with its tab via
  `aria-labelledby` (panel side) and `aria-controls` (tab side); set an `id`
  and the tab's `controls` yourself when you want fixed names.
- The active panel is focusable (`tabindex="0"`) so keyboard users can `Tab`
  from the strip straight into the content.
- Inactive panels are hidden from assistive tech by the component (`inert`
  plus `visibility: hidden`) — don't reimplement that with your own CSS, or
  you'll leave hidden content in the accessibility tree.
- Headings inside the panel should continue the page's heading hierarchy.
- Focus ring: 3px `--md-sys-color-primary` at 2px offset.

**RTL** — content flow mirrors; the panel itself is direction-agnostic.

**Density** — no prop here; set `density="-1…-4"` on the `md-tab` children, or
use a `data-density` rung on an ancestor.

**i18n** — all content is yours. Translated content changes panel height, which
interacts with `md-tab-panels`' `sizing`.

## Related components

`md-tab-panels` · `md-tabs` · `md-tab` · `md-accordion-item` · `md-step`

## Theming

No component-scoped custom properties — style your own content. The only token
the stylesheet reads is `--md-sys-color-primary`, for the focus ring.

**CSS parts** — none.

<!-- Auto Generated Below -->


## Overview

A single tab panel. Place inside `md-tab-panels`, one per tab, in tab
order. The parent manages `active`, `inert`, and the tabs↔panel ARIA
wiring; inactive panels stay in layout (hidden) so the region's size
never jumps between tabs.

## Properties

| Property | Attribute | Description                                                         | Type      | Default |
| -------- | --------- | ------------------------------------------------------------------- | --------- | ------- |
| `active` | `active`  | Managed by md-tab-panels — reflects the associated tab's selection. | `boolean` | `false` |


## Slots

| Slot | Description   |
| ---- | ------------- |
|      | Panel content |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
