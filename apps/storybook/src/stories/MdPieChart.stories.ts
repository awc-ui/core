import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';
import { chartPlay } from '../testing/chart-play';

const trafficData = (locale?: string) => [
  { label: t(locale, 'pieChart.direct'), value: 320 },
  { label: t(locale, 'pieChart.organicSearch'), value: 240 },
  { label: t(locale, 'pieChart.paidSocial'), value: 180 },
  { label: t(locale, 'pieChart.referral'), value: 120 },
  { label: t(locale, 'pieChart.email'), value: 80 },
];

const meta: Meta = {
  title: 'Charts/Pie Chart',
  component: 'md-pie-chart',
  tags: ['autodocs'],
  // IN visual regression, on the same 0.02% tolerance as every other chart.
  //
  // It was skipped for "a few sub-pixels of jitter each render (~2-3%)", which
  // measurement does not support: with the runner emulating reduced-motion the
  // intro never plays, and three consecutive runs matched their baselines at
  // ZERO tolerance. The instability was the entry animation, and it was fixed
  // by the reduced-motion emulation rather than by the skip that outlived it.
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    innerRadius: { control: 'text' },
    outerRadius: { control: 'text' },
    startAngle: { control: { type: 'range', min: -360, max: 360, step: 5 } },
    endAngle: { control: { type: 'range', min: -360, max: 360, step: 5 } },
    paddingAngle: { control: { type: 'range', min: 0, max: 12, step: 0.5 } },
    cornerRadius: { control: { type: 'range', min: 0, max: 24, step: 1 } },
    highlight: { control: 'radio', options: ['slice', 'series', 'none'] },
    legend: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'none'] },
    showLabels: { control: 'boolean' },
    labelMode: { control: 'radio', options: ['value', 'name', 'both'] },
    label: { control: 'text' },
    subtitle: { control: 'text' },
    titleAlign: { control: 'radio', options: ['start', 'center', 'end'] },
    tooltip: { control: 'radio', options: ['item', 'axis', 'none'] },
    monochrome: { control: 'text' },
    gradient: { control: 'boolean' },
    animation: { control: 'select', options: ['expressive', 'grow', 'draw', 'fade', 'stagger', 'none'] },
    animationDuration: { control: { type: 'range', min: 0, max: 2000, step: 20 } },
    noAnimation: { control: 'boolean' },
    loading: { control: 'boolean' },
    loadingLabel: { control: 'text' },
    labelEmpty: { control: 'text' },
    // Props with no sensible control: `data`, `valueFormatter`, `tooltipRenderer`,
    // `tableLabels`, `summary`, `labelPlot`, `labelPoint` and `ringWidths` are a
    // dataset, three callbacks, a strings object and a weights array — a story
    // is the honest way to show those, and each has one. `locale` is driven by
    // the toolbar so every story changes together.
    data: { table: { disable: true } },
    valueFormatter: { table: { disable: true } },
    tooltipRenderer: { table: { disable: true } },
    tableLabels: { table: { disable: true } },
    ringWidths: { table: { disable: true } },
  },
  args: {
    innerRadius: '0%',
    outerRadius: '75%',
    startAngle: 90,
    endAngle: -270,
    // Slices touch by default and are told apart by the hairline separator, as
    // MD3 pies do. `padding-angle` opens a REAL angular gap on top of that — a
    // deliberate look, demoed in PaddingAngles — so it starts at 0 here rather
    // than making the Playground's first impression a gapped pie.
    paddingAngle: 0,
    cornerRadius: 6,
    highlight: 'slice',
    legend: 'right',
    showLabels: true,
    labelMode: 'value',
    titleAlign: 'start',
    tooltip: 'item',
    gradient: false,
    animation: 'expressive',
    animationDuration: 680,
    noAnimation: false,
    loading: false,
  },
};
export default meta;
type Story = StoryObj;

/** The bits of the element these tests drive. */
type PieChartEl = HTMLElement & {
  data: { label: string; value: number; selected?: boolean }[];
  label: string;
  legend: string;
  getInstance(): Promise<unknown>;
  toDataURL(): Promise<string>;
  drill(index: number, direction?: 'down' | 'up'): Promise<void>;
  resize(): Promise<void>;
};

/**
 * The chart, once it is actually alive.
 *
 * Both waits matter. A pre-hydration click is a silent no-op — the element is
 * in the DOM and takes events, and nothing happens — while its methods already
 * work, so `getInstance()` resolving is not on its own proof that a pointer
 * event will land.
 */
const getChart = async (canvasElement: HTMLElement, selector = 'md-pie-chart'): Promise<PieChartEl> => {
  const el = canvasElement.querySelector(selector) as PieChartEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  await settled(el);
  return el;
};

/**
 * Wait for the ring to stop moving.
 *
 * The intro grows the wedges over ~680ms, and a hydrated chart with a live
 * engine is not a finished one: measuring the painted band a frame after mount
 * reads a ring that is still on its way out, and a point taken from it lands in
 * the middle of nothing. Two agreeing measurements are enough — the intro never
 * pauses mid-flight.
 */
const settled = async (chart: PieChartEl): Promise<void> => {
  let last = -1;
  await waitFor(
    () => {
      const now = Math.round(reachAt(chart, 0));
      const same = now > 0 && now === last;
      last = now;
      expect(same).toBe(true);
    },
    { timeout: 4000, interval: 120 },
  );
};

/**
 * The focusable plot — it owns the keyboard — and the canvas inside it, which
 * owns the pointer. Events do not travel DOWN, so a click on the wrapper never
 * reaches the listeners the engine put on the canvas.
 */
