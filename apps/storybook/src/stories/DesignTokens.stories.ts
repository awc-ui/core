import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';

/**
 * Living documentation of the `--md-sys-*` design tokens from `@awc-ui/tokens`.
 * Values are read from `getComputedStyle` at render time, so every table
 * reflects the CURRENT Theme / Dark / seed-color toolbar state — flip the theme
 * and the swatches update. Click any token name to copy it.
 */
const meta: Meta = {
  title: 'Foundations/Design Tokens',
  parameters: {
    layout: 'fullscreen',
    // Docs page, not a component — no a11y gate / visual baseline (values are
    // theme-dependent and copy affordances aren't component surface).
    a11y: { disable: true },
    visual: { skip: true },
  },
};
export default meta;
type Story = StoryObj;

// ── helpers ─────────────────────────────────────────────────────────────────
const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const copy = (text: string) => (e: Event) => {
  e.stopPropagation();
  navigator.clipboard?.writeText(text);
  const el = e.currentTarget as HTMLElement;
  const prev = el.getAttribute('data-copied');
  if (prev) return;
  el.setAttribute('data-copied', '1');
  const original = el.textContent;
  el.textContent = 'copied ✓';
  setTimeout(() => {
    el.textContent = original;
    el.removeAttribute('data-copied');
  }, 900);
};

const PAGE =
  'padding: 24px 32px 48px; font-family: Roboto, system-ui, sans-serif; color: var(--md-sys-color-on-surface); background: var(--md-sys-color-surface); min-block-size: 100vh; box-sizing: border-box;';
const H1 = 'font: 600 28px/1.2 Roboto, sans-serif; margin: 0 0 4px;';
const SUB = 'color: var(--md-sys-color-on-surface-variant); margin: 0 0 28px; font-size: 14px;';
const H2 =
  'font: 600 13px/1 Roboto, sans-serif; text-transform: uppercase; letter-spacing: 0.6px; color: var(--md-sys-color-on-surface-variant); margin: 28px 0 12px;';
const NAME =
  'font: 500 11px/1.4 "Roboto Mono", ui-monospace, monospace; color: var(--md-sys-color-on-surface-variant); cursor: copy; word-break: break-all;';
const VAL = 'font: 400 11px/1.4 "Roboto Mono", ui-monospace, monospace; opacity: 0.75;';

// ── COLORS ──────────────────────────────────────────────────────────────────
const COLOR_GROUPS: [string, string[]][] = [
  ['Primary', ['primary', 'on-primary', 'primary-container', 'on-primary-container']],
  ['Secondary', ['secondary', 'on-secondary', 'secondary-container', 'on-secondary-container']],
  ['Tertiary', ['tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container']],
  ['Error', ['error', 'on-error', 'error-container', 'on-error-container']],
  ['Surface', ['background', 'on-background', 'surface', 'on-surface', 'surface-variant', 'on-surface-variant']],
  ['Surface containers', ['surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface-dim', 'surface-bright']],
  ['Outline & inverse', ['outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface', 'inverse-primary', 'shadow', 'scrim', 'surface-tint']],
];

const swatch = (role: string) => {
  const token = `--md-sys-color-${role}`;
  // Pick a readable label color: the paired on-/from- color when it exists, else outline.
  const onRole = role.startsWith('on-')
    ? role.replace('on-', '')
    : `on-${role}`;
  const labelColor = `var(--md-sys-color-${onRole}, var(--md-sys-color-outline))`;
  return html`
    <div style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; overflow: hidden; background: var(--md-sys-color-surface-container-low);">
      <div style="background: var(${token}); block-size: 64px; display: flex; align-items: flex-end; padding: 8px; color: ${labelColor}; font: 500 12px Roboto, sans-serif;">
        ${role}
      </div>
      <div style="padding: 8px 10px;">
        <div style="${NAME}" title="Copy" @click=${copy(token)}>${token}</div>
        <div style="${VAL}">${cssVar(token) || '—'}</div>
      </div>
    </div>
  `;
};

