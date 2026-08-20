# md-status-dot

<!-- llm:meta
tag: md-status-dot
category: status
status: custom
m3-guidelines: none — not an M3 component
m3-derived-from: https://m3.material.io/components/badges/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A presence or health indicator.** A small coloured dot with six states and an
optional pulse, absolutely positioned onto an avatar, a row, or any tile.

> ⚠️ **Not a Material Design 3 component.** M3 has badges, not status dots. The
> Do/Don't below are house rules derived from M3's badge guidance plus general
> status-indicator practice.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- **Presence**: online / away / busy / offline / invisible on an avatar.
- A compact **health or state** marker in a dense list or table row.
- A "live now" / "recording" pip, with `live` for the pulse.

## When NOT to use

| Situation | Use instead |
|---|---|
| A count of unread items | `md-badge` |
| An interactive filter or tag | `md-chip` |
| A status with a text label the user reads | `md-chip` |
| Progress or loading | `md-progress-indicator` / `md-loading-indicator` |
| A large, prominent state banner | `md-card` with semantic colour |
| Something clickable | `md-button` / `md-icon-button` — the dot is `pointer-events: none` |

## Decision cues

| Need | Setting |
|---|---|
| Presence semantics | `state="online\|away\|busy\|offline\|invisible\|neutral"` |
| No semantic meaning (the parent already says it) | `state="neutral"` (default) |
| Attention-drawing animation | `live` |
| Size in a dense table | `size="small"` |
| Default | `size="medium"` |
| Prominent, standalone | `size="large"` |
| Decorative — the parent carries the words | leave `label` empty (default) |
| Standalone, announced statically | `label="Online"` |
| Standalone, changes announced as they happen | `label="Online"` **and** `live` |

## API contract

The authoritative, generated property table is at the bottom of this file. This
is the short form an implementer needs.

```html
<span style="position: relative; display: inline-flex;">
  <md-avatar name="Ada Lovelace"></md-avatar>
  <md-status-dot
    state="online|away|busy|offline|invisible|neutral"   <!-- default: neutral -->
    size="small|medium|large"                            <!-- default: medium -->
    live                                                 <!-- default: false -->
    label="Online"                                       <!-- default: "" (decorative) -->
    density="-1|-2|-3|-4"                                <!-- default: 0 (uncompacted) -->
  ></md-status-dot>
</span>
```

**Events** — none.

**Methods** — none.

**Slots** — none; the component renders no children at all (the host *is* the
dot).

**Parts** — none. Style it through the custom properties in Theming.

### Behavioral contract worth knowing

- **It positions itself absolutely** at the bottom-inline-end corner, so the
  parent needs `position: relative` (or any other containing block). Nudge it
  with `--md-status-dot-inset-end` / `--md-status-dot-inset-block-end`.
- It is `pointer-events: none` and never focusable — it cannot be clicked and
  will not steal a hit from the avatar underneath.
- **The ARIA role depends on `label` and `live`:**
  - `label` empty (default) → `role="presentation"` + `aria-hidden="true"`.
    The dot is decorative; the parent must carry the words (e.g. an
    `md-avatar label="Ada Lovelace, online"`).
  - `label` set, `live` off → `role="img"` + `aria-label` — a static labelled
    status image.
  - `label` set, `live` on → `role="status"`, i.e. a polite **live region**, so
    presence changes *are* announced as they happen.
- `state="invisible"` is a *semantic* presence state (the user appears
  offline), drawn as a surface fill with an inset ring — it is **not**
  `display: none`. To hide the dot, omit the element.
- `live` + `invisible` is allowed but the pulse covers the inner ring, so the
  combination reads poorly; pick one.
- The pulse is already gated behind `prefers-reduced-motion: no-preference` —
  users with reduced motion see a static dot with no work from you.
- Fill and outline colours animate over ~200 ms when `state` changes, so
  websocket-driven presence updates cross-fade instead of snapping.

---

## Do / Don't

House rules — derived from M3 badge guidance; no M3 status-dot page exists.

| ✅ Do | ❌ Don't |
|---|---|
| Make the state available as words — the dot's `label`, or the parent's | Don't convey the state with colour alone |
| Keep the state→colour mapping consistent across the app | Don't reuse "busy" red for an error elsewhere |
| Attach it to something it describes (avatar, row) | Don't float a dot with no clear subject |
| Use `live` sparingly for genuinely changing state | Don't pulse every dot — motion loses meaning |
| Use `small` in dense tables | Don't shrink it until it's invisible |
| Let the logical insets mirror themselves in RTL | Don't hardcode a physical corner offset |
| Leave `label` empty when the parent already announces the status | Don't double-announce "online" from both the avatar and the dot |
| Use `md-badge` when it's a count | Don't overload the dot with meaning |

