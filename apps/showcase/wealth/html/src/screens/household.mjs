/**
 * Screen 3 — one household, and the only screen that takes a parameter.
 *
 * The id always resolves: the build enumerates its pages FROM the fixture, so
 * unlike the SPA builds there is no unknown-household guard to render — a
 * household that is not in the fixture has no file on disk, and the static
 * host's 404 is the 404.
 *
 * WHAT THE SCREEN IS. Five figures, then the mandate's performance, then how
 * far it has drifted from its target allocation, then what it actually holds,
 * then what the money is FOR — and last, four sibling views of the household
 * itself behind a tab strip. That is the reading order of a review meeting:
 * how big, how it did, how far off, what is in it, who it is for.
 *
 * NOTHING HERE COMPUTES ANYTHING. Every number on this screen is a field on a
 * kit record or the return value of a kit function: `returnWindows` for the
 * windows, `growthOf100` for the chart, `getAllocationFor` and `rebalanceSheet`
 * for the drift, `getOrders` for the tickets under it, `driftedMandates` for
 * the breach counts, `goalSummary` for the objectives roll-up. The only thing
 * this file decides is what is on screen — which is also the only thing the
 * settings sheet changes.
 *
 * WHAT IS PROGRESSIVE HERE, AND HOW. The React build holds three pieces of
 * view state (the settings sheet's four switches, whether the sheet is open,
 * and the transient snackbar message) plus the holdings facet/sort, the org
 * chart's selection, the member checkboxes and the mandate review gate. This
 * build writes the DEFAULT of every one of those states into the file — every
 * switch on, no facet, the default sort, the first member selected, nothing
 * ticked, review pending — and `src/client/household.mjs` wires the behaviour
 * on top. With JavaScript off the page is the complete default view, which is
 * exactly what React's first paint is.
 *
 * The alternate states that scripting can reach ride along in `<template>`
 * elements (per-class table feet, the org-chart detail bodies, the recorded
 * review, the allocation empty state), so the live DOM census matches the
 * React build exactly — a template's content is inert — while the client swaps
 * rather than re-derives. Filterable rows are keyed with `data-*` attributes
 * (`data-class`, `data-sort-*`, `data-status`), never matched on localised
 * cell text.
 */

