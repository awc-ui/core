# md-tabs

<!-- llm:meta
tag: md-tabs
category: navigation
status: md3-mapped
m3-guidelines: https://m3.material.io/components/tabs/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-tab
-->

**Switch between sibling views within one screen.** The tab strip owns the
active index, roving focus, the child tabs' `variant`, and the sliding
indicator. It renders no content of its own — pair it with `md-tab-panels`.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- **Peer categories of related content** on one screen: Overview / Activity /
  Settings.
- The user should be able to move between them freely, in any order.

## When NOT to use

| Situation | Use instead |
|---|---|
| Sequential content meant to be read in order | Hierarchy in the content — typography and spacing |
| A linear process with validation | `md-stepper` |
| Top-level app destinations | `md-navigation-bar` / `md-navigation-rail` |
| Independent collapsible sections | `md-accordion` |
| Choosing a value or mode | `md-segmented-button-set` |
| Actions rather than views | `md-button-group` / `md-toolbar` |
| Many categories that won't fit | `md-select`, or a menu |

## Decision cues

| Need | Setting |
|---|---|
| Top-level tabs on a surface | `variant="primary"` (default) |
| Nested tabs inside a primary set | `variant="secondary"` |
| Tabs share the strip width evenly | `tab-width="equal"` (default) |
| Tabs size to their labels, strip scrolls | `tab-width="auto"` |
| Every tab on an identical fixed track | `tab-width="140px"` (any CSS length) |
| Stop the strip collapsing in a shrink-to-fit parent | `width="480px"` (any CSS size) |
| Name the tab set | `aria-label` |
| Select a tab from code | `active-tab-index`, or `selectTab(i)` |

## API contract

```html
<md-tabs
  active-tab-index="0"                  <!-- default: 0 -->
  variant="primary|secondary"           <!-- default: primary -->
  tab-width="equal|auto|<css-length>"   <!-- default: equal -->
  width=""                              <!-- default: '' — strip is 100% of its parent -->
  aria-label="Project sections"         <!-- default: '' — renders as "tabs" -->
>
  <md-tab label="Overview" controls="p-overview"></md-tab>
  <md-tab label="Activity" controls="p-activity"></md-tab>
</md-tabs>
```

**Events** — `mdTabChange` with detail `{ index: number; previousIndex: number }`.
Bubbles and is composed, so a delegated listener on an ancestor works.

**Methods** — `selectTab(index: number) => Promise<void>`. An index below `0`
is a silent no-op; an index past the last slotted `md-tab` is remembered and
applied once a tab at that position slots in. There is no public tab-count
property — count the slotted `md-tab` children yourself if you need the bound.

**Slots** — `(default)`: `md-tab` children. No other slot.

**Parts** — `container` (the scrolling strip).

### Behavioral contract worth knowing

- **`md-tabs` has no `density` prop** — one of the few. Density lives on the
  individual `md-tab` children.
- **The strip stamps `variant` onto every child tab** on slot change and
  whenever `variant` changes, so you never set it per tab.
- The strip and the panels are **separate components**. `md-tabs` renders no
  content; use `md-tab-panels`, which finds the strip and drives the panels
  itself.
- `active-tab-index` is the source of truth and is **fully reactive**: writing
  it moves the active state, the roving tab stop and the scroll position, and
  glides the indicator — exactly like a click. It does not emit `mdTabChange`
  (you already know); clicks, keyboard navigation and `selectTab()` do, unless
  the tab was already the active one.
- The value is sanitized and clamped: `NaN`, floats and out-of-range numbers
  cannot wipe the strip, and a **disabled** target is skipped to the next
  enabled tab. Setting an index past the last tab is remembered and honoured
  once that tab is slotted in — the "append a tab and select it" case.
- Selection follows the active tab **element**, not its position. Removing or
  reordering a preceding tab keeps the same tab selected.
- If every tab is disabled, nothing is selected. `mdTabChange` emits
  `{ index: -1 }` **only as a transition** — when a tab was selected and then
  the last enabled tab became disabled or was removed. A strip that renders
  with every tab disabled from the start emits **nothing**, so don't wait on a
  mount-time `index: -1` to run initialisation.
- The strip is the **only** writer of `tabindex` on its tabs: exactly one tab
  is focusable at a time.
- Keyboard: `ArrowLeft` / `ArrowRight` move **and activate** (automatic
  activation), wrapping past the ends and skipping disabled tabs; `Home` /
  `End` jump to the first / last enabled tab. Under `dir="rtl"` the arrows
  follow visual direction.
