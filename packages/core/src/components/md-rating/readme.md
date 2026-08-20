# md-rating

<!-- llm:meta
tag: md-rating
category: selection
status: custom
m3-guidelines: none — not an M3 component
m3-derived-from: https://m3.material.io/components/sliders/guidelines, https://m3.material.io/components/icon-buttons/guidelines
reference-parity: https://mui.com/material-ui/react-rating/
form-associated: true
depends-on: none
used-by: none
-->

**A subjective score on a small, discrete scale.** Star (or custom-glyph)
rating with configurable maximum, optional half-steps, hover preview, and form
participation via `ElementInternals`.

> ⚠️ **Not a Material Design 3 component.** M3 has no rating page, so there is
> no spec to point at. The Do/Don't below are house rules derived from M3's
> slider and icon-button guidance plus this component's behavior.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- Capturing a **subjective judgement** on a small scale: product reviews,
  satisfaction, difficulty.
- **Displaying** an aggregate score read-only (`readonly`).

## When NOT to use

| Situation | Use instead |
|---|---|
| An objective value on a continuum | `md-slider` |
| A precise number | `md-text-field type="number"` |
| Binary like/dislike | `md-icon-button toggle` |
| More than ~10 points of scale | `md-slider` |
| Progress toward completion | `md-progress-indicator` |
| A non-interactive status | `md-badge` / `md-status-dot` |
| Choosing among labelled options | `md-radio` / `md-segmented-button-set` |

## Decision cues

| Need | Setting |
|---|---|
| Half-star precision | `precision="0.5"` |
| Non-interactive display | `readonly` |
| Numeric value beside the stars | `show-value-label` |
| Custom glyph | `icon` / `empty-icon` |
| Solid rather than outlined empties | `outline-empty="false"` |
| No hover preview (touch/dense UI) | `hover="off"` |
| Localized per-value announcement | `getLabel` (function prop) |
| Submit with a form | `name` |

## API contract

```html
<md-rating
  value="3.5" default-value="0"
  max="5" precision="1|0.5"
  size="xs|sm|md|lg|xl"          <!-- default: md -->
  icon="star" empty-icon="star" outline-empty
  readonly disabled soft-disabled
  show-value-label
  rating-label="Rating"          <!-- accessible name -->
  hover="preview|off"
  name="score"
  density="-1|-2|-3|-4"          <!-- default: 0 = uncompacted -->
></md-rating>
```

`getLabel` is a **function prop** — set it in JS:

```js
rating.getLabel = (v) => `${v} out of 5 stars`;
```

**Events**

| Event | Detail | Fires |
|---|---|---|
| `mdHover` | `number \| null` | Hover preview changes; `null` on leave. Suppressed entirely when `hover="off"` |
| `mdChange` | `number` | A rating is committed by click or keyboard |

Both bubble and are composed.

**Methods** — `focusRating()` (async). It focuses the shadow-internal
`role="slider"` element; calling `.focus()` on the host does nothing useful.

**Slots** — none. The glyphs are Material Symbols names via `icon` /
`empty-icon`; the component renders no `<slot>`.

**Parts** — `items` (the focusable slider container), `item` plus exactly one
of `item-full` / `item-half` / `item-empty` on each glyph wrapper,
`icon-filled`, `icon-empty`, `state-layer`, `ripple`, `value-label`.

### Behavioral contract worth knowing

- **Form-associated**: submits `value` under `name` as a string. A value of
  `0` submits **nothing** — it is treated as "no rating given", so read the key
  with `formData.has(name)` rather than assuming an entry exists.
- `value` is a **number**, and with `precision="0.5"` it can be fractional.
  Out-of-range or `NaN` values are clamped into `[0, max]`, and shrinking `max`
  re-clamps `value`.
- **Clicking the current value clears it to `default-value`** (default `0`).
  That is what `default-value` is for — it is *not* the initial display (set
  `value` for that) and *not* the form-reset target.
- **Form reset restores the value the markup was authored with**, not
  `default-value`.
- `mdChange` fires on user interaction only. Assigning `el.value` from script
  updates the control and the form value silently.
- `readonly` is not just "disabled without the grey": the control switches from
  `role="slider"` to `role="img"`, drops out of the tab order, and folds the
  score into its accessible name.
- `disabled` sets `tabindex="-1"`; `soft-disabled` keeps the control focusable
  (so it stays discoverable) while blocking interaction.
