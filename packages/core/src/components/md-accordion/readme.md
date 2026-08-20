# md-accordion

<!-- llm:meta
tag: md-accordion
category: containment
status: custom
m3-guidelines: none — M3 has no accordion page
m3-derived-from: https://m3.material.io/components/lists/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-accordion-item
-->

**Progressive disclosure for a set of sections.** Groups `md-accordion-item`
children, coordinates which are expanded, wires their heading level and panel
roles, and adds optional drag/keyboard reordering plus a draggable floating
panel mode.

> ⚠️ **Not a Material Design 3 component.** M3 has no accordion page; the
> Do/Don't table below is house rules derived from M3's list and card guidance
> plus this component's actual behaviour.

> Setup, theming, density and i18n are configured once for the whole library —
> see the library-wide specification, shipped next to these manuals as
> `main-llm.md` at the root of the `@awc-ui/core` package.

---

## When to use

- Several **independent sections** where the user only needs one or two at a
  time: FAQs, settings groups, filter categories.
- Long content that would overwhelm the page fully expanded.
- Sections the user may want to reorder (`reorderable`).

## When NOT to use

| Situation | Use instead |
|---|---|
| Switching between sibling views | `md-tabs` |
| A linear, ordered process | `md-stepper` |
| A list of records | `md-list` |
| Content users need to compare side by side | Show it all, or `md-tabs` |
| A single collapsible region | One standalone `md-accordion-item` |
| Navigation | `md-navigation-rail` / `md-navigation-bar` |
| Hiding critical information | Nothing — keep it visible |

## Decision cues

| Need | Setting |
|---|---|
| Only one section open at a time | `exclusive` |
| Never allow all sections closed | `keep-one-expanded` |
| Exactly one section always open | `exclusive keep-one-expanded` |
| Open some sections initially | `default-expanded="0,2"` (comma-separated indices) |
| Tonal tiles | `variant="filled"` (default) |
| One shared outlined chassis | `variant="outlined"` |
| Raised surface | `elevation="1"` … `elevation="5"` |
| Drag / Alt+Arrow reordering | `reorderable` |
| Draggable floating panel | `floating` (+ `initial-x` / `initial-y` / `bring-to-front`) |
| Correct heading depth for the page | `heading-level="2"` … `heading-level="6"` |
| Fewer ARIA landmarks on a long accordion | `region="never"`, or **lower** `region-threshold` (higher keeps more panels as landmarks) |
| Calmer or no motion | `transition="standard\|fade\|collapse\|none"` (default `expressive`) |

## API contract

```html
<md-accordion
  variant="filled|outlined"                          <!-- default: filled -->
  exclusive                                          <!-- default: false -->
  keep-one-expanded                                  <!-- default: false -->
  default-expanded="0,2"                             <!-- default: "" -->
  heading-level="1|2|3|4|5|6"                        <!-- default: 3 -->
  region="auto|always|never"                         <!-- default: auto -->
  region-threshold="6"                               <!-- default: 6 -->
  transition="expressive|standard|fade|collapse|none" <!-- default: expressive -->
  reorderable                                        <!-- default: false -->
  floating                                           <!-- default: false -->
  initial-x="24"                                     <!-- default: 24 -->
  initial-y="24"                                     <!-- default: 24 -->
  bring-to-front                                     <!-- default: true -->
  elevation="0|1|2|3|4|5"                            <!-- default: 0 -->
  density="-1|-2|-3|-4"                              <!-- default: 0 (uncompacted; only -1…-4 have rules) -->
>
  <md-accordion-item headline="Shipping">Arrives in 3-5 days.</md-accordion-item>
  <md-accordion-item headline="Payment">Cards and bank transfer.</md-accordion-item>
</md-accordion>
```

**Events**

| Event | Detail |
|---|---|
| `mdToggle` | `{ index: number; expanded: boolean; expandedIndices: number[] }` |
| `mdReorder` | `{ from: number; to: number; order: number[] }` |
| `mdDragStart` / `mdDragMove` / `mdDragEnd` | `MdAccordionDragDetail` = `{ clientX, clientY, x, y, dx, dy }` |

All are default Stencil events (bubbling and composed). The three drag events
fire only in `floating` mode, for the panel-chassis drag — item reordering
reports through `mdReorder`, not through them.

**Methods** — none. Toggle state through the items (`md-accordion-item.toggle()`
or its `expanded` prop).

**Slots** — one unnamed default slot, for `md-accordion-item` children. Only
direct `md-accordion-item` children are collected; anything else is rendered
but not coordinated.

**Parts** — `drop-placeholder` (the dashed ghost slot shown while an item is
being dragged).

