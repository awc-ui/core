# md-meter

<!-- llm:meta
tag: md-meter
category: status
status: custom
m3-guidelines: none — M3 has no meter page
m3-derived-from: https://m3.material.io/components/progress-indicators/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A read-only graphical display of a numeric value within a known range.**
Storage used, quota consumed, password strength, battery level. `role="meter"`
with the full ARIA value contract on the host, value clamping, Intl-driven
formatting (locale-aware percent by default), and MD3 semantic status colors.

> ⚠️ **Not a Material Design 3 component.** M3 has progress indicators, not
> meters; the Do/Don't below is house rules derived from the progress-indicator
> guidance plus native `<meter>` semantics.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root. Quick start:
> `import '@awc-ui/core/define';`

---

## When to use

- A **current state** within a known range: disk/storage usage, quota, capacity.
- A **strength or level reading**: password strength, signal, battery.
- Anywhere native `<meter>` semantics fit but you want MD3 visuals and theming.
- The same reading **as a ring** — a dashboard tile, a card corner, a compact
  status dot with a number in it — via `variant="circular"`.

## When NOT to use

| Situation | Use instead |
|---|---|
| Showing how far along an **activity** is (upload, install, load) | `md-progress-indicator` — determinate |
| An unknown-length wait | `md-loading-indicator` or indeterminate `md-progress-indicator` |
| The user should **change** the value | `md-slider` |
| A star/score the user assigns | `md-rating` |
| A tiny binary/status signal | `md-status-dot` or `md-badge` |