- `hover="preview"` (default) previews the value under the pointer and emits
  `mdHover`; it does **not** change `value` until a click. `hover="off"`
  suppresses both the preview and the event.
- **`empty-icon` is ignored while `outline-empty` is on** — and it is on by
  default. With `outline-empty`, empty items are drawn with the *filled* glyph
  in the inactive colour. Set `outline-empty="false"` to make `empty-icon`
  take effect.
- Keyboard: `ArrowUp` / `ArrowDown` and `ArrowLeft` / `ArrowRight` step by
  `precision` (the left/right pair follows reading direction and swaps in RTL),
  `Home` sets `0`, `End` sets `max`, and a **digit key `0`-`9`** sets that value
  directly when it is within `max`. Any other key is left to bubble, so `Escape`
  still closes an enclosing dialog or menu.
- The accessible name is resolved in this order: host `aria-labelledby` text,
  host `aria-label`, the text of any `<label>` associated with the host, then
  the `rating-label` prop. Pointing `aria-labelledby` at your own heading works
  even though the focusable node lives in the shadow root.
- `getLabel` drives the per-value announcement (`aria-valuetext`) **and** the
  visible `show-value-label` text — the single most useful i18n hook here.
- The press ripple is drawn inside the glyph silhouette, not as a circle, and
  it honours the global ripple switch: `data-ripple="off"` on any ancestor (or
  `ripple="off"` on the host) suppresses it. There is no `ripple` prop.

---

## Do / Don't

House rules — derived from M3 slider/icon-button guidance, not a spec page.

| ✅ Do | ❌ Don't |
|---|---|
| Keep `max` small (5 is conventional) | Don't build a 20-star scale — use `md-slider` |
| Use `readonly` for displayed aggregate scores | Don't leave a display-only rating interactive |
| Provide `getLabel` so each value announces meaningfully | Don't let a screen reader announce a bare number |
| Give the control a `rating-label` | Don't ship an unnamed rating |
| Use `precision="0.5"` only if half-steps are real input | Don't offer half-steps users can't reliably hit on touch |
| Keep the glyph conventional (stars) | Don't use an ambiguous glyph for a score |
| Pair the stars with a numeric label for aggregates | Don't rely on glyph count alone for a precise average |
| Turn `hover` off on touch-primary surfaces | Don't depend on hover preview for the interaction to make sense |

---

## Patterns