### Behavioral contract worth knowing

- `default-expanded` is a **comma-separated string of indices** (`"0,2"`), not
  an array and not ids. It is applied once, at mount; changing it later does
  nothing. An item's own `expanded` attribute counts too, and the two are
  merged.
- The initial state is resolved before anything is applied: under `exclusive`
  the **lowest** index wins and the rest collapse; under `keep-one-expanded`
  with nothing open, the first non-disabled item is forced open.
- `exclusive` collapses the others when one opens. Switching `exclusive` on at
  runtime keeps the first expanded item and collapses the rest.
- `keep-one-expanded` locks the last open panel: its header gets
  `aria-disabled="true"` and click / Enter / Space stop toggling it. The lock
  is recomputed after every toggle.
- **`region` controls ARIA only, never rendering.** `auto` gives each panel
  `role="region"` while the item count is at or below `region-threshold`
  (default 6) and downgrades to `role="group"` above it; `always` forces
  `region`; `never` forces `group`. Panels stay labelled by their header in
  every case.
- **The accordion pushes `heading-level`, the panel role and the
  collapsible lock onto its items**, overwriting whatever the item declares.
  Set them on the accordion, not on the item.
- **Keyboard is fully supported.** With a header focused: Enter / Space toggle,
  ArrowDown / ArrowUp move focus to the next / previous header (wrapping),
  Home / End jump to the first / last, and — when `reorderable` is set —
  `Alt + ArrowUp` / `Alt + ArrowDown` move the item.
- `reorderable` **does reorder the DOM itself** (it moves the item element and
  re-indexes the group) and then emits `mdReorder`. What it does not do is
  persist that order — save `event.detail.order` yourself.
- `mdReorder.detail.order` is expressed against the order captured at mount:
  moving the item that started at index 0 to index 2 yields `[1, 2, 0]`.
- A pointer reorder starts on an item's drag handle, needs at least two items,
  and skips items carrying `disabled`.
- `floating` makes the host `position: fixed` and translates it by
  `initial-x` / `initial-y`, which are **physical** viewport pixels from the
  top-left corner in both LTR and RTL. The drag grip is rendered on whichever
  item is currently first, and `bring-to-front` bumps the host `z-index` on
  drag start.
- The host is `role="presentation"` — all the semantics live on the items.
- `transition="none"` disables every expand/collapse animation unconditionally.
  You do **not** need it for reduced motion: the stylesheets already answer
  `@media (prefers-reduced-motion: reduce)` by neutralising the item's expand /
  collapse, header, icon and state-layer transitions, plus the reorder drop
  placeholder and the floating panel's motion. Reach for `transition="none"`
  only when you want the instant snap for everyone.

---

## Do / Don't