export const Colors: Story = {
  render: () => html`
    <div style="${PAGE}">
      <h1 style="${H1}">Color</h1>
      <p style="${SUB}">37 <code>--md-sys-color-*</code> roles. Swatches reflect the active theme — flip <strong>Theme / Dark</strong> or edit the seed colors in the <strong>Theme</strong> panel to see them regenerate.</p>
      ${COLOR_GROUPS.map(
        ([title, roles]) => html`
          <div style="${H2}">${title}</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px;">
            ${roles.map((r) => swatch(r))}
          </div>
        `,
      )}
    </div>
  `,
};

// ── TYPOGRAPHY ──────────────────────────────────────────────────────────────
const SCALES = [
  'display-large', 'display-medium', 'display-small',
  'headline-large', 'headline-medium', 'headline-small',
  'title-large', 'title-medium', 'title-small',
  'body-large', 'body-medium', 'body-small',
  'label-large', 'label-medium', 'label-small',
];

export const Typography: Story = {
  render: () => html`
    <div style="${PAGE}">
      <h1 style="${H1}">Typescale</h1>
      <p style="${SUB}">15 <code>--md-sys-typescale-*</code> roles, each rendered at its real size/weight/line-height.</p>
      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${SCALES.map((s) => {
          const base = `--md-sys-typescale-${s}`;
          const size = cssVar(`${base}-font-size`);
          const weight = cssVar(`${base}-font-weight`);
          const lh = cssVar(`${base}-line-height`);
          return html`
            <div style="display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: baseline; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 16px;">
              <div>
                <div style="${NAME}" title="Copy" @click=${copy(`${base}-font`)}>${s}</div>
                <div style="${VAL}">${size} · ${weight} · ${lh}</div>
              </div>
              <div style="font-family: var(${base}-font-family, Roboto); font-size: var(${base}-font-size); font-weight: var(${base}-font-weight); line-height: var(${base}-line-height); letter-spacing: var(${base}-letter-spacing); color: var(--md-sys-color-on-surface);">
                The quick brown fox
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `,
};

// ── ELEVATION & SHAPE ───────────────────────────────────────────────────────
const SHAPES = [
  'none', 'extra-small', 'small', 'medium', 'large', 'extra-large', 'full',
];

export const ElevationAndShape: Story = {
  name: 'Elevation & Shape',
  render: () => html`
    <div style="${PAGE}">
      <h1 style="${H1}">Elevation</h1>
      <p style="${SUB}">6 <code>--md-sys-elevation-*</code> levels.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 24px; margin-bottom: 8px;">
        ${[0, 1, 2, 3, 4, 5].map(
          (lvl) => html`
            <div style="text-align: center;">
              <div style="block-size: 88px; border-radius: 16px; background: var(--md-sys-color-surface-container); box-shadow: var(--md-sys-elevation-${lvl});"></div>
              <div style="${NAME}; text-align: center; margin-top: 10px;" title="Copy" @click=${copy(`--md-sys-elevation-${lvl}`)}>elevation-${lvl}</div>
            </div>
          `,
        )}
      </div>

      <h1 style="${H1}; margin-top: 36px;">Shape</h1>
      <p style="${SUB}">Corner-radius scale, <code>--md-sys-shape-corner-*</code>.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 24px;">
        ${SHAPES.map((s) => {
          const token = `--md-sys-shape-corner-${s}`;
          return html`
            <div style="text-align: center;">
              <div style="block-size: 88px; background: var(--md-sys-color-primary-container); border-radius: var(${token}); ${s === 'full' ? 'inline-size: 88px; margin: 0 auto;' : ''}"></div>
              <div style="${NAME}; text-align: center; margin-top: 10px;" title="Copy" @click=${copy(token)}>${s}</div>
              <div style="${VAL}; text-align: center;">${cssVar(token)}</div>
            </div>
          `;
        })}
      </div>
    </div>
  `,
};

// ── MOTION & STATE ──────────────────────────────────────────────────────────
const DURATIONS = [
  'short1', 'short2', 'short3', 'short4',
  'medium1', 'medium2', 'medium3', 'medium4',
  'long1', 'long2', 'long3', 'long4',
  'extra-long1', 'extra-long2', 'extra-long3', 'extra-long4',
];
const EASINGS = [
  'linear', 'standard', 'standard-accelerate', 'standard-decelerate',
  'emphasized', 'emphasized-accelerate', 'emphasized-decelerate',
];
const STATES = [
  'hover-state-layer-opacity', 'focus-state-layer-opacity', 'pressed-state-layer-opacity',
  'dragged-state-layer-opacity', 'disabled-container-opacity', 'disabled-content-opacity',
];

/** Pause/resume the duration bars and sync the Start/Stop button's label+icon. */
const setDurationsPaused = (scope: Element | null | undefined, paused: boolean) => {
  scope?.querySelectorAll<HTMLElement>('.md-dur-fill').forEach((el) => {
    el.style.animationPlayState = paused ? 'paused' : 'running';
  });
  const btn = scope?.querySelector('.md-dur-toggle-btn') as HTMLElement | null;
  if (btn) {
    btn.dataset.paused = paused ? '1' : '0';
    btn.setAttribute('icon', paused ? 'play_arrow' : 'pause');
    const label = btn.querySelector('.md-dur-toggle-label');
    if (label) label.textContent = paused ? 'Start' : 'Stop';
  }
};

/** Restart every animation in the Motion page (and resume durations). */
const replayMotion = (e: Event) => {
  const scope = (e.currentTarget as HTMLElement).closest('[data-tokens-motion]');
  scope?.querySelectorAll<HTMLElement>('.md-anim').forEach((el) => {
    el.style.animationName = 'none';
    void el.offsetWidth; // force reflow so re-adding restarts the animation
    el.style.animationName = '';
    el.style.animationPlayState = 'running';
  });
  setDurationsPaused(scope, false);
};

/** Toggle the duration bars between running and paused. */
const toggleDurations = (e: Event) => {
  const btn = e.currentTarget as HTMLElement;
  setDurationsPaused(btn.closest('[data-tokens-motion]'), btn.dataset.paused !== '1');
};

/** Draw a token's cubic-bezier as an SVG curve (control points may overshoot). */
const bezierCurve = (easing: string) => {
  const val = cssVar(`--md-sys-motion-easing-${easing}`);
  const m = val.match(/cubic-bezier\(([^)]+)\)/);
  const [x1, y1, x2, y2] = m ? m[1].split(',').map((n) => parseFloat(n)) : [0, 0, 1, 1];
  const X = (v: number) => v * 100;
  const Y = (v: number) => 100 - v * 100;
  const [c1x, c1y, c2x, c2y] = [X(x1), Y(y1), X(x2), Y(y2)];
  return html`
    <svg viewBox="-10 -20 120 140" width="76" height="88" style="overflow: visible; flex: none;">
      <line x1="0" y1="100" x2="100" y2="0" stroke="var(--md-sys-color-outline-variant)" stroke-dasharray="3 3" />
      <line x1="0" y1="100" x2="${c1x}" y2="${c1y}" stroke="var(--md-sys-color-tertiary)" stroke-width="1.5" opacity="0.7" />
      <line x1="100" y1="0" x2="${c2x}" y2="${c2y}" stroke="var(--md-sys-color-tertiary)" stroke-width="1.5" opacity="0.7" />
      <path d="M0,100 C ${c1x},${c1y} ${c2x},${c2y} 100,0" fill="none" stroke="var(--md-sys-color-primary)" stroke-width="3" stroke-linecap="round" />
      <circle cx="${c1x}" cy="${c1y}" r="4" fill="var(--md-sys-color-tertiary)" />
      <circle cx="${c2x}" cy="${c2y}" r="4" fill="var(--md-sys-color-tertiary)" />
    </svg>
  `;
};

export const MotionAndState: Story = {
  name: 'Motion & State',
  render: () => html`
    <div style="${PAGE}" data-tokens-motion>
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
        <div>
          <h1 style="${H1}">Motion</h1>
          <p style="${SUB}; margin-bottom: 0;">Watch the tokens: each easing moves a ball + plots its bézier; each duration fills a bar. Hit replay to compare.</p>
        </div>
        <md-button variant="filled" trailing-icon="play_arrow" @click=${replayMotion}>Replay</md-button>
      </div>

      <div style="${H2}">Easing — <code>--md-sys-motion-easing-*</code></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${EASINGS.map((ez) => {
          const token = `--md-sys-motion-easing-${ez}`;
          return html`
            <div style="display: flex; gap: 14px; align-items: center; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; padding: 12px 14px; background: var(--md-sys-color-surface-container-low);">
              ${bezierCurve(ez)}
              <div style="flex: 1 1 auto; min-inline-size: 0;">
                <div style="${NAME}" title="Copy" @click=${copy(token)}>${ez}</div>
                <div style="${VAL}; margin-bottom: 10px; word-break: break-all;">${cssVar(token)}</div>
                <div style="position: relative; block-size: 22px; background: var(--md-sys-color-surface-container-highest); border-radius: 999px;">
                  <div class="md-anim md-ease-ball" style="--ease: var(${token}); position: absolute; inset-block: 3px; inset-inline-start: 3px; inline-size: 16px; border-radius: 50%; background: var(--md-sys-color-primary);"></div>
                </div>
              </div>
            </div>
          `;
        })}
      </div>

      <div style="display: flex; align-items: center; gap: 16px; margin-top: 28px; flex-wrap: wrap;">
        <div style="${H2}; margin: 0;">Duration — <code>--md-sys-motion-duration-*</code></div>
        <md-button class="md-dur-toggle-btn" data-paused="0" variant="tonal" size="sm" icon="pause" @click=${toggleDurations}>
          <span class="md-dur-toggle-label">Stop</span>
        </md-button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px 24px; max-width: 900px;">
        ${DURATIONS.map((d) => {
          const token = `--md-sys-motion-duration-${d}`;
          return html`
            <div style="display: grid; grid-template-columns: 78px 1fr 56px; gap: 10px; align-items: center;">
              <div style="${NAME}" title="Copy" @click=${copy(token)}>${d}</div>
              <div style="block-size: 8px; background: var(--md-sys-color-surface-container-high); border-radius: 4px; overflow: hidden;">
                <div class="md-anim md-dur-fill" style="--dur: var(${token}); block-size: 100%; inline-size: 100%; transform-origin: left; background: var(--md-sys-color-primary); border-radius: 4px;"></div>
              </div>
              <div style="${VAL}">${cssVar(token)}</div>
            </div>
          `;
        })}
      </div>

      <div style="${H2}; margin-top: 28px;">State — <code>--md-sys-state-*</code></div>
      <p style="${SUB}">State-layer opacities shown as an actual tint over the primary color; disabled opacities applied to a chip.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; max-width: 900px;">
        ${STATES.map((s) => {
          const token = `--md-sys-state-${s}`;
          const isLayer = s.includes('state-layer');
          const value = cssVar(token);
          return html`
            <div style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; padding: 12px; background: var(--md-sys-color-surface-container-low);">
              ${isLayer
                ? html`<div style="position: relative; block-size: 48px; border-radius: 8px; background: var(--md-sys-color-primary-container); overflow: hidden;">
                    <div style="position: absolute; inset: 0; background: var(--md-sys-color-on-primary-container); opacity: ${value || '0'};"></div>
                  </div>`
                : html`<div style="block-size: 48px; display: flex; align-items: center; justify-content: center;">
                    <span style="padding: 6px 14px; border-radius: 999px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: 500 13px Roboto; opacity: ${value || '1'};">${s.includes('container') ? 'Disabled' : 'Aa'}</span>
                  </div>`}
              <div style="${NAME}; margin-top: 8px;" title="Copy" @click=${copy(token)}>${s.replace(/-/g, ' ')}</div>
              <div style="${VAL}">${value}</div>
            </div>
          `;
        })}
      </div>

      <style>
        .md-ease-ball { animation: md-token-move 1400ms var(--ease) infinite alternate; }
        .md-dur-fill { animation: md-token-fill var(--dur) var(--md-sys-motion-easing-emphasized) infinite alternate; }
        @keyframes md-token-move {
          from { inset-inline-start: 3px; }
          to { inset-inline-start: calc(100% - 19px); }
        }
        @keyframes md-token-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      </style>
    </div>
  `,
};