```html
<!-- Interactive, half steps -->
<md-rating precision="0.5" name="score" rating-label="Rate this product"></md-rating>
<script type="module">
  const r = document.querySelector('md-rating');
  r.getLabel = (v) => `${v} out of ${r.max} stars`;
  r.addEventListener('mdChange', (e) => console.log('rated', e.detail));
  r.addEventListener('mdHover',  (e) => console.log('preview', e.detail)); // null on leave
</script>

<!-- Read-only aggregate with the number shown -->
<md-rating value="4.3" precision="0.5" readonly show-value-label
           rating-label="Average rating"></md-rating>

<!-- Custom glyph (outline-empty on: the filled glyph draws the empties too) -->
<md-rating icon="favorite" max="5" rating-label="Love it"></md-rating>

<!-- Distinct empty glyph: outline-empty must be turned off -->
<md-rating icon="favorite" empty-icon="favorite_border" outline-empty="false"
           rating-label="Love it"></md-rating>

<!-- In a form -->
<form>
  <md-rating name="satisfaction" rating-label="Satisfaction"></md-rating>
  <md-button type="submit">Send feedback</md-button>
</form>

<!-- Touch-first: no hover preview -->
<md-rating hover="off" size="lg" rating-label="Delivery"></md-rating>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `get-label` as an HTML attribute | Assign `getLabel` in JS | Function props don't cross the attribute boundary. |
| `default-value` used to set the initial score | Set `value` | `default-value` is what a re-click clears to. |
| Expecting a form entry for an unrated control | Check `formData.has(name)` | A value of `0` submits nothing. |
| `empty-icon` set while `outline-empty` is on | Add `outline-empty="false"` | The filled glyph is used for empties by default. |
| `ratingEl.focus()` | `await ratingEl.focusRating()` | The focusable node is inside the shadow root. |
| Displaying an average without `readonly` | Add `readonly` | Otherwise users think they're rating. |
| Reading `mdHover` as the chosen value | Use `mdChange` | Hover is a preview and can be `null`. |
| `max="10"` with `precision="0.5"` on touch | Reduce `max`, or use `md-slider` | 20 targets is unhittable. |
| No `rating-label` | Set it | It's the control's accessible name. |
| A slider for a 5-point subjective score | `md-rating` | And vice versa for continuous values. |
| Styling `.md-rating__item` | Use `::part(item)`, `::part(item-full)`, … | Internals are encapsulated; the parts are the supported hook. |
| Assuming an integer `value` | It can be fractional | With `precision="0.5"`. |

## Accessibility, RTL, density, i18n

**Accessibility**
- `rating-label` names the control; `getLabel` supplies the per-value
  announcement — set both.
- Keyboard: arrows step by `precision`, `Home` / `End` jump to `0` / `max`,
  and digit keys set a value directly. `focusRating()` focuses the control
  programmatically.
- Name the control with host `aria-labelledby` / `aria-label`, a wrapping
  `<label>`, or the `rating-label` prop — all four are honoured, in that
  order.
- Filled vs empty is conveyed by glyph fill, not colour alone; keep
  `outline-empty` on unless you have another cue.
- `readonly` remains readable to AT; `disabled` leaves the tab order.
- Check the per-item hit target at small `size` and deep density.

**RTL** — the scale fills from the reading start, so it mirrors under
`dir="rtl"`. Arrow-key direction follows reading order.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung; rung `0` is the uncompacted default and is inert, so it is not an opt-out
from an ancestor rung (for that, set `style="--md-sys-density-scale: 0"`). Each
rung trims 2px off the glyph size for the current `size` (12px floor). Check
the per-item hit target before going deep on touch.

**i18n** — translate `rating-label`, and make `getLabel` locale-aware
(pluralization: "1 star" vs "2 stars"). Format the value with `Intl` when
`show-value-label` is on.

## Related components

`md-slider` · `md-icon-button` · `md-progress-indicator` · `md-badge` ·
`md-segmented-button-set`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-rating-item-size` | Glyph size | Per `size`: 16 / 20 / 28 / 36 / 48px, minus 2px per density rung (12px floor) |
| `--md-rating-item-gap` | Space between glyphs | `--md-sys-spacing-gap-xs` (4px) |
| `--md-rating-active-color` | Filled glyph colour | `--md-sys-color-secondary` |
| `--md-rating-inactive-color` | Empty glyph colour | `--md-sys-color-on-surface-variant` at 30% |
| `--md-rating-state-layer-color` | Hover/press overlay | `--md-sys-color-on-surface` |
| `--md-rating-focus-ring-color` | Focus ring colour | `--md-sys-color-secondary` |
| `--md-rating-focus-ring-width` / `--md-rating-focus-ring-offset` | Focus ring geometry | `3px` / `2px` |
| `--md-rating-value-label-color` | `show-value-label` text colour | `--md-sys-color-on-surface` |
| `--md-rating-value-label-font` | `show-value-label` font shorthand | `label-medium` typescale |
| `--md-rating-icon-font-family` | Glyph font | `Material Symbols Rounded`, then Outlined / Material Icons |
| `--md-rating-pop-scale` | Scale of the hover/select pop | `1.12` |
| `--md-rating-duration` | Pop duration | `--md-sys-motion-duration-short3` (150ms) |

**CSS parts** — `items`, `item`, `item-full`, `item-half`, `item-empty`,
`icon-filled`, `icon-empty`, `state-layer`, `ripple`, `value-label`.

```css
md-rating.brand {
  --md-rating-active-color: var(--md-sys-color-tertiary);
  --md-rating-pop-scale: 1;   /* no pop */
}
```

<!-- Auto Generated Below -->


## Overview

`md-rating` — Material Design 3 Expressive Rating control.

A star-rating input: configurable max, half-step precision, custom icons
(Material Symbols glyphs OR slotted SVG/HTML), per-value icons
(filled / empty), hover preview, read-only and disabled modes,
keyboard navigation (Arrow + Home/End), and reset to zero.

MD3 Expressive: items animate with a brief tonal "scale-up" pop on
hover and selection; press uses a state-layer + ripple. The
underlying ARIA pattern is a slider so screen readers announce the
value as a continuous range.

## Properties

