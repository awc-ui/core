import type { Decorator, Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';
import { chartPlay } from '../testing/chart-play';

/* --- Sample datasets ----------------------------------------
 * Realistic shapes (months, quarters, finance ticks) so stories
 * look like real product UIs instead of `[1, 2, 3]` placeholders.
 * ----------------------------------------------------------- */
/* Calendar names come from Intl, not the dictionary: month and weekday
 * abbreviations are exactly what Intl already knows, in every locale, and
 * hand-translating them would be both redundant and worse. Memoised because a
 * story can re-render every animation frame. */
const calCache = new Map<string, string[]>();
const cal = (key: string, build: () => string[]) => {
  let v = calCache.get(key);
  if (!v) { v = build(); calCache.set(key, v); }
  return v;
};
/** Short month names for a locale — `Jan`, `Janv.`, `1月`, … */
const monthsOf = (locale = 'en-US'): string[] =>
  cal(`m:${locale}`, () =>
    Array.from({ length: 12 }, (_, i) =>
      new Date(Date.UTC(2024, i, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })));
/** Short weekday names, Monday first — 2024-01-01 was a Monday. */
const weekdaysOf = (locale = 'en-US'): string[] =>
  cal(`w:${locale}`, () =>
    Array.from({ length: 7 }, (_, i) =>
      new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })));

const months = monthsOf();

const seriesRevenue = [
  { label: '2024', data: [12, 18, 14, 22, 28, 24, 30, 35, 32, 38, 42, 47] },
  { label: '2025', data: [16, 24, 21, 30, 38, 34, 42, 49, 47, 56, 62, 71] },
];

const dailyTicks = Array.from({ length: 60 }, (_, i) => Math.sin(i / 5) * 20 + 80 + Math.random() * 8);
/**
 * Enumerated placeholder categories (`A, B, C…`). Scripts enumerate with their
 * own sequences — katakana in Japanese, the heavenly stems in Chinese, abjad
 * order in Arabic — so a Japanese chart shouldn't be labelled with Latin
 * letters any more than an English one should be labelled with katakana.
 */
const SEQUENCES: Record<string, string[]> = {
  'ja-JP': ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク'],
  'zh-CN': ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛'],
  'ar-SA': ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'],
  'he-IL': ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'],
};
const lettersOf = (locale = 'en-US', n = 7) =>
  (SEQUENCES[locale] ?? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).slice(0, n);

/** Synthetic tick labels (`T1`, `第1点`, …) for the sample series. */
const tickAxisOf = (locale = 'en-US') =>
  Array.from({ length: 60 }, (_, i) => t(locale, 'line-chart.tick').replace('%n%', String(i + 1)));
/** `Q1 2024`-style labels in the active locale. */
const quartersOf = (locale = 'en-US', years = [2024, 2025]) =>
  years.flatMap((y) =>
    Array.from({ length: 4 }, (_, q) => `${t(locale, 'line-chart.quarter').replace('%n%', String(q + 1))} ${y}`));
const tickAxis = tickAxisOf();

/**
 * Localizes the strings md-line-chart renders ITSELF — the empty state, the
 * zoom slider's thumbs and the screen-reader table's chrome — across every
 * story in this file, from the Locale toolbar global.
 *
 * It runs here rather than per story because these strings belong to the
 * component, not to any story's content: a story author shouldn't have to
 * remember them, and a new story gets them for free. Values a story pins
 * itself are left alone. The `locale` PROP (number/date formatting) is handled
 * globally for all chart tags by `withDirectionLocale` in `.storybook/preview.ts`.
 *
 * Two frames of delay for the same reason that decorator waits: Stencil
 * hydrates after Storybook's render event.
 */
const withChartStrings: Decorator = (story, context) => {
  const locale = (context.globals.locale as string) || 'en-US';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.getElementById('storybook-root')?.querySelectorAll('md-line-chart').forEach((node) => {
        const c = node as HTMLElement & { tableLabels?: Record<string, string> };
        const fill = (attr: string, key: string) => {
          if (!c.hasAttribute(attr)) c.setAttribute(attr, t(locale, key));
        };
        fill('label-empty', 'line-chart.empty');
        fill('label-zoom-start', 'line-chart.a11y.zoom-start');
        fill('label-zoom-end', 'line-chart.a11y.zoom-end');
        c.tableLabels = {
          series: t(locale, 'line-chart.a11y.series-header'),
          truncated: t(locale, 'line-chart.a11y.truncated'),
          ...(c.tableLabels ?? {}),
        };
      });
    }),
  );
  return story();
};

const meta: Meta = {
  title: 'Charts/Line Chart',
  component: 'md-line-chart',
  tags: ['autodocs'],
  decorators: [withChartStrings],
  // Charts size fluidly to their container width (aspect-ratio driven); the
  // global 'centered' layout shrink-wraps the wrapper to the chart's minimum,
  // rendering it tiny. 'padded' lets the max-width wrappers expand to full width.
  parameters: { layout: 'padded', docs: { source: { language: 'html' } } },
  argTypes: {
    curve: {
      control: 'select',
      options: ['linear', 'smooth', 'monotone', 'step', 'step-before', 'step-middle'],
    },
    stack: {
      control: 'select',
      options: ['none', 'normal', 'percentage'],
    },
    legend: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'none'],
    },
    tooltip: { control: 'select', options: ['axis', 'item', 'none'] },
    titleAlign: { control: 'inline-radio', options: ['start', 'center', 'end'] },
    grid: { control: 'select', options: ['none', 'horizontal', 'vertical', 'both'] },
    axisTicks: { control: 'boolean' },
    zoom: { control: 'select', options: ['none', 'inside', 'slider', 'both'] },
    animation: { control: 'select', options: ['expressive', 'grow', 'fade', 'draw', 'none'] },
    animationDuration: { control: { type: 'number', min: 0, step: 100 } },
    area: { control: 'boolean' },
    showLine: { control: 'boolean' },
    showMarks: { control: 'boolean' },
    lineWidth: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    markSize: { control: { type: 'range', min: 2, max: 12, step: 0.5 } },
    connectNulls: { control: 'boolean' },
  },
  args: {
    curve: 'smooth',
    stack: 'none',
    legend: 'top-end',
    tooltip: 'axis',
    titleAlign: 'start',
    grid: 'horizontal',
    axisTicks: false,
    zoom: 'none',
    animation: 'expressive',
    animationDuration: 680,
    area: false,
    showLine: true,
    showMarks: false,
    lineWidth: 2.5,
    markSize: 3.5,
    connectNulls: false,
  },
};
export default meta;
type Story = StoryObj;

/* --- play() helpers ------------------------------------------
 * testing-library queries can't cross shadow roots, so play()
 * addresses the real host + its public @Method surface directly.
 * Mirrors the pattern used by the other chart stories. */
type LineChartEl = HTMLElement & {
  label: string;
  curve: string;
  stack: string;
  resize: () => Promise<void>;
  toDataURL: () => Promise<string>;
  getInstance: () => Promise<unknown | null>;
};
/** First `md-line-chart` in the canvas — hydrated + with a live engine. */
const getChart = async (
  canvasElement: HTMLElement,
  selector = 'md-line-chart',
): Promise<LineChartEl> => {
  const el = canvasElement.querySelector(selector) as LineChartEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  return el;
};

export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.revenue')}
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.usd-m') }}
        curve=${args.curve}
        stack=${args.stack}
        legend=${args.legend}
        tooltip=${args.tooltip}
        title-align=${args.titleAlign}
        grid=${args.grid}
        ?axis-ticks=${args.axisTicks}
        zoom=${args.zoom}
        animation=${args.animation}
        .animationDuration=${args.animationDuration}
        ?area=${args.area}
        .showLine=${args.showLine}
        ?show-marks=${args.showMarks}
        .lineWidth=${args.lineWidth}
        .markSize=${args.markSize}
        ?connect-nulls=${args.connectNulls}
      ></md-line-chart>
    </div>
  `,
  /** Exercises the public @Method surface, the @Watch reaction, and the
   *  ECharts-bridged hover / legend event handlers with real payloads. */
  play: async ({ canvasElement, step, globals }) => {
    const chart = await getChart(canvasElement);
    const initialLabel = chart.label;
    const initialCurve = chart.curve;
    const initialStack = chart.stack;
    const plot = () => chart.shadowRoot!.querySelector("[part=\"canvas\"]") as HTMLElement;
    const canvas = () => plot().querySelector("canvas") as HTMLCanvasElement;

    await step("public methods: getInstance / resize / toDataURL", async () => {
      expect(await chart.getInstance()).not.toBeNull();
      await chart.resize();
      expect(await chart.getInstance()).not.toBeNull();
      const url = await chart.toDataURL();
      expect(url.startsWith("data:image/")).toBe(true);
    });

    await step("changing a watched prop re-renders + rebuilds the a11y table", async () => {
      // The title this step writes is visible in the story afterwards, so it
      // comes from the dictionary like any other rendered string.
      const reactive = t(globals.locale as string, 'line-chart.reactive-title');
      chart.label = reactive;
      await waitFor(() => expect(plot().textContent).toContain(reactive));
      const a11y = chart.shadowRoot!.querySelector(".md-line-chart__a11y-table");
      await waitFor(() => expect(a11y!.textContent).toContain(reactive));
    });

    await step("pointer move over the plot fires mdHover with the category index", async () => {
      let hover: { dataIndex: number; axisValue: unknown } | undefined;
      chart.addEventListener("mdHover", (e) => { hover = (e as CustomEvent<{ dataIndex: number; axisValue: unknown }>).detail; }, { once: true });
      const cv = canvas();
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + r.width * 0.6, clientY: r.top + r.height * 0.5, bubbles: true }));
      await waitFor(() => expect(hover).toBeTruthy());
      expect(hover!.dataIndex).toBeGreaterThanOrEqual(0);
      expect(hover!.axisValue).toBe(months[hover!.dataIndex]);
      cv.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    });

    await step("clicking a legend entry toggles the series + fires mdLegendClick", async () => {
      let detail: { seriesIndex: number; selected: boolean } | undefined;
      chart.addEventListener("mdLegendClick", (e) => { detail = (e as CustomEvent<{ seriesIndex: number; selected: boolean }>).detail; }, { once: true });
      const firstChip = () => chart.shadowRoot!.querySelector("[part=\"legend\"] button") as HTMLButtonElement;
      expect(firstChip()).toBeTruthy();
      firstChip().click();
      await waitFor(() => expect(detail).toBeTruthy());
      expect(detail!.seriesIndex).toBe(0);
      expect(typeof detail!.selected).toBe("boolean");
      firstChip().click();
      await waitFor(() => expect(firstChip().style.textDecoration).not.toContain("line-through"));
    });

    await step("curve + stack props reshape the chart via re-render", async () => {
      chart.curve = "step";
      chart.stack = "percentage";
      await waitFor(async () => expect(await chart.getInstance()).not.toBeNull());
    });

    await step("reset to the clean resting state (visual baseline parity)", async () => {
      chart.label = initialLabel;
      chart.curve = initialCurve;
      chart.stack = initialStack;
      await waitFor(() => expect(plot().textContent).toContain(initialLabel));
      (document.activeElement as HTMLElement)?.blur();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  },
};

export const Basic: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 640px;">
      <md-line-chart
        .series=${[{ label: t(globals.locale, 'line-chart.axis.visitors'), data: [120, 200, 150, 80, 70, 110, 130] }]}
        .xAxis=${{ data: weekdaysOf(globals.locale) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const MultiSeries: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.sales-by-region')}
        .series=${[
          { label: t(globals.locale, 'line-chart.region.emea'), data: [400, 320, 510, 480, 600, 690] },
          { label: t(globals.locale, 'line-chart.region.amer'), data: [320, 410, 380, 450, 580, 640] },
          { label: t(globals.locale, 'line-chart.region.apac'), data: [180, 240, 290, 320, 410, 470] },
        ]}
        .xAxis=${{ data: [1, 2, 3, 4, 1, 2].map((q) => t(globals.locale, 'line-chart.quarter').replace('%n%', String(q))) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const CurveTypes: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; max-width: 960px;">
      ${(['linear', 'smooth', 'monotone', 'step', 'step-before', 'step-middle'] as const).map(
        (curve) => html`
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">${curve}</p>
            <md-line-chart
              curve=${curve}
              show-marks
              .series=${[{ label: t(globals.locale, 'line-chart.series.value'), data: [5, 12, 8, 18, 14, 22, 28] }]}
              .xAxis=${{ data: lettersOf(globals.locale, 7) }}
              style="--md-line-chart-aspect-ratio: 2 / 1;"
            ></md-line-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay(),
};


