import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';
import { chartPlay } from '../testing/chart-play';

const categories = ['Q1', 'Q2', 'Q3', 'Q4'];

const getProductSeries = (locale: string | undefined) => [
  { label: t(locale, 'barChart.desktop'), data: [120, 200, 150, 80] },
  { label: t(locale, 'barChart.mobile'), data: [220, 182, 191, 234] },
  { label: t(locale, 'barChart.tablet'), data: [150, 232, 201, 154] },
];

const meta: Meta = {
  title: 'Charts/Bar Chart',
  component: 'md-bar-chart',
  tags: ['autodocs'],
  // Charts size fluidly to their container width (aspect-ratio driven); the
  // global 'centered' layout shrink-wraps the wrapper to the chart's minimum,
  // rendering it tiny. 'padded' lets the max-width wrappers expand to full width.
  parameters: { layout: 'padded', docs: { source: { language: 'html' } } },
  argTypes: {
    layout: { control: 'radio', options: ['vertical', 'horizontal'] },
    stack: { control: 'select', options: ['none', 'normal', 'percentage'] },
    legend: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'none'] },
    cornerRadius: { control: { type: 'range', min: 0, max: 24, step: 1 } },
    barWidth: { control: { type: 'number', min: 2, max: 80 } },
    showLabels: { control: 'boolean' },
  },
  args: { layout: 'vertical', stack: 'none', legend: 'top-end', cornerRadius: 6, barWidth: undefined, showLabels: false },
};
export default meta;
type Story = StoryObj;

/* --- play() helpers ------------------------------------------
 * testing-library queries can't cross shadow roots, so play()
 * addresses the real host + its public @Method surface directly.
 * The chart renders on the in-house engine (Canvas2D + a DOM
 * text overlay), so play() drives it through real DOM events. */
type BarChartEl = HTMLElement & {
  label: string;
  showLabels: boolean;
  stack: string;
  layout: string;
  zoom: string;
  legend: string;
  resize: () => Promise<void>;
  toDataURL: () => Promise<string>;
  getInstance: () => Promise<unknown | null>;
};
/** First `md-bar-chart` in the canvas — hydrated + with a live engine. */
const getChart = async (
  canvasElement: HTMLElement,
  selector = 'md-bar-chart',
): Promise<BarChartEl> => {
  const el = canvasElement.querySelector(selector) as BarChartEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  return el;
};

