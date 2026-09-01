/**
 * Screen 1 — the advisor's book, and the head of the drill path.
 *
 * The layout is the React build's, in the same order: a KPI row that answers
 * the four opening questions at a glance, the two shapes those numbers came
 * from (the performance curve and the allocation ring), the two attention
 * lists, the book itself as a table, and the audit trail underneath.
 *
 * NOTHING HERE IS ARITHMETIC. Every figure, series, colour and column layout
 * comes from `@awc-ui/showcase-kit/wealth`; this file decides layout and
 * nothing else. `.map()` over a kit series to lift one field out is a
 * projection, not a calculation.
 *
 * DECISIONS CARRIED OVER FROM THE REACT SCREEN, same reasons:
 *
 *   1. NO `md-toolbar`. `md-fab-menu`'s manual (and M3) say not to pair a FAB
 *      menu with a toolbar or a navigation rail. The screen's actions live
 *      where they belong anyway — the table's filters in `md-table-toolbar`,
 *      the period picker in the chart panel's head — and the quick-actions FAB
 *      exists ONLY below the rail breakpoint, where `app.css` swaps the rail
 *      for `md-navigation-bar` (a FAB's proper companion). On this build that
 *      cluster ships in a `<template data-quick-actions>` and the client mounts
 *      it under the media query, so the desktop document holds exactly the
 *      elements React's does.
 *
 *   2. THE DONUT'S SLICE COLOURS ARE TOKEN REFERENCES, PASSED AS-IS — the
 *      library's `resolveSeriesColor` resolves `var(--md-sys-color-*)` against
 *      the chart host.
 *
 *   3. THE DONUT IS `md-pie-chart`, whose payload prop is `data`, NOT `series`
 *      — `pieChart()` in `lib/charts.mjs` writes the right attribute.
 *
 * WHAT THE CLIENT SCRIPT ADDS (all three progressive; the page is complete
 * without them, exactly as the React screen is complete before hydration):
 *
 *   - `client/performance.mjs` — the period picker. All four windows are baked
 *     at build time: the chart payloads (series + x axis + subtitle, already
 *     translated) ride in `data-periods` on the chart, and each window's
 *     figures block ships as a `<template data-period-dl>` the client swaps in,
 *     the same clone-and-replace the credit-risk stress screen uses. With JS
 *     off the reader has the full 24-month story, which is the default anyway.
 *
 *   - `client/book-table.mjs` — sorting and the two filters. Raw sort keys are
 *     stamped on each row as `data-sort-*` (the cell text is localised and
 *     compacted; comparing it lexically is wrong differently in each locale),
 *     the search facts as `data-name` + the row's `value` (the kit's
 *     `getHouseholds` matches on name AND id), the facet as `data-segment`.
 *     Non-matching rows are DETACHED, never hidden, so the live census matches
 *     React's; the empty state clones in from `<template data-empty>`.
 *
 *   - `client/quick-actions.mjs` — the compact-only FAB menu, mounted and
 *     unmounted on the same 899px query React's `useMediaQuery` gate uses.
 */

import {
  assetClassColor,
  crumbsFor,
  driftedMandates,
  getActivity,
  getBookAllocation,
  getBookTotals,
  getHouseholds,
  getPerformanceSeries,
  growthOf100,
  HISTORY_MONTHS,
  plColor,
  REPORTING_DATE,
  returnWindow,
  route,
  TABLES,
  tail,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html, style } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { prop } from '../lib/props.mjs';