const plotOf = (chart: PieChartEl) => chart.shadowRoot!.querySelector('.md-pie-chart__canvas') as HTMLElement;
const surfaceOf = (chart: PieChartEl) => chart.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
const ringCentre = (chart: PieChartEl) => {
  const host = chart.getBoundingClientRect();
  const px = (v: string) => parseFloat(getComputedStyle(chart).getPropertyValue(v));
  return { x: host.left + px('--_pie-center-x'), y: host.top + px('--_pie-center-y') };
};

/** The painted radial band at `midDeg`, in CSS px from the ring centre.
 *  Read off the canvas, so it measures what was PAINTED rather than what the
 *  layout intended — the two came apart more than once, and it saves the test
 *  from having to know whether the story is a pie or a donut. */
const bandAt = (chart: PieChartEl, midDeg: number): { inner: number; outer: number } => {
  const cv = chart.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const img = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
  const dpr = cv.width / cv.getBoundingClientRect().width;
  const box = cv.getBoundingClientRect();
  const c = ringCentre(chart);
  const cx = (c.x - box.left) * dpr;
  const cy = (c.y - box.top) * dpr;
  const a = ((midDeg - 90) * Math.PI) / 180;
  let inner = Infinity;
  let outer = 0;
  for (let r = 2; r < cv.height; r += 0.5) {
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) break;
    if (img[(y * cv.width + x) * 4 + 3] > 40) {
      outer = r;
      if (inner === Infinity) inner = r;
    }
  }
  return { inner: (inner === Infinity ? 0 : inner) / dpr, outer: outer / dpr };
};

/** A point in the middle of slice `index`'s band — inside the wedge whatever
 *  the story's radii are. */
const pointOnSlice = (chart: PieChartEl, index: number) => {
  const total = chart.data.reduce((sum, d) => sum + d.value, 0);
  const before = chart.data.slice(0, index).reduce((sum, d) => sum + d.value, 0);
  const midDeg = ((before + chart.data[index].value / 2) / total) * 360;
  const band = bandAt(chart, midDeg);
  const r = (band.inner + band.outer) / 2;
  const a = ((midDeg - 90) * Math.PI) / 180;
  const c = ringCentre(chart);
  return { midDeg, clientX: c.x + Math.cos(a) * r, clientY: c.y + Math.sin(a) * r };
};

/** How far the wedge at `midDeg` reaches. */
const reachAt = (chart: PieChartEl, midDeg: number): number => bandAt(chart, midDeg).outer;

export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="width: 480px;">
      <md-pie-chart locale=${globals.locale}
        label=${args.label ?? t(globals.locale, 'pieChart.traffic')}
        subtitle=${args.subtitle ?? ''}
        title-align=${args.titleAlign}
        .data=${trafficData(globals.locale)}
        inner-radius=${args.innerRadius}
        outer-radius=${args.outerRadius}
        start-angle=${args.startAngle}
        end-angle=${args.endAngle}
        padding-angle=${args.paddingAngle}
        corner-radius=${args.cornerRadius}
        highlight=${args.highlight}
        legend=${args.legend}
        tooltip=${args.tooltip}
        label-mode=${args.labelMode}
        monochrome=${args.monochrome ?? ''}
        animation=${args.animation}
        animation-duration=${args.animationDuration}
        loading-label=${args.loadingLabel ?? ''}
        label-empty=${args.labelEmpty ?? ''}
        ?gradient=${args.gradient}
        ?no-animation=${args.noAnimation}
        ?loading=${args.loading}
        ?show-labels=${args.showLabels}
      ></md-pie-chart>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const chart = await getChart(canvasElement);
    const plot = plotOf(chart);
    const surface = surfaceOf(chart);
    // Measured off the painted band rather than guessed, so the test does not
    // have to know whether this story is a pie or a donut.
    const first = pointOnSlice(chart, 0);
    const tooltip = () => chart.shadowRoot!.querySelector('[part="tooltip"]');

    await step('public methods answer once the chart is alive', async () => {
      expect(await chart.getInstance()).not.toBeNull();
      await chart.resize();
      expect((await chart.toDataURL()).startsWith('data:image/')).toBe(true);
    });

    await step('a pointer over a slice shows its tooltip, and leaving clears it', async () => {
      surface.dispatchEvent(new PointerEvent('pointermove', { clientX: first.clientX, clientY: first.clientY, bubbles: true }));
      await waitFor(() => expect(tooltip()).not.toBeNull());
      expect(tooltip()!.textContent).toContain(chart.data[0].label);
      surface.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      await waitFor(() => expect(tooltip()).toBeNull());
    });

    await step('clicking a slice reports it, with the datum it stands for', async () => {
      // What the click DOES to the geometry — sliding the slice out of the ring
      // — is pinned in the layout spec, which can read the offset directly.
      // Here the question is the wiring: that a press on the canvas reaches the
      // right slice and reports the right datum.
      const seen: { dataIndex: number; value: number }[] = [];
      const onClick = (e: Event) => seen.push((e as CustomEvent).detail);
      chart.addEventListener('mdSliceClick', onClick);
      const press = { clientX: first.clientX, clientY: first.clientY, bubbles: true };
      surface.dispatchEvent(new PointerEvent('pointerdown', press));
      surface.dispatchEvent(new MouseEvent('click', press));
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0].dataIndex).toBe(0);
      expect(seen[0].value).toBe(chart.data[0].value);
      chart.removeEventListener('mdSliceClick', onClick);
    });

    await step('the plot takes focus and the arrows walk the slices', async () => {
      plot.focus();
      expect(chart.shadowRoot!.activeElement).toBe(plot);
      const live = () => chart.shadowRoot!.querySelector('.md-pie-chart__live')!.textContent ?? '';
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await waitFor(() => expect(live()).toContain(chart.data[0].label));
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await waitFor(() => expect(live()).toContain(chart.data[1].label));
      // Escape gives the highlight up rather than leaving it stranded.
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => expect(live()).toBe(''));
    });

    await step('Home and End jump to the ends, and blur gives the highlight up', async () => {
      const live = () => chart.shadowRoot!.querySelector('.md-pie-chart__live')!.textContent ?? '';
      const last = chart.data[chart.data.length - 1];
      plot.focus();
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await waitFor(() => expect(live()).toContain(last.label));
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await waitFor(() => expect(live()).toContain(chart.data[0].label));
      // Leaving the plot drops the highlight rather than stranding it on a
      // slice nobody is pointing at any more.
      plot.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      await waitFor(() => expect(live()).toBe(''));
    });

    await step('replay() runs the entry motion again on a chart already drawn', async () => {
      await (chart as unknown as { replay(): Promise<void> }).replay();
      expect(await chart.getInstance()).not.toBeNull();
      expect((await chart.toDataURL()).startsWith('data:image/')).toBe(true);
    });

    await step('Enter reports the focused slice, exactly as a click on it would', async () => {
      const seen: { dataIndex: number }[] = [];
      const onClick = (e: Event) => seen.push((e as CustomEvent).detail);
      chart.addEventListener('mdSliceClick', onClick);
      plot.focus();
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0].dataIndex).toBe(0);
      chart.removeEventListener('mdSliceClick', onClick);
    });
  },
};