/**
 * The chart wired to the controls panel — change a prop and watch it re-render.
 *
 * Its `play` only settles and audits. Anything that MUTATES what is on screen —
 * `layout`, `stack`, `legend` — belongs elsewhere: a play function runs on every
 * view of its story, so driving those from here made the chart visibly flip
 * through horizontal, percentage-stacked and legend-less states before settling,
 * every time anyone opened the one story they were about to fiddle with.
 */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        label="${t(globals.locale, 'barChart.salesByQuarter')}"
        layout=${args.layout}
        stack=${args.stack}
        legend=${args.legend}
        corner-radius=${args.cornerRadius}
        .barWidth=${args.barWidth}
        ?show-labels=${args.showLabels}
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Basic: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 560px;">
      <md-bar-chart
        .series=${[{ label: t(globals.locale, 'barChart.visits'), data: [120, 200, 150, 80, 70, 110, 130] }]}
        .xAxis=${{ data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Grouped: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        label="Grouped (default)"
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Stacked: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        label="Stacked additively"
        stack="normal"
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Percentage: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        label="${t(globals.locale, 'barChart.shareOfTotal')}"
        stack="percentage"
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Horizontal: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 640px;">
      <md-bar-chart
        layout="horizontal"
        label="Horizontal layout (great for long labels)"
        .series=${[{ label: t(globals.locale, 'barChart.score'), data: [89, 76, 92, 68, 81] }]}
        .xAxis=${{ data: [t(globals.locale, 'barChart.performance'), t(globals.locale, 'barChart.accessibility'), t(globals.locale, 'barChart.bestPractices'), 'SEO', 'PWA'] }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const RoundedCorners: Story = {
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 960px;">
      ${[0, 6, 16].map(
        (cornerRadius) => html`
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">cornerRadius=${cornerRadius}</p>
            <md-bar-chart
              corner-radius=${cornerRadius}
              .series=${[{ label: 'value', data: [12, 18, 14, 22, 28, 24] }]}
              .xAxis=${{ data: ['A', 'B', 'C', 'D', 'E', 'F'] }}
              style="--md-bar-chart-aspect-ratio: 16 / 12;"
            ></md-bar-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay(),
};

export const WithDataLabels: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 640px;">
      <md-bar-chart
        show-labels
        label="Inline data labels"
        .series=${[{ label: t(globals.locale, 'barChart.score'), data: [82, 91, 67, 88, 75] }]}
        .xAxis=${{ data: ['Q1', 'Q2', 'Q3', 'Q4', 'Q1'] }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const CustomColors: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 640px;">
      <md-bar-chart
        label="Per-series colours"
        .series=${[
          { label: t(globals.locale, 'barChart.good'), data: [40, 50, 60, 70], color: '#43a047' },
          { label: t(globals.locale, 'barChart.bad'), data: [20, 15, 25, 10], color: '#e53935' },
        ]}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface); padding: 16px; border-radius: 16px; max-width: 640px;"
    >
      <md-bar-chart
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .surface-card {
        --md-bar-chart-background: var(--md-sys-color-surface-container);
        --md-bar-chart-padding: 16px;
        --md-bar-chart-shape: 16px;
      }
    </style>
    <div style="max-width: 640px;">
      <md-bar-chart
        class="surface-card"
        label="Inside a surface card"
        .series=${getProductSeries(globals.locale)}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * Each per-series colour string (hex / `rgb(...)` / `rgba(...)` / named) is
 * parsed by the engine's colour reader and rasterised into the bar fills. The
 * four series' legend labels are observable on the DOM overlay, and the frame
 * rasterises to a real image.
 */
export const SeriesColorFormats: Story = {
  render: () => html`
    <div style="max-width: 640px;">
      <md-bar-chart
        label="Series colour formats"
        .series=${[
          { label: 'Hex', data: [40, 50, 60, 70], color: '#43a047' },
          { label: 'Rgb', data: [20, 15, 25, 10], color: 'rgb(10, 20, 30)' },
          { label: 'Rgba', data: [12, 18, 14, 22], color: 'rgba(1, 2, 3, 0.5)' },
          { label: 'Named', data: [30, 25, 35, 20], color: 'red' },
        ]}
        .xAxis=${{ data: categories }}
      ></md-bar-chart>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const chart = await getChart(canvasElement);
    expect(await chart.getInstance()).not.toBeNull();
    // All four series' legend labels landed in the DOM overlay.
    const legend = chart.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    await waitFor(() => expect(legend?.textContent).toContain('Hex'));
    for (const label of ['Rgb', 'Rgba', 'Named']) expect(legend.textContent).toContain(label);
    // The bar fills (hex / rgb / rgba / named) all rasterised to a real image.
    const url = await chart.toDataURL();
    expect(url.startsWith('data:image/')).toBe(true);
  },
};

/**
 * **Grouped horizontal bars** — three readings of the same categories side by
 * side, laid along the value axis so the category names have room to be words
 * rather than abbreviations.
 *
 * The pieces that make it read at a glance: `corner-radius` large enough to
 * round the ends into pills, `show-labels` to print each value at the end of
 * its own bar (a grouped chart's bars are too close together to make a reader
 * trace them back to an axis), and `yAxis.label` to say what the numbers ARE
 * once, instead of repeating a unit on every tick.
 *
 * Population figures in millions, from Wikipedia's world-population tables.
 */
export const GroupedHorizontal: Story = {
  render: (_args, { globals }) => {
    const year = (y: number) => t(globals.locale, 'barChart.year').replace('%y%', String(y));
    return html`
      <div style="max-width: 760px;">
        <md-bar-chart
          style="height: 460px;"
          locale=${globals.locale}
          layout="horizontal"
          label=${t(globals.locale, 'barChart.popTitle')}
          subtitle=${t(globals.locale, 'barChart.popSource')}
          title-align="center"
          corner-radius="999"
          show-labels
          legend="top-end"
          .series=${[
            { label: year(1990), data: [632, 727, 3202, 721] },
            { label: year(2000), data: [814, 841, 3714, 726] },
            { label: year(2021), data: [1393, 1031, 4695, 745] },
          ]}
          .xAxis=${{
            data: [
              t(globals.locale, 'barChart.africa'),
              t(globals.locale, 'barChart.americas'),
              t(globals.locale, 'barChart.asia'),
              t(globals.locale, 'barChart.europe'),
            ],
          }}
          .yAxis=${{ label: t(globals.locale, 'barChart.popAxis') }}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Column chart** — the vertical default, two series side by side across six
 * categories. The same data as a grouped bar, turned ninety degrees: columns
 * suit short category names and a value axis you want read top-down.
 *
 * `yAxis.label` names the unit once on the axis, so the ticks can stay bare
 * numbers, and a formatter shortens them to `k` — six-figure tick labels would
 * take more gutter than the plot.
 *
 * Production estimates in thousand metric tons, from IndexMundi's 2023 tables.
 */
export const ColumnChart: Story = {
  render: (_args, { globals }) => {
    const thousands = (v: number) =>
      v >= 1000 ? `${(v / 1000).toLocaleString(globals.locale)}k` : v.toLocaleString(globals.locale);
    return html`
      <div style="max-width: 780px;">
        <md-bar-chart
          style="height: 440px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'barChart.cropTitle')}
          subtitle=${t(globals.locale, 'barChart.cropSource')}
          legend="bottom"
          .series=${[
            { label: t(globals.locale, 'barChart.corn'), data: [389690, 277000, 129000, 63000, 55000, 35000] },
            { label: t(globals.locale, 'barChart.wheat'), data: [44900, 140000, 9700, 140000, 20000, 113500] },
          ]}
          .xAxis=${{
            data: [
              t(globals.locale, 'barChart.usa'),
              t(globals.locale, 'barChart.china'),
              t(globals.locale, 'barChart.brazil'),
              t(globals.locale, 'barChart.eu'),
              t(globals.locale, 'barChart.argentina'),
              t(globals.locale, 'barChart.india'),
            ],
          }}
          .yAxis=${{ label: t(globals.locale, 'barChart.cropAxis'), valueFormatter: (v: number) => thousands(v) }}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/* --- bar race ------------------------------------------------
 * Approximate ACI world-airport traffic, in millions of passengers.
 * Rounded to whole millions and sampled at six years — enough for the
 * ranking to genuinely reorder (Beijing and Dubai climb, 2020 collapses
 * everything, and the recovery reshuffles the order again) without
 * pretending to a precision the demo doesn't need. */
const RACE_YEARS = [2004, 2010, 2015, 2019, 2020, 2023];
const RACE_AIRPORTS = [
  { code: 'ATL', color: '#7cb5ec', data: [84, 89, 101, 111, 43, 105] },
  { code: 'DXB', color: '#f7a35c', data: [21, 47, 78, 86, 26, 87] },
  { code: 'DFW', color: '#7cb5ec', data: [59, 57, 64, 75, 39, 82] },
  { code: 'HND', color: '#e4d354', data: [62, 64, 75, 85, 31, 79] },
  { code: 'LHR', color: '#90ed7d', data: [67, 66, 75, 81, 22, 79] },
  { code: 'DEN', color: '#7cb5ec', data: [43, 52, 54, 69, 33, 78] },
  { code: 'LAX', color: '#7cb5ec', data: [61, 59, 75, 88, 28, 75] },
  { code: 'ORD', color: '#7cb5ec', data: [75, 67, 77, 85, 30, 74] },
  { code: 'DEL', color: '#f45b5b', data: [13, 28, 48, 68, 28, 72] },
  { code: 'CDG', color: '#8085e9', data: [51, 58, 66, 76, 22, 68] },
  { code: 'PEK', color: '#45c2c0', data: [35, 74, 90, 100, 34, 54] },
  { code: 'PVG', color: '#45c2c0', data: [21, 40, 60, 76, 32, 55] },
];
/** How many bars the race shows — the rest fall off the bottom. */
const RACE_TOP_N = 8;

/**
 * **Bar race** — one series whose bars are ENTITIES rather than samples, re-sorted
 * every frame so the ranking itself is the animation. Press play, or drag the
 * slider to scrub to any year.
 *
 * Two things make this work on a bar chart. `pointColors` tints each bar
 * individually, keyed by data index — without it a single series is one colour
 * and the bars would be indistinguishable as they swap places. And the value
 * axis is pinned with `yAxis.max`, because a race whose axis rescales every
 * frame reads as the bars standing still while the numbers move.
 *
 * The cursor is a YEAR held as a float, and each frame interpolates between the
 * two sampled years that bracket it. That is what makes a rank change look like
 * one bar overtaking another: the values cross continuously, so the reorder
 * happens at the moment the bars are the same length. Stepping sample-to-sample
 * would jump-cut instead. `no-animation` turns off the entry animation, since
 * the story is driving the motion itself.
 */
export const BarRace: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: (_args, { globals }) => {
    const FIRST = RACE_YEARS[0];
    const LAST = RACE_YEARS[RACE_YEARS.length - 1];
    let progress = FIRST;
    let raf = 0;
    let last = 0;
    const SPEED = (LAST - FIRST) / 14000; // full run ≈ 14 s
    let chartEl: (HTMLElement & { series: unknown; xAxis: unknown; yAxis: unknown }) | undefined;
    let sliderEl: (HTMLElement & { value: number }) | undefined;
    let btnEl: (HTMLElement & { icon: string }) | undefined;
    let yearEl: HTMLElement | undefined;
    let totalEl: HTMLElement | undefined;
    let dragging = false;

    /** Every airport's value at the (fractional) year `y`. */
    const sample = (y: number) => {
      let i = RACE_YEARS.findIndex((yr) => yr > y);
      if (i <= 0) i = i === 0 ? 1 : RACE_YEARS.length - 1;
      const a = RACE_YEARS[i - 1];
      const span = RACE_YEARS[i] - a;
      const f = span > 0 ? Math.min(1, Math.max(0, (y - a) / span)) : 0;
      return RACE_AIRPORTS.map((ap) => ({ ...ap, value: ap.data[i - 1] + (ap.data[i] - ap.data[i - 1]) * f }));
    };
    // The axis maximum is fixed for the whole run — see the docblock.
    const AXIS_MAX = Math.ceil(Math.max(...RACE_AIRPORTS.flatMap((a) => a.data)) / 10) * 10 + 10;

    const apply = () => {
      if (!chartEl) return;
      const all = sample(progress);
      const top = [...all].sort((a, b) => b.value - a.value).slice(0, RACE_TOP_N);
      chartEl.xAxis = { data: top.map((a) => a.code) };
      chartEl.yAxis = { max: AXIS_MAX, label: t(globals.locale, 'barChart.racePassengers') };
      chartEl.series = [
        {
          label: t(globals.locale, 'barChart.racePassengers'),
          data: top.map((a) => a.value),
          pointColors: Object.fromEntries(top.map((a, i) => [i, a.color])),
        },
      ];
      if (yearEl) yearEl.textContent = String(Math.round(progress));
      if (totalEl) {
        totalEl.textContent = `${t(globals.locale, 'barChart.raceTotal')}: ${Math.round(
          all.reduce((n, a) => n + a.value, 0),
        ).toLocaleString(globals.locale)}`;
      }
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
      progress = Math.min(LAST, progress + (now - last) * SPEED);
      last = now;
      apply();
      if (progress >= LAST) return stop();
      raf = requestAnimationFrame(frame);
    };
    const play = () => {
      if (progress >= LAST) progress = FIRST;
      if (btnEl) btnEl.icon = 'pause';
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    return html`
      <style>
        .bar-race-play::part(icon) {
          font-variation-settings: 'FILL' 1;
        }
        /* Longhands, not the font shorthand: the typescale tokens hold a whole
           font declaration, and nesting one inside a shorthand makes the
           shorthand invalid — the browser drops the size along with it. */
        .bar-race-year {
          font-family: var(--md-sys-typescale-display-small-font-family, system-ui);
          font-size: 44px;
          font-weight: 600;
          line-height: 1;
          color: var(--md-sys-color-on-surface);
          font-variant-numeric: tabular-nums;
        }
        .bar-race-total {
          font-family: var(--md-sys-typescale-body-medium-font-family, system-ui);
          font-size: 14px;
          color: var(--md-sys-color-on-surface-variant);
        }
      </style>
      <div style="max-width: 820px;">
        <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:4px;">
          <span class="bar-race-year" ${ref((el) => (yearEl = el as HTMLElement))}>${FIRST}</span>
          <span class="bar-race-total" ${ref((el) => (totalEl = el as HTMLElement))}></span>
        </div>
        <md-bar-chart
          style="height: 420px;"
          locale=${globals.locale}
          layout="horizontal"
          no-animation
          label=${t(globals.locale, 'barChart.raceTitle')}
          subtitle=${t(globals.locale, 'barChart.raceSource')}
          legend="none"
          corner-radius="4"
          show-labels
          category-gap="24%"
          .valueFormatter=${(v: number | null | undefined) => (typeof v === 'number' ? String(Math.round(v)) : '')}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (chartEl) apply();
          })}
        ></md-bar-chart>
        <div style="display:flex; align-items:center; gap:16px; margin-top:12px;">
          <md-icon-button
            class="bar-race-play"
            variant="filled"
            shape="round"
            icon="play_arrow"
            aria-label=${t(globals.locale, 'barChart.racePlay')}
            ${ref((el) => (btnEl = el as typeof btnEl))}
            @click=${() => (raf ? stop() : play())}
          ></md-icon-button>
          <md-slider
            min=${FIRST}
            max=${LAST}
            step="0.1"
            .value=${progress}
            style="flex:1;"
            aria-label=${t(globals.locale, 'barChart.raceProgress')}
            ${ref((el) => (sliderEl = el as typeof sliderEl))}
            @mdDragStart=${() => {
              dragging = true;
              stop();
            }}
            @mdDragEnd=${() => {
              dragging = false;
            }}
            @mdInput=${(e: Event) => {
              progress = Number((e.target as HTMLInputElement).value);
              apply();
            }}
          ></md-slider>
        </div>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Stacked and grouped columns** — two stacks per category, side by side. Each
 * series names the stack it belongs to with `stack`, and series sharing a name
 * pile up while different names take their own slot in the category band.
 *
 * This is the shape for "compare the composition of two things across the same
 * categories": one stack is the whole of one group, the neighbouring stack the
 * whole of another, and the segments inside each say what it is made of. A
 * plain stack would merge the two into one column and lose the comparison; a
 * plain group would draw four bars per category and lose the totals.
 *
 * `stack` only means anything when the chart is stacked — grouped mode already
 * gives every series its own bar, so a group name has nothing to gather.
 */
export const StackedAndGrouped: Story = {
  args: { stack: 'normal' },
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        style="height: 420px;"
        locale=${globals.locale}
        stack="normal"
        label=${t(globals.locale, 'barChart.fruitTitle')}
        legend="bottom"
        corner-radius="4"
        .series=${[
          { label: t(globals.locale, 'barChart.john'), stack: 'male', data: [5, 3, 4, 7, 2] },
          { label: t(globals.locale, 'barChart.joe'), stack: 'male', data: [3, 4, 4, 2, 5] },
          { label: t(globals.locale, 'barChart.jane'), stack: 'female', data: [2, 5, 6, 2, 1] },
          { label: t(globals.locale, 'barChart.janet'), stack: 'female', data: [3, 0, 4, 4, 3] },
        ]}
        .xAxis=${{
          data: [
            t(globals.locale, 'barChart.apples'),
            t(globals.locale, 'barChart.oranges'),
            t(globals.locale, 'barChart.pears'),
            t(globals.locale, 'barChart.grapes'),
            t(globals.locale, 'barChart.bananas'),
          ],
        }}
        .yAxis=${{ label: t(globals.locale, 'barChart.fruitAxis') }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/** Localised short month names — an Intl-computed value, so it takes the locale
 *  rather than a dictionary entry per month per language. */
const shortMonths = (locale: string | undefined) => {
  const fmt = new Intl.DateTimeFormat(locale || undefined, { month: 'short' });
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2023, m, 1))));
};

/**
 * **Column range** — bars that FLOAT between two values instead of growing from
 * the baseline. A series fills `range` with `[low, high]` pairs rather than
 * `data`, which is what a min/max, a confidence interval, or a working day
 * measured from start to finish actually is.
 *
 * Both ends are free, so both are rounded and — with `show-labels` — both are
 * printed; the tooltip reports `low – high` rather than a single number. A
 * range never joins a stack: its low edge is a real reading, and stacking it
 * onto a cumulative baseline would move it somewhere nobody measured.
 *
 * `range` is a separate field from `data` rather than a shape `data` accepts,
 * because `[low, high]` and an `[x, y]` point are indistinguishable at runtime.
 */
export const ColumnRange: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 760px;">
      <md-bar-chart
        style="height: 460px;"
        locale=${globals.locale}
        layout="horizontal"
        label=${t(globals.locale, 'barChart.tempTitle')}
        subtitle=${t(globals.locale, 'barChart.tempSource')}
        legend="none"
        corner-radius="999"
        show-labels
        .series=${[
          {
            label: t(globals.locale, 'barChart.tempRange'),
            range: [
              [-9.7, 9.4],
              [-8.7, 6.5],
              [-3.5, 9.4],
              [-1.4, 19.9],
              [0.0, 22.6],
              [2.9, 29.5],
              [9.2, 30.7],
              [7.3, 26.5],
              [4.4, 18.0],
              [-3.1, 11.4],
              [-5.2, 10.4],
              [-13.5, 9.8],
            ],
          },
        ]}
        .xAxis=${{ data: shortMonths(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'barChart.tempAxis') }}
        .valueFormatter=${(v: number | null | undefined) =>
          typeof v === 'number' ? `${v.toLocaleString(globals.locale, { maximumFractionDigits: 1 })}°` : ''}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- variwide ------------------------------------------------
 * Labour cost per hour against the size of the economy it is paid in.
 * Approximate Eurostat 2016 figures; GDP in billions of euro. */
const LABOUR = [
  { key: 'barChart.norway', cost: 50.2, gdp: 335 },
  { key: 'barChart.denmark', cost: 42.5, gdp: 277 },
  { key: 'barChart.belgium', cost: 39.2, gdp: 424 },
  { key: 'barChart.sweden', cost: 38.0, gdp: 466 },
  { key: 'barChart.france', cost: 35.6, gdp: 2229 },
  { key: 'barChart.germany', cost: 33.0, gdp: 3134 },
  { key: 'barChart.italy', cost: 27.8, gdp: 1681 },
  { key: 'barChart.uk', cost: 26.7, gdp: 2395 },
  { key: 'barChart.spain', cost: 21.3, gdp: 1114 },
  { key: 'barChart.poland', cost: 8.6, gdp: 426 },
];

/**
 * **Variwide columns** — the column's WIDTH carries a second variable. Height is
 * the labour cost per hour; width is the size of the economy paying it, so the
 * AREA of each column is roughly what that country spends on an hour of work.
 *
 * `pointWidths` gives each datum a relative weight and the category bands take
 * shares of the axis in proportion — weight `2` gets twice the room of weight
 * `1`, and a datum without one gets `1`. A category band belongs to the axis
 * rather than to any one series, so the first series that supplies weights sets
 * them for the whole chart.
 *
 * The category labels are laid out per band, so a narrow column gets a narrow
 * slot — with a GDP ratio of more than ten to one, the small economies' names
 * have a few pixels each. `xAxis.labelRotation` tilts them out of each other's
 * way; left upright they would be truncated to fit their own band instead.
 */
export const Variwide: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 820px;">
      <md-bar-chart
        style="height: 440px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'barChart.variwideTitle')}
        subtitle=${t(globals.locale, 'barChart.variwideSub')}
        legend="none"
        corner-radius="4"
        category-gap="12%"
        .series=${[
          {
            label: t(globals.locale, 'barChart.variwideAxis'),
            data: LABOUR.map((c) => c.cost),
            pointWidths: Object.fromEntries(LABOUR.map((c, i) => [i, c.gdp])),
          },
        ]}
        .xAxis=${{ data: LABOUR.map((c) => t(globals.locale, c.key)), labelRotation: -45 }}
        .yAxis=${{ label: t(globals.locale, 'barChart.variwideAxis') }}
        .valueFormatter=${(v: number | null | undefined) =>
          typeof v === 'number' ? `€${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : ''}
        .tooltipRenderer=${(ctx: { dataIndex: number; axisLabel: string; series: { formattedValue: string }[] }) => {
          const row = LABOUR[ctx.dataIndex];
          if (!row) return undefined;
          const el = document.createElement('div');
          const head = document.createElement('strong');
          head.textContent = ctx.axisLabel;
          const body = document.createElement('div');
          body.textContent = `${ctx.series[0]?.formattedValue ?? ''} · ${t(globals.locale, 'barChart.gdp')} €${row.gdp.toLocaleString(globals.locale)}bn`;
          el.append(head, body);
          return el;
        }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- negative values -----------------------------------------
 * Approximate general-government balance as a share of GDP, 2023. */
const BALANCE = [
  { key: 'barChart.norway', value: 16.4 },
  { key: 'barChart.denmark', value: 3.3 },
  { key: 'barChart.ireland', value: 1.7 },
  { key: 'barChart.netherlands', value: -0.3 },
  { key: 'barChart.germany', value: -2.5 },
  { key: 'barChart.spain', value: -3.6 },
  { key: 'barChart.france', value: -5.5 },
  { key: 'barChart.uk', value: -6.0 },
  { key: 'barChart.italy', value: -7.2 },
];

/**
 * **Columns crossing zero** — negative values grow DOWN from the baseline, and
 * the rounded cap follows: it stays on the free end, which for a deficit is the
 * bottom. The axis includes zero whether or not the data does, so the sign of
 * every column is read against the same line.
 *
 * `pointColors` does the other half of the work. Sign is the whole point of
 * this chart, so surplus and deficit are tinted apart rather than left as one
 * series colour with the reader tracing each bar back to the axis.
 *
 * With `show-labels`, the value below a negative column shares the gutter with
 * the category names, so the axis reserves the label's row and steps the names
 * below it.
 */
export const NegativeValues: Story = {
  args: { showLabels: true },
  render: (_args, { globals }) => html`
    <div style="max-width: 900px;">
      <md-bar-chart
        style="height: 440px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'barChart.balanceTitle')}
        subtitle=${t(globals.locale, 'barChart.balanceSub')}
        legend="none"
        show-labels
        corner-radius="6"
        .series=${[
          {
            label: t(globals.locale, 'barChart.balanceAxis'),
            data: BALANCE.map((c) => c.value),
            pointColors: Object.fromEntries(
              // primary vs error, not tertiary vs error: in this palette tertiary
              // and error are both pinks, and sign is the whole point here.
              BALANCE.map((c, i) => [i, c.value >= 0 ? 'primary' : 'error']),
            ),
          },
        ]}
        .xAxis=${{ data: BALANCE.map((c) => t(globals.locale, c.key)) }}
        .yAxis=${{ label: t(globals.locale, 'barChart.balanceAxis') }}
        .valueFormatter=${(v: number | null | undefined) =>
          typeof v === 'number'
            ? `${v > 0 ? '+' : ''}${v.toLocaleString(globals.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
            : ''}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Stacked columns with segment and total labels** — the two labels a stack
 * needs, and they need different treatments.
 *
 * `show-labels` on a stacked chart puts each segment's value INSIDE its own
 * segment: every segment but the outermost is boxed in by its neighbours, so
 * there is no free end to hang a label off. The label takes whichever of black
 * or white reads on that segment's fill, and is dropped where the segment is
 * too small to hold it rather than spilling over the ones either side.
 *
 * `show-totals` prints the column's sum past its free end. It reads off the
 * drawn bands rather than re-summing the data, so toggling a series off in the
 * legend takes it out of the total too.
 */
export const StackedWithTotals: Story = {
  args: { stack: 'normal', showLabels: true },
  render: (_args, { globals }) => html`
    <div style="max-width: 780px;">
      <md-bar-chart
        style="height: 460px;"
        locale=${globals.locale}
        stack="normal"
        show-labels
        show-totals
        label=${t(globals.locale, 'barChart.medalTitle')}
        subtitle=${t(globals.locale, 'barChart.medalSub')}
        legend="bottom"
        corner-radius="4"
        .series=${[
          { label: t(globals.locale, 'barChart.gold'), color: '#e0b400', data: [1061, 440, 285, 285, 262] },
          { label: t(globals.locale, 'barChart.silver'), color: '#b6b8bd', data: [837, 357, 313, 316, 199] },
          { label: t(globals.locale, 'barChart.bronze'), color: '#c07f4a', data: [738, 325, 344, 309, 173] },
        ]}
        .xAxis=${{
          data: [
            t(globals.locale, 'barChart.usa'),
            t(globals.locale, 'barChart.sovietUnion'),
            t(globals.locale, 'barChart.germany'),
            t(globals.locale, 'barChart.greatBritain'),
            t(globals.locale, 'barChart.china'),
          ],
        }}
        .yAxis=${{ label: t(globals.locale, 'barChart.medals') }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Percentage-stacked columns** — `stack="percentage"` normalises every column
 * to 100, so the chart answers "what is this made OF" rather than "how much of
 * it is there". The columns are all the same height by construction; only the
 * composition moves.
 *
 * The values fed in are raw passenger-kilometres. The chart does the
 * normalising, so the segment labels and the tooltip both read the share, and
 * the underlying figures stay in the data for a consumer that wants them.
 * `show-totals` is deliberately off: a percentage column's total is always 100.
 */
export const PercentageStacked: Story = {
  args: { stack: 'percentage', showLabels: true },
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-bar-chart
        style="height: 460px;"
        locale=${globals.locale}
        stack="percentage"
        show-labels
        label=${t(globals.locale, 'barChart.transportTitle')}
        subtitle=${t(globals.locale, 'barChart.transportSource')}
        title-align="center"
        legend="bottom"
        corner-radius="2"
        category-gap="45%"
        .series=${[
          { label: t(globals.locale, 'barChart.sea'), color: '#f08050', data: [4200, 4200, 4800] },
          { label: t(globals.locale, 'barChart.air'), color: '#e8d84a', data: [1200, 600, 1200] },
          { label: t(globals.locale, 'barChart.rail'), color: '#63d97e', data: [21000, 19200, 18000] },
          { label: t(globals.locale, 'barChart.road'), color: '#5fa8f5', data: [33600, 36000, 36000] },
        ]}
        .xAxis=${{ data: ['2019', '2020', '2021'] }}
        .yAxis=${{ label: t(globals.locale, 'barChart.percent') }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Stacked bars** — the same stack turned on its side, which is what survey
 * results want: the statements being rated are sentences, and sentences need
 * the long axis to sit on.
 *
 * Percentage stacking makes the rows comparable when the response counts
 * differ, and the segment labels are printed inside their own bands. The
 * middle categories carry no free end at all, so an inside label is the only
 * place a value can go.
 */
export const StackedBar: Story = {
  args: { layout: 'horizontal', stack: 'percentage', showLabels: true },
  render: (_args, { globals }) => html`
    <div style="max-width: 860px;">
      <md-bar-chart
        style="height: 400px;"
        locale=${globals.locale}
        layout="horizontal"
        stack="percentage"
        show-labels
        label=${t(globals.locale, 'barChart.surveyTitle')}
        subtitle=${t(globals.locale, 'barChart.surveySub')}
        legend="bottom"
        corner-radius="4"
        .series=${[
          { label: t(globals.locale, 'barChart.stronglyAgree'), color: '#2e7d5b', data: [38, 22, 41, 46] },
          { label: t(globals.locale, 'barChart.agree'), color: '#63d97e', data: [34, 31, 30, 29] },
          { label: t(globals.locale, 'barChart.neutral'), color: '#b6b8bd', data: [15, 24, 17, 16] },
          { label: t(globals.locale, 'barChart.disagree'), color: '#f0a05a', data: [9, 15, 8, 6] },
          { label: t(globals.locale, 'barChart.stronglyDisagree'), color: '#e05252', data: [4, 8, 4, 3] },
        ]}
        .xAxis=${{
          data: [
            t(globals.locale, 'barChart.qDocs'),
            t(globals.locale, 'barChart.qMigration'),
            t(globals.locale, 'barChart.qPerf'),
            t(globals.locale, 'barChart.qRecommend'),
          ],
        }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Rotated category labels** — `xAxis.labelRotation` tilts the names when there
 * are too many, or they are too long, to sit upright without colliding.
 *
 * A negative angle leans the text up to the right and puts its END under the
 * tick, which is the convention: the eye follows the label back to the column
 * it belongs to. The axis row grows to hold the tilted text's vertical reach,
 * so nothing is clipped at the bottom of the plot.
 *
 * Left upright, a label wider than its own band is truncated with an ellipsis
 * instead — better than two names printed over each other, but rotation is
 * better than both when the names matter.
 */
export const RotatedLabels: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 760px;">
      <md-bar-chart
        style="height: 440px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'barChart.citiesTitle')}
        subtitle=${t(globals.locale, 'barChart.citiesSub')}
        legend="none"
        corner-radius="6"
        .series=${[
          {
            label: t(globals.locale, 'barChart.population'),
            data: [37.33, 31.18, 27.79, 22.24, 21.92, 21.74, 21.32, 20.89, 20.67, 19.11],
          },
        ]}
        .xAxis=${{
          labelRotation: -45,
          data: [
            t(globals.locale, 'barChart.tokyo'),
            t(globals.locale, 'barChart.delhi'),
            t(globals.locale, 'barChart.shanghai'),
            t(globals.locale, 'barChart.saoPaulo'),
            t(globals.locale, 'barChart.mexicoCity'),
            t(globals.locale, 'barChart.dhaka'),
            t(globals.locale, 'barChart.cairo'),
            t(globals.locale, 'barChart.beijing'),
            t(globals.locale, 'barChart.mumbai'),
            t(globals.locale, 'barChart.osaka'),
          ],
        }}
        .yAxis=${{ label: t(globals.locale, 'barChart.population') }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- drill-down ----------------------------------------------
 * Population in millions, 2023 estimates. Keyed by i18n key rather than by
 * label so a trail built in one locale still resolves after a locale change. */
type DrillNode = { key: string; value: number; children?: DrillNode[] };
const POPULATION_TREE: DrillNode[] = [
  {
    key: 'barChart.asia',
    value: 4753,
    children: [
      { key: 'barChart.india', value: 1429 },
      { key: 'barChart.china', value: 1411 },
      { key: 'barChart.indonesia', value: 278 },
      { key: 'barChart.pakistan', value: 240 },
      { key: 'barChart.japan', value: 125 },
    ],
  },
  {
    key: 'barChart.africa',
    value: 1460,
    children: [
      { key: 'barChart.nigeria', value: 224 },
      { key: 'barChart.ethiopia', value: 127 },
      { key: 'barChart.egypt', value: 113 },
    ],
  },
  {
    key: 'barChart.americas',
    value: 1040,
    children: [
      { key: 'barChart.usa', value: 335 },
      { key: 'barChart.brazil', value: 216 },
      { key: 'barChart.mexico', value: 129 },
      { key: 'barChart.argentina', value: 46 },
    ],
  },
  {
    key: 'barChart.europe',
    value: 742,
    children: [
      { key: 'barChart.russia', value: 144 },
      { key: 'barChart.germany', value: 84 },
      { key: 'barChart.uk', value: 68 },
      { key: 'barChart.france', value: 68 },
      { key: 'barChart.italy', value: 59 },
      { key: 'barChart.spain', value: 48 },
    ],
  },
];

/**
 * **Drill-down** — click a column to break it into its parts, and use the
 * breadcrumb trail to come back out.
 *
 * `drill(index)` arms the NEXT data change to animate as a descent: the
 * incoming columns unfold out of the band the clicked column occupies right
 * now, so the two levels read as connected rather than as unrelated charts.
 * `drill(index, 'up')` pivots on the whole plot instead, which is the same
 * motion run inside out.
 *
 * It has to be AWAITED. Like every Stencil `@Method` it resolves through a
 * microtask, so a bare call would land after the assignment on the next line —
 * the swap would render un-animated and the drill would arm itself for whatever
 * change came after.
 *
 * The trail is a real `md-breadcrumbs`, so the whole path stays reachable
 * rather than only the step immediately above. The path is held as i18n KEYS,
 * not as the rendered labels, so switching locale mid-drill doesn't strand it.
 */
export const DrillDown: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => {
    let path: string[] = [];
    let chartEl:
      | (HTMLElement & { series: unknown; xAxis: unknown; clickable: boolean; drill(i: number, d?: 'down' | 'up'): Promise<void> })
      | undefined;
    let trailEl: HTMLElement | undefined;

    const levelAt = (p: string[]) => {
      let items = POPULATION_TREE;
      for (const step of p) items = items.find((d) => d.key === step)?.children ?? [];
      return items;
    };

    const apply = () => {
      if (!chartEl) return;
      const level = levelAt(path);
      chartEl.xAxis = { data: level.map((d) => t(globals.locale, d.key)) };
      chartEl.series = [{ label: t(globals.locale, 'barChart.popAxis'), data: level.map((d) => d.value) }];
      // Hand cursor only while a bar can actually drill — the continents drill in,
      // the countries are leaves, so the cursor goes back to default down there.
      chartEl.clickable = level.some((d) => !!d.children?.length);
      if (!trailEl) return;
      const crumbs = [t(globals.locale, 'barChart.allRegions'), ...path.map((k) => t(globals.locale, k))];
      trailEl.innerHTML = crumbs
        .map(
          (label, i) =>
            `<md-breadcrumb-item href="#" ${i === crumbs.length - 1 ? 'current' : ''}>${label}</md-breadcrumb-item>`,
        )
        .join('');
    };

    /** Descend into column `i` of the level on screen. */
    const down = async (i: number) => {
      const here = levelAt(path)[i];
      // A leaf click should do nothing, not empty the chart.
      if (!here?.children?.length) return;
      await chartEl?.drill(i, 'down');
      path = [...path, here.key];
      apply();
    };

    /** Climb back to `depth` steps from the root. */
    const upTo = async (depth: number) => {
      if (depth >= path.length) return;
      await chartEl?.drill(0, 'up');
      path = path.slice(0, depth);
      apply();
    };

    return html`
      <div style="max-width: 780px;">
        <md-breadcrumbs
          separator="›"
          aria-label=${t(globals.locale, 'barChart.drillTrail')}
          style="display:block; margin-bottom:8px; min-height:32px;"
          ${ref((el) => {
            trailEl = el as HTMLElement;
          })}
          @mdSelect=${(e: CustomEvent<{ itemIndex: number }>) => {
            // In-chart navigation, not URLs — stop the <a>.
            e.preventDefault();
            upTo(e.detail.itemIndex);
          }}
        ></md-breadcrumbs>
        <md-bar-chart
          style="height: 420px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'barChart.drillTitle')}
          subtitle=${t(globals.locale, 'barChart.drillSub')}
          legend="none"
          corner-radius="6"
          show-labels
          .yAxis=${{ label: t(globals.locale, 'barChart.popAxis') }}
          @mdBarClick=${(e: CustomEvent<{ dataIndex: number }>) => down(e.detail.dataIndex)}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/* --- population pyramid --------------------------------------
 * Andorra, 2023, as a share of the total population. Male values are fed in
 * NEGATIVE so they stack out to the left of zero; the axis and the tooltip
 * both strip the sign again. */
const PYRAMID_AGES = ['0–4', '5–9', '10–14', '15–19', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65–69', '70–74', '75–79', '80–84', '85+'];
const PYRAMID_MALE = [-1.3, -2.0, -2.4, -2.3, -2.9, -3.6, -4.0, -3.9, -4.1, -4.5, -4.4, -4.2, -3.4, -2.8, -2.1, -1.6, -1.0, -0.8];
const PYRAMID_FEMALE = [1.4, 2.0, 2.5, 2.4, 2.7, 3.1, 3.6, 3.6, 4.0, 4.4, 4.2, 3.9, 3.3, 2.5, 1.9, 1.4, 1.0, 1.1];

/**
 * **Population pyramid** — a stacked bar with one series fed in NEGATIVE, so the
 * two halves grow out of a shared centre line in opposite directions. Nothing
 * special is needed to mirror them: a stack puts positives to one side of zero
 * and negatives to the other, which is exactly what a pyramid is.
 *
 * The sign is a drawing device, not a reading. `yAxis.valueFormatter` strips it
 * off the ticks so the left half is labelled `4%` rather than `-4%`, and the
 * chart's own `valueFormatter` does the same for the tooltip and the
 * screen-reader table — nobody should be told there are minus four percent men.
 *
 * `xAxis.mirrorLabels` repeats the age bands down the right-hand side. With
 * eighteen rows running out in both directions, a name on one side only is a
 * long way from half the data it names.
 */
export const PopulationPyramid: Story = {
  args: { layout: 'horizontal', stack: 'normal' },
  render: (_args, { globals }) => {
    const pct = (v: number | null | undefined) =>
      typeof v === 'number'
        ? `${Math.abs(v).toLocaleString(globals.locale, { maximumFractionDigits: 1 })}%`
        : '';
    return html`
      <div style="max-width: 900px;">
        <md-bar-chart
          style="height: 560px;"
          locale=${globals.locale}
          layout="horizontal"
          stack="normal"
          label=${t(globals.locale, 'barChart.pyramidTitle')}
          subtitle=${t(globals.locale, 'barChart.pyramidSource')}
          title-align="center"
          legend="bottom"
          corner-radius="999"
          category-gap="35%"
          .series=${[
            { label: t(globals.locale, 'barChart.male'), color: '#5fa8f5', data: PYRAMID_MALE },
            { label: t(globals.locale, 'barChart.female'), color: '#2ee06a', data: PYRAMID_FEMALE },
          ]}
          .xAxis=${{ data: PYRAMID_AGES, label: t(globals.locale, 'barChart.ageGroup'), mirrorLabels: true }}
          .yAxis=${{ label: t(globals.locale, 'barChart.pyramidAxis'), valueFormatter: pct }}
          .valueFormatter=${pct}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Fixed placement and a second axis** — two quantities that share a category
 * axis but no scale, drawn one in front of the other rather than beside it.
 *
 * `yAxis2` adds a value axis in the opposite gutter, and a series says which
 * scale it is measured against with `yAxisIndex`. The second axis draws no
 * gridlines of its own: two sets at two spacings turn the plot into a mesh
 * nobody can read a value off, so one axis owns the grid and the other only
 * labels its own edge.
 *
 * `overlay` takes the temperature series out of the group slotting and centres
 * it ON the band at `widthRatio` of it — a narrow column in FRONT of the wide
 * one, instead of the two standing side by side. That is what makes the pair
 * read as two readings of the same month rather than as two separate months.
 */
export const FixedPlacement: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 820px;">
      <md-bar-chart
        style="height: 440px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'barChart.climateTitle')}
        subtitle=${t(globals.locale, 'barChart.climateSub')}
        legend="bottom"
        corner-radius="4"
        category-gap="34%"
        .series=${[
          {
            label: t(globals.locale, 'barChart.rainfall'),
            color: '#5fa8f5',
            data: [49, 36, 47, 41, 53, 65, 81, 89, 90, 84, 73, 55],
          },
          {
            label: t(globals.locale, 'barChart.temperature'),
            color: '#f0a05a',
            yAxisIndex: 1,
            overlay: true,
            widthRatio: 0.34,
            // Oslo dips below 0° in winter. The engine zero-aligns the two value
            // axes, so both series share one baseline and the negative months open
            // a below-zero band inside the plot — rather than the temperature zero
            // floating up the plot or the negatives dangling off the bottom.
            data: [-4.3, -4.0, -0.2, 4.5, 10.8, 15.2, 16.4, 15.2, 10.8, 6.3, 0.7, -3.0],
          },
        ]}
        .xAxis=${{ data: shortMonths(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'barChart.rainfall') }}
        .yAxis2=${{
          label: t(globals.locale, 'barChart.temperature'),
          valueFormatter: (v: number) => `${v}°`,
        }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- comparison ----------------------------------------------
 * Global renewable electricity generation, TWh. Approximate IRENA / Ember
 * figures, rounded. 2015 is the fixed baseline every year is set against. */
const RENEWABLE_KEYS = ['barChart.hydro', 'barChart.wind', 'barChart.solar', 'barChart.bioenergy', 'barChart.geothermal'];
const RENEWABLE_BY_YEAR: Record<string, number[]> = {
  '2015': [3900, 830, 250, 470, 80],
  '2018': [4200, 1270, 570, 550, 88],
  '2021': [4300, 1860, 1030, 640, 95],
  '2024': [4450, 2500, 2100, 700, 100],
};
const COMPARE_BASELINE = '2015';

/**
 * **Column comparison** — one year in front of a fixed baseline, with a
 * switcher to change which year that is.
 *
 * The baseline is a wide, translucent column drawn in the slot; the selected
 * year is a narrower `overlay` column centred in front of it. Overlaying rather
 * than pairing is what makes this read as a comparison: the two columns share a
 * left edge and a centre line, so the eye measures the difference between them
 * instead of comparing two neighbours that happen to be adjacent.
 *
 * Only the series change when the year is switched — the categories, the axis
 * and the baseline stay put, so the ghost column is the same height throughout
 * and the movement on screen is only ever the thing being compared.
 */
export const ColumnComparison: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => {
    const years = Object.keys(RENEWABLE_BY_YEAR).filter((y) => y !== COMPARE_BASELINE);
    let year = years[years.length - 1];
    let chartEl: (HTMLElement & { series: unknown }) | undefined;

    const apply = () => {
      if (!chartEl) return;
      chartEl.series = [
        {
          label: COMPARE_BASELINE,
          // Translucent so the front column reads through it — this one is a
          // reference mark, not a reading competing for attention.
          color: 'rgba(190, 180, 255, 0.28)',
          data: RENEWABLE_BY_YEAR[COMPARE_BASELINE],
        },
        {
          label: year,
          color: '#b9a7ff',
          overlay: true,
          widthRatio: 0.5,
          data: RENEWABLE_BY_YEAR[year],
        },
      ];
    };

    return html`
      <div style="max-width: 780px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <md-segmented-button-set
            aria-label=${t(globals.locale, 'barChart.compareYear')}
            @mdChange=${(e: CustomEvent<string[]>) => {
              year = e.detail[0] ?? year;
              apply();
            }}
          >
            ${years.map(
              (y) =>
                html`<md-segmented-button value=${y} label=${y} ?selected=${y === year}></md-segmented-button>`,
            )}
          </md-segmented-button-set>
        </div>
        <md-bar-chart
          style="height: 420px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'barChart.compareTitle')}
          subtitle=${t(globals.locale, 'barChart.compareSub').replace('%b%', COMPARE_BASELINE)}
          legend="top-end"
          corner-radius="6"
          category-gap="30%"
          .xAxis=${{ data: RENEWABLE_KEYS.map((k) => t(globals.locale, k)) }}
          .yAxis=${{ label: t(globals.locale, 'barChart.twh') }}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/* --- force chart ---------------------------------------------
 * Illustrative only: the figures broadly show which forces dominate a Mars
 * entry, descent and landing, not their real magnitudes. Negatives decelerate
 * the spacecraft, positives accelerate it. */
const MARS_FORCES = [
  { key: 'barChart.forceHeatShield', value: -1 },
  { key: 'barChart.forceRetro', value: -0.5 },
  { key: 'barChart.forceChute', value: -7 },
  { key: 'barChart.forceDrag', value: -9 },
  { key: 'barChart.forcePowered', value: -1.5 },
  { key: 'barChart.forceEntry', value: 15 },
  { key: 'barChart.forceGravity', value: 3 },
];

/**
 * **Force chart** — one stacked bar whose segments are contributions handed
 * along in a direction, negatives to the left of zero and positives to the
 * right. `chevron` draws each segment as an arrow: the leading edge comes to a
 * point and the trailing edge is cut with the matching notch, so the chain
 * interlocks and the whole bar reads as a flow rather than as quantities that
 * happen to be touching.
 *
 * The stack does the mirroring for free — a negative grows one way from the
 * baseline and a positive the other — so the two halves meet at zero without
 * anything being told where to sit.
 *
 * The bar is deliberately thick and the category gap nearly closed: with a
 * single row there is no neighbour to separate from, and a tall segment is what
 * gives the in-segment values somewhere to be printed.
 */
export const ForceChart: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => {
    const total = (sign: number) =>
      MARS_FORCES.filter((f) => Math.sign(f.value) === sign).reduce((n, f) => n + f.value, 0);
    return html`
      <style>
        .force-ends {
          display: flex;
          justify-content: space-between;
          font-family: var(--md-sys-typescale-title-medium-font-family, system-ui);
          font-size: 20px;
          font-weight: 700;
          line-height: 1.5;
          color: var(--md-sys-color-on-surface);
          padding: 4px 8px 0;
        }
      </style>
      <div style="max-width: 900px;">
        <div class="force-ends">
          <span>${t(globals.locale, 'barChart.forceMin')}: ${total(-1)}</span>
          <span>${t(globals.locale, 'barChart.forceMax')}: ${total(1)}</span>
        </div>
        <md-bar-chart
          style="height: 170px;"
          locale=${globals.locale}
          layout="horizontal"
          stack="normal"
          chevron
          tooltip="item"
          show-labels
          label=${t(globals.locale, 'barChart.forceTitle')}
          subtitle=${t(globals.locale, 'barChart.forceSub')}
          title-align="center"
          legend="bottom"
          category-gap="44%"
          .series=${MARS_FORCES.map((f) => ({
            label: t(globals.locale, f.key),
            color: f.value < 0 ? '#1668ff' : '#f4245e',
            data: [f.value],
          }))}
          .xAxis=${{ data: [t(globals.locale, 'barChart.force')], hidden: true, axisLine: false }}
          .yAxis=${{ hideTicks: true, axisLine: false }}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Radial bars** — `polar` wraps the bars around a circle: one concentric ring
 * per category, with the value axis running as an ANGLE instead of a length.
 *
 * Only the step from a value to geometry changes. Stacking still stacks,
 * hiding a series from the legend still takes it out, percentage normalisation
 * still normalises — a band that would have become a pair of pixels becomes a
 * pair of angles, and the category index picks a radius rather than a position
 * along an axis.
 *
 * The value axis spans `polar-sweep` of the circle rather than all of it: a ring
 * that closes on itself has no readable start or end, and the quarter it gives
 * up is where the category names go. `polar-hole` sets the size of the hole at
 * the centre.
 *
 * Hover resolves by DISTANCE from the centre, which is exactly which ring the
 * pointer is over. There is no crosshair: a straight line across a radial plot
 * crosses every ring at an angle that means nothing.
 */
export const RadialBars: Story = {
  args: { stack: 'normal' },
  render: (_args, { globals }) => html`
    <div style="max-width: 620px;">
      <md-bar-chart
        style="height: 540px;"
        locale=${globals.locale}
        polar
        stack="normal"
        polar-hole="0.24"
        polar-sweep="0.78"
        corner-radius="4"
        category-gap="26%"
        label=${t(globals.locale, 'barChart.radialTitle')}
        subtitle=${t(globals.locale, 'barChart.radialSub')}
        legend="bottom"
        .series=${[
          { label: t(globals.locale, 'barChart.gold'), color: '#e0b400', data: [1061, 440, 285, 285, 262] },
          { label: t(globals.locale, 'barChart.silver'), color: '#b6b8bd', data: [837, 357, 313, 316, 199] },
          { label: t(globals.locale, 'barChart.bronze'), color: '#c07f4a', data: [738, 325, 344, 309, 173] },
        ]}
        .xAxis=${{
          data: [
            t(globals.locale, 'barChart.usa'),
            t(globals.locale, 'barChart.sovietUnion'),
            t(globals.locale, 'barChart.germany'),
            t(globals.locale, 'barChart.greatBritain'),
            t(globals.locale, 'barChart.china'),
          ],
        }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * A value-axis BREAK cuts a discontinuity into the scale so a runaway outlier
 * doesn't flatten every other bar to nothing. `yAxis.breaks: 'auto'` finds the
 * gap itself; the axis line is interrupted with a zigzag, a bar crossing the cut
 * is split, and ticks inside the removed range are dropped. Works on a
 * horizontal chart too (the value axis is the bottom one there).
 */
export const AxisBreaks: Story = {
  render: () => html`
    <div style="max-width: 640px;">
      <md-bar-chart
        label="Budget by department"
        subtitle="An axis break keeps the small departments readable next to the outlier"
        show-labels
        corner-radius="6"
        .series=${[{ label: 'Spend ($k)', color: '#6750A4', data: [42, 55, 38, 1200, 61, 47] }]}
        .xAxis=${{ data: ['Design', 'Eng', 'Sales', 'Infra', 'Support', 'Ops'] }}
        .yAxis=${{ label: 'Spend ($k)', breaks: 'auto' }}
      ></md-bar-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * `zoom` turns the chart into a *view* over a long category range without
 * touching the data. `both` gives the drag-to-zoom gesture (drag horizontally
 * across the plot, double-click to reset) AND a range slider under the plot —
 * drag its thumbs to resize the window, or the grip between them to pan it.
 * Hover / click / keyboard still report ABSOLUTE indices. (Use `inside` or
 * `slider` for just one of the two affordances.)
 */
export const Zoom: Story = {
  render: () => {
    const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const data = Array.from({ length: 30 }, (_, i) => Math.round(70 + 45 * Math.sin(i / 3.2) + (i % 4) * 9));
    return html`
      <div style="max-width: 760px;">
        <md-bar-chart
          label="Daily active users"
          subtitle="Drag across the plot to zoom, or use the slider below — double-click to reset"
          zoom="both"
          corner-radius="4"
          .series=${[{ label: 'DAU', color: '#6750A4', data }]}
          .xAxis=${{ data: days }}
        ></md-bar-chart>
      </div>
    `;
  },
  play: chartPlay(),
};
