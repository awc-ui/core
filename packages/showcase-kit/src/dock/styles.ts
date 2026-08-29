/**
 * Dock styles. Everything resolves to `@awc-ui/tokens` custom properties with a
 * literal fallback, so the bar still reads correctly on a page that has not
 * loaded the token sheet yet. All box properties are logical, so the bar mirrors
 * itself under `dir="rtl"` with no extra rules.
 *
 * RESERVING SPACE BEFORE UPGRADE — the rule that keeps the page still.
 *
 * The controls are `md-*` custom elements, and an un-upgraded custom element is
 * `display: inline` with no box: zero width, zero height. The dock publishes its
 * own height as `--awc-dock-height` and the page reserves its bottom padding
 * from that, so a bar that started short and grew when the runtime registered
 * would shift the entire page under the reader.
 *
 * Height alone is not enough, because the bar wraps: if the controls are
 * zero-WIDTH they fit on one line, and the same controls at their real width
 * take two — a one-line-to-two-line jump is a height change however carefully
 * the height is reserved. So both axes are reserved here:
 *
 *   - `--_row` is the height of a control row, and every cluster carries it as
 *     `min-block-size`. It is 48px because that is where the dock's pinned
 *     density (-2) puts `md-select`, and where `md-switch`'s touch-target floor
 *     puts it at every density.
 *   - each control declares an explicit `inline-size` (or `min-inline-size` for
 *     the ones whose text sets their width). The dock's labels are frozen to
 *     English and its density is pinned, so these widths are constants, not
 *     guesses about content.
 *
 * The reservation lives on the dock's own elements, so it holds whether the
 * runtime arrives late, early, or never.
 */
