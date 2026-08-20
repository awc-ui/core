import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';
import { chartPlay } from '../testing/chart-play';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const trafficSeries = (locale: string | undefined) => [
  { label: t(locale, 'areaChart.direct'), data: [10, 22, 28, 35, 41, 38, 52, 48, 56, 62, 70, 80] },
  { label: t(locale, 'areaChart.organic'), data: [18, 24, 32, 40, 48, 45, 60, 65, 72, 78, 84, 92] },
  { label: t(locale, 'areaChart.paid'), data: [8, 12, 14, 22, 30, 28, 36, 42, 48, 52, 58, 64] },
];

const meta: Meta = {
  title: 'Charts/Area Chart',
  component: 'md-area-chart',
  tags: ['autodocs'],
  // Charts size fluidly to their container width (aspect-ratio driven); the
  // global 'centered' layout shrink-wraps the wrapper to the chart's minimum,
  // rendering it tiny. 'padded' lets the max-width wrappers expand to full width.
  parameters: { layout: 'padded', docs: { source: { language: 'html' } } },
  argTypes: {
    curve: { control: 'select', options: ['linear', 'smooth', 'monotone', 'step', 'step-before', 'step-middle'] },
    stack: { control: 'select', options: ['none', 'normal', 'percentage', 'silhouette', 'wiggle'] },
    legend: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'none'] },
    fillOpacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    showLine: { control: 'boolean' },
    tooltip: { control: 'select', options: ['axis', 'item', 'none'] },
    zoom: { control: 'select', options: ['none', 'inside', 'slider', 'both'] },
    grid: { control: 'select', options: ['none', 'horizontal', 'vertical', 'both'] },
    inverted: { control: 'boolean' },
    seriesLabels: { control: 'boolean' },
    showMarks: { control: 'boolean' },
    lineWidth: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    markSize: { control: { type: 'range', min: 2, max: 12, step: 0.5 } },
    showLabels: { control: 'boolean' },
    connectNulls: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  args: {
    curve: 'smooth',
    stack: 'normal',
    legend: 'top-end',
    fillOpacity: 0.55,
    showLine: true,
    tooltip: 'axis',
    zoom: 'none',
    grid: 'horizontal',
    inverted: false,
    seriesLabels: false,
    showMarks: false,
    lineWidth: 2.5,
    markSize: 3.5,
    showLabels: false,
    connectNulls: false,
    loading: false,
  },
};
export default meta;
type Story = StoryObj;

/* --- play() helpers ------------------------------------------
 * testing-library queries can't cross shadow roots, so play()
 * addresses the real host + its public @Method surface directly.
 * The chart renders on the in-house engine (Canvas2D + a DOM
 * text overlay), so play() drives it through real DOM events. */
type AreaChartEl = HTMLElement & {
  label: string;
  stack: string;
  fillOpacity: number;
  curve: string;
  valueFormatter?: (v: number | null) => string;
  heightProp?: string;
  resize: () => Promise<void>;
  toDataURL: () => Promise<string>;
  getInstance: () => Promise<unknown | null>;
};
/** First `md-area-chart` in the canvas — hydrated + with a live engine. */
const getChart = async (
  canvasElement: HTMLElement,
  selector = 'md-area-chart',
): Promise<AreaChartEl> => {
  const el = canvasElement.querySelector(selector) as AreaChartEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  return el;
};

export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-area-chart
        label="${t(globals.locale, 'areaChart.trafficSources')}"
        .series=${trafficSeries(globals.locale)}
        .xAxis=${{ data: months }}
        locale=${globals.locale}
        curve=${args.curve}
        stack=${args.stack}
        legend=${args.legend}
        fill-opacity=${args.fillOpacity}
        .showLine=${args.showLine}
        tooltip=${args.tooltip}
        zoom=${args.zoom}
        grid=${args.grid}
        ?inverted=${args.inverted}
        ?series-labels=${args.seriesLabels}
        ?show-marks=${args.showMarks}
        .lineWidth=${args.lineWidth}
        .markSize=${args.markSize}
        ?show-labels=${args.showLabels}
        ?connect-nulls=${args.connectNulls}
        ?loading=${args.loading}
      ></md-area-chart>
    </div>
  `,
  /** Exercises the public @Method surface, the @Watch reaction, and the
   *  engine-bridged hover / legend event handlers with real payloads. */
  play: async ({ canvasElement, step, args }) => {
    const chart = await getChart(canvasElement);
    const initialLabel = chart.label;
    const plot = () => chart.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    const canvas = () => plot().querySelector('canvas') as HTMLCanvasElement;

    await step('public methods: getInstance / resize / toDataURL', async () => {
      expect(await chart.getInstance()).not.toBeNull();
      await chart.resize();
      expect(await chart.getInstance()).not.toBeNull();
      const url = await chart.toDataURL();
      expect(url.startsWith('data:image/')).toBe(true);
    });

    await step('changing a watched prop re-renders + rebuilds the a11y table', async () => {
      chart.label = 'Reactive area title';
      // onAnyPropChange() -> applyEngine(): the overlay title tracks the prop.
      await waitFor(() => expect(plot().textContent).toContain('Reactive area title'));
      // onAnyPropChange() -> rebuildA11yTable(): SR-only table mirrors the label.
      const a11y = chart.shadowRoot!.querySelector('.md-area-chart__a11y-table');
      await waitFor(() => expect(a11y!.textContent).toContain('Reactive area title'));
    });

    await step('pointer move over the plot fires mdHover with the category index', async () => {
      let hover: { dataIndex: number; axisValue: unknown } | undefined;
      chart.addEventListener('mdHover', (e) => { hover = (e as CustomEvent<{ dataIndex: number; axisValue: unknown }>).detail; }, { once: true });
      const cv = canvas();
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.6, clientY: r.top + r.height * 0.5, bubbles: true }));
      await waitFor(() => expect(hover).toBeTruthy());
      // The handler maps the engine's nearest index back onto the category axis value.
      expect(hover!.dataIndex).toBeGreaterThanOrEqual(0);
      expect(hover!.axisValue).toBe(months[hover!.dataIndex]);
      cv.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    });

    await step('clicking a legend entry toggles the series + fires mdLegendClick', async () => {
      let detail: { seriesIndex: number; selected: boolean } | undefined;
      chart.addEventListener('mdLegendClick', (e) => { detail = (e as CustomEvent<{ seriesIndex: number; selected: boolean }>).detail; }, { once: true });
      const firstChip = () => chart.shadowRoot!.querySelector('[part="legend"] button') as HTMLButtonElement;
      expect(firstChip()).toBeTruthy();
      firstChip().click();
      await waitFor(() => expect(detail).toBeTruthy());
      expect(detail!.seriesIndex).toBe(0);
      expect(typeof detail!.selected).toBe('boolean');
      firstChip().click(); // toggle the series back on
    });

    await step('fillOpacity re-applies the area gradient (area-chart specific)', async () => {
      chart.fillOpacity = 0.8;
      await waitFor(async () => expect(await chart.getInstance()).not.toBeNull());
      const url = await chart.toDataURL();
      expect(url.startsWith('data:image/')).toBe(true);
    });

    await step('stack="percentage" rescales the value axis to a 0..100 % domain', async () => {
      chart.stack = 'percentage';
      // The engine's percentage y-formatter suffixes the axis ticks with '%'.
      await waitFor(() => expect(plot().textContent).toContain('%'));
    });

    await step('streamgraph + step curve reshape the chart without throwing', async () => {
      chart.stack = 'silhouette';
      chart.curve = 'step';
      await waitFor(async () => expect(await chart.getInstance()).not.toBeNull());
    });

    // State-neutral teardown: restore each mutated prop to its initial render
    // value so the visual baseline captured after play() matches a fresh mount.
    await step('reset mutated props so the visual baseline matches the resting render', async () => {
      chart.label = initialLabel;
      chart.stack = args.stack;
      chart.curve = args.curve;
      chart.fillOpacity = args.fillOpacity;
      chart.valueFormatter = undefined;
      chart.heightProp = undefined;
      await waitFor(() => expect(plot().textContent).toContain(initialLabel));
      (document.activeElement as HTMLElement)?.blur();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  },
};

export const StackingModes: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 720px;">
      ${(['none', 'normal', 'percentage', 'silhouette', 'wiggle'] as const).map(
        (stack) => html`
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">stack="${stack}"</p>
            <md-area-chart
              stack=${stack}
              .series=${trafficSeries(globals.locale)}
              .xAxis=${{ data: months }}
              style="--md-area-chart-aspect-ratio: 16 / 6;"
            ></md-area-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay(),
};

