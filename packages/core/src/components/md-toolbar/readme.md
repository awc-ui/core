# md-toolbar

<!-- llm:meta
tag: md-toolbar
category: navigation
status: md3-mapped
m3-guidelines: https://m3.material.io/components/toolbars/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A persistent cluster of local actions.** Docked or floating, horizontal or
vertical, with an optional FAB slot. Where a menu is temporary, a toolbar keeps
the essential actions on screen — and it wires the WAI-ARIA toolbar keyboard
pattern over whatever controls you slot in.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- Actions that should be **visible at all times** for the current page or
  selection: formatting controls, canvas tools, bulk actions.
- Local, page-specific navigation controls.
- Any row of controls that should behave as **one Tab stop** with arrow-key
  movement between the buttons.

## When NOT to use

| Situation | Use instead |
|---|---|
| A temporary set of actions | `md-menu` |
| The screen header | `md-app-bar` |
| Top-level destinations | `md-navigation-bar` / `md-navigation-rail` |
| Sibling views | `md-tabs` |
| A small group of related buttons that share one selection | `md-button-group` |
| Table-scoped actions | `md-table-toolbar` |
| One prominent action | `md-fab` |

## Decision cues

| Need | Setting |
|---|---|
| Attached to the bottom edge, full width | `variant="docked"` (default) |
| A free-placed pill above content | `variant="floating"` |
| Standard tone | `color="standard"` (default) |
| Higher emphasis, use sparingly | `color="vibrant"` |
| Vertical tool strip | `variant="floating" layout="vertical"` (ignored when docked) |
| Distribute the items | `alignment="center\|end\|space-between"` |
| A styled row with no toolbar semantics or arrow keys | `container-semantics="generic"` |
| Let a crowded toolbar scroll | `--md-toolbar-overflow-x: auto` |

## API contract

```html
<md-toolbar
  variant="docked|floating"                <!-- default: docked -->
  color="standard|vibrant"                 <!-- default: standard -->
  layout="horizontal|vertical"             <!-- default: horizontal; floating only -->
  alignment="start|center|end|space-between"  <!-- default: start -->
  container-semantics="toolbar|generic"    <!-- default: toolbar -->
  aria-label="Text formatting"
  density="-1|-2|-3|-4"
>
  <md-icon-button slot="leading" icon="undo" aria-label="Undo"></md-icon-button>
  <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
  <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
  <md-icon-button slot="trailing" icon="more_vert" aria-label="More"></md-icon-button>
  <md-fab slot="fab" icon="add" aria-label="Insert"></md-fab>
</md-toolbar>
```

`aria-labelledby` is accepted the same way as `aria-label` and takes precedence
for the accessible name. `density` is only meaningful at `-1`…`-4`; rung `0` is
the inert default and `density="0"` does **not** opt the toolbar out of an
inherited `data-density` ancestor (use
`style="--md-sys-density-scale: 0"` for that).

**Events** — none. The toolbar is a container; listen to the controls inside it.

**Methods** — `setFocus()` focuses the toolbar's active roving control, or does
nothing when the roving group is empty.

**Slots** — `(default)` action items, `leading` (start section), `trailing`
(end section), `fab` (a paired `md-fab`).

**Parts** — `container` (the inner flex row / pill), `fab-container` (hidden
until the `fab` slot has content).

### Behavioral contract worth knowing

- **It emits no events.** Listen to the controls you put inside it.
- With the default `container-semantics="toolbar"` the host gets
  `role="toolbar"`, `aria-orientation`, and an **adaptive roving tabindex** that
  the component implements itself:
  - **Activators join the roving group** — `md-button`, `md-icon-button`,
    native `button` / `a[href]` / button-like `input`, and
    `role="button|menuitem|link"`. They share **one** Tab stop;
    `ArrowLeft`/`ArrowRight` (or `ArrowUp`/`ArrowDown` when floating and
    vertical), `Home` and `End` move between them, wrapping around.
  - **Value and text controls keep their own Tab stop** and their own arrow
    keys — `input`, `textarea`, `select`, `contenteditable`, `md-text-field`,
    `md-select`, `md-radio`, and every toggle (`md-switch`, `md-checkbox`,
    `md-chip`, native checkbox/radio, `role="checkbox|radio|slider|spinbutton|combobox|textbox|searchbox"`).
  - **Composites are never entered** — `md-button-group`, `md-menu`, and
    `role="group|radiogroup|listbox|menu|tablist|toolbar"` manage their own
    focus.
  - Plain wrappers are descended into, so a `<div>` of icon buttons still roves
    correctly.