**Meter vs progress indicator** is the load-bearing distinction: a meter shows a
*state* ("how full"), a progress indicator shows an *activity* ("how far
along"). That is why md-meter deliberately has **no** indeterminate mode, no
4dp expressive gap, no stop dot, and no completion animation — it is a plain
track + fill that sits still.

## Decision cues

Pick the **shape** by the space, not the meaning — both variants read the same
value and carry identical semantics.

| Situation | Setting |
|---|---|
| Reading sits under a label, full container width | `variant="linear"` (default) |
| Reading is a tile / card headline / dashboard cell | `variant="circular"` |
| Ring needs to be bigger or smaller than 48dp | `size="24…240"` |
| Value should be readable inside the ring | `show-value` (centres it) |
| Ring needs a caption | `show-label` (sits underneath) |
| Ring is decorative-small (no room for text) | omit both; `label` still names it for AT |

Pick `color` by what the reading means. Any theme-defined role name works
(`color="brand"` resolves `--md-sys-color-brand` / `-brand-container`).

| Reading | `color` |
|---|---|
| Neutral measurement | `primary` (default — primary fill on secondary-container track) |
| Healthy / plenty left | `success` |
| Approaching the limit | `warning` |
| Critical / exceeded | `error` |
| Informational level | `info` |

## API contract

The full property table is at the bottom of this file. This is the short form an
implementer needs.

```html
<md-meter
  value="24"                          <!-- default: 0 -->
  min="0"                             <!-- default: 0 -->
  max="100"                           <!-- default: 100 -->
  label="Storage used"                <!-- accessible name; header text -->
  show-label show-value               <!-- optional; both default false -->
  value-text="24 GB of 100 GB"        <!-- overrides the formatted value text -->
  locale="de-DE"                      <!-- Intl locale for the value text -->
  color="primary|secondary|tertiary|error|success|warning|info|<any-role>"
                                      <!-- default: primary -->
  thickness="4"                       <!-- track dp; density-scaled, floor 2px -->
  variant="linear|circular"           <!-- default: linear -->
  size="48"                           <!-- ring diameter dp; circular only, 24-240 -->
  density="-1|-2|-3|-4"               <!-- default: 0 (uncompacted) -->
></md-meter>

<!-- The ring: value in the middle, label captioned underneath -->
<md-meter variant="circular" value="72" size="96" thickness="8"
          label="Storage used" show-label show-value></md-meter>
```

```js
// formatOptions is a JS-only object prop (no attribute):
meter.formatOptions = { style: 'unit', unit: 'gigabyte' };
```

**Events** — none. **Methods** — none. Nothing is focusable or interactive.

**Slots** — none; the component renders no `<slot>`. `label` is a text prop so
your i18n layer resolves it.

**Parts** — `track`, `indicator`, `label`, `value`, and `circular` (the ring's
box). `track` / `indicator` are the bar's two divs on the linear variant and the
two SVG circles on the circular one — the same names, so a consumer's
`::part(indicator)` rule keeps working across a variant swap.

### Behavioral contract worth knowing

- `value` is **clamped** into `[min, max]` before ARIA, geometry, and
  formatting — `value="150"` renders and announces 100%. An inverted range
  (`max < min`) collapses to an empty one rather than emitting invalid ARIA,
  and non-finite inputs fall back to `min` / `0` / `100`.
- Default value text is the value's **position in the range** as a locale-aware
  percentage, not the raw number — a reading is only meaningful against its
  bounds: value 24 in 0–100 → "24%"; value 150 in 100–200 → "50%".
- `formatOptions` switches formatting to the **clamped raw value** through
  `Intl.NumberFormat` (units, currency, plain numbers). It is a **JS-only
  object prop** — an HTML attribute will not parse. Invalid option combinations
  degrade to the raw value instead of throwing.
- `value-text` overrides both `aria-valuetext` and the visible header value —
  one string drives what is seen and what is announced, so they can never
  disagree.
- The visible header value is `aria-hidden`; screen readers get the host's
  `aria-valuetext` exactly once.
- `color` is guarded: values that are not a plain CSS ident are ignored (the
  name is interpolated into a custom-property name). Unknown-but-valid role
  names degrade to the neutral primary look.
- Value changes animate the fill (300ms standard easing); the transition is
  removed under `prefers-reduced-motion`. The ring animates
  `stroke-dashoffset` — a single number, so it interpolates; the arc is drawn
  on a `pathLength="1"` circle so the fill IS the fraction, with no
  circumference arithmetic to redo whenever size or thickness changes.
- **`variant="circular"` replaces the header row**, it does not add to it:
  `show-value` renders the value inside the ring, `show-label` captions it
  underneath. Only one element ever carries `part="track"`.
- `size` is **clamped to 24–240dp** (md-progress-indicator's band) and ignored
  entirely by the bar. Density tapers the whole ring (2px/rung) rather than the
  stroke alone, so radius and stroke stay in proportion.
- The centred ring value is sized at 26% of the diameter, so a small ring
  cannot hold a long reading.
- The stroke straddles the radius, so the drawn circle is always
  `size − thickness` across — budget for that when aligning a ring to
  neighbouring content.
- The ring **does not mirror under `dir="rtl"`** — it fills clockwise from
  twelve o'clock in every locale, matching Material's circular progress
  indicator. Only the caption's text direction flips.
- At `value` = min the arc is hidden outright, so its round cap can't leave a
  stray dot on an empty ring.

---

## Do / Don't

House rules, informed by [M3 · Progress indicators · Guidelines](https://m3.material.io/components/progress-indicators/guidelines)
and by native `<meter>` semantics.

| ✅ Do | ❌ Don't |
|---|---|
| Pick the shape by the space — bar in a column of labelled rows, ring as a tile's focal point | Don't show the same reading as both a bar and a ring on one screen — it reads as two measurements |
| Let one element carry the reading: `show-value` (+ `value-text`) | Don't pair the meter with your own `<span>` of the same number — the two will drift |
| Size the ring for its text; drop `show-value` below ~40dp | Don't cram "45 GB of 100 GB" into a 24dp ring |
| Treat `thickness` as legibility: thicken it (6–8dp) as the ring grows | Don't leave a hairline arc on a large ring, or a fat one that closes a small ring's hole |
| Pair threshold colour with visible text or a label | Don't let a red ring be the only signal — that fails WCAG 1.4.1 |
| Pass `color` a theme **role name** | Don't pass a raw CSS colour — use `--md-meter-indicator-color` for that |
| Fix the range when a reading can exceed it | Don't try to render the overflow; `value` is clamped |
| Let the built-in 300ms fill transition run | Don't animate `inline-size` / `stroke-dashoffset` from outside — you'll fight the component |
| Leave the ring's clockwise fill alone in RTL | Don't add your own `scaleX(-1)` — Material's circular progress doesn't mirror either |
| Always set `label` | Don't ship a `role="meter"` with no accessible name |

---

## Patterns

```html
<!-- Ring, sized and captioned -->
<md-meter variant="circular" label="Storage used" value="72" size="96" thickness="8"
          show-label show-value></md-meter>

<!-- Compact ring with no text at all (the label still names it for AT) -->
<md-meter variant="circular" label="Battery" value="41" size="24" thickness="3"></md-meter>

<!-- Storage quota with visible header -->
<md-meter label="Storage used" value="65" show-label show-value></md-meter>

<!-- Status-colored quota (switch the role as thresholds are crossed) -->
<md-meter label="Storage used" value="96" color="error" show-label show-value></md-meter>

<!-- Fully custom reading -->
<md-meter label="Seats taken" max="10" value="3" value-text="3 of 10 seats"
          show-label show-value></md-meter>
```

```html
<!-- Absolute reading instead of percent: formatOptions is a JS property -->
<md-meter id="gb" label="Storage used" value="256" max="512"
          show-label show-value></md-meter>

<script type="module">
  const gb = document.getElementById('gb');
  gb.formatOptions = { style: 'unit', unit: 'gigabyte' };
</script>
```

```html
<!-- Threshold colours: swap the role as the reading crosses a boundary -->
<md-meter id="quota" label="Storage used" max="512" show-label show-value></md-meter>

<script type="module">
  const quota = document.getElementById('quota');

  function setUsage(gigabytes) {
    quota.value = gigabytes;
    const pct = (gigabytes / quota.max) * 100;
    quota.color = pct >= 95 ? 'error' : pct >= 80 ? 'warning' : 'success';
    // The label keeps the state available as words, not colour alone.
    quota.label = `Storage used — ${pct >= 95 ? 'full' : pct >= 80 ? 'nearly full' : 'healthy'}`;
  }

  setUsage(410);
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| md-meter for an upload/install | `md-progress-indicator` | A meter is a state, not an activity; it has no indeterminate fallback. |
| Omitting `label` | Always set `label` | `role="meter"` needs an accessible name. |
| A second visible value element you maintain yourself | `show-value` (+ `value-text` if needed) | The built-in value can never drift from `aria-valuetext`. |
| `format-options='{"style":"percent"}'` as an attribute | `el.formatOptions = { … }` in JS | Objects don't cross the attribute boundary. |
| `color="#ff0000"` | A role name, or `--md-meter-indicator-color` | `color` takes theme role *names*, not CSS colors. |
| Expecting `value="150"` to overflow the track | It clamps to `max` | A reading past `max` means the range is wrong, not the meter. |
| `variant="circular"` + expecting the header row | The value goes in the middle, the label underneath | The header is the bar's layout. |
| Mirroring the ring yourself for RTL | Leave it | Material's circular progress doesn't mirror; a clock face doesn't either. |
| `size` on the linear variant | `thickness` (bar) / `size` (ring) | The bar is full-width by design. |
| Listening for a change event | Read the value you set | The meter emits no events. |

## Accessibility, RTL, density, i18n

**Accessibility** — the host carries `role="meter"`, `aria-valuemin/max/now`
(clamped/sanitized), `aria-valuetext` (the formatted reading), and `aria-label`
from `label`. All internal DOM is `aria-hidden`. Nothing is focusable — a meter
is not a control. Color is never the only signal: pair status colors with the
visible value or label text.

**RTL** — the bar's geometry is 100% logical properties; the fill anchors to the
inline start and mirrors for free under `dir="rtl"`. The **ring deliberately does
not mirror**: it fills clockwise from twelve o'clock in every locale (Material's
circular progress behaves the same). Only its caption text flips.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung: it thins the track (4dp → 2px floor), tightens the header spacing and
type, and on the ring shrinks the whole circle 2px per rung (floored at 24px) so
radius and stroke stay in proportion. Rung `0` is the uncompacted default and is
inert — it does **not** opt a meter out of an inherited rung; for that, set
`style="--md-sys-density-scale: 0"` on the element.

**i18n** — `label` and `value-text` are plain text props (resolve them in your
i18n layer). `locale` + `formatOptions` exist only for Intl-computed value
output — digits, separators, percent signs, units and currencies follow the
locale.

## Related components

`md-progress-indicator` · `md-loading-indicator` · `md-slider` · `md-rating` ·
`md-status-dot` · `md-badge`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-meter-indicator-color` | Fill color | The `color` role (`--md-sys-color-primary` by default) |
| `--md-meter-track-color` | Track background | The role's container (`--md-sys-color-secondary-container` by default) |
| `--md-meter-track-shape` | Track + fill corner radius | `--md-sys-shape-corner-full` |
| `--md-meter-height` | Track thickness | The `thickness` prop (4dp, density-scaled, floor 2px) |
| `--md-meter-size` | Ring diameter (circular only) | The `size` prop (48dp, density-scaled, floor 24px) |
| `--md-meter-label-color` | Header / caption label text | `--md-sys-color-on-surface` |
| `--md-meter-value-color` | Header / centre value text | `--md-sys-color-on-surface-variant` |

**CSS parts** — `track`, `indicator`, `label`, `value`, `circular`.

```css
md-meter.quota-warning {
  --md-meter-indicator-color: var(--md-sys-color-warning);
  --md-meter-track-color: var(--md-sys-color-warning-container);
}
```

<!-- Auto Generated Below -->

## Properties

| Property | Attribute | Description | Type | Default |
|---|---|---|---|---|
| `value` | `value` | Current value. Clamped into `[min, max]` for ARIA, geometry and formatting. | `number` | `0` |
| `min` | `min` | Lower bound of the range. | `number` | `0` |
| `max` | `max` | Upper bound of the range. Never below `min` — an inverted range collapses to an empty one. | `number` | `100` |
| `label` | `label` | Accessible name (`aria-label`). Also the visible label when `show-label` is set. Pass already-localized text. | `string` | `''` |
| `showLabel` | `show-label` | Render `label` — in the header row (linear) or as a caption under the ring (circular). | `boolean` | `false` |
| `showValue` | `show-value` | Render the formatted value — end-aligned in the header row (linear) or centred in the ring (circular). The visible span is `aria-hidden`; AT reads `aria-valuetext` instead. | `boolean` | `false` |
| `valueText` | `value-text` | Overrides the formatted value entirely — both `aria-valuetext` and the visible value. | `string` | `''` |
| `locale` | `locale` | BCP-47 locale for `Intl.NumberFormat` output. Empty = the runtime default. Intl-computed output only; translatable copy goes through `label`. | `string` | `''` |
| `formatOptions` | — | `Intl.NumberFormatOptions` for the value text. **JS-only object prop** — set it as a property, not an attribute. Omitted = locale-aware percent of the range. | `Intl.NumberFormatOptions \| undefined` | `undefined` |
| `color` | `color` | Theme colour role for fill + track. Any role the theme defines works — `<name>` resolves to `--md-sys-color-<name>` / `-<name>-container`. Non-ident values are ignored. | `'primary' \| 'secondary' \| 'tertiary' \| 'error' \| 'success' \| 'warning' \| 'info' \| string` | `'primary'` |
| `variant` | `variant` | Shape of the reading: a horizontal bar, or a ring with the value centred and the label captioned beneath. Reflected. | `'linear' \| 'circular'` | `'linear'` |
| `size` | `size` | Ring diameter in dp — **circular only**, ignored by the bar. Clamped to 24–240. | `number` | `48` |
| `thickness` | `thickness` | Track / stroke thickness in dp. Density-scaled (0.5px per rung), floored at 2px. | `number` | `4` |
| `density` | `density` | Local density rung, overriding an inherited global `data-density`. 0 = default, -4 = ultra-compact. Reflected. | `0 \| -1 \| -2 \| -3 \| -4` | `0` |

## Events

None. A meter is a read-only display — drive it by setting `value`.

## Methods

None. Nothing here is focusable or interactive.

## Slots

None. `label` is a text prop so your i18n layer resolves it.

## Shadow Parts

| Part | On | Element |
|---|---|---|
| `track` | both | The full range — a div (linear) or the background circle (circular) |
| `indicator` | both | The value fill — a div (linear) or the value arc (circular) |
| `label` | both | Label text: header row (linear) or caption under the ring (circular) |
| `value` | both | Formatted value: header row (linear) or ring centre (circular) |
| `circular` | circular | The ring's box, wrapping the SVG and the centred value |

## Dependencies

None — `md-meter` renders no other AWC UI component.
