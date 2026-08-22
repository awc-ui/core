/**
 * Dock styles. Everything resolves to `@awc-ui/tokens` custom properties with a
 * literal fallback, so the bar still reads correctly on a page that has not
 * loaded the token sheet yet. All box properties are logical, so the bar mirrors
 * itself under `dir="rtl"` with no extra rules.
 */
export const DOCK_STYLES = /* css */ `
:host {
  --_bg: var(--md-sys-color-surface-container-high, #ECE6F0);
  --_fg: var(--md-sys-color-on-surface, #1C1B1F);
  --_muted: var(--md-sys-color-on-surface-variant, #49454F);
  --_line: var(--md-sys-color-outline-variant, #CAC4D0);
  --_accent: var(--md-sys-color-primary, #6750A4);
  --_on-accent: var(--md-sys-color-on-primary, #FFFFFF);
  --_sel: var(--md-sys-color-secondary-container, #E8DEF8);
  --_on-sel: var(--md-sys-color-on-secondary-container, #1D192B);
  --_radius: var(--md-sys-shape-corner-full, 9999px);
  --_gap: var(--md-sys-spacing-gap-sm, 8px);

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

.panel {
  display: flex;
  align-items: center;
  gap: var(--_gap);
  flex-wrap: wrap;
  flex: 1 1 auto;
  min-inline-size: 0;
}

.panel[hidden] { display: none; }

.group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-inline: 6px;
  border-inline-start: 1px solid var(--_line);
}

.group:first-child { border-inline-start: none; padding-inline-start: 0; }

.group > .caption {
  font: var(--md-sys-typescale-label-small-font, 500 11px/16px Roboto, sans-serif);
  color: var(--_muted);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Native controls, so keyboard and screen-reader behaviour is the platform's. */
select,
button {
  font: var(--md-sys-typescale-label-medium-font, 500 12px/16px Roboto, sans-serif);
  color: inherit;
  background: transparent;
  border: 1px solid var(--_line);
  border-radius: var(--md-sys-shape-corner-small, 8px);
  padding: 4px 8px;
  min-block-size: 28px;
  cursor: pointer;
  margin: 0;
}

select {
  background: var(--md-sys-color-surface-container-lowest, #FFFFFF);
  padding-inline-end: 22px;
  max-inline-size: 16ch;
}

button:hover,
select:hover {
  background: color-mix(in srgb, var(--_fg) 8%, transparent);
}

button:active {
  background: color-mix(in srgb, var(--_fg) 12%, transparent);
}

:is(button, select):focus-visible {
  outline: 2px solid var(--_accent);
  outline-offset: 2px;
}

button[aria-pressed='true'],
button[aria-checked='true'] {
  background: var(--_sel);
  color: var(--_on-sel);
  border-color: transparent;
  font-weight: 600;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--_line);
  border-radius: var(--md-sys-shape-corner-small, 8px);
  overflow: hidden;
}

.segmented > button {
  border: none;
  border-radius: 0;
  border-inline-start: 1px solid var(--_line);
  min-inline-size: 32px;
  text-align: center;
}

.segmented > button:first-child { border-inline-start: none; }

.swatch {
  inline-size: 22px;
  block-size: 22px;
  min-block-size: 22px;
  padding: 0;
  border-radius: var(--_radius);
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fg) 25%, transparent);
}

.swatch[aria-pressed='true'] {
  border-color: var(--_fg);
  background: var(--_swatch);
}

.toggle {
  border-radius: var(--_radius);
  min-inline-size: 28px;
  padding: 4px 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-inline-start: auto;
}

.toggle svg {
  inline-size: 16px;
  block-size: 16px;
  fill: currentColor;
  transition: transform var(--md-sys-motion-duration-short2, 100ms)
    var(--md-sys-motion-easing-standard, cubic-bezier(0.2, 0, 0, 1));
}

:host([collapsed]) .toggle svg { transform: rotate(180deg); }

/* A visually hidden label still read by assistive tech. */
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .brand { display: none; }
  .group { border-inline-start: none; padding-inline: 2px; }
  .group > .caption { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .toggle svg { transition: none; }
}
`;
