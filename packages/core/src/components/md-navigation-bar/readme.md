# md-navigation-bar

<!-- llm:meta
tag: md-navigation-bar
category: navigation
status: md3-mapped
m3-guidelines: https://m3.material.io/components/navigation-bar/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-navigation-tab
-->

**Top-level destinations on a compact screen.** A bottom bar of 3–5
destinations. Owns the active index and keyboard movement across its
`md-navigation-tab` children.

> Setup, theming, density and i18n are configured once for the whole library.
> Quick start: `import '@awc-ui/core/define';`

---

## When to use

- **3–5 top-level destinations** on a mobile / compact layout.
- Destinations of equal importance the user switches between frequently.

## When NOT to use

| Situation | Use instead |
|---|---|
| Fewer than three destinations | `md-tabs` |
| More than five destinations | A rail, a drawer, or a menu |
| Desktop / large layouts | `md-navigation-rail` or `md-tabs` |
| Sibling views inside one screen | `md-tabs` |
| Actions rather than destinations | `md-toolbar` / `md-button-group` |
| A linear flow | `md-stepper` |
| Secondary navigation | `md-tabs` |

## Decision cues

| Need | Setting |
|---|---|
| Labels always visible (M3 default) | `label-behavior="always"` |
| Only the current destination labelled | `label-behavior="selected"` |
| Focus moves without activating | `manual-activation` |
| Programmatic navigation | `select(index)` |
| Move focus without changing selection | `focusTab(index)` |
| Compact bar | `density="-1"` … `density="-4"` |
| Name the landmark | `aria-label` on the host |

## API contract

```html
<md-navigation-bar
  active-index="0"                       <!-- default: 0 -->
  label-behavior="always|selected|none"  <!-- default: always -->
  manual-activation
  density="-1|-2|-3|-4"                  <!-- default: 0 (uncompacted) -->
  aria-label="Main navigation"
>
  <md-navigation-tab label="Home"    icon="home"   active-icon="home"></md-navigation-tab>
  <md-navigation-tab label="Search"  icon="search"></md-navigation-tab>
  <md-navigation-tab label="Profile" icon="person" badge badge-value="3"></md-navigation-tab>
</md-navigation-bar>
```

**Event** — `mdChange` `{ index, previousIndex }` (bubbles, composed).

**Methods** — `select(index)`, `focusTab(index)`.

**Slot** — the default slot: one `md-navigation-tab` per destination.

**Part** — `container` (the inner `tablist` flex row).

### Behavioral contract worth knowing

- `active-index` is the single source of truth. The bar writes `active`,
  `tabindex` and `aria-selected` onto its children on every sync — anything you
  set on a child yourself is overwritten.
- `active-index` clamps to an enabled destination on initialization and later
  updates: an out-of-range or disabled index moves to the nearest enabled tab
  (searching forward, then backward). With no enabled tab it becomes `-1`.
  Fractional values are truncated; `NaN` resolves from index `0`.
- An initially empty bar retains its requested index until the first tabs
  arrive, so asynchronously rendered destinations honor the router's initial
  selection. Initial selection and slot synchronization do not emit `mdChange`.
- **`mdChange` reports selection changes, not only user intent.** External
  `activeIndex` assignments and `select(index)` calls emit it too, with the
  last actual selection in `previousIndex`. A request that clamps back to the
  current destination emits nothing; an invalid intermediate index is never
  published as `previousIndex`.
- **Arrow keys activate immediately by default.** `manual-activation` separates
  focus from selection — arrow to preview, `Enter` / `Space` to commit.
- Keyboard: `ArrowLeft` / `ArrowRight` (swapped under `dir="rtl"`), `Home`,
  `End`. Movement wraps around the ends.
- `disabled` children are skipped by the arrow keys entirely. `soft-disabled`
  children stay reachable by arrow keys — they can be focused and read, but
  never activated.
- `label-behavior` is pushed down to every child that has **no
  `label-behavior` attribute of its own**. Presence of the attribute is the
  override signal, so a per-tab override must be written as an attribute — a
  JS property assignment gets overwritten on the next sync.
- The bar **swallows `mdTabClick`** (`stopPropagation`), so that event cannot be
  caught on an ancestor of the bar. Listen for it on the tab element itself if
  you need per-tab activation (including a re-click of the current tab).
- The host is `role="navigation"`; the inner container is `role="tablist"` with
  `aria-orientation="horizontal"`. Name the landmark by putting `aria-label`
  directly on the `md-navigation-bar` element.
- The bar sets `data-tab-count` on itself so you can style by destination
  count.
- The bar does **not** route, and it does **not** position itself. Connect
  selection or per-tab activation to your router and position the bar with CSS.
  For a router-controlled bar, use the user-activation pattern below so state
  synchronization cannot trigger a second navigation.

---

## Do / Don't