| Property         | Attribute          | Description                                                                                                                                                                                                                                                                                                                                                                                                                    | Type                                       | Default     |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------- |
| `defaultValue`   | `default-value`    | Default value used when the consumer clears the rating (re-clicking the current value).                                                                                                                                                                                                                                                                                                                                        | `number`                                   | `0`         |
| `density`        | `density`          | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                                                                          | `-1 \| -2 \| -3 \| -4 \| 0`                | `0`         |
| `disabled`       | `disabled`         | Disabled — non-interactive and visually dimmed; not focusable.                                                                                                                                                                                                                                                                                                                                                                 | `boolean`                                  | `false`     |
| `emptyIcon`      | `empty-icon`       | Material Symbols glyph used for *empty* items.                                                                                                                                                                                                                                                                                                                                                                                 | `string`                                   | `'star'`    |
| `getLabel`       | --                 | Optional label provider — `el.getLabel = (v) => "${v} Stars"`. Used by the hidden screen-reader text and the visible value label when `show-value-label` is set.                                                                                                                                                                                                                                                               | `((value: number) => string) \| undefined` | `undefined` |
| `hover`          | `hover`            | Hover-preview behaviour:   - `'preview'` (default) — display the hovered value over the live one.   - `'off'` — no hover preview; `value` is the only signal.                                                                                                                                                                                                                                                                  | `"off" \| "preview"`                       | `'preview'` |
| `icon`           | `icon`             | Material Symbols glyph used for *filled* items.                                                                                                                                                                                                                                                                                                                                                                                | `string`                                   | `'star'`    |
| `max`            | `max`              | Maximum rating (number of items rendered).                                                                                                                                                                                                                                                                                                                                                                                     | `number`                                   | `5`         |
| `name`           | `name`             | Form name for native form participation.                                                                                                                                                                                                                                                                                                                                                                                       | `string`                                   | `''`        |
| `outlineEmpty`   | `outline-empty`    | Use the *filled* glyph for empty items as well, drawn with the outline-only color treatment — a solid silhouette outline behind the fill.                                                                                                                                                                                                                                                     | `boolean`                                  | `true`      |
| `precision`      | `precision`        | Step size — `1` (full only) or `0.5` (half).                                                                                                                                                                                                                                                                                                                                                                                   | `0.5 \| 1`                                 | `1`         |
| `ratingLabel`    | `rating-label`     | Accessible name for the rating control.  The attribute is `rating-label`, NOT `aria-label-rating`. Anything starting with `aria-` is parsed as an ARIA attribute, and `aria-label-rating` is not one — so the previous name made axe report a CRITICAL `aria-valid-attr` violation on every consumer that used the documented API. The value still ends up as the host's accessible name; only the attribute spelling changed. | `string`                                   | `'Rating'`  |
| `readonly`       | `readonly`         | Read-only — purely decorative; no interaction, no focus.                                                                                                                                                                                                                                                                                                                                                                       | `boolean`                                  | `false`     |
| `showValueLabel` | `show-value-label` | When true, render the current numeric value beside the items.                                                                                                                                                                                                                                                                                                                                                                  | `boolean`                                  | `false`     |
| `size`           | `size`             | Size of each item.                                                                                                                                                                                                                                                                                                                                                                                                             | `"lg" \| "md" \| "sm" \| "xl" \| "xs"`     | `'md'`      |
| `softDisabled`   | `soft-disabled`    | Soft-disabled — disabled visuals but remains focusable for discoverability.                                                                                                                                                                                                                                                                                                                                                    | `boolean`                                  | `false`     |
| `value`          | `value`            | Current numeric rating (0 → max, half-steps when precision = 0.5).                                                                                                                                                                                                                                                                                                                                                             | `number`                                   | `0`         |


## Events

| Event      | Description                                                          | Type                          |
| ---------- | -------------------------------------------------------------------- | ----------------------------- |
| `mdChange` | Fires whenever the value changes via interaction.                    | `CustomEvent<number>`         |
| `mdHover`  | Fires while the user is hovering (or `null` when the cursor leaves). | `CustomEvent<null \| number>` |


## Methods

### `focusRating() => Promise<void>`

Programmatically focus the rating.

#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part            | Description |
| --------------- | ----------- |
| `"icon-empty"`  |             |
| `"icon-filled"` |             |
| `"items"`       |             |
| `"ripple"`      |             |
| `"state-layer"` |             |
| `"value-label"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
