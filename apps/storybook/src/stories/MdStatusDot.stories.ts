import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { t } from '../i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared style helpers
   ═══════════════════════════════════════════════════════════════════════════ */
const sectionLabel = (text: string) => html`
  <h4
    style="
      margin: 0 0 4px;
      font-family: var(--md-sys-typescale-title-small-font-family, system-ui, sans-serif);
      font-size: 14px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    "
  >${text}</h4>
`;

const caption = (text: string) => html`
  <p
    style="
      margin: 0 0 12px;
      font-family: var(--md-sys-typescale-body-small-font-family, system-ui, sans-serif);
      font-size: 12px;
      line-height: 16px;
      color: var(--md-sys-color-on-surface-variant);
    "
  >${text}</p>
`;

const row = (children: unknown) => html`
  <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">${children}</div>
`;

const grid = (children: unknown) => html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; align-items: start;">
    ${children}
  </div>
`;

/**
 * Generic "tile" — a positioned, surface-toned square that stands in for
 * any anchor element (avatar, chip, list-item, profile button …) without
 * coupling the story to a specific component. The dot anchors to the
 * bottom-end corner of this box exactly as it would on an avatar.
 */
const tile = (
  children: unknown,
  opts: { size?: string; shape?: 'circle' | 'rounded' | 'square' } = {},
) => {
  const size = opts.size ?? 'medium';
  const shape = opts.shape ?? 'circle';
  return html`
    <span style="position: relative; display: inline-flex;">
      <md-avatar size="${size}" shape="${shape}"></md-avatar>
      ${children}
    </span>
  `;
};

/* ═══════════════════════════════════════════════════════════════════════════
   META
   ═══════════════════════════════════════════════════════════════════════════ */
const meta: Meta = {
  title: 'Communication/Status Dot',
  component: 'md-status-dot',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        component:
          'Material Design 3 **presence indicator** — a small absolutely-positioned ' +
          'dot that anchors to any `position: relative` parent (avatar, chip, ' +
          'list-item, profile button) to surface user state. It complements ' +
          '`md-badge` (which handles top-corner unread counts) — `md-status-dot` ' +
          'is the bottom-corner "are you online?" pip.<br><br>' +
          'Six semantic states (`online · away · busy · offline · invisible · ' +
          'neutral`), three sizes (`small · medium · large`), motion-safe ' +
          '`live` pulse, RTL-safe anchor (logical-property insets), forced-colors ' +
          'fallback, and decorative-by-default a11y so the parent element can ' +
          'carry the spoken status without doubling.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['online', 'away', 'busy', 'offline', 'invisible', 'neutral'],
      description: 'Presence state — drives the dot color and the live pulse halo.',
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Diameter preset — 8 / 12 / 16 px.',
    },
    live: {
      control: 'boolean',
      description: 'Pulse the dot outward in its own colour. Honors prefers-reduced-motion.',
    },
    label: {
      control: 'text',
      description:
        'Accessible label. Empty → decorative (role="presentation"). Set + static → role="img". Set + live → role="status" (announces presence changes).',
    },
  },
  args: {
    state: 'online',
    size: 'medium',
    live: false,
    label: '',
  },
};
export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   1. PLAYGROUND
   ═══════════════════════════════════════════════════════════════════════════ */
export const Playground: Story = {
  render: (args) => html`
    ${tile(
      html`
        <md-status-dot
          state=${args.state}
          size=${args.size}
          ?live=${args.live}
          label=${args.label}
        ></md-status-dot>
      `,
    )}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. STATES
   ═══════════════════════════════════════════════════════════════════════════ */
export const States: Story = {
  render: () => html`
    ${caption('Six semantic states. Each tile below is a generic 40×40 placeholder — the dot anchors at its bottom-end corner via logical insets.')}
    ${row(html`
      ${tile(html`<md-status-dot state="online"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="away"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="busy"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="offline"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="invisible"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="neutral"></md-status-dot>`)}
    `)}
    <div style="display: flex; gap: 8px; flex-wrap: wrap; padding-block-start: 12px; font: 500 12px/16px var(--md-sys-typescale-label-medium-font-family, system-ui); color: var(--md-sys-color-on-surface-variant);">
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: #2DC653;"></span>online
      </span>
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: #F4B400;"></span>away
      </span>
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: #DB4437;"></span>busy
      </span>
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--md-sys-color-outline);"></span>offline
      </span>
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--md-sys-color-surface); box-shadow: inset 0 0 0 1.5px var(--md-sys-color-outline);"></span>invisible
      </span>
      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
        <span style="inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--md-sys-color-on-surface-variant);"></span>neutral
      </span>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. SIZES
   ═══════════════════════════════════════════════════════════════════════════ */