export const Pie: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale} .data=${trafficData(globals.locale)} legend="bottom"></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Donut: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale} inner-radius="60%" .data=${trafficData(globals.locale)} legend="bottom">
        <div slot="center">
          <div style="font-size: 28px; font-weight: 600; line-height: 1;">${trafficData(globals.locale).reduce((a, d) => a + d.value, 0).toLocaleString()}</div>
          <div style="font-size: 12px; opacity: 0.7;">${t(globals.locale, 'pieChart.visitors')}</div>
        </div>
      </md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const SemiCircle: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale}
        inner-radius="60%"
        outer-radius="95%"
        start-angle="180"
        end-angle="0"
        .data=${[
          { label: t(globals.locale, 'pieChart.used'), value: 68, color: 'primary' },
          { label: t(globals.locale, 'pieChart.free'), value: 32, color: 'surface-variant' },
        ]}
        legend="none"
        show-labels="false"
        style="--md-pie-chart-aspect-ratio: 2 / 1;"
      >
        <div slot="center" style="margin-block-start: -32px;">
          <div style="font-size: 32px; font-weight: 600; line-height: 1;">68%</div>
          <div style="font-size: 12px; opacity: 0.7;">${t(globals.locale, 'pieChart.storageUsed')}</div>
        </div>
      </md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Exploded: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale}
        .data=${[
          { label: t(globals.locale, 'pieChart.direct'), value: 320, selected: true },
          { label: t(globals.locale, 'pieChart.organicSearch'), value: 240 },
          { label: t(globals.locale, 'pieChart.paidSocial'), value: 180 },
          { label: t(globals.locale, 'pieChart.referral'), value: 120 },
          { label: t(globals.locale, 'pieChart.email'), value: 80 },
        ]}
        padding-angle="2"
      ></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const PaddingAngles: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 720px;">
      ${[0, 4, 8].map(
        (padding) => html`
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">paddingAngle=${padding}</p>
            <md-pie-chart locale=${globals.locale} inner-radius="50%" padding-angle=${padding} .data=${trafficData(globals.locale)} legend="none"></md-pie-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay(),
};

export const CustomColors: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale}
        .data=${[
          { label: t(globals.locale, 'pieChart.success'), value: 60, color: '#43a047' },
          { label: t(globals.locale, 'pieChart.warning'), value: 25, color: '#fb8c00' },
          { label: t(globals.locale, 'pieChart.error'), value: 15, color: '#e53935' },
        ]}
        inner-radius="50%"
        legend="bottom"
      ></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface); padding: 16px; border-radius: 16px; width: 360px;"
    >
      <md-pie-chart locale=${globals.locale} .data=${trafficData(globals.locale)} inner-radius="55%" legend="bottom"></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .surface-card {
        --md-pie-chart-background: var(--md-sys-color-surface-container);
        --md-pie-chart-padding: 16px;
        --md-pie-chart-shape: 16px;
      }
    </style>
    <div style="width: 360px;">
      <md-pie-chart locale=${globals.locale} class="surface-card" .data=${trafficData(globals.locale)} inner-radius="50%" legend="bottom">
        <div slot="center">
          <div style="font-size: 24px; font-weight: 600; line-height: 1;">${trafficData(globals.locale).reduce((a, d) => a + d.value, 0)}</div>
          <div style="font-size: 12px; opacity: 0.7;">${t(globals.locale, 'pieChart.visitorsLc')}</div>
        </div>
      </md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Nuclear generation, five countries -------------------------
 * TWh per year, 1965-2024, from Our World in Data (Energy Institute
 * Statistical Review). A donut race: the ring is the five-country total each
 * year and the arcs are their shares, so the story is the reshuffle — the UK
 * holds three quarters of it in 1965, France climbs through the 1980s, and
 * Germany falls to nothing after 2011.
 * ------------------------------------------------------------ */
const NUKE_YEARS = [1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const NUKE_US = [3.85, 5.81, 8.06, 13.19, 14.66, 22.95, 40.11, 56.94, 87.87, 119.97, 181.58, 201.16, 264.09, 290.95, 268.58, 264.33, 287.02, 297.66, 309.13, 344.88, 403.88, 435.83, 479.23, 554.71, 557.22, 607.22, 644.81, 651.34, 642.41, 674.15, 708.84, 710.24, 661.73, 709.16, 766.58, 753.89, 768.83, 780.06, 763.73, 788.53, 781.99, 787.22, 806.42, 806.21, 798.85, 806.97, 790.2, 769.33, 789.02, 797.17, 797.18, 805.69, 804.95, 807.08, 809.41, 789.88, 779.65, 771.54, 774.87, 781.86];
const NUKE_UK = [15.13, 20.22, 23.28, 26.19, 29.12, 26.01, 27.55, 29.38, 28.0, 33.62, 30.34, 36.16, 40.02, 37.22, 38.31, 37.02, 37.97, 43.97, 49.93, 53.98, 61.09, 59.08, 55.24, 63.46, 71.73, 65.75, 70.54, 76.81, 89.35, 88.28, 88.96, 94.67, 98.15, 99.49, 95.13, 85.06, 90.09, 87.85, 88.69, 80.0, 81.62, 75.45, 63.03, 52.49, 69.1, 62.14, 68.98, 70.41, 70.61, 63.75, 70.34, 71.73, 70.34, 65.06, 56.18, 50.24, 46.1, 47.4, 40.6, 40.59];
const NUKE_FR = [0.9, 1.4, 2.08, 3.08, 3.6, 5.71, 9.33, 14.59, 14.75, 14.71, 18.25, 15.78, 17.94, 30.45, 39.96, 61.25, 105.33, 108.92, 144.26, 191.23, 224.1, 254.16, 265.52, 275.52, 303.93, 314.08, 331.34, 338.45, 368.19, 359.98, 377.23, 397.34, 395.48, 387.99, 394.24, 415.16, 421.08, 436.76, 441.07, 448.24, 451.53, 450.19, 439.73, 439.45, 409.74, 428.52, 442.39, 425.41, 423.68, 436.48, 437.43, 403.2, 398.36, 412.94, 399.01, 353.83, 379.36, 294.73, 338.2, 380.45];
const NUKE_DE = [0.12, 0.27, 1.23, 1.77, 4.94, 6.49, 6.22, 9.52, 12.11, 14.46, 24.14, 29.53, 41.26, 43.87, 52.06, 55.59, 65.53, 74.43, 78.06, 104.32, 138.64, 130.49, 141.72, 156.82, 161.67, 152.47, 147.23, 158.8, 153.28, 150.7, 153.09, 160.02, 170.33, 161.64, 170.0, 169.61, 171.3, 164.84, 165.06, 167.07, 163.05, 167.27, 140.53, 148.49, 134.93, 140.56, 107.97, 99.46, 97.29, 97.13, 91.79, 84.63, 76.32, 76.0, 75.07, 64.38, 69.13, 34.71, 7.22, 0.0];
const NUKE_JP = [0.03, 0.58, 0.63, 1.04, 1.08, 4.58, 8.01, 9.48, 9.71, 19.7, 25.12, 34.08, 31.66, 59.31, 70.39, 82.59, 87.82, 102.43, 114.29, 134.26, 159.58, 165.37, 188.6, 173.9, 185.81, 194.57, 208.69, 217.04, 247.7, 258.25, 286.89, 296.5, 321.16, 325.97, 317.23, 319.12, 320.54, 314.26, 230.08, 285.87, 293.04, 304.29, 279.01, 251.74, 274.65, 292.36, 162.93, 17.99, 14.6, 0.0, 4.52, 17.68, 29.07, 49.11, 65.64, 43.0, 61.22, 51.77, 77.46, 84.91];

const NUKE_SERIES = [
  { code: 'US', data: NUKE_US },
  { code: 'UK', data: NUKE_UK },
  { code: 'FR', data: NUKE_FR },
  { code: 'DE', data: NUKE_DE },
  { code: 'JP', data: NUKE_JP },
];

/**
 * **Donut race** — the ring is one year's total and the arcs are each country's
 * share of it, replayed year by year. Where a line race shows values climbing,
 * this shows a *reshuffle*: the UK holds three quarters of the total in 1965,
 * France climbs through the 1980s, and Germany's arc closes to nothing after
 * 2011.
 *
 * Two things make it readable at speed. `label-mode="name"` puts the country
 * code on the ring itself rather than a value that would be unreadable while
 * changing every frame — the total sits in the middle instead, where it is
 * steady enough to follow. And `no-animation` turns off the entry bloom: the
 * story is already driving the motion, and re-blooming on every frame would
 * fight it.
 *
 * Values are interpolated between years so the arcs glide rather than step.
 */
export const DonutRace: Story = {
  // Continuous playback: no frame of it is the frame.
  parameters: { controls: { disable: true }, visual: { skip: true } },
  render: (_args, { globals }) => {
    const LAST = NUKE_YEARS.length - 1;
    const FIRST_YEAR = NUKE_YEARS[0];
    const LAST_YEAR = NUKE_YEARS[LAST];
    // The cursor is a YEAR: these samples are evenly spaced, but keeping the
    // cursor in data units means the slider reads as the axis it controls.
    let progress = FIRST_YEAR;
    let raf = 0;
    let last = 0;
    const SPEED = (LAST_YEAR - FIRST_YEAR) / 14000; // full run ≈ 14 s
    let chartEl: (HTMLElement & { data: unknown }) | undefined;
    let sliderEl: (HTMLElement & { value: number }) | undefined;
    let btnEl: (HTMLElement & { icon: string }) | undefined;
    let yearEl: HTMLElement | undefined;
    let totalEl: HTMLElement | undefined;
    let dragging = false;

    // A FIXED one decimal, not "up to one": dropping the decimal at a whole
    // number shortens the string and the centred line jumps under it — measured
    // at 4.8px between "39.2 TWh" and "43 TWh".
    const fmt = (v: number) =>
      v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const apply = () => {
      if (!chartEl) return;
      const i = Math.min(LAST, Math.max(0, Math.floor(progress - FIRST_YEAR)));
      const f = Math.min(1, Math.max(0, progress - NUKE_YEARS[i]));
      const at = (arr: number[]) => (i >= LAST ? arr[LAST] : arr[i] + (arr[i + 1] - arr[i]) * f);
      const values = NUKE_SERIES.map((s) => ({ label: tr(s.code, globals.locale), value: Math.max(0, at(s.data)) }));
      chartEl.data = values;
      if (yearEl) yearEl.textContent = String(Math.round(progress));
      if (totalEl) totalEl.textContent = `${fmt(values.reduce((a, v) => a + v.value, 0))} ${t(globals.locale, 'unit.twh')}`;
      if (sliderEl && !dragging) sliderEl.value = progress;
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (btnEl) btnEl.icon = 'play_arrow';
    };
    const frame = (now: number) => {
      if (chartEl && !chartEl.isConnected) return stop();
      if (!last) last = now;
      progress = Math.min(LAST_YEAR, progress + (now - last) * SPEED);
      last = now;
      apply();
      if (progress >= LAST_YEAR) return stop();
      raf = requestAnimationFrame(frame);
    };
    const play = () => {
      if (progress >= LAST_YEAR) progress = FIRST_YEAR;
      if (btnEl) btnEl.icon = 'pause';
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    return html`
      <style>
        .nuke-play::part(icon) {
          font-variation-settings: 'FILL' 1;
        }
      </style>
      <div style="max-width: 560px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
          <md-icon-button
            class="nuke-play"
            variant="filled"
            shape="round"
            icon="play_arrow"
            aria-label=${t(globals.locale, 'line-chart.play-pause')}
            ${ref((el) => {
              btnEl = el as typeof btnEl;
            })}
            @click=${() => (raf ? stop() : play())}
          ></md-icon-button>
          <md-slider
            min=${FIRST_YEAR}
            max=${LAST_YEAR}
            step="0.1"
            .value=${progress}
            style="flex:1;"
            aria-label=${t(globals.locale, 'line-chart.race-progress')}
            ${ref((el) => {
              sliderEl = el as typeof sliderEl;
            })}
            @mdDragStart=${() => {
              dragging = true;
              stop();
            }}
            @mdDragEnd=${() => {
              dragging = false;
            }}
            @mdInput=${(e: Event) => {
              stop();
              progress = (e as CustomEvent<{ value: number }>).detail.value;
              apply();
            }}
          ></md-slider>
        </div>
        <md-pie-chart
          style="height: 440px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'pieChart.nuclearRace')}
          subtitle=${t(globals.locale, 'pieChart.nuclearSub')}
          title-align="center"
          inner-radius="62%"
          outer-radius="86%"
          label-mode="name"
          legend="none"
          no-animation
          .valueFormatter=${(v: number) => `${fmt(v)} ${t(globals.locale, 'unit.twh')}`}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
        >
          <div slot="center" style="text-align:center; line-height:1.1;">
            <div
              style="font-size:44px; font-weight:600; font-variant-numeric:tabular-nums; opacity:0.55;"
              ${ref((el) => {
                yearEl = el as HTMLElement;
              })}
            >
              ${FIRST_YEAR}
            </div>
            <div style="font-size:13px; opacity:0.7; margin-top:4px;">
              ${t(globals.locale, 'pieChart.total')}:
              <strong
                ${ref((el) => {
                  totalEl = el as HTMLElement;
                })}
                >—</strong
              >
            </div>
          </div>
        </md-pie-chart>
      </div>
    `;
  },
  play: chartPlay({
    extra: async ({ charts, canvasElement }) => {
      const chart = charts[0] as typeof charts[0] & { data: { value: number }[] };
      const centre = canvasElement.querySelector('[slot="center"]') as HTMLElement;
      const before = chart.data.map((d) => d.value).join(',');
      const play = canvasElement.querySelector('md-button, md-icon-button') as HTMLElement | null;
      play?.click();
      // A race replaces `data` every frame — the one story where the chart is
      // re-fed continuously rather than configured once.
      await waitFor(() => expect(chart.data.map((d) => d.value).join(',')).not.toBe(before), { timeout: 4000 });
      // The centre text is not part of the canvas, so it can fall out of step
      // with the ring it is reporting; it should always carry a number.
      await waitFor(() => expect(centre.textContent).toMatch(/\d/));
    },
  }),
};

/* --- Browser market share, January 2022 -------------------------
 * StatCounter figures, as percentages. The families sum to 100 and each
 * family's versions sum to its own share, which is what a nested ring is for:
 * the inner ring answers "which browser", the outer one "which version of it".
 * ------------------------------------------------------------ */
/**
 * The two levels below a browser version, as a fixed split rather than a table
 * of numbers pretending to have been measured: the point of the story is that
 * the drill goes N deep, and inventing per-version platform statistics to
 * demonstrate it would be passing off made-up figures as real ones.
 */
const PLATFORM_SPLIT: readonly (readonly [string, number])[] = [
  ['Windows', 0.44],
  ['Android', 0.27],
  ['macOS', 0.14],
  ['iOS', 0.1],
  ['Linux', 0.05],
];
const FORM_FACTOR_SPLIT: readonly (readonly [string, number])[] = [
  ['Desktop', 0.58],
  ['Mobile', 0.36],
  ['Tablet', 0.06],
];

/**
 * Localize the generic labels in the browser data, leaving the brand names be.
 *
 * "Chrome" and "Safari" are proper nouns and stay as they are in every locale;
 * "Other", "Desktop" and the rest are ordinary words, and leaving them in
 * English next to a translated title is the kind of half-localized chart that
 * looks like an oversight because it is one.
 */
const GENERIC: Record<string, string> = {
  Other: 'pieChart.other',
  Desktop: 'pieChart.desktop',
  Mobile: 'pieChart.mobile',
  Tablet: 'pieChart.tablet',
  // Place names translate, unlike the product names above.
  France: 'country.France',
  Spain: 'country.Spain',
  Germany: 'country.Germany',
  Poland: 'country.Poland',
  Italy: 'country.Italy',
  Czechia: 'country.Czechia',
  Switzerland: 'country.Switzerland',
  US: 'country.US',
  UK: 'country.UK',
  FR: 'country.FR',
  DE: 'country.DE',
  JP: 'country.JP',
};
const tr = (label: string, locale?: string) => (GENERIC[label] ? t(locale, GENERIC[label]) : label);
/** …applied across a level of data and any nesting under it, keeping
 *  everything else about each row. */
const trAll = <T extends { label: string; children?: readonly T[] }>(rows: readonly T[], locale?: string): T[] =>
  rows.map((r) => ({
    ...r,
    label: tr(r.label, locale),
    ...(r.children ? { children: trAll(r.children, locale) } : {}),
  }));

const BROWSER_SHARE = [
  {
    label: 'Chrome',
    value: 62.74,
    children: [
      { label: 'v97.0', value: 36.89 },
      { label: 'v96.0', value: 18.16 },
      { label: 'v95.0', value: 0.54 },
      { label: 'Other', value: 7.15 },
    ],
  },
  {
    label: 'Safari',
    value: 9.86,
    children: [
      { label: 'v15.2', value: 2.01 },
      { label: 'v15.1', value: 2.29 },
      { label: 'v14.1', value: 2.48 },
      { label: 'v13.1', value: 1.17 },
      { label: 'Other', value: 1.91 },
    ],
  },
  {
    label: 'Edge',
    value: 9.17,
    children: [
      { label: 'v97', value: 6.62 },
      { label: 'v96', value: 2.55 },
    ],
  },
  {
    label: 'Firefox',
    value: 7.5,
    children: [
      { label: 'v96.0', value: 4.17 },
      { label: 'v95.0', value: 3.33 },
    ],
  },
  { label: 'Other', value: 10.73 },
];

/**
 * **Nested rings.** A slice can carry `children`, drawn as a second ring
 * outside it that subdivides exactly its own arc — so the inner ring answers
 * "which browser" and the outer one "which version of it", and the two can
 * never disagree.
 *
 * The tree is flattened internally into a plain indexed list carrying `level`
 * and `parent`, because every consumer-facing address is an index: tooltips,
 * legend toggles, click events and the screen-reader table all say "slice N".
 *
 * A child with no colour of its own takes a lighter shade of its parent's, so a
 * family reads as one block with its versions as gradations. Hovering a version
 * keeps its family lit too — they are the same answer, and dimming one would
 * imply they were unrelated.
 */
export const NestedRings: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 620px;">
      <md-pie-chart
        style="height: 520px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'pieChart.browserShare')}
        subtitle=${t(globals.locale, 'pieChart.browserSub')}
        title-align="center"
        inner-radius="28%"
        outer-radius="72%"
        legend="none"
        .data=${trAll(BROWSER_SHARE, globals.locale)}
        .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
      ></md-pie-chart>
    </div>
  `,
  play: chartPlay({
    extra: async ({ charts }) => {
      const chart = charts[0] as typeof charts[0] & { data: { label: string; children?: unknown[] }[] };
      const plot = chart.shadowRoot!.querySelector('.md-pie-chart__canvas') as HTMLElement;
      const live = () => chart.shadowRoot!.querySelector('.md-pie-chart__live')!.textContent ?? '';
      const arrow = () => plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      plot.focus();
      arrow();
      await waitFor(() => expect(live()).toContain(chart.data[0].label));
      // The second stop is the first slice's CHILD, not its sibling: `data` is a
      // tree, and walking only the top level left the outer ring unreachable.
      const child = (chart.data[0].children as { label: string }[])[0];
      arrow();
      await waitFor(() => expect(live()).toContain(child.label));
      // …and its share is read against its own level, not the whole tree, which
      // holds every ring at once and so counts each parent twice.
      const siblings = chart.data[0].children as { value: number }[];
      const share = (siblings[0].value / siblings.reduce((a, c) => a + c.value, 0)) * 100;
      await waitFor(() => expect(live()).toContain(share.toFixed(1)));
    },
  }),
};

/**
 * **Monochrome.** `monochrome` renders every slice as a shade of one colour —
 * darkest first, lightening around the ring — instead of the categorical
 * palette.
 *
 * Reach for it when the slices are *ordered* (a ranking, a funnel) rather than
 * merely different. A single hue stops the reader hunting for meaning in colour
 * that isn't there, and it survives most colour-vision deficiencies, which a
 * five-hue palette does not. It takes an MD3 role or any CSS colour; bare, it
 * uses `primary`.
 */
export const Monochrome: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 520px;">
      <md-pie-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'pieChart.monochrome')}
        subtitle=${t(globals.locale, 'pieChart.monochromeSub')}
        title-align="center"
        monochrome
        legend="bottom"
        .data=${trAll(BROWSER_SHARE.map(({ label, value }) => ({ label, value })), globals.locale)}
        .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
      ></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