---

## Patterns

```html
<!-- Decorative: the avatar carries the words, the dot is silent -->
<span style="position: relative; display: inline-flex;">
  <md-avatar name="Ada Lovelace" size="large" label="Ada Lovelace, online">
  </md-avatar>
  <md-status-dot state="online"></md-status-dot>
</span>

<!-- Standalone: the dot itself is labelled -->
<md-status-dot state="busy" label="Busy"></md-status-dot>

<!-- Live pulse for an active job — role="status" announces the changes -->
<md-status-dot state="online" live label="Running"></md-status-dot>

<!-- Dense table cell -->
<md-table-cell>
  <span style="position: relative; display: inline-flex; padding-inline-end: 12px;">
    <md-status-dot size="small" state="busy" label="Busy"></md-status-dot>
  </span>
  Deploying
</md-table-cell>
```

```html
<!-- Websocket presence updates: set state and label together -->
<span id="cell" style="position: relative; display: inline-flex;">
  <md-avatar name="Ada Lovelace"></md-avatar>
  <md-status-dot id="dot" state="online" live label="Online"></md-status-dot>
</span>

<script type="module">
  const dot = document.getElementById('dot');
  const words = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' };

  socket.addEventListener('message', (e) => {
    const next = JSON.parse(e.data).presence;   // 'online' | 'away' | …
    dot.state = next;
    dot.label = words[next];                    // label + live => announced
  });
</script>
```

```css
/* Per-instance brand colour, still using the state pipeline */
md-status-dot.brand-online {
  --md-status-dot-color: var(--md-sys-color-tertiary);
  --md-status-dot-pulse-color: color-mix(in srgb, var(--md-sys-color-tertiary) 55%, transparent);
}
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| A dot with no `label` next to an avatar whose label omits the status | Put the status in one of the two labels | Otherwise the state exists only as colour. |
| `live` with an empty `label` expecting announcements | Set `label` too | Without a label the host is `aria-hidden`; only `label` + `live` makes it a live region. |
| Building your own `aria-live` region beside a `label` + `live` dot | Let the dot announce | You get the state twice. |
| `state="invisible"` to hide the dot | Remove the element | It's a presence semantic, not `display: none`. |
| A parent without a containing block | Give it `position: relative` | The dot is `position: absolute`. |
| Wiring a click handler onto the dot | Handle the click on the parent | It is `pointer-events: none`. |
| Gating `live` yourself on `prefers-reduced-motion` | Leave it | The pulse is already gated. |
| Using it for an unread count | `md-badge` | Different purpose. |
| A pulsing dot on every row | Reserve `live` for real activity | Motion stops meaning anything. |
| Custom colours without contrast checks | Keep the state palette | The defaults are the verified set. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The dot always has a role: `presentation` (decorative, the default),
  `img` (labelled + static), or `status` (labelled + `live`). Choose by whether
  something else already speaks the status.
- With `label` set and `live` on you get a polite live region for free — do not
  add a second one.
- State is conveyed by colour, and under forced-colors every state collapses to
  one system colour, so the words matter: WCAG 1.4.1 is only satisfied by the
  `label` or by the surrounding text.
- The pulse honours `prefers-reduced-motion` automatically.
- The dot is not focusable and takes no pointer events, so it never appears in
  the tab order.

**RTL** — the dot anchors with logical insets
(`inset-inline-end` / `inset-block-end`) and mirrors automatically. If you
override the insets, keep using the logical custom properties rather than
physical `left` / `right`.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung, shrinking the diameter and the separating outline. `size="small"` at a
deep rung reaches the 4 px floor and becomes hard to see. Rung `0` is the
uncompacted default and is inert — it does **not** opt a dot out of an
inherited rung; for that, set `style="--md-sys-density-scale: 0"`.

**i18n** — translate `label`. State names ("Away", "Busy") are user-facing text
and belong in your dictionary; the `state` attribute values themselves are API
keys and never translate.

## Related components

`md-badge` · `md-avatar` · `md-chip` · `md-list-item` · `md-table-cell` ·
`md-progress-indicator`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-status-dot-size` | Diameter (overrides the `size` preset) | `12px` medium · `8px` small · `16px` large, density-scaled |
| `--md-status-dot-color` | Fill | Per state — `#2DC653` online, `#F4B400` away, `#DB4437` busy, `--md-sys-color-outline` offline, `--md-sys-color-surface` invisible, `--md-sys-color-on-surface-variant` neutral |
| `--md-status-dot-pulse-color` | Halo colour used by `live` | The state hue at 55% alpha (`transparent` for offline / invisible / neutral) |
| `--md-status-dot-pulse-duration` | Pulse period | `1.6s` |
| `--md-status-dot-outline-color` | Ring separating the dot from the tile | `--md-sys-color-surface` |
| `--md-status-dot-outline-width` | Ring width | `2px` medium · `1.5px` small · `3px` large, density-scaled |
| `--md-status-dot-inset-end` | Inline-end anchor offset | `0px` (`-3px` at `size="large"`) |
| `--md-status-dot-inset-block-end` | Block-end anchor offset | `0px` (`-3px` at `size="large"`) |