export const Streamgraph: Story = {
  render: () => html`
    <div style="max-width: 720px;">
      <md-area-chart
        label="Streamgraph (silhouette)"
        stack="silhouette"
        curve="smooth"
        legend="none"
        .series=${[
          { label: 'A', data: [10, 22, 28, 35, 41, 38, 52, 48, 56, 62, 70, 80], color: 'primary' },
          { label: 'B', data: [18, 24, 32, 40, 48, 45, 60, 65, 72, 78, 84, 92], color: 'tertiary' },
          { label: 'C', data: [8, 12, 14, 22, 30, 28, 36, 42, 48, 52, 58, 64], color: 'secondary' },
          { label: 'D', data: [4, 7, 8, 13, 19, 18, 24, 28, 32, 35, 38, 42], color: 'error' },
        ]}
        .xAxis=${{ data: months, hideTicks: true }}
        .yAxis=${{ hidden: true }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

export const Overlapping: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-area-chart
        label="Translucent overlapping areas"
        stack="none"
        fill-opacity="0.35"
        .series=${trafficSeries(globals.locale)}
        .xAxis=${{ data: months }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface); padding: 16px; border-radius: 16px; max-width: 720px;"
    >
      <md-area-chart
        label="${t(globals.locale, 'areaChart.traffic')}"
        .series=${trafficSeries(globals.locale)}
        .xAxis=${{ data: months }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .surface-card {
        --md-area-chart-background: var(--md-sys-color-surface-container);
        --md-area-chart-padding: 16px;
        --md-area-chart-shape: 16px;
      }
    </style>
    <div style="max-width: 720px;">
      <md-area-chart
        class="surface-card"
        label="Wrapped surface"
        .series=${trafficSeries(globals.locale)}
        .xAxis=${{ data: months }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

export const ColorFormats: Story = {
  render: () => html`
    <div style="max-width: 720px;">
      <md-area-chart
        label="Explicit rgb / rgba / named fill colors"
        stack="none"
        fill-opacity="0.4"
        .series=${[
          { label: 'rgb', data: [10, 22, 28, 35, 41, 38], color: 'rgb(255, 87, 34)' },
          { label: 'rgba', data: [18, 24, 32, 40, 48, 45], color: 'rgba(0, 150, 136, 0.9)' },
          { label: 'named', data: [8, 12, 14, 22, 30, 28], color: 'goldenrod' },
        ]}
        .xAxis=${{ data: months.slice(0, 6) }}
      ></md-area-chart>
    </div>
  `,
  /** Series whose colors are already rgb()/rgba()/named strings — exercises the
   *  gradient colour branches that the default (token palette) path never reaches. */
  play: async ({ canvasElement }) => {
    const chart = await getChart(canvasElement);
    // The engine rendered a live frame from the three explicitly-coloured series.
    expect(await chart.getInstance()).not.toBeNull();
    // All three legend entries landed in the DOM overlay (labels resolved).
    const legend = chart.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    await waitFor(() => expect(legend?.textContent).toContain('rgb'));
    expect(legend.textContent).toContain('rgba');
    expect(legend.textContent).toContain('named');
    // The gradient fills rasterised to a real image (the areaStyle colors resolved).
    const url = await chart.toDataURL();
    expect(url.startsWith('data:image/')).toBe(true);
  },
};

/* --- Nuclear stockpiles ---------------------------------------
 * Warheads held by the two Cold War superpowers, 1945–2025. Real figures
 * from Our World in Data's compilation of the Federation of American Scientists'
 * Nuclear Notebook — the US peaks at 31,255 in 1967, Russia at 40,159 in 1986.
 * Two UNSTACKED areas, so the overlap reads as overlap rather than a total.
 * ----------------------------------------------------------- */
const STOCKPILE_YEARS = [1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const STOCKPILE_US = [2, 9, 13, 50, 170, 299, 438, 841, 1169, 1703, 2422, 3692, 5543, 7345, 12298, 18638, 22229, 25540, 28133, 29463, 31139, 31175, 31255, 29561, 27552, 26008, 25830, 26516, 27835, 28537, 27519, 25914, 25542, 24418, 24138, 24104, 23208, 22886, 23305, 23459, 23368, 23317, 23575, 23205, 22217, 21392, 19008, 13708, 11511, 10979, 10904, 11011, 10903, 10732, 10685, 10577, 10526, 10457, 10027, 8570, 8360, 7853, 5709, 5273, 5113, 5066, 4897, 4881, 4804, 4717, 4571, 4018, 3822, 3785, 3805, 3750, 3713, 3768, 3748, 3708, 3700];
const STOCKPILE_RU = [0, 0, 0, 0, 1, 5, 25, 50, 120, 150, 200, 426, 660, 863, 1048, 1627, 2492, 3346, 4259, 5242, 6144, 7091, 8400, 9490, 10671, 11736, 13279, 14600, 15878, 17286, 19235, 22165, 24281, 26169, 28258, 30665, 32146, 33486, 35130, 36825, 38582, 40159, 38107, 36538, 35078, 32980, 29154, 26734, 24403, 21339, 18179, 15942, 15442, 14368, 13188, 12188, 11152, 10114, 9076, 8038, 7000, 6643, 6286, 5929, 5527, 5215, 4858, 4750, 4650, 4600, 4500, 4490, 4300, 4350, 4330, 4310, 4495, 4477, 4489, 4380, 4309];
/**
 * **Overlapping areas over a long span.** Two unstacked series with translucent
 * fills, so where one arsenal exceeded the other you read the overlap directly
 * rather than a meaningless sum —  is what makes that true, and
 * it is the difference between "who held more" and "how many existed".
 *
 * The x axis is numeric () rather than categorical, so 81 years
 * produce decade ticks instead of 81 labels, and the spacing stays proportional.
 *
 * Figures are real: the Federation of American Scientists' Nuclear Notebook, via
 * Our World in Data. The US peaks at 31,255 warheads in 1967; the USSR at
 * 40,159 in 1986 — nearly twenty years apart, which is the point of the chart.
 */
export const NuclearStockpiles: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 460px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.stockpiles')}
        subtitle=${t(globals.locale, 'area-chart.stockpiles-sub')}
        title-align="center"
        curve="linear"
        stack="none"
        legend="bottom"
        grid="horizontal"
        .fillOpacity=${0.55}
        .series=${[
          { label: t(globals.locale, 'area-chart.usa'), color: 'primary', data: STOCKPILE_US },
          { label: t(globals.locale, 'area-chart.ussr'), color: 'tertiary', data: STOCKPILE_RU },
        ]}
        .xAxis=${{ data: STOCKPILE_YEARS, scale: 'value', label: t(globals.locale, 'area-chart.axis.year'),
                   valueFormatter: (v: number) => String(v) }}
        .yAxis=${{ label: t(globals.locale, 'area-chart.axis.warheads'), min: 0,
                   valueFormatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)) }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : v.toLocaleString(globals.locale))}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- CO2 shares ------------------------------------------------
 * Annual CO2 emissions for the four largest emitters, 1990-2023, in
 * gigatonnes. Real figures from the Global Carbon Budget via Our World in Data.
 * Drawn as PERCENTAGE-stacked areas, so the chart answers "who emits what share
 * of this group" rather than "how much" — China goes from 2.48 Gt to 12.17 Gt
 * over the span while the EU falls, and the bands show that shift directly.
 * ----------------------------------------------------------- */
const CO2_YEARS = [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const CO2_CHINA = [2.48, 2.62, 2.73, 2.91, 3.09, 3.35, 3.50, 3.51, 3.36, 3.55, 3.64, 3.72, 4.10, 4.84, 5.21, 5.88, 6.49, 6.97, 7.49, 7.88, 8.61, 9.52, 9.77, 9.94, 9.98, 9.86, 9.75, 10.00, 10.35, 10.71, 10.90, 11.28, 11.71, 12.17];
const CO2_USA = [5.13, 5.08, 5.18, 5.28, 5.36, 5.43, 5.60, 5.67, 5.74, 5.80, 6.02, 5.90, 5.95, 6.01, 6.11, 6.13, 6.05, 6.12, 5.92, 5.49, 5.67, 5.54, 5.33, 5.47, 5.53, 5.37, 5.25, 5.20, 5.36, 5.24, 4.69, 5.02, 5.06, 4.92];
const CO2_EU = [3.87, 3.80, 3.68, 3.61, 3.59, 3.64, 3.72, 3.65, 3.64, 3.59, 3.60, 3.66, 3.66, 3.74, 3.74, 3.73, 3.75, 3.70, 3.63, 3.33, 3.42, 3.33, 3.26, 3.18, 3.04, 3.09, 3.09, 3.12, 3.05, 2.90, 2.63, 2.80, 2.74, 2.48];
const CO2_INDIA = [0.58, 0.62, 0.66, 0.68, 0.71, 0.76, 0.82, 0.86, 0.88, 0.96, 0.99, 1.00, 1.03, 1.07, 1.13, 1.20, 1.29, 1.39, 1.49, 1.61, 1.68, 1.77, 1.93, 2.00, 2.15, 2.23, 2.35, 2.43, 2.60, 2.61, 2.42, 2.68, 2.83, 3.06];
/**
 * **Percentage stacking** (`stack="percentage"`). Each column is rescaled so the
 * series sum to 100%, which changes the question the chart answers: not "how
 * much does each emit" but "who accounts for what share of this group".
 *
 * That is the right form here and the wrong one for the stockpiles story above —
 * absolute totals move by a factor of two across this span, and normalising them
 * away is exactly the point when you want to see China's share overtake the USA's
 * around 2005 while the EU's halves.
 *
 * Real figures: Global Carbon Budget via Our World in Data.
 */
export const PercentageStacked: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 440px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.co2-share')}
        subtitle=${t(globals.locale, 'area-chart.co2-sub')}
        title-align="center"
        curve="linear"
        stack="percentage"
        legend="bottom"
        grid="horizontal"
        .series=${[
          { label: t(globals.locale, 'area-chart.china'), color: 'primary', data: CO2_CHINA },
          { label: t(globals.locale, 'area-chart.usa-short'), color: 'tertiary', data: CO2_USA },
          { label: t(globals.locale, 'area-chart.eu'), color: 'secondary', data: CO2_EU },
          { label: t(globals.locale, 'area-chart.india'), color: 'error', data: CO2_INDIA },
        ]}
        .xAxis=${{ data: CO2_YEARS, scale: 'value', valueFormatter: (v: number) => String(v) }}
        .yAxis=${{ label: t(globals.locale, 'area-chart.axis.share') }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} Gt`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Daily temperature envelope ---------------------------------
 * Bergen, every day of 2023: the low and the high, as a [min, max] pair. Real
 * observations from the ERA5 reanalysis (Open-Meteo archive). A range series
 * draws the spread between the two rather than a line through either, so the
 * chart shows how wide each day was, not just how warm.
 * ------------------------------------------------------------ */
const BERGEN_DAYS = Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(2023, 0, 1 + i)));
const BERGEN_RANGE: [number, number][] = [[-3.8, -0.6], [-3.0, 0.6], [-4.2, 2.5], [-0.6, 4.2], [-1.0, 2.0], [1.0, 3.8], [1.6, 6.4], [3.5, 5.7], [2.2, 4.4], [2.8, 4.7], [3.4, 6.6], [0.1, 4.6], [-1.9, 3.0], [-2.3, 2.1], [-0.4, 2.3], [-2.7, 1.7], [-3.0, 0.1], [-7.4, 0.6], [-10.7, 0.1], [-9.8, -0.6], [-9.3, 1.0], [0.6, 1.7], [0.5, 3.2], [3.5, 6.5], [3.3, 7.1], [-2.0, 3.8], [-3.3, 2.3], [1.8, 5.1], [3.3, 7.8], [-0.1, 3.4], [-0.7, 3.7], [-0.6, 3.3], [-2.9, 1.8], [-4.2, 2.6], [-2.7, 2.1], [-1.5, 5.1], [2.6, 5.3], [4.1, 5.3], [4.6, 6.1], [1.2, 5.3], [-1.5, 7.8], [5.9, 7.5], [5.4, 7.1], [3.5, 7.0], [3.8, 5.7], [3.9, 8.2], [2.4, 5.6], [2.3, 4.8], [-0.4, 3.0], [-1.5, 4.5], [1.8, 7.6], [2.0, 6.5], [2.0, 5.5], [-1.1, 2.6], [-1.1, 3.2], [-2.5, 2.7], [-4.4, 3.0], [-0.8, 7.7], [-0.5, 7.3], [-0.6, 7.1], [-2.5, 6.8], [-1.3, 5.2], [-2.6, 1.0], [-4.3, 2.0], [-5.1, 1.6], [-6.7, 1.0], [-7.5, 0.3], [-6.7, -1.1], [-8.2, 0.7], [-7.3, -1.4], [-9.8, 0.8], [-0.8, 2.2], [-4.4, 1.5], [-7.4, 2.8], [-8.6, 2.4], [1.8, 6.0], [-1.9, 8.4], [0.9, 6.3], [-0.1, 6.3], [-0.7, 4.6], [3.2, 6.1], [3.0, 8.9], [2.6, 9.8], [0.5, 8.0], [-2.7, 3.7], [-1.9, 5.0], [-3.2, 2.1], [-2.0, 7.3], [0.5, 4.2], [-1.6, 9.4], [-3.3, 7.6], [-2.1, 8.5], [0.6, 5.8], [-0.7, 8.2], [0.6, 9.4], [-1.6, 7.2], [-1.3, 10.7], [-0.6, 11.2], [0.5, 10.0], [4.3, 10.3], [4.8, 10.1], [2.2, 11.8], [4.8, 11.6], [4.9, 11.4], [3.8, 11.3], [0.3, 11.3], [1.8, 12.6], [1.5, 13.9], [1.9, 15.4], [3.3, 16.2], [2.8, 15.9], [2.7, 16.3], [6.5, 10.1], [2.2, 7.2], [2.2, 7.6], [1.4, 5.6], [1.2, 6.8], [-1.7, 6.7], [1.6, 5.5], [0.7, 5.9], [0.9, 7.1], [0.0, 7.6], [0.1, 9.1], [-0.4, 10.9], [0.2, 12.7], [0.5, 14.1], [2.2, 15.1], [6.0, 15.8], [8.6, 13.2], [8.7, 11.1], [8.3, 12.7], [7.4, 14.3], [7.1, 14.1], [5.6, 15.8], [5.7, 10.6], [2.4, 9.4], [2.0, 7.3], [4.0, 10.9], [7.9, 14.2], [7.2, 15.4], [6.2, 17.1], [5.6, 15.7], [6.1, 12.1], [5.8, 10.8], [6.5, 11.0], [6.5, 11.0], [5.8, 8.8], [5.2, 9.5], [3.1, 8.8], [7.5, 12.5], [7.2, 11.7], [5.9, 13.4], [4.2, 13.7], [6.1, 13.3], [5.8, 17.6], [6.4, 13.4], [6.3, 15.3], [5.7, 14.7], [6.5, 18.4], [9.2, 21.3], [8.7, 22.4], [10.1, 23.1], [11.8, 19.7], [10.1, 21.5], [10.9, 22.3], [11.2, 25.3], [10.8, 23.4], [10.1, 22.7], [11.0, 23.4], [12.9, 22.9], [14.0, 21.7], [12.9, 19.2], [12.3, 16.4], [10.6, 16.3], [8.5, 20.9], [12.3, 22.9], [13.2, 24.9], [11.8, 16.9], [9.6, 19.1], [12.0, 17.6], [10.3, 16.9], [11.7, 18.4], [11.7, 15.3], [11.9, 14.3], [10.1, 15.2], [8.0, 16.7], [10.3, 15.6], [10.9, 17.4], [13.3, 22.2], [13.1, 25.0], [13.9, 18.8], [13.0, 18.2], [12.6, 16.5], [12.0, 14.3], [8.4, 17.4], [10.8, 19.6], [12.6, 18.4], [10.6, 14.7], [9.7, 12.6], [9.1, 11.4], [9.7, 14.8], [9.5, 14.5], [8.6, 16.2], [9.6, 18.1], [9.8, 18.6], [11.5, 15.3], [9.3, 18.8], [10.7, 17.8], [9.8, 17.1], [9.6, 19.7], [12.6, 17.5], [9.5, 17.7], [10.6, 19.0], [12.8, 18.5], [12.2, 18.8], [11.0, 15.8], [10.4, 15.2], [8.2, 18.0], [9.6, 15.8], [9.4, 10.5], [9.3, 11.1], [9.3, 12.0], [9.5, 18.0], [13.4, 19.7], [11.9, 17.6], [12.4, 18.1], [12.2, 16.7], [11.1, 16.0], [10.3, 19.5], [12.5, 22.8], [12.2, 23.8], [14.2, 19.9], [13.3, 18.7], [13.0, 18.9], [11.0, 14.9], [8.2, 17.3], [11.8, 17.3], [11.1, 17.2], [11.9, 13.4], [10.6, 14.8], [10.3, 15.3], [8.9, 17.9], [7.5, 18.4], [10.0, 17.3], [7.9, 14.4], [9.9, 14.5], [13.9, 17.8], [9.5, 16.4], [7.1, 18.8], [11.4, 20.4], [14.5, 22.4], [13.8, 21.3], [14.5, 16.2], [12.5, 16.5], [8.5, 14.1], [7.0, 12.3], [5.9, 12.0], [10.1, 14.8], [8.2, 12.4], [5.7, 15.9], [9.1, 18.4], [7.6, 13.6], [7.7, 14.9], [11.7, 14.8], [10.5, 14.5], [7.3, 12.1], [5.9, 13.6], [11.8, 15.6], [12.1, 17.2], [11.0, 14.9], [10.4, 15.6], [10.4, 13.1], [9.6, 12.6], [7.2, 12.5], [8.9, 14.0], [8.6, 13.2], [7.6, 10.4], [5.7, 11.7], [7.5, 12.6], [3.7, 8.9], [1.9, 8.4], [2.6, 9.0], [7.0, 12.9], [6.5, 11.1], [5.7, 8.8], [6.0, 9.3], [4.0, 8.3], [2.2, 5.5], [1.5, 8.0], [3.9, 9.9], [3.0, 9.4], [1.2, 6.9], [1.1, 4.9], [1.3, 5.6], [4.3, 10.0], [3.7, 9.5], [1.5, 10.3], [0.9, 9.4], [-1.9, 6.3], [-3.0, 5.4], [-0.3, 5.6], [-2.0, 6.9], [-1.8, 6.6], [-1.8, 4.4], [-1.4, 5.0], [1.1, 6.2], [3.8, 7.6], [4.6, 11.3], [-0.5, 8.6], [-1.4, 8.0], [-0.3, 7.0], [-2.3, 6.3], [1.2, 6.1], [-1.8, 4.5], [-2.6, 4.8], [-2.8, 4.3], [-2.7, 5.2], [-2.8, 3.9], [-2.9, 3.1], [-3.1, 3.6], [-3.6, 2.6], [-3.9, 2.6], [0.7, 2.8], [0.2, 4.2], [-1.5, 3.7], [2.4, 8.3], [0.4, 5.9], [-1.0, 2.9], [-5.4, 2.2], [-4.9, 1.2], [-6.8, 0.4], [-9.6, -4.8], [-9.4, -3.2], [-6.9, -2.2], [-8.5, -2.7], [-7.5, 0.1], [-8.7, 0.4], [-9.3, -0.6], [-10.1, -1.3], [-2.0, -0.3], [-10.7, -0.7], [-12.0, -3.0], [-2.7, 1.1], [-4.9, 0.6], [-7.2, -3.0], [-7.6, 0.2], [-4.2, -0.5], [-2.6, 2.2], [1.2, 5.9], [0.0, 9.0], [0.6, 8.0], [1.4, 7.7], [0.2, 5.7], [-1.4, 3.1], [-0.6, 2.0], [-5.0, 0.9], [-10.2, -1.8], [-7.2, 4.0], [-0.1, 3.6], [-3.3, 0.7], [-9.2, -1.0], [-1.8, 3.5], [-0.7, 3.4], [-4.7, -0.9], [-3.3, 3.1]];

