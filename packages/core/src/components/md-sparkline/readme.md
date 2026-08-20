# md-sparkline

<!-- llm:meta
tag: md-sparkline
category: charts
status: custom
m3-guidelines: none — M3 has no chart components
form-associated: false
depends-on: none
used-by: none
engine: in-house Canvas2D + DOM overlay (utils/charts/engine)
-->

**A micro-chart with no chrome.** A trend line, bar, or area sized to sit
inside a table cell, a card, or a line of text. No axes, no legend, no title.

> ⚠️ **Not a Material Design 3 component.** M3 ships no charts. The engine is
> **in-house Canvas2D with a DOM overlay** (`utils/charts/engine`).

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md), the library-wide guide that ships
> alongside these component docs.

---

## When to use

- A **trend at a glance** beside a number: a KPI tile, a table cell, a card
  header.
- Many small trends in a list, where full charts would be overwhelming.

## When NOT to use

| Situation | Use instead |
|---|---|
| A chart users will read values from | `md-line-chart` |
| Comparing categories | `md-bar-chart` |
| Parts of a whole | `md-pie-chart` |
| Cumulative volume as the main story | `md-area-chart` |
| Anything needing axes, a legend, a title or a loading state | The full chart components |
| A determinate progress bar | `md-progress-indicator` |
| A single value | Plain text, `md-badge` |

## Decision cues

| Need | Setting |
|---|---|
| Trend line | `variant="line"` (default) |
| Discrete periods | `variant="bar"` |
| Filled trend | `variant="area"` |
| Highlight high/low | `show-marks="extremes"` (default) |
| First and last points | `show-marks="edges"` |
| Every point | `show-marks="all"` |
| No point markers | `show-marks="none"` |
| Semantic colour | `color="primary\|error\|success\|warning\|info\|…"` or any CSS colour |
| Fixed scale across several sparklines | `min` / `max` |
| Shaded index windows | `referenceAreas` (JS property) |
| Silent (no hover readout) | `show-tooltip="false"` |

## API contract

```html
<md-sparkline
  variant="line|bar|area"                        <!-- default: line -->
  color="primary"                                <!-- default: primary -->
  curve="linear|smooth|monotone|step|step-before|step-middle"   <!-- default: smooth -->
  show-marks="none|extremes|edges|all"           <!-- default: extremes -->
  show-tooltip                                   <!-- default: ON; set show-tooltip="false" to silence -->
  min="0"                                        <!-- default: auto-scaled to the data -->
  max="100"                                      <!-- default: auto-scaled to the data -->
  line-width="2.5"                               <!-- default: 2.5 (line / area) -->
  mark-size="3"                                  <!-- default: per-symbol (line / area) -->
  bar-width="4"                                  <!-- default: auto (bar variant) -->
  corner-radius="2"                              <!-- default: 2 (bar variant) -->
  height="32px"                                  <!-- default: 28px -->
  no-animation                                   <!-- default: off -->
></md-sparkline>
```

Arrays and functions have no attribute form — set them as JS properties:

```js
const spark = document.querySelector('md-sparkline');

spark.data   = [3, 5, 4, 8, 6, 9, 7];              // numbers, or null for a gap
spark.labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];   // tooltip x labels
spark.valueFormatter = (v) => `${v ?? 0}%`;
// from / to are INDICES into `data` — this shades Sat–Sun.
spark.referenceAreas = [{ from: 5, to: 6, color: '#B3261E', label: 'Weekend' }];
```

**Events** — `mdSparkClick` (`{ dataIndex, value }` — `value` is `null` for a
gap), `mdReady` (fires once the first frame has drawn). Both are the Stencil
default — they bubble and cross shadow boundaries.

**Methods** — `resize()`, `getInstance()`. Both async. There is **no
`replay()`, `toDataURL()`, `drill()` or zoom API** — those live on the full
chart components.

**Slots** — none; the component renders no `<slot>`. There is no header,
footer, empty or loading slot by design.

