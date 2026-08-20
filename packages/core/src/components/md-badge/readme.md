# md-badge

<!-- llm:meta
tag: md-badge
category: status
status: md3-mapped
m3-guidelines: https://m3.material.io/components/badges/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A small count or marker attached to another element.** A dot, or a count pill.
`variant="small"` is a bare dot for "something is here"; `variant="large"` is a
pill carrying a number or a glyph. It positions itself absolutely at the upper-right
corner of the nearest positioned ancestor — a **physical** anchor
(`top: 0; right: 0`), which does not mirror in RTL — and never takes pointer
events.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- An **unread or pending count** on a navigation item, icon button, or avatar.
- A **dot** indicating new activity where the exact number doesn't matter.

## When NOT to use

| Situation | Use instead |
|---|---|
| Presence / online status | `md-status-dot` |
| An interactive filter or tag | `md-chip` |
| A standalone status label | `md-chip` (non-selectable) |
| Progress toward completion | `md-progress-indicator` |
| A count that is the main content, not an annotation | Plain text |
| Anything the user should click | `md-button` / `md-icon-button` |

## Decision cues

| Need | Setting |
|---|---|
| "There's something new", no number | `variant="small"` |
| A visible count | `variant="large"` (default) + `value` |
| Cap the displayed number | `max` (default `999` → renders `999+`) |
| A glyph instead of a number | `icon`, or an element in the `icon` slot |
| Tight space (app bars) | `variant="small"` — M3's explicit advice |
| Roomier space (navigation rail) | `variant="large"` |
| Nudge where it sits | `--md-badge-offset-x` / `--md-badge-offset-y` |

## API contract

```html
<md-badge
  variant="small|large"          <!-- default: large -->
  value="12"                     <!-- default: "" — large variant only -->
  max="99"                       <!-- default: 999 -->
  icon="priority_high"           <!-- default: "" — large variant only -->
  density="-1|-2|-3|-4"          <!-- default: 0 (uncompacted) -->
></md-badge>
```

**Events** — none. The badge emits nothing.

**Methods** — none.

**Slots** — `icon`: replaces the built-in glyph. Rendered **only** for
`variant="large"`; the `small` dot renders no slot at all. Slotted elements are
force-sized to `--md-badge-icon-size` and force-coloured to
`--md-badge-icon-color` with `!important`.

**Parts** — `icon` (the built-in Material Symbols glyph, present only when the
`icon` prop is set and nothing is slotted), `label` (the text span).

### Behavioral contract worth knowing

- **The badge does not position itself relative to a host element.** It is
  `position: absolute; top: 0; right: 0` plus a `translate()` of
  `--md-badge-offset-x` / `--md-badge-offset-y` (default `50% / -50%`), so the
  nearest **positioned** ancestor is what it anchors to. Give that ancestor
  `position: relative` yourself.
- The host is `pointer-events: none`. A badge can never be clicked or hovered,
  and it never blocks clicks on the control underneath it.
- **The badge is exposed to assistive tech.** The host renders `role="status"`
  with an `aria-label`: `"notification"` for `variant="small"`; otherwise the
  displayed text, falling back to the `icon` name, and nothing at all when the
  badge is empty.
- `variant="small"` ignores both `value` and `icon` — a dot carries no content
  by design.
- `max` only applies when `value` parses as a finite number. `value="1284"`
  with `max="99"` renders `99+`; a non-numeric `value` is passed through.
- Non-overflowing values are truncated to the **first 4 characters** of
  `value`, so `value="12345"` renders `1234` unless `max` catches it first.
- A `large` badge with no value, no `icon` and nothing slotted collapses its
  padding and renders as an empty circle of `--md-badge-large-height`.

---

## Do / Don't

