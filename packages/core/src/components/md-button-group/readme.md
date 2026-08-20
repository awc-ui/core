# md-button-group

<!-- llm:meta
tag: md-button-group
category: actions
status: md3-mapped
m3-guidelines: https://m3.material.io/components/button-groups/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-button, md-icon-button
-->

**A set of related buttons that behave as one control.** Wraps `md-button` /
`md-icon-button` children, forces them into toggle mode, and manages selection,
roving tabindex, arrow-key navigation, and — in `connected` mode — the fused
container shape.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- 2–5 **related** actions or states that read as one unit: text alignment,
  zoom in/out/reset, view mode.
- You want **arrow-key navigation** and a single tab stop for the cluster.
- The buttons should visually respond to one another (`connected`).

## When NOT to use

| Situation | Use instead |
|---|---|
| Choosing between 2–5 exclusive **view/mode** options with labels | `md-segmented-button-set` |
| A default action plus variations of it | `md-split-button` |
| Unrelated actions that happen to sit near each other | Separate `md-button`s |
| Form field selection bound to a `<form>` | `md-radio` / `md-checkbox` |
| Many options, or options that need a menu | `md-menu`, `md-select` |
| Navigating between destinations | `md-tabs`, `md-navigation-bar` |
| A single action | `md-button` |

## Decision cues

| Need | Setting |
|---|---|
| Spaced buttons that still act as a group | `variant="standard"` (default) |
| Fused, single-container look | `variant="connected"` |
| One selection at a time | `selection-mode="single-select"` (default) |
| Several at once (e.g. bold + italic) | `selection-mode="multi-select"` |
| Never allow an empty selection | `required` |
| Stretch across the container, children sharing space | `full-width` |

## API contract

```html
<md-button-group
  variant="standard|connected"                 <!-- default: standard -->
  size="xs|sm|md|lg|xl"                         <!-- default: sm -->
  shape="round|square"                          <!-- default: round -->
  selection-mode="single-select|multi-select"   <!-- default: single-select -->
  required
  full-width
  density="-1|-2|-3|-4"
  aria-label="Text alignment"
>
  <md-icon-button value="left"   icon="format_align_left"   aria-label="Align left"></md-icon-button>
  <md-icon-button value="center" icon="format_align_center" aria-label="Align center"></md-icon-button>
  <md-icon-button value="right"  icon="format_align_right"  aria-label="Align right"></md-icon-button>
</md-button-group>
```

`density` is only meaningful at `-1`…`-4`; rung `0` is the uncompacted default
and there is no CSS rule for it, so writing `density="0"` does nothing (it does
**not** opt the group out of an inherited `data-density` ancestor).

**Slots** — `(default)`: `md-button` and/or `md-icon-button` children. No named
slots.

**Methods** — none.

**Parts** — none. The group renders only a `<slot>`; style the children through
their own `--md-button-*` / `--md-icon-button-*` properties.

**Events**

| Event | Detail | Bubbles / composed | Fires |
|---|---|---|---|
| `mdSelectionChange` | `MdButtonGroupChangeDetail` | yes / yes | On every user activation of a child button |

`mdSelectionChange` is the only event this component **declares**. Child events
also reach a listener on the group, since they bubble and are composed — but
*which* ones depends on the child element:

| Child | Events it emits | One press reaches the group as |
|---|---|---|
| `md-icon-button` | `mdClick` only | `mdClick` (child) → `mdSelectionChange` (group) |
| `md-button` | `mdClick`, `mdChange` | `mdClick` (child, cancelable) → `mdChange` (child) → `mdSelectionChange` (group) |

**`md-icon-button` has no `mdChange`.** A listener for it on an icon-button
child never fires. Since icon-button children are the common case for a
connected group, prefer `mdSelectionChange` on the group — it is emitted for
either child type.

**Listen on the group, not the children.** Switching from `a` to `b` in a
`single-select` group of `md-button`s fires one `mdChange`, not two: it fires
only for the button you pressed, and the one turned off emits nothing — the
group clears it programmatically and `md-button` has no watcher on `selected`.
Only `mdSelectionChange` reports `removed: ['a']`. This matches native radio
inputs, where the deselected radio also fires no `change`.

```ts
interface MdButtonGroupChangeDetail {
  values: string[];        // full selection snapshot after the change
  added: string[];         // newly selected (usually 0–1)
  removed: string[];       // newly deselected (usually 0–1)
  originalEvent: MouseEvent;
}
```

### Behavioral contract worth knowing

- The group **overwrites its children.** On load, on any `variant` / `size` /
  `shape` / `selection-mode` / `required` change, and whenever its child list
  mutates, it writes `toggle = true`, `shape`, `size`, `connectedLeft` and
  `connectedRight` onto every child. A `size` or `shape` set on a child is
  replaced by the group's — set them on the group instead.
- `groupTabindex` is owned by the group as well. Never set it, `connected-left`
  or `connected-right` by hand.