**Parts** — `canvas`. The engine additionally marks the `<canvas>` as
`plot-canvas` and the hover card as `tooltip`.

### Behavioral contract worth knowing

- **The data prop is `data`** — a flat array of numbers (or `null` for a gap);
  `labels` is a parallel array used only for the tooltip. Both are JS
  properties, as is `valueFormatter` and `referenceAreas`.
- **Nulls are always bridged**, never drawn as gaps. There is no `connect-nulls`
  prop here; if a gap must read as a gap, use `md-line-chart`.
- **It auto-scales to its own data.** Several sparklines side by side each use
  their own scale, which makes them look comparable when they aren't — set the
  same `min` / `max` on all of them when comparing.
- **`referenceAreas` `from` / `to` are data INDICES, not values** — they shade a
  vertical window of the series (a weekend, an outage), not a value band. They
  are drawn on the `line` and `area` variants only.
- A reference area's `color` is used as a raw CSS colour, not an MD3 role: a
  `#rrggbb` or `rgb(...)` value is tinted to 18% alpha, anything else is used as
  given. Omit it to get a tint of the line colour.
- **`curve`, `show-marks`, `line-width` and `mark-size` apply to `line` / `area`
  only**; `bar-width` and `corner-radius` apply to `bar` only.
- **Switching `variant` between `bar` and the others swaps the engine** and
  repaints from scratch — cheap, but not an animated transition.
- The host is `role="img"` with a generated `aria-label`
  ("Sparkline, latest …, range … to ….", plus any labelled reference areas), so
  it is *not* silent to assistive tech — but it is also not a substitute for
  showing the number.
- **There is no `density` prop.** Size it with `height` and the inline-size
  custom properties.
- `show-tooltip` is on by default; turn it off for decorative sparklines inside
  an already-interactive row.
- Call `resize()` when the container's size changes without a layout event
  (e.g. a virtualized table row being re-measured).
- Charts re-read the theme tokens and repaint on their own when
  `prefers-color-scheme` changes. Any *other* theme swap (a manual light/dark
  class, a brand-token change) needs a nudge: reassign `data`. `resize()` will not
  do it — it returns early when the box has not changed.

---

## Do / Don't

House rules — M3 ships no chart component, so the guidance below is this
library's own.

| ✅ Do | ❌ Don't |
|---|---|
| Pair it with the actual number | Don't ship a sparkline alone — it has no scale |
| Set `min`/`max` when several sparklines are compared | Don't let each auto-scale and imply false comparability |
| Keep it small and chrome-free | Don't try to add axes or a legend — use a full chart |
| Use `show-marks="extremes"` to anchor the read | Don't mark every point — it becomes noise |
| Use semantic `color` to encode good/bad | Don't rely on colour alone for the meaning |
| Turn off the tooltip inside an interactive row | Don't stack a tooltip on top of a row click target |
| Use `referenceAreas` for a period worth flagging | Don't annotate with absolutely-positioned overlays |
| Provide the series in a table when it matters | Don't make the sparkline the only access |

---

## Patterns

```html
<!-- KPI tile: number plus trend -->
<md-card>
  <div><strong>12,480</strong> visits <span>up 8% this week</span></div>
  <md-sparkline id="s" height="32px" color="primary"></md-sparkline>
</md-card>

<script type="module">
  const s = document.getElementById('s');
  s.data   = [980, 1120, 1050, 1340, 1290, 1480, 1560];
  s.labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  s.valueFormatter = (v) => new Intl.NumberFormat('en-US').format(v ?? 0);
</script>
```

```html
<!-- In a table cell: comparable scale, no tooltip -->
<md-table-cell>
  <md-sparkline id="row1" min="0" max="100" show-tooltip="false"
                variant="bar" height="24px"></md-sparkline>
</md-table-cell>
<script type="module">
  document.getElementById('row1').data = [42, 55, 48, 61, 70];
</script>
```