import {
  assetClassTotals,
  crumbsFor,
  driftedMandates,
  getActivityFor,
  getAllocationFor,
  getClientById,
  getClientsFor,
  getGoalById,
  getGoalsFor,
  getHouseholdById,
  getOrders,
  getPerformanceSeries,
  getPortfolioById,
  getPortfolioFor,
  getPositions,
  getProposalsFor,
  goalSummary,
  growthOf100,
  kycDot,
  plColor,
  rebalanceSheet,
  REPORTING_DATE,
  returnWindows,
  route,
  TABLES,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { barChart, lineChart, organizationChart } from '../lib/charts.mjs';
import {
  activityCategoryChip,
  allocationChip,
  assetClassChip,
  clientRoleChip,
  count,
  dateText,
  drill,
  fact,
  fundedMeter,
  goalStatusChip,
  driftMeter,
  kpiTile,
  kycChip,
  mandateChip,
  money,
  num,
  orderSideChip,
  orderStatusChip,
  percent,
  priorityChip,
  proposalStatusChip,
  proposalTypeChip,
  riskProfileChip,
  riskToleranceChip,
  segmentChip,
  signed,
  strategyChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

/**
 * Initials for a DECORATIVE avatar.
 *
 * `md-avatar` derives initials from `name` itself — but setting `name` also
 * gives the avatar `role="img"` and an `aria-label`, and the row it sits in
 * already announces that same name as its headline. Passing `initials` and
 * leaving `name` / `label` / `alt` empty is the documented way to make the
 * avatar decorative, which is what a picture beside its own caption is.
 */
function initialsOf(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`;
}

/**
 * An `md-button` for the roving toolbar / action rows.
 *
 * §9.1: the client listens to the component's own `mdClick`, never the native
 * `click` — the native one fires even when `soft-disabled` has already
 * suppressed the action. Bare, never wrapped: `md-toolbar` and the action rows
 * wire roving focus over their DIRECT children.
 */
function actionButton(t, { icon, label, variant = 'text', softDisabled = false, attributes = {} }) {
  return html`<md-button${attrs({
    variant,
    size: 'sm',
    icon,
    'soft-disabled': softDisabled || undefined,
    ...attributes,
  })}>${label}</md-button>`;
}

export function householdScreen(t, locale, id) {
  const household = getHouseholdById(id);
  const path = route.household(id);

  const portfolio = getPortfolioFor(household.id);
  const members = getClientsFor(household.id);
  const goals = getGoalsFor(household.id);
  const proposals = getProposalsFor(household.id);
  const activity = getActivityFor(household.id, 12);
  const allocation = getAllocationFor(household.id);
  const sheet = portfolio ? rebalanceSheet(portfolio.id) : [];
  /*
   * Every ticket ever raised for this mandate, newest first — the selector's
   * own order, not a sort here. `getOrders({ working: true })` would keep only
   * the live ones, and the settled and cancelled tickets are exactly the ones
   * that explain the drift the panel is reporting.
   */
  const orders = portfolio ? getOrders({ portfolioId: portfolio.id }) : [];
  const performance = getPerformanceSeries({ householdId: household.id });
  const growth = growthOf100({ householdId: household.id });
  // 3, 6 (year to date), 12 and 24 months, in that order — the kit's contract.
  const windows = returnWindows({ householdId: household.id });
  const ytd = windows[1];
  const objectives = goalSummary(goals);

  /*
   * Breach and drift counts come from the kit, not from a `.filter()` here.
   * A household that is entirely in band is simply absent from
   * `driftedMandates()` — which is the zero, and `?? 0` is how that reads.
   */
  const drifted = driftedMandates().find((row) => row.household.id === household.id);

  const children = html`${kpis(t, { household, portfolio, performance, ytd, drifted, objectives })}

    ${portfolio ? performancePanel(t, locale, { portfolio, growth, windows }) : null}

    ${allocationPanel(t, { allocation, sheet, drifted, orders })}

    ${panel({
      title: t('wealth.panel.holdings'),
      subtitle: portfolio ? portfolio.reference : undefined,
      actions: count(t, household.positionCount),
      children: householdHoldings(t, { household, portfolio }),
    })}

    ${objectivesPanel(t, { goals, objectives })}

    ${panel({ children: householdTabs(t, locale, { household, portfolio, members, goals, proposals, activity, allocation, breachCount: drifted?.breachCount ?? 0 }) })}

    ${settingsSheet(t)}

    ${snackbar(t)}`;

  return screen(t, {
    locale,
    here: path,
    title: t('wealth.screen.household.title', { name: household.name }),
    subtitle: t('wealth.screen.household.subtitle', {
      segment: t(household.segmentKey),
      mandate: t(household.mandateKey),
      members: members.length,
    }),
    crumbs: crumbsFor(path, household),
    aside: aside(t, household),
    actions: actions(t, locale),
    children,
  });
}

/* ------------------------------------------------------------------- chrome */

/**
 * Avatar, member-count badge and KYC dot as ONE object.
 *
 * `md-badge` and `md-status-dot` both position themselves absolutely against
 * the nearest POSITIONED ancestor, which is what `.badge-anchor` is for. The
 * badge takes the top corner and the dot the bottom, and the dot is
 * deliberately unlabelled: the KYC chip beside it already says the same word,
 * and naming both announces the state twice.
 */
function aside(t, household) {
  return html`<span class="badge-anchor">
      <md-avatar${attrs({ name: household.name, label: household.name, size: 'medium' })}></md-avatar>
      <md-badge${attrs({ shape: 'circle', value: String(household.memberCount) })}></md-badge>
      <md-status-dot${attrs({ shape: 'circle', state: kycDot[household.kycStatus], size: 'small' })}></md-status-dot>
    </span>
    ${segmentChip(t, household.segment)}
    ${mandateChip(t, household.mandate)}
    ${strategyChip(t, household.strategy)}
    ${kycChip(t, household.kycStatus)}`;
}

/**
 * The three toolbar actions. An `md-toolbar` is ONE tab stop with arrow-key
 * movement between its DIRECT children, so these are bare `md-button`s. None
 * is emphasised: the rail's FAB is already the loudest control here.
 *
 * Rebalance is a NAVIGATION, so it is an `href` — this build's routing is a
 * page load, and the button works before (and without) JavaScript. The other
 * two are behaviour: the message a contact raises is baked into `data-notify`
 * in this page's language, and `data-sheet-open` names the sheet toggle for
 * the client script.
 */
function actions(t, locale) {
  return html`${actionButton(t, {
      icon: 'balance',
      label: t('wealth.action.rebalance'),
      attributes: { href: localeHref(locale, route.trade()) },
    })}
    ${actionButton(t, {
      icon: 'mail',
      label: t('wealth.action.contact'),
      attributes: { 'data-notify': t('wealth.activity.client-contacted') },
    })}
    ${actionButton(t, {
      icon: 'tune',
      label: t('wealth.action.filter'),
      attributes: { 'data-sheet-open': true },
    })}`;
}

/* --------------------------------------------------------------------- KPIs */

function kpis(t, { household, portfolio, performance, ytd, drifted, objectives }) {
  const trendLabels = performance.map((point) => t.formatDate(point.date, 'monthYear'));

  return html`<section class="kpi-grid">
    ${kpiTile(t, {
      label: t('wealth.kpi.aum'),
      value: money(t, household.totalAum, { compact: true }),
      hint: portfolio ? portfolio.reference : t('wealth.common.na'),
      trend: performance.map((point) => point.marketValue),
      trendLabels,
      trendFormat: 'currency',
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.ytdReturn'),
      value: percent(t, household.ytdReturn),
      hint: html`${t('wealth.common.vsBenchmark')} ${signed(t, ytd.excess, { kind: 'percent' })}`,
      // The sparkline takes the same colour the excess return is printed in,
      // from the kit's own dead-banded mapping — never a ternary here.
      color: plColor(ytd.excess),
      trend: performance.map((point) => point.cumulativeReturn),
      trendLabels,
      trendFormat: 'percent',
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.unrealisedPl'),
      value: signed(t, household.unrealisedPl, { compact: true }),
      hint: portfolio ? percent(t, portfolio.unrealisedPlPct) : null,
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.driftBreaches'),
      value: num(t, drifted?.breachCount ?? 0),
      hint: t('wealth.allocationStatus.drifted'),
      trailing: count(t, drifted?.driftedCount ?? 0, { color: 'warning' }),
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.goals'),
      value: num(t, objectives.count),
      hint: t('wealth.kpi.goalsOnTrack'),
      trailing: count(t, objectives.onTrack, { color: 'success' }),
    })}
  </section>`;
}

/* -------------------------------------------------------------- performance */

function performancePanel(t, locale, { portfolio, growth, windows }) {
  return panel({
    title: t('wealth.panel.performance'),
    subtitle: t('wealth.panel.performanceHint', {
      base: t.formatNumber(100),
      months: t.formatNumber(growth.length),
    }),
    children: html`<div class="grid-wide">
      ${lineChart({
        /*
         * Growth of 100, not two cumulative percentages: two crossing lines
         * are readable and two crossing percentage figures are not.
         *
         * The benchmark series is DROPPED FROM THE DATA when the reader turns
         * it off in the settings sheet, rather than hidden through the chart's
         * own legend — the chart remembers legend toggles across a data
         * re-feed, so the two would fight over which of them owns "is the
         * benchmark showing". `data-series-toggle` tells the client script
         * which series id that switch removes.
         *
         * `summary` replaces the generated `aria-label`, whose default
         * sentence is assembled in English. There is no visible `label`,
         * because the panel's own heading already names the chart.
         */
        series: [
          { id: 'portfolio', label: portfolio.reference, data: growth.map((point) => point.portfolio) },
          { id: 'benchmark', label: portfolio.benchmarkName, data: growth.map((point) => point.benchmark) },
        ],
        config: {
          xAxis: { data: growth.map((point) => t.formatDate(point.date, 'monthYear')), scale: 'category' },
          yAxis: { min: 90 },
          format: 'number',
        },
        attributes: {
          class: 'chart-md',
          locale: t.locale,
          summary: t('wealth.panel.performance'),
          curve: 'monotone',
          grid: 'horizontal',
          legend: 'top-end',
          'data-series-toggle': 'benchmark',
        },
      })}

      <!-- THE SAME SURFACE THE CHART SITS ON, read off the chart rather than
           picked by eye: md-line-chart's host paints
           --md-sys-color-surface-container-low at a 16px corner, which is
           exactly what md-card variant="outlined" is. -->
      <md-card variant="outlined" full-width class="surface-card fact-card">
        <dl class="dl">
          ${windows.map((window) =>
            fact(
              t('wealth.unit.months', { value: t.formatNumber(window.months) }),
              html`${percent(t, window.portfolio)}<br />${signed(t, window.excess, { kind: 'percent' })}`,
            ),
          )}
          ${fact(t('wealth.kpi.maxDrawdown'), signed(t, portfolio.maxDrawdown, { kind: 'percent' }))}
          ${fact(t('wealth.table.benchmark'), portfolio.benchmarkName)}
        </dl>
      </md-card>
    </div>`,
  });
}

/* --------------------------------------------------------------- allocation */

function allocationPanel(t, { allocation, sheet, drifted, orders }) {
  /*
   * The client's copy of what the bar chart plots, one entry per class, raw
   * fractions and UNTRANSLATED keys beside the translated label — the settings
   * sheet's cash / in-band switches re-feed the chart from this rather than
   * re-deriving anything, and they match on `assetClass` / `status`, never on
   * the localised label.
   */
  const chartRows = allocation.map((row) => ({
    assetClass: row.assetClass,
    status: row.status,
    label: t(row.assetClassKey),
    target: row.targetWeight,
    actual: row.actualWeight,
  }));

  return panel({
    title: t('wealth.panel.allocation'),
    subtitle: t('wealth.panel.allocationHint'),
    actions: drifted ? allocationChip(t, drifted.worst.status) : null,
    children: html`<!-- What the settings sheet swaps the whole stack for when
           its two allocation switches hide every row. React renders one or the
           other, never both, so this waits in a template rather than sitting
           hidden in the document. -->
      <template data-alloc-empty>${emptyState(t, t('wealth.empty.rebalance'))}</template>
      <div class="stack" data-alloc-stack>
        ${barChart({
          /*
           * Target against actual, one pair of bars per class. A donut cannot
           * show a target beside an actual, which is the only comparison this
           * panel exists to make. The weights stay FRACTIONS all the way to
           * the axis — the percent formatter is what turns 0.62 into 62%, so
           * the tooltip, the axis and the figures beside them cannot disagree.
           * `md-bar-chart` has no `summary` prop, so `label` is both the
           * visible title and the seed of the accessible name.
           */
          series: [
            { id: 'target', label: t('wealth.table.target'), data: chartRows.map((row) => row.target) },
            { id: 'actual', label: t('wealth.table.actual'), data: chartRows.map((row) => row.actual) },
          ],
          config: {
            xAxis: { data: chartRows.map((row) => row.label) },
            yAxis: { min: 0 },
            format: 'percent',
          },
          attributes: {
            class: 'chart-md',
            locale: t.locale,
            label: t('wealth.table.weight'),
            legend: 'top-end',
            'data-alloc': JSON.stringify({
              targetLabel: t('wealth.table.target'),
              actualLabel: t('wealth.table.actual'),
              rows: chartRows,
            }),
          },
        })}

        <!-- Full-width picture, cards flowing into .grid-2 — the two halves
             are the SAME rows twice, and side by side they cannot agree on a
             height (a 260px chart against ~800px of stacked cards). -->
        <div class="grid-2" data-alloc-cards>
          ${sheet.map(
            (row) => html`<md-card variant="outlined" full-width class="alloc-row"${attrs({
              'data-asset-class': row.assetClass,
              'data-status': row.status,
            })}>
              <div class="alloc-row__head">
                <h3 class="alloc-row__name">${t(row.assetClassKey)}</h3>
                ${allocationChip(t, row.status)}
              </div>
              <!-- The meter shows the DISTANCE from target and its colour how
                   far; the direction is in the signed value beside it and in
                   the trade side below, because a bar has no negative half to
                   carry a sign. -->
              ${driftMeter(t, row.drift)}
              <div class="alloc-row__figures">
                <span>${t('wealth.table.target')} ${percent(t, row.targetWeight, { digits: 1 })}</span>
                <span>${t('wealth.table.actual')} ${percent(t, row.actualWeight, { digits: 1 })}</span>
                <span>${t('wealth.table.driftBps')} ${t('wealth.unit.bps', { value: t.formatNumber(row.driftBps) })}</span>
              </div>
              <div class="row">
                <!-- 'side' is the kit's own buy/sell, and the signed amount
                     agrees with it: a sell is a negative trade. -->
                ${orderSideChip(t, row.side)}
                <span class="muted">${t('wealth.table.rebalance')}</span>
                ${signed(t, row.rebalanceAmount, { compact: true })}
              </div>
            </md-card>`,
          )}
        </div>

        <!-- WHAT IS ALREADY IN THE MARKET FOR THIS MANDATE. Every card above
             ends in an instruction, and the one thing that changes whether an
             advisor acts on it is whether some of it is already done. A list
             rather than a table: a mandate has one or two tickets, and
             list-style="segmented" keeps each one a tile. -->
        <md-divider></md-divider>

        <div class="row row--between">
          <h3 class="panel__title" id="household-tickets">${t('wealth.panel.blotter')}</h3>
          ${count(t, orders.length)}
        </div>

        ${orders.length === 0
          ? emptyState(t, t('wealth.empty.orders'))
          : html`<md-list${attrs({
              labelledby: 'household-tickets',
              'list-style': 'segmented',
              'interaction-mode': 'multi-action',
            })}>
              ${orders.map((order) => ticketRow(t, order))}
            </md-list>`}
      </div>`,
  });
}

/**
 * One order raised against this mandate, as a list row. Every field is read,
 * none is computed.
 *
 * ONE trailing element holding three, not three trailing elements: the slot
 * lays its children out as a column, so siblings stack and triple the row
 * height. The date is in the SUPPORTING LINE, not `trailing-supporting-text`:
 * filling the `trailing` slot replaces `trailing-icon` and
 * `trailing-supporting-text` outright, so a date slotted there would be in the
 * DOM at 0×0.
 */
function ticketRow(t, order) {
  return html`<md-list-item${attrs({
    headline: order.instrumentName,
    overline: `${order.ticker} · ${t(order.assetClassKey)}`,
    'leading-icon': 'receipt_long',
    lines: '3',
  })}>
    <span slot="supporting-text">${t(order.orderTypeKey)} · ${t('wealth.table.filled')} ${t('wealth.common.of', {
      count: t.formatNumber(order.filledQuantity),
      total: t.formatNumber(order.quantity),
    })} · ${dateText(t, order.createdDate, 'short')}</span>
    <span slot="trailing" class="row">
      ${orderSideChip(t, order.side)}
      ${orderStatusChip(t, order.status)}
      ${money(t, order.estimatedValueEur, { compact: true })}
    </span>
  </md-list-item>`;
}

/* ----------------------------------------------------------------- holdings */

/**
 * The household's holdings: a facet row of asset-class chips over a sortable
 * table.
 *
 * THE FACETS ARE NOT `.filter()`ed OUT OF THE ROWS. Which classes exist comes
 * from the kit's `assetClassTotals()`, in `ASSET_CLASS_ORDER`, dropping the
 * ones with no position — so the chip row and the allocation panel agree about
 * what the household actually holds. THERE IS NO "ALL" CHIP: toggling the
 * selected class off IS "all classes".
 *
 * The default sort (market value, descending) is BAKED INTO THE ROWS, so the
 * page is complete without the script; the client re-orders and filters these
 * same rows off `data-sort-*` / `data-class` keys, never the localised text.
 * The per-class foot totals wait in templates — the foot always shows the
 * KIT's roll-up for whatever slice is on screen, never a sum done here.
 *
 * NO PAGINATION. A household holds seven to nine positions; pagination on
 * nine rows is a control that never has a second page to go to.
 */
function householdHoldings(t, { household, portfolio }) {
  const layout = TABLES.positions(false);

  // Every position in the mandate, in the selector's own order — the facet
  // row is built from this.
  const all = getPositions({ householdId: household.id });
  const facets = assetClassTotals(all);

  // The rows as rendered: the React build's INITIAL_SORT.
  const rows = getPositions({ householdId: household.id, sortBy: 'marketValueEur', sortDir: 'desc' });

  /*
   * The unfiltered foot is the MANDATE's own securities value and unrealised
   * P/L, which the generator asserts are exactly the sum of the positions.
   * Adding the rendered rows up here would be the same number computed a
   * second way, and the second way is the one that drifts.
   */
  const totals = portfolio
    ? { marketValue: portfolio.securitiesValue, unrealisedPl: portfolio.unrealisedPl }
    : undefined;

  const columns = [
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'instrumentName', label: t('wealth.table.instrument') },
    { key: null, label: t('wealth.table.assetClass') },
    { key: null, label: t('wealth.table.currency') },
    { key: null, label: t('wealth.table.quantity'), numeric: true },
    { key: null, label: t('wealth.table.price'), numeric: true },
    { key: 'marketValueEur', label: t('wealth.table.marketValue'), numeric: true },
    { key: 'unrealisedPl', label: t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'unrealisedPlPct', label: t('wealth.table.plPct'), numeric: true },
    { key: 'weight', label: t('wealth.table.weight'), numeric: true },
    { key: 'dayChangePct', label: t('wealth.table.dayChange'), numeric: true },
  ];

  /** Columns whose first click should sort biggest-first rather than A–Z. */
  const numericKeys = ['marketValueEur', 'unrealisedPl', 'unrealisedPlPct', 'weight', 'dayChangePct'];

  const footRow = ({ marketValue, unrealisedPl }) => html`<md-table-row rowgroup="foot">
    <md-table-cell head scope="row" colspan="6">${t('wealth.common.total')}</md-table-cell>
    <md-table-cell numeric>${money(t, marketValue, { compact: true })}</md-table-cell>
    <md-table-cell numeric>${signed(t, unrealisedPl, { compact: true })}</md-table-cell>
    <md-table-cell></md-table-cell>
    <md-table-cell></md-table-cell>
    <md-table-cell></md-table-cell>
  </md-table-row>`;

  return html`<div class="stack">
    <div class="row" data-facets>
      ${facets.map(
        (facet) => html`<md-chip${attrs({
          'data-class': facet.assetClass,
          variant: 'filter',
          appearance: 'outlined',
          label: t(facet.assetClassKey),
        })}></md-chip>`,
      )}
      <span class="muted"${attrs({
        'data-count': true,
        'data-count-template': t('wealth.common.showing', { shown: '%shown%', total: all.length }),
      })}>${t('wealth.common.showing', { shown: rows.length, total: all.length })}</span>
    </div>

    <md-table-container variant="outlined" class="table-host">
      <md-table${attrs({
        'data-sortable': true,
        label: t('wealth.panel.holdings'),
        'column-template': layout.columns,
        'min-width': layout.minWidth,
        // The height ratchet is measured once and never recomputed, so it
        // strands dead space under the rows when the dock changes density.
        // Nothing here pages, so there is no jump for it to prevent.
        'keep-height': 'false',
        striped: true,
        'sort-by': 'marketValueEur',
        'sort-order': 'desc',
      })}>
        <md-table-head>
          <!-- No active / order on the labels: md-table declares the sort
               above and pushes both down into every label on sync, so a value
               written here could only ever disagree with it. -->
          <md-table-row rowgroup="head">
            ${columns.map(
              (column) => html`<md-table-cell head scope="col"${attrs({ numeric: column.numeric || undefined })}>${
                column.key
                  ? html`<md-table-sort-label${attrs({
                      column: column.key,
                      'default-order': numericKeys.includes(column.key) ? 'desc' : 'asc',
                      'icon-position': column.numeric ? 'start' : 'end',
                    })}>${column.label}</md-table-sort-label>`
                  : column.label
              }</md-table-cell>`,
            )}
          </md-table-row>
        </md-table-head>

        <md-table-body>
          ${rows.map(
            (position) => html`<md-table-row${attrs({
              value: position.id,
              'data-class': position.assetClass,
              // Attribute names are lowercased by the parser, so the client
              // looks them up lowercased too. Raw values, never cell text.
              'data-sort-ticker': position.ticker,
              'data-sort-instrumentname': position.instrumentName,
              'data-sort-marketvalueeur': position.marketValueEur,
              'data-sort-unrealisedpl': position.unrealisedPl,
              'data-sort-unrealisedplpct': position.unrealisedPlPct,
              'data-sort-weight': position.weight,
              'data-sort-daychangepct': position.dayChangePct,
            })}>
              <md-table-cell><span class="strong">${position.ticker}</span></md-table-cell>
              <md-table-cell>${position.instrumentName}</md-table-cell>
              <md-table-cell>${assetClassChip(t, position.assetClass)}</md-table-cell>
              <md-table-cell>${position.currency}</md-table-cell>
              <md-table-cell numeric>${num(t, position.quantity)}</md-table-cell>
              <!-- The LOCAL price, in the instrument's own currency — the EUR
                   twin is the market-value column beside it. -->
              <md-table-cell numeric>${money(t, position.price, { currency: position.currency, digits: 2 })}</md-table-cell>
              <md-table-cell numeric>${money(t, position.marketValueEur, { compact: true })}</md-table-cell>
              <md-table-cell numeric>${signed(t, position.unrealisedPl, { compact: true })}</md-table-cell>
              <md-table-cell numeric>${signed(t, position.unrealisedPlPct, { kind: 'percent' })}</md-table-cell>
              <md-table-cell numeric>${percent(t, position.weight, { digits: 1 })}</md-table-cell>
              <md-table-cell numeric>${signed(t, position.dayChangePct, { kind: 'percent' })}</md-table-cell>
            </md-table-row>`,
          )}
        </md-table-body>

        ${totals ? html`<md-table-foot>${footRow(totals)}</md-table-foot>` : null}
      </md-table>
    </md-table-container>

    <!-- One foot per facet, from the kit's own per-class roll-up. The client
         swaps the live foot row for the chosen class's and back; a template's
         content is inert, so the live page holds exactly one foot row. -->
    ${facets.map(
      (facet) => html`<template${attrs({ 'data-foot': true, 'data-class': facet.assetClass })}>${footRow(facet)}</template>`,
    )}
  </div>`;
}

/* --------------------------------------------------------------- objectives */

function objectivesPanel(t, { goals, objectives }) {
  return panel({
    title: t('wealth.panel.objectives'),
    subtitle: t('wealth.goal.projectedAt', {
      value: t.formatCurrency(objectives.projectedTotal, { notation: 'compact' }),
    }),
    actions: count(t, objectives.count),
    children:
      goals.length === 0
        ? emptyState(t, t('wealth.empty.goals'))
        : html`<div class="grid-3">
            ${goals.map(
              (goal) => html`<div class="goal-row">
                <div class="row row--between">
                  <span class="strong">${t(goal.typeKey)}</span>
                  ${goalStatusChip(t, goal.status)}
                </div>
                <!-- The bar is clamped at 100% but the TEXT is not, so an
                     over-funded objective reads "119%" beside a full bar. -->
                ${fundedMeter(t, { fraction: goal.fundedPct, status: goal.status })}
                <div class="row">
                  ${priorityChip(t, goal.priority)}
                  <span class="muted">${goal.beneficiaryName ?? t('wealth.common.household')}</span>
                </div>
                <div class="alloc-row__figures">
                  <span>${t('wealth.goal.fundedOf', {
                    current: t.formatCurrency(goal.currentAmount, { notation: 'compact' }),
                    target: t.formatCurrency(goal.targetAmount, { notation: 'compact' }),
                  })}</span>
                  <span>${t('wealth.table.targetDate')} ${dateText(t, goal.targetDate)}</span>
                  <span>${t('wealth.goal.monthsRemaining', { count: t.formatNumber(goal.monthsRemaining) })}</span>
                </div>
              </div>`,
            )}
          </div>`,
  });
}

/* --------------------------------------------------------------------- tabs */

/**
 * Four sibling views of ONE household: members, mandate, documents, activity.
 *
 * THIS IS THE LEGITIMATE USE OF `md-tabs` (§7.3): the tabs do not navigate —
 * every panel describes the same household from a different angle and the URL
 * does not change. App destinations remain the rail and the bar.
 *
 * ALL FOUR PANELS ARE WRITTEN INTO THE FILE. The React build mounts panel 0
 * with the screen and warms the other three during idle periods — a scheduling
 * concern a pre-rendered document does not have: by the time anyone can click
 * a tab, every panel has long been "mounted", which is exactly the state the
 * React page settles into. The panel ELEMENTS pair to tabs BY POSITION, so the
 * two lists stay the same length and order.
 *
 * `sizing="active"` rather than the default `stable`: with `stable` the region
 * is permanently as tall as the tallest panel, and the org chart is several
 * times the height of the activity list. The trade is a layout shift on
 * switch, which is the honest one.
 */
function householdTabs(t, locale, { household, portfolio, members, goals, proposals, activity, allocation, breachCount }) {
  const tabs = [
    { labelKey: 'wealth.panel.members', icon: 'group', badge: String(members.length) },
    { labelKey: 'wealth.panel.mandate', icon: 'gavel', badge: undefined },
    {
      labelKey: 'wealth.kpi.proposals',
      icon: 'description',
      badge: proposals.length ? String(proposals.length) : undefined,
    },
    { labelKey: 'wealth.panel.activity', icon: 'history', badge: undefined },
  ];

  return html`<div class="stack">
    <!-- tab-width="auto" rather than the default equal: the four labels are of
         very different lengths and equal tracks would truncate the longest.
         Every tab carries an icon — M3 forbids mixing icon+text tabs with
         text-only ones in the same set. -->
    <md-tabs${attrs({
      id: 'household-tabs',
      'aria-label': t('wealth.nav.household'),
      'active-tab-index': 0,
      'tab-width': 'auto',
    })}>
      ${tabs.map(
        (tab) => html`<md-tab${attrs({
          label: t(tab.labelKey),
          icon: tab.icon,
          'inline-icon': true,
          badge: tab.badge,
        })}></md-tab>`,
      )}
    </md-tabs>

    <md-tab-panels for="household-tabs" sizing="active">
      <md-tab-panel>${membersPanel(t, { household, portfolio, members, goals })}</md-tab-panel>
      <md-tab-panel>${mandatePanel(t, { household, portfolio, allocation, breachCount })}</md-tab-panel>
      <md-tab-panel>${documentsPanel(t, locale, proposals)}</md-tab-panel>
      <md-tab-panel>${activityPanel(t, activity)}</md-tab-panel>
    </md-tab-panels>
  </div>`;
}

/* ------------------------------------------------------------------ members */

/**
 * The household's structure, twice: as a tree and as a list.
 *
 * The org chart's own manual asks for exactly this — a connector-drawn tree is
 * a PICTURE of structure and a picture is not available to every reader. The
 * list below it is that alternative, and it is also where the per-member
 * controls live: a tree item cannot hold a checkbox.
 *
 * THE TREE IS REAL RELATIONS: the household entity at the root, its mandate
 * and its members beneath it, and each objective under the member it is
 * earmarked for (`Goal.beneficiaryClientId`), with the household-level ones
 * hanging off the root. Selecting any node fills the panel beside it — the
 * page ships the FIRST MEMBER's detail (the React default) and every other
 * node's body in a template for the client to swap in.
 */
function membersPanel(t, { household, portfolio, members, goals }) {
  if (members.length === 0) {
    return emptyState(t, t('wealth.empty.clients'));
  }

  const objectivesFor = (clientId) =>
    goals
      .filter((goal) => goal.beneficiaryClientId === clientId)
      .map((goal) => ({
        id: goal.id,
        name: t(goal.typeKey),
        title: t.formatPercent(goal.fundedPct, { maximumFractionDigits: 0 }),
      }));

  const memberNodes = members.map((client) => {
    const children = objectivesFor(client.id);
    return {
      id: client.id,
      name: client.name,
      title: t(client.roleKey),
      avatarInitials: initialsOf(client.name),
      ...(children.length ? { children } : {}),
    };
  });

  const mandateNode = portfolio
    ? [{ id: portfolio.id, name: portfolio.reference, title: t(portfolio.strategyKey) }]
    : [];

  const nodes = [
    {
      id: household.id,
      name: household.name,
      title: t(household.segmentKey),
      children: [...mandateNode, ...memberNodes, ...objectivesFor(null)],
    },
  ];

  const focusId = members[0]?.id ?? household.id;

  // Every body the detail pane can show. The default one is live in the card;
  // the templates are what the org chart's selection swaps in.
  const detailIds = [
    household.id,
    ...(portfolio ? [portfolio.id] : []),
    ...members.map((client) => client.id),
    ...goals.map((goal) => goal.id),
  ];

  return html`<div class="stack">
    <div class="grid-wide">
      ${organizationChart({
        nodes,
        attributes: {
          class: 'table-host',
          'selection-mode': 'single',
          orientation: 'vertical',
          label: t('wealth.panel.members'),
          // The wealth dictionary has no expand/collapse verbs; these two are
          // in the shared `core` block, which every locale is required to
          // translate (§9.2).
          'expand-label': t('action.expand'),
          'collapse-label': t('action.collapse'),
          // `selectedIds` is property-only — no attribute form to render — so
          // the client assigns it from this key, and falls back to the
          // household when clicking the selected node deselects it.
          'data-selected-id': focusId,
          'data-fallback-id': household.id,
        },
        children: html`<div slot="empty">${t('wealth.empty.clients')}</div>`,
      })}

      <!-- The detail pane beside the org chart, on a surface of its own: the
           same surface-container-low the charts sit on, which is what makes it
           read as a panel beside the tree rather than as loose text under it. -->
      <md-card variant="outlined" full-width class="surface-card fact-card" data-node-detail>
        ${nodeDetailBody(t, focusId, household)}
      </md-card>
    </div>

    ${detailIds.map(
      (nodeId) => html`<template${attrs({ 'data-node': nodeId })}>${nodeDetailBody(t, nodeId, household)}</template>`,
    )}

    <md-divider></md-divider>

    <div class="row row--between">
      <h3 class="panel__title">${t('wealth.panel.members')}</h3>
      <!-- ALWAYS RENDERED, HIDDEN WHILE NOTHING IS SELECTED — so the member
           list below does not jump down the moment a row is ticked.
           visibility: hidden rather than a reserved min-block-size: the space
           reserved is exactly what the real cluster occupies, and the button
           is out of the tab order and the accessibility tree while inert. -->
      <span class="row" data-cluster aria-hidden="true" style="visibility:hidden">
        ${count(t, 0)}
        ${actionButton(t, {
          icon: 'mail',
          label: t('wealth.action.contact'),
          attributes: { 'data-notify': t('wealth.activity.client-contacted') },
        })}
      </span>
    </div>

    <!-- interaction-mode="multi-action": the row is a label and the trailing
         controls are the actions, each keeping its own tab stop. No
         selection-mode — the checkbox IS the selection here, and a listbox
         mode would put a second, competing selected state on the row. -->
    <md-list${attrs({
      'data-members': true,
      'data-notify-message': t('wealth.activity.client-contacted'),
      label: t('wealth.panel.members'),
      'interaction-mode': 'multi-action',
    })}>
      ${members.map(
        (client) => html`<md-list-item${attrs({
          headline: client.name,
          overline: t(client.roleKey),
          /* THE KYC STATE IS IN THE SUPPORTING TEXT, not in a trailing chip:
             the trailing slot lays out as a column, and a chip pair plus the
             two controls became three stacked lines and a 140px row. The
             trailing edge is for CONTROLS; the facts belong in the row's own
             text. */
          'supporting-text': `${t('wealth.table.age')} ${t.formatNumber(client.age)} · ${t(
            `wealth.country.${client.domicile}`,
          )} · ${t(client.kycStatusKey)}`,
          lines: '3',
        })}>
          <!-- Avatar + corner dot, both decorative: the headline carries the
               name and the supporting text the KYC state in words, so the
               dot's colour repeats it rather than being its only carrier. -->
          <span slot="leading" class="badge-anchor">
            <md-avatar${attrs({ initials: initialsOf(client.name), size: 'small' })}></md-avatar>
            <md-status-dot${attrs({ shape: 'circle', state: kycDot[client.kycStatus], size: 'small' })}></md-status-dot>
          </span>

          <!-- ONE trailing element holding two controls: the slot stacks its
               children, so two siblings would double the row height. -->
          <span slot="trailing" class="row">
            <md-icon-button${attrs({
              'data-id': client.id,
              icon: 'mail',
              'aria-label': `${t('wealth.action.contact')} — ${client.name}`,
            })}></md-icon-button>
            <!-- md-checkbox renders no slot at all — aria-label is the only
                 accessible name a checkbox inside a row can have. -->
            <md-checkbox${attrs({ 'data-id': client.id, 'aria-label': client.name })}></md-checkbox>
          </span>
        </md-list-item>`,
      )}
    </md-list>
  </div>`;
}

/**
 * Whatever the reader picked in the tree. The id comes from the chart, which
 * got it from the fixture, so every branch here is a selector lookup — and
 * each one may return `undefined`, which is what the household fallback at the
 * end is for.
 */
function nodeDetailBody(t, id, household) {
  const client = getClientById(id);
  const goal = client ? undefined : getGoalById(id);
  const portfolio = client || goal ? undefined : getPortfolioById(id);

  if (client) {
    return html`<div class="stack">
      <div class="row">
        ${clientRoleChip(t, client.role)}
        ${kycChip(t, client.kycStatus)}
        ${riskToleranceChip(t, client.riskTolerance)}
      </div>
      <dl class="dl">
        ${fact(t('wealth.table.client'), client.name)}
        ${fact(t('wealth.table.age'), num(t, client.age))}
        ${fact(t('wealth.table.domicile'), t(`wealth.country.${client.domicile}`))}
        ${fact(t('wealth.table.kycReview'), dateText(t, client.kycReviewDate))}
        ${fact(t('wealth.table.contact'), html`<span class="muted">${client.email}</span>`)}
        ${fact(t('wealth.table.id'), client.id)}
      </dl>
    </div>`;
  }

  if (goal) {
    return html`<div class="stack">
      <div class="row">
        ${priorityChip(t, goal.priority)}
        ${goalStatusChip(t, goal.status)}
      </div>
      ${fundedMeter(t, { fraction: goal.fundedPct, status: goal.status })}
      <dl class="dl">
        ${fact(t('wealth.table.goal'), t(goal.typeKey))}
        ${fact(t('wealth.table.targetAmount'), money(t, goal.targetAmount, { compact: true }))}
        ${fact(t('wealth.table.targetDate'), dateText(t, goal.targetDate))}
        ${fact(t('wealth.table.projected'), money(t, goal.projectedAmount, { compact: true }))}
      </dl>
    </div>`;
  }

  if (portfolio) {
    return html`<div class="stack">
      <div class="row">${strategyChip(t, portfolio.strategy)}</div>
      <dl class="dl">
        ${fact(t('wealth.table.id'), portfolio.reference)}
        ${fact(t('wealth.table.benchmark'), portfolio.benchmarkName)}
        ${fact(t('wealth.table.marketValue'), money(t, portfolio.marketValue, { compact: true }))}
        ${fact(t('wealth.kpi.cash'), money(t, portfolio.cashBalance, { compact: true }))}
        ${fact(t('wealth.table.inception'), dateText(t, portfolio.inceptionDate))}
        ${fact(t('wealth.table.fee'), t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }))}
      </dl>
    </div>`;
  }

  return html`<div class="stack">
    <div class="row">
      ${segmentChip(t, household.segment)}
      ${mandateChip(t, household.mandate)}
    </div>
    <dl class="dl">
      ${fact(t('wealth.table.household'), household.name)}
      ${fact(t('wealth.table.domicile'), t(`wealth.country.${household.domicile}`))}
      ${fact(t('wealth.table.members'), num(t, household.memberCount))}
      ${fact(t('wealth.table.onboarded'), dateText(t, household.onboardedDate))}
      ${fact(t('wealth.table.advisor'), household.advisorName)}
      ${fact(t('wealth.table.aum'), money(t, household.totalAum, { compact: true }))}
    </dl>
  </div>`;
}

/* ------------------------------------------------------------------ mandate */

/**
 * The mandate: its terms as facts, its clauses as an accordion.
 *
 * `md-accordion` and not a second tab strip — these are independent sections a
 * reader opens on demand (§5.5's progressive disclosure), and comparing the
 * fee clause against the rebalancing clause means having both open, so
 * `exclusive` is off. `heading-level="3"` puts the clause headers under the
 * panel's own `h2` — `md-accordion-item` renders a REAL `<h3>`.
 *
 * THE RATING IS A CONTROL, NOT A READOUT: the score an advisor records at a
 * review is a judgement made here rather than a fact about the book, which is
 * why it is not in the fixture. It gates the review action through
 * `soft-disabled` plus an `md-tooltip` (§9.2: keep a contextually-unavailable
 * control focusable and say what is missing). The gate, the recorded date and
 * the confirmation note are client behaviour; their target states wait in the
 * two templates at the foot of the clause.
 */
function mandatePanel(t, { household, portfolio, allocation, breachCount }) {
  if (!portfolio) {
    return emptyState(t, t('wealth.common.na'));
  }

  return html`<div class="stack">
    <dl class="dl">
      ${fact(t('wealth.table.id'), portfolio.reference)}
      ${fact(t('wealth.table.benchmark'), portfolio.benchmarkName)}
      ${fact(t('wealth.table.inception'), dateText(t, portfolio.inceptionDate))}
      ${fact(t('wealth.table.fee'), t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }))}
      ${fact(t('wealth.kpi.cash'), money(t, portfolio.cashBalance, { compact: true }))}
      <!-- Recording the review swaps this fact for the template twin below:
           the label flips to "last review" and the date to the REPORTING
           DATE, never a clock — this console has no Date.now() anywhere. -->
      <div data-review-fact>
        <dt>${t('wealth.table.nextReview')}</dt>
        <dd>${dateText(t, portfolio.nextReviewDate)}</dd>
      </div>
    </dl>

    <md-accordion variant="outlined" heading-level="3" default-expanded="0">
      <md-accordion-item${attrs({ headline: t('wealth.table.strategy'), icon: 'pie_chart' })}>
        <div class="stack">
          <!-- THREE LABELLED FACTS, not a bare row of chips: risk profile and
               strategy share the words "balanced" and "growth" and their
               colour maps coincide, so on half the book the two chips come out
               byte-identical side by side — only the dt can separate them, for
               a reader and for a screen reader alike. -->
          <dl class="dl">
            ${fact(t('wealth.table.strategy'), strategyChip(t, portfolio.strategy))}
            ${fact(t('wealth.table.riskProfile'), riskProfileChip(t, household.riskProfile))}
            ${fact(t('wealth.table.mandate'), mandateChip(t, household.mandate))}
          </dl>
          <dl class="dl">
            ${allocation.map((row) => fact(t(row.assetClassKey), percent(t, row.targetWeight, { digits: 0 })))}
          </dl>
        </div>
      </md-accordion-item>

      <md-accordion-item${attrs({ headline: t('wealth.table.fee'), icon: 'receipt_long' })}>
        <dl class="dl">
          ${fact(t('wealth.table.fee'), t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }))}
          ${fact(t('wealth.table.costBasis'), money(t, portfolio.costBasis, { compact: true }))}
          ${fact(t('wealth.table.marketValue'), money(t, portfolio.marketValue, { compact: true }))}
          ${fact(t('wealth.table.unrealisedPl'), signed(t, portfolio.unrealisedPl, { compact: true }))}
          ${fact(t('wealth.table.plPct'), signed(t, portfolio.unrealisedPlPct, { kind: 'percent' }))}
        </dl>
      </md-accordion-item>

      <md-accordion-item${attrs({ headline: t('wealth.panel.rebalance'), icon: 'balance' })}>
        <dl class="dl">
          ${fact(t('wealth.table.lastRebalance'), dateText(t, portfolio.lastRebalanceDate))}
          ${fact(t('wealth.table.nextReview'), dateText(t, portfolio.nextReviewDate))}
          ${fact(t('wealth.table.lastContact'), dateText(t, household.lastContactDate))}
          ${fact(t('wealth.kpi.driftBreaches'), num(t, breachCount))}
        </dl>
      </md-accordion-item>

      <md-accordion-item${attrs({ headline: t('wealth.table.riskProfile'), icon: 'shield' })}>
        <div class="stack">
          <dl class="dl">
            ${fact(t('wealth.kpi.maxDrawdown'), signed(t, portfolio.maxDrawdown, { kind: 'percent' }))}
            ${fact(t('wealth.kpi.twoYearReturn'), percent(t, portfolio.twoYearReturn))}
            ${fact(t('wealth.kpi.benchmark'), percent(t, portfolio.benchmarkTwoYearReturn))}
          </dl>

          <div class="row">
            <span class="muted">${t('wealth.table.riskTolerance')}</span>
            <!-- getLabel is a FUNCTION prop with no attribute form — it drives
                 the visible value label AND aria-valuetext, so the client
                 resolves it through the dictionary, never a template literal. -->
            <md-rating${attrs({
              'data-rating': true,
              value: 0,
              max: '5',
              precision: '1',
              size: 'sm',
              'show-value-label': true,
              'rating-label': t('wealth.table.riskTolerance'),
            })}></md-rating>
          </div>

          <div class="row">
            <!-- The tooltip exists only while the gate does: once a score is
                 recorded the button is live, and an explanation of why it is
                 off would be a lie. A tooltip is a DESCRIPTION, never a name. -->
            <md-tooltip${attrs({ 'data-review-tooltip': true, text: t('wealth.table.riskTolerance') })}>
              ${actionButton(t, {
                icon: 'task_alt',
                variant: 'tonal',
                softDisabled: true,
                label: t('wealth.action.review'),
                attributes: {
                  'data-review': true,
                  'data-message': t('wealth.activity.review-completed'),
                },
              })}
            </md-tooltip>
            <template data-review-note><span class="muted">${t('wealth.activity.review-completed')}</span></template>
          </div>

          <template data-review-fact-done>
            <div data-review-fact>
              <dt>${t('wealth.table.lastReview')}</dt>
              <dd>${dateText(t, REPORTING_DATE)}</dd>
            </div>
          </template>
        </div>
      </md-accordion-item>
    </md-accordion>
  </div>`;
}

/* ---------------------------------------------------------------- documents */

/**
 * The household's advice documents. A proposal IS the document in this domain,
 * so this list is `getProposalsFor()` and not a second, invented entity.
 *
 * The drill is the trailing `md-icon-button`; on this build the navigation is
 * a page load into this page's own locale, baked into `data-href` on the list.
 */
function documentsPanel(t, locale, proposals) {
  if (proposals.length === 0) {
    return emptyState(t, t('wealth.empty.proposals'));
  }

  return html`<md-list${attrs({
    'data-documents': true,
    'data-href': localeHref(locale, route.proposals()),
    label: t('wealth.kpi.proposals'),
    'interaction-mode': 'multi-action',
    'list-style': 'segmented',
  })}>
    ${proposals.map(
      (proposal) => html`<md-list-item${attrs({
        headline: t(proposal.typeKey),
        overline: proposal.id,
        'supporting-text': `${t('wealth.common.of', {
          count: proposal.completedStepCount,
          total: proposal.stepCount,
        })} · ${t('wealth.unit.days', { value: t.formatNumber(proposal.daysOpen) })}`,
        'leading-icon': 'description',
        lines: '3',
      })}>
        <!-- One trailing element, for the same reason as the members list. -->
        <span slot="trailing" class="row">
          ${proposalTypeChip(t, proposal.type)}
          ${proposalStatusChip(t, proposal.status)}
          <md-icon-button${attrs({
            'data-id': proposal.id,
            icon: 'open_in_new',
            'aria-label': `${t('wealth.action.review')} — ${proposal.id}`,
          })}></md-icon-button>
        </span>
      </md-list-item>`,
    )}
  </md-list>`;
}

/* ----------------------------------------------------------------- activity */

/** The household's audit trail, newest first — as the kit already returns it. */
function activityPanel(t, activity) {
  if (activity.length === 0) {
    return emptyState(t, t('wealth.empty.activity'));
  }

  return html`<md-list${attrs({ label: t('wealth.panel.activity') })}>
    ${activity.map(
      (entry) => html`<md-list-item${attrs({
        headline: t(entry.actionKey),
        overline: `${t(entry.targetTypeKey)} · ${entry.targetLabel}`,
        'supporting-text': entry.actorName,
        'leading-icon': 'history',
        lines: '3',
      })}>
        <span slot="trailing" class="row">${activityCategoryChip(t, entry.category)}</span>
        <span slot="trailing-supporting-text">${dateText(t, entry.date, 'short')}</span>
      </md-list-item>`,
    )}
  </md-list>`;
}

/* ----------------------------------------------------------------- settings */

/** What the reader has chosen to see — pure view state, defaults all on. */
const TOGGLES = [
  { key: 'benchmark', labelKey: 'wealth.kpi.benchmark', icon: 'timeline' },
  { key: 'trend', labelKey: 'wealth.table.trend', icon: 'show_chart' },
  { key: 'cash', labelKey: 'wealth.assetClass.cash', icon: 'savings' },
  { key: 'inBand', labelKey: 'wealth.allocationStatus.in-band', icon: 'check_circle' },
];

/**
 * The household screen's view settings, in a side sheet.
 *
 * A SIDE SHEET AND NOT A DIALOG: these four switches change what the screen
 * shows while you read it — a dialog would blank the thing being configured.
 * `variant="modal"` rather than `standard` because the modal variant carries
 * the focus trap, Escape and focus restoration itself (§9.3 rule 4: never
 * write your own).
 *
 * SWITCHES AND NOT CHECKBOXES: every one takes effect the moment it is
 * flipped; there is no Apply — which is why the only other control is a reset.
 *
 * THE RESET IS AT THE TOP OF THE CONTENT, not in `slot="actions"`: the
 * showcase dock is a fixed bar across the bottom of the viewport with a
 * z-index above the sheet, so an actions row renders underneath it —
 * invisible, and unclickable.
 */
function settingsSheet(t) {
  return html`<md-side-sheet${attrs({
    'data-settings': true,
    variant: 'modal',
    side: 'end',
    headline: t('wealth.action.filter'),
    'top-divider': true,
  })}>
    <div class="row row--end">
      ${actionButton(t, {
        icon: 'restart_alt',
        label: t('wealth.action.clearFilters'),
        attributes: { 'data-settings-reset': true },
      })}
    </div>

    <!-- selection-mode is deliberately absent: a listbox mode would put a
         second, competing selected state on the row beside the switch that is
         the real control. -->
    <md-list${attrs({
      'data-settings-list': true,
      class: 'table-host',
      label: t('wealth.action.filter'),
      'interaction-mode': 'multi-action',
    })}>
      ${TOGGLES.map(
        (toggle) => html`<md-list-item${attrs({
          headline: t(toggle.labelKey),
          'leading-icon': toggle.icon,
          lines: '1',
        })}>
          <!-- md-switch has NO default slot: the label is the row's headline,
               and the switch carries aria-label with the same words, because a
               bare switch has no accessible name at all. -->
          <md-switch${attrs({
            slot: 'trailing',
            'data-key': toggle.key,
            selected: true,
            'aria-label': t(toggle.labelKey),
          })}></md-switch>
        </md-list-item>`,
      )}
    </md-list>
  </md-side-sheet>`;
}

/* ----------------------------------------------------------------- snackbar */

/**
 * One snackbar, one message. The component has no queue by design and M3
 * forbids two at once, so every notification on this screen goes through this
 * single element. `position="bottom"` is the component default and M3's
 * placement; the offset that keeps it clear of the dock and — below 900px —
 * the navigation bar is `.wealth-snackbar` (styles/snackbar.css), shared with
 * the other screens that toast so all of them land in the same place.
 */
function snackbar(t) {
  return html`<md-snackbar${attrs({
    'data-snackbar': true,
    class: 'wealth-snackbar',
    position: 'bottom',
    closeable: true,
    'auto-hide': true,
    'dismiss-label': t('wealth.action.close'),
  })}></md-snackbar>`;
}