**CSS parts** — none; the host is the whole component.

```css
md-status-dot.tight {
  --md-status-dot-inset-end: -4px;
  --md-status-dot-inset-block-end: -4px;
}
```

<!-- Auto Generated Below -->


## Overview

`md-status-dot` — a small absolutely-positioned indicator that pairs
with an avatar (or any other tile) to surface presence / state.

Designed to drop straight into a `position: relative` parent:

```html
<span style="position: relative; display: inline-flex;">
  <md-avatar name="Ada Lovelace" label="Ada Lovelace, online"></md-avatar>
  <md-status-dot state="online"></md-status-dot>
</span>
```

Anchors at the bottom-inline-end corner via logical-property insets, so
the pip auto-flips in RTL with no extra CSS. A 2 px outline in the
surface color keeps the dot visually detached from the avatar tile
regardless of the avatar's palette.

**Accessibility.** The dot is **decorative by default** — when used to
decorate an avatar, the avatar's own `label` should already encode the
status (`label="Ada Lovelace, online"`). Setting an explicit `label`
exposes the dot to assistive tech:
- **static** (`live` off) → `role="img"` + `aria-label` — a labelled image
  conveying the current state, announced when focused/encountered.
- **live** (`live` on) → `role="status"` (an `aria-live="polite"` region) so
  presence *changes* (online → busy) are announced as they happen.

**WCAG 1.4.1 (use of colour).** State is conveyed by colour alone, and in
Windows High-Contrast every state collapses to a single system colour. Never
rely on the dot's colour as the *only* signal of state — pair it with a
`label` (or text on the parent) so the status is also available as words.

**Live indicator.** When `live` is `true`, the dot pulses outward in its
own colour (online pulses green, busy pulses red, etc.). The animation
is gated behind `prefers-reduced-motion: no-preference`, so users who
have reduced-motion enabled at the OS level see a static dot.

## Properties

| Property  | Attribute | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Type                                                                    | Default     |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------- |
| `density` | `density` | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                                                                                                                                                                                                                                                                                 | `-1 \| -2 \| -3 \| -4 \| 0`                                             | `0`         |
| `label`   | `label`   | Optional accessible label.  - When **empty** (default), the dot is exposed to AT as decorative   (`role="presentation"` + `aria-hidden="true"`) so the parent   element (typically an `md-avatar` or a list-item) can carry the   spoken status without doubling. - When **set** and `live` is **off**, the dot becomes `role="img"` with   the value as its `aria-label` — a static, labelled status image. - When **set** and `live` is **on**, the dot becomes a `role="status"`   live region so presence *changes* are announced as they occur. Use this   for standalone dots that aren't paired with another labelled element. | `string`                                                                | `''`        |
| `live`    | `live`    | Pulse the dot outward in its own colour. Useful for "live now", "in a call", "recording" affordances. Respects `prefers-reduced-motion: reduce` automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `boolean`                                                               | `false`     |
| `size`    | `size`    | Diameter preset: - `small`  — 8 px (pairs with `md-avatar size="small"`) - `medium` — 12 px (pairs with `md-avatar size="medium"` — default) - `large`  — 16 px (pairs with `md-avatar size="large"`)  Custom diameters are exposed via the `--md-status-dot-size` CSS custom property on the host.                                                                                                                                                                                                                                                                                                                                   | `"large" \| "medium" \| "small"`                                        | `'medium'`  |
| `state`   | `state`   | Presence state. Drives the dot's fill color and its corresponding pulse-halo color (when `live` is `true`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `"away" \| "busy" \| "invisible" \| "neutral" \| "offline" \| "online"` | `'neutral'` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