/* --- April in Nesbyen -------------------------------------------
 * Daily min/max/mean for April 2024 (Open-Meteo archive, ERA5). The band is
 * the day's spread; the line is its mean — the pairing a weather chart uses to
 * say "this is the reading, and this is how far it moved".
 * ------------------------------------------------------------ */
const NESBYEN_DAYS = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2024, 3, 1 + i)));
const NESBYEN_RANGE: [number, number][] = [[-4.8, 9.0], [-1.0, 6.3], [-3.8, 1.6], [-5.2, -2.9], [-5.1, 3.7], [-5.1, 6.8], [4.1, 11.3], [3.3, 10.4], [2.1, 10.8], [0.8, 9.1], [-0.3, 12.6], [1.0, 13.1], [-1.8, 11.4], [-1.2, 7.6], [-3.7, 8.1], [-4.2, 9.1], [-5.1, 6.5], [-4.8, 6.9], [-3.6, 5.0], [-4.2, 6.3], [-7.5, 8.2], [-4.5, 8.9], [-1.7, 6.7], [-5.5, 6.9], [-0.6, 6.6], [-1.2, 6.9], [-3.3, 8.4], [-0.6, 6.1], [1.6, 11.5], [-0.2, 15.1]];
const NESBYEN_MEAN = [1.8, 2.7, -1.3, -4.4, -1.1, 1.3, 7.0, 6.7, 6.4, 6.0, 6.4, 6.3, 5.2, 4.9, 2.4, 3.3, 1.5, 1.1, 1.8, 1.5, 1.1, 2.1, 3.5, 1.4, 2.9, 2.9, 4.0, 3.5, 6.6, 7.6];

