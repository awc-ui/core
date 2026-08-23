/**
 * Screen 2 — sector detail. One rung down the drill path.
 *
 * The concentration meter compares this sector's share of portfolio EAD against
 * a 20% single-sector guideline, which is why it is drawn on a 0–20% scale
 * rather than 0–100%: on a 0–100% scale every sector looks safe and the meter
 * says nothing. Beside it, utilisation of the committed limit on its own 0–100%
 * scale. Both take their colour from the same thresholds the counterparty table
 * uses.
 */

import { getSectorById, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
import { quarterlySeries, route, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { lineChart } from '../lib/charts.mjs';
import { fact, ratioMeter } from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';
import { counterpartyTable } from '../components/tables.mjs';

/** House single-sector concentration guideline, as a share of portfolio EAD. */
const CONCENTRATION_CAP = 0.2;

export function sectorScreen(t, locale, sectorId) {
  const sector = getSectorById(sectorId);
  if (!sector) throw new Error(`[credit-risk] unknown sector: ${sectorId}`);

  const quarters = quarterlySeries(sector.id);
  const quarterLabels = quarters.map((q) => q.quarter);
  const share = sector.portfolioShare;

  const aside = html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'filled',
    color: share > CONCENTRATION_CAP ? 'error' : 'secondary',
    icon: 'donut_large',
    label: `${t('table.share')} ${t.formatPercent(share, { maximumFractionDigits: 1 })}`,
  })}></md-chip>`;

  const children = html`<section class="grid-2">
      ${panel({
        title: t('table.share'),
        subtitle: t('kpi.ead'),
        children: html`${ratioMeter(t, {
            label: t('table.share'),
            fraction: share,
            max: CONCENTRATION_CAP,
            color: share > CONCENTRATION_CAP ? 'error' : 'primary',
          })}
          ${ratioMeter(t, {
            label: t('kpi.utilisation'),
            fraction: sector.utilisation,
            color: utilisationColor(sector.utilisation),
          })}
          <dl class="dl dl--numeric">
            ${fact(t('kpi.ead'), t.formatCurrency(sector.ead, { notation: 'compact' }))}
            ${fact(t('kpi.limit'), t.formatCurrency(sector.limit, { notation: 'compact' }))}
            ${fact(t('kpi.drawn'), t.formatCurrency(sector.drawn, { notation: 'compact' }))}
            ${fact(t('kpi.undrawn'), t.formatCurrency(sector.undrawn, { notation: 'compact' }))}
            ${fact(t('kpi.expectedLoss'), t.formatCurrency(sector.expectedLoss, { notation: 'compact' }))}
            ${fact(t('kpi.rwa'), t.formatCurrency(sector.rwa, { notation: 'compact' }))}
            ${fact(t('kpi.weightedAvgPd'), t.formatPercent(sector.weightedAvgPd, { maximumFractionDigits: 2 }))}
            ${fact(t('kpi.weightedAvgLgd'), t.formatPercent(sector.weightedAvgLgd, { maximumFractionDigits: 1 }))}
            ${fact(t('kpi.facilities'), t.formatNumber(sector.facilityCount))}
          </dl>`,
      })}

      <!-- No panel title: the chart carries its own header, which is also its
           accessible name.

           TWO SCALES, NOT ONE. Expected loss runs in single-digit millions
           while RWA runs in hundreds of millions, so on a shared axis the EL
           line flattens onto the baseline and reads as zero. Each series gets
           its own axis (yAxes + series[].yAxisIndex) — EL on the left, RWA on
           the right — so both curves are legible at their own scale. A broken
           axis would have been the other option, but it distorts slope, and
           slope is the whole point of a trend chart. -->
      ${panel({
        children: lineChart({
          series: [
            { label: t('kpi.expectedLoss'), data: quarters.map((q) => q.expectedLoss) },
            { label: t('kpi.rwa'), data: quarters.map((q) => q.rwa), yAxisIndex: 1 },
          ],
          config: {
            xAxis: { data: quarterLabels, scale: 'category' },
            yAxes: [
              { label: t('kpi.expectedLoss'), min: 0 },
              { label: t('kpi.rwa'), min: 0, position: 'right' },
            ],
            format: 'currency',
          },
          attributes: {
            curve: 'monotone',
            'show-marks': true,
            grid: 'horizontal',
            'axis-ticks': true,
            legend: 'top-end',
            height: '340px',
            label: `${t('kpi.expectedLoss')} · ${t('kpi.rwa')}`,
            subtitle: t('rating.historyHint', { quarter: REPORTING_QUARTER }),
            summary: t('chart.summary.line', {
              label: `${t('kpi.expectedLoss')} · ${t('kpi.rwa')}`,
              count: 2,
            }),
          },
        }),
      })}
    </section>

    ${panel({
      title: t('screen.counterparties.title'),
      subtitle: t('screen.counterparties.subtitle', { count: sector.counterpartyCount }),
      children: counterpartyTable(t, { locale, sectorId: sector.id, showSector: false }),
    })}`;

  return screen(t, {
    locale,
    here: route.sector(sector.id),
    title: t(sector.nameKey),
    subtitle: t('screen.counterparties.subtitle', { count: sector.counterpartyCount }),
    crumbs: [
      { label: t('nav.overview'), href: route.overview() },
      { label: t(sector.nameKey) },
    ],
    aside,
    children,
  });
}
