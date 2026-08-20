import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

const trend = [12, 14, 13, 18, 22, 20, 24, 28, 26, 32, 36, 40];
const volatility = [40, 38, 42, 35, 52, 48, 55, 41, 60, 58, 65, 70];

const meta: Meta = {
  title: 'Charts/Sparkline',
  component: 'md-sparkline',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    variant: { control: 'radio', options: ['line', 'bar', 'area'] },
    color: { control: 'select', options: ['primary', 'secondary', 'tertiary', 'error'] },
    curve: { control: 'select', options: ['linear', 'smooth', 'monotone', 'step'] },
    showMarks: { control: 'select', options: ['none', 'extremes', 'edges', 'all'] },
    showTooltip: { control: 'boolean' },
    cornerRadius: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    lineWidth: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    markSize: { control: { type: 'range', min: 2, max: 12, step: 0.5 } },
    barWidth: { control: { type: 'number', min: 2, max: 40 } },
  },
  args: {
    variant: 'line',
    color: 'primary',
    curve: 'smooth',
    showMarks: 'extremes',
    showTooltip: true,
    cornerRadius: 2,
    lineWidth: 2.5,
    markSize: 3.5,
    barWidth: undefined,
  },
};
export default meta;
type Story = StoryObj;

/* --- play() helpers ------------------------------------------
 * testing-library queries can't cross shadow roots, so play()
 * addresses the real <md-sparkline> host + its public @Method
 * surface. The chart renders on the in-house engine (Canvas2D),
 * so play() reads the engine's render scene + drives real DOM events. */
type RenderSceneLike = { markers: unknown[]; bars: unknown[]; areas: unknown[]; lines: unknown[] };
type SparkEngine = { getScene: () => RenderSceneLike | null; replay: () => void };
type SparklineEl = HTMLElement & {
  data: (number | null)[];
  color: string;
  variant: string;
  showMarks: string;
  showTooltip: boolean;
  cornerRadius: number;
  resize: () => Promise<void>;
  getInstance: () => Promise<SparkEngine | null>;
};
/** First `md-sparkline` in the canvas — hydrated + with a live engine. */
const getSpark = async (canvasElement: HTMLElement): Promise<SparklineEl> => {
  const el = canvasElement.querySelector('md-sparkline') as SparklineEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  return el;
};
/** The engine's current render scene. */
const scene = async (spark: SparklineEl): Promise<RenderSceneLike> => {
  const inst = await spark.getInstance();
  return inst!.getScene()!;
};
/** Re-play the one-shot grow-and-fade entrance. Storybook auto-runs play() on
 *  view, and every data/prop swap inside a play() preempts the intro — replaying
 *  once at the end lets the story settle into the same entrance the others show. */
const replayIntro = async (spark: SparklineEl): Promise<void> => {
  (await spark.getInstance())?.replay();
};