/* --- Global energy by source ------------------------------------
 * World primary energy consumption, TWh (substitution method), from Our World
 * in Data. Sampled at OWID's own cadence — decadal early on, annual from 1965
 * — so the x axis is a VALUE axis rather than evenly-spaced categories.
 * ------------------------------------------------------------ */
const ENERGY_YEARS = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ENERGY_COAL = [5728, 8656, 9833, 10125, 11586, 12603, 15442, 16178, 16359, 16096, 16333, 16847, 17087, 16988, 17168, 17684, 17696, 18045, 18700, 19267, 19467, 20371, 20878, 21158, 21395, 22051, 23008, 23997, 24264, 25228, 25983, 26231, 25929, 25687, 25584, 25709, 25815, 25999, 26617, 26563, 26396, 26509, 27456, 27880, 28982, 31520, 33709, 36201, 38087, 40242, 40797, 40219, 42016, 43983, 44099, 44745, 44912, 43695, 42768, 43226, 43897, 43628, 42316, 44642, 44927, 45319, 45851];
const ENERGY_OIL = [181, 397, 889, 1756, 2653, 5444, 11097, 18011, 19426, 20779, 22510, 24445, 26685, 28117, 30335, 32730, 32230, 31997, 34061, 35194, 36710, 37178, 35569, 34290, 33270, 33097, 33624, 33685, 34710, 35508, 36642, 37216, 37907, 37877, 38405, 38246, 39068, 39666, 40577, 41652, 41789, 42436, 43017, 43398, 43697, 44611, 46413, 47017, 47437, 48088, 47693, 46634, 48193, 48578, 49362, 49923, 50336, 51294, 52315, 53263, 53793, 53997, 49101, 51847, 53562, 54839, 55292];
const ENERGY_GAS = [64, 142, 233, 603, 875, 2092, 4472, 6304, 6869, 7374, 8044, 8833, 9615, 10293, 10862, 11378, 11660, 11660, 12354, 12760, 13294, 14118, 14237, 14396, 14470, 14704, 15903, 16262, 16421, 17282, 18089, 18889, 19481, 19973, 20063, 20265, 20390, 21104, 22159, 22030, 22434, 23072, 23994, 24317, 25052, 25728, 26782, 27439, 28172, 29338, 30051, 29404, 31593, 32350, 33246, 33733, 33976, 34780, 35584, 36603, 38317, 39053, 38704, 40226, 40060, 40151, 41278];
const ENERGY_HYDRO = [47, 92, 178, 364, 533, 925, 1914, 2564, 2733, 2794, 2942, 3116, 3263, 3409, 3568, 3619, 3976, 4025, 4009, 4144, 4484, 4709, 4810, 4914, 5003, 5216, 5393, 5498, 5572, 5648, 5829, 5799, 5996, 6135, 6134, 6504, 6544, 6898, 6991, 7115, 7169, 7224, 7352, 7123, 7195, 7147, 7633, 7826, 8081, 8171, 8579, 8521, 8933, 9048, 9385, 9688, 9896, 9821, 10090, 10171, 10419, 10502, 10763, 10576, 10651, 10392, 10861];
const ENERGY_NUCLEAR = [0, 0, 0, 0, 0, 0, 0, 71, 96, 114, 145, 172, 219, 305, 423, 566, 741, 1027, 1202, 1496, 1738, 1808, 1978, 2335, 2534, 2872, 3485, 4136, 4430, 4819, 5253, 5403, 5557, 5823, 5867, 6069, 6183, 6451, 6685, 6639, 6753, 7010, 7169, 7330, 7386, 7197, 7483, 7442, 7495, 7303, 7223, 7083, 7209, 6872, 6367, 6369, 6466, 6520, 6567, 6593, 6717, 6920, 6640, 6903, 6583, 6677, 6872];
const ENERGY_WIND = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 7, 10, 11, 13, 16, 20, 23, 26, 33, 44, 59, 87, 106, 144, 172, 232, 281, 357, 456, 584, 727, 902, 1142, 1368, 1626, 1797, 2106, 2419, 2856, 3162, 3520, 3940, 4583, 5185, 5665, 6124];
const ENERGY_SOLAR = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 4, 5, 6, 8, 11, 15, 21, 33, 55, 88, 170, 262, 354, 502, 649, 824, 1115, 1432, 1749, 2117, 2593, 3250, 4027, 5151];

/* --- Wind and solar ---------------------------------------------
 * The same OWID series narrowed to 2000 onward and drawn UNSTACKED, so the two
 * overlap: solar starts far behind wind and closes most of the gap.
 * ------------------------------------------------------------ */
const RENEW_YEARS = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const RENEW_WIND = [87, 106, 144, 172, 232, 281, 357, 456, 584, 727, 902, 1142, 1368, 1626, 1797, 2106, 2419, 2856, 3162, 3520, 3940, 4583, 5185, 5665, 6124];
const RENEW_SOLAR = [3, 4, 5, 6, 8, 11, 15, 21, 33, 55, 88, 170, 262, 354, 502, 649, 824, 1115, 1432, 1749, 2117, 2593, 3250, 4027, 5151];

/* --- CO2 by world region ----------------------------------------
 * Annual emissions per region, 1900-2023, in gigatonnes (Global Carbon Budget
 * via Our World in Data). Drawn as a STREAMGRAPH: stack='wiggle' centres each
 * column on a free baseline, trading the ability to read an absolute value for
 * a much clearer read on how each region's share moved.
 * ------------------------------------------------------------ */