- Tabs without an `id` get one assigned (`md-tabs-<rand>-tab-<n>`).
- Tabs forwarded through a wrapper component's own `<slot>` are still managed.
- When the strip overflows, the scrollbar is hidden by design: a **vertical
  wheel scrolls it horizontally**, and an edge mask fades the clipped side.
- The indicator glide and the scroll-into-view animation are skipped under
  `prefers-reduced-motion: reduce`.
- Tabs are **views**, not values: no form participation, no multi-select.

---

## Do / Don't

Sourced from [M3 · Tabs · Guidelines](https://m3.material.io/components/tabs/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use tabs to categorise related groups of content into clearly defined sets | Don't use tabs for sequential content that must be read in order — build hierarchy in the content instead |
| Use globally recognised icons if you use icons alone | Don't mix icon+text tabs with icon-only or text-only tabs in the same set |
| Offset the first scrollable tab from the leading edge so it's clear more tabs exist | Don't hide the fact that the strip scrolls |
| Keep labels short enough to avoid truncation | Don't truncate labels unless forced — it impedes comprehension |
| Use distinct gesture directions when tabs are swipeable | Avoid swipeable items inside a tabbed content area — users swipe the wrong thing |
| Let tabs scroll off and return with the page | Don't scroll tabs behind an app bar — attached tabs should move as one unit |
| Name the tab set | Don't ship an unnamed tab strip |

---

## Patterns

```html
<!-- The whole widget. No script: md-tab-panels finds the strip, follows
     mdTabChange, and wires aria-controls / aria-labelledby both ways. -->
<md-tabs id="strip" aria-label="Project sections">
  <md-tab label="Overview" controls="p1"></md-tab>
  <md-tab label="Activity" controls="p2"></md-tab>
  <md-tab label="Settings" controls="p3"></md-tab>
</md-tabs>

<md-tab-panels for="strip">
  <md-tab-panel id="p1">Overview content</md-tab-panel>
  <md-tab-panel id="p2">Activity content</md-tab-panel>
  <md-tab-panel id="p3">Settings content</md-tab-panel>
</md-tab-panels>
```

```html
<!-- React to the change for side effects (analytics, lazy mount, routing) -->
<script type="module">
  const strip = document.getElementById('strip');
  strip.addEventListener('mdTabChange', (e) => {
    console.log(e.detail.index, e.detail.previousIndex);
  });

  // Deep link — selects tab 3 and emits mdTabChange
  strip.selectTab(2);

  // Same move without the event
  strip.activeTabIndex = 2;
</script>
```

```html
<!-- Icons consistently on every tab -->
<md-tabs aria-label="Library">
  <md-tab label="Songs"  icon="music_note"></md-tab>
  <md-tab label="Albums" icon="album"></md-tab>
</md-tabs>

<!-- Nested tabs inside a primary set: set variant on the STRIP only -->
<md-tabs variant="secondary" aria-label="Report views">
  <md-tab label="Table"></md-tab>
  <md-tab label="Chart"></md-tab>
</md-tabs>

<!-- Many tabs: content-sized, scrolling strip -->
<md-tabs tab-width="auto" aria-label="Regions">
  <md-tab label="North America"></md-tab>
  <md-tab label="Latin America"></md-tab>
  <md-tab label="Europe, Middle East & Africa"></md-tab>
  <md-tab label="Asia Pacific"></md-tab>
</md-tabs>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Looking for `density` on `md-tabs` | Set `density` on `md-tab` | The strip has no density prop. |
| Setting `variant` on each `md-tab` | Set it on the strip only | The strip overwrites every child's `variant` on slot change. |
| Setting `active` on tabs to select one | `active-tab-index`, or `selectTab(i)` | Two writers desync the indicator and the tab stop. |
| Toggling `md-tab-panel` `active` from `mdTabChange` | Let `md-tab-panels` do it | It already listens; your writes race it. |
| Expecting `md-tabs` to render panel content | Pair with `md-tab-panels` | Separate components. |
| Expecting `mdTabChange` after writing `active-tab-index` | Read the value you just wrote | The prop path deliberately does not re-emit. |
| Tabs for a wizard | `md-stepper` | Tabs imply free, unordered movement. |
| Tabs for app destinations | `md-navigation-bar` / `md-navigation-rail` | Different level of navigation. |
| Icons on some tabs, text on others | Be consistent across the set | M3 explicit rule. |
| Truncated labels by default | Shorten the labels | M3 explicit rule. |
| Swipeable carousel inside a tab panel | Avoid, or change the gesture axis | M3 explicit rule. |
| Unnamed tab strip | Set `aria-label` | It otherwise announces as the literal "tabs". |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host carries `role="tablist"` and `aria-orientation="horizontal"`. Give
  it an `aria-label` naming what the tabs switch between — with the prop empty
  the strip still exposes a name, but only the placeholder `"tabs"`.
- Roving focus is managed for you: one tab stop into the strip, arrows to move
  (which also activate), `Home` / `End` for the ends. Disabled tabs are always
  `tabindex="-1"` and are skipped.
- Wire each `md-tab`'s `controls` to its panel `id` so the tab↔panel
  relationship is exposed — or let `md-tab-panels` do it. Either way both must
  live in the same DOM scope, because IDREFs don't cross shadow boundaries.
- Keep at least one enabled tab. With every tab disabled the strip has no
  selection and no tab stop; it reports `index: -1` only if it had a selection
  to lose, never on a strip that starts out fully disabled.

**RTL** — the strip order, indicator travel and edge fades follow the physical
geometry, and `ArrowRight` / `ArrowLeft` follow visual direction under
`dir="rtl"`.

**Density** — no prop on the strip; set `density="-1…-4"` on the `md-tab`
children, or set a `data-density` rung on an ancestor and let it inherit. Rung
`0` is the uncompacted default and is inert — `density="0"` does **not** opt a
tab out of an inherited rung; use `style="--md-sys-density-scale: 0"` for that
(the ancestor's `--md-sys-spacing-*` payload still inherits).

**i18n** — translate tab labels and the strip's `aria-label`. Translations
change tab widths, which matters most with `tab-width="equal"`; re-check for
truncation per locale, or switch to `tab-width="auto"`.

## Related components

`md-tab` · `md-tab-panels` · `md-tab-panel` · `md-navigation-bar` ·
`md-navigation-rail` · `md-stepper` · `md-segmented-button-set` ·
`md-accordion`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-tabs-container-color` | Strip background | `--md-sys-color-surface` |
| `--md-tabs-divider-color` | Rule under the strip (inherited by every child tab's divider) | `--md-sys-color-outline-variant` |

**CSS parts** — `container`.

Per-tab appearance uses the `--md-tab-*` properties documented on `md-tab`.

```css
md-tabs {
  --md-tabs-container-color: var(--md-sys-color-surface-container);
  --md-tabs-divider-color: transparent;
}
```

<!-- Auto Generated Below -->


## Properties

| Property         | Attribute          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Type                       | Default     |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------- |
| `activeTabIndex` | `active-tab-index` | Index of the currently active tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `number`                   | `0`         |
| `ariaLabelProp`  | `aria-label`       | Accessible label for the tablist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string`                   | `''`        |
| `tabWidth`       | `tab-width`        | How tabs size along the strip. All modes are layout-stable under dynamic content (labels/badges can change without reshuffling the strip); long labels ellipsize instead of forcing a tab wider. - `equal` (default) — tabs share the parent's FULL width equally;   tracks change only when the PARENT resizes. - `auto` — each tab takes its content width (the strip scrolls), so   tracks follow content by design. - any CSS length (e.g. `"140px"`, `"10rem"`) — every tab gets exactly   that width regardless of parent or content. | `string`                   | `'equal'`   |
| `variant`        | `variant`          | Visual variant applied to all child tabs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `"primary" \| "secondary"` | `'primary'` |
| `width`          | `width`            | Explicit width for the WHOLE strip (any CSS size: `"480px"`, `"40rem"`, `"100%"`). By default the strip is `100%` of its parent — in shrink-to-fit layouts (inline-block cards, auto grid columns, flex items) that parent's width follows the ACTIVE TAB PANEL, so switching to a tab with tiny content collapses the whole tablist. Set `width` to anchor the strip regardless of what the panels do.                                                                                                                                     | `string`                   | `''`        |


## Events

| Event         | Description                       | Type                                                     |
| ------------- | --------------------------------- | -------------------------------------------------------- |
| `mdTabChange` | Emits when the active tab changes | `CustomEvent<{ index: number; previousIndex: number; }>` |


## Methods

### `selectTab(index: number) => Promise<void>`

Programmatically select a tab by index

#### Parameters

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `index` | `number` |             |

#### Returns

Type: `Promise<void>`




## Slots

| Slot | Description                   |
| ---- | ----------------------------- |
|      | Tab items (`md-tab` elements) |


## Shadow Parts

| Part          | Description              |
| ------------- | ------------------------ |
| `"container"` | Scrollable tab container |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