- **Give every child a `value`** — it is the identity in
  `values` / `added` / `removed`. A child without one contributes an empty
  string, so several unset children become indistinguishable.
- Children **self-toggle on click first**, then the group reconciles: in
  `single-select` it deselects the others; with `required` it re-selects the
  clicked button if the click would have emptied the selection.
- `mdSelectionChange` fires on **every** activation of a child, including one
  that leaves the selection unchanged (re-clicking the selected button in a
  `required` single-select group), in which case `added` and `removed` are both
  empty. It never fires on mount.
- Keyboard: `ArrowLeft` / `ArrowRight` move focus and wrap around,
  `Home` / `End` jump to the ends, and disabled children are skipped.
  **Arrow direction is RTL-aware** — it follows reading order, resolved from the
  nearest `dir` attribute on the group or an ancestor.
- One tab stop for the whole group (roving tabindex). The active stop is the
  last focused or clicked child, else the selected child in `single-select`,
  else the first enabled child.
- Role is `radiogroup` in `single-select` (with `aria-orientation="horizontal"`)
  and `group` in `multi-select`.
- `variant="standard"` adds a press flourish: the pressed button widens by a few
  pixels (3–8px per side by `size`) and its neighbours absorb the same amount,
  so the group's total width never changes. `connected` groups do not do this.
- Children are found with `querySelectorAll('md-button, md-icon-button')`, so a
  button nested inside a wrapper element is still selected and roved — but the
  `::slotted()` shape rules and the flex layout only reach **direct** children,
  so a wrapper breaks the fused corners and the sizing.

---

## Do / Don't