const REGION_YEARS = [1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909, 1910, 1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918, 1919, 1920, 1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1929, 1930, 1931, 1932, 1933, 1934, 1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const REGION_ASIA = [0.043, 0.049, 0.051, 0.054, 0.061, 0.061, 0.069, 0.095, 0.104, 0.107, 0.109, 0.115, 0.117, 0.134, 0.14, 0.134, 0.147, 0.159, 0.163, 0.178, 0.169, 0.164, 0.171, 0.186, 0.197, 0.199, 0.201, 0.217, 0.227, 0.237, 0.235, 0.226, 0.224, 0.246, 0.277, 0.301, 0.325, 0.34, 0.348, 0.367, 0.426, 0.442, 0.4, 0.388, 0.373, 0.242, 0.203, 0.246, 0.275, 0.341, 0.368, 0.428, 0.481, 0.513, 0.559, 0.624, 0.69, 0.782, 1.071, 1.303, 1.448, 1.299, 1.233, 1.299, 1.362, 1.477, 1.598, 1.619, 1.779, 2.021, 2.412, 2.619, 2.769, 2.923, 2.968, 3.144, 3.296, 3.515, 3.695, 3.836, 3.845, 3.821, 3.953, 4.104, 4.349, 4.59, 4.773, 4.993, 5.405, 5.575, 5.761, 6.004, 6.224, 6.466, 6.758, 7.118, 7.44, 7.581, 7.294, 7.695, 7.927, 8.079, 8.584, 9.492, 10.037, 10.828, 11.564, 12.282, 12.864, 13.317, 14.363, 15.542, 16.061, 16.346, 16.58, 16.605, 16.689, 17.182, 17.777, 18.223, 18.046, 18.741, 19.456, 20.111];
const REGION_NAMERICA = [0.688, 0.751, 0.797, 0.93, 0.924, 1.032, 1.084, 1.263, 1.112, 1.224, 1.338, 1.337, 1.429, 1.544, 1.406, 1.452, 1.622, 1.792, 1.876, 1.605, 1.909, 1.604, 1.602, 2.075, 1.858, 1.891, 2.036, 1.988, 1.949, 2.085, 1.86, 1.578, 1.344, 1.436, 1.535, 1.593, 1.822, 1.911, 1.626, 1.789, 2.007, 2.186, 2.348, 2.429, 2.606, 2.513, 2.422, 2.659, 2.772, 2.339, 2.726, 2.816, 2.748, 2.81, 2.689, 2.938, 3.092, 3.068, 2.984, 3.075, 3.153, 3.146, 3.265, 3.404, 3.576, 3.727, 3.912, 4.078, 4.239, 4.445, 4.795, 4.844, 5.087, 5.304, 5.153, 4.976, 5.204, 5.35, 5.535, 5.591, 5.441, 5.257, 5.031, 5.033, 5.182, 5.205, 5.196, 5.429, 5.659, 5.747, 5.907, 5.857, 5.975, 6.082, 6.192, 6.249, 6.451, 6.558, 6.648, 6.731, 6.982, 6.871, 6.923, 7.024, 7.127, 7.161, 7.087, 7.186, 6.967, 6.488, 6.681, 6.586, 6.395, 6.538, 6.581, 6.412, 6.278, 6.227, 6.405, 6.284, 5.644, 6.005, 6.058, 5.923];
const REGION_EUROPE = [1.206, 1.195, 1.196, 1.245, 1.268, 1.306, 1.347, 1.493, 1.517, 1.519, 1.539, 1.574, 1.633, 1.767, 1.574, 1.493, 1.561, 1.533, 1.394, 1.184, 1.383, 1.266, 1.409, 1.347, 1.554, 1.538, 1.323, 1.685, 1.694, 1.838, 1.741, 1.626, 1.512, 1.558, 1.705, 1.789, 1.9, 2.061, 2.07, 2.117, 2.254, 2.174, 2.021, 2.039, 1.938, 1.27, 1.686, 1.933, 2.085, 2.266, 2.382, 2.629, 2.713, 2.791, 2.969, 3.233, 3.445, 3.593, 3.632, 3.714, 3.967, 4.112, 4.339, 4.612, 4.842, 4.984, 5.156, 5.27, 5.516, 5.816, 6.099, 6.328, 6.557, 6.85, 6.868, 6.907, 7.282, 7.339, 7.571, 7.75, 7.754, 7.472, 7.412, 7.418, 7.469, 7.793, 7.806, 7.827, 7.866, 7.831, 8.039, 7.74, 7.094, 6.806, 6.446, 6.422, 6.472, 6.267, 6.241, 6.157, 6.156, 6.283, 6.249, 6.391, 6.419, 6.428, 6.529, 6.473, 6.407, 5.893, 6.117, 6.044, 5.999, 5.84, 5.609, 5.613, 5.598, 5.632, 5.614, 5.437, 5.026, 5.265, 5.096, 4.887];
const REGION_AFRICA = [0.002, 0.004, 0.006, 0.008, 0.009, 0.01, 0.012, 0.013, 0.013, 0.015, 0.017, 0.017, 0.018, 0.02, 0.02, 0.02, 0.023, 0.025, 0.025, 0.025, 0.028, 0.028, 0.024, 0.029, 0.031, 0.032, 0.034, 0.034, 0.035, 0.036, 0.034, 0.029, 0.027, 0.028, 0.033, 0.036, 0.039, 0.042, 0.044, 0.047, 0.05, 0.054, 0.059, 0.06, 0.067, 0.068, 0.068, 0.068, 0.072, 0.077, 0.095, 0.101, 0.11, 0.112, 0.118, 0.129, 0.135, 0.142, 0.149, 0.148, 0.157, 0.162, 0.166, 0.176, 0.194, 0.214, 0.221, 0.237, 0.257, 0.278, 0.302, 0.332, 0.352, 0.378, 0.388, 0.387, 0.42, 0.433, 0.462, 0.499, 0.536, 0.549, 0.571, 0.594, 0.649, 0.665, 0.689, 0.689, 0.724, 0.697, 0.656, 0.684, 0.664, 0.705, 0.789, 0.842, 0.871, 0.893, 0.911, 0.898, 0.928, 0.917, 0.897, 0.988, 1.043, 1.056, 1.085, 1.114, 1.166, 1.161, 1.216, 1.265, 1.264, 1.281, 1.361, 1.336, 1.367, 1.377, 1.391, 1.456, 1.369, 1.475, 1.459, 1.482];
const REGION_MIDEAST = [0.001, 0.001, 0.001, 0.001, 0.001, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.003, 0.003, 0.002, 0.003, 0.003, 0.004, 0.005, 0.007, 0.008, 0.01, 0.013, 0.016, 0.017, 0.018, 0.02, 0.021, 0.021, 0.023, 0.022, 0.025, 0.027, 0.032, 0.036, 0.039, 0.046, 0.046, 0.052, 0.046, 0.036, 0.047, 0.052, 0.068, 0.086, 0.113, 0.134, 0.109, 0.042, 0.032, 0.026, 0.024, 0.027, 0.033, 0.05, 0.059, 0.062, 0.067, 0.071, 0.09, 0.094, 0.109, 0.124, 0.145, 0.173, 0.199, 0.206, 0.237, 0.268, 0.285, 0.334, 0.361, 0.429, 0.444, 0.434, 0.508, 0.535, 0.537, 0.57, 0.555, 0.553, 0.565, 0.596, 0.624, 0.673, 0.716, 0.732, 0.779, 0.824, 0.823, 0.893, 0.985, 1.07, 1.129, 1.14, 1.159, 1.143, 1.183, 1.273, 1.407, 1.442, 1.454, 1.549, 1.656, 1.725, 1.831, 1.843, 1.984, 2.066, 2.179, 2.232, 2.381, 2.344, 2.387, 2.472, 2.521, 2.6, 2.597, 2.711, 2.654, 2.788, 2.79, 2.894];
const REGION_SAMERICA = [0.009, 0.01, 0.01, 0.01, 0.011, 0.013, 0.016, 0.018, 0.019, 0.018, 0.021, 0.024, 0.025, 0.026, 0.022, 0.016, 0.015, 0.013, 0.012, 0.014, 0.016, 0.015, 0.018, 0.02, 0.025, 0.026, 0.028, 0.03, 0.032, 0.035, 0.03, 0.027, 0.03, 0.034, 0.038, 0.041, 0.041, 0.051, 0.048, 0.047, 0.051, 0.052, 0.048, 0.049, 0.054, 0.055, 0.058, 0.063, 0.07, 0.071, 0.113, 0.131, 0.141, 0.141, 0.151, 0.17, 0.184, 0.193, 0.179, 0.197, 0.199, 0.202, 0.216, 0.219, 0.23, 0.24, 0.252, 0.267, 0.288, 0.311, 0.338, 0.347, 0.363, 0.393, 0.417, 0.412, 0.419, 0.435, 0.462, 0.494, 0.508, 0.49, 0.491, 0.486, 0.492, 0.502, 0.53, 0.557, 0.58, 0.58, 0.598, 0.606, 0.618, 0.653, 0.656, 0.69, 0.72, 0.767, 0.791, 0.813, 0.812, 0.791, 0.82, 0.821, 0.857, 0.882, 0.91, 0.945, 0.989, 0.961, 1.072, 1.088, 1.142, 1.206, 1.221, 1.187, 1.142, 1.126, 1.082, 1.095, 0.984, 1.111, 1.1, 1.107];
const REGION_OCEANIA = [0.013, 0.014, 0.014, 0.014, 0.015, 0.016, 0.018, 0.02, 0.021, 0.019, 0.023, 0.024, 0.026, 0.027, 0.03, 0.027, 0.025, 0.026, 0.028, 0.026, 0.03, 0.027, 0.028, 0.03, 0.032, 0.034, 0.034, 0.036, 0.034, 0.032, 0.031, 0.027, 0.027, 0.028, 0.03, 0.033, 0.036, 0.038, 0.038, 0.042, 0.04, 0.044, 0.047, 0.047, 0.046, 0.045, 0.048, 0.05, 0.053, 0.054, 0.065, 0.07, 0.072, 0.072, 0.078, 0.082, 0.087, 0.087, 0.089, 0.094, 0.1, 0.1, 0.103, 0.109, 0.118, 0.129, 0.132, 0.138, 0.145, 0.153, 0.166, 0.17, 0.173, 0.192, 0.189, 0.195, 0.193, 0.206, 0.212, 0.212, 0.226, 0.234, 0.239, 0.229, 0.24, 0.25, 0.25, 0.262, 0.27, 0.286, 0.307, 0.309, 0.316, 0.321, 0.326, 0.337, 0.346, 0.356, 0.368, 0.38, 0.387, 0.397, 0.402, 0.413, 0.424, 0.428, 0.435, 0.442, 0.448, 0.448, 0.447, 0.445, 0.448, 0.44, 0.437, 0.445, 0.453, 0.459, 0.46, 0.461, 0.442, 0.431, 0.425, 0.425];

/* --- Monthly mean temperature, 2023 -----------------------------
 * Three Norwegian cities (Open-Meteo archive, ERA5). Tromso and Oslo spend the
 * winter below freezing and Bergen barely does — series that genuinely cross
 * zero, so the fills run both above and below the baseline.
 * ------------------------------------------------------------ */
const CITY_TROMSO = [-3.0, -1.3, -5.5, 1.5, 4.9, 11.3, 15.3, 14.7, 9.1, 0.2, -5.3, -7.5];
const CITY_OSLO = [-1.2, 0.0, -1.5, 5.6, 11.9, 19.1, 16.4, 16.2, 14.8, 6.1, -0.2, -4.9];
const CITY_BERGEN = [1.2, 3.0, 0.8, 5.8, 8.4, 14.5, 13.9, 13.9, 12.6, 5.7, 0.8, -1.1];

/** Month names from the platform, so the axis follows the toolbar locale. */
const monthsOf = (locale: string | undefined) => {
  const f = new Intl.DateTimeFormat(locale || undefined, { month: 'short' });
  return Array.from({ length: 12 }, (_, m) => f.format(new Date(Date.UTC(2023, m, 1))));
};

/**
 * **Area range** — a series can carry a `range` of `[low, high]` pairs instead
 * of `data`, and fills the band between them rather than down to the baseline.
 *
 * That answers a different question than a line does. A daily mean would say
 * how warm each day was; the band says how *wide* it was — and the two are
 * independent, as the calm, narrow days in early March show against the equally
 * cool but far more volatile ones a fortnight later.
 *
 * A range never joins the stack, takes the axis from both edges, and draws no
 * stroke — the band has no single value to trace. Its tooltip reads `low – high`
 * and the screen-reader table gives both edges in one cell.
 *
 * `zoom="both"` turns on both gestures: drag across the plot to select a range,
 * or use the slider under it — drag its middle to pan the window without
 * resizing. Double-click the plot to reset. With 365 daily readings this is
 * where zoom earns its keep; the events still report absolute indices, so a
 * consumer never has to know a window is applied.
 */
export const AreaRange: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 460px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.temp-variation')}
        subtitle=${t(globals.locale, 'area-chart.temp-sub')}
        curve="linear"
        legend="none"
        grid="horizontal"
        zoom="both"
        label-zoom-start=${t(globals.locale, 'area-chart.zoom-start')}
        label-zoom-end=${t(globals.locale, 'area-chart.zoom-end')}
        .series=${[
          { label: t(globals.locale, 'area-chart.temperature'), color: 'primary', range: BERGEN_RANGE },
        ]}
        .xAxis=${{
          scale: 'time',
          data: BERGEN_DAYS,
          valueFormatter: (v: string | number | Date) =>
            new Date(v).toLocaleDateString(globals.locale, { month: 'short', year: 'numeric' }),
        }}
        .yAxis=${{ label: '°C' }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v}°C`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Range with a line** — the band is the day's spread, the line its mean. Two
 * series, one carrying `range` and one carrying `data`.
 *
 * The line sets `fill: false`. Without it an area chart fills every series down
 * to the axis, and the mean's own fill would bury the band it is meant to sit
 * inside. `show-marks` puts a dot on each reading so single days stay pickable
 * at this density.
 *
 * The two carry different colour roles on purpose: the envelope is the muted
 * `secondary`, the reading the saturated `primary`. Sharing one role made the
 * legend show two identical swatches, and the line had to fight the band for
 * contrast.
 */
export const RangeWithLine: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.april-nesbyen')}
        curve="linear"
        legend="bottom"
        grid="horizontal"
        .series=${[
          // The envelope takes the muted role and the reading the saturated one:
          // same-coloured, they gave the legend two identical swatches and left
          // the line competing with the band it is supposed to sit inside.
          { label: t(globals.locale, 'area-chart.daily-range'), color: 'secondary', range: NESBYEN_RANGE },
          {
            label: t(globals.locale, 'area-chart.daily-mean'),
            color: 'primary',
            data: NESBYEN_MEAN,
            fill: false,
            showMarks: true,
            hollow: true,
          },
        ]}
        .xAxis=${{
          scale: 'time',
          data: NESBYEN_DAYS,
          valueFormatter: (v: string | number | Date) =>
            new Date(v).toLocaleDateString(globals.locale, { month: 'short', day: 'numeric' }),
        }}
        .yAxis=${{ label: '°C' }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v}°C`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Predicted net income --------------------------------------
 * A worked forecast: eight recorded quarters, then eight projected ones with
 * widening uncertainty. The actuals are held flat across the forecast half so
 * only the bands carry it. Illustrative figures — the point is the shape of
 * the uncertainty, which is why each band is exactly 1, 2 and 3 sigma wide.
 * ------------------------------------------------------------ */
const fanQuartersOf = (locale = 'en-US') =>
  [2024, 2025, 2026, 2027].flatMap((y) =>
    Array.from({ length: 4 }, (_, q) => `${t(locale, 'line-chart.quarter').replace('%n%', String(q + 1))} ${y}`),
  );
const FAN_ACTUAL = [18.7, 19.1, 20.4, 21.6, 19.8, 19.4, 19.9, 21.7];
const FAN_MEAN = [21.6, 24.9, 23.4, 24.2, 24.5, 26.1, 27.2, 27.6];
/** Sigma grows with the square root of the horizon, as a random walk does. */
const FAN_SIGMA = FAN_MEAN.map((_, i) => 0.9 * Math.sqrt(i + 1));
const fanBand = (k: number): ([number, number] | null)[] => [
  ...FAN_ACTUAL.slice(0, -1).map(() => null),
  ...[FAN_ACTUAL[FAN_ACTUAL.length - 1], ...FAN_MEAN].map((m, i) =>
    i === 0 ? ([m, m] as [number, number]) : ([m - k * FAN_SIGMA[i - 1], m + k * FAN_SIGMA[i - 1]] as [number, number]),
  ),
];

/**
 * `n` tints of one MD3 role, lightest first, by blending it toward the surface.
 *
 * Nested bands that all carry the SAME role are told apart only by where they
 * overlap — which the legend and the tooltip cannot show, so every swatch comes
 * out identical and the rows become unreadable. Giving each band its own tint
 * and drawing it opaque makes the swatch exactly the colour on the plot.
 */
const tintsOf = (role: string, n: number): string[] => {
  const cs = getComputedStyle(document.documentElement);
  const hex = (c: string): [number, number, number] | null => {
    const v = c.trim().replace('#', '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v)) return null;
    const f = v.length === 3 ? v.split('').map((d) => d + d).join('') : v;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const base = hex(cs.getPropertyValue(`--md-sys-color-${role}`));
  const surface = hex(cs.getPropertyValue('--md-sys-color-surface')) ?? [255, 251, 254];
  // No usable token (SSR, or a theme publishing rgb()) — let the chart fall
  // back to its own palette rather than emitting broken colours.
  if (!base) return [];
  return Array.from({ length: n }, (_, i) => {
    // Lightest first: the widest band is the palest, so the nesting reads as
    // confidence narrowing toward the centre.
    const f = ((n - 1 - i) / n) * 0.72;
    const mix = base.map((v, k) => Math.round(v + (surface[k] - v) * f));
    return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
};

/**
 * **Fan chart** — three nested `range` series for the 1σ, 2σ and 3σ confidence
 * intervals, with the central estimate drawn over them as a line.
 *
 * Nesting works because a range keeps an even tint rather than the
 * fade-to-nothing gradient of a fill that runs to an axis: the widest band is
 * drawn first and each narrower one layers on top, so the eye reads the centre
 * as the most likely outcome.
 *
 * Each band carries its OWN tint of the error role rather than sharing one at
 * low opacity. Sharing meant the bands were told apart only by where they
 * overlapped — something a legend swatch or a tooltip dot cannot show, so all
 * three rows came out identically coloured and unreadable.
 *
 * The forecast half is shaded with an x-axis band, so where the record stops
 * and the projection starts is visible without a legend.
 */
export const FanChart: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.predicted-income')}
        subtitle=${t(globals.locale, 'area-chart.predicted-income-sub')}
        title-align="center"
        curve="linear"
        legend="none"
        grid="horizontal"
        fill-opacity="1"
        .series=${[
          { label: `3σ ${t(globals.locale, 'area-chart.confidence')}`, color: tintsOf('error', 3)[0], range: fanBand(3) },
          { label: `2σ ${t(globals.locale, 'area-chart.confidence')}`, color: tintsOf('error', 3)[1], range: fanBand(2) },
          { label: `1σ ${t(globals.locale, 'area-chart.confidence')}`, color: tintsOf('error', 3)[2], range: fanBand(1) },
          {
            label: t(globals.locale, 'area-chart.net-income'),
            color: 'primary',
            data: [...FAN_ACTUAL, ...FAN_MEAN],
            fill: false,
          },
        ]}
        .xAxis=${{
          data: fanQuartersOf(globals.locale),
          bands: [
            {
              from: 7,
              to: 15,
              color: 'color-mix(in srgb, var(--md-sys-color-error) 6%, transparent)',
              label: t(globals.locale, 'area-chart.forecast'),
            },
          ],
        }}
        .yAxis=${{ min: 0 }}
        .valueFormatter=${(v: number | null) =>
          v == null ? '—' : `${v.toLocaleString(globals.locale, { maximumFractionDigits: 1 })}M`}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Area spline** — two smooth areas drawn UNSTACKED, so they overlap and can
 * be compared directly instead of summed.
 *
 * Stacking would be the wrong choice here: the interesting fact is that solar
 * started roughly a decade behind wind and has nearly caught it, and a stack
 * turns that race into a single growing total. `show-marks` puts a dot on each
 * year so the annual steps stay visible under the spline.
 */
export const AreaSpline: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.renewables')}
        subtitle=${t(globals.locale, 'area-chart.renewables-sub')}
        title-align="center"
        curve="smooth"
        stack="none"
        show-marks
        legend="top-start"
        grid="horizontal"
        fill-opacity="0.45"
        .series=${[
          { label: t(globals.locale, 'area-chart.wind'), color: 'primary', data: RENEW_WIND, symbol: 'circle' },
          { label: t(globals.locale, 'area-chart.solar'), color: 'tertiary', data: RENEW_SOLAR, symbol: 'diamond' },
        ]}
        .xAxis=${{ data: RENEW_YEARS, scale: 'value', valueFormatter: (v: number) => String(v) }}
        .yAxis=${{ label: 'TWh' }}
        .valueFormatter=${(v: number | null) =>
          v == null ? '—' : `${v.toLocaleString(globals.locale)} TWh`}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Inverted axes** (`inverted`) — the independent axis runs down the side and
 * values run across the bottom.
 *
 * Worth reaching for when the independent variable is naturally read as depth
 * (altitude, a drill core, a stratigraphic column) or when its labels are long
 * enough that a horizontal axis would rotate them. Fills close against a
 * baseline X rather than a baseline Y, and stacking still applies — along the
 * value axis (see the composition profile below).
 */
export const InvertedAxis: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-area-chart
        style="height: 520px;"
        locale=${globals.locale}
        inverted
        label=${t(globals.locale, 'area-chart.co2-two')}
        subtitle=${t(globals.locale, 'area-chart.revenue-inverted-sub')}
        stack="none"
        curve="linear"
        legend="top-end"
        grid="vertical"
        fill-opacity="0.4"
        .series=${[
          { label: t(globals.locale, 'area-chart.china'), color: 'primary', data: CO2_CHINA },
          { label: t(globals.locale, 'area-chart.usa-short'), color: 'tertiary', data: CO2_USA },
        ]}
        .xAxis=${{
          data: CO2_YEARS,
          scale: 'value',
          label: t(globals.locale, 'area-chart.year'),
          valueFormatter: (v: number) => String(v),
        }}
        .yAxis=${{ label: 'Gt CO₂' }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} Gt`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Atmospheric composition ------------------------------------
 * Volume fractions by altitude, following the NRLMSISE-00 reference profile.
 * Representative daytime values at moderate solar activity. Each column is
 * normalised to sum to exactly 100, so a tooltip listing every species adds up
 * — raw model figures do not, and labelling them "%" would have the top of the
 * range reading 112%. The point is the hand-off: N2/O2 give way to atomic O
 * around 200 km, to helium past 600 km, and to hydrogen at the top.
 * ------------------------------------------------------------ */
const MSIS_KM = [0, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const MSIS_N2 = [78.1695, 77.999, 69.15, 42.9, 12.3, 2.4, 0.39, 0.05, 0.0048, 0.0005, 0, 0];
const MSIS_O2 = [20.9, 20.8, 10.2, 3.7, 0.51, 0.05, 0.0039, 0, 0, 0, 0, 0];
const MSIS_O = [0, 0.3, 20.4, 53.04, 84.279, 88.35, 80.8061, 60.15, 32.4, 12.0, 3.2, 0.71];
const MSIS_AR = [0.93, 0.9, 0.2, 0.03, 0.001, 0, 0, 0, 0, 0, 0, 0];
const MSIS_HE = [0.0005, 0.001, 0.05, 0.31, 2.6, 8.0, 15.8, 32.0, 52.3952, 62.9995, 59.2, 46.1];
const MSIS_H = [0, 0, 0, 0.02, 0.31, 1.2, 3.0, 7.8, 15.2, 25.0, 37.6, 53.19];

/**
 * **Stacked + inverted** — percentage stacking with the independent axis
 * vertical. Each row is rescaled to fill the width, so the chart reads as a
 * composition profile: at any altitude, what is the air made of.
 *
 * This is the pairing the transposed layout exists for. Height belongs on the
 * vertical axis because that is where height is, and stacking has to run along
 * the value axis for the columns to total 100%.
 *
 * The layers are fill only (`stroke: false`): between adjacent bands the colour
 * change already is the boundary, and a stroke there just doubles it.
 *
 * Hovering still gives a crosshair and a card, but no marker dots. A series
 * with no line and no marks has nothing for a dot to sit on — it would land on
 * the band's top edge, which in a stack is a cumulative total and not a reading
 * the series ever took — so the engine drops it. The card itself comes from a
 * `tooltipRenderer`, since six species with four of them at 0% is not a useful
 * default listing — the shares span four orders of magnitude, so it prints
 * enough precision for a trace species to still read as present.
 */
export const StackedInverted: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 620px;">
      <md-area-chart
        style="height: 620px;"
        locale=${globals.locale}
        inverted
        stack="percentage"
        curve="smooth"
        label=${t(globals.locale, 'area-chart.atmosphere')}
        subtitle=${t(globals.locale, 'area-chart.atmosphere-sub')}
        legend="bottom"
        grid="both"
        fill-opacity="0.75"
        .series=${[
          { label: 'N₂', color: 'primary', data: MSIS_N2 },
          { label: 'O₂', color: 'secondary', data: MSIS_O2 },
          { label: 'O', color: 'tertiary', data: MSIS_O },
          { label: 'Ar', color: 'surface-variant', data: MSIS_AR },
          { label: 'He', color: 'primary-container', data: MSIS_HE },
          { label: 'H', color: 'tertiary-container', data: MSIS_H },
        ].map((sr) => ({ ...sr, stroke: false }))}
        .tooltipRenderer=${(ctx: {
          axisLabel: string;
          series: { label: string; color: string; value: number | null | undefined }[];
        }) => {
          // Every species, in stack order so the card matches the legend and the
          // bands. Shares run from 88% down to five-thousandths of a percent, so
          // a fixed precision would print a real trace as a flat "0%".
          // Precision tracks magnitude, so 78% is not printed as 78.00% and a
          // trace at five-thousandths of a percent is not flattened to 0% —
          // localized, so the decimal separator follows the locale like every
          // other number in these stories.
          const pct = (v: number) => {
            if (v === 0) return '0%';
            if (v < 0.01) return '<0.01%';
            const digits = v >= 1 ? 0 : v >= 0.1 ? 1 : 2;
            return `${v.toLocaleString(globals.locale, { maximumFractionDigits: digits })}%`;
          };
          const present = ctx.series.filter((r) => typeof r.value === 'number');
          const card = document.createElement('div');
          card.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center;white-space:nowrap';
          const head = document.createElement('div');
          head.textContent = `${ctx.axisLabel} km`;
          head.style.cssText = 'grid-column:1/-1;font-weight:600;margin-bottom:2px';
          card.appendChild(head);
          for (const r of present) {
            const dot = document.createElement('span');
            dot.style.cssText = `width:9px;height:9px;border-radius:3px;background:${r.color}`;
            const name = document.createElement('span');
            name.textContent = r.label;
            const val = document.createElement('span');
            val.textContent = pct(r.value as number);
            val.style.fontWeight = '600';
            card.append(dot, name, val);
          }
          return card;
        }}
        .xAxis=${{
          data: MSIS_KM,
          scale: 'value',
          label: t(globals.locale, 'area-chart.height-km'),
          valueFormatter: (v: number) => String(v),
        }}
        .yAxis=${{ label: t(globals.locale, 'area-chart.volume-fraction') }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Negative values** — series that cross zero fill both ways, and the axis
 * keeps the zero line where the data puts it rather than clamping to the floor.
 *
 * Drawn unstacked, because stacking series that change sign stacks the
 * magnitudes and the result is not readable as a total.
 */
export const NegativeValues: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 400px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.monthly-temp')}
        subtitle=${t(globals.locale, 'area-chart.monthly-temp-sub')}
        stack="none"
        curve="smooth"
        show-marks
        legend="bottom"
        grid="horizontal"
        fill-opacity="0.4"
        .series=${[
          { label: t(globals.locale, 'area-chart.tromso'), color: 'primary', data: CITY_TROMSO },
          { label: t(globals.locale, 'area-chart.oslo'), color: 'tertiary', data: CITY_OSLO },
          { label: t(globals.locale, 'area-chart.bergen'), color: 'error', data: CITY_BERGEN },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: '°C' }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v}°C`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * A ramp of `n` distinct colours built from the MD3 accent roles.
 *
 * The token set gives four genuinely saturated hues (primary, tertiary, error,
 * secondary) and four pale containers — enough for a four-series chart, not for
 * a seven-band stream where every band has to stay tellable-apart. So the four
 * accents are used as anchors and blended in sRGB to fill the gaps, which keeps
 * the theme as the single source of truth: restyle the tokens and the ramp
 * follows. Resolved at render time so a theme switch is picked up.
 */
const md3Ramp = (n: number): string[] => {
  const cs = getComputedStyle(document.documentElement);
  const read = (role: string) => cs.getPropertyValue(`--md-sys-color-${role}`).trim();
  const hex = (c: string): [number, number, number] => {
    const v = c.replace('#', '');
    const f = v.length === 3 ? v.split('').map((d) => d + d).join('') : v;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const anchors = ['primary', 'tertiary', 'error', 'secondary']
    .map(read)
    .filter((c) => /^#[0-9a-f]{3,6}$/i.test(c));
  // No usable tokens (SSR, or a theme that publishes rgb()) — let the chart
  // fall back to its own palette rather than emitting broken colours.
  if (anchors.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (anchors.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(anchors.length - 1, lo + 1);
    const f = t - lo;
    const a = hex(anchors[lo]);
    const b = hex(anchors[hi]);
    const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
    out.push(`#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  }
  return out;
};

/**
 * **Data labels** (`show-labels`) — print each point's value beside its marker,
 * for a chart meant to be read exactly rather than approximately. The value goes
 * through the same `valueFormatter` as the tooltip, so the units match.
 *
 * Labels are drawn per point with no collision handling, so this suits a dozen
 * points, not a hundred: the same switch on a 24-point series overlaps into an
 * unreadable smear. Reach for `show-marks` alone, or a tooltip, when the series
 * is dense.
 */
export const DataLabels: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 420px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.monthly-temp')}
        stack="none"
        curve="smooth"
        show-marks
        show-labels
        legend="bottom"
        grid="horizontal"
        fill-opacity="0.35"
        .series=${[
          { label: t(globals.locale, 'area-chart.bergen'), color: 'primary', data: CITY_BERGEN },
          { label: t(globals.locale, 'area-chart.tromso'), color: 'tertiary', data: CITY_TROMSO },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: '°C' }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v}°C`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Streamgraph** (`stack="wiggle"`) — the stack is centred on a free-floating
 * baseline chosen to minimise wiggle, instead of resting on zero.
 *
 * The trade is deliberate: you give up reading any absolute value, and in
 * exchange every band's *thickness* stays legible even where the total is
 * changing fast. Over 120 years of emissions that is the whole story — Europe
 * and North America dominate the first half, Asia overtakes both from the
 * 1990s. The y axis is hidden because on a free baseline it would only mislead.
 *
 * Two things follow from the floating baseline. Layers draw **no line**: a
 * band's top edge is not a value anyone can read, so `wiggle` and `silhouette`
 * default to fill only. And the tooltip uses `tooltip="item"`, which reports
 * just the band under the pointer — an every-series list buries the one thing
 * you are pointing at, and on bands this thick the pointer really is *on* one
 * series.
 */
export const StreamgraphRegions: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 940px;">
      <md-area-chart
        style="height: 460px;"
        locale=${globals.locale}
        label=${t(globals.locale, 'area-chart.co2-regions')}
        subtitle=${t(globals.locale, 'area-chart.co2-regions-sub')}
        stack="wiggle"
        curve="smooth"
        legend="bottom"
        grid="none"
        tooltip="item"
        fill-opacity="1"
        .series=${[
          { label: t(globals.locale, 'area-chart.asia'), data: REGION_ASIA },
          { label: t(globals.locale, 'area-chart.north-america'), data: REGION_NAMERICA },
          { label: t(globals.locale, 'area-chart.europe'), data: REGION_EUROPE },
          { label: t(globals.locale, 'area-chart.middle-east'), data: REGION_MIDEAST },
          { label: t(globals.locale, 'area-chart.africa'), data: REGION_AFRICA },
          { label: t(globals.locale, 'area-chart.south-america'), data: REGION_SAMERICA },
          { label: t(globals.locale, 'area-chart.oceania'), data: REGION_OCEANIA },
        ].map((sr, i, all) => ({ ...sr, color: md3Ramp(all.length)[i] }))}
        .xAxis=${{ data: REGION_YEARS, scale: 'value', valueFormatter: (v: number) => String(v) }}
        .yAxis=${{ hidden: true }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} Gt`)}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Missing points** — a `null` is a gap, not a zero. The fill and the line
 * both break at it, so a hole in the record reads as a hole rather than as a
 * dip to nothing.
 *
 * Compare with `ConnectedNulls` below, which bridges the same gap.
 */
export const MissingPoints: Story = {
  render: (_args, { globals }) => {
    // One year withheld from solar, to show what the chart does with a hole.
    const gapped = RENEW_SOLAR.map((v, i) => (RENEW_YEARS[i] === 2012 ? null : v));
    return html`
      <div style="max-width: 940px;">
        <md-area-chart
          style="height: 380px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'area-chart.missing-title')}
          stack="none"
          curve="linear"
          show-marks
          legend="bottom"
          grid="horizontal"
          fill-opacity="0.4"
          .series=${[
            { label: t(globals.locale, 'area-chart.wind'), color: 'primary', data: RENEW_WIND },
            { label: t(globals.locale, 'area-chart.solar'), color: 'tertiary', data: gapped },
          ]}
          .xAxis=${{ data: RENEW_YEARS, scale: 'value', valueFormatter: (v: number) => String(v) }}
          .yAxis=${{ label: 'TWh' }}
          .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} TWh`)}
        ></md-area-chart>
        <p style="margin: 8px 0 0; font-size: 12px; opacity: 0.7; text-align: end;">
          ${t(globals.locale, 'area-chart.missing-note')}
        </p>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * **Connected nulls** (`connect-nulls`) — the same withheld year, bridged.
 *
 * Which one is right depends on what the `null` means. A sensor that dropped a
 * sample should be bridged; a year a series genuinely did not exist should not,
 * or the chart invents data that was never recorded.
 */
export const ConnectedNulls: Story = {
  render: (_args, { globals }) => {
    const gapped = RENEW_SOLAR.map((v, i) => (RENEW_YEARS[i] === 2012 ? null : v));
    return html`
      <div style="max-width: 940px;">
        <md-area-chart
          style="height: 380px;"
          locale=${globals.locale}
          connect-nulls
          label=${t(globals.locale, 'area-chart.missing-title')}
          stack="none"
          curve="linear"
          show-marks
          legend="bottom"
          grid="horizontal"
          fill-opacity="0.4"
          .series=${[
            { label: t(globals.locale, 'area-chart.wind'), color: 'primary', data: RENEW_WIND },
            { label: t(globals.locale, 'area-chart.solar'), color: 'tertiary', data: gapped },
          ]}
          .xAxis=${{ data: RENEW_YEARS, scale: 'value', valueFormatter: (v: number) => String(v) }}
          .yAxis=${{ label: 'TWh' }}
          .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} TWh`)}
        ></md-area-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

const ENERGY_SOURCES = [
  { key: 'area-chart.coal', color: 'secondary', data: ENERGY_COAL },
  { key: 'area-chart.oil', color: 'error', data: ENERGY_OIL },
  { key: 'area-chart.gas', color: 'tertiary', data: ENERGY_GAS },
  { key: 'area-chart.hydro', color: 'primary', data: ENERGY_HYDRO },
  { key: 'area-chart.nuclear-power', color: 'surface-variant', data: ENERGY_NUCLEAR },
  { key: 'area-chart.wind', color: 'primary-container', data: ENERGY_WIND },
  { key: 'area-chart.solar', color: 'tertiary-container', data: ENERGY_SOLAR },
];

/**
 * **Area race** — the stack sweeps in over time under a play/scrub control, the
 * area equivalent of the line chart's `LineRace`. Drag the slider to scrub to
 * any year; dragging pauses playback so the two never fight over the value.
 *
 * The mechanics matter. The FULL x axis is present from the first frame and
 * only the data grows, so the axis never rescales mid-run — a chart whose ticks
 * shuffle every frame is unreadable. Years beyond the cursor are `null` (a gap,
 * so nothing is drawn there) and the leading edge is an interpolated sample at
 * exactly the current year, which keeps the sweep smooth between samples.
 * `no-animation` turns off the entry animation, since the story drives the
 * motion itself.
 *
 * The cursor is a YEAR, not a data index — this source is sampled decadally
 * before 1965 and annually after, so advancing by index would sweep ten years
 * per tick early and one per tick later, and the slider would never line up
 * with the edge it is supposed to be showing.
 */
export const AreaRace: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: (_args, { globals }) => {
    const LAST = ENERGY_YEARS.length - 1;
    const FIRST_YEAR = ENERGY_YEARS[0];
    const LAST_YEAR = ENERGY_YEARS[LAST];
    // Progress is a YEAR, not a data index. OWID samples this series decadally
    // before 1965 and annually after, so stepping by index would sweep 10 years
    // per tick early on and 1 year per tick later — the leading edge would race
    // across the first half of the axis and crawl through the second, and the
    // slider (index space) would sit somewhere else entirely from the edge
    // (year space). Driving the year directly makes both constant and agreed.
    let progress = FIRST_YEAR;
    let raf = 0;
    let last = 0;
    const SPEED = (LAST_YEAR - FIRST_YEAR) / 16000; // full sweep ≈ 16 s
    let chartEl: (HTMLElement & { series: unknown; xAxis: unknown }) | undefined;
    let sliderEl: (HTMLElement & { value: number }) | undefined;
    let btnEl: (HTMLElement & { icon: string }) | undefined;
    // While the thumb is held, playback must not fight the user for the value.
    let dragging = false;

    const apply = () => {
      if (!chartEl) return;
      const xs: number[] = [];
      const rows: (number | null)[][] = ENERGY_SOURCES.map(() => []);
      for (let i = 0; i <= LAST; i++) {
        const year = ENERGY_YEARS[i];
        xs.push(year);
        ENERGY_SOURCES.forEach((sr, k) => rows[k].push(year <= progress ? sr.data[i] : null));
        // The leading edge: an interpolated sample at exactly `progress`,
        // inserted between the year it has passed and the one it has not. This
        // is what keeps the sweep smooth between annual samples instead of
        // stepping a whole year at a time.
        if (i < LAST && year <= progress && ENERGY_YEARS[i + 1] > progress) {
          const span = ENERGY_YEARS[i + 1] - year;
          const f = span > 0 ? (progress - year) / span : 0;
          if (f > 1e-4) {
            xs.push(progress);
            ENERGY_SOURCES.forEach((sr, k) => rows[k].push(sr.data[i] + (sr.data[i + 1] - sr.data[i]) * f));
          }
        }
      }
      chartEl.xAxis = { data: xs, scale: 'value', valueFormatter: (v: number) => String(Math.round(v)) };
      chartEl.series = ENERGY_SOURCES.map((sr, k) => ({
        label: t(globals.locale, sr.key),
        color: sr.color,
        data: rows[k],
      }));
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
        .area-race-play::part(icon) {
          font-variation-settings: 'FILL' 1;
        }
      </style>
      <div style="max-width: 940px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
          <md-icon-button
            class="area-race-play"
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
        <md-area-chart
          style="height: 440px;"
          locale=${globals.locale}
          label=${t(globals.locale, 'area-chart.energy-race')}
          subtitle=${t(globals.locale, 'area-chart.energy-sub')}
          stack="normal"
          curve="linear"
          no-animation
          series-labels
          legend="bottom"
          grid="horizontal"
          .yAxis=${{ label: 'TWh', min: 0, max: 190000 }}
          .valueFormatter=${(v: number | null) =>
            v == null ? '—' : `${Math.round(v).toLocaleString(globals.locale)} TWh`}
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
        ></md-area-chart>
      </div>
    `;
  },
  play: chartPlay({
    // Parked on its first year until you start it, so its opening state says
    // nothing either way. What it is FOR is asserted below.
    settling: true,
    extra: async ({ charts, canvasElement }) => {
      const button = canvasElement.querySelector('md-icon-button') as HTMLElement & { icon: string };
      const slider = canvasElement.querySelector('md-slider') as (HTMLElement & { value: number }) | null;

      // The transport is what this story adds, and it is the part with state:
      // play latches to pause and back. Neither the pixels nor `series` are
      // asserted here — how much of a frame has landed at any instant is a
      // race, and a test that samples one is a test that fails at random.
      expect(button.icon).toBe('play_arrow');
      button.click();
      await waitFor(() => expect(button.icon).toBe('pause'));
      button.click();
      await waitFor(() => expect(button.icon).toBe('play_arrow'));

      // The slider is the other way through the same year, so it exists and
      // sits inside the range the story drives.
      if (slider) expect(Number.isFinite(slider.value)).toBe(true);
    },
  }),
};

/**
 * **Axis breaks** — a `yAxis.breaks: 'auto'` cut keeps the everyday values
 * readable when the metric later jumps to a whole other level. `'auto'` finds
 * the empty stretch between the two plateaus and cuts it; the axis is interrupted
 * with a smooth wave tear across the plot, each surviving section keeps its own
 * gridlines, and the area is split at the break rather than drawn through it.
 */
export const AxisBreaks: Story = {
  render: () => html`
    <div style="max-width: 720px;">
      <md-area-chart
        style="height: 360px;"
        label="Monthly active users"
        subtitle="An axis break keeps the pre-launch months readable next to the post-launch plateau"
        curve="smooth"
        show-marks
        .series=${[{ label: 'MAU (k)', color: '#6750A4', data: [8, 12, 18, 25, 1150, 1320, 1280, 1400] }]}
        .xAxis=${{ data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'] }}
        .yAxis=${{ label: 'MAU (k)', breaks: 'auto' }}
      ></md-area-chart>
    </div>
  `,
  play: chartPlay(),
};
