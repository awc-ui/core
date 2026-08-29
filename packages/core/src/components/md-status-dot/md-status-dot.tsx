import { Component, Host, h, Prop, Element } from '@stencil/core';

/**
 * Presence states understood by `<md-status-dot>`.
 *
 * - `online`     — green, "available"
 * - `away`       — amber, "back soon"
 * - `busy`       — red, "do not disturb"
 * - `offline`    — neutral grey, "signed out"
 * - `invisible`  — hollow ring on a surface fill, "appear offline"
 * - `neutral`    — surface-tone default, no semantic meaning
 *                  (use this when the host already encodes the state
 *                  elsewhere and the dot is a pure decoration)
 */
export type MdStatusDotState =
  | 'online'
  | 'away'
  | 'busy'
  | 'offline'
  | 'invisible'
  | 'neutral';

/** Diameter preset for the dot. */
export type MdStatusDotSize = 'small' | 'medium' | 'large';

/**
 * `md-status-dot` — a small absolutely-positioned indicator that pairs
 * with an avatar (or any other tile) to surface presence / state.
 *
 * Designed to drop straight into a `position: relative` parent:
 *
 * ```html
 * <span style="position: relative; display: inline-flex;">
 *   <md-avatar name="Ada Lovelace" label="Ada Lovelace, online"></md-avatar>
 *   <md-status-dot state="online"></md-status-dot>
 * </span>
 * ```
 *
 * Anchors at the bottom-inline-end corner via logical-property insets, so
 * the pip auto-flips in RTL with no extra CSS. A 2 px outline in the
 * surface color keeps the dot visually detached from the avatar tile
 * regardless of the avatar's palette.
 *
 * **Accessibility.** The dot is **decorative by default** — when used to
 * decorate an avatar, the avatar's own `label` should already encode the
 * status (`label="Ada Lovelace, online"`). Setting an explicit `label`
 * exposes the dot to assistive tech:
 * - **static** (`live` off) → `role="img"` + `aria-label` — a labelled image
 *   conveying the current state, announced when focused/encountered.
 * - **live** (`live` on) → `role="status"` (an `aria-live="polite"` region) so
 *   presence *changes* (online → busy) are announced as they happen.
 *
 * **WCAG 1.4.1 (use of colour).** State is conveyed by colour alone, and in
 * Windows High-Contrast every state collapses to a single system colour. Never
 * rely on the dot's colour as the *only* signal of state — pair it with a
 * `label` (or text on the parent) so the status is also available as words.
 *
 * **Live indicator.** When `live` is `true`, the dot pulses outward in its
 * own colour (online pulses green, busy pulses red, etc.). The animation
 * is gated behind `prefers-reduced-motion: no-preference`, so users who
 * have reduced-motion enabled at the OS level see a static dot.
 */
@Component({
  tag: 'md-status-dot',
  styleUrl: 'md-status-dot.css',
  shadow: true,
})
export class MdStatusDot {
  @Element() el!: HTMLElement;

  /**
   * Presence state. Drives the dot's fill color and its corresponding
   * pulse-halo color (when `live` is `true`).
   */
  @Prop({ reflect: true }) state: MdStatusDotState = 'neutral';

  /**
   * Diameter preset:
   * - `small`  — 8 px (pairs with `md-avatar size="small"`)
   * - `medium` — 12 px (pairs with `md-avatar size="medium"` — default)
   * - `large`  — 16 px (pairs with `md-avatar size="large"`)
   *
   * Custom diameters are exposed via the `--md-status-dot-size` CSS
   * custom property on the host.
   */
  @Prop({ reflect: true }) size: MdStatusDotSize = 'medium';

  /**
   * Lay the dot out in normal flow instead of as an absolutely-positioned
   * corner badge.
   *
   * The default mode is the avatar badge: `position: absolute` pinned 2px
   * outside its positioned parent's inline/block end, with a surface-toned
   * halo separating it from the tile beneath. That is wrong wherever the dot
   * sits BESIDE something — a legend swatch, a "Market open" line, a status
   * label in a table cell — where it needs to flow with the text. Without
   * this prop each such use had to wrap the dot in a `position: relative`
   * span of an explicit size AND null out both inset custom properties; miss
   * one and the dot hangs low and to the right, overlapping its own label.
   *
   * `inline` makes the host an `inline-block` in normal flow, vertically
   * centred on the text, with no halo (the halo exists to separate the dot
   * from an avatar tile; over ordinary text it reads as a stray ring). Set
   * `--md-status-dot-outline-width` to bring it back.
   */
  @Prop({ reflect: true }) inline: boolean = false;

  /**
   * The SHAPE of the thing the dot is anchored to.
   *
   * The dot anchors to the bottom-inline-end corner of its containing block,
   * which is right for a `rect` host — a tile, a table cell, a rounded avatar
   * square. It is wrong for a `circle`, because a circle's bounding-box corner
   * lies outside the visible shape: measured on a 40px round avatar, the
   * default anchor left the dot's centre 5.5px clear of the rim, floating in
   * the gap with nothing behind it.
   *
   * `circle` puts the dot ON the rim, at the 45° point where a presence dot
   * belongs. The maths is percentage-based, so it holds at every avatar size
   * without the dot having to be told what that size is: the rim at 45° sits
   * `(1 − 1/√2) / 2 ≈ 14.6447%` of the diameter in from each edge, and half the
   * dot's own size comes back off to centre it there.
   *
   * `rect` stays the default deliberately — it is what a dot on a tile, a card
   * or a table cell wants, and changing the default would move every dot that
   * already exists.
   */
  @Prop({ reflect: true }) shape: 'rect' | 'circle' = 'rect';

  /**
   * Pulse the dot outward in its own colour. Useful for "live now",
   * "in a call", "recording" affordances. Respects
   * `prefers-reduced-motion: reduce` automatically.
   */
  @Prop({ reflect: true }) live: boolean = false;

  /**
   * Optional accessible label.
   *
   * - When **empty** (default), the dot is exposed to AT as decorative
   *   (`role="presentation"` + `aria-hidden="true"`) so the parent
   *   element (typically an `md-avatar` or a list-item) can carry the
   *   spoken status without doubling.
   * - When **set** and `live` is **off**, the dot becomes `role="img"` with
   *   the value as its `aria-label` — a static, labelled status image.
   * - When **set** and `live` is **on**, the dot becomes a `role="status"`
   *   live region so presence *changes* are announced as they occur. Use this
   *   for standalone dots that aren't paired with another labelled element.
   */
  @Prop() label: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  render() {
    const labelled = !!this.label.trim();
    // Decorative → presentation; labelled+static → img; labelled+live → status
    // (a live region that announces presence changes). role="status" implies
    // aria-live="polite", so static labels deliberately avoid it to prevent
    // spurious announcements when the dot merely renders.
    const role = labelled ? (this.live ? 'status' : 'img') : 'presentation';

    return (
      <Host
        class={{
          'md-status-dot': true,
          [`md-status-dot--${this.state}`]: true,
          [`md-status-dot--${this.size}`]: true,
          // Only the circular case gets a class: `rect` is the default anchor
          // the base rule already implements, so a `--rect` class would be a
          // second name for "nothing".
          'md-status-dot--circle': this.shape === 'circle',
          'md-status-dot--live': this.live,
          'md-status-dot--labelled': labelled,
        }}
        role={role}
        aria-label={labelled ? this.label : null}
        aria-hidden={labelled ? null : 'true'}
      />
    );
  }
}