/** Browsers → versions → platforms → form factors: four levels for the drill. */
type DrillNode = { label: string; value: number; children?: DrillNode[] };
const round2 = (n: number) => Math.round(n * 100) / 100;
const BROWSER_TREE: DrillNode[] = BROWSER_SHARE.map((browser) => ({
  label: browser.label,
  value: browser.value,
  children: browser.children?.map((version) => ({
    label: version.label,
    value: version.value,
    children: PLATFORM_SPLIT.map(([platform, share]) => ({
      label: platform,
      value: round2(version.value * share),
      children: FORM_FACTOR_SPLIT.map(([form, f]) => ({
        label: form,
        value: round2(version.value * share * f),
      })),
    })),
  })),
}));

/**
 * **Drill-down.** Clicking a slice that has `children` replaces the ring with
 * that slice's breakdown; the button walks back up.
 *
 * No drill-down mode is needed on the component for this — the same nested data
 * the `NestedRings` story renders in two rings is here shown one level at a
 * time, driven by `mdSliceClick` and a swap of `data`. Which of the two to use
 * is a question about the reader: rings show the whole hierarchy at once and
 * cost radius, drilling shows one level at full size and costs a click.
 *
 * The depth is not fixed. This one goes four levels — browser, version,
 * platform, form factor — and neither `drill()` nor the trail knows or cares:
 * the path is a list, every crumb is a target, and the animation is always
 * between two adjacent levels of it. The bottom two levels are a fixed split of
 * their parent rather than measured figures; inventing per-version platform
 * statistics to demonstrate depth would be passing off made-up numbers as real
 * ones.
 */