Sourced from [M3 · Button groups · Guidelines](https://m3.material.io/components/button-groups/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use the **same shape** for every button in the group | Don't mix `round` and `square` children arbitrarily |
| Vary width and color to signal a primary action within the group | Don't mix color styles inside a **connected** group |
| Reserve shape differences for genuinely key interactions | Don't use shape variation decoratively |
| Give the primary action higher emphasis via size or color | Don't make every button in the group high-emphasis |
| Keep the group to a handful of related buttons | Don't build a toolbar out of one giant group |
| Give icon-only children an `aria-label` | Don't ship unlabelled icon children |
| Use `required` when an empty selection is meaningless | Don't allow a mode switch to end up with nothing selected |

---

## Patterns

```html
<!-- Connected, single-select: text alignment -->
<md-button-group variant="connected" selection-mode="single-select" required
                 aria-label="Text alignment">
  <md-icon-button value="left"   icon="format_align_left"   aria-label="Align left" selected></md-icon-button>
  <md-icon-button value="center" icon="format_align_center" aria-label="Align center"></md-icon-button>
  <md-icon-button value="right"  icon="format_align_right"  aria-label="Align right"></md-icon-button>
</md-button-group>

<script type="module">
  document.querySelector('md-button-group')
    .addEventListener('mdSelectionChange', (e) => {
      const [alignment] = e.detail.values;
      if (alignment) document.body.style.textAlign = alignment;
    });
</script>
```

```html
<!-- Multi-select: inline text styles -->
<md-button-group selection-mode="multi-select" variant="connected"
                 aria-label="Text style">
  <md-icon-button value="bold"      icon="format_bold"       aria-label="Bold"></md-icon-button>
  <md-icon-button value="italic"    icon="format_italic"     aria-label="Italic"></md-icon-button>
  <md-icon-button value="underline" icon="format_underlined" aria-label="Underline"></md-icon-button>
</md-button-group>

<script type="module">
  document.querySelectorAll('md-button-group')[0]
    .addEventListener('mdSelectionChange', (e) => {
      const { values, added, removed } = e.detail;
      console.log(values, 'turned on:', added, 'turned off:', removed);
    });
</script>
```

```html
<!-- Full-width, children share the space equally -->
<md-button-group full-width variant="connected" aria-label="Calendar range">
  <md-button value="day">Day</md-button>
  <md-button value="week" selected>Week</md-button>
  <md-button value="month">Month</md-button>
</md-button-group>

<!-- Capped height: the ceiling also caps each child's minimum height -->
<md-button-group size="lg" style="--md-button-group-max-height: 40px;"
                 aria-label="Zoom">
  <md-button value="out" icon="zoom_out">Out</md-button>
  <md-button value="in"  icon="zoom_in">In</md-button>
</md-button-group>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Children without `value` | Give every child a unique `value` | The event payload is built from values; unset children all report `''`. |
| Setting `toggle` on the children | The group sets it | It is applied automatically on load and on every re-sync. |
| Setting `size` / `shape` on a child | Set them on the group | The group overwrites both on every sync. |
| Setting `connected-left` / `connected-right` / `group-tabindex` | Leave them alone | Group-owned `@internal` props; setting them breaks the border trims and the single tab stop. |
| Listening to each child's `mdClick` for selection | Listen to `mdSelectionChange` | The child fires before the group reconciles, so the state you read is not final. |
| Reading `values` as the diff | `values` is the full snapshot; use `added` / `removed` for the diff | Easy and common mix-up. |
| Treating `mdSelectionChange` as "the selection differed" | Check `added` / `removed` | It fires on every activation, even a no-op re-click. |
| Mixing `filled` and `outlined` children in a `connected` group | One color style per connected group | M3 forbids it. |
| Wrapping the children in a `<div>` for layout | Keep them direct children | The fused corner rules and flex sizing use `::slotted()`, which only matches direct children. |
| Using it for a form field | `md-radio` / `md-checkbox` | The group is not form-associated and submits nothing. |
| Assuming `ArrowRight` always moves right | It follows reading order | RTL-aware by design. |
| Expecting an initial `mdSelectionChange` | It fires only on user activation | Set the initial state with `selected` on a child. |
| `density="0"` to escape an inherited rung | `style="--md-sys-density-scale: 0"` | There is no `density="0"` rule; rung 0 is the inert default. |

## Accessibility, RTL, density, i18n

**Accessibility**
- `radiogroup` in `single-select` (plus `aria-orientation="horizontal"`),
  `group` in `multi-select`. Children expose `aria-pressed` through their own
  toggle mode.
- One tab stop for the cluster; arrows move within it — the expected pattern for
  a composite widget.
- Give the group itself an `aria-label` describing what it controls
  (e.g. "Text alignment"), and every icon-only child its own `aria-label`.
- `required` prevents an empty selection, which keeps the radiogroup semantics
  honest.

**RTL** — arrow-key direction follows reading order automatically, and the
connected corner radii use logical properties so the pill ends stay on the outer
edges. Directional child icons still need their own `mirror-icon`.

**Density** — `density="-1"`…`"-4"` on the group compacts its gap and, because
the rung is published as an inherited custom property, the children taper with
it. Prefer a global `data-density` ancestor; use the prop for one-off regions.
The connected seam stays at 2px on every rung by design.

**i18n** — child labels and `aria-label`s come from your dictionary. Translated
labels change width; `full-width` keeps a connected group tidy.

## Related components

`md-button` · `md-icon-button` · `md-segmented-button-set` ·
`md-split-button` · `md-toolbar` · `md-tabs`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-button-group-gap` | Space between children | `18px` (`xs`), `12px` (`sm`), `8px` (`md`/`lg`/`xl`), `2px` in any `connected` group |
| `--md-button-group-width` | Explicit inline-size | `auto` (`100%` with `full-width`) |
| `--md-button-group-min-width` | Inline-size floor | `auto` |
| `--md-button-group-max-width` | Inline-size ceiling | `none` |
| `--md-button-group-height` | Explicit block-size | `auto` |
| `--md-button-group-min-height` | Block-size floor | `auto` |
| `--md-button-group-max-height` | Block-size ceiling (also caps each child's minimum height, so the buttons actually shrink) | `none` |

**CSS parts** — none.

```css
/* A denser connected group with a tighter seam */
md-button-group.compact {
  --md-button-group-gap: 1px;
  --md-button-group-max-width: 320px;
}
```

<!-- Auto Generated Below -->


## Properties

| Property        | Attribute        | Description                                                                                                                                                                                                                                                                      | Type                                   | Default           |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------- |
| `density`       | `density`        | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                            | `-1 \| -2 \| -3 \| -4 \| 0`            | `0`               |
| `fullWidth`     | `full-width`     | When `true` the group stretches to 100% of its container's inline-size and its children share that space equally (`flex: 1 1 0`). Combine with the `--md-button-group-width` / `--md-button-group-max-width` CSS custom properties for fine-grained control over the final size. | `boolean`                              | `false`           |
| `required`      | `required`       | When true, at least one button must remain selected                                                                                                                                                                                                                              | `boolean`                              | `false`           |
| `selectionMode` | `selection-mode` | Selection mode                                                                                                                                                                                                                                                                   | `"multi-select" \| "single-select"`    | `'single-select'` |
| `shape`         | `shape`          | Default shape applied to all child buttons                                                                                                                                                                                                                                       | `"round" \| "square"`                  | `'round'`         |
| `size`          | `size`           | Button size — controls gap (standard) and inner corner radii (connected)                                                                                                                                                                                                         | `"lg" \| "md" \| "sm" \| "xl" \| "xs"` | `'sm'`            |
| `variant`       | `variant`        | Standard groups add padding between buttons; connected groups fuse them together                                                                                                                                                                                                 | `"connected" \| "standard"`            | `'standard'`      |


## Events

| Event               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Type                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `mdSelectionChange` | Fires every time a user activation toggles the selection state of a child button. The detail object describes both the new selection snapshot (`values`) and the diff from the previous selection (`added`, `removed`), plus the underlying `originalEvent`.  Distinct from each child button's own `mdChange` (which fires per individual button toggle); the group's `mdSelectionChange` fires once per user activation and reports the *group-level* state.  Bubbles and is composed so listeners outside the shadow tree receive it. | `CustomEvent<MdButtonGroupChangeDetail>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