- Arrow keys are only intercepted when focus is on a roving-group member, and
  never when a modifier key is held or the event was already
  `preventDefault()`ed.
- A control that is `hidden`, `disabled`, `aria-hidden="true"` (on itself or a
  wrapper inside the toolbar), or invisible is dropped from the group. A
  **soft-disabled** (`aria-disabled="true"`) control stays arrow-reachable but is
  not chosen as the default Tab stop.
- An author-set `tabindex="-1"` opts a plain/native control out of the group.
  That escape hatch does not apply to `md-*` components, which cooperate through
  an internal `groupTabindex` instead.
- The `fab` slot is **not** part of the roving group — it stays a separate Tab
  stop.
- The group re-syncs on `slotchange` and on DOM mutations inside the toolbar
  (children, `disabled`, `aria-disabled`, `aria-hidden`, `hidden`, `class`,
  `style`, `role`, `type`), coalesced to one pass per frame. Adding or hiding
  controls at runtime is safe.
- `container-semantics="generic"` renders no role and turns roving **off**,
  restoring every control's original tabindex. A generic container cannot be
  named, so an `aria-label` you set is left on the element but ignored by
  assistive tech (a development-build warning says so). A toolbar with no name
  logs a development-build warning too.
- `layout="vertical"` only takes effect with `variant="floating"`; a docked
  toolbar is always horizontal, and the vertical arrow axis follows the same
  rule.
- `variant="docked"` is `position: sticky` at the bottom edge, full width, with
  elevation and a safe-area inset. `variant="floating"` is an inline pill, and
  the FAB sits outside the pill rather than inside it.
- Content does **not** clip or scroll by default (`overflow: visible`), so focus
  rings are never cut off. Opt into scrolling or wrapping with
  `--md-toolbar-overflow-x` (or `--md-toolbar-overflow-y` when floating and
  vertical) and `--md-toolbar-flex-wrap`.

---

## Do / Don't