Sourced from [M3 · Badges · Guidelines](https://m3.material.io/components/badges/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Change the badge position for right-to-left languages | Badges have fixed positions — don't move them arbitrarily, or place one over the icon |
| Use the default badge colour | Avoid custom colour roles; if you must, keep contrast ≥ 3:1 |
| Truncate long badge labels (`max`) | Don't let the badge get cut off or collide with another element |
| Use a **large** badge for counts where collisions aren't an issue (navigation rail) | Don't use a large badge where it might overlap a trailing element |
| Use a **small** badge where space is tight (app bars) — it won't hit the screen edge | Don't force a count into a cramped spot |
| When an icon with a badge is followed by text, put a large badge at the trailing edge | Don't let a large badge overlap the following element |
| Reflect the count in the host control's accessible name | Don't leave the control itself labelled "Inbox" while the badge says 5 |

---

## Patterns

```html
<!-- Count on an icon button. The anchor needs position: relative. -->
<md-icon-button icon="mail" aria-label="Inbox, 5 unread"
                style="position: relative;">
  <md-badge value="5"></md-badge>
</md-icon-button>
```

```html
<!-- Capped count: renders 99+ -->
<span style="position: relative; display: inline-block;">
  <md-icon-button icon="notifications" aria-label="Notifications, 1284 unread"></md-icon-button>
  <md-badge value="1284" max="99"></md-badge>
</span>
```

```html
<!-- Dot in a tight app bar -->
<span style="position: relative; display: inline-block;">
  <md-icon-button icon="menu" aria-label="Menu, new items"></md-icon-button>
  <md-badge variant="small"></md-badge>
</span>

<!-- Glyph badge, built-in and slotted -->
<md-badge icon="priority_high"></md-badge>
<md-badge>
  <svg slot="icon" viewBox="0 0 24 24"><path d="M12 2 2 22h20z" fill="currentColor"/></svg>
</md-badge>

<!-- Nudge the offset -->
<md-badge value="3" style="--md-badge-offset-x: -2px; --md-badge-offset-y: 2px;"></md-badge>
```

```js
// Keep the host control's accessible name in sync with the count.
const btn = document.querySelector('md-icon-button');
const badge = btn.querySelector('md-badge');
function setUnread(count) {
  badge.value = String(count);
  btn.setAttribute('aria-label', `Inbox, ${count} unread`);
}
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| Leaving the host control's label as "Inbox" while the badge shows 5 | Put the count in the host's `aria-label` too | The badge names itself but the control still needs the count. |
| `<md-badge role="status">` or your own `aria-label` on the host | Let the component set them | It writes both on every render and will overwrite yours. |
| `variant="small" value="7"` | Use `large` for a count | Small badges render no label. |
| A parent without `position: relative` | Set it on the anchor element | The badge positions absolutely against the nearest positioned ancestor. |
| `<md-badge variant="small"><svg slot="icon"></svg></md-badge>` | Use `variant="large"` | The `icon` slot is not rendered for the small dot. |
| Custom colours without a contrast check | Keep defaults, or verify ≥3:1 | M3 explicit rule. |
| A large badge beside a trailing label | Trailing edge, or use `small` | M3 explicit rule. |
| Attaching a click handler to the badge | Handle it on the **host** control | The badge is `pointer-events: none`. |
| `md-badge` for online/offline | `md-status-dot` | Different semantic. |
| Uncapped four-digit counts | Set `max` | Anything past 4 characters is sliced. |
| `--md-badge-offset-x` alone to mirror in RTL | Also override `right`/`left` on the host | The offsets `translate()` the badge inside the same physical `top: 0; right: 0` anchor; they cannot move it to the leading corner. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The badge already carries `role="status"` and an `aria-label` — do not add
  your own, they are rewritten on every render.
- Still put the count in the **host control's** accessible name
  (`aria-label="Inbox, 5 unread"`) and keep it in sync when the count changes;
  the badge names only itself.
- `variant="small"` is labelled `"notification"`, which says "something is
  here" but not what. Make the host control's name carry the meaning.
- Keep contrast ≥3:1 for the container and label if you override colours.
- The badge takes no pointer events and is never focusable — the affordance
  always belongs to the element it decorates.

**RTL** — nothing mirrors automatically, and the offsets alone cannot fix it.
The anchor is the physical `top: 0; right: 0`, and the offsets feed a
`translate()` whose percentages resolve against the **badge's own box**, not the
anchor's — so changing `--md-badge-offset-x` only nudges the badge around that
same physical top-right corner. To move it to the leading corner you must
override the inset on the host too. Document-tree rules beat the component's
own `:host` rule, so a plain selector is enough:

```css
[dir="rtl"] md-badge {
  right: auto;
  left: 0;
  --md-badge-offset-x: -50%;
}
```

**Density** — `density="-1…-4"` (or an inherited `data-density` rung) shrinks
the pill height, padding, font size, icon size and dot diameter through
`--md-sys-density-scale`. Rung `0` is the uncompacted default and has no rule
of its own. To pin an instance back to full size under a global rung, set
`style="--md-sys-density-scale: 0"` on it. Check that a 3-digit value still
fits at deep rungs.

**i18n** — format numerals with `Intl.NumberFormat` before assigning `value`
for locales with different digit systems. The `+` overflow marker and the
`"notification"` label for the small dot are not localizable.

## Related components

`md-status-dot` · `md-chip` · `md-icon-button` · `md-navigation-bar` ·
`md-navigation-rail` · `md-avatar` · `md-progress-indicator`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-badge-container-color` | Pill / dot background | `--md-sys-color-error` (`#B3261E`) |
| `--md-badge-label-color` | Label text colour | `--md-sys-color-on-error` (`#FFFFFF`) |
| `--md-badge-container-shape` | Corner radius | `--md-sys-shape-corner-full` (`9999px`) |
| `--md-badge-icon-color` | Glyph colour (built-in and slotted) | `--md-badge-label-color` |
| `--md-badge-icon-size` | Glyph box | `max(8px, 10px + density × 0.5px)` |
| `--md-badge-offset-x` / `--md-badge-offset-y` | `translate()` from the `top: 0; right: 0` anchor | `50%` / `-50%` |
| `--md-badge-large-height` | Large-pill height and min-width | `max(12px, 16px + density × 1px)` |
| `--md-badge-large-padding` | Large-pill padding | `0 max(2px, 4px + density × 0.5px)` |
| `--md-badge-small-size` | Dot diameter | `max(4px, 6px + density × 0.5px)` |

**CSS parts** — `icon`, `label`.

```css
md-badge.neutral {
  --md-badge-container-color: var(--md-sys-color-secondary);
  --md-badge-label-color: var(--md-sys-color-on-secondary);
}
```

<!-- Auto Generated Below -->


## Properties

| Property  | Attribute | Description                                                                                                                                                                                           | Type                        | Default   |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------- |
| `density` | `density` | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact. | `-1 \| -2 \| -3 \| -4 \| 0` | `0`       |
| `icon`    | `icon`    | Material Symbols icon name (large variant only, e.g. `"error"`)                                                                                                                                       | `string`                    | `''`      |
| `max`     | `max`     | Numeric threshold. When the parsed value exceeds this, the badge shows `{max}+` (e.g. `999+`). Ignored for non-numeric values.                                                                        | `number`                    | `999`     |
| `value`   | `value`   | Text or number to display (large variant only, max 4 visible characters)                                                                                                                              | `string`                    | `''`      |
| `variant` | `variant` | Badge size — small renders a dot; large renders a label                                                                                                                                               | `"large" \| "small"`        | `'large'` |


## Shadow Parts

| Part      | Description |
| --------- | ----------- |
| `"icon"`  |             |
| `"label"` |             |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
