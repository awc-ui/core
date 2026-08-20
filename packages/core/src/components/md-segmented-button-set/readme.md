# md-segmented-button-set

<!-- llm:meta
tag: md-segmented-button-set
category: actions
status: md3-mapped
m3-guidelines: https://m3.material.io/components/segmented-buttons/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-segmented-button
-->

**A choice between 2–5 exclusive options, all visible at once.** Wraps
`md-segmented-button` children, owns the selection, and stamps each child with
its position so the fused container renders correct end caps.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- **2–5** mutually exclusive options that the user should see side by side:
  Day / Week / Month, List / Grid, All / Unread.
- Switching a **view or mode**, where the current state should stay visible.
- Multi-select over a small, closed set of filters (`multiselect`).

## When NOT to use

| Situation | Use instead |
|---|---|
| More than five choices | `md-chip` set, `md-select`, or `md-menu` |
| Navigating between destinations or panels | `md-tabs` / `md-navigation-bar` |
| Running actions rather than choosing a state | `md-button-group` |
| A form field that must submit | `md-radio` / `md-checkbox` |
| One default action plus variants | `md-split-button` |
| Choosing from a long or dynamic list | `md-select` |
| Free-form multi-select of many tags | `md-multi-select`, `md-chip` |

## Decision cues

| Need | Setting |
|---|---|
| One choice at a time | default (`multiselect` off) → `role="radiogroup"` |
| Several at once, and clicking again clears a choice | `multiselect` → `role="group"` |
| Compact rows | `density="-1"`…`"-4"` (0 = 40px, −4 = 24px) |
| Hide the selected checkmark | `no-checkmark` on the children |
| Pre-select an option | `selected` on that child |

## API contract

```html
<md-segmented-button-set multiselect aria-label="View mode">
  <md-segmented-button value="day"   label="Day" selected></md-segmented-button>
  <md-segmented-button value="week"  label="Week"></md-segmented-button>
  <md-segmented-button value="month" label="Month"></md-segmented-button>
</md-segmented-button-set>
```

| Prop | Attribute | Type | Default | Purpose |
|---|---|---|---|---|
| `multiselect` | `multiselect` | `boolean` | `false` | Allow several selections, and allow clearing one |
| `density` | `density` | `-1` … `-4` | `0` | 0 = 40px, −1 = 36px, −2 = 32px, −3 = 28px, −4 = 24px |

Rung `0` is the uncompacted default and has no CSS rule, so `density="0"` does
nothing — it does **not** opt the set out of an inherited `data-density`
ancestor. Use `style="--md-sys-density-scale: 0"` for that.

**Slots** — `(default)`: `md-segmented-button` children. No named slots.

**Methods** — none.

**Parts** — none; the set renders only a `<slot>`.

**Events**

| Event | Detail | Bubbles / composed | Fires |
|---|---|---|---|
| `mdChange` | `string[]` — the `value` of every selected segment, in DOM order | yes / yes | On every segment activation |

### Behavioral contract worth knowing

- The set **owns selection.** A segment never toggles itself: it emits an
  internal `mdSegmentClick`, and the set writes `selected` — on the clicked
  segment in `multiselect`, or on the clicked one and off every sibling in
  single-select — then emits `mdChange` with the full snapshot.
- **Single-select cannot be emptied by clicking.** Clicking the already-selected
  segment re-selects it and re-emits the same array. Only `multiselect` lets a
  click clear a choice, so only there can `mdChange` carry `[]`.
- `mdChange` fires on **every** activation, including one that leaves the
  selection unchanged. It never fires on mount.
- The set consumes the children's `mdSegmentClick` and calls
  `stopPropagation()`, so that event never reaches your listeners.
- It writes `segmentIndex`, `segmentTotal`, `segmentDensity`, and
  `segmentMultiselect` onto each child so they can render the correct end caps
  and checkbox/radio role. **Never set those yourself.**
- Those stamps are applied on load and whenever `multiselect` or `density`
  changes — there is no mutation observer. Segments appended later are clickable
  but keep a stale `segmentIndex` / `segmentTotal`, so render the full set of
  segments up front (M3 caps it at five anyway).
- `role` is `radiogroup` in single-select, `group` in `multiselect`. Give the
  set an `aria-label`; it has no naming prop, so the plain attribute is used.
- There is **no roving tabindex**: every enabled segment is its own Tab stop.
  Arrow keys move between segments (and select in single-select) — see
  [`md-segmented-button`](../md-segmented-button).
- Set the initial selection with `selected` on a child, not on the set — the set
  has no `value` prop, and nothing is selected by default.
- Layout is an inline grid of equal-width columns, so every segment is as wide
  as the widest one and the set shrink-wraps its content rather than stretching.

---

## Do / Don't

