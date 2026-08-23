/**
 * Screen 1 — portfolio overview, and the head of the drill path.
 *
 * Four KPI tiles, each with its own eight-quarter sparkline; exposure by
 * sector; the rating distribution; the exposure trend split by rating band; and
 * the whole counterparty book sorted by exposure. Both the sector bars and the
 * table rows are doors: sector bars drill on click, counterparty names are
 * anchors.
 *
 * Every trend on this screen is computed by `@awc-ui/showcase-kit/credit-risk`
 * from the fixture's rating history, calibrated so the last point of a series
 * equals the KPI above it — so the numbers here and in the React build are the
 * same numbers, not two implementations that agree today.
 */

import {
  getCounterparties,
  getPortfolioTotals,
  getRatingScale,
  getSectors,
  REPORTING_DATE,
  REPORTING_QUARTER,
} from '@awc-ui/showcase-kit/data';
import { monthlyEadSeries, quarterlySeries, route } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { areaChart, barChart } from '../lib/charts.mjs';
import { kpiTile } from '../lib/bits.mjs';
import { drill, panel, screen } from '../components/shell.mjs';
import { counterpartyTable } from '../components/tables.mjs';

export function overviewScreen(t, locale) {
  const totals = getPortfolioTotals();
  const sectors = getSectors();
  const scale = getRatingScale();
  const quarters = quarterlySeries();
  const months = monthlyEadSeries();
  const quarterLabels = quarters.map((q) => q.quarter);

  /** EAD by rating grade — the concentration a credit committee reads first. */
  const counterparties = getCounterparties();
  const byGrade = scale.map((grade) =>
    counterparties.filter((cp) => cp.grade === grade.grade).reduce((sum, cp) => sum + cp.ead, 0),
  );

  const aside = html`${html`<md-chip${attrs({
      variant: 'assist',
      appearance: 'outlined',
      icon: 'account_balance',
      label: t('common.of', { count: totals.counterpartyCount, total: totals.facilityCount }),
      title: `${t('kpi.counterparties')} / ${t('kpi.facilities')}`,
    })}></md-chip>`}
    <!-- The badge is a SIBLING of the button, not slotted into it. md-badge
         anchors absolutely and translates itself past its host corner;
         md-button sets overflow: hidden with no accommodation for that, so a
         slotted badge is sliced in half. With the badge outside, the button no
         longer contains the count, so it needs an explicit accessible name
         that does. -->
    <span class="badge-anchor">
      <md-button${attrs({
        variant: 'tonal',
        size: 'sm',
        icon: 'warning',
        href: localeHref(locale, route.watchlist()),
        'aria-label': `${t('kpi.watchlist')}, ${totals.watchlistCount}`,
      })}>${t('kpi.watchlist')}</md-button>
      <md-badge${attrs({ value: String(totals.watchlistCount) })}></md-badge>
    </span>`;

  const children = html`<section class="kpi-grid">
      ${kpiTile(t, {
        label: t('kpi.ead'),
        value: t.formatCurrency(totals.ead, { notation: 'compact' }),
        hint: t('kpi.ead.help'),
        trend: months.map((m) => m.ead),
        trendLabels: months.map((m) => t.formatDate(m.date, 'monthYear')),
        color: 'primary',
      })}
      ${kpiTile(t, {
        label: t('kpi.expectedLoss'),
        value: t.formatCurrency(totals.expectedLoss, { notation: 'compact' }),
        hint: `${t('kpi.expectedLossRatio')} ${t.formatPercent(totals.expectedLossRatio, { maximumFractionDigits: 2 })}`,
        trend: quarters.map((q) => q.expectedLoss),
        trendLabels: quarterLabels,
        color: 'error',
      })}
      ${kpiTile(t, {
        label: t('kpi.rwa'),
        value: t.formatCurrency(totals.rwa, { notation: 'compact' }),
        hint: `${t('kpi.rwaDensity')} ${t.formatPercent(totals.rwaDensity, { maximumFractionDigits: 1 })}`,
        trend: quarters.map((q) => q.rwa),
        trendLabels: quarterLabels,
        color: 'tertiary',
      })}
      ${kpiTile(t, {
        label: t('kpi.weightedAvgPd'),
        value: t.formatPercent(totals.weightedAvgPd, { maximumFractionDigits: 2 }),
        hint: `${t('kpi.weightedAvgLgd')} ${t.formatPercent(totals.weightedAvgLgd, { maximumFractionDigits: 1 })}`,
        trend: quarters.map((q) => q.weightedAvgPd),
        trendLabels: quarterLabels,
        trendFormat: 'percent',
        color: 'warning',
      })}
    </section>

    <!-- The chart components render their own label/subtitle header, which is
         also their accessible name — so these panels deliberately carry no
         title of their own. Two headings saying the same thing is worse than
         one, and dropping the chart's would cost the a11y name. -->
    <section class="grid-2">
      ${panel({
        children: barChart({
          series: [{ label: t('kpi.ead'), data: sectors.map((s) => s.ead) }],
          config: { xAxis: { data: sectors.map((s) => t(s.nameKey)) }, yAxis: { label: t('kpi.ead') }, format: 'currency' },
          attributes: {
            // The drill targets, in plot order and already carrying this
            // page's locale segment, so the click handler navigates without
            // re-deriving either the bar order or the language.
            'data-drill': sectors.map((s) => localeHref(locale, route.sector(s.id))).join(' '),
            layout: 'horizontal',
            legend: 'none',
            // `clickable` without `chevron`: the chevron end cap was signalling
            // that the bars drill, but it turns each bar into an arrowhead.
            // Rounded caps read better, and the pointer cursor plus the hover
            // state still say the bar is a control.
            clickable: true,
            'corner-radius': '8',
            'axis-ticks': true,
            height: '320px',
            label: t('kpi.ead'),
            subtitle: t('table.sector'),
          },
        }),
      })}
      ${panel({
        children: barChart({
          series: [{ label: t('kpi.ead'), data: byGrade }],
          config: { xAxis: { data: scale.map((g) => t(`rating.${g.label}`)) }, yAxis: { label: t('kpi.ead') }, format: 'currency' },
          attributes: {
            legend: 'none',
            'axis-ticks': true,
            height: '320px',
            label: t('screen.ratings.title'),
            subtitle: t('screen.ratings.subtitle'),
          },
        }),
      })}
    </section>

    ${panel({
      children: areaChart({
        series: [
          { label: t('ratingBand.investment'), data: quarters.map((q) => q.byBand.investment) },
          { label: t('ratingBand.speculative'), data: quarters.map((q) => q.byBand.speculative) },
          { label: t('ratingBand.default'), data: quarters.map((q) => q.byBand.default) },
        ],
        config: {
          xAxis: { data: quarterLabels, scale: 'category' },
          yAxis: { label: t('kpi.ead'), min: 0 },
          format: 'currency',
        },
        attributes: {
          stack: 'normal',
          curve: 'monotone',
          legend: 'top-end',
          'axis-ticks': true,
          height: '300px',
          label: `${t('kpi.ead')} · ${t('table.band')}`,
          subtitle: t('rating.historyHint', { quarter: REPORTING_QUARTER }),
          summary: t('chart.summary.area', { label: `${t('kpi.ead')} · ${t('table.band')}`, count: 3 }),
        },
      }),
    })}

    ${panel({
      title: t('screen.counterparties.title'),
      actions: drill(locale, route.watchlist(), t('nav.watchlist')),
      children: counterpartyTable(t, { locale }),
    })}`;

  return screen(t, {
    locale,
    here: route.overview(),
    title: t('screen.overview.title'),
    subtitle: t('screen.overview.subtitle', { date: t.formatDate(REPORTING_DATE, 'long') }),
    aside,
    children,
  });
}