Sourced from [M3 · Toolbars · Guidelines](https://m3.material.io/components/toolbars/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use a toolbar for local navigation/actions on a specific page | Don't show a navigation bar **and** a toolbar with navigation controls at the same time |
| Choose the most essential actions to show by default | Don't overwhelm people with too many controls |
| Use straight corners for docked toolbars | Avoid modifying the container shape |
| Keep floating toolbars inside the window or pane | Floating toolbars shouldn't exceed the edge of the window |
| Emphasise **one** action at a time | Don't emphasise multiple buttons with bold primary colours — e.g. a filled button and a FAB together |
| Keep control design consistent | Avoid mixing too many different control types in one toolbar |
| Use round icon buttons in floating toolbars | Don't use square filled icon buttons in floating toolbars |
| Keep vertical toolbars narrow | Wide buttons in vertical toolbars widen the container and hide other UI |
| Size the toolbar to its items | Don't add extra space beyond what the items need |
| Use one toolbar in small windows | Avoid multiple toolbars in smaller windows; vertical toolbars can cover content in compact windows |
| Pick one scroll behaviour | Toolbars shouldn't both collapse and transition off page |

---

## Patterns

```html
<!-- Docked formatting toolbar: one Tab stop, arrows move between buttons -->
<md-toolbar aria-label="Text formatting">
  <md-icon-button icon="format_bold"       aria-label="Bold"></md-icon-button>
  <md-icon-button icon="format_italic"     aria-label="Italic"></md-icon-button>
  <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
</md-toolbar>

<!-- Floating pill with a paired FAB (the FAB is its own Tab stop) -->
<md-toolbar variant="floating" alignment="center" aria-label="Canvas tools">
  <md-icon-button icon="pan_tool" aria-label="Pan"></md-icon-button>
  <md-icon-button icon="crop"     aria-label="Crop"></md-icon-button>
  <md-fab slot="fab" icon="add" aria-label="Insert"></md-fab>
</md-toolbar>

<!-- Vertical tool strip: vertical needs the floating variant -->
<md-toolbar variant="floating" layout="vertical" aria-label="Drawing tools">
  <md-icon-button icon="edit"   aria-label="Draw"></md-icon-button>
  <md-icon-button icon="brush"  aria-label="Paint"></md-icon-button>
  <md-icon-button icon="delete" aria-label="Erase"></md-icon-button>
</md-toolbar>
```

```html
<!-- Mixed controls: the text field keeps its own Tab stop and its own arrows -->
<md-toolbar aria-label="Find in page">
  <md-text-field slot="leading" label="Find"></md-text-field>
  <md-icon-button icon="navigate_before" aria-label="Previous match"></md-icon-button>
  <md-icon-button icon="navigate_next"   aria-label="Next match"></md-icon-button>
</md-toolbar>

<!-- A styled row with no toolbar semantics and no arrow navigation -->
<md-toolbar container-semantics="generic">
  <span>12 items selected</span>
</md-toolbar>

<!-- Let a crowded toolbar scroll instead of overflowing its pane -->
<md-toolbar aria-label="Editor actions"
            style="--md-toolbar-overflow-x: auto;">
  <md-icon-button icon="undo" aria-label="Undo"></md-icon-button>
  <md-icon-button icon="redo" aria-label="Redo"></md-icon-button>
  <md-icon-button icon="content_cut"  aria-label="Cut"></md-icon-button>
  <md-icon-button icon="content_copy" aria-label="Copy"></md-icon-button>
</md-toolbar>

<script type="module">
  // Move focus into the toolbar (lands on its active roving control)
  await document.querySelector('md-toolbar').setFocus();
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| An unnamed toolbar | `aria-label` / `aria-labelledby` | The toolbar role needs a name; the component warns in development builds. |
| `aria-label` on `container-semantics="generic"` | Switch to `container-semantics="toolbar"` if the name matters | A generic container is ARIA name-prohibited, so the name is ignored. |
| `container-semantics="generic"` because you think you must wire arrows yourself | Keep the default `toolbar` | The component already implements the roving tabindex; `generic` turns it off. |
| Listening for events on `md-toolbar` | Listen to the inner controls | It declares none. |
| Setting `tabindex="0"` on slotted buttons | Leave tabindex alone | The toolbar owns the roving tab order and will overwrite it. |
| `layout="vertical"` on a docked toolbar | Add `variant="floating"` | Vertical layout only applies to the floating variant. |
| A filled button **and** a FAB both emphasised | One emphasis | M3 explicit rule. |
| Square filled icon buttons in a floating toolbar | Round ones | M3 explicit rule. |
| Navigation controls in a toolbar alongside a navigation bar | Pick one | M3 explicit rule. |
| Fifteen controls in one toolbar | Keep the essentials; overflow the rest to `md-menu` | M3 explicit rule, and the toolbar does not scroll by default. |
| A floating toolbar that runs past the pane edge | Constrain it | M3 explicit rule. |
| Several toolbars in a compact window | One | M3 explicit rule. |
| Rounded corners on a docked toolbar | Straight | M3 explicit rule. |
| `density="0"` to escape an inherited rung | `style="--md-sys-density-scale: 0"` | There is no `density="0"` rule; rung 0 is the inert default. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The default `container-semantics="toolbar"` gives `role="toolbar"`,
  `aria-orientation` matching the axis, and a working roving tabindex: one Tab
  stop for the activator buttons, arrows/Home/End to move between them, while
  text fields, toggles and composites keep their own Tab stops and their own
  arrow keys.
- Always name it (`aria-label` or `aria-labelledby`), and give each icon-only
  control its own label. A blank `aria-label` is stripped so the toolbar renders
  as genuinely unnamed rather than named with an empty string.
- Soft-disabled (`aria-disabled="true"`) controls stay arrow-reachable for
  discoverability; hard-`disabled` ones are removed from the group entirely.
- `setFocus()` moves focus into the toolbar programmatically.
- A vertical toolbar can cover content in compact windows — M3's caution is an
  accessibility issue as much as a layout one.

**RTL** — `ArrowLeft` / `ArrowRight` swap to follow reading order (resolved from
the computed `direction`), and the leading/trailing slots, alignment, padding and
FAB gap all use logical properties, so they mirror under `dir="rtl"`.
Directional glyphs still need swapping yourself.

**Density** — `density="-1"`…`"-4"` compacts height (64px floor 48px), gap and
padding; every value derives from the same rung signal, so a global
`data-density` ancestor has the same effect.

**i18n** — translate `aria-label` and every control's label. Longer labels widen
a horizontal toolbar — plan overflow with `--md-toolbar-overflow-x` /
`--md-toolbar-flex-wrap`.

## Related components

`md-app-bar` · `md-menu` · `md-button-group` · `md-icon-button` · `md-fab` ·
`md-table-toolbar` · `md-navigation-rail`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-toolbar-container-color` | Bar / pill background | `--md-sys-color-surface-container` (`standard`), `--md-sys-color-primary-container` (`vibrant`) |
| `--md-toolbar-icon-color` | Host text color, and the tint applied to slotted non-selected standard/outlined `md-icon-button`s | `--md-sys-color-on-surface-variant` (`standard`), `--md-sys-color-on-surface` (`vibrant`) |
| `--md-toolbar-container-shape` | Corner radius | `0px` docked, `--md-sys-shape-corner-full` (`100px`) floating |
| `--md-toolbar-container-height` | Bar height | `64px` at density 0, floor `48px` |
| `--md-toolbar-padding` | Inline padding (docked) / pill padding (floating) | `16px` docked, `8px` floating |
| `--md-toolbar-gap` | Gap between items | `32px` docked at density 0 (`8px` when `alignment="center"`), `4px` floating at any `alignment`. **Ignored** on `docked` + `alignment="space-between"` — see below |
| `--md-toolbar-fab-gap` | Gap between the bar and the `fab` slot | `16px` docked, `8px` floating |
| `--md-toolbar-overflow-x` | Horizontal overflow of the inner container | `visible` |
| `--md-toolbar-overflow-y` | Block-axis overflow (floating + vertical only) | `visible` |
| `--md-toolbar-flex-wrap` | Whether items wrap | `nowrap` |
| `--md-toolbar-scrollbar-width` | `scrollbar-width` while scrolling; set to `auto` to re-enable `::-webkit-scrollbar` styling in Chrome 121+ | `thin` |

> **`--md-toolbar-gap` has one dead spot.** A `docked` toolbar with
> `alignment="space-between"` hard-codes its item gap to `0` with no custom-property
> fallback, so setting `--md-toolbar-gap` on it changes nothing — the spacing is
> produced by `justify-content: space-between` instead. Every other combination
> reads the property, including `floating` + `alignment="space-between"`, which
> keeps the floating `4px` gap unless you override it. If you need a minimum gap
> on a docked space-between bar, put margins on the slotted items.

**CSS parts** — `container`, `fab-container`.

```css
md-toolbar.editor {
  --md-toolbar-container-color: var(--md-sys-color-surface-container-high);
  --md-toolbar-gap: 8px;
  --md-toolbar-overflow-x: auto;
}
```

<!-- Auto Generated Below -->


## Overview

The toolbar host has no built-in actions — all behavior comes from slotted controls.
On the web, the default is `role="toolbar"` implementing the WAI-ARIA toolbar pattern
with an ADAPTIVE roving tabindex:

 - **Activator buttons** (`md-icon-button`, `md-button`, native `button`/`a[href]`,
   `role=button`/`menuitem`/`link`) form a single roving group — one Tab stop, and
   ArrowLeft/Right (or Up/Down when floating+vertical), Home, End move focus between them.
 - **Everything else** is left as its OWN Tab stop with its native behavior — text-entry /
   value controls (input, textarea, contenteditable, md-text-field, md-select, `select`,
   range/spinbutton), ALL toggles (`md-switch`/`md-checkbox`/`md-chip`, native
   checkbox/radio, role=checkbox/radio), and self-managing composites (md-button-group,
   md-menu, role=group/radiogroup/listbox/menu). Arrows are never stolen from them, and
   they never become roving dead-ends.

A soft-disabled (`aria-disabled`) group member stays arrow-reachable (APG: disabled
items remain focusable for discoverability). The default Tab stop prefers an enabled
control, falling back to the first member only when every member is soft-disabled;
focusing any member makes it the stop.

This keeps every control keyboard-reachable regardless of the mix, per APG guidance for
toolbars that contain text fields. Use `generic` for a non-semantic container (no role,
no roving).

## Properties

| Property             | Attribute             | Description                                                                                                                                                                                                                                                                                                                                                                  | Type                                              | Default        |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------- |
| `alignment`          | `alignment`           | Alignment of items within the container                                                                                                                                                                                                                                                                                                                                      | `"center" \| "end" \| "space-between" \| "start"` | `'start'`      |
| `ariaLabelProp`      | `aria-label`          | Accessible name for the toolbar (`containerSemantics="toolbar"`). Provide a meaningful label describing the toolbar's purpose (e.g. "Text formatting"); prefer `aria-labelledby` when a visible label exists. When neither is set the toolbar is left unnamed (valid ARIA) and a dev-mode warning is logged.                                                                 | `string`                                          | `''`           |
| `ariaLabelledby`     | `aria-labelledby`     | ID(s) of visible label element(s); takes precedence over `aria-label` for the accessible name                                                                                                                                                                                                                                                                                | `string`                                          | `''`           |
| `color`              | `color`               | Toolbar color scheme (bar chrome). Also applies the MD3 expressive **toolbar-only** token map to slotted `md-icon-button` — does not change standalone icon buttons elsewhere.                                                                                                                                                                                               | `"standard" \| "vibrant"`                         | `'standard'`   |
| `containerSemantics` | `container-semantics` | `toolbar` (default): `role="toolbar"`, adaptive roving tabindex, and toolbar ARIA on the host for web. `generic`: no toolbar role — plain container, no roving/arrow navigation. A generic container cannot be named (ARIA name-prohibited): an author-set `aria-label`/ `aria-labelledby` is left in place but ignored by assistive tech, and a dev-mode warning is logged. | `"generic" \| "toolbar"`                          | `'toolbar'`    |
| `density`            | `density`             | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                        | `-1 \| -2 \| -3 \| -4 \| 0`                       | `0`            |
| `layout`             | `layout`              | Layout direction for floating toolbar                                                                                                                                                                                                                                                                                                                                        | `"horizontal" \| "vertical"`                      | `'horizontal'` |
| `variant`            | `variant`             | Toolbar type: docked (anchored to bottom) or floating (free-placed)                                                                                                                                                                                                                                                                                                          | `"docked" \| "floating"`                          | `'docked'`     |


## Methods

### `setFocus() => Promise<void>`

Focus the toolbar's active roving control. No-op when the roving group is empty.

#### Returns

Type: `Promise<void>`




## Slots

| Slot         | Description                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
|              | Action items (icon buttons, buttons, text fields, menus, etc.)                                                                                 |
| `"fab"`      | FAB paired with the toolbar (floating variant). Not part of the toolbar roving set — it stays a separate Tab stop, matching its separate role. |
| `"leading"`  | Leading (start) content section                                                                                                                |
| `"trailing"` | Trailing (end) content section                                                                                                                 |


## Shadow Parts

| Part              | Description                                        |
| ----------------- | -------------------------------------------------- |
| `"container"`     | Inner container holding slotted content            |
| `"fab-container"` | FAB wrapper (shown only when fab slot has content) |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