export const Sizes: Story = {
  render: () => html`
    ${caption('Three diameter presets — 8 / 12 / 16 px. The placeholder tile size is scaled to match the canonical avatar presets (24 / 40 / 56 px) so you can see the relative proportions.')}
    ${row(html`
      ${tile(html`<md-status-dot state="online" size="small"></md-status-dot>`, { size: 'small' })}
      ${tile(html`<md-status-dot state="online" size="medium"></md-status-dot>`, { size: 'medium' })}
      ${tile(html`<md-status-dot state="online" size="large"></md-status-dot>`, { size: 'large' })}
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. SHAPE-AWARE ANCHOR
   ═══════════════════════════════════════════════════════════════════════════ */
export const ShapeAwareAnchor: Story = {
  render: () => html`
    ${caption('The default anchor (-2 px / -3 px depending on size) hugs a circular tile. For rounded or square tiles, nudge the offset outward via `--md-status-dot-inset-end` and `--md-status-dot-inset-block-end` so the pip kisses the corner instead of overlapping the radius.')}
    ${row(html`
      ${tile(html`<md-status-dot state="online"></md-status-dot>`, { shape: 'circle' })}
      ${tile(
        html`
          <md-status-dot
            state="online"
            style="--md-status-dot-inset-end: -3px; --md-status-dot-inset-block-end: -3px;"
          ></md-status-dot>
        `,
        { shape: 'rounded' },
      )}
      ${tile(
        html`
          <md-status-dot
            state="online"
            style="--md-status-dot-inset-end: -4px; --md-status-dot-inset-block-end: -4px; border-radius: 4px;"
          ></md-status-dot>
        `,
        { shape: 'square' },
      )}
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. LIVE PULSE
   ═══════════════════════════════════════════════════════════════════════════ */
export const Live: Story = {
  render: () => html`
    ${caption('Add the `live` boolean prop to pulse the dot outward in its own colour — green pulses green, busy pulses red, away pulses amber. Wrapped in `@media (prefers-reduced-motion: no-preference)`, so users with the OS reduced-motion preference enabled see a static dot.')}
    ${row(html`
      ${tile(html`<md-status-dot state="online" live></md-status-dot>`)}
      ${tile(html`<md-status-dot state="busy" live></md-status-dot>`)}
      ${tile(html`<md-status-dot state="away" live></md-status-dot>`)}
      ${tile(html`<md-status-dot state="online" size="large" live></md-status-dot>`, { size: 'large' })}
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. STANDALONE — without an anchor tile
   The dot is `position: absolute` by default. Override to `position: static`
   when you need it as a freestanding marker (legend swatches, inline status
   in a list, dropdown menus, badges next to text labels, …).
   ═══════════════════════════════════════════════════════════════════════════ */
export const Standalone: Story = {
  render: (_args, { globals }) => html`
    ${caption('When the dot needs to flow inline (in a legend, a status menu, a dropdown row), override `position: static` to detach it from corner-anchoring and let it size itself like a normal inline element.')}
    ${grid(html`
      <div>
        ${sectionLabel('In a status legend')}
        <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; font: 400 14px/20px var(--md-sys-typescale-body-medium-font-family, system-ui); color: var(--md-sys-color-on-surface);">
          <li style="display: inline-flex; align-items: center; gap: 10px;">
            <md-status-dot state="online"  style="position: static;"></md-status-dot>
            ${t(globals.locale, 'statusDot.availableNow')}
          </li>
          <li style="display: inline-flex; align-items: center; gap: 10px;">
            <md-status-dot state="away"    style="position: static;"></md-status-dot>
            ${t(globals.locale, 'statusDot.awayFromDesk')}
          </li>
          <li style="display: inline-flex; align-items: center; gap: 10px;">
            <md-status-dot state="busy"    style="position: static;"></md-status-dot>
            ${t(globals.locale, 'statusDot.doNotDisturb')}
          </li>
          <li style="display: inline-flex; align-items: center; gap: 10px;">
            <md-status-dot state="offline" style="position: static;"></md-status-dot>
            ${t(globals.locale, 'statusDot.signedOut')}
          </li>
        </ul>
      </div>

      <div>
        ${sectionLabel('Inline next to a heading')}
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: var(--md-sys-color-surface-container);">
          <md-status-dot state="online" live size="small" style="position: static;"></md-status-dot>
          <span style="font: 500 13px/16px var(--md-sys-typescale-label-large-font-family, system-ui); color: var(--md-sys-color-on-surface);">
            ${t(globals.locale, 'statusDot.liveNow')}
          </span>
        </div>
      </div>

      <div>
        ${sectionLabel('In a status-picker menu')}
        <div style="display: inline-grid; gap: 4px; padding: 8px; border-radius: 8px; background: var(--md-sys-color-surface-container-low); border: 1px solid var(--md-sys-color-outline-variant); min-inline-size: 200px;">
          ${[
            { state: 'online', label: t(globals.locale, 'statusDot.online') },
            { state: 'away', label: t(globals.locale, 'statusDot.away') },
            { state: 'busy', label: t(globals.locale, 'statusDot.doNotDisturb') },
            { state: 'invisible', label: t(globals.locale, 'statusDot.appearOffline') },
          ].map(
            (opt) => html`
              <button
                type="button"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 12px;
                  padding: 8px 12px;
                  border: 0;
                  border-radius: 6px;
                  background: transparent;
                  cursor: pointer;
                  font: 400 14px/20px var(--md-sys-typescale-body-medium-font-family, system-ui);
                  color: var(--md-sys-color-on-surface);
                  text-align: start;
                "
                aria-label=${`${t(globals.locale, 'statusDot.setStatusTo')} ${opt.label}`}
              >
                <md-status-dot state=${opt.state} style="position: static;"></md-status-dot>
                ${opt.label}
              </button>
            `,
          )}
        </div>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. ACCESSIBILITY
   ═══════════════════════════════════════════════════════════════════════════ */
export const Accessibility: Story = {
  render: () => html`
    <style>
      .a11y-card {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 12px 20px;
        padding: 16px;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 12px;
        background: var(--md-sys-color-surface-container-low);
        align-items: center;
      }
      .a11y-card__notes {
        margin: 0;
        font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface-variant);
      }
      .a11y-card__notes strong {
        color: var(--md-sys-color-on-surface);
        font-weight: 600;
      }
    </style>

    ${grid(html`
      <div>
        ${sectionLabel('1 · Decorative by default')}
        ${caption('When anchored to another labelled element (avatar, list-item, button), the dot is decorative — leave `label` empty and the parent\'s label carries the spoken status.')}
        <div class="a11y-card">
          ${tile(html`<md-status-dot state="online"></md-status-dot>`)}
          <p class="a11y-card__notes">
            <strong>md-status-dot:</strong> role="presentation" · aria-hidden="true"<br>
            <strong>SR output:</strong> <em>(silent — parent element carries the label)</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('2 · Standalone static — role="img"')}
        ${caption('When the dot is the only thing carrying the status (no avatar, no list-item label), set `label`. A static dot becomes a labelled image — announced when encountered, but it does NOT spam a live region on every render.')}
        <div class="a11y-card">
          <md-status-dot
            state="busy"
            label="In a meeting until 3pm"
            style="position: static;"
          ></md-status-dot>
          <p class="a11y-card__notes">
            <strong>md-status-dot:</strong> role="img" · aria-label="In a meeting until 3pm"<br>
            <strong>SR output:</strong> <em>"In a meeting until 3pm, image"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('3 · Live status — role="status" (announces changes)')}
        ${caption('Add `live` to a labelled dot to upgrade it to an `aria-live="polite"` region — presence *changes* (online → busy) are then read out as they happen. Use this only when the dot is what reflects a changing state.')}
        <div class="a11y-card">
          ${tile(html`<md-status-dot state="online" live label="Online"></md-status-dot>`)}
          <p class="a11y-card__notes">
            <strong>md-status-dot:</strong> role="status" · aria-label="Online"<br>
            <strong>On change to "Busy":</strong> <em>SR announces "Busy" (polite)</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('4 · Colour is never the only cue (WCAG 1.4.1)')}
        ${caption('State is conveyed by colour alone, and forced-colors collapses every state to one system colour — so colour-blind and high-contrast users would lose the distinction. Always pair the dot with a `label` (or visible text), giving a second, non-colour channel.')}
        <div class="a11y-card">
          ${tile(html`<md-status-dot state="online" live label="Online and live"></md-status-dot>`)}
          <p class="a11y-card__notes">
            <strong>Channel 1 — colour:</strong> green<br>
            <strong>Channel 2 — motion:</strong> pulsing (live)<br>
            <strong>Channel 3 — label:</strong> "Online and live"<br>
            <strong>SR output:</strong> <em>"Online and live, status"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('5 · Forced-colors / Windows High Contrast')}
        ${caption('Under `forced-colors: active` the dot remaps to system tokens (`Mark` / `ButtonFace` / `ButtonText`) so it stays distinguishable in any high-contrast palette.')}
        <pre style="margin: 0; padding: 12px 14px; background: var(--md-sys-color-surface-container); border-radius: 8px; font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface);"><code>@media (forced-colors: active) {
  :host {
    forced-color-adjust: none;
    background-color: Mark;
    outline-color:    ButtonFace;
  }
  :host(.md-status-dot--invisible) {
    background-color: ButtonFace;
    box-shadow: inset 0 0 0 2px ButtonText;
  }
}</code></pre>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   8. RTL
   ═══════════════════════════════════════════════════════════════════════════ */
export const RTL: Story = {
  render: () => html`
    ${caption('Anchor offsets use `inset-inline-end` and `inset-block-end`, so wrapping the parent in `dir="rtl"` flips the dot to the bottom-left automatically — no media queries, no rewrites.')}
    <div dir="rtl">
      ${row(html`
        ${tile(html`<md-status-dot state="online"></md-status-dot>`)}
        ${tile(html`<md-status-dot state="away"></md-status-dot>`)}
        ${tile(html`<md-status-dot state="busy"></md-status-dot>`)}
        ${tile(html`<md-status-dot state="offline"></md-status-dot>`)}
      `)}
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   9. DARK THEME
   ═══════════════════════════════════════════════════════════════════════════ */
export const DarkTheme: Story = {
  render: () => html`
    ${caption('All state colours and the surface-toned halo flip with `[data-theme="dark"]`. The dot stays cleanly detached from any tile under both themes because the halo is always `var(--md-sys-color-surface)`.')}
    ${row(html`
      ${tile(html`<md-status-dot state="online"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="away"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="busy"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="offline"></md-status-dot>`)}
      ${tile(html`<md-status-dot state="invisible"></md-status-dot>`)}
    `)}
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #141218); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   10. CUSTOM CSS — custom properties
   ═══════════════════════════════════════════════════════════════════════════ */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand   { --md-status-dot-color: #6750A4; --md-status-dot-pulse-color: rgba(103, 80, 164, 0.55); }
      .danger  { --md-status-dot-color: var(--md-sys-color-error); --md-status-dot-pulse-color: color-mix(in srgb, var(--md-sys-color-error) 55%, transparent); }
      .xl      { --md-status-dot-size: 20px; --md-status-dot-outline-width: 3px; }
      .square  { border-radius: 4px; --md-status-dot-inset-end: -4px; --md-status-dot-inset-block-end: -4px; }
      .pulse-fast { --md-status-dot-pulse-duration: 0.9s; }
    </style>
    ${grid(html`
      <div>
        ${sectionLabel('Brand-tinted')}
        ${caption('Override `--md-status-dot-color` (and optionally `--md-status-dot-pulse-color`) per-instance to brand the dot to a custom palette without touching shadow DOM.')}
        ${row(html`
          ${tile(html`<md-status-dot class="brand" state="online" live></md-status-dot>`)}
          ${tile(html`<md-status-dot class="danger" state="online" live></md-status-dot>`)}
        `)}
      </div>

      <div>
        ${sectionLabel('Custom diameter / shape')}
        ${row(html`
          ${tile(html`<md-status-dot class="xl" state="online"></md-status-dot>`, { size: 'large' })}
          ${tile(html`<md-status-dot class="square" state="online"></md-status-dot>`)}
        `)}
      </div>

      <div>
        ${sectionLabel('Custom pulse cadence')}
        ${caption('Override `--md-status-dot-pulse-duration` to make the live indicator slower or snappier than the 1.6 s default.')}
        ${row(html`
          ${tile(html`<md-status-dot state="online" live></md-status-dot>`)}
          ${tile(html`<md-status-dot class="pulse-fast" state="online" live></md-status-dot>`)}
        `)}
      </div>
    `)}
  `,
};