export const Drilldown: Story = {
  render: (_args, { globals }) => {
    let path: string[] = [];
    let chartEl: (HTMLElement & { data: unknown; drill(i: number, d?: 'down' | 'up'): Promise<void> }) | undefined;
    let trailEl: HTMLElement | undefined;

    const levelAt = (p: string[]) => {
      let items = BROWSER_TREE;
      for (const step of p) items = items.find((d) => d.label === step)?.children ?? [];
      return items;
    };

    /** Push the current level into the chart and rebuild the trail. */
    const apply = () => {
      if (!chartEl) return;
      // Translated only for display: `path` keys off the original labels, so a
      // trail built in one locale still resolves after the locale changes.
      chartEl.data = levelAt(path).map((d) => ({ label: tr(d.label, globals.locale), value: d.value }));
      if (!trailEl) return;
      // The root crumb plus one per step; the last is the level on screen, so
      // it is `current` and not a link.
      const crumbs = [t(globals.locale, 'pieChart.allBrowsers'), ...path.map((l) => tr(l, globals.locale))];
      trailEl.innerHTML = crumbs
        .map(
          (label, i) =>
            `<md-breadcrumb-item href="#" ${i === crumbs.length - 1 ? 'current' : ''}>${label}</md-breadcrumb-item>`,
        )
        .join('');
    };

    /** Descend into slice `i` of the level on screen. */
    const down = async (i: number) => {
      const here = levelAt(path)[i];
      // Only descend where there is something to descend into — a click on a
      // leaf should do nothing rather than empty the chart.
      if (!here?.children?.length) return;
      // AWAIT: the method resolves through a microtask, so an un-awaited call
      // would arm the drill only after `apply()` had already swapped the data.
      // This captures the clicked wedge, which the new ring unfurls out of.
      await chartEl?.drill(i, 'down');
      path = [...path, here.label];
      apply();
    };

    /** Climb back to `depth` steps from the root. */
    const upTo = async (depth: number) => {
      if (depth >= path.length) return;
      const target = path.slice(0, depth);
      // Going up, the connecting wedge is the one we are returning INTO, which
      // only exists once the parent level has been laid out — so it is named by
      // its index there.
      const idx = levelAt(target).findIndex((d) => d.label === path[depth]);
      if (idx >= 0) await chartEl?.drill(idx, 'up');
      path = target;
      apply();
    };

    return html`
      <div style="max-width: 520px;">
        <md-breadcrumbs
          separator="›"
          style="display:block; margin-bottom:8px; min-height:32px;"
          ${ref((el) => {
            trailEl = el as HTMLElement;
          })}
          @mdSelect=${(e: CustomEvent<{ itemIndex: number }>) => {
            // The crumbs are in-chart navigation, not URLs — stop the <a>.
            e.preventDefault();
            upTo(e.detail.itemIndex);
          }}
        ></md-breadcrumbs>
        <md-pie-chart
          style="height: 400px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'pieChart.browserShare')}
          subtitle=${t(globals.locale, 'pieChart.drilldownSub')}
          title-align="center"
          legend="bottom"
          .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          @mdSliceClick=${(e: CustomEvent<{ dataIndex: number }>) => down(e.detail.dataIndex)}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
        ></md-pie-chart>
      </div>
    `;
  },
  play: async ({ canvasElement, step }) => {
    const chart = await getChart(canvasElement);
    const surface = surfaceOf(chart);
    const crumbs = () => Array.from(canvasElement.querySelectorAll('md-breadcrumb-item')).map((e) => e.textContent!.trim());
    const labels = () => chart.data.map((d) => d.label);
    const top = labels();
    const clickASlice = () => {
      const p = pointOnSlice(chart, 0);
      surface.dispatchEvent(new MouseEvent('click', { clientX: p.clientX, clientY: p.clientY, bubbles: true }));
    };

    await step('the trail starts at the root, with nothing to climb back to', async () => {
      // Built on a frame after the ref lands, so it is not there synchronously.
      await waitFor(() => expect(crumbs()).toHaveLength(1));
      expect(chart.data.length).toBeGreaterThan(1);
    });

    await step('clicking a slice descends, and the trail grows a crumb', async () => {
      clickASlice();
      await waitFor(() => expect(labels()).not.toEqual(top));
      await waitFor(() => expect(crumbs()).toHaveLength(2));
    });

    await step('it goes deeper than one level — the depth is not fixed', async () => {
      const level2 = labels();
      clickASlice();
      await waitFor(() => expect(labels()).not.toEqual(level2));
      await waitFor(() => expect(crumbs()).toHaveLength(3));
    });

    await step('a crumb climbs straight back to its level, not one step at a time', async () => {
      // Re-queried on every attempt, not captured once: the trail is rebuilt
      // with innerHTML, so its items are replaced wholesale and hydrate on a
      // later tick — a reference taken too early is both detached and
      // shadow-rootless, and clicking it does nothing at all.
      const rootLink = () =>
        (canvasElement.querySelector('md-breadcrumb-item') as HTMLElement | null)?.shadowRoot?.querySelector(
          'a, button',
        ) as HTMLElement | null;
      await waitFor(() => expect(rootLink()).not.toBeNull());
      rootLink()!.click();
      await waitFor(() => expect(labels()).toEqual(top));
      await waitFor(() => expect(crumbs()).toHaveLength(1));
    });

    await step('drill() resolves through a microtask, so it has to be awaited', async () => {
      // A bare call lands AFTER a `data` assignment on the next line, and the
      // transition is silently skipped. This pins the contract the story
      // depends on rather than the animation itself.
      const armed = chart.drill(0, 'down');
      expect(typeof armed.then).toBe('function');
      await armed;
    });
  },
};