Sourced from [M3 · Segmented buttons · Guidelines](https://m3.material.io/components/segmented-buttons/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use for **2–5** choices | Don't exceed five segments — scope the choices or switch to chips |
| Keep labels short and similar in length | Don't let segments wrap onto a new line |
| Use a consistent label type across all segments | Don't mix icon-only and text segments in one set |
| Use icons instead of labels only when the meaning is unmistakable | Don't use ambiguous icon-only segments |
| Leave adequate margin around the set | Don't let the container reach the viewport edge |
| Cap the padding inside segments on large screens | Don't let the set span the full width of a wide pane — it becomes hard to use |
| Give the set an `aria-label` for what it controls | Don't leave a radiogroup unnamed |

---

## Patterns

```html
<!-- Single-select view switch -->
<md-segmented-button-set aria-label="Calendar view">
  <md-segmented-button value="day"   label="Day" selected></md-segmented-button>
  <md-segmented-button value="week"  label="Week"></md-segmented-button>
  <md-segmented-button value="month" label="Month"></md-segmented-button>
</md-segmented-button-set>

<script type="module">
  document.querySelector('md-segmented-button-set')
    .addEventListener('mdChange', (e) => {
      const [view] = e.detail;   // single-select always reports exactly one
      console.log('view is now', view);
    });
</script>
```

```html
<!-- Multi-select filters: e.detail can be [] here -->
<md-segmented-button-set multiselect aria-label="Filters" id="filters">
  <md-segmented-button value="unread"  label="Unread"  icon="mark_email_unread"></md-segmented-button>
  <md-segmented-button value="starred" label="Starred" icon="star"></md-segmented-button>
  <md-segmented-button value="mine"    label="Mine"    icon="person"></md-segmented-button>
</md-segmented-button-set>

<script type="module">
  document.getElementById('filters').addEventListener('mdChange', (e) => {
    console.log('active filters:', e.detail);   // [] when nothing is on
  });
</script>
```

```html
<!-- Compact, in a dense region -->
<md-segmented-button-set density="-2" aria-label="Layout">
  <md-segmented-button value="list" icon="view_list" label="List" selected></md-segmented-button>
  <md-segmented-button value="grid" icon="grid_view" label="Grid"></md-segmented-button>
</md-segmented-button-set>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Six or more segments | Cap at five, or use `md-chip` / `md-select` | M3's hard limit for this component. |
| `<md-segmented-button-set value="week">` | Put `selected` on the child | The set has no `value` prop. |
| Setting `segment-index` / `segment-total` by hand | Let the set stamp them | Set-owned; wrong values break the end caps. |
| Wrapping children in a `<div>` for layout | Keep them direct children | The set is an `inline-grid` with `grid-auto-columns: 1fr`, so only direct children become equal-width columns — a wrapper collapses everything inside it into one column. (Seam collapsing still works, since the set finds segments with a deep `querySelectorAll`.) |
| Appending segments after first render | Render them all up front | The stamps are not re-applied automatically, so end caps go stale. |
| Expecting single-select to become empty | Guard only in `multiselect` | A single-select click always ends with exactly one selection. |
| Assuming `mdChange` means the selection differed | Compare against your own state | It fires on every activation, including a no-op re-click. |
| Using it for tabs | `md-tabs` | Segmented buttons choose a state, not a panel. |
| Mixing an icon-only segment with text segments | Pick one label type | M3 explicitly warns against this. |
| Full-width set on a wide screen | Constrain the width | M3: too much padding makes it less usable. |
| Listening to children's `mdSegmentClick` | Listen to the set's `mdChange` | The set stops that event before it can bubble to you. |
| Toggling a child's `selected` in the `mdChange` handler | Let the set own it | You would fight the write the set just made. |

## Accessibility, RTL, density, i18n

**Accessibility**
- `radiogroup` (single) / `group` (multi). Give the **set** an `aria-label`
  naming what it controls — the children name themselves via their labels.
- Icon-only segments need their own `aria-label`.
- Every enabled segment is a Tab stop (there is no roving tabindex), and arrow
  keys also move between segments, selecting as they go in single-select.
- The selected segment shows a checkmark by default, so selection isn't
  conveyed by color alone. Think twice before `no-checkmark`, especially in
  multiselect.

**RTL** — segment order and end-cap rounding flip with `dir="rtl"`.
Directional icons need swapping yourself.

**Density** — `density` maps to concrete heights: 0 = 40px, −1 = 36px,
−2 = 32px, −3 = 28px, −4 = 24px, and tapers icon size, gap and label type with
them. Below −2, verify touch targets. A child's own `density` attribute
overrides the rung the set stamps.

**i18n** — translate child `label`s. Translated labels vary in length and M3
requires similar-length, non-wrapping labels: re-check the set per locale.
Because the columns are equal-width, the widest translation sets the width of
every segment.

## Related components

`md-segmented-button` · `md-button-group` · `md-tabs` · `md-chip` ·
`md-radio` · `md-select`

## Theming

The set itself reads no custom properties and exposes no CSS parts. Theme the
children with the `--md-segmented-button-*` properties documented in
[`md-segmented-button`](../md-segmented-button); they inherit, so setting them
on the set applies to every segment.

```css
md-segmented-button-set.brand {
  --md-segmented-button-selected-container-color: var(--md-sys-color-tertiary-container);
  --md-segmented-button-selected-label-color: var(--md-sys-color-on-tertiary-container);
}
```

<!-- Auto Generated Below -->


## Properties

| Property      | Attribute     | Description                                                   | Type                        | Default |
| ------------- | ------------- | ------------------------------------------------------------- | --------------------------- | ------- |
| `density`     | `density`     | Density: 0 = 40px, -1 = 36px, -2 = 32px, -3 = 28px, -4 = 24px | `-1 \| -2 \| -3 \| -4 \| 0` | `0`     |
| `multiselect` | `multiselect` | Single-select or multi-select mode                            | `boolean`                   | `false` |


## Events

| Event      | Description                                           | Type                    |
| ---------- | ----------------------------------------------------- | ----------------------- |
| `mdChange` | Fires when the set of selected segment values changes | `CustomEvent<string[]>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