House rules, informed by
[M3 · Lists · Guidelines](https://m3.material.io/components/lists/guidelines) —
no M3 accordion page exists.

| ✅ Do | ❌ Don't |
|---|---|
| Use it for independent, skippable sections | Don't hide information users need at a glance |
| Set `heading-level` to fit the page outline | Don't leave every accordion at `3` regardless of context |
| Use `exclusive` when sections are alternatives | Don't force `exclusive` when users need to compare two sections |
| Keep headlines short and scannable | Don't write sentence-long headlines |
| Let `region="auto"` manage landmarks | Don't force `always` on a 30-section accordion |
| Persist the order after `mdReorder` | Don't assume the component saved it |
| Let the built-in `prefers-reduced-motion` handling do its job | Don't hand-roll a `matchMedia` listener to set `transition="none"` |
| Keep sections structurally parallel | Don't mix a form, a table and prose across sibling sections |

---

## Patterns

```html
<!-- FAQ: one open at a time, first one open on load -->
<md-accordion id="faq" exclusive heading-level="2" default-expanded="0">
  <md-accordion-item headline="How do refunds work?">
    <p>Within 30 days of delivery.</p>
  </md-accordion-item>
  <md-accordion-item headline="Can I change my plan?">
    <p>Yes, at any time.</p>
  </md-accordion-item>
</md-accordion>

<script type="module">
  document.getElementById('faq').addEventListener('mdToggle', (e) => {
    // { index, expanded, expandedIndices }
    console.log(e.detail.index, e.detail.expanded, e.detail.expandedIndices);
  });
</script>
```

```html
<!-- Settings groups: exactly one section is always open -->
<md-accordion exclusive keep-one-expanded variant="outlined" heading-level="2">
  <md-accordion-item headline="Account" icon="person">…</md-accordion-item>
  <md-accordion-item headline="Notifications" icon="notifications">…</md-accordion-item>
  <md-accordion-item headline="Privacy" icon="lock">…</md-accordion-item>
</md-accordion>
```

```html
<!-- Reorderable sections: the DOM moves, you persist the order -->
<md-accordion id="sections" reorderable>
  <md-accordion-item headline="Summary">…</md-accordion-item>
  <md-accordion-item headline="Details">…</md-accordion-item>
  <md-accordion-item headline="History">…</md-accordion-item>
</md-accordion>

<script type="module">
  document.getElementById('sections').addEventListener('mdReorder', (e) => {
    // e.detail.order is the new sequence of the ORIGINAL indices, e.g. [1, 2, 0]
    localStorage.setItem('section-order', JSON.stringify(e.detail.order));
  });
</script>
```

```html
<!-- Many sections: avoid a landmark per panel -->
<md-accordion region="never" heading-level="2">
  <md-accordion-item headline="Section 1">…</md-accordion-item>
  <!-- …30 more… -->
</md-accordion>
```

```html
<!-- Calmer motion for everyone. Reduced motion needs no code: the component's
     own CSS already neutralises the animation under
     @media (prefers-reduced-motion: reduce). -->
<md-accordion transition="collapse">
  <md-accordion-item headline="Details">…</md-accordion-item>
</md-accordion>
```

```html
<!-- Floating, draggable panel -->
<md-accordion id="inspector" floating initial-x="48" initial-y="96"
              variant="outlined">
  <md-accordion-item headline="Layers">…</md-accordion-item>
  <md-accordion-item headline="Styles">…</md-accordion-item>
</md-accordion>

<script type="module">
  document.getElementById('inspector')
    .addEventListener('mdDragEnd', (e) => {
      localStorage.setItem('inspector-pos', JSON.stringify([e.detail.x, e.detail.y]));
    });
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `default-expanded="['0','2']"` | `default-expanded="0,2"` | It is a comma-separated string of indices. |
| Changing `default-expanded` to drive state after mount | Set `expanded` on the item, or call its `toggle()` | It is applied once, at mount. |
| Reading `e.detail.expanded` as the whole group state | Use `e.detail.expandedIndices` | `expanded` describes only the item that just toggled. |
| Listening for `mdDragStart` / `mdDragMove` / `mdDragEnd` to track reordering | Listen for `mdReorder` | The drag events belong to the `floating` chassis, not to item reordering. |
| Expecting `mdReorder` to persist the order | Save `e.detail.order` | The component reorders the DOM but stores nothing. |
| Setting `heading-level` / `region-role` on the items | Set `heading-level` / `region` on the accordion | The parent pushes its values onto every item. |
| `region="always"` on 30 sections | `auto` or `never` | A landmark per section is noise for assistive tech. |
| Adding your own keyboard reorder shortcut | Use the built-in `Alt + ArrowUp` / `Alt + ArrowDown` | It is already implemented when `reorderable` is set. |
| `keep-one-expanded` with every item `disabled` | Leave at least one enabled | There is then nothing the group can force open. |
| Accordion for sibling views | `md-tabs` | Different navigation model. |
| Accordion for an ordered process | `md-stepper` | Steps have sequence and validation. |
| Non-`md-accordion-item` children | Only `md-accordion-item` at the top level | Other elements render but are never coordinated. |
| Hiding critical content behind a collapsed section | Keep it visible | Collapsed content is easy to miss. |
| `exclusive` for sections users compare | Allow multiple | Forces constant re-opening. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host is `role="presentation"`; each item renders a real `<h1>`–`<h6>`
  wrapping a `<button>` with `aria-expanded` and `aria-controls`, and a panel
  labelled by that button.
- `heading-level` is a real accessibility control, not styling — a wrong level
  breaks heading navigation. Set it to match the surrounding outline.
- The `region` threshold exists because a landmark per panel becomes noise past
  a handful of sections; trust `auto` unless you have a reason.
- Full keyboard support: Enter / Space toggle, ArrowUp / ArrowDown move between
  headers with wrapping, Home / End jump to the ends, and `Alt + ArrowUp` /
  `Alt + ArrowDown` reorder when `reorderable` is set. Reordering is therefore
  **not** pointer-only.
- A panel locked open by `keep-one-expanded` stays focusable and announces
  `aria-disabled="true"`, so screen-reader users can tell it is the open one.
  A `disabled` item's header is natively disabled and skipped entirely.
- `prefers-reduced-motion: reduce` is honoured by the component's own CSS —
  expand / collapse, header, icon, drop-placeholder and floating-panel motion
  are all neutralised. There is nothing to wire up.

**RTL** — item layout, drag handles and padding are logical and mirror under
`dir="rtl"`. `floating`'s `initial-x` / `initial-y` are the exception: they are
physical viewport coordinates from the top-left corner in both directions.

**Density** — set `density="-1"` … `density="-4"` for a local rung, or inherit a
global `data-density` ancestor. Rung `0` is the uncompacted default and has no
rule of its own, so `density="0"` does **not** opt an accordion out of an
inherited rung; use `style="--md-sys-density-scale: 0"` to reset the scale
locally. The rung set on the accordion cascades to its items.

**i18n** — headlines, supporting text and panel content are yours to translate;
longer headlines wrap, so check header height per locale.

## Related components

`md-accordion-item` · `md-tabs` · `md-stepper` · `md-list` · `md-card` ·
`md-divider`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-accordion-gap` | Gap between items (`filled` variant) | `--md-sys-spacing-gap-sm` (8px) |
| `--md-accordion-outline-color` | `outlined` chassis border | `--md-sys-color-outline-variant` |
| `--md-accordion-container-shape` | Corner radius of the outer chassis | `max(8px, 12px + density × 1px)` |
| `--md-accordion-elevation` | Explicit shadow; wins over the `elevation` attribute | `--md-sys-elevation-0` |
| `--md-accordion-floating-width` | Width of the floating panel | `360px` |
| `--md-accordion-floating-bg` | Surface tint of the floating panel | `--md-sys-color-surface-container-low` |
| `--md-accordion-floating-radius` | Corner radius of the floating chassis | `--md-sys-shape-corner-large` (16px) |
| `--md-accordion-floating-elevation` | Resting shadow of the floating panel | `--md-sys-elevation-3` |
| `--md-accordion-floating-elevation-active` | Shadow while the floating panel is dragged | `--md-sys-elevation-5` |
| `--md-accordion-drop-placeholder-color` | Ghost-slot fill during a reorder drag | 45% `--md-sys-color-primary-container` |
| `--md-accordion-drop-placeholder-outline-color` | Ghost-slot dashed border colour | 55% `--md-sys-color-primary` |
| `--md-accordion-drop-placeholder-outline-width` | Ghost-slot border width | `2px` |
| `--md-accordion-drop-placeholder-shape` | Ghost-slot corner radius | `--md-accordion-container-shape` |
| `--md-accordion-drop-placeholder-opacity` | Ghost-slot opacity | `1` |

Per-item surface, header, icon and motion properties are read by
`md-accordion-item`'s own stylesheet — see its Theming table. Because custom
properties inherit, you can still set them on `<md-accordion>` to apply them to
every item.

**CSS parts** — `drop-placeholder`.

```css
md-accordion.settings {
  --md-accordion-gap: 4px;
  --md-accordion-outline-color: var(--md-sys-color-outline);
}

md-accordion.settings::part(drop-placeholder) {
  --md-accordion-drop-placeholder-outline-width: 1px;
}
```

<!-- Auto Generated Below -->


## Properties

| Property          | Attribute           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Type                                                           | Default        |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------- |
| `bringToFront`    | `bring-to-front`    | When a floating accordion starts being dragged, bring it to the front by bumping `z-index`. Disable if you manage stacking yourself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `boolean`                                                      | `true`         |
| `defaultExpanded` | `default-expanded`  | Comma-separated list of item indexes that should be expanded on first render. Items with `expanded` set in their own attribute also count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `string`                                                       | `''`           |
| `density`         | `density`           | Density scale: `0` (default, 56 dp headers), `-1` (48 dp), `-2` (40 dp).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `-1 \| -2 \| -3 \| -4 \| 0`                                    | `0`            |
| `elevation`       | `elevation`         | MD3 elevation level applied to the surface — `0` (default, flat) through `5` (highest). In the `filled` variant each item gets its own shadow; in the `outlined` variant the shadow is drawn on the shared chassis. Expanded items lift to the next elevation level for an expressive "lift off the page" affordance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `0 \| 1 \| 2 \| 3 \| 4 \| 5`                                   | `0`            |
| `exclusive`       | `exclusive`         | Whether only one item may be expanded at a time. When `true`, expanding an item collapses any other expanded item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `boolean`                                                      | `false`        |
| `floating`        | `floating`          | Render the accordion as a free-floating panel that can be dragged anywhere on the screen via the top drag-bar. The panel uses `position: fixed` and translates via CSS transform, so it lifts out of normal document flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `boolean`                                                      | `false`        |
| `headingLevel`    | `heading-level`     | ARIA heading level for each item's heading wrapper (`<h1>`–`<h6>`). Pick the value matching the page's information architecture — e.g. `2` inside a top-level page section, `4` deep inside a card. APG: "aria-level that is appropriate for the information architecture of the page". Default `3`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `1 \| 2 \| 3 \| 4 \| 5 \| 6`                                   | `3`            |
| `initialX`        | `initial-x`         | Initial X translation (px) for floating panels — measured in PHYSICAL viewport coordinates from the top-left corner of the viewport, so a positive value always moves the panel to the right regardless of writing direction (LTR or RTL). Default: 24.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `number`                                                       | `24`           |
| `initialY`        | `initial-y`         | Initial Y translation (px) for floating panels — measured in physical viewport coordinates from the top-left corner. Default: 24.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `number`                                                       | `24`           |
| `keepOneExpanded` | `keep-one-expanded` | Require at least one item to remain expanded. APG variant: the implementation does not permit the currently-open panel to be collapsed when doing so would leave zero panels open. The locked- open button advertises `aria-disabled="true"`. Pairs naturally with `exclusive` to enforce "exactly one panel is always open".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `boolean`                                                      | `false`        |
| `region`          | `region`            | Region-role policy for panels: - `auto` (default) — applies `role="region"` only when the item   count is at or below `region-threshold`, otherwise downgrades   to `role="group"` to avoid landmark proliferation (per APG   recommendation for accordions with more than ~6 panels). - `always` — every panel is a landmark region. - `never` — no panel carries a region role (still labelled via   `aria-labelledby` though).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `"always" \| "auto" \| "never"`                                | `'auto'`       |
| `regionThreshold` | `region-threshold`  | Threshold above which `region="auto"` downgrades panel roles from `region` to `group`. APG suggests ~6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `number`                                                       | `6`            |
| `reorderable`     | `reorderable`       | Allow drag-to-reorder of items via the leading drag handles. Items can also be reordered with `Alt + ArrowUp / ArrowDown` while the header is focused. Disabled items can't be moved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `boolean`                                                      | `false`        |
| `transition`      | `transition`        | Motion preset applied when items expand and collapse. The prop is reflected so the item CSS can pick it up via `:host-context(md-accordion[transition="…"])`.  - `expressive` (default) — full MD3 Expressive choreography:    asymmetric easing (decelerate-on-open, accelerate-on-close),    spring-spatial chevron rotation, container shape & elevation    morph, leading-icon FILL-axis swap. Use for hero surfaces,    settings shells, anything that wants to feel premium. - `standard` — MD3 standard easing (symmetric `emphasized`) with    no spring overshoot. Container morph still happens. The    "neutral" preset — good default for dense product UI. - `fade` — content fades in/out alongside the height animation    using shorter `standard` easing. Chevron rotates without a    spring. Best for content-heavy panels (forms, long copy)    where the motion should be unobtrusive. - `collapse` — pure height collapse with simple `ease-in-out`    timing — no spring, no morph, no fade. The classic    "browser disclosure" look. - `none` — disables every transition (instant snap). Useful for    automated tests, screenshot harnesses, or environments where    motion is undesirable. | `"collapse" \| "expressive" \| "fade" \| "none" \| "standard"` | `'expressive'` |
| `variant`         | `variant`           | Visual variant. Both share the same expand/collapse mechanics. - `filled` (default) — each item is a tonal surface tile. - `outlined` — items share a single rounded chassis with an outline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `"filled" \| "outlined"`                                       | `'filled'`     |


## Events

| Event         | Description                                                                                                                                                                                                                                    | Type                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `mdDragEnd`   | Emitted when a floating panel is released.                                                                                                                                                                                                     | `CustomEvent<MdAccordionDragDetail>`                                            |
| `mdDragMove`  | Emitted continuously while a floating panel is being dragged.                                                                                                                                                                                  | `CustomEvent<MdAccordionDragDetail>`                                            |
| `mdDragStart` | Emitted once a floating panel starts being dragged.                                                                                                                                                                                            | `CustomEvent<MdAccordionDragDetail>`                                            |
| `mdReorder`   | Emitted when items are reordered via drag-and-drop or keyboard (Alt+ArrowUp / Alt+ArrowDown). `order` is the new index sequence relative to the original order, e.g. moving the item that was at index 0 to index 2 yields `order: [1, 2, 0]`. | `CustomEvent<{ from: number; to: number; order: number[]; }>`                   |
| `mdToggle`    | Emitted when an item expands or collapses. Detail carries the full set of expanded indices.                                                                                                                                                    | `CustomEvent<{ index: number; expanded: boolean; expandedIndices: number[]; }>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