/**
 * **Gradient fill** (`gradient`) — each slice is filled with a gradient running
 * outward along its own mid-angle, lighter at the centre.
 *
 * Purely decorative: it changes nothing about what a slice means, which is why
 * it is off by default. The gradient follows each wedge's own angle rather than
 * sweeping across the canvas, so the whole ring is lit from the middle outward
 * — one gradient across the box would light the left of the pie differently
 * from the right, which reads as a shadow rather than depth.
 */
export const GradientFill: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 520px;">
      <md-pie-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'pieChart.fuelTitle')}
        title-align="center"
        gradient
        legend="bottom"
        .data=${[
          { label: t(globals.locale, 'pieChart.diesel'), value: 45.0 },
          { label: t(globals.locale, 'pieChart.petrol'), value: 34.4 },
          { label: t(globals.locale, 'pieChart.electricity'), value: 11.9 },
          { label: t(globals.locale, 'pieChart.other'), value: 8.7 },
        ]}
        .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
      ></md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Variable radius** — `radius` on a datum sets how far its slice reaches, as a
 * fraction of the chart's outer radius. That carries a SECOND dimension: here
 * the angle is each country's land area and the radius its population density,
 * so a small dense country reads as a narrow spike and a large sparse one as a
 * broad shallow wedge.
 *
 * A floor keeps the smallest reach visible — a slice drawn at zero radius is
 * indistinguishable from missing data, while still occupying its angle.
 *
 * Areas (thousand km²) and densities (people per km²) are round public figures.
 */