```html
<!-- Shade an index window, and react to a click -->
<md-sparkline id="w" height="32px"></md-sparkline>
<script type="module">
  const w = document.getElementById('w');
  w.data = [3, 5, 4, 8, 6, 9, 7];
  w.referenceAreas = [{ from: 5, to: 6, label: 'Weekend' }];
  w.addEventListener('mdSparkClick', (e) => showDay(e.detail.dataIndex, e.detail.value));
</script>

<!-- Reduced motion -->
<md-sparkline no-animation></md-sparkline>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `chart.series = [...]` | `spark.data = [...]` | Sparkline uses `data`. |
| `<md-sparkline data="1,2,3">` | Assign the array in JS | Arrays don't cross the attribute boundary. |
| `referenceAreas: [{ from: 0, to: 40 }]` meaning values | `from` / `to` are data indices | It shades a window of points, not a value band. |
| `referenceAreas` on `variant="bar"` | Use `line` / `area` | Reference areas are not drawn on bars. |
| Expecting a `null` to show as a gap | Use `md-line-chart` | Nulls are always bridged here. |
| Several sparklines auto-scaled, read as comparable | Set the same `min`/`max` | Independent scales mislead. |
| A sparkline with no accompanying number | Show the value too | It has no axis to read against. |
| Expecting a legend, axes, title or loading state | Use a full chart | Deliberately chrome-free. |
| `spark.toDataURL()` / `spark.replay()` | Use a full chart | Neither method exists here. |
| Looking for `density` | Size with `height` / inline-size properties | There is no density prop. |
| Tooltip enabled inside a clickable row | `show-tooltip="false"` | Competes with the row target. |
| Sparkline in a virtualized row with no `resize()` | Call it on re-measure | Renders at the wrong size. |
| Colour as the only signal of good/bad | Add the value or an icon | Colour-only encoding. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The host is `role="img"` with an auto-generated `aria-label`: the latest
  value, the range, and the labels of any reference areas. Give every
  `referenceAreas` entry a `label` if it carries meaning — that is the only
  surface a screen-reader user has for it.
- That summary is a fallback, not a data table. A sparkline is a **summary**:
  the surrounding content must carry the meaning — the value, the direction, and
  ideally the period ("12,480 visits, up 8% this week").
- If the trend is purely decorative next to text that already says it all, set
  `aria-hidden="true"` on the element so it isn't announced twice.
- Never encode good/bad by colour alone.
- The engine already honours `prefers-reduced-motion`; `no-animation` turns the
  entrance off outright.

**RTL** — the finished frame is mirrored under `dir="rtl"`, so the series runs
from the reading start.

**Density** — there is no `density` prop on this component. Size it with the
`height` attribute and `--md-sparkline-inline-size` /
`--md-sparkline-min-inline-size`.

**i18n** — `labels` and `valueFormatter` feed the tooltip and the accessible
summary; format numbers and dates with `Intl` there.

## Related components

`md-line-chart` · `md-bar-chart` · `md-area-chart` · `md-pie-chart` ·
`md-card` · `md-table-cell` · `md-progress-indicator`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-sparkline-block-size` | Height (the `height` attribute overrides it) | `28px` |
| `--md-sparkline-inline-size` | Width | `100%` |
| `--md-sparkline-min-inline-size` | Minimum width before clipping | `32px` |

The series colour is the `color` prop — an MD3 role (`'primary'`, `'error'`,
`'success'`, …) or any CSS colour — not a custom property, so it re-themes with
the tokens.

**CSS parts** — `canvas`, plus the engine-set `plot-canvas` and `tooltip`.

```css
md-sparkline {
  --md-sparkline-block-size: 24px;
  --md-sparkline-inline-size: 120px;
}
```

<!-- Auto Generated Below -->


## Overview

md-sparkline — compact inline chart, rendered by the in-house
engine (Canvas2D). No ECharts.

Sparklines are presentational: no axes, no legend and no title. A
hover tooltip + crosshair IS on by default — set `show-tooltip="false"`
to drop it. Line / area drive
LineChartEngine in `compact` mode; the bar variant drives
BarChartEngine. `show-marks` maps to selective extremes/edges dots.