export const Stacked: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.stacked-normal')}
        area
        stack="normal"
        .series=${[
          { label: t(globals.locale, 'line-chart.series.direct'), data: [10, 22, 28, 35, 41, 38, 52] },
          { label: t(globals.locale, 'line-chart.series.organic'), data: [18, 24, 32, 40, 48, 45, 60] },
          { label: t(globals.locale, 'line-chart.series.paid'), data: [8, 12, 14, 22, 30, 28, 36] },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale).slice(0, 7) }}
      ></md-line-chart>

      <md-line-chart
        label=${t(globals.locale, 'line-chart.stacked-pct')}
        area
        stack="percentage"
        .series=${[
          { label: t(globals.locale, 'line-chart.series.mobile'), data: [40, 45, 48, 55, 62, 64] },
          { label: t(globals.locale, 'line-chart.series.desktop'), data: [45, 40, 35, 30, 25, 20] },
          { label: t(globals.locale, 'line-chart.series.tablet'), data: [15, 15, 17, 15, 13, 16] },
        ]}
        .xAxis=${{ data: ['2020', '2021', '2022', '2023', '2024', '2025'] }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const ConnectNulls: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        connect-nulls
        show-marks
        label=${t(globals.locale, 'line-chart.connect-nulls')}
        .series=${[{ label: t(globals.locale, 'line-chart.series.value'), data: [10, 18, null, null, 22, 28, null, 36] }]}
        .xAxis=${{ data: lettersOf(globals.locale, 8) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Interactive zoom** (`zoom="inside" | "slider" | "both"`). Drag horizontally
 * across the plot to zoom into that span, double-click to reset, or work the
 * `md-slider` underneath: drag either thumb to resize the window, click the
 * track to jump the nearest thumb, drag the window itself to pan. Both thumbs
 * are focusable and take Arrow, Home/End and PageUp/PageDown.
 *
 * Zoom is a **view**, not a data mutation: `series`/`xAxis` are never modified,
 * and `mdHover`/`mdMarkerClick` keep reporting absolute indices into your own
 * data, so a tooltip at the middle of a 21–40 window still says index 30.
 * `mdZoom` reports the window; `setZoom(a, b)` / `resetZoom()` drive it
 * programmatically.
 */
export const WithZoom: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        zoom="both"
        label=${t(globals.locale, 'line-chart.zoom-hint')}
        .series=${[{ label: t(globals.locale, 'line-chart.series.value'), data: dailyTicks }]}
        .xAxis=${{ data: tickAxisOf(globals.locale) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const LegendPositions: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; max-width: 960px;">
      ${(['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end'] as const).map(
        (legend) => html`
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">${legend}</p>
            <md-line-chart
              legend=${legend}
              .series=${seriesRevenue}
              .xAxis=${{ data: monthsOf(globals.locale) }}
              style="--md-line-chart-aspect-ratio: 16 / 8;"
            ></md-line-chart>
          </div>
        `,
      )}
    </div>
  `,
  play: chartPlay(),
};

export const CustomColors: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.color-overrides')}
        .series=${[
          { label: t(globals.locale, 'line-chart.series.brand'), data: [10, 22, 28, 35, 41, 52], color: '#FF5722' },
          { label: t(globals.locale, 'line-chart.series.accent'), data: [18, 24, 32, 40, 48, 60], color: '#009688' },
          { label: t(globals.locale, 'line-chart.series.subtle'), data: [8, 12, 14, 22, 30, 36], color: 'secondary' },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale).slice(0, 6) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const ValueFormatter: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.locale-formatters')}
        .series=${[{ label: t(globals.locale, 'line-chart.revenue'), data: [1200, 1850, 2400, 3100, 2900, 3800] }]}
        .xAxis=${{ data: monthsOf(globals.locale).slice(0, 6) }}
        .yAxis=${{ valueFormatter: (v: number) => `$${(v / 1000).toFixed(1)}k` }}
        .valueFormatter=${(v: number) => '$' + v.toLocaleString()}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **RTL.** In a right-to-left context the whole plot mirrors: the value axis and
 * its tick labels move to the **right**, the category axis runs **right-to-left**
 * (the first category on the right), the title anchors from the right, a
 * `top-end` legend moves to the left, and the tooltip opens leftward from the
 * crosshair. The entry animation sweeps right-to-left too, so `draw` follows the
 * reading direction.
 *
 * Nothing to configure: the chart reads the **computed** `direction`, so it
 * follows `dir` on any ancestor or on the document — flip the **Dir** control in
 * the toolbar and *every* story on this page mirrors. It also re-renders if the
 * direction changes after mount, which is what makes a runtime locale switch
 * work.
 *
 * Data is untouched — `dataIndex`, `axisValue` and every event payload stay
 * identical; only pixels move. A click, a hover or a drag-zoom on the mirrored
 * chart reports exactly what it reports in LTR.
 */
export const RTL: Story = {
  render: (_args, { globals }) => html`
    <div dir="rtl" style="display: grid; gap: 24px; max-width: 760px;">
      <md-line-chart
        label="مبيعات حسب المنطقة"
        subtitle="المحور الرأسي على اليمين، والزمن من اليمين إلى اليسار"
        legend="top-end"
        grid="horizontal"
        show-marks
        .series=${[
          { label: 'الشرق الأوسط', color: 'primary', data: [400, 320, 510, 480, 600, 690] },
          { label: 'أوروبا', color: 'tertiary', data: [320, 410, 380, 450, 580, 640] },
        ]}
        .xAxis=${{ data: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'] }}
        .yAxis=${{ label: 'المبيعات' }}
      ></md-line-chart>

      <md-line-chart
        label=${t(globals.locale, 'line-chart.rtl-zoom')}
        subtitle=${t(globals.locale, 'line-chart.rtl-zoom-sub')}
        area
        zoom="both"
        grid="both"
        legend="bottom"
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.usd-m') }}
      ></md-line-chart>
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
      <md-line-chart
        label=${t(globals.locale, 'line-chart.revenue')}
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * Dark-dashboard showcase — a solid primary "Users" line against a dotted
 * "Average" reference line, in the vein of a real analytics tile. Exercises the
 * per-series `dash: 'dotted'` line style, a value-axis with a `k` formatter, an
 * explicit y-max, and a rich slotted header (title + subtitle).
 */
export const ApplicationUsers: Story = {
  parameters: { layout: 'fullscreen' },
  render: (_args, { globals }) => {
    // Hour-of-day labels from Intl: 12-hour with AM/PM in en-US, 24-hour in
    // most other locales — a hardcoded '12 AM' list is wrong everywhere else.
    const hours = Array.from({ length: 24 }, (_, h) =>
      new Date(Date.UTC(2024, 0, 1, h)).toLocaleTimeString(globals.locale, { hour: 'numeric', timeZone: 'UTC' }));
    const users = [1000, 600, 900, 1000, 900, 1000, 4000, 4000, 4200, 4300, 5200, 6100, 7700, 8100, 10000, 4100, 3900, 3900, 4200, 3500, 2800, 2000, 1400, 1300];
    const average = [850, 800, 800, 800, 800, 850, 1000, 1300, 1900, 2100, 2200, 2300, 2400, 2500, 3100, 2700, 2400, 2000, 2400, 2300, 2000, 1500, 1000, 900];
    const kFormat = (v: number | null) => (v == null ? '' : v === 0 ? '0' : `${v / 1000}k`);
    return html`
      <div style="background: var(--md-sys-color-surface); padding: 28px 36px; min-block-size: 560px;">
        <md-line-chart
          curve="smooth"
          legend="bottom"
          grid="both"
          axis-ticks
          .valueFormatter=${kFormat}
          .series=${[
            { label: t(globals.locale, 'line-chart.axis.users'), color: 'primary', data: users },
            { label: t(globals.locale, 'line-chart.series.average'), color: 'secondary', dash: 'dotted', data: average },
          ]}
          .xAxis=${{ data: hours }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.unique-users'), max: 12500 }}
          style="block-size: 480px;"
        >
          <!-- The canvas is absolutely positioned under the header, so the header needs an OPAQUE
               background to mask any plot pixels behind its text. Mirror the chart's own surface
               rather than hardcoding a colour that only matched a transparent chart — this tracks
               the tinted default and any --md-line-chart-background override. (Note: "inherit"
               does NOT work here; it computes to transparent through the slot.) -->
          <div slot="header" style="position: relative; z-index: 1; padding-block-end: 12px; background: var(--md-line-chart-background, var(--md-sys-color-surface-container-low, #F7F2FA)); font: var(--md-sys-typescale-body-medium-font, 400 14px/20px 'Roboto', system-ui, sans-serif);">
            <div style="font-size: 22px; font-weight: 700; color: var(--md-sys-color-on-surface); letter-spacing: -0.01em;">
              ${t(globals.locale, 'line-chart.app-users')}
            </div>
            <div style="font-size: 13px; color: var(--md-sys-color-on-surface-variant); margin-block-start: 2px;">
              ${t(globals.locale, 'line-chart.all-traffic')}
            </div>
          </div>
        </md-line-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      /* The tinted surface is the DEFAULT — opt out to sit flush on the page. */
      .flush {
        --md-line-chart-background: transparent;
        --md-line-chart-padding: 0px;
        --md-line-chart-shape: 0;
      }
      .tight {
        --md-line-chart-aspect-ratio: 16 / 5;
        --md-line-chart-min-block-size: 120px;
      }
    </style>
    <div style="display: grid; gap: 24px; max-width: 720px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.css.tinted')}
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
      ></md-line-chart>

      <md-line-chart
        class="flush"
        label=${t(globals.locale, 'line-chart.css.flush')}
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
      ></md-line-chart>

      <md-line-chart
        class="tight"
        label=${t(globals.locale, 'line-chart.css.aspect')}
        .series=${[{ label: t(globals.locale, 'line-chart.series.value'), data: dailyTicks }]}
        .xAxis=${{ data: tickAxisOf(globals.locale), hideTicks: true }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * Axis-line and gridline colours are customisable per chart via the
 * `--md-chart-axis-color` and `--md-chart-grid-color` CSS custom properties
 * (they fall back to the MD3 `outline` / `outline-variant` tokens).
 */
export const CustomGridColors: Story = {
  render: (_args, { globals }) => html`
    <div
      style="max-width: 640px; --md-chart-axis-color: #7c6fd6; --md-chart-grid-color: rgba(124, 111, 214, 0.22);"
    >
      <md-line-chart
        label=${t(globals.locale, 'line-chart.custom-grid')}
        grid="both"
        .series=${[{ label: t(globals.locale, 'line-chart.axis.signups'), data: [12, 19, 15, 24, 28, 22, 30], color: '#7c6fd6' }]}
        .xAxis=${{ data: weekdaysOf(globals.locale) }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

export const EmptyState: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 480px;">
      <!-- Default empty state — no slot, just the built-in message. -->
      <md-line-chart label=${t(globals.locale, 'line-chart.no-data')}></md-line-chart>

      <!-- Custom message WITH an icon. The empty state is a column flex
           container, so a slotted icon and text stack and centre on their own;
           the icon is sized by --md-line-chart-empty-icon-size. -->
      <md-line-chart label=${t(globals.locale, 'line-chart.no-data')}>
        <span slot="empty" class="material-symbols-outlined" aria-hidden="true">query_stats</span>
        <div slot="empty">
          <p style="margin: 0; font-weight: 500;">${t(globals.locale, 'line-chart.empty-title')}</p>
          <p style="margin: 4px 0 0;">${t(globals.locale, 'line-chart.empty-body')}</p>
        </div>
      </md-line-chart>
    </div>
  `,
  play: chartPlay({ empty: true }),
};

export const AreaColorFormats: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 720px;">
      <md-line-chart
        area
        label=${t(globals.locale, 'line-chart.area-formats')}
        .series=${[
          { label: t(globals.locale, 'line-chart.series.rgb'), data: [10, 22, 28, 35, 41, 52], color: 'rgb(0, 150, 136)' },
          { label: t(globals.locale, 'line-chart.series.rgba'), data: [18, 24, 32, 40, 48, 60], color: 'rgba(255, 87, 34, 0.5)' },
          { label: t(globals.locale, 'line-chart.series.named-colour'), data: [8, 12, 14, 22, 30, 36], color: 'teal' },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale).slice(0, 6) }}
      ></md-line-chart>
    </div>
  `,
  /** area=true routes every series colour through hexToRgba(): the rgb()
   *  string is converted to rgba(), while rgba()/named formats pass through. */
  play: async ({ canvasElement }) => {
    const chart = await getChart(canvasElement);
    // area=true across rgb()/rgba()/named colour formats — the engine resolves
    // each and paints an area fill. Assert it rendered a real frame + 3 series.
    expect(await chart.getInstance()).not.toBeNull();
    const url = await chart.toDataURL();
    expect(url.startsWith("data:image/")).toBe(true);
    await waitFor(() => expect(chart.shadowRoot!.querySelectorAll("[part=\"legend\"] button").length).toBe(3));
  },
};

/* --- Animation showcases ------------------------------------ */
const animMonthsOf = (locale = 'en-US') => monthsOf(locale).slice(0, 10);
const animData = [40, 62, 55, 78, 70, 96, 88, 110, 102, 128];
const ANIMATION_VARIANTS = ['expressive', 'grow', 'fade', 'draw', 'none'] as const;

/**
 * The entry animation is configurable via the `animation` prop —
 * `expressive` (default), `grow`, `fade`, `draw`, or `none` (off; also
 * settable with `no-animation`). `animation-duration` overrides the timing,
 * and the `replay()` method restarts it. Every variant honours
 * `prefers-reduced-motion`. Press **Replay all** to see them run.
 */
export const AnimationVariants: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 1100px;">
      <div
        id="anim-variants"
        style="display:grid; gap:24px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr));"
      >
        ${ANIMATION_VARIANTS.map(
          (v) => html`
            <figure style="margin:0;">
              <figcaption
                style="font:600 13px/1.4 var(--md-sys-typescale-label-large-font, Roboto, sans-serif); color:var(--md-sys-color-on-surface); margin-block-end:4px;"
              >
                animation="${v}"
              </figcaption>
              <md-line-chart
                style="height:220px;"
                animation=${v}
                curve="smooth"
                grid="both"
                .series=${[{ label: t(globals.locale, 'line-chart.axis.users'), data: animData, color: 'primary' }]}
                .xAxis=${{ data: animMonthsOf(globals.locale) }}
              ></md-line-chart>
            </figure>
          `,
        )}
      </div>
      <md-button
        variant="filled"
        trailing-icon="replay"
        style="margin-block-start:20px;"
        @click=${() =>
          document
            .querySelectorAll('#anim-variants md-line-chart')
            .forEach((c) => (c as HTMLElement & { replay: () => Promise<void> }).replay())}
      >
        Replay all
      </md-button>
    </div>
  `,
  play: chartPlay(),
};

/**
 * `animation="stagger"` draws each series **one at a time**, left-to-right: line
 * 1 completes, then line 2 begins, and so on. The whole timeline scales with the
 * series count (`animation-duration` sets the per-series draw time). Great for
 * multi-line dashboards where you want the eye to follow each series in turn.
 */
export const SequentialDraw: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: (_args, { globals }) => {
    const series = [
      { label: t(globals.locale, 'line-chart.series.north'), color: 'primary', data: [12, 20, 18, 32, 28, 44, 40, 56] },
      { label: t(globals.locale, 'line-chart.series.south'), color: 'tertiary', data: [30, 26, 34, 28, 40, 36, 48, 44] },
      { label: t(globals.locale, 'line-chart.series.east'), color: 'secondary', data: [8, 14, 22, 18, 30, 34, 42, 52] },
      { label: t(globals.locale, 'line-chart.series.west'), color: 'error', data: [40, 44, 38, 46, 42, 50, 46, 58] },
    ];
    return html`
      <div style="max-width: 860px;">
        <md-line-chart
          id="stagger-demo"
          style="height:360px;"
          animation="stagger"
          animation-duration="700"
          curve="smooth"
          grid="horizontal"
          legend="bottom"
          label=${t(globals.locale, 'line-chart.sequential-draw')}
          .series=${series}
          .xAxis=${{ data: [0, 1, 2, 3, 4, 5, 6, 7], scale: 'value', label: t(globals.locale, 'line-chart.axis.quarter') }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.units-k'), min: 0 }}
        ></md-line-chart>
        <md-button
          variant="filled"
          trailing-icon="replay"
          style="margin-block-start:16px;"
          @click=${() => (document.getElementById('stagger-demo') as HTMLElement & { replay: () => Promise<void> })?.replay()}
        >
          Replay
        </md-button>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * Each series can pick its own data-point marker shape via `symbol`:
 * `circle` (default), `square`, `diamond`, `triangle`, `triangle-down`, or
 * `none` (hide this series' markers). Marks must be shown (`show-marks` or a
 * per-series `showMarks`).
 */
export const MarkerSymbols: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 820px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.monthly-temp')}
        show-marks
        curve="smooth"
        legend="bottom"
        grid="horizontal"
        .series=${[
          { label: t(globals.locale, 'line-chart.place.tokyo'), color: 'primary', symbol: 'square', data: [5, 6, 9, 14, 18, 21, 25, 27, 23, 18, 12, 8] },
          { label: t(globals.locale, 'line-chart.place.bergen'), color: 'tertiary', symbol: 'diamond', data: [2, 2, 3, 6, 10, 13, 15, 15, 11, 9, 5, 3] },
          { label: t(globals.locale, 'line-chart.place.cairo'), color: 'secondary', symbol: 'triangle', data: [14, 15, 18, 22, 26, 29, 30, 30, 28, 25, 20, 16] },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: '°C' }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * Markers can be emoji / short text, either for a whole series (`symbol: '⭐'`)
 * or — via the sparse `pointSymbols` map — to accent individual points (a ☀️ on
 * the peak, a 🌨️ on the cold month). A `pointSymbols` accent shows even where
 * `show-marks` is off, so you can annotate one point without markers everywhere.
 */
export const EmojiMarkers: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width: 860px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.monthly-temp')}
        show-marks
        curve="smooth"
        legend="bottom"
        grid="horizontal"
        .series=${[
          { label: t(globals.locale, 'line-chart.place.tokyo'), color: 'primary', symbol: 'square', pointSymbols: { 7: '☀️' }, data: [5, 6, 9, 14, 18, 21, 25, 27, 23, 18, 12, 8] },
          { label: t(globals.locale, 'line-chart.place.bergen'), color: 'tertiary', symbol: 'diamond', pointSymbols: { 0: '🌨️' }, data: [2, 2, 3, 6, 10, 13, 15, 15, 11, 9, 5, 3] },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: '°C' }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **100,000 points**, two shapes (a normal chart here has ~12). Datasets this
 * dense are comfortable because the engine decimates the *drawn* polyline to
 * its per-pixel-column min/max envelope (`decimateMinMax`, the same trick as
 * Highcharts' Boost and uPlot) — every point that could not have been resolved
 * on screen is dropped before stroking, so the result is pixel-identical to
 * drawing them all.
 *
 * That matters most for noisy data, where an undecimated chart strokes hundreds
 * of overlapping segments per pixel column. The envelope is preserved, so a
 * dense series still reads as the band it should be, and spikes survive.
 *
 * Decimation only engages above 4 points per horizontal pixel, so ordinary
 * charts are untouched. Hover and tooltips still index the *full* run — they
 * report real datapoints, not envelope vertices.
 *
 * Markers and the entry animation are off (meaningless at this density); the
 * screen-reader table still caps at 200 rows.
 */
export const MassiveDataset: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => {
    const N = 100_000;
    // A smooth multi-harmonic curve whose fastest component still spans dozens of
    // pixels, so it traces a crisp line rather than a band.
    const smooth = Array.from(
      { length: N },
      (_, i) => 50 + Math.sin(i * 0.00021) * 30 + Math.sin(i * 0.00085) * 9 + Math.sin(i * 0.00006 + 0.7) * 7,
    );
    // Deterministic noise (no Math.random, so the story is stable) — the shape
    // that used to be pathological: a wide band with a slow drift through it.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const noisy = Array.from({ length: N }, (_, i) => 50 + Math.sin(i * 0.00002) * 18 + (rnd() - 0.5) * 60);
    const xs = Array.from({ length: N }, (_, i) => i);
    return html`
      <div style="display: grid; gap: 24px; max-width: 900px;">
        <md-line-chart
          label=${t(globals.locale, 'line-chart.massive-smooth')}
          curve="linear"
          no-animation
          legend="none"
          grid="horizontal"
          .series=${[{ label: t(globals.locale, 'line-chart.series.signal'), color: 'primary', data: smooth }]}
          .xAxis=${{ data: xs }}
        ></md-line-chart>

        <md-line-chart
          label=${t(globals.locale, 'line-chart.massive-noisy')}
          curve="linear"
          no-animation
          legend="none"
          grid="horizontal"
          .series=${[{ label: t(globals.locale, 'line-chart.series.signal'), color: 'primary', data: noisy }]}
          .xAxis=${{ data: xs }}
        ></md-line-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/**
 * A logarithmic y-axis (`yAxis.scale = "log"`) compresses many orders of
 * magnitude — the axis snaps to power-of-ten gridlines (10 → 100 → 1k → 10k)
 * and the data sits cleanly between them. Great for exponential growth.
 */
export const LogScale: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 860px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.log-scale')}
        curve="smooth"
        show-marks
        legend="bottom"
        grid="horizontal"
        .valueFormatter=${(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
        .series=${[{ label: t(globals.locale, 'line-chart.series.internet-users'), color: 'tertiary', data: [16, 361, 1018, 2000, 3200, 4700, 5300] }]}
        .xAxis=${{ data: [1995, 2000, 2005, 2010, 2015, 2020, 2023], scale: 'value', label: t(globals.locale, 'line-chart.axis.year'), valueFormatter: (v: number) => `${v}` }}
        .yAxis=${{ scale: 'log', label: t(globals.locale, 'line-chart.axis.internet-millions') }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Line-race (F1) data -------------------------------------
 * The real 2026 drivers' championship: cumulative points after each of the 10
 * rounds run so far, Australia (8 Mar) through Belgium (19 Jul 2026). Team
 * colours, ordered by the standings after Spa.
 * Source: Jolpica-F1 (the Ergast successor), /f1/2026/{round}/driverstandings.
 * ----------------------------------------------------------- */
const F1_ROUNDS = 10;
const F1_DRIVERS = [
  { key: 'line-chart.driver.antonelli', color: '#00D7B6', cum: [0, 18, 47, 72, 100, 131, 156, 156, 171, 179, 204] },
  { key: 'line-chart.driver.hamilton', color: '#E8002D', cum: [0, 12, 33, 41, 51, 72, 90, 115, 125, 147, 159] },
  { key: 'line-chart.driver.russell', color: '#28E6C6', cum: [0, 25, 51, 63, 80, 88, 88, 106, 131, 154, 154] },
  { key: 'line-chart.driver.leclerc', color: '#FF5A6E', cum: [0, 15, 34, 49, 59, 75, 75, 75, 79, 108, 126] },
  { key: 'line-chart.driver.norris', color: '#FF8000', cum: [0, 10, 15, 25, 51, 58, 58, 73, 79, 97, 103] },
  { key: 'line-chart.driver.piastri', color: '#FFB366', cum: [0, 0, 3, 21, 43, 48, 58, 68, 80, 82, 92] },
  { key: 'line-chart.driver.verstappen', color: '#3671C6', cum: [0, 8, 8, 12, 26, 43, 43, 55, 73, 76, 91] },
  { key: 'line-chart.driver.hadjar', color: '#8FB3F0', cum: [0, 0, 4, 4, 4, 14, 26, 34, 42, 52, 60] },
  { key: 'line-chart.driver.gasly', color: '#0093CC', cum: [0, 1, 9, 15, 16, 20, 35, 41, 41, 42, 42] },
  { key: 'line-chart.driver.lawson', color: '#6692FF', cum: [0, 0, 8, 10, 10, 16, 24, 28, 30, 39, 39] },
];
const F1_CUM = F1_DRIVERS.map((d) => d.cum);

/**
 * Line-race: press play (or drag the slider) and the standings grow *smoothly*
 * round by round — not frame-by-frame. A `requestAnimationFrame` loop advances a
 * fractional playhead and interpolates the leading edge of every line, so the
 * lines (and their `series-labels` names) glide continuously. The story just
 * re-feeds the chart's `series`/`xAxis`; the chart reacts.
 *
 * `withSeriesLabels` toggles the end-of-line driver names. With them off, the
 * drawing area reclaims the right gutter and spans the full width, so the bottom
 * legend sits 1-to-1 beneath the plot (see `LineRaceFullWidth`).
 *
 * You can also **click a driver in the legend mid-race** to hide/show that line —
 * the toggle sticks even as the chart keeps re-feeding data every frame.
 */
const makeRaceRender = (withSeriesLabels: boolean) => (_args: unknown, { globals }: { globals: Record<string, string> }) => {
    let progress = 3; // fractional round (0 … F1_ROUNDS)
    let raf = 0;
    let last = 0;
    const SPEED = F1_ROUNDS / 14000; // rounds per ms → full race ≈ 14 s
    let chartEl: (HTMLElement & { series: unknown; xAxis: unknown }) | undefined;
    let sliderEl: (HTMLElement & { value: number }) | undefined;
    let btnEl: (HTMLElement & { icon: string }) | undefined;
    let dragging = false;
    const intLabel = (v: number) => (Number.isInteger(v) ? String(v) : '');

    const apply = () => {
      if (!chartEl) return;
      const p = progress;
      const fl = Math.floor(p);
      const frac = p - fl;
      // The FULL axis (rounds 0…20) is always present so every tick renders from
      // the start; only the data grows. Future rounds are null, and the leading
      // edge is an interpolated point inserted just after the current round.
      const xs: number[] = [];
      const rows: (number | null)[][] = F1_DRIVERS.map(() => []);
      for (let r = 0; r <= F1_ROUNDS; r++) {
        xs.push(r);
        F1_DRIVERS.forEach((_, i) => rows[i].push(r <= fl ? F1_CUM[i][r] : null));
        if (r === fl && frac > 1e-4 && fl < F1_ROUNDS) {
          xs.push(fl + frac);
          F1_DRIVERS.forEach((_, i) => rows[i].push(F1_CUM[i][fl] + (F1_CUM[i][fl + 1] - F1_CUM[i][fl]) * frac));
        }
      }
      chartEl.xAxis = { data: xs, scale: 'value', label: t(globals.locale, 'line-chart.axis.round'), valueFormatter: intLabel };
      chartEl.series = F1_DRIVERS.map((d, i) => ({ label: t(globals.locale, d.key), color: d.color, data: rows[i] }));
      if (sliderEl && !dragging) sliderEl.value = p;
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
      progress = Math.min(F1_ROUNDS, progress + (now - last) * SPEED);
      last = now;
      apply();
      if (progress >= F1_ROUNDS) return stop();
      raf = requestAnimationFrame(frame);
    };
    const play = () => {
      if (progress >= F1_ROUNDS) progress = 0;
      if (btnEl) btnEl.icon = 'pause';
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const toggle = () => (raf ? stop() : play());

    return html`
      <style>
        /* Material Symbols default to outlined; fill the play/pause glyph. */
        .race-play::part(icon) {
          font-variation-settings: 'FILL' 1;
        }
      </style>
      <div style="max-width: 940px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
          <md-icon-button
            class="race-play"
            variant="filled"
            shape="round"
            icon="play_arrow"
            aria-label=${t(globals.locale, 'line-chart.play-pause')}
            ${ref((el) => {
              btnEl = el as typeof btnEl;
            })}
            @click=${toggle}
          ></md-icon-button>
          <md-slider
            min="0"
            max=${F1_ROUNDS}
            step="0.01"
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
        <md-line-chart
          ${ref((el) => {
            chartEl = el as typeof chartEl;
            if (el) requestAnimationFrame(apply);
          })}
          label=${t(globals.locale, 'line-chart.f1-title')}
          curve="linear"
          ?series-labels=${withSeriesLabels}
          no-animation
          legend="bottom"
          grid="horizontal"
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.points'), min: 0, max: 220 }}
        ></md-line-chart>
      </div>
    `;
};

export const LineRace: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: makeRaceRender(true),
  // Parked on its first year until you start it, so its opening state says
  // nothing either way — see `settling`.
  play: chartPlay({ settling: true }),
};

/**
 * Same race, **full-width drawing area**: the end-of-line driver names are off,
 * so the plot reclaims the right gutter and stretches edge-to-edge. Lines are
 * identified by the bottom legend, which now sits 1-to-1 beneath the chart
 * surface.
 */
export const LineRaceFullWidth: Story = {
  parameters: { visual: { skip: true }, controls: { disable: true } },
  render: makeRaceRender(false),
  // Same transport as LineRace, so the same undecided opening.
  play: chartPlay({ settling: true }),
};

/**
 * `show-labels` prints each point's value beside its marker — handy for exact
 * read-off without hovering. Values use the chart's `valueFormatter`.
 */
export const DataLabels: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 900px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.monthly-temp')}
        show-labels
        show-marks
        curve="smooth"
        legend="bottom"
        grid="horizontal"
        .valueFormatter=${(v: number) => `${v}`}
        .series=${[
          { label: t(globals.locale, 'line-chart.place.reggane'), color: 'primary', data: [16, 18.2, 23.1, 27.9, 32.2, 36.4, 39.8, 38.4, 35.5, 29.2, 22, 17.8] },
          { label: t(globals.locale, 'line-chart.place.tallinn'), color: 'tertiary', data: [-2.9, -3.6, -0.6, 4.8, 10.2, 14.5, 17.6, 16.5, 12, 6.5, 2, -0.9] },
        ]}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.temp-c') }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * Inverted axes (`inverted`): the x-axis data runs vertically and the values
 * horizontally, so the line is a function of the vertical axis and can double
 * back — the classic atmospheric temperature-by-altitude profile. Pairs with
 * `curve="smooth"` (a Catmull-Rom spline handles the non-monotone path).
 */
export const InvertedSpline: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 820px;">
      <md-line-chart
        label=${t(globals.locale, 'line-chart.altitude-temp')}
        inverted
        curve="smooth"
        show-marks
        grid="horizontal"
        legend="none"
        .valueFormatter=${(v: number) => `${v}°`}
        .series=${[{ label: t(globals.locale, 'line-chart.axis.temperature'), color: 'primary', data: [15, -50, -55, -50, -47, -22, -2, -28, -56, -76] }]}
        .xAxis=${{ data: [0, 10, 20, 25, 30, 40, 50, 60, 70, 80], scale: 'value', label: t(globals.locale, 'line-chart.axis.altitude'), valueFormatter: (v: number) => `${v} km` }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.temperature') }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

// ── World-Bank-style multi-axis demo data (deterministic, ~yearly) ──────────
const wbYears = Array.from({ length: 64 }, (_, i) => 1960 + i);
const gauss = (y: number, mu: number, sig: number, amp: number) => amp * Math.exp(-((y - mu) ** 2) / (2 * sig * sig));
const wbInflation = wbYears.map((y) => 2.6 + gauss(y, 1974, 3, 7) + gauss(y, 1980, 3.5, 9) + gauss(y, 2021, 2.5, 5) - gauss(y, 2009, 3, 3) + Math.sin(y / 2) * 0.5);
const wbClaims = wbYears.map((y) => 52 - gauss(y, 1981, 9, 42) + (y - 1990) * 0.25);
const wbForeign = wbYears.map((y) => (1.1e11 * Math.sin((y - 1962) / 6.5) + (y - 2004) * 6e9) * (y > 1998 ? 1.6 : 1));
const wbDomestic = wbYears.map((y) => 32e12 * Math.max(0, (y - 1960) / 63) ** 2.3);

/**
 * **Multiple independent value axes** (`y-axes`) — each series is measured
 * against its own scale (`series.yAxisIndex`), and the axes stack outward from
 * the plot (`position: 'left' | 'right'`), so four wildly different scales (%, %,
 * ±LCU, LCU) share one chart. Each axis defaults to the themed axis colour (the
 * same muted grey as the x-axis); set an axis `color` (an MD3 role or CSS colour)
 * to tint its line, labels and title — e.g. to match its series. Paired with
 * `animation="stagger"` so each line draws in turn. Modelled on the World Bank's
 * inflation dashboard.
 */
export const MultiAxis: Story = {
  parameters: { visual: { skip: true }, layout: 'fullscreen' },
  render: (_args, { globals }) => html`
    <div style="max-width: 1000px; padding: 16px;">
      <md-line-chart
        style="height: 460px;"
        label=${t(globals.locale, 'line-chart.us-inflation')}
        curve="smooth"
        animation="stagger"
        grid="horizontal"
        legend="bottom"
        .series=${[
          { label: t(globals.locale, 'line-chart.series.inflation-cpi'), color: '#4a90e2', yAxisIndex: 0, data: wbInflation },
          { label: t(globals.locale, 'line-chart.series.claims-gdp'), color: '#43c463', yAxisIndex: 1, data: wbClaims },
          { label: t(globals.locale, 'line-chart.series.foreign-lcu'), color: '#e6c419', yAxisIndex: 2, data: wbForeign },
          { label: t(globals.locale, 'line-chart.series.domestic-lcu'), color: '#ff7043', yAxisIndex: 3, data: wbDomestic },
        ]}
        .xAxis=${{ data: wbYears, scale: 'value', valueFormatter: (v: number) => String(Math.round(v)) }}
        .yAxes=${[
          { scale: 'value', min: -5, max: 15, position: 'left', label: t(globals.locale, 'line-chart.series.inflation') },
          { scale: 'value', min: 0, max: 80, position: 'left', label: t(globals.locale, 'line-chart.axis.claims') },
          { scale: 'value', position: 'right', label: t(globals.locale, 'line-chart.axis.foreign'), valueFormatter: (v: number) => `${Math.round(v / 1e9)}G` },
          { scale: 'value', min: 0, position: 'right', label: t(globals.locale, 'line-chart.axis.domestic'), valueFormatter: (v: number) => `${(v / 1e12).toFixed(0)}T` },
        ]}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Past vs. forecast** — one line that's **solid** for observed data and
 * **dotted** beyond "now" (`series.dashAfter` splits it at a boundary index).
 * A vertical `mark-lines` divider labels the current time, points use `hollow`
 * (open-ring) markers, and a `subtitle` sits under the title. Colours are MD3
 * roles (`primary` for the series, `secondary` for the divider) rather than raw
 * hexes, so they follow the app's theme. Modelled on a weather app's hourly
 * forecast.
 */
export const WeatherForecast: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => {
    // Day markers are dates and hours are times, so both come from Intl in the
    // active locale rather than being pinned to a US format.
    const day = (d: number) =>
      new Date(Date.UTC(2024, 6, d)).toLocaleDateString(globals.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const hour = (h: number) =>
      new Date(Date.UTC(2024, 6, 24, h)).toLocaleTimeString(globals.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    const labels = [day(24), hour(20), hour(21), hour(22), '', hour(23), day(25), hour(25), hour(26), hour(27), hour(28)];
    const temps = [11.8, 12.7, 12.7, 11.2, 10.5, 9.9, 8.9, 8.5, 7.8, 7.1, 6.3];
    return html`
      <div style="max-width: 940px;">
        <md-line-chart
          style="height: 440px;"
          label=${t(globals.locale, 'line-chart.reykjavik')}
          subtitle=${t(globals.locale, 'line-chart.prognosis')}
          title-align="center"
          curve="linear"
          grid="horizontal"
          legend="none"
          show-marks
          .series=${[{ label: t(globals.locale, 'line-chart.axis.temperature'), color: 'primary', data: temps, dashAfter: 4, hollow: true, symbol: 'circle' }]}
          .xAxis=${{ data: labels.map((_, i) => i), scale: 'category', valueFormatter: (v: number) => labels[v] ?? '' }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.temp-c'), min: 4, max: 14, valueFormatter: (v: number) => String(v) }}
          .markLines=${[{ value: 4, label: t(globals.locale, 'line-chart.current-time'), color: 'secondary', dash: 'dashed' }]}
        ></md-line-chart>
      </div>
    `;
  },
  play: chartPlay(),
};

/* --- Irregular time data ------------------------------------
 * Three winters of snow-depth readings. Each winter was measured on its OWN
 * days — different counts, different dates, gaps of anything from a day to a
 * fortnight — which is what real field data looks like. Generated once from a
 * seeded PRNG so the story is stable across reloads, and mapped onto one shared
 * season window (mid-Oct → mid-Jun) so the three overlay for comparison.
 * ----------------------------------------------------------- */
const SEASON_START = Date.UTC(2000, 9, 15);

/** A winter's readings: accumulation to `peakDay`, then the spring melt out to
 *  `endDay` — sampled on uneven days, with the noise a real snow stake has. */
function snowSeason(seed: number, peak: number, peakDay: number, endDay: number) {
  let rnd = seed;
  const next = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const at = (day: number) => {
    const d = new Date(SEASON_START);
    d.setUTCDate(d.getUTCDate() + day);
    return d.toISOString().slice(0, 10);
  };
  const points: { x: string; y: number }[] = [];
  let day = 4 + Math.floor(next() * 10);
  let depth = 0;
  while (day < endDay) {
    const envelope =
      day <= peakDay
        ? peak * Math.sin((Math.PI / 2) * (day / peakDay))
        : peak * Math.max(0, 1 - (day - peakDay) / (endDay - peakDay)) ** 1.3;
    // Smooth toward the seasonal envelope so the trace wobbles instead of
    // jumping, and never flattens into a plateau.
    depth = Math.max(0, depth * 0.45 + envelope * (0.78 + 0.34 * next()) * 0.55);
    points.push({ x: at(day), y: +depth.toFixed(2) });
    // Uneven sampling: anything from daily to a fortnight between readings.
    day += 1 + Math.floor(next() * 13);
  }
  points.push({ x: at(endDay), y: 0 });
  return points;
}

// MD3 colour ROLES rather than hex, so the three winters re-theme with the page
// (and with a brand override) instead of being fixed blues.
const snowWinters = [
  { years: '2021–2022', color: 'primary', data: snowSeason(11, 2.25, 132, 196) },
  { years: '2022–2023', color: 'tertiary', data: snowSeason(47, 2.0, 148, 214) },
  { years: '2023–2024', color: 'secondary', data: snowSeason(93, 1.85, 160, 232) },
];
/** `Winter 2021–2022` / `Winter 2021–2022` / `2021–2022 年の冬` … */
const snowWintersOf = (locale = 'en-US') =>
  snowWinters.map((w) => ({ ...w, label: t(locale, 'line-chart.winter').replace('%years%', w.years) }));

/**
 * **Irregular time data.** A series' `data` can carry its own x per point —
 * `{ x, y }` or the `[x, y]` shorthand — instead of borrowing one from
 * `xAxis.data` by index. That's what uneven sampling needs, and it's the only
 * way several series measured on *different* days can share a chart:
 *
 * ```ts
 * series = [
 *   { label: 'Winter 2021–2022', data: [
 *       { x: '2021-10-29', y: 0 },
 *       { x: '2021-11-13', y: 0.12 },   // 15 days later
 *       { x: '2021-11-14', y: 0.15 },   // 1 day later
 *   ]},
 *   { label: 'Winter 2022–2023', data: [ … its own dates … ] },
 * ];
 * xAxis = { scale: 'time' };            // no shared `data` array needed
 * ```
 *
 * Set `scale: 'time'` (or `'value'`) so the gaps render **proportionally** —
 * a fortnight is fourteen times the width of a day — and the axis labels nice
 * round dates rather than one label per reading.
 *
 * Under the hood every series is merged onto one x axis, so tooltips, zoom and
 * the screen-reader table keep working across all of them: the tooltip at a
 * given date lists the series actually measured that day, and `mdMarkerClick`
 * still reports `dataIndex` into *your* array.
 */
export const IrregularTimeData: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 960px;">
      <md-line-chart
        style="height: 460px;"
        label=${t(globals.locale, 'line-chart.snow-depth')}
        subtitle=${t(globals.locale, 'line-chart.three-winters')}
        title-align="center"
        curve="linear"
        grid="horizontal"
        legend="top-end"
        show-marks
        .series=${snowWintersOf(globals.locale).map((w) => ({ ...w, hollow: true }))}
        .xAxis=${{
          scale: 'time',
          label: t(globals.locale, 'line-chart.axis.date'),
          valueFormatter: (v: string | number | Date) =>
            // The story formats its own ticks, so it must pass the locale too —
            // `undefined` would silently fall back to the browser's.
            new Date(v).toLocaleDateString(globals.locale, { day: 'numeric', month: 'short' }),
        }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.snow-m'), min: 0 }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} m`)}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Wind speed with Beaufort bands --------------------------
 * Two weather stations logging through one day. The y axis is banded by
 * Beaufort force, so a reading is read against the scale it belongs to rather
 * than against bare numbers. Seeded, so the shape is stable across reloads.
 * ----------------------------------------------------------- */
const WIND_DAY = Date.UTC(2024, 1, 29);

function windTrace(seed: number, base: number, gustAt: number, gust: number) {
  let rnd = seed;
  const next = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  let speed = base;
  // Every 20 minutes for 24h.
  return Array.from({ length: 72 }, (_, i) => {
    const hours = i / 3;
    const swell = gust * Math.max(0, Math.sin(((hours - gustAt) / 7) * Math.PI));
    speed = speed * 0.72 + (base + swell + (next() - 0.5) * 2.4) * 0.28;
    return { x: WIND_DAY + hours * 3600_000, y: +Math.max(0.2, speed).toFixed(2) };
  });
}

/** Beaufort force bands, alternately shaded so each is readable on its own. */
const beaufortOf = (locale = 'en-US') => [
  { from: 0.3, to: 1.5, label: t(locale, 'line-chart.beaufort.light-air') },
  { from: 1.5, to: 3.3, label: t(locale, 'line-chart.beaufort.light-breeze') },
  { from: 3.3, to: 5.5, label: t(locale, 'line-chart.beaufort.gentle-breeze') },
  { from: 5.5, to: 8, label: t(locale, 'line-chart.beaufort.moderate-breeze') },
  { from: 8, to: 10.8, label: t(locale, 'line-chart.beaufort.fresh-breeze') },
  { from: 10.8, to: 13.9, label: t(locale, 'line-chart.beaufort.strong-breeze') },
  { from: 13.9, to: 17.2, label: t(locale, 'line-chart.beaufort.near-gale') },
  // Alternate shading so each force reads as its own row. `surface-variant` is
  // the MD3 tone for a region behind content, so the banding re-themes with the
  // rest of the page instead of being a hardcoded grey.
].map((b, i) => ({ ...b, color: i % 2 ? 'surface-variant' : 'transparent' }));

/**
 * **Axis bands** (`xAxis.bands` / `yAxis.bands`) shade a value range behind the
 * data — the classification a reading is *read against* rather than data of its
 * own: Beaufort force behind a wind trace, a healthy range behind a vitals
 * chart, off-hours behind a load graph.
 *
 * ```ts
 * yAxis = {
 *   label: 'Wind speed (m/s)',
 *   bands: [
 *     { from: 3.3, to: 5.5,  label: 'Gentle breeze',  color: 'rgba(…)' },
 *     { from: 5.5, to: 8,    label: 'Moderate breeze' },
 *   ],
 * };
 * ```
 *
 * Each band spans the plot (horizontally for a y band, vertically for an x
 * one), is clipped to the visible domain, and takes an optional `label` placed
 * `start` / `center` / `end` along it. Leave `color` out for a faint themed
 * tint that works in light and dark. Bands paint behind the gridlines, so they
 * never compete with the data.
 */
export const AxisBands: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 960px;">
      <md-line-chart
        style="height: 460px;"
        label=${t(globals.locale, 'line-chart.wind-day')}
        subtitle=${t(globals.locale, 'line-chart.wind-sub')}
        curve="smooth"
        grid="none"
        legend="bottom"
        series-labels
        .series=${[
          { label: t(globals.locale, 'line-chart.place.hestavollen'), color: 'primary', data: windTrace(17, 11.4, 8, 2.6) },
          { label: t(globals.locale, 'line-chart.place.vik'), color: 'tertiary', data: windTrace(63, 1.4, 17, 5.2) },
        ]}
        .xAxis=${{
          scale: 'time',
          valueFormatter: (v: string | number | Date) =>
            new Date(v).toLocaleTimeString(globals.locale, { hour: '2-digit', minute: '2-digit' }),
        }}
        .yAxis=${{
          label: t(globals.locale, 'line-chart.axis.wind'),
          min: 0,
          max: 15,
          bands: beaufortOf(globals.locale),
          // Bare numbers on the axis; the unit lives in the tooltip.
          valueFormatter: (v: number) => String(v),
        }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `${v} m/s`)}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Axis breaks --------------------------------------------
 * Two quantities on one chart that are ten orders of magnitude apart: a
 * handful of pilot sites vs. the national rollout. Without a break the pilot
 * line is pinned to the axis and reads as zero.
 * ----------------------------------------------------------- */

const rolloutOf = (locale = 'en-US') => [
  { label: t(locale, 'line-chart.series.pilot'), color: 'tertiary', data: [4, 6, 9, 12, 14, 15, 17, 18] },
  {
    label: t(locale, 'line-chart.series.rollout'),
    color: 'primary',
    data: [8.1e11, 8.6e11, 9.2e11, 9.5e11, 9.9e11, 1.02e12, 1.06e12, 1.1e12],
  },
];

/**
 * **Axis breaks** (`xAxis.breaks` / `yAxis.breaks`) cut a range out of an axis,
 * so clusters that sit far apart both stay readable. The motivating case: one
 * value at 18 and another at 1.1e12 — on a continuous axis the small one is
 * pinned to the axis line and reads as zero.
 *
 * ```ts
 * yAxis = { breaks: [{ from: 100, to: 800_000_000_000 }] }  // name the cut
 * yAxis = { breaks: 'auto' }                                 // or find it
 * yAxis = { breaks: { auto: true, minGap: 12, sizing: 'proportional' } }
 * ```
 *
 * `'auto'` cuts any empty stretch wider than `minGap`× the median spacing
 * (default 8×, at most 2 cuts). Each cut costs a small `gap` of pixels, marked
 * with a zigzag through the axis, and the axis line is interrupted there.
 *
 * **`sizing` is the part worth knowing.** By default (`equal`) every surviving
 * section gets the same share of the axis, which is what actually rescues the
 * small cluster. `proportional` keeps one unit-per-pixel across the whole axis
 * so widths stay comparable between sections — the classic behaviour, but note
 * that cutting the empty middle out of 1 … 1e12 does *not* rescue the low end,
 * because 18 units of a trillion-unit axis is still nothing. If you want a
 * continuous scale instead of a discontinuous one, reach for `scale: 'log'`.
 *
 * Data inside a cut is not drawn, and a line crossing one is split rather than
 * drawn through it.
 */
export const AxisBreaks: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 900px;">
      <div>
        <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">breaks: 'auto'</p>
        <md-line-chart
          style="height: 320px;"
          label=${t(globals.locale, 'line-chart.deployment')}
          subtitle=${t(globals.locale, 'line-chart.deployment-sub')}
          curve="linear"
          show-marks
          legend="top-end"
          .series=${rolloutOf(globals.locale)}
          .xAxis=${{ data: monthsOf(globals.locale).slice(0, 8) }}
          .yAxis=${{
            label: t(globals.locale, 'line-chart.axis.devices'),
            breaks: 'auto',
            valueFormatter: (v: number) =>
              v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : String(v),
          }}
        ></md-line-chart>
      </div>
      <div>
        <p style="margin: 0 0 4px; font-size: 12px; opacity: 0.7;">
          no break — the pilot line is pinned to the axis
        </p>
        <md-line-chart
          style="height: 320px;"
          curve="linear"
          show-marks
          legend="top-end"
          .series=${rolloutOf(globals.locale)}
          .xAxis=${{ data: monthsOf(globals.locale).slice(0, 8) }}
          .yAxis=${{
            label: t(globals.locale, 'line-chart.axis.devices'),
            valueFormatter: (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : String(v)),
          }}
        ></md-line-chart>
      </div>
    </div>
  `,
  play: chartPlay(),
};

/* --- Custom tooltips ----------------------------------------
 * `tooltipRenderer` replaces the tooltip's CONTENT while the chart keeps
 * owning its placement. Everything below is plain DOM, so the same callback
 * works from HTML/JS, React, Angular and Vue.
 * ----------------------------------------------------------- */

/** The payload `tooltipRenderer` receives. (Exported from `@awc-ui/core` as
 *  `MdChartTooltipContext`; restated here so the story reads on its own.) */
type TooltipContext = {
  dataIndex: number;
  axisValue: string | number | Date | undefined;
  axisLabel: string;
  series: TooltipSeries[];
  missing: TooltipSeries[];
  focusedSeriesIndex: number;
};
type TooltipSeries = {
  seriesIndex: number;
  label: string;
  color: string;
  value: number | null | undefined;
  formattedValue: string;
  focused: boolean;
  missing: boolean;
};


const arrSubscriptions = [4.2, 4.6, 5.1, 6.0, 6.4, 7.3, 8.1, 9.4];
const arrServices = [2.8, 3.1, 2.9, 3.4, 3.2, 3.0, 3.3, 3.1];

/** Build the comparison card: each series' value at the hovered quarter plus
 *  its change against the previous one, so the tooltip answers "how is this
 *  doing?" and not only "what is it?". */
function deltaTooltip(rows: number[][]) {
  return (ctx: TooltipContext): Node => {
    const card = document.createElement('div');
    card.style.cssText = 'display:grid;gap:10px;min-width:220px';

    const head = document.createElement('div');
    head.textContent = ctx.axisLabel;
    head.style.cssText =
      'font-weight:600;font-size:1.05em;padding-bottom:6px;border-bottom:1px solid color-mix(in srgb, currentColor 14%, transparent)';
    card.appendChild(head);

    for (const s of ctx.series) {
      const prev = rows[s.seriesIndex]?.[ctx.dataIndex - 1];
      const change = prev != null && s.value != null ? ((s.value - prev) / prev) * 100 : null;

      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px';
      // The emphasised series is the one the pointer is nearest — lift it so the
      // card agrees with the plot about what you are looking at.
      if (s.focused) row.style.fontWeight = '600';

      const dot = document.createElement('span');
      dot.style.cssText = `inline-size:10px;block-size:10px;border-radius:50%;background:${s.color}`;

      const name = document.createElement('span');
      name.textContent = s.label;

      const figures = document.createElement('span');
      figures.style.cssText = 'display:flex;align-items:baseline;gap:8px;justify-self:end';

      const value = document.createElement('strong');
      value.textContent = s.formattedValue;
      value.style.fontVariantNumeric = 'tabular-nums';
      figures.appendChild(value);

      if (change != null) {
        const chip = document.createElement('span');
        const up = change >= 0;
        chip.textContent = `${up ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`;
        chip.style.cssText = [
          'font-size:0.82em',
          'font-weight:600',
          'padding:1px 6px',
          'border-radius:999px',
          `color:${up ? 'var(--md-sys-color-on-tertiary-container, #1F4E43)' : 'var(--md-sys-color-on-error-container, #410E0B)'}`,
          `background:${up ? 'var(--md-sys-color-tertiary-container, #B8F0DF)' : 'var(--md-sys-color-error-container, #F9DEDC)'}`,
        ].join(';');
        figures.appendChild(chip);
      }

      row.append(dot, name, figures);
      card.appendChild(row);
    }

    const foot = document.createElement('div');
    foot.textContent = ctx.dataIndex === 0 ? 'First quarter on record' : 'Change vs the previous quarter';
    foot.style.cssText = 'font-size:0.82em;opacity:0.7';
    card.appendChild(foot);

    return card;
  };
}

/**
 * **Custom tooltips** (`tooltipRenderer`) replace the tooltip's content with
 * whatever you build, while the chart keeps positioning it — it is still the
 * `tooltip` CSS part, and it still flips away from the right and bottom edges,
 * however much bigger than the default card it is.
 *
 * ```ts
 * chart.tooltipRenderer = (ctx) => {
 *   const el = document.createElement('div');
 *   el.textContent = `${ctx.axisLabel}: ${ctx.series[0].formattedValue}`;
 *   return el;                       // a Node — what every framework renders to
 * };
 * ```
 *
 * The callback receives everything the chart knows about the hovered x:
 *
 * | field | what it is |
 * |---|---|
 * | `dataIndex` / `axisValue` / `axisLabel` | the hovered slot, its raw x, and its formatted label |
 * | `series[]` | visible series that **have** a reading here — `seriesIndex`, `label`, `color`, `value`, `formattedValue`, `focused` |
 * | `missing[]` | visible series that **don't** — same shape, with `value` `null` (a null datum) or `undefined` (no datum at all) |
 * | `focusedSeriesIndex` | the emphasised series, or `-1` |
 *
 * A series with no sample at the hovered x is never in `series`, which matters
 * for irregular data where most x slots hold only one series.
 *
 * **Return values.** A `Node` is inserted as-is — build it with
 * `document.createElement`, or with React's `createRoot`, Vue's `render`, or
 * Angular's `createComponent` into a detached div. A `string` is inserted as
 * **text**, never parsed, so untrusted values are safe by default; opt into
 * markup explicitly with `{ unsafeHtml }`, which is assigned to `innerHTML`
 * with no sanitising. Return `undefined` to fall back to the built-in tooltip
 * for that x, or `null` for no tooltip at all.
 */
export const CustomTooltip: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 960px;">
      <md-line-chart
        style="height: 460px;"
        label=${t(globals.locale, 'line-chart.arr')}
        subtitle=${t(globals.locale, 'line-chart.arr-sub')}
        curve="monotone"
        grid="horizontal"
        legend="top-end"
        show-marks
        .series=${[
          { label: t(globals.locale, 'line-chart.series.subscriptions'), data: arrSubscriptions },
          { label: t(globals.locale, 'line-chart.series.services'), data: arrServices, color: 'tertiary' },
        ]}
        .xAxis=${{ data: quartersOf(globals.locale) }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.arr'), min: 0 }}
        .valueFormatter=${(v: number | null | undefined) =>
          v == null
            ? '—'
            : new Intl.NumberFormat(globals.locale, {
                style: 'currency',
                currency: 'GBP',
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(v * 1e6)}
        .tooltipRenderer=${deltaTooltip([arrSubscriptions, arrServices])}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Partial data --------------------------------------------
 * Three tide gauges on one estuary. They were not all installed at the same
 * time, one was offline for a fortnight mid-survey, and the oldest was
 * decommissioned early — the ordinary shape of field data.
 * ----------------------------------------------------------- */
/** `Week 1` / `Woche 1` / `第1週` … for the survey axis. */
const surveyWeeksOf = (locale = 'en-US') =>
  Array.from({ length: 12 }, (_, i) => t(locale, 'line-chart.week').replace('%n%', String(i + 1)));

/** Decommissioned after week 8 — simply a shorter array. */
const gaugeOld = [3.1, 3.4, 3.2, 3.6, 3.9, 3.5, 3.8, 4.0];
/** Installed at week 3, then offline for weeks 7–8 (an authored `null` gap). */
const gaugeMid = [null, null, 2.4, 2.7, 2.9, 2.6, null, null, 3.0, 3.3, 3.1, 3.5];
/** Installed last, at week 6. */
const gaugeNew = [null, null, null, null, null, 1.8, 2.1, 2.0, 2.4, 2.6, 2.9, 3.2];

/**
 * **Partial data.** A series does not have to cover the whole axis. Give it a
 * shorter array and it simply stops; use `null` for a gap in the middle or for
 * readings that only start later. Each series is drawn over its own span only,
 * and an isolated reading fenced by nulls still renders as a point.
 *
 * ```ts
 * series = [
 *   { label: 'Gauge A', data: [3.1, 3.4, 3.2, 3.6] },              // ends early
 *   { label: 'Gauge B', data: [null, null, 2.4, 2.7, null, 3.0] }, // starts late, gap at 4
 * ];
 * ```
 *
 * By default the tooltip lists only the series that actually have a reading at
 * the hovered x — a series that is absent is left out rather than shown as
 * zero. To show a row for it anyway, handle the missing cases in
 * `valueFormatter`:
 *
 * ```ts
 * valueFormatter = (v) =>
 *   v === null        ? 'no reading'        // has a datum here, and it is null
 *   : v === undefined ? 'not in service'    // no datum here at all — its array ended
 *   : `${v.toFixed(2)} m`;
 * ```
 *
 * The two absences are distinct on purpose: `null` is "measured, no value" and
 * `undefined` is "never sampled here". Return `''` (or leave them unhandled)
 * to keep the default of omitting the series. A missing row is dimmed, carries
 * no colour swatch and draws no marker on the plot, so it never reads as data.
 */
export const PartialData: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 960px;">
      <md-line-chart
        style="height: 460px;"
        label=${t(globals.locale, 'line-chart.tide')}
        subtitle=${t(globals.locale, 'line-chart.tide-sub')}
        curve="linear"
        grid="horizontal"
        legend="top-end"
        show-marks
        .series=${[
          { label: t(globals.locale, 'line-chart.gauge-a'), data: gaugeOld },
          { label: t(globals.locale, 'line-chart.gauge-b'), data: gaugeMid, color: 'tertiary' },
          { label: t(globals.locale, 'line-chart.gauge-c'), data: gaugeNew, color: 'secondary' },
        ]}
        .xAxis=${{ data: surveyWeeksOf(globals.locale), label: t(globals.locale, 'line-chart.axis.survey-week') }}
        .yAxis=${{ label: t(globals.locale, 'line-chart.axis.tide-m'), min: 0 }}
        .valueFormatter=${(v: number | null | undefined) =>
          v === null
            ? t(globals.locale, 'line-chart.no-reading')
            : v === undefined
              ? t(globals.locale, 'line-chart.not-in-service')
              : `${v.toLocaleString(globals.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Click handlers -----------------------------------------
 * One log panel, four events. The chart resolves a click to the most specific
 * thing under the pointer, so exactly one of them fires.
 * ----------------------------------------------------------- */
type ChartClickDetail = {
  seriesIndex: number;
  seriesId?: string;
  dataIndex: number;
  value: number | null;
  axisValue?: string | number | Date;
  series: { label?: string };
};

type ChartAxisClickDetail = {
  dataIndex: number;
  axisValue?: string | number | Date;
  seriesValues: { label: string; value: number | null }[];
};

/** Newest-first event log for the story below (capped, so it never scrolls).
 *  The first entry replaces the "click the chart" hint rather than stacking on
 *  top of it, so the hint doesn't linger among the events. */
function logChartClick(line: string): void {
  const el = document.getElementById('line-chart-click-log');
  if (!el) return;
  const previous = el.dataset.empty ? '' : el.textContent ?? '';
  delete el.dataset.empty;
  el.textContent = [line, ...previous.split('\n')].filter(Boolean).slice(0, 10).join('\n');
}

const clickLine = (name: string, d: ChartClickDetail) =>
  `${name.padEnd(14)} ${d.series.label ?? d.seriesId ?? `#${d.seriesIndex}`} · ${String(d.axisValue)} = ${d.value}  (dataIndex ${d.dataIndex})`;

/**
 * **Click handlers.** A click resolves to the most specific thing under the
 * pointer, and exactly one event fires for it:
 *
 * | event | fires when | detail |
 * |---|---|---|
 * | `mdMarkerClick` | a data point was clicked | `MdChartClickDetail` |
 * | `mdLineClick` | a series' drawn line was clicked, away from its points | `MdChartClickDetail` |
 * | `mdAreaClick` | a series' filled area was clicked (`area` charts only) | `MdChartClickDetail` |
 * | `mdAxisClick` | the plot background was clicked | `MdChartAxisClickDetail` |
 *
 * The first three share the marker-click payload — `seriesIndex` / `seriesId` /
 * `dataIndex` / `value` / `axisValue` / `series` / `nativeEvent` — so one
 * drill-down handler can take any of them. `mdAxisClick` instead reports the
 * whole column: the nearest x plus **every visible series' value there**.
 *
 * ```ts
 * chart.addEventListener('mdAxisClick', (e) => {
 *   const { axisValue, seriesValues } = e.detail;
 *   // seriesValues: [{ seriesIndex, seriesId, label, dataIndex, value }, …]
 *   openDetailsFor(axisValue, seriesValues);
 * });
 * ```
 *
 * Clicks in the title, the legend or the axis gutters fire nothing, and a drag
 * (the zoom band) counts as a gesture rather than a background click. Try the
 * marks, the line between two marks, the tinted fill under it, and the empty
 * space above the lines.
 */
export const ClickHandlers: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="max-width: 960px;">
      <md-line-chart
        style="height: 400px;"
        label=${t(globals.locale, 'line-chart.monthly-revenue')}
        subtitle=${t(globals.locale, 'line-chart.click-hint')}
        curve="smooth"
        grid="horizontal"
        legend="top-end"
        area
        show-marks
        .series=${seriesRevenue}
        .xAxis=${{ data: monthsOf(globals.locale) }}
        .yAxis=${{
          label: t(globals.locale, 'line-chart.axis.revenue-eur'),
          // Bare numbers on the axis; the unit lives in the axis label + tooltip.
          valueFormatter: (v: number) => String(v),
        }}
        .valueFormatter=${(v: number | null) => (v == null ? '—' : `€${v}M`)}
        @mdMarkerClick=${(e: CustomEvent<ChartClickDetail>) => logChartClick(clickLine('mdMarkerClick', e.detail))}
        @mdLineClick=${(e: CustomEvent<ChartClickDetail>) => logChartClick(clickLine('mdLineClick', e.detail))}
        @mdAreaClick=${(e: CustomEvent<ChartClickDetail>) => logChartClick(clickLine('mdAreaClick', e.detail))}
        @mdAxisClick=${(e: CustomEvent<ChartAxisClickDetail>) =>
          logChartClick(
            `${'mdAxisClick'.padEnd(14)} ${String(e.detail.axisValue)} → ` +
              e.detail.seriesValues.map((s) => `${s.label} ${s.value ?? '—'}`).join(', '),
          )}
      ></md-line-chart>

      <pre
        id="line-chart-click-log"
        data-empty="true"
        style="
          margin: 12px 0 0; padding: 12px 16px; min-height: 96px;
          background: var(--md-sys-color-surface-container-high, #ECE6F0);
          color: var(--md-sys-color-on-surface, #1C1B1F);
          border-radius: 12px; font-size: 12px; line-height: 1.7;
          white-space: pre-wrap; overflow-x: auto;
        "
      >
Click the chart — the event that fired shows up here (newest first).</pre
      >
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Dashed lines, axes and gridlines.** Every stroke on the chart takes the
 * same `MdChartLineStyle` — `'solid'` (default) · `'dashed'` · `'dotted'` — on
 * whichever object owns it:
 *
 * | stroke | option |
 * |---|---|
 * | the series' own drawn line | `series[i].dash` |
 * | an axis line + its tick marks | `xAxis.dash` / `yAxis.dash` |
 * | the gridlines an axis' ticks draw | `xAxis.gridDash` / `yAxis.gridDash` |
 *
 * ```ts
 * series = [{ label: '2025', data, dash: 'dashed' }];  // the data line itself
 * xAxis  = { data: monthsOf(globals.locale), gridDash: 'dotted' };       // vertical grid
 * yAxis  = { dash: 'dashed', gridDash: 'dashed' };     // axis line + horizontal grid
 * ```
 *
 * A dashed or dotted **grid** recedes behind the data, which is what you want
 * on a busy chart; a dashed **series** line is how a forecast or a target reads
 * as "not measured" (see also `dashAfter`, which switches one line from solid
 * to dotted partway through). `gridDash` needs the matching `grid` mode on.
 *
 * Works on the bar and area charts too — there the value axis owns the grid.
 */
export const DashedGrid: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 900px;">
      <md-line-chart
        style="height: 320px;"
        label=${t(globals.locale, 'line-chart.dotted-grid')}
        curve="monotone"
        grid="both"
        legend="none"
        show-marks
        .series=${[seriesRevenue[0]]}
        .xAxis=${{ data: monthsOf(globals.locale), gridDash: 'dotted' }}
        .yAxis=${{ gridDash: 'dotted' }}
      ></md-line-chart>

      <md-line-chart
        style="height: 320px;"
        label=${t(globals.locale, 'line-chart.dashed-all')}
        curve="monotone"
        grid="both"
        legend="none"
        axis-ticks
        show-marks
        .series=${[{ ...seriesRevenue[1], dash: 'dashed' }]}
        .xAxis=${{ data: monthsOf(globals.locale), dash: 'dashed', gridDash: 'dashed' }}
        .yAxis=${{ dash: 'dashed', gridDash: 'dashed' }}
      ></md-line-chart>
    </div>
  `,
  play: chartPlay(),
};

/* --- Async loading ------------------------------------------
 * The chart owns the wait: `loading` covers the plot with an indicator, and
 * clearing it replays the entry animation so the data draws itself in.
 * ----------------------------------------------------------- */
const FETCH_MS = 1600;

type LoadableChart = HTMLElement & { series?: unknown; loading?: boolean };

/** Fake fetch → flips the chart out of `loading` with fresh data. */
function loadInto(chart: LoadableChart | null | undefined): void {
  if (!chart) return;
  chart.loading = true;
  window.setTimeout(() => {
    chart.series = seriesRevenue.map((s) => ({ ...s, data: s.data.map((v) => Math.round(v * (0.8 + Math.random() * 0.4))) }));
    chart.loading = false;
  }, FETCH_MS);
}

/** Re-run the fake fetch for every chart in the story. */
function reloadAll(from: HTMLElement): void {
  from.closest('.chart-loading-demo')?.querySelectorAll('md-line-chart').forEach((c) => loadInto(c as LoadableChart));
}

/**
 * **Async data.** Set `loading` while the request is in flight: the chart
 * covers the plot with an indicator instead of drawing an empty axis, and marks
 * itself `aria-busy` so screen readers announce the wait.
 *
 * ```ts
 * chart.loading = true;
 * chart.series = await fetchSeries();
 * chart.loading = false;   // entry animation replays as the data lands
 * ```
 *
 * Clearing `loading` replays the entry animation, so the data draws itself in
 * rather than appearing fully formed. While loading, the empty state is
 * suppressed — "no data" is the wrong answer to a request still running — and
 * the overlay is opaque, so the phantom axis the engine draws for absent data
 * can't show through.
 *
 * Three flavours below, all the same `loading` prop — only the **content** of
 * the overlay changes:
 *
 * | flavour | how |
 * |---|---|
 * | circular (default) | nothing to do; `loading-label` sets the text |
 * | linear | `<md-progress-indicator slot="loading" variant="linear" indeterminate>` |
 * | skeleton | any markup in `slot="loading"` — here `md-skeleton` shaped like the chart |
 *
 * A slotted loader replaces the whole default block, so it owns its own text.
 * Keep it inside the plot's footprint: the overlay is a centred flex column
 * that fills the chart box, so `inline-size: 100%` / `block-size: 100%` on your
 * wrapper makes a skeleton span it.
 */
export const AsyncLoading: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => html`
    <style>
      /* Skeleton shaped like the chart it replaces: a title line above a block
         that fills the rest of the plot. */
      .chart-skeleton {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 14px;
        inline-size: 100%;
        block-size: 100%;
      }
      .chart-loading-demo figcaption {
        margin-block-end: 6px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        font: 500 12px/1.4 Roboto, system-ui, sans-serif;
      }
      .chart-loading-demo figure {
        margin: 0;
      }
    </style>
    <div class="chart-loading-demo" style="max-width: 900px; display: grid; gap: 24px; justify-items: start;">
      <md-button variant="tonal" trailing-icon="refresh" @click=${(e: Event) => reloadAll(e.target as HTMLElement)}>
        Reload all
      </md-button>

      <figure style="inline-size: 100%;">
        <figcaption>Default — circular indicator + <code>loading-label</code></figcaption>
        <md-line-chart
          style="height: 300px; width: 100%;"
          label=${t(globals.locale, 'line-chart.monthly-revenue')}
          curve="monotone"
          grid="horizontal"
          legend="top-end"
          show-marks
          loading
          loading-label=${t(globals.locale, 'line-chart.fetching')}
          .xAxis=${{ data: monthsOf(globals.locale) }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.revenue-eur') }}
          .valueFormatter=${(v: number | null) => (v == null ? '—' : `€${v}M`)}
          ${ref((el) => loadInto(el as LoadableChart))}
        ></md-line-chart>
      </figure>

      <figure style="inline-size: 100%;">
        <figcaption>Linear — an indeterminate bar, for when a spinner is too heavy for the space</figcaption>
        <md-line-chart
          style="height: 300px; width: 100%;"
          label=${t(globals.locale, 'line-chart.monthly-revenue')}
          curve="monotone"
          grid="horizontal"
          legend="top-end"
          show-marks
          loading
          .xAxis=${{ data: monthsOf(globals.locale) }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.revenue-eur') }}
          .valueFormatter=${(v: number | null) => (v == null ? '—' : `€${v}M`)}
          ${ref((el) => loadInto(el as LoadableChart))}
        >
          <div slot="loading" style="inline-size: min(320px, 70%); display: grid; gap: 12px; justify-items: center;">
            <md-progress-indicator
              variant="linear"
              indeterminate
              label="Fetching revenue"
              style="inline-size: 100%;"
            ></md-progress-indicator>
            <span>Fetching revenue…</span>
          </div>
        </md-line-chart>
      </figure>

      <figure style="inline-size: 100%;">
        <figcaption>Skeleton — holds the chart's shape, so the layout doesn't jump when data lands</figcaption>
        <md-line-chart
          style="height: 300px; width: 100%;"
          label=${t(globals.locale, 'line-chart.monthly-revenue')}
          curve="monotone"
          grid="horizontal"
          legend="top-end"
          show-marks
          loading
          .xAxis=${{ data: monthsOf(globals.locale) }}
          .yAxis=${{ label: t(globals.locale, 'line-chart.axis.revenue-eur') }}
          .valueFormatter=${(v: number | null) => (v == null ? '—' : `€${v}M`)}
          ${ref((el) => loadInto(el as LoadableChart))}
        >
          <div slot="loading" class="chart-skeleton">
            <md-skeleton variant="text" width="180px" aria-label="Loading chart title"></md-skeleton>
            <md-skeleton
              variant="rounded"
              animation="wave"
              full-width
              full-height
              aria-label="Loading chart data"
            ></md-skeleton>
          </div>
        </md-line-chart>
      </figure>
    </div>
  `,
  play: chartPlay(),
};

/**
 * **Localization.** The chart never bundles an i18n engine — it takes
 * already-resolved text via props, so whatever your app already uses
 * (react-intl, i18next, Lingui, …) stays in charge. Two separate concerns:
 *
 * **1. Numbers and dates** — `locale` (BCP-47) drives the *default* formatting
 * of axis ticks, tooltip values and the screen-reader table. An explicit
 * `valueFormatter` / `xAxis.valueFormatter` always wins, so a chart that
 * already formats its own values is unaffected.
 *
 * ```ts
 * <md-line-chart locale="de-DE">   // 1.234,5 instead of 1,234.5
 * ```
 *
 * **2. Strings the chart renders itself** — all overridable, all plain text:
 *
 * | prop | what it is |
 * |---|---|
 * | `label-empty` | the empty-state message (the `empty` slot also works) |
 * | `summary` | replaces the generated `aria-label` outright |
 * | `table-labels` | headers + truncation note of the screen-reader table |
 * | `label-zoom-start` / `label-zoom-end` | the zoom slider's thumbs |
 *
 * The generated summary reads *"Revenue, Line chart, with 2 series, from Jan
 * to Dec."* — conditional and word-ordered, so rather than translate it
 * piecewise, `summary` hands over the finished sentence. `table-labels`
 * substitutes `%shown%` / `%total%`.
 *
 * Everything below is driven by the **Locale** toolbar global through this
 * repo's demo dictionary (`src/i18n`) — the same shape a real app would use.
 * Switch the locale and watch the axis numbers, the empty-state text and the
 * chart's `aria-label` change together.
 */
export const Localized: Story = {
  parameters: { visual: { skip: true } },
  render: (_args, { globals }) => {
    const locale = globals.locale ?? 'en-US';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const series = [
      { label: t(locale, 'line-chart.revenue'), data: [1234.5, 2345.75, 1987.25, 3456.5, 2890.1, 4102.8] },
      { label: t(locale, 'line-chart.server-load'), data: [987.25, 1456.5, 1123.75, 1890.25, 1654.5, 2210.4] },
    ];
    // The whole aria-label, composed in the active language — the component
    // takes it verbatim rather than trying to translate its own grammar.
    const summary = [
      t(locale, 'line-chart.revenue'),
      t(locale, 'line-chart.a11y.line'),
      t(locale, 'line-chart.a11y.series').replace('%count%', String(series.length)),
      t(locale, 'line-chart.a11y.range').replace('%min%', months[0]).replace('%max%', months[months.length - 1]),
    ].join(', ') + '.';

    return html`
      <div style="display: grid; gap: 24px; max-width: 860px;">
        <md-line-chart
          style="height: 340px;"
          locale=${locale}
          label=${t(locale, 'line-chart.revenue')}
          summary=${summary}
          label-zoom-start=${t(locale, 'line-chart.a11y.zoom-start')}
          label-zoom-end=${t(locale, 'line-chart.a11y.zoom-end')}
          zoom="slider"
          show-marks
          legend="top-end"
          .series=${series}
          .xAxis=${{ data: monthsOf(globals.locale) }}
          .yAxis=${{ label: t(locale, 'line-chart.a11y.month') }}
          .tableLabels=${{
            x: t(locale, 'line-chart.a11y.month'),
            truncated: t(locale, 'line-chart.a11y.truncated'),
          }}
        ></md-line-chart>

        <md-line-chart
          style="height: 200px;"
          locale=${locale}
          label-empty=${t(locale, 'line-chart.no-data')}
          .series=${[]}
        ></md-line-chart>
      </div>
    `;
  },
  play: chartPlay(),
};