export const DOCK_STYLES = /* css */ `
:host {
  /* Height of one control row — see "reserving space before upgrade" above. */
  --_row: 48px;

  --_bg: var(--md-sys-color-surface-container-high, #ECE6F0);
  --_fg: var(--md-sys-color-on-surface, #1C1B1F);
  --_muted: var(--md-sys-color-on-surface-variant, #49454F);
  --_line: var(--md-sys-color-outline-variant, #CAC4D0);
  /* Selection, accent and radius tokens used to live here for the hand-styled
     select/button rules. The md-* controls bring their own, from the same token
     sheet, so the dock no longer restates them. */

  /*
   * Pinned, and the only measurement here NOT read from the token sheet.
   *
   * --md-sys-spacing-gap-sm is density-responsive — 8px at rung 0, 4px at -4 —
   * so reading it meant the bar quietly lost 4px the moment you demonstrated a
   * compact rung: it republished --awc-dock-height and reflowed the page under
   * the reader, on top of the reflow they had actually asked for. The dock pins
   * its controls' density for exactly this reason; this is the same decision one
   * layer down. The colour, type and elevation tokens above and below are
   * density-independent and stay live.
   */
  --_gap: 8px;

  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: var(--md-sys-z-index-tooltip, 1500);
  display: block;
  font-family: var(--md-sys-typescale-label-medium-font-family, Roboto, system-ui, sans-serif);
  color: var(--_fg);
  pointer-events: none;
}

:host([position='top']) {
  inset-block-end: auto;
  inset-block-start: 0;
}

:host([hidden]) { display: none; }

.dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--_gap);
  flex-wrap: wrap;
  padding: 6px max(10px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom))
    max(10px, env(safe-area-inset-left));
  background: color-mix(in srgb, var(--_bg) 92%, transparent);
  backdrop-filter: blur(10px);
  border-block-start: 1px solid var(--_line);
  box-shadow: var(--md-sys-elevation-2, 0 1px 3px rgb(0 0 0 / 0.2));
}

:host([position='top']) .dock {
  border-block-start: none;
  border-block-end: 1px solid var(--_line);
  padding-block: max(6px, env(safe-area-inset-top)) 6px;
}

.brand {
  font: var(--md-sys-typescale-label-large-font, 500 14px/20px Roboto, sans-serif);
  color: var(--_muted);
  white-space: nowrap;
  margin-inline-end: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  max-inline-size: 22ch;
}

/*
 * The controls always take a row of their own, with the brand and the chevron
 * sharing the row above.
 *
 * This is a layout choice in service of the height contract, not just taste.
 * When the panel competed for row 1 the bar's row COUNT depended on how wide
 * the controls happened to be — which is zero until the md-* runtime registers,
 * so the bar would have started one row short and grown. Giving the panel its
 * own row takes the control widths out of the question entirely.
 */
.panel {
  display: flex;
  align-items: center;
  gap: var(--_gap);
  flex-wrap: wrap;
  flex: 1 1 100%;
  min-inline-size: 0;
}

.panel[hidden] { display: none; }

.group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-inline: 5px;
  border-inline-start: 1px solid var(--_line);
  /* Holds the row open while the md-* controls inside are still un-upgraded. */
  min-block-size: var(--_row);
}

.group:first-child { border-inline-start: none; padding-inline-start: 0; }

.group > .caption {
  font: var(--md-sys-typescale-label-small-font, 500 11px/16px Roboto, sans-serif);
  color: var(--_muted);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ------------------------------------------------------- library controls */

/*
 * Placement only. Size, shape, state layer, focus ring and internal layout are
 * each component's own.
 *
 * Nothing here declares display, and that is deliberate: a rule in this (outer)
 * tree beats a component's :host rule at equal specificity, so a stray
 * display would silently REPLACE the component's. md-segmented-button-set is
 * the cautionary case — its :host is inline-grid with grid-auto-columns:
 * 1fr, which is precisely what makes its segments equal width, and overriding
 * it to flex leaves them ragged. The pre-upgrade reservations below do need a
 * display, so they are scoped to :not(.hydrated) where there is no component
 * rule to contradict.
 */
.picker {
  /* A constraint, not a reservation, and it applies at every moment: md-select
     sizes to its longest option (219px, set by "Angular (SSR)"), which is more
     of the bar than a picker showing four characters deserves.

     KNOWN COST, recorded rather than papered over. md-select renders its value
     in an <input> inside md-text-field, and an <input> clips — text-overflow
     does not apply to it — so past this width the value is cut mid-glyph with
     no ellipsis. At 132px the input's content box is 69px, which is enough for
     every framework name except "Angular (SSR)" (99px), so the angular-ssr
     build alone shows "Angular (S". Neither half of that is reachable from
     here: md-select exports only container:field-container, so ::part cannot
     style the input, and the width cannot grow — at 1280px the control row
     fits with 0.5px to spare and one more pixel wraps the bar from 101px to
     157px. It needs md-select to ellipsize its own field. */
  inline-size: 132px;
}

.segmented,
.swatch,
.switch,
.reset {
  flex: 0 0 auto;
}

/* The visible name of the direction switch, and its accessible name too. */
.switch-label {
  font: var(--md-sys-typescale-label-medium-font, 500 12px/16px Roboto, sans-serif);
  color: var(--_fg);
  white-space: nowrap;
}

/* The collapse chevron, pushed to the far end of the brand row. */
.toggle {
  flex: 0 0 auto;
  margin-inline-start: auto;
}

/* ------------------------------------ reserving space before upgrade */

/*
 * Until @awc-ui/core registers, every one of these is an unknown element:
 * display: inline, no box, zero by zero. The bar would start short and narrow
 * and jump to full size the moment the runtime landed — republishing
 * --awc-dock-height and shifting the whole page under the reader.
 *
 * So each control is given, up front, the box it will have once it upgrades.
 * The numbers are MEASURED from the upgraded components at the dock's pinned
 * density, not estimated; the dock's labels are frozen to English and its
 * density is pinned, so they are constants rather than guesses about content.
 *
 * The reservation has to evaporate at the instant the component takes over,
 * handing its box back to its own :host rules — that is what keeps a
 * reservation from turning into an override. The gate for that is
 * :not(.hydrated), and NOT :not(:defined), which is what these rules used
 * to say and why none of them ever ran.
 *
 * :defined IS THE WRONG CLOCK FOR A LAZY BUILD. @awc-ui/core ships Stencil's
 * lazy output: the runtime calls customElements.define() for every tag in one
 * pass at bootstrap, and only THEN fetches each component's chunk. So :defined
 * flips while the element is still an empty box with none of its shadow CSS —
 * measured on a cold load at 720px, every control in this panel reported
 * def=true, hydrated=false and 0x0 in the same frame. The reservations had
 * already evaporated, the panel laid out as one 48px row instead of two, and
 * the dock published --awc-dock-height: 89px before jumping to 157px. The
 * navigation bar docks against that value, so it was drawn 68px low and rose
 * into place — precisely the shift these rules exist to prevent.
 *
 * hydrated is the class Stencil's own hydratedFlag adds when a component has
 * rendered, which is the moment its box becomes real. It is per-element, so a
 * control whose chunk lands late keeps its reservation until it personally
 * needs it.
 *
 * The trade-off is that a class cannot be a bare selector the way :defined
 * could: every built-in element is permanently :defined but NOTHING is
 * .hydrated until Stencil says so, so :not(.hydrated) alone would also catch
 * .dock, .panel and every .group and hand each of them display: inline-block.
 * The tags are therefore listed.
 */
md-select:not(.hydrated),
md-segmented-button-set:not(.hydrated),
md-icon-button:not(.hydrated),
md-switch:not(.hydrated),
md-button:not(.hydrated) {
  display: inline-block;
}

/* md-select: width comes from .picker, which applies in both states. */
md-select:not(.hydrated) { block-size: var(--_row); }

/* The two sets, at the dock's pinned density. The density set is reserved at
   its rung-0 size, the widest and the default; at tighter rungs it renders
   smaller than its reservation, which can only ever leave slack in a row, never
   overflow one. */
.segmented-theme:not(.hydrated) { inline-size: 201.5px; block-size: 32px; }
.segmented-density:not(.hydrated) { inline-size: 184.6px; block-size: 40px; }

.swatch:not(.hydrated) { inline-size: 32px; block-size: 32px; }
.switch:not(.hydrated) { inline-size: 40px; block-size: var(--_row); }
.reset:not(.hydrated) { inline-size: 75.9px; block-size: 32px; }
.toggle:not(.hydrated) { inline-size: 32px; block-size: 32px; }

@media (max-width: 720px) {
  /* The brand no longer competes with the controls for row 1, so it stays —
     what it costs is a share of a row that exists anyway. */
  .brand { max-inline-size: 14ch; }
  .group { border-inline-start: none; padding-inline: 2px; }
  .group > .caption { display: none; }
}

`;
