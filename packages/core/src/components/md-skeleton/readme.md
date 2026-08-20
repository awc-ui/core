# md-skeleton

<!-- llm:meta
tag: md-skeleton
category: status
status: custom
m3-guidelines: none — not an M3 component
m3-derived-from: https://m3.material.io/components/loading-indicator/guidelines
reference-parity: https://mui.com/material-ui/react-skeleton/
form-associated: false
depends-on: none
used-by: none
-->

**A content-shaped loading placeholder.** Text lines, rectangles, rounded
blocks, or circles, with pulse or wave animation — used to reserve layout while
data loads.

> ⚠️ **Not a Material Design 3 component.** M3 covers loading indicators, not
> skeletons, so the Do/Don't below is house rules; the prop surface mirrors MUI
> Skeleton.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- Loading content whose **shape you know in advance** — a list of rows, a card,
  a profile header.
- Avoiding layout shift while data arrives.
- Loads long enough to notice (roughly >300ms) but not indefinite.

## When NOT to use

| Situation | Use instead |
|---|---|
| Unknown or unstructured content shape | `md-loading-indicator` |
| A determinate operation with known progress | `md-progress-indicator` |
| A very short load (<300ms) | Nothing — flashing skeletons are worse |
| A button working after a click | `md-button loading` |
| Data that failed to load | An error state — not a permanent skeleton |
| A background task not blocking the view | `md-progress-indicator` (linear) |

## Decision cues

| Need | Setting |
|---|---|
| Lines of text | `variant="text"` + `lines="3"` |
| Image / media block | `variant="rectangular"` |
| Card-shaped block | `variant="rounded"` |
| Avatar placeholder | `variant="circular"` |
| Shimmer instead of pulse | `animation="wave"` |
| No motion at all | `animation="none"` |
| Fill the container | `full-width` / `full-height` |
| Exact box | `width` / `height` (CSS length strings) |
| Silence it for assistive tech | `announce="false"` |

## API contract

The authoritative, generated property table is at the bottom of this file. This
is the short form an implementer needs.

```html
<md-skeleton
  variant="text|rectangular|rounded|circular"   <!-- default: text -->
  animation="pulse|wave|none"                   <!-- default: pulse -->
  lines="3"                                     <!-- default: 1; text variant only -->
  width="200px"                                 <!-- CSS length; default: "" -->
  height="1.2em"                                <!-- CSS length; default: "" -->
  full-width                                    <!-- default: false -->
  full-height                                   <!-- default: false -->
  aria-label="Loading"                          <!-- default: "Loading" -->
  announce                                      <!-- default: true -->
  density="-1|-2|-3|-4"                         <!-- default: 0 (uncompacted) -->
></md-skeleton>
```

**Events** — none.

**Methods** — none.

**Slots** — none; the component renders no `<slot>`. It draws its own bars —
you cannot put real content inside it.

**Parts** — `shape` (the rectangular / rounded / circular block), `line` (every
text row) and `line-last` (also carried by the final tapered row when
`lines > 1`).

### Behavioral contract worth knowing

- `lines` applies to `variant="text"` only; every other variant renders one
  `shape` and ignores it. Values below `1` are clamped to `1`, and the value is
  truncated to an integer.
- With `lines > 1` the **last** row is tapered to 60% width so it reads as the
  end of a paragraph. A single line is never tapered.
