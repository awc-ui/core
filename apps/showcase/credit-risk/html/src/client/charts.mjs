/**
 * Hand every chart on the page the configuration it could not get from markup.
 *
 * Stencil's lazy proxy keeps own properties set before an element upgrades, so
 * this does not have to wait for the runtime — assigning early is not a race,
 * it is the supported path.
 *
 * The formatters are rebuilt here rather than shipped as strings because they
 * are `Intl` objects bound to the page's locale, which is on `<html lang>`
 * where the build put it.
 */

import { createTranslator } from '@awc-ui/showcase-kit/i18n';

function formatterFor(locale, kind) {
  const t = createTranslator(locale);
  if (kind === 'percent') return (v) => t.formatPercent(v ?? 0, { maximumFractionDigits: 2 });
  if (kind === 'number') return (v) => t.formatNumber(v ?? 0, { maximumFractionDigits: 1 });
  return (v) => t.formatCurrency(v ?? 0, { notation: 'compact' });
}

export function configureCharts(root = document) {
  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const t = createTranslator(locale);

  /*
   * A chart's plot is a focusable `role="application"` region named by
   * `label-plot`, whose default is an English sentence — so without this every
   * chart on the Romanian and Arabic pages names that region in English. Set
   * here for every chart rather than at each call site, so a chart cannot be
   * added without it.
   *
   * This one IS safe to apply after paint: it renames a region, it does not
   * change what is drawn.
   */
  for (const chart of root.querySelectorAll('md-bar-chart,md-line-chart,md-area-chart')) {
    if (!chart.hasAttribute('label-plot')) chart.setAttribute('label-plot', t.t('chart.plotHint'));
  }

  for (const el of root.querySelectorAll('[data-chart]')) {
    if (el.hasAttribute('data-chart-applied')) continue;

    let config;
    try {
      config = JSON.parse(el.dataset.chart || '{}');
    } catch {
      // A malformed payload is a build-time mistake, not a runtime condition.
      // Leaving the chart with index labels is a better failure than throwing
      // and taking every later chart on the page down with it.
      console.error('[credit-risk] unreadable data-chart on', el.tagName.toLowerCase());
      continue;
    }
    el.setAttribute('data-chart-applied', '');

    const value = formatterFor(locale, config.format ?? 'currency');

    if (config.xAxis) el.xAxis = config.xAxis;
    if (config.yAxis) el.yAxis = config.yAxis;
    if (config.yAxes) {
      // Each axis carries its own formatter, so a chart plotting expected loss
      // against RWA labels both gutters correctly rather than formatting the
      // right-hand one with the left-hand one's rules.
      el.yAxes = config.yAxes.map((axis, i) => ({
        ...axis,
        valueFormatter: formatterFor(locale, config.axisFormats?.[i] ?? config.format ?? 'currency'),
      }));
    }
    el.valueFormatter = value;
  }
}
