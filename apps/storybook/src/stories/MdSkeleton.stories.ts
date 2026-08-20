import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';

/** Await Stencil's `.hydrated` class before reading reflected attrs / shadow DOM. */
const hydrate = async (el: HTMLElement): Promise<HTMLElement> => {
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};

const meta: Meta = {
  title: 'Communication/Skeleton',
  component: 'md-skeleton',
  tags: ['autodocs'],
  parameters: {
    docs: { source: { language: 'html' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'rectangular', 'rounded', 'circular'],
      description: 'Placeholder shape.',
    },
    animation: {
      control: 'select',
      options: ['pulse', 'wave', 'none'],
      description: 'Animation style.',
    },
    lines: { control: { type: 'number', min: 1, max: 8, step: 1 }, description: 'Text rows.' },
    width: { control: 'text', description: 'Inline-size override (e.g. "60%", "200px").' },
    height: { control: 'text', description: 'Block-size override.' },
    fullWidth: { control: 'boolean', description: 'Fill the parent inline size.' },
    fullHeight: { control: 'boolean', description: 'Fill the parent block size (definite-height parent).' },
  },
  args: {
    variant: 'text',
    animation: 'pulse',
    lines: 1,
    width: '',
    height: '',
    fullWidth: false,
    fullHeight: false,
  },
};
export default meta;
type Story = StoryObj;

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <div style="width: 320px; height: 200px;">
      <md-skeleton
        variant=${args.variant}
        animation=${args.animation}
        lines=${args.lines}
        width=${args.width || ''}
        height=${args.height || ''}
        ?full-width=${args.fullWidth}
        ?full-height=${args.fullHeight}
      ></md-skeleton>
    </div>
  `,
};

/* ─── All Variants ────────────────────────────────────────── */
export const AllVariants: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; width: 480px;">
      <div>
        <div style="${labelStyle}">Text (1 line)</div>
        <md-skeleton></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Text (3 lines, last line tapered)</div>
        <md-skeleton lines="3"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Rectangular (sharp corners)</div>
        <md-skeleton variant="rectangular" height="100px"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Rounded (MD3 medium radius)</div>
        <md-skeleton variant="rounded" height="100px"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Circular</div>
        <md-skeleton variant="circular" width="56px" height="56px"></md-skeleton>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const q = (sel: string) => hydrate(canvasElement.querySelector(sel) as HTMLElement);

    // Bare text skeleton (first in DOM order): a single (never-tapered) line
    // exposed as a polite status region. Match by position rather than
    // `:not([variant]):not([lines])` — reflected default props stamp
    // `variant="text"`/`lines="1"` onto the host once it hydrates.
    const single = await q('md-skeleton');
    await waitFor(() =>
      expect(single.shadowRoot!.querySelectorAll('.md-skeleton__line').length).toBe(1),
    );
    expect(single.shadowRoot!.querySelector('.md-skeleton__shape')).toBeNull();
    expect(single.shadowRoot!.querySelector('.md-skeleton__line--tapered')).toBeNull();
    expect(single.getAttribute('role')).toBe('status');
    expect(single.getAttribute('aria-busy')).toBe('true');
    expect(single.getAttribute('aria-label')).toBe('Loading');

    // Multi-line text: the last line is tapered and published as the "line-last" shadow part.
    const para = await q('md-skeleton[lines="3"]');
    await waitFor(() =>
      expect(para.shadowRoot!.querySelectorAll('.md-skeleton__line').length).toBe(3),
    );
    const lineEls = Array.from(para.shadowRoot!.querySelectorAll('.md-skeleton__line'));
    expect(lineEls[0].getAttribute('part')).toBe('line');
    expect(lineEls[0].classList.contains('md-skeleton__line--tapered')).toBe(false);
    expect(lineEls[2].getAttribute('part')).toBe('line line-last');
    expect(lineEls[2].classList.contains('md-skeleton__line--tapered')).toBe(true);

    // Shape variants render a single shape span instead of text lines.
    const rect = await q('md-skeleton[variant="rectangular"]');
    await waitFor(() =>
      expect(rect.shadowRoot!.querySelector('.md-skeleton__shape')).not.toBeNull(),
    );
    expect(rect.shadowRoot!.querySelector('.md-skeleton__shape')!.getAttribute('part')).toBe(
      'shape',
    );
    expect(rect.shadowRoot!.querySelector('.md-skeleton__line')).toBeNull();

    // Circular: width/height flow into the private --_w / --_h host custom properties.
    const circle = await q('md-skeleton[variant="circular"]');
    await waitFor(() => expect(circle.style.getPropertyValue('--_w')).toBe('56px'));
    expect(circle.style.getPropertyValue('--_h')).toBe('56px');
    expect(circle.shadowRoot!.querySelector('.md-skeleton__shape')).not.toBeNull();

    // ── Runtime prop reactions: prove render() re-runs when props change live ──
    const s = single as HTMLElement & {
      lines: number;
      width: string;
      height: string;
      animation: 'pulse' | 'wave' | 'none';
      variant: 'text' | 'rectangular' | 'rounded' | 'circular';
      ariaLabelProp: string;
    };

    // Growing the line count re-renders the rows; the final row becomes tapered.
    s.lines = 4;
    await waitFor(() =>
      expect(single.shadowRoot!.querySelectorAll('.md-skeleton__line').length).toBe(4),
    );
    const grown = Array.from(single.shadowRoot!.querySelectorAll('.md-skeleton__line'));
    expect(grown[3].classList.contains('md-skeleton__line--tapered')).toBe(true);
    expect(grown[0].classList.contains('md-skeleton__line--tapered')).toBe(false);

    // Non-positive counts clamp to a single, un-tapered line (Math.max guard).
    s.lines = -3;
    await waitFor(() =>
      expect(single.shadowRoot!.querySelectorAll('.md-skeleton__line').length).toBe(1),
    );
    expect(single.shadowRoot!.querySelector('.md-skeleton__line--tapered')).toBeNull();

    // width / height feed the private --_w / --_h host custom props on re-render.
    s.width = '220px';
    s.height = '2em';
    await waitFor(() => expect(single.style.getPropertyValue('--_w')).toBe('220px'));
    expect(single.style.getPropertyValue('--_h')).toBe('2em');

    // The animation prop drives the host modifier class (no reduced-motion in play).
    s.animation = 'wave';
    await waitFor(() =>
      expect(single.classList.contains('md-skeleton--anim-wave')).toBe(true),
    );
    expect(single.classList.contains('md-skeleton--anim-pulse')).toBe(false);

    // A custom accessible label reaches the rendered aria-label of the status region.
    s.ariaLabelProp = 'Loading article';
    await waitFor(() => expect(single.getAttribute('aria-label')).toBe('Loading article'));
    expect(single.getAttribute('role')).toBe('status');

    // Switching a text skeleton to a shape variant swaps the line rows for a shape span.
    s.variant = 'circular';
    await waitFor(() =>
      expect(single.shadowRoot!.querySelector('.md-skeleton__shape')).not.toBeNull(),
    );
    expect(single.shadowRoot!.querySelector('.md-skeleton__line')).toBeNull();

    // ── State-neutral reset ──────────────────────────────────────────────────
    // The runtime-reaction steps above mutate `single` (the first bare skeleton)
    // away from its fresh-render defaults. Restore every changed prop so the
    // VISUAL snapshot captures the clean resting render, not a 220px circular
    // wave skeleton. (The other four skeletons are never mutated.)
    s.variant = 'text';
    s.lines = 1;
    s.width = '';
    s.height = '';
    s.animation = 'pulse';
    s.ariaLabelProp = 'Loading';
    await waitFor(() => {
      expect(single.shadowRoot!.querySelectorAll('.md-skeleton__line').length).toBe(1);
      expect(single.shadowRoot!.querySelector('.md-skeleton__shape')).toBeNull();
      expect(single.shadowRoot!.querySelector('.md-skeleton__line--tapered')).toBeNull();
      expect(single.classList.contains('md-skeleton--anim-pulse')).toBe(true);
      expect(single.classList.contains('md-skeleton--anim-wave')).toBe(false);
      expect(single.style.getPropertyValue('--_w')).toBe('');
      expect(single.style.getPropertyValue('--_h')).toBe('');
      expect(single.getAttribute('aria-label')).toBe('Loading');
    });
  },
};

/* ─── Animations ──────────────────────────────────────────── */
export const Animations: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; width: 360px;">
      <div>
        <div style="${labelStyle}">Pulse (default)</div>
        <md-skeleton variant="rounded" height="80px" animation="pulse"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Wave</div>
        <md-skeleton variant="rounded" height="80px" animation="wave"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">None</div>
        <md-skeleton variant="rounded" height="80px" animation="none"></md-skeleton>
      </div>
    </div>
  `,
};