- **In JavaScript the label property is `ariaLabelProp`, not `ariaLabel`** — the
  HTML attribute is `aria-label`, and the component observes it. Write
  `el.ariaLabelProp = …` or `el.setAttribute('aria-label', …)`. (`el.ariaLabel`
  is the browser's own ARIA-reflection property; it does reach the component,
  because it writes the same `aria-label` attribute, but it is not this
  component's prop — do not rely on it.)
- `announce` (default **on**) gives the host `role="status"`, `aria-busy`,
  `aria-live="polite"` and the label. `announce="false"` instead marks the host
  `aria-hidden="true"` — it disappears from the accessibility tree entirely,
  taking any author-set `aria-label` with it. In a group of many skeletons,
  leave `announce` on for at most one.
- `width` / `height` take **CSS length strings** (`"240px"`, `"60ch"`, `"1.2em"`)
  and are applied as inline custom properties. `full-width` / `full-height`
  override them.
- `full-height` needs a parent with a definite height; without one it falls
  back to the variant's default height rather than collapsing to zero.
- Default heights differ per variant: `1em` for `text` (density-scaled), 120px
  for `rectangular` / `rounded`, 40px for `circular`.
- Every skeleton plays a short spring "bloom" (scale-in + fade) on mount — one
  entrance, not a loop.
- **Reduced motion is already handled.** Under `prefers-reduced-motion: reduce`
  the component forces the effective animation to `none` itself and drops the
  bloom, and it re-evaluates live if the preference changes.
- The skeleton has no timeout and no error state — it renders until **you**
  replace it. A stuck skeleton is a bug in the caller.

---

## Do / Don't

House rules, informed by [M3 · Loading indicator](https://m3.material.io/components/loading-indicator/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Match the skeleton's shape to the real content | Don't show generic grey boxes unrelated to what loads |
| Reserve the same space the content will take | Don't let the layout jump when data arrives |
| Use skeletons for structured, predictable content | Don't use them where the shape is unknown |
| Announce the loading region **once** | Don't let twenty skeletons each announce "Loading" |
| Swap to an error state on failure | Don't leave a skeleton spinning forever |
| Let the component drop its own motion under `prefers-reduced-motion` | Don't hand-roll a reduced-motion branch on top of it |
| Keep skeleton counts close to the expected row count | Don't render 50 placeholders for 3 rows |
| Use `md-loading-indicator` for indeterminate whole-page loads | Don't skeleton an entire unknown page |

---

## Patterns

```html
<!-- Text block -->
<md-skeleton variant="text" lines="3" full-width></md-skeleton>

<!-- Card placeholder: one announcement, the rest silent -->
<md-card>
  <md-skeleton variant="rectangular" full-width height="180px"
               aria-label="Loading article"></md-skeleton>
  <md-skeleton variant="text" lines="2" full-width announce="false"></md-skeleton>
</md-card>

<!-- Avatar -->
<md-skeleton variant="circular" width="40px" height="40px"
             announce="false"></md-skeleton>

<!-- Static placeholder -->
<md-skeleton animation="none"></md-skeleton>
```

```html
<!-- List rows: ONE live region wrapping many silent skeletons -->
<div id="rows" role="status" aria-label="Loading contacts"></div>

<script type="module">
  const rows = document.getElementById('rows');

  function placeholders(count) {
    rows.replaceChildren();
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:12px; align-items:center;';

      const avatar = document.createElement('md-skeleton');
      avatar.variant = 'circular';
      avatar.width = '40px';
      avatar.height = '40px';
      avatar.announce = false;

      const line = document.createElement('md-skeleton');
      line.variant = 'text';
      line.fullWidth = true;
      line.announce = false;

      row.append(avatar, line);
      rows.append(row);
    }
  }

  placeholders(3);

  try {
    rows.replaceChildren(renderRows(await load()));
  } catch {
    rows.replaceChildren(renderError());   // never leave the skeletons up
  }
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Twenty skeletons each with `announce` on | One announcement for the region | Screen readers repeat "Loading" twenty times. |
| Treating `el.ariaLabel` as the component's prop | `el.ariaLabelProp = …` or `setAttribute('aria-label', …)` | `ariaLabel` is the browser's ARIA-reflection property; it only lands because it writes the same `aria-label` attribute. Use the real prop. |
| A skeleton that stays on error | Render an error state | Skeletons imply "arriving shortly". |
| Generic boxes unrelated to the content | Match the real shape | Otherwise the layout still jumps. |
| A skeleton for a 100ms fetch | Render nothing | The flash is worse than the wait. |
| `lines` on `variant="circular"` | `lines` is for `text` | Ignored elsewhere. |
| `width="200"` | `width="200px"` | It is a raw CSS length string, not a number. |
| Wrapping real content in `md-skeleton` | Render the skeleton *instead of* the content | It has no slot; children are never rendered. |
| Branching on `prefers-reduced-motion` yourself | Leave `animation` alone | The component already forces `none`. |
| A skeleton as an empty state | Render a real empty state | "No data" isn't "loading". |
| Skeletons for an indeterminate whole-page load | `md-loading-indicator` | Shape is unknown. |

## Accessibility, RTL, density, i18n

**Accessibility**
- With `announce` on (the default) the host is `role="status"` + `aria-busy` +
  `aria-live="polite"` + `aria-label`; with it off the host is
  `aria-hidden="true"`.
- Announce **once** per loading region. The most common defect here is a chorus
  of "Loading" announcements — prefer one wrapping `role="status"` container
  with `announce="false"` on every skeleton inside it.
- Reduced motion is honoured internally, so you do not need a second code path.
- Ensure the placeholder colour has enough contrast against the surface to be
  visible, without reading as real content. Under forced-colors the bars fall
  back to `GrayText`.

**RTL** — shapes are symmetric; the tapered last line anchors to the reading
start and the `wave` shimmer reverses so it always sweeps in the reading
direction.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung, tightening the text line height, the line gap, the rounded radius and the
circular/rectangular default sizes. Rung `0` is the uncompacted default and is
inert — it does **not** opt a skeleton out of an inherited rung; for that, set
`style="--md-sys-density-scale: 0"`. An explicit `width` / `height` opts that
dimension out of density scaling.

**i18n** — translate the `aria-label` attribute (default English `"Loading"`).

## Related components

`md-loading-indicator` · `md-progress-indicator` · `md-card` · `md-list`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-skeleton-color` | Base fill | `--md-sys-color-surface-container-highest` |
| `--md-skeleton-highlight` | Wave shimmer highlight | `--md-sys-color-surface-bright` |
| `--md-skeleton-radius` | Radius for `text` lines and `rectangular` | `--md-sys-shape-corner-extra-small` (4px) |
| `--md-skeleton-rounded-radius` | Radius for `variant="rounded"` | `12px`, density-scaled, floor `8px` |
| `--md-skeleton-width` | Default inline size | `100%` (the circular default size when circular) |
| `--md-skeleton-height` | Default block size | `1em` text · `120px` rectangular/rounded · the circular size |
| `--md-skeleton-size` | Circular default box | `40px`, density-scaled, floor `28px` |
| `--md-skeleton-line-gap` | Gap between text rows | `8px`, density-scaled, floor `4px` |
| `--md-skeleton-pulse-duration` | Pulse cycle | `--md-sys-motion-duration-extra-long2` (1800ms) |
| `--md-skeleton-wave-duration` | Wave sweep | `--md-sys-motion-duration-extra-long2` (1800ms) |
| `--md-skeleton-bloom-duration` | Mount entrance | `--md-sys-motion-spring-spatial-default-duration` (500ms) |

**CSS parts** — `shape`, `line`, `line-last`.

```css
md-skeleton.on-dark {
  --md-skeleton-color: var(--md-sys-color-surface-container-high);
  --md-skeleton-highlight: var(--md-sys-color-surface-container-highest);
}
```

<!-- Auto Generated Below -->


## Properties

| Property        | Attribute     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Type                                                 | Default     |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| `animation`     | `animation`   | Animation style: - `pulse` (default) — gentle opacity fade in and out. - `wave` — shimmer gradient sweeps across the surface. - `none` — static block; useful in `prefers-reduced-motion` opt-outs   or when the skeleton is purely decorative.                                                                                                                                                                                                                                                                                                                                       | `"none" \| "pulse" \| "wave"`                        | `'pulse'`   |
| `announce`      | `announce`    | Whether to expose the skeleton to assistive tech at all. Set to `false` when the surrounding region already announces its own busy state — duplicate announcements get noisy.                                                                                                                                                                                                                                                                                                                                                                                                         | `boolean`                                            | `true`      |
| `ariaLabelProp` | `aria-label`  | Accessible label. Defaults to `Loading`. Pass a more specific label when the skeleton represents a recognisable region ("Loading article") for better screen-reader context.                                                                                                                                                                                                                                                                                                                                                                                                         | `string`                                             | `'Loading'` |
| `density`       | `density`     | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                                                                                                                                                                                                                                 | `-1 \| -2 \| -3 \| -4 \| 0`                          | `0`         |
| `fullHeight`    | `full-height` | Stretch to fill the parent's block size — the placeholder fills its container's height (which must be definite, e.g. a flex/grid cell). Best with the shape variants (`rectangular` / `rounded` / `circular`); pairs with `full-width` for a fully responsive block.                                                                                                                                                                                                                                                                                                                  | `boolean`                                            | `false`     |
| `fullWidth`     | `full-width`  | Stretch to fill the parent's inline size, overriding `width` / `--md-skeleton-width`. (The skeleton is already 100%-wide by default; this makes it explicit and wins over a fixed width — handy in responsive grids.)                                                                                                                                                                                                                                                                                                                                                                 | `boolean`                                            | `false`     |
| `height`        | `height`      | Block size (CSS length). Defaults are `1em` for text, `120px` for rectangular/rounded, and `40px` for circular.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `string`                                             | `''`        |
| `lines`         | `lines`       | Number of text rows to render. Only meaningful for `variant="text"`. The last row is tapered to ~60 % width so it reads as the final line of a paragraph.                                                                                                                                                                                                                                                                                                                                                                                                                             | `number`                                             | `1`         |
| `variant`       | `variant`     | Shape of the skeleton placeholder. - `text` — single short rectangle the height of a body line. With   `lines > 1` the last line gets a tapered width so it reads as a   "last line of a paragraph". - `rectangular` — fills the inline + block sizes you give it; no   border-radius unless you set `--md-skeleton-radius`. - `rounded` — same as `rectangular` but with the MD3 medium corner   radius (or your override). Good for cards / images. - `circular` — perfect circle (1:1 aspect). Use for avatar / icon   placeholders; set `--md-skeleton-size` or `width`+`height`. | `"circular" \| "rectangular" \| "rounded" \| "text"` | `'text'`    |
| `width`         | `width`       | Inline size (CSS length). Overrides any `--md-skeleton-width`. Examples: `"100%"`, `"240px"`, `"60ch"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `string`                                             | `''`        |


## Shadow Parts

| Part      | Description |
| --------- | ----------- |
| `"shape"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