import { lineChart, pieChart } from '../lib/charts.mjs';
import {
  allocationChip,
  count,
  dateText,
  drill,
  driftMeter,
  fact,
  kpiTile,
  kycStatusDot,
  mandateChip,
  money,
  nameCell,
  num,
  percent,
  segmentChip,
  signed,
  strategyChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

/* --------------------------------------------------------------- constants */

/** The index the kit rebases the performance series to. `growthOf100()`'s own base. */
const GROWTH_BASE = 100;

/**
 * The performance chart's y-axis floor. A value axis anchors itself to ZERO
 * unless a `min` is given — correct for a quantity, useless for an index where
 * both lines start at 100. With the floor fixed the axis is identical at all
 * four periods, so the picker changes the horizontal range and nothing else.
 * 95 sits below the whole 24-month series (low 98.6), so nothing is cropped.
 */
const GROWTH_FLOOR = 95;

/** The four windows the period picker offers, in months. The last is the whole history. */
const PERIODS = [3, 6, 12, HISTORY_MONTHS];

/** The chart heights `app.css` names as `.chart-sm` / `.chart-md`. */
const CHART_MD = '260px';
const CHART_LG = '340px';

/* The activity feed is one disclosure, not a short list with a "view all"
   toggle. Twelve is what the panel's own header offers to open. */
const ACTIVITY_ROWS = 12;

/** The quick-actions FAB's id — the menu wires itself to it by `anchor`. */
const FAB_ID = 'wealth-overview-quick-actions';

/* ------------------------------------------------------------------ screen */

export function overviewScreen(t, locale) {
  const totals = getBookTotals();

  const aside = html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'outlined',
    icon: 'groups',
    label: t('wealth.common.of', {
      count: totals.householdCount,
      total: totals.clientCount,
    }),
    title: `${t('wealth.kpi.households')} / ${t('wealth.kpi.clients')}`,
  })}></md-chip>`;

  const children = html`${kpiRow(t)}

    <section class="grid-wide">
      ${performancePanel(t)}
      ${allocationPanel(t)}
    </section>

    <!-- Two columns, not three: app.css stretches cards in a row to the
         tallest, so panels sharing a row want similar content. The trail goes
         full width at the bottom, where its rows have room for the actor. -->
    <section class="grid-2">
      ${driftPanel(t)}
      ${rebalancePanel(t, locale)}
    </section>

    ${bookTable(t, locale)}

    ${activityPanel(t, locale)}

    ${quickActions(t, locale)}`;

  return screen(t, {
    locale,
    here: route.overview(),
    title: t('wealth.screen.overview.title'),
    subtitle: t('wealth.screen.overview.subtitle', {
      date: t.formatDate(REPORTING_DATE, 'long'),
    }),
    crumbs: crumbsFor(route.overview()),
    aside,
    children,
  });
}

/* ---------------------------------------------------------------- KPI row */

function kpiRow(t) {
  const totals = getBookTotals();
  const points = getPerformanceSeries();
  const monthLabels = points.map((point) => t.formatDate(point.date, 'monthYear'));

  return html`<section class="kpi-grid">
    ${kpiTile(t, {
      label: t('wealth.kpi.aum'),
      value: money(t, totals.aum, { compact: true }),
      hint: t('wealth.kpi.aum.help'),
      trend: points.map((point) => point.marketValue),
      trendLabels: monthLabels,
      trendFormat: 'currency',
      color: 'primary',
    })}

    <!-- The sparkline's colour is the excess return's colour, from the kit's
         own map — the line agrees with the sign underneath it. -->
    ${kpiTile(t, {
      label: t('wealth.kpi.ytdReturn'),
      value: percent(t, totals.ytdReturn),
      hint: html`${t('wealth.common.vsBenchmark')} ${signed(t, totals.ytdExcessReturn, { kind: 'percent' })}`,
      trend: points.map((point) => point.cumulativeReturn),
      trendLabels: monthLabels,
      trendFormat: 'percent',
      color: plColor(totals.ytdExcessReturn),
    })}

    <!-- Monthly NET FLOW, not the balance: this tile is about money arriving
         and leaving, and the balance's own line is already on the AUM tile. -->
    ${kpiTile(t, {
      label: t('wealth.kpi.netNewMoney'),
      value: signed(t, totals.netNewMoneyYtd, { compact: true }),
      hint: html`${t('wealth.unit.months', { value: 12 })} ${signed(t, totals.netNewMoneyOneYear, { compact: true })}`,
      trend: points.map((point) => point.netFlow),
      trendLabels: monthLabels,
      trendFormat: 'currency',
      color: 'tertiary',
    })}

    <!-- No sparkline: there is no history behind these two counts in the
         fixture, and drawing a flat line would invent one. 'trailing' is a
         count() chip rather than an md-badge, which would anchor to the card's
         corner and be clipped in half — see lib/bits.mjs. -->
    ${kpiTile(t, {
      label: t('wealth.kpi.driftBreaches'),
      value: num(t, totals.driftBreachCount),
      hint: t('wealth.kpi.kycReviewDue'),
      trailing: count(t, totals.kycReviewDueCount, { color: 'warning' }),
      color: 'error',
    })}
  </section>`;
}

/* ------------------------------------------------------------ performance */

/**
 * Growth of 100, book against benchmark, with the period picker driving the
 * range. THE PICKER IS REAL: it re-slices through the kit's `tail()` and
 * re-reads the window's returns through `returnWindow()` — neither number is
 * computed here, and on this build both are computed at BUILD time for all
 * four windows and baked into the page for the client to swap between.
 */
function performancePanel(t) {
  const points = getPerformanceSeries();
  const growth = growthOf100();
  const title = t('wealth.panel.performance');

  /*
   * One entry per window: everything the client needs to show it, already
   * translated and formatted. `subtitle`'s `base` is the first value actually
   * on screen, read off the kit's series, so the sentence stays true at every
   * window rather than claiming a rebase that only holds over the full history.
   */
  const windows = PERIODS.map((months) => {
    const visible = tail(growth, months);
    const windowReturn = returnWindow(points, months);
    return {
      months,
      visible,
      windowReturn,
      labels: visible.map((point) => t.formatDate(point.date, 'monthYear')),
      subtitle: t('wealth.panel.performanceHint', {
        base: t.formatNumber(visible[0]?.portfolio ?? GROWTH_BASE, { maximumFractionDigits: 0 }),
        months: windowReturn.months,
      }),
    };
  });

  /*
   * THE BENCHMARK IS DASHED, and that is not decoration: the palette's first
   * two roles sit close together in dark mode, and a reference line the reader
   * cannot separate from the mandate is worse than none. The stroke style is a
   * second carrier beside the legend.
   */
  const seriesFor = (window_) => [
    { id: 'book', label: t('wealth.panel.book'), data: window_.visible.map((p) => p.portfolio) },
    {
      id: 'benchmark',
      label: t('wealth.kpi.benchmark'),
      data: window_.visible.map((p) => p.benchmark),
      dash: 'dashed',
    },
  ];

  /**
   * The figures the curve is being read for — one `dl` per window. The LIVE
   * one carries `data-period-facts` so the client can find and replace it;
   * the template copies are bare, and the marker travels with whatever stands
   * in the document (the credit-risk stress screen's swap idiom).
   */
  const figures = (window_, attributes = {}) => html`<dl${attrs({ class: 'dl', ...attributes })}>
    ${fact(
      t('wealth.unit.months', { value: window_.windowReturn.months }),
      signed(t, window_.windowReturn.portfolio, { kind: 'percent' }),
    )}
    ${fact(t('wealth.kpi.benchmark'), percent(t, window_.windowReturn.benchmark))}
    ${fact(t('wealth.kpi.excessReturn'), signed(t, window_.windowReturn.excess, { kind: 'percent' }))}
  </dl>`;

  const initial = windows[windows.length - 1];

  /** Chart payloads per window, for `client/performance.mjs`. */
  const periodPayload = Object.fromEntries(
    windows.map((window_) => [
      String(window_.months),
      {
        series: seriesFor(window_),
        xAxis: { data: window_.labels, scale: 'category' },
        subtitle: window_.subtitle,
      },
    ]),
  );

  const picker = html`<md-segmented-button-set${attrs({
    'aria-label': title,
    'data-period-picker': true,
  })}>
    ${PERIODS.map(
      (period) => html`<md-segmented-button${attrs({
        value: String(period),
        // `label`, never slotted text: slotted label content is read once
        // before the first render, and the picker is re-rendered by nothing.
        label: t('wealth.unit.months', { value: period }),
        selected: period === initial.months,
      })}></md-segmented-button>`,
    )}
  </md-segmented-button-set>`;

  return panel({
    title,
    subtitle: initial.subtitle,
    actions: picker,
    attributes: { 'data-performance': true },
    children: html`${lineChart({
        series: seriesFor(initial),
        config: {
          xAxis: { data: initial.labels, scale: 'category' },
          yAxis: { label: title, min: GROWTH_FLOOR },
          format: 'number',
        },
        attributes: {
          // The chart carries no `label` of its own — the panel above already
          // says it. `summary` replaces the generated English aria-label so
          // the figure is still named, in the reader's language.
          curve: 'monotone',
          legend: 'top-end',
          'axis-ticks': true,
          height: CHART_MD,
          summary: t('chart.summary.line', { label: title, count: 2 }),
          'data-periods': JSON.stringify(periodPayload),
        },
      })}

      <md-divider></md-divider>

      ${figures(initial, { 'data-period-facts': true })}

      ${windows.map(
        (window_) => html`<template${attrs({ 'data-period-dl': String(window_.months) })}>${figures(window_)}</template>`,
      )}`,
  });
}

/* ------------------------------------------------------------------ donut */

function allocationPanel(t) {
  const totals = getBookTotals();
  const rows = getBookAllocation();

  /*
   * The palette is the kit's, looked up PER ROW rather than positionally:
   * equity must be the same violet in the ring, the chip and the meter, or
   * the three stop being readable together.
   */
  const data = rows.map((row) => ({
    label: t(row.assetClassKey),
    value: row.marketValue,
    color: assetClassColor[row.assetClass],
  }));

  return panel({
    title: t('wealth.panel.allocation'),
    subtitle: t('wealth.panel.allocationHint'),
    /*
     * `inner-radius` first, then the centre slot: content in the middle of a
     * SOLID pie sits on top of the slices. `show-labels="false"` (the string,
     * as React writes it) because the legend already names the slices, and the
     * label the chart would draw inside them is a nine-digit euro amount that
     * does not fit in a 4% wedge. `table-labels` rides the same `serialized:`
     * channel as the data, so the accessible table's headers are localised too.
     */
    children: pieChart({
      data,
      config: { format: 'currency' },
      attributes: {
        'table-labels': prop({
          category: t('wealth.table.assetClass'),
          value: t('wealth.table.marketValue'),
          share: t('wealth.table.weight'),
        }),
        'inner-radius': '62%',
        'padding-angle': '1',
        'show-labels': 'false',
        legend: 'bottom',
        // Taller than the line chart beside it: a ring plus a five-item
        // legend needs the height the curve does not, and `.grid-wide`
        // stretches both cards to the taller one anyway.
        height: CHART_LG,
      },
      children: html`<div slot="center"><strong>${money(t, totals.aum, { compact: true })}</strong><br />${t('wealth.kpi.aum.short')}</div>`,
    }),
  });
}

/* ------------------------------------------------------------ drift panel */

/**
 * One asset class, target against actual, with the drift as a meter.
 * `md-card`, not a `<div>` with a border — `variant="outlined"` is what the
 * old hand-rolled rule was imitating, without the component's density scale,
 * RTL-safe padding or state layer.
 */
function allocationRowBlock(t, row) {
  return html`<md-card variant="outlined" full-width class="alloc-row">
    <div class="alloc-row__head">
      <h3 class="alloc-row__name">${t(row.assetClassKey)}</h3>
      ${allocationChip(t, row.status)}
    </div>

    <!-- md-meter, not md-progress-indicator: this is a STATE (how far from
         target), not an activity. The bar carries the distance, the colour the
         band, the signed text the direction — colour is never the only signal. -->
    ${driftMeter(t, row.drift)}

    <div class="alloc-row__figures">
      <span>${t('wealth.table.target')} ${percent(t, row.targetWeight, { digits: 1 })}</span>
      <span>${t('wealth.table.actual')} ${percent(t, row.actualWeight, { digits: 1 })}</span>
      <span>${t('wealth.table.rebalance')} ${signed(t, row.rebalanceAmount, { compact: true })}</span>
    </div>
  </md-card>`;
}

function driftPanel(t) {
  const rows = getBookAllocation();

  // No subtitle: the donut panel beside it already carries "target against
  // actual, by asset class", and saying it twice on one screen is noise.
  return panel({
    title: t('wealth.table.drift'),
    children: html`<div class="stack">
      ${rows.map((row) => allocationRowBlock(t, row))}
    </div>`,
  });
}

/* -------------------------------------------------------- rebalance panel */

/** One mandate that has drifted, with the household's initials beside it. */
function driftedRow(t, locale, entry) {
  const { household, worst } = entry;

  return html`<md-card variant="outlined" full-width class="alloc-row">
    <div class="alloc-row__head">
      <span class="with-dot">
        <!-- 'label' names it for assistive tech; 'name' only supplies the
             initials. A household is not a control and opens nothing, so the
             avatar is presentational beside the link that does. -->
        <md-avatar${attrs({ name: household.name, label: household.name, size: 'small' })}></md-avatar>
        ${drill(locale, route.household(household.id), household.name)}
      </span>
      ${allocationChip(t, worst.status)}
    </div>

    <div class="alloc-row__figures">
      <span>${t(worst.assetClassKey)} ${signed(t, worst.drift, { kind: 'percent' })}</span>
      <span>${t('wealth.kpi.driftBreaches')} ${num(t, entry.breachCount)}</span>
      <span>${t('wealth.allocationStatus.drifted')} ${num(t, entry.driftedCount)}</span>
    </div>
  </md-card>`;
}

function rebalancePanel(t, locale) {
  /*
   * EVERY DRIFTED MANDATE, not the first five: a rebalancing queue is exactly
   * the list you want in full — "2 more" gives no name, no drift and nothing
   * to act on.
   */
  const drifted = driftedMandates();

  return panel({
    title: t('wealth.panel.rebalance'),
    subtitle: t('wealth.panel.rebalanceHint'),
    actions: count(t, drifted.length, { color: 'warning' }),
    children:
      drifted.length === 0
        ? // No hint: this is a fact about the book, not a filter result.
          emptyState(t, t('wealth.empty.rebalance'))
        : html`<div class="stack">
            ${drifted.map((entry) => driftedRow(t, locale, entry))}
          </div>`,
  });
}

/* ------------------------------------------------------------- book table */

/** Which columns want `desc` on their first click: the ones where big is the news. */
const NUMERIC_KEYS = ['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount'];

/**
 * The advisor's book, as a filtered, sortable table.
 *
 * THE TABLE SORTS NOTHING. `sort-by` / `sort-order` are display state and
 * `mdSortChange` is a REQUEST — in React the handler re-reads
 * `getHouseholds()`; here the client script re-orders the live rows by the
 * `data-sort-*` keys stamped below, which carry the same raw values that
 * selector sorts on (numbers, untranslated names, ISO dates), with the row's
 * `value` (the id) as the tie-break the kit uses. There is no pagination:
 * eight households fit, and a bar reading "1–8 of 8" tells the reader nothing.
 *
 * DRILLING is the household name, a real anchor — reachable by Tab, has a URL
 * you can copy, and does not put a second activation target around the cells.
 */
function bookTable(t, locale) {
  const layout = TABLES.households(false);
  const rows = getHouseholds({ sortBy: 'totalAum', sortDir: 'desc' });
  const total = rows.length;

  /*
   * The facets the book actually contains, not every value the type allows —
   * offering a segment no household is in gives the reader a filter that can
   * only ever empty the table. Sorted by the raw value so every framework
   * build lists them in the same order.
   */
  const segments = [...new Set(getHouseholds().map((household) => household.segment))].sort();

  const columns = [
    { key: 'name', label: t('wealth.table.household') },
    { key: null, label: t('wealth.table.segment') },
    { key: null, label: t('wealth.table.mandate') },
    { key: null, label: t('wealth.table.strategy') },
    { key: 'totalAum', label: t('wealth.table.aum'), numeric: true },
    { key: 'ytdReturn', label: t('wealth.table.ytd'), numeric: true },
    { key: 'unrealisedPl', label: t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'memberCount', label: t('wealth.table.members'), numeric: true },
    { key: 'nextReviewDate', label: t('wealth.table.nextReview') },
  ];

  const row = (household) => html`<md-table-row${attrs({
    value: household.id,
    'data-name': household.name,
    'data-segment': household.segment,
    'data-sort-name': household.name,
    'data-sort-totalaum': household.totalAum,
    'data-sort-ytdreturn': household.ytdReturn,
    'data-sort-unrealisedpl': household.unrealisedPl,
    'data-sort-membercount': household.memberCount,
    'data-sort-nextreviewdate': household.nextReviewDate,
  })}>
    <md-table-cell>
      ${nameCell(
        kycStatusDot(t, household.kycStatus),
        // The name is the only searched field this table shows — the client's
        // highlight marks it and nothing else, because `getHouseholds` also
        // matches on `id`, which no column renders.
        drill(locale, route.household(household.id), household.name),
      )}
    </md-table-cell>
    <md-table-cell>${segmentChip(t, household.segment)}</md-table-cell>
    <md-table-cell>${mandateChip(t, household.mandate)}</md-table-cell>
    <md-table-cell>${strategyChip(t, household.strategy)}</md-table-cell>
    <md-table-cell numeric>${money(t, household.totalAum, { compact: true })}</md-table-cell>
    <md-table-cell numeric>${signed(t, household.ytdReturn, { kind: 'percent' })}</md-table-cell>
    <md-table-cell numeric>${signed(t, household.unrealisedPl, { compact: true })}</md-table-cell>
    <md-table-cell numeric>${num(t, household.memberCount)}</md-table-cell>
    <md-table-cell>${dateText(t, household.nextReviewDate)}</md-table-cell>
  </md-table-row>`;

  return html`<div class="table-host">
    <md-table-container variant="outlined">
      <md-table-toolbar${attrs({
        slot: 'top',
        headline: t('wealth.panel.book'),
        'supporting-text': t('wealth.common.showing', { shown: rows.length, total }),
        // `{shown} of {total}` with the shown count still open — the client
        // fills %shown% as the filters narrow, without re-translating.
        'data-count-template': t('wealth.common.showing', { shown: '%shown%', total }),
      })}></md-table-toolbar>

      <!-- THE FILTERS ARE A SECOND 'top' CHILD, not the toolbar's 'actions'
           slot: the toolbar's actions container is flex 0 0 auto — sized for
           icon buttons — and two form fields (~440px intrinsic) overflowed it
           straight over the headline at 420px. The container's 'top' part is a
           flex COLUMN, so a second child stacks under the toolbar, stays
           outside the scroll region with it, and wraps at narrow widths. -->
      <div slot="top" class="row row--end"${attrs({
        style: style({
          'padding-inline': 'var(--md-sys-spacing-inset-xl, 24px)',
          'padding-block-end': 'var(--md-sys-spacing-inset-md, 12px)',
        }),
      })}>
        <!-- UNCONTROLLED, exactly as in React: nothing ever writes 'value'
             back into a field the user is typing in. 'clearable="internal"'
             gives it its own ✕, which emits mdInput with an empty string,
             landing in the client like any other keystroke. -->
        <md-text-field${attrs({
          'data-filter-search': true,
          variant: 'outlined',
          type: 'search',
          clearable: 'internal',
          label: t('wealth.action.searchHouseholds'),
          density: '-2',
          style: style({ flex: '1 1 200px', 'max-inline-size': '300px' }),
        })}></md-text-field>
        <md-select value=""${attrs({
          'data-filter-segment': true,
          variant: 'outlined',
          clearable: true,
          'full-width': true,
          label: t('wealth.table.segment'),
          density: '-2',
          'clear-label': t('wealth.action.clearFilters'),
          style: style({ flex: '0 1 200px', 'max-inline-size': '240px' }),
        })}>
          ${segments.map(
            (value) => html`<md-select-option${attrs({ value })}>${t(`wealth.segment.${value}`)}</md-select-option>`,
          )}
        </md-select>
      </div>

      <md-table${attrs({
        'data-book': true,
        label: t('wealth.panel.book'),
        'column-template': layout.columns,
        'min-width': layout.minWidth,
        // The ratchet is measured once and never recomputed, so filtering
        // down to two rows would leave the height of eight behind it.
        'keep-height': 'false',
        striped: true,
        'sort-by': 'totalAum',
        'sort-order': 'desc',
        'row-count': rows.length,
      })}>
        <md-table-head>
          <!-- No 'active' / 'order' on the labels: md-table declares the sort
               above and pushes both down into every label itself. -->
          <md-table-row rowgroup="head">
            ${columns.map(
              (column) => html`<md-table-cell head scope="col"${attrs({ numeric: column.numeric || undefined })}>
                ${column.key
                  ? html`<md-table-sort-label${attrs({
                      column: column.key,
                      'default-order': NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc',
                      'icon-position': column.numeric ? 'start' : 'end',
                    })}>${column.label}</md-table-sort-label>`
                  : column.label}
              </md-table-cell>`,
            )}
          </md-table-row>
        </md-table-head>

        <md-table-body>${rows.map(row)}</md-table-body>
      </md-table>
    </md-table-container>

    <!-- The empty state stays INSIDE the container when a filter empties the
         table (swapping the table out would take the search field away with
         it — the only way to undo what caused the emptiness). It ships inert:
         the unfiltered book is never empty, so the live page has no empty
         element, exactly like React's first render. The search-specific
         message keeps its {query} slot open for the client to fill. -->
    <template data-empty${attrs({
      'data-msg-search': t('wealth.empty.search', { query: '%query%' }),
    })}>
      <div slot="empty">${emptyState(t, t('wealth.empty.households'), { hint: true })}</div>
    </template>
  </div>`;
}

/* --------------------------------------------------------- activity panel */

function activityPanel(t, locale) {
  const rows = getActivity({ limit: ACTIVITY_ROWS });

  /*
   * NO PANEL HEAD. The title, the "newest first" hint and the expand control
   * all live in the list's own disclosure row — a titled `panel__head` above
   * it would say the same thing twice with the affordance split across both.
   *
   * The caret is the component's: an `expandable` row renders its own trailing
   * icon-button carrying `aria-expanded` / `aria-controls` and rotates its
   * glyph. Every row is a REAL localized anchor (`type="link"`), which on this
   * build needs no interception at all — a page load IS the navigation.
   */
  return panel({
    children:
      rows.length === 0
        ? emptyState(t, t('wealth.empty.activity'))
        : html`<md-list${attrs({ label: t('wealth.panel.activity') })}>
            <md-list-item${attrs({
              expandable: true,
              expanded: true,
              'leading-icon': 'history',
              headline: t('wealth.panel.activity'),
              // The count is the point of a disclosure header: it tells you
              // what is behind the caret before you open it.
              'supporting-text': `${t('wealth.common.entries', { count: rows.length })} · ${t('wealth.panel.activityHint')}`,
            })}>
              ${rows.map(
                (entry, index) => html`${
                  // Hairlines are interleaved md-dividers — md-list has no
                  // `dividers` prop, and the list hides them from assistive
                  // tech itself. Everything is slotted: `expanded-content`
                  // takes a FLAT run of rows, never a nested md-list chassis.
                  index > 0 ? html`<md-divider slot="expanded-content" inset></md-divider>` : null
                }<md-list-item${attrs({
                  slot: 'expanded-content',
                  type: 'link',
                  href: localeHref(locale, route.household(entry.householdId)),
                  'leading-icon': 'history',
                  // One line, and the household is IN it: the log reads as a
                  // sentence, so it is written as one, and the date and actor
                  // sit in the trailing metadata where the eye can scan a
                  // column of them.
                  headline: `${t(entry.actionKey)} · ${entry.householdName}`,
                  lines: '1',
                })}>
                  <span slot="trailing-supporting-text">${dateText(t, entry.date, 'short')} · ${entry.actorName}</span>
                </md-list-item>`,
              )}
            </md-list-item>
          </md-list>`,
  });
}

/* ---------------------------------------------------------- quick actions */

const QUICK_ACTIONS = [
  { icon: 'description', labelKey: 'wealth.action.newProposal', path: route.proposals() },
  { icon: 'swap_horiz', labelKey: 'wealth.action.newOrder', path: route.trade() },
  { icon: 'flag', labelKey: 'wealth.action.newGoal', path: route.planning() },
];

/**
 * The compact-width primary action: one FAB that fans out into three.
 *
 * COMPACT-ONLY, same as React and for the manual's reason: above 900px this
 * app has a rail, and the rail already carries the one FAB M3 allows there;
 * below 900px the rail leaves the DOM and `md-navigation-bar` — a FAB's proper
 * companion — takes its place. React gates the mount with `useMediaQuery`;
 * this build parks the cluster in a `<template>` (inert: no live elements, no
 * upgraded components) and `client/quick-actions.mjs` mounts it under the same
 * query, so the desktop document holds exactly the elements React's does.
 *
 * The FAB is icon-only, so it carries its own `aria-label`; the popup is named
 * separately by `menu-label`. The menu wires itself to the FAB by `anchor` id
 * and manages `aria-expanded`, `aria-haspopup` and the icon morph itself.
 * `md-fab-menu-item` has no `value` prop, so each item's target rides on
 * `data-path` — already localized, because on this build a quick action is a
 * page load. Positioning is logical (`inset-inline-end`) so the cluster lands
 * in the correct corner under `dir="rtl"`, clearing both the docked navigation
 * bar and the dock's published `--awc-dock-height`.
 */
function quickActions(t, locale) {
  return html`<template data-quick-actions>
    <md-fab${attrs({
      id: FAB_ID,
      icon: 'add',
      'aria-label': t('wealth.nav.toolbar'),
      style: style({
        position: 'fixed',
        'inset-inline-end': 'var(--md-sys-spacing-inset-lg, 16px)',
        'inset-block-end':
          'calc(var(--awc-dock-height, 0px) + 80px + var(--md-sys-spacing-inset-lg, 16px))',
        'z-index': 'var(--md-sys-z-index-navigation, 200)',
      }),
    })}></md-fab>
    <md-fab-menu${attrs({
      anchor: FAB_ID,
      placement: 'up',
      'menu-label': t('wealth.nav.toolbar'),
    })}>
      ${QUICK_ACTIONS.map(
        (action) => html`<md-fab-menu-item${attrs({
          icon: action.icon,
          label: t(action.labelKey),
          'data-path': localeHref(locale, action.path),
        })}></md-fab-menu-item>`,
      )}
    </md-fab-menu>
  </template>`;
}