export const Playground: Story = {
  render: (args) => html`
    <md-sparkline
      style="inline-size: 240px; block-size: 44px;"
      variant=${args.variant}
      color=${args.color}
      curve=${args.curve}
      show-marks=${args.showMarks}
      ?show-tooltip=${args.showTooltip}
      corner-radius=${args.cornerRadius}
      .lineWidth=${args.lineWidth}
      .markSize=${args.markSize}
      .barWidth=${args.barWidth}
      .data=${trend}
    ></md-sparkline>
  `,
  /** Exercises the public @Method surface, the @Watch reactions, the selective
   *  mark branches, the variant swap, and the hover-tooltip toggle. */
  play: async ({ canvasElement, step }) => {
    const spark = await getSpark(canvasElement);
    const plot = () => spark.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    const canvas = () => plot().querySelector('canvas') as HTMLCanvasElement;

    await step('public methods: getInstance / resize stay live', async () => {
      expect(await spark.getInstance()).not.toBeNull();
      await spark.resize();
      expect(await spark.getInstance()).not.toBeNull();
    });

    await step('showMarks selects extremes / edges / all markers (deduped)', async () => {
      // Interior max (idx 1) + interior min (idx 4) so extremes ≠ edges ≠ all.
      spark.data = [12, 40, 13, 18, 5, 20, 24, 28, 26, 32, 10, 15];
      spark.showMarks = 'extremes';
      await waitFor(async () => expect((await scene(spark)).markers.length).toBe(2));
      spark.showMarks = 'all'; // every data point
      await waitFor(async () => expect((await scene(spark)).markers.length).toBe(12));
      spark.showMarks = 'edges'; // first + last only
      await waitFor(async () => expect((await scene(spark)).markers.length).toBe(2));
      spark.showMarks = 'none';
      await waitFor(async () => expect((await scene(spark)).markers.length).toBe(0));
      spark.showMarks = 'extremes';
    });

    await step('clicking the plot forwards mdSparkClick with a data index', async () => {
      let detail: { dataIndex: number; value: number | null } | undefined;
      const onClick = (e: Event) => { detail = (e as CustomEvent).detail; };
      spark.addEventListener('mdSparkClick', onClick);
      const cv = canvas();
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5, bubbles: true }));
      await waitFor(() => expect(detail).toBeTruthy());
      expect(detail!.dataIndex).toBeGreaterThanOrEqual(0);
      spark.removeEventListener('mdSparkClick', onClick);
    });

    await step('variant switches the rendered geometry (line → area → bar)', async () => {
      spark.variant = 'area';
      await waitFor(async () => expect((await scene(spark)).areas.length).toBeGreaterThan(0));
      spark.variant = 'bar';
      await waitFor(async () => expect((await scene(spark)).bars.length).toBeGreaterThan(0));
      spark.variant = 'line';
      await waitFor(async () => {
        const s = await scene(spark);
        expect(s.lines.length).toBeGreaterThan(0);
        expect(s.areas.length).toBe(0);
      });
    });

    await step('show-tooltip=false suppresses the hover tooltip', async () => {
      const cv = canvas();
      const r = cv.getBoundingClientRect();
      const tip = () => spark.shadowRoot!.querySelector('[part="tooltip"]');
      spark.showTooltip = true;
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5, bubbles: true }));
      await waitFor(() => expect(tip()).not.toBeNull());
      cv.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      spark.showTooltip = false;
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5, bubbles: true }));
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      expect(tip()).toBeNull();
      spark.showTooltip = true;
    });

    await step('reset: restore the initial render (line / extremes / trend)', async () => {
      spark.variant = 'line';
      spark.showMarks = 'extremes';
      spark.cornerRadius = 2;
      spark.data = trend;
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(async () => expect((await scene(spark)).lines.length).toBeGreaterThan(0));
    });

    await replayIntro(spark); // settle into the grow-and-fade entrance
  },
};

export const Variants: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px;">
      ${(['line', 'bar', 'area'] as const).map(
        (v) => html`
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <span style="font-size: 12px; opacity: 0.7; min-inline-size: 48px;">${v}</span>
            <md-sparkline variant=${v} .data=${trend} style="flex: 1;"></md-sparkline>
            <strong>${trend[trend.length - 1]}</strong>
          </div>
        `,
      )}
    </div>
  `,
};

/**
 * **Pinned scale** (`min` / `max`) — by default a sparkline auto-scales to its own
 * data, so a metric that never leaves 8–12% still fills the whole height and reads
 * as maxed out. Give several sparklines the same `min` + `max` and they share one
 * scale, so their heights are finally comparable: idle sits low, the busy one high.
 */
export const SharedScale: Story = {
  render: () => {
    const rows = [
      { label: 'CPU · idle', data: [8, 10, 9, 12, 7, 11, 9] },
      { label: 'CPU · web', data: [40, 45, 42, 48, 44, 50, 46] },
      { label: 'CPU · db', data: [85, 88, 86, 90, 87, 92, 89] },
    ];
    const column = (pinned: boolean) => html`
      <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
        <div style="font-size: 12px; opacity: 0.7;">
          ${pinned ? 'Pinned to 0–100 · comparable' : 'Auto-scaled · each fills its own height'}
        </div>
        ${rows.map(
          (r) => html`
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 12px; opacity: 0.7; min-inline-size: 72px;">${r.label}</span>
              <md-sparkline
                variant="area"
                .data=${r.data}
                .min=${pinned ? 0 : undefined}
                .max=${pinned ? 100 : undefined}
                style="flex: 1; block-size: 32px;"
              ></md-sparkline>
            </div>
          `,
        )}
      </div>
    `;
    return html`<div style="display: flex; gap: 32px; max-width: 760px;">${column(false)}${column(true)}</div>`;
  },
};

export const InAKpiTile: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 720px;">
      ${[
        { title: t(globals.locale, 'sparkline.revenue'), value: '$48.2K', delta: '+12%', color: 'primary', data: trend },
        { title: t(globals.locale, 'sparkline.activeUsers'), value: '12,484', delta: '+4%', color: 'tertiary', data: volatility },
        { title: t(globals.locale, 'sparkline.errors'), value: '0.12%', delta: '-23%', color: 'error', data: [...volatility].reverse() },
      ].map(
        (tile) => html`
          <div
            style="
              padding: 16px;
              border-radius: 16px;
              background: var(--md-sys-color-surface-container);
              display: flex;
              flex-direction: column;
              gap: 8px;
            "
          >
            <div style="font-size: 12px; opacity: 0.7;">${tile.title}</div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-size: 24px; font-weight: 600;">${tile.value}</span>
              <span style="font-size: 12px; opacity: 0.7;">${tile.delta}</span>
            </div>
            <md-sparkline variant="area" color=${tile.color} .data=${tile.data} style="block-size: 36px;"></md-sparkline>
          </div>
        `,
      )}
    </div>
  `,
};