/* ─── Loading List Item ───────────────────────────────────── */
export const LoadingListItem: Story = {
  render: () => html`
    <div style="display: grid; gap: 16px; width: 420px;">
      ${[0, 1, 2].map(
        () => html`
          <div
            style="display: flex; gap: 12px; align-items: flex-start; padding: 16px; background: var(--md-sys-color-surface-container-low, #F7F2FA); border-radius: 16px;"
          >
            <md-skeleton variant="circular" width="40px" height="40px"></md-skeleton>
            <div style="flex: 1;">
              <md-skeleton width="50%" style="margin-bottom: 8px;"></md-skeleton>
              <md-skeleton lines="2"></md-skeleton>
            </div>
          </div>
        `,
      )}
    </div>
  `,
};

/* ─── Loading Card ────────────────────────────────────────── */
export const LoadingCard: Story = {
  render: () => html`
    <div
      style="width: 320px; padding: 16px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 16px; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));"
    >
      <md-skeleton variant="rounded" height="160px"></md-skeleton>
      <div style="margin-top: 16px;">
        <md-skeleton width="70%" style="margin-bottom: 8px;"></md-skeleton>
        <md-skeleton lines="3"></md-skeleton>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <md-skeleton variant="rounded" width="80px" height="32px"></md-skeleton>
          <md-skeleton variant="rounded" width="80px" height="32px"></md-skeleton>
        </div>
      </div>
    </div>
  `,
};