## Properties

| Property         | Attribute       | Description                                                                                                                                                                                                                       | Type                                                                             | Default      |
| ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ |
| `barWidth`       | `bar-width`     | Fixed bar WIDTH in px (bar variant), centred in each slot. Default: auto.                                                                                                                                                         | `number \| undefined`                                                            | `undefined`  |
| `color`          | `color`         | Sparkline tint (MD3 role or raw colour).                                                                                                                                                                                          | `string`                                                                         | `'primary'`  |
| `cornerRadius`   | `corner-radius` | Bar corner radius (bar variant only).                                                                                                                                                                                             | `number`                                                                         | `2`          |
| `curve`          | `curve`         | Curve type — only meaningful for line / area variants.                                                                                                                                                                            | `"linear" \| "monotone" \| "smooth" \| "step" \| "step-before" \| "step-middle"` | `'smooth'`   |
| `data`           | --              | Numeric data series. Pass `null` for gaps.                                                                                                                                                                                        | `MdChartDataPoint[]`                                                             | `[]`         |
| `heightProp`     | `height`        | Block-size override (defaults to 28px — table-cell friendly).                                                                                                                                                                     | `string \| undefined`                                                            | `undefined`  |
| `labels`         | --              | Optional category labels for tooltips / a11y.                                                                                                                                                                                     | `(string \| number \| Date)[] \| undefined`                                      | `undefined`  |
| `lineWidth`      | `line-width`    | Line stroke width in px (line / area variants). Default 2.5.                                                                                                                                                                      | `number \| undefined`                                                            | `undefined`  |
| `markSize`       | `mark-size`     | Marker RADIUS in px (line / area variants). Overrides the per-symbol default.                                                                                                                                                     | `number \| undefined`                                                            | `undefined`  |
| `max`            | `max`           | Pin the value scale's UPPER bound instead of auto-scaling to the data.                                                                                                                                                            | `number \| undefined`                                                            | `undefined`  |
| `min`            | `min`           | Pin the value scale's LOWER bound instead of auto-scaling to the data. Give several sparklines the same `min` + `max` and they share a comparable scale — a 0–40% metric no longer fills the whole height and reads as maxed out. | `number \| undefined`                                                            | `undefined`  |
| `noAnimation`    | `no-animation`  | Disable all animation.                                                                                                                                                                                                            | `boolean`                                                                        | `false`      |
| `referenceAreas` | --              | Highlight a vertical range (e.g. weekend, anomaly window).                                                                                                                                                                        | `MdSparklineReferenceArea[] \| undefined`                                        | `undefined`  |
| `showMarks`      | `show-marks`    | Show min / max / first / last markers.                                                                                                                                                                                            | `"all" \| "edges" \| "extremes" \| "none"`                                       | `'extremes'` |
| `showTooltip`    | `show-tooltip`  | Show tooltip + crosshair on hover. Defaults to true.                                                                                                                                                                              | `boolean`                                                                        | `true`       |
| `valueFormatter` | --              | Format raw values for tooltips / a11y.                                                                                                                                                                                            | `((value: number \| null) => string) \| undefined`                               | `undefined`  |
| `variant`        | `variant`       | Visual variant.                                                                                                                                                                                                                   | `"area" \| "bar" \| "line"`                                                      | `'line'`     |


## Events

| Event          | Description | Type                                                         |
| -------------- | ----------- | ------------------------------------------------------------ |
| `mdReady`      |             | `CustomEvent<void>`                                          |
| `mdSparkClick` |             | `CustomEvent<{ dataIndex: number; value: number \| null; }>` |


## Methods

### `getInstance() => Promise<LineChartEngine | BarChartEngine | null>`



#### Returns

Type: `Promise<LineChartEngine | BarChartEngine | null>`



### `resize() => Promise<void>`



#### Returns

Type: `Promise<void>`




## Shadow Parts

| Part       | Description |
| ---------- | ----------- |
| `"canvas"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