Sourced from [M3 · Navigation bar · Guidelines](https://m3.material.io/components/navigation-bar/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Keep to **3–5** destinations | Avoid more than five items |
| Use `md-tabs` when there are fewer than three destinations | Don't use a navigation bar for two destinations |
| Always show labels | Don't remove labels from navigation items |
| Use brief labels that identify the destination | Don't wrap or truncate label text — it becomes hard to understand |
| Keep the type size consistent | Don't shrink text to fit a longer label |
| Use a filled icon for the active item (or increase its weight if no filled version exists) | Don't leave active and inactive icons identical |
| Use the active indicator for the **one** current destination | Don't indicate more than one destination at a time |
| Keep destination positions fixed | Don't scroll or reorder destinations |
| Use one high-contrast colour scheme | Don't use multiple or low-contrast colours — the active item becomes hard to spot |
| Right-align a FAB **above** the bar | Don't cover the navigation bar with a FAB |
| Use a rail or tabs on desktop | Don't use navigation bars for desktop layouts |

---

## Patterns

```html
<!-- Router-controlled: programmatic selection must not initiate routing. -->
<md-navigation-bar id="nav" manual-activation aria-label="Main navigation"
                   style="position:fixed; inset-inline:0; inset-block-end:0;">
  <md-navigation-tab label="Home"    icon="home"           active-icon="home"></md-navigation-tab>
  <md-navigation-tab label="Search"  icon="search"></md-navigation-tab>
  <md-navigation-tab label="Library" icon="library_music"></md-navigation-tab>
</md-navigation-bar>

<script type="module">
  const routes = ['/', '/search', '/library'];
  const nav = document.getElementById('nav');

  // Listen on each tab: the bar stops this event before it reaches ancestors.
  // manual-activation makes arrows move focus; click / Enter / Space activate.
  nav.querySelectorAll('md-navigation-tab').forEach((tab, index) => {
    tab.addEventListener('mdTabClick', (event) => {
      // Leave selection to the router, including any async route guards.
      event.stopPropagation();
      router.go(routes[index]);
    });
  });

  router.afterEach((to) => {
    const index = routes.indexOf(to.path);
    if (index >= 0) nav.activeIndex = index;
  });
</script>
```

```html
<!-- Expensive destination switches: arrow to preview, Enter to commit -->
<md-navigation-bar manual-activation aria-label="Main navigation">
  <md-navigation-tab label="Home"    icon="home"></md-navigation-tab>
  <md-navigation-tab label="Reports" icon="bar_chart"></md-navigation-tab>
  <md-navigation-tab label="Alerts"  icon="notifications"></md-navigation-tab>
</md-navigation-bar>
```

```html
<!-- Per-tab override: the ATTRIBUTE is what marks it as explicit -->
<!-- `selected` hides inactive labels with `visibility: hidden`, which also
     drops them from the a11y tree — give those tabs an explicit aria-label. -->
<md-navigation-bar label-behavior="selected" aria-label="Main navigation">
  <md-navigation-tab label="Home"   icon="home"          aria-label="Home"></md-navigation-tab>
  <md-navigation-tab label="Alerts" icon="notifications" label-behavior="always"></md-navigation-tab>
  <md-navigation-tab label="You"    icon="person"        aria-label="You"></md-navigation-tab>
</md-navigation-bar>
```

```html
<!-- Responsive: bar on compact, rail on wide -->
<md-navigation-bar class="compact-only" aria-label="Main navigation">…</md-navigation-bar>
<md-navigation-rail class="wide-only" label="Main navigation">…</md-navigation-rail>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Six or more destinations | Cap at five | M3 explicit rule. |
| Two destinations in a bar | `md-tabs` | M3 explicit rule. |
| `label-behavior="none"` to save space | Keep labels | M3: don't remove them. |
| A navigation bar on desktop | `md-navigation-rail` | M3 explicit rule. |
| Setting `active` on the children | Use `active-index` / `select()` | The bar rewrites the children on every sync. |
| `tab.labelBehavior = 'none'` in JS to override one tab | Set the `label-behavior` **attribute** | The bar only treats the attribute as an explicit override. |
| Listening for `mdTabClick` on an ancestor of the bar | Listen on the tab, or use the bar's `mdChange` | The bar calls `stopPropagation()` on it. |
| Expecting `mdChange` when the user re-taps the current tab | Listen for `mdTabClick` on that tab | Selection did not change, so no `mdChange`. |
| Treating `mdChange` as user-only activation | Use per-tab `mdTabClick` with `manual-activation` for a controlled router | Programmatic selection also emits `mdChange`. |
| Expecting the bar to route | Connect a selection or activation handler | Routing is owned by the app. |
| Expecting the bar to pin itself to the bottom | Position it yourself | The host is `display: block`, in flow. |
| A FAB overlapping the bar | Place it above, right-aligned | M3 explicit rule. |
| Reordering destinations by usage | Fixed positions | M3 explicit rule. |
| Truncated or shrunk labels | Shorten the words instead | M3 explicit rule. |
| Tabs used for top-level destinations | This component | Different navigation level. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host is a `navigation` landmark; give it an `aria-label` so multiple
  landmarks are distinguishable. The inner `tablist` reuses nothing from the
  children, so the label must be on the host.
- The bar manages roving focus: exactly one destination is tabbable at a time,
  and the arrow keys move between them.
- `manual-activation` decouples focus from selection, which lets screen-reader
  users preview destinations before committing.
- Exactly one destination carries `aria-selected="true"`.
- Labels are required, so each destination has a real accessible name.
- Because the bar is placed at the bottom, make sure page content is not hidden
  behind it (add bottom padding equal to its height).
- In forced-colors mode the bar paints `Canvas` and grows a 1px `CanvasText`
  top border so it separates from the content.

**RTL** — layout uses logical properties, so destination order mirrors under
`dir="rtl"`, and the bar swaps the arrow keys to match.

**Density** — `density="-1…-4"` shortens the bar from 64px toward its 48px
floor. Rung `0` is the uncompacted default and is inert. To opt a bar out of an
inherited global `data-density` rung, set `style="--md-sys-density-scale: 0"`
on it.

**i18n** — translate every `label`. M3 forbids truncation and shrinking, so
long translations mean choosing shorter words — check each locale at your
narrowest supported width.

## Related components

`md-navigation-tab` · `md-navigation-rail` · `md-tabs` · `md-app-bar` ·
`md-fab` · `md-badge`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-navigation-bar-container-color` | Bar background | `--md-sys-color-surface-container` |
| `--md-navigation-bar-container-height` | Bar height before density | `64px` (tapers 4px/rung, floor 48px) |
| `--md-navigation-bar-container-shape` | Corner radius | `0` |
| `--md-navigation-bar-container-elevation` | Box-shadow | `none` |
| `--md-navigation-bar-divider-color` | Top rule colour | `transparent` |
| `--md-navigation-bar-divider-width` | Top rule width | `0` |
| `--md-navigation-bar-z-index` | Stacking order | `--md-sys-z-index-navigation` (200) |

**CSS parts** — `container`.

Destination appearance is themed with the `--md-navigation-tab-*` properties.

```css
md-navigation-bar.raised {
  --md-navigation-bar-container-elevation: var(--md-sys-elevation-2);
  --md-navigation-bar-divider-width: 1px;
  --md-navigation-bar-divider-color: var(--md-sys-color-outline-variant);
}
```

<!-- Auto Generated Below -->


## Overview

`md-navigation-bar` — Material Design 3 navigation bar.

A bottom-anchored row of 3–5 top-level destinations, optimized for
compact-width screens (mobile). Each destination is an `<md-navigation-tab>`
child; the bar orchestrates selection, label visibility, keyboard
navigation (roving tabindex + arrow keys), and emits change events.

References:
  - {@link https://m3.material.io/components/navigation-bar/overview Overview}
  - {@link https://m3.material.io/components/navigation-bar/specs Specs}
  - {@link https://m3.material.io/components/navigation-bar/guidelines Guidelines}
  - {@link https://m3.material.io/components/navigation-bar/accessibility Accessibility}

## Properties

| Property           | Attribute           | Description                                                                                                                                                                                                                                                                                                                                                           | Type                               | Default    |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------- |
| `activeIndex`      | `active-index`      | Index of the currently selected destination. Two-way: external writes drive selection, internal selection writes back.                                                                                                                                                                                                                                                | `number`                           | `0`        |
| `density`          | `density`           | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                 | `-1 \| -2 \| -3 \| -4 \| 0`        | `0`        |
| `labelBehavior`    | `label-behavior`    | Label visibility for child tabs.  - `always`   — Show all labels (default; M3 baseline). - `selected` — Show only the selected tab's label. - `none`     — Icon-only mode (no labels rendered).  Per child can be overridden with `label-behavior` on the tab.                                                                                                        | `"always" \| "none" \| "selected"` | `'always'` |
| `manualActivation` | `manual-activation` | Keyboard activation policy. When `false` (default), arrow keys move focus AND immediately activate the focused tab (automatic activation; matches the MD3 reference and most nav bar implementations).  When `true`, arrow keys only move focus — the user must press `Enter` / `Space` to activate. Use this when activation triggers destructive or expensive work. | `boolean`                          | `false`    |


## Events

| Event      | Description                                                                                                                                                                                                         | Type                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `mdChange` | Emitted when the selected destination changes (user click, keyboard activation, or programmatic `activeIndex` / `select()` update). Detail includes both the new and previous indices so listeners can short-circuit no-op reselects. | `CustomEvent<{ index: number; previousIndex: number; }>` |


## Methods

### `focusTab(index: number) => Promise<void>`

Focus the tab at `index` without selecting it. Used by hosts that
implement manual activation flows (e.g. wizards).

#### Parameters

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `index` | `number` |             |

#### Returns

Type: `Promise<void>`



### `select(index: number) => Promise<void>`

Programmatically select a destination by index. Out-of-range or
disabled targets are clamped to the next enabled tab.

#### Parameters

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `index` | `number` |             |

#### Returns

Type: `Promise<void>`




## Slots

| Slot | Description                                                  |
| ---- | ------------------------------------------------------------ |
|      | One `<md-navigation-tab>` per destination (3–5 recommended). |


## Shadow Parts

| Part          | Description                                       |
| ------------- | ------------------------------------------------- |
| `"container"` | Inner `tablist` container that lays out the tabs. |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