/* ─── Responsive: full width / full height ────────────────── */

/**
 * `full-width` / `full-height` make the placeholder fill its container on each
 * axis, so it tracks a responsive parent (grid cell, flex item, resizable
 * panel). The skeleton is already 100%-wide by default; `full-height` is the
 * new lever for shape variants that should fill a definite-height container.
 *
 * **Drag the bottom-right corner** of the first box to resize it both ways.
 */
export const ResponsiveFullWidthHeight: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 640px;">
      <div>
        <div style="${labelStyle}">full-width + full-height (drag to resize)</div>
        <!-- resize: both + overflow gives the drag handle; the skeleton fills it. -->
        <div
          style="
            resize: both;
            overflow: auto;
            inline-size: 320px;
            block-size: 200px;
            min-inline-size: 160px;
            min-block-size: 96px;
            padding: 12px;
            border: 1px dashed var(--md-sys-color-outline, #79747E);
            border-radius: 12px;
          "
        >
          <md-skeleton variant="rounded" animation="wave" full-width full-height></md-skeleton>
        </div>
      </div>

      <div>
        <div style="${labelStyle}">full-height shapes in a resizable row (drag to resize)</div>
        <!-- The resizable box drives the row height; the full-height shapes track it
             (and the middle full-width one tracks the width). -->
        <div
          style="
            resize: both;
            overflow: auto;
            inline-size: 480px;
            block-size: 140px;
            min-inline-size: 240px;
            min-block-size: 72px;
            padding: 12px;
            border: 1px dashed var(--md-sys-color-outline, #79747E);
            border-radius: 12px;
          "
        >
          <div style="display: flex; gap: 12px; height: 100%;">
            <md-skeleton variant="circular" full-height></md-skeleton>
            <md-skeleton variant="rounded" full-width full-height style="flex: 1;"></md-skeleton>
            <md-skeleton variant="rounded" full-height width="80px"></md-skeleton>
          </div>
        </div>
      </div>

      <div>
        <div style="${labelStyle}">full-width in a responsive grid (drag to resize)</div>
        <!-- Drag the width: the auto-fill grid reflows its column count and the
             full-width skeletons fill whatever cell size results. -->
        <div
          style="
            resize: horizontal;
            overflow: auto;
            inline-size: 100%;
            min-inline-size: 180px;
            max-inline-size: 100%;
            padding: 12px;
            border: 1px dashed var(--md-sys-color-outline, #79747E);
            border-radius: 12px;
          "
        >
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px;">
            ${Array.from(
              { length: 4 },
              () => html`
                <div>
                  <md-skeleton variant="rounded" full-width height="100px"></md-skeleton>
                  <md-skeleton full-width lines="2" style="margin-top: 8px;"></md-skeleton>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display: grid; gap: 16px; width: 360px;">
      <md-skeleton lines="3"></md-skeleton>
      <md-skeleton variant="rounded" height="80px"></md-skeleton>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: () => html`
    <div style="display: grid; gap: 16px; width: 360px;">
      <md-skeleton lines="3"></md-skeleton>
      <md-skeleton variant="rounded" height="80px" animation="wave"></md-skeleton>
      <md-skeleton variant="circular" width="48px" height="48px"></md-skeleton>
    </div>
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand {
        --md-skeleton-color: rgba(103, 80, 164, 0.18);
        --md-skeleton-highlight: rgba(103, 80, 164, 0.08);
      }
      .danger {
        --md-skeleton-color: rgba(179, 38, 30, 0.18);
        --md-skeleton-highlight: rgba(179, 38, 30, 0.08);
      }
    </style>
    <div style="display: grid; gap: 16px; width: 360px;">
      <div>
        <div style="${labelStyle}">Branded (primary tint)</div>
        <md-skeleton class="brand" lines="2"></md-skeleton>
      </div>
      <div>
        <div style="${labelStyle}">Danger tint</div>
        <md-skeleton class="danger" variant="rounded" height="60px" animation="wave"></md-skeleton>
      </div>
    </div>
  `,
};

/* ─── Decorative (announce=false) ─────────────────────────── */
export const Decorative: Story = {
  name: 'Decorative (announce=false)',
  render: () => html`
    <div style="display: grid; gap: 16px; width: 360px;">
      <md-skeleton lines="2"></md-skeleton>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = (await hydrate(
      canvasElement.querySelector('md-skeleton') as HTMLElement,
    )) as HTMLElement & { announce: boolean };

    // Announcing (the default): the skeleton is a live, polite status region.
    await waitFor(() => expect(el.getAttribute('role')).toBe('status'));
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.hasAttribute('aria-hidden')).toBe(false);

    // announce=false removes it from the a11y tree entirely: no role / busy / live /
    // label survive, and aria-hidden is stamped on instead.
    el.announce = false;
    await waitFor(() => expect(el.getAttribute('aria-hidden')).toBe('true'));
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.hasAttribute('aria-live')).toBe(false);
    expect(el.hasAttribute('aria-label')).toBe(false);

    // Re-announcing restores the status role and drops aria-hidden.
    el.announce = true;
    await waitFor(() => expect(el.getAttribute('role')).toBe('status'));
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  },
};

/* ─── Reduced Motion ──────────────────────────────────────── */
export const ReducedMotion: Story = {
  name: 'Reduced Motion (forces animation → none)',
  render: () => html`
    <div style="display: grid; gap: 16px; width: 360px;">
      <md-skeleton variant="rounded" height="80px" animation="pulse"></md-skeleton>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Stub `(prefers-reduced-motion: reduce)` so we can flip it and fire its change
    // listener — proving the component downgrades its animation to "none" with no
    // real OS setting. Delegate every other query to the real matchMedia.
    const realMatchMedia = window.matchMedia;
    const listeners = new Set<(ev?: unknown) => void>();
    const stub = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_t: string, cb: (ev?: unknown) => void) => listeners.add(cb),
      removeEventListener: (_t: string, cb: (ev?: unknown) => void) => listeners.delete(cb),
      addListener: (cb: (ev?: unknown) => void) => listeners.add(cb),
      removeListener: (cb: (ev?: unknown) => void) => listeners.delete(cb),
      dispatchEvent: () => true,
    };

    try {
      window.matchMedia = ((query: string) =>
        query.includes('reduced-motion')
          ? (stub as unknown as MediaQueryList)
          : realMatchMedia(query)) as typeof window.matchMedia;

      // A freshly created element runs its lifecycle against the stubbed query.
      const probe = document.createElement('md-skeleton');
      probe.setAttribute('variant', 'rounded');
      probe.setAttribute('animation', 'pulse');
      probe.setAttribute('height', '80px');
      canvasElement.appendChild(probe);

      await customElements.whenDefined('md-skeleton');
      const el = await hydrate(probe);

      // Motion allowed initially: the requested "pulse" class is applied, and the
      // component subscribed a change listener to our stubbed query.
      await waitFor(() => expect(el.classList.contains('md-skeleton--anim-pulse')).toBe(true));
      expect(listeners.size).toBeGreaterThan(0);

      // Flip the query to "reduce" and fire the change listener.
      stub.matches = true;
      listeners.forEach((cb) => cb());

      // The component re-renders with its animation forced off.
      await waitFor(() => expect(el.classList.contains('md-skeleton--anim-none')).toBe(true));
      expect(el.classList.contains('md-skeleton--anim-pulse')).toBe(false);

      probe.remove();
    } finally {
      window.matchMedia = realMatchMedia;
    }
  },
};