export const InsideATable: Story = {
  render: (_args, { globals }) => html`
    <table style="border-collapse: collapse; max-width: 480px; font-size: 14px;">
      <thead>
        <tr>
          <th style="text-align: start; padding: 8px;">${t(globals.locale, 'sparkline.product')}</th>
          <th style="text-align: start; padding: 8px;">${t(globals.locale, 'sparkline.trend7d')}</th>
          <th style="text-align: end; padding: 8px;">${t(globals.locale, 'sparkline.sales')}</th>
        </tr>
      </thead>
      <tbody>
        ${[
          { name: 'AWC', trend: [4, 6, 5, 8, 10, 9, 14], sales: '128' },
          { name: 'Bolt', trend: [12, 8, 10, 6, 4, 5, 3], sales: '47' },
          { name: 'Compass', trend: [20, 22, 18, 24, 28, 30, 36], sales: '210' },
        ].map(
          (row) => html`
            <tr style="border-block-start: 1px solid var(--md-sys-color-outline-variant);">
              <td style="padding: 8px;">${row.name}</td>
              <td style="padding: 8px;">
                <md-sparkline .data=${row.trend} style="inline-size: 120px;"></md-sparkline>
              </td>
              <td style="padding: 8px; text-align: end; font-variant-numeric: tabular-nums;">${row.sales}</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `,
};

export const ReferenceArea: Story = {
  render: () => html`
    <div style="inline-size: 320px;">
      <md-sparkline
        variant="area"
        .data=${trend}
        .referenceAreas=${[{ from: 3, to: 6, label: 'campaign window' }]}
        style="block-size: 48px;"
      ></md-sparkline>
    </div>
  `,
  /** The reference window renders a translucent band under the area fill; the
   *  colour formats (rgb / rgba / named) all re-render the gradient. */
  play: async ({ canvasElement, step }) => {
    const spark = await getSpark(canvasElement);

    await step('the reference window renders a highlight band under the area fill', async () => {
      const s = await scene(spark);
      expect(s.areas.length).toBeGreaterThan(0); // area variant fill
      expect(s.bars.length).toBeGreaterThan(0); // the reference band
    });

    await step('rgb / rgba / named / token colours all re-render the fill', async () => {
      for (const c of ['rgb(10, 20, 30)', 'rgba(1, 2, 3, 0.5)', 'gold', 'primary']) {
        spark.color = c;
        await waitFor(async () => expect((await scene(spark)).areas.length).toBeGreaterThan(0));
      }
    });

    await replayIntro(spark); // settle into the grow-and-fade entrance
  },
};

export const NoMarks: Story = {
  render: () => html`
    <md-sparkline
      style="inline-size: 240px; block-size: 32px;"
      show-marks="none"
      show-tooltip="false"
      .data=${trend}
    ></md-sparkline>
  `,
  /** Swapping to an all-null series drives the empty-data a11y summary. */
  play: async ({ canvasElement, step }) => {
    const spark = await getSpark(canvasElement);

    await step('all-null data yields the no-data a11y summary', async () => {
      expect(spark.getAttribute('aria-label')).toContain('Sparkline');
      spark.data = [null, null, null];
      await waitFor(() => {
        expect(spark.getAttribute('aria-label')).toBe('Sparkline, no data.');
      });
      // Restore the data — Storybook auto-plays on view, so leaving it all-null
      // here left the story rendering EMPTY.
      spark.data = trend;
      await waitFor(() => expect(spark.getAttribute('aria-label')).toContain('latest'));
    });

    await replayIntro(spark); // settle into the grow-and-fade entrance
  },
};

export const DarkTheme: Story = {
  render: () => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface); padding: 16px; border-radius: 16px; max-width: 360px;"
    >
      <md-sparkline .data=${trend} variant="area" style="block-size: 48px;"></md-sparkline>
    </div>
  `,
};