export const VariableRadius: Story = {
  render: (_args, { globals }) => {
    const countries = [
      { label: tr('France', globals.locale), area: 552, density: 119 },
      { label: tr('Spain', globals.locale), area: 506, density: 95 },
      { label: tr('Germany', globals.locale), area: 358, density: 235 },
      { label: tr('Poland', globals.locale), area: 313, density: 122 },
      { label: tr('Italy', globals.locale), area: 302, density: 196 },
      { label: tr('Czechia', globals.locale), area: 79, density: 137 },
      { label: tr('Switzerland', globals.locale), area: 41, density: 219 },
    ];
    const maxDensity = Math.max(...countries.map((c) => c.density));
    return html`
      <div style="max-width: 560px;">
        <md-pie-chart
          style="height: 460px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'pieChart.densityTitle')}
          subtitle=${t(globals.locale, 'pieChart.densitySub')}
          title-align="center"
          inner-radius="12%"
          legend="none"
          label-mode="name"
          .data=${countries.map((c) => ({ label: c.label, value: c.area, radius: c.density / maxDensity }))}
          .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale)} ${t(globals.locale, 'unit.thousandKm2')}`}
        ></md-pie-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Semi-circle donut** — a half ring, from `start-angle` to `end-angle` with an
 * `inner-radius`. Compact enough for a dashboard tile, and the hollow centre
 * takes a caption.
 */
export const SemiCircleDonut: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 520px;">
      <md-pie-chart
        style="height: 300px;"
        locale=${globals.locale}
        start-angle="180"
        end-angle="0"
        inner-radius="55%"
        outer-radius="95%"
        legend="bottom"
        .data=${trAll(BROWSER_SHARE.map(({ label, value }) => ({ label, value })), globals.locale)}
        .valueFormatter=${(v: number) => `${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
      >
        <div slot="center" style="text-align:center; font-size:15px; font-weight:600; line-height:1.25;">
          ${t(globals.locale, 'pieChart.semiTitle')}
        </div>
      </md-pie-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Legend positions.** The legend names the slices so the ring itself can stay
 * uncluttered — which is why slice labels default to the VALUE when a legend is
 * present and to `name · value` when there isn't one. `legend` takes the four
 * edges plus the four corners, or `none`.
 */
export const LegendPositions: Story = {
  render: (_args, { globals }) => html`
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:860px;">
      ${(['bottom', 'top', 'left', 'right'] as const).map(
        (pos) => html`
          <div>
            <p style="margin:0 0 4px; font-size:12px; opacity:0.7;">legend="${pos}"</p>
            <md-pie-chart
              style="height: 260px;"
              locale=${globals.locale}
              legend=${pos}
              .data=${trafficData(globals.locale)}
            ></md-pie-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay({
    extra: async ({ charts }) => {
      const chart = charts[0];
      const chip = () => chart.shadowRoot!.querySelector('[part="legend"] button') as HTMLButtonElement;
      await waitFor(() => expect(chip()).not.toBeNull());
      // The chips are the only way to drop a slice without touching `data`, and
      // nothing else in the pie stories exercises them.
      expect(chip().getAttribute('aria-pressed')).toBe('true');
      chip().click();
      await waitFor(() => expect(chip().getAttribute('aria-pressed')).toBe('false'));
      chip().click();
      await waitFor(() => expect(chip().getAttribute('aria-pressed')).toBe('true'));
    },
  }),
};
