/**
 * Screen 6 — stress testing.
 *
 * Three scenarios, EAD invariant across all of them, EL and RWA strictly
 * monotone. The comparison charts therefore always plot all three side by side
 * rather than only the selected one: the point of the screen is the SHAPE of
 * the deterioration, and a single-scenario chart hides it.
 *
 * ONE SCENARIO IS LIVE, exactly like the React build — the same two panels, in
 * the same two places. The other two scenarios ride along in `<template>`
 * elements, whose contents the parser keeps out of the document tree, and the
 * client script swaps a panel by cloning one in. So the live page holds the
 * same cards, tables and rows React's does, while the figures for all three
 * scenarios are still in the file.
 *
 * An earlier version rendered all three sections and hid two with the `hidden`
 * attribute. That was both a divergence from the other builds and, on this one,
 * simply broken: the sections also carried `class="stack"`, whose
 * `display: flex` overrides the `[hidden]` user-agent rule, so all three were
 * visible at once. Swapping the panel avoids the whole class of problem.
 *
 * Baseline's `expectedLossDelta` is exactly zero by construction — its EL equals
 * the portfolio EL — so the delta column reads `n/a` there rather than a
 * formatted `+0`, which would look like a rounded-away number.
 */

import { getSectors, getStressScenarios } from '@awc-ui/showcase-kit/data';
import { route, TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html, style } from '../lib/html.mjs';
import { barChart } from '../lib/charts.mjs';
import { fact } from '../lib/bits.mjs';
import { drill, panel, screen } from '../components/shell.mjs';

/** The scenario shown before anything is clicked, and with JavaScript off. */
const INITIAL_SCENARIO = 'adverse';

export function stressScreen(t, locale) {
  const scenarios = getStressScenarios();
  const sectors = getSectors();
  const sectorLabels = sectors.map((s) => t(s.nameKey));

  const describe = (scenario) =>
    t(scenario.descriptionKey, {
      pd: t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 }),
      lgd: t.formatPercent(scenario.lgdUplift, { maximumFractionDigits: 0 }),
    });

  const aside = html`<md-segmented-button-set data-scenario-selector${attrs({ 'aria-label': t('table.scenario') })}>
    ${scenarios.map(
      (s) => html`<md-segmented-button${attrs({
        value: s.id,
        label: t(s.nameKey),
        selected: s.id === INITIAL_SCENARIO || undefined,
      })}></md-segmented-button>`,
    )}
  </md-segmented-button-set>`;

  const facts = (scenario) => html`<dl class="dl dl--numeric">
    ${fact(t('table.pdMultiplier'), t('unit.times', { value: t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 }) }))}
    ${fact(t('table.lgdUplift'), t.formatPercent(scenario.lgdUplift, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }))}
    ${fact(t('kpi.ead'), t.formatCurrency(scenario.totals.ead, { notation: 'compact' }))}
    ${fact(t('kpi.expectedLoss'), t.formatCurrency(scenario.totals.expectedLoss, { notation: 'compact' }))}
    ${fact(
      t('table.elDelta'),
      scenario.totals.expectedLossDelta === 0
        ? t('common.na')
        : t.formatCurrency(scenario.totals.expectedLossDelta, { notation: 'compact' }),
    )}
    ${fact(t('kpi.rwa'), t.formatCurrency(scenario.totals.rwa, { notation: 'compact' }))}
    ${fact(
      t('table.rwaDelta'),
      scenario.totals.rwaDelta === 0
        ? t('common.na')
        : t.formatCurrency(scenario.totals.rwaDelta, { notation: 'compact' }),
    )}
    ${fact(t('kpi.weightedAvgPd'), t.formatPercent(scenario.totals.weightedAvgPd, { maximumFractionDigits: 2 }))}
    ${fact(t('kpi.rwaDensity'), t.formatPercent(scenario.totals.rwaDensity, { maximumFractionDigits: 1 }))}
  </dl>`;

  const sectorTable = (scenario) => html`<md-table-container variant="outlined">
    <md-table${attrs({
      label: t('screen.stress.title'),
      'column-template': TABLES.stress.columns,
      'min-width': TABLES.stress.minWidth,
      striped: true,
    })}>
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell head scope="col">${t('table.sector')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.ead')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.pd')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.lgd')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.expectedLoss')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.elDelta')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.rwa')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.rwaDelta')}</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${scenario.bySector.map(
          (row) => html`<md-table-row${attrs({ value: row.sectorId })}>
            <md-table-cell>${drill(locale, route.sector(row.sectorId), t(`sector.${row.sectorId}`))}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.ead, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatPercent(row.weightedAvgPd, { maximumFractionDigits: 2 })}</md-table-cell>
            <md-table-cell numeric>${t.formatPercent(row.weightedAvgLgd, { maximumFractionDigits: 1 })}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.expectedLoss, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              <span${attrs({ style: style({ color: row.expectedLossDelta > 0 ? 'var(--md-sys-color-error)' : undefined }) })}>${
                row.expectedLossDelta === 0
                  ? t('common.na')
                  : t.formatCurrency(row.expectedLossDelta, { notation: 'compact' })
              }</span>
            </md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.rwa, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              <span${attrs({ style: style({ color: row.rwaDelta > 0 ? 'var(--md-sys-color-warning)' : undefined }) })}>${
                row.rwaDelta === 0 ? t('common.na') : t.formatCurrency(row.rwaDelta, { notation: 'compact' })
              }</span>
            </md-table-cell>
          </md-table-row>`,
        )}
      </md-table-body>
    </md-table>
  </md-table-container>`;

  const comparison = (metric, label) =>
    barChart({
      series: scenarios.map((s) => ({
        id: s.id,
        label: t(s.nameKey),
        data: s.bySector.map((row) => row[metric]),
      })),
      config: { xAxis: { data: sectorLabels }, yAxis: { label, min: 0 }, format: 'currency' },
      attributes: {
        legend: 'top-end',
        'axis-ticks': true,
        height: '340px',
        label,
        subtitle: t('scenario.compare'),
      },
    });

  /** The two panels that change with the scenario, marked so the client can swap them. */
  const factsPanel = (scenario, live) =>
    panel({
      title: t(scenario.nameKey),
      subtitle: describe(scenario),
      attributes: live ? { 'data-stress-facts': true } : {},
      children: facts(scenario),
    });

  const tablePanel = (scenario, live) =>
    panel({
      title: t('table.sector'),
      subtitle: `${t(scenario.nameKey)} · ${t('scenario.vsBaseline')}`,
      attributes: live ? { 'data-stress-table': true } : {},
      children: sectorTable(scenario),
    });

  const initial = scenarios.find((s) => s.id === INITIAL_SCENARIO) ?? scenarios[0];

  const children = html`    ${factsPanel(initial, true)}

    <!-- Both charts carry their own header; the panels stay untitled so the
         heading is not printed twice. They plot all three scenarios whatever is
         selected: the point of the screen is the SHAPE of the deterioration,
         and a single-scenario chart hides it. -->
    <section class="grid-2">
      ${panel({ children: comparison('expectedLoss', t('kpi.expectedLoss')) })}
      ${panel({ children: comparison('rwa', t('kpi.rwa')) })}
    </section>

    ${tablePanel(initial, true)}

    <!-- Every scenario's two panels, parked where the document tree cannot see
         them. A template's content is inert, so these add no cards, no tables
         and no rows to the page — the live DOM matches the React build exactly.
         The initial scenario is here too, so switching away and back is the
         same operation in both directions. -->
    ${scenarios.map(
      (scenario) => html`<template${attrs({ 'data-scenario': scenario.id, 'data-slot': 'facts' })}>${factsPanel(scenario, false)}</template>
      <template${attrs({ 'data-scenario': scenario.id, 'data-slot': 'table' })}>${tablePanel(scenario, false)}</template>`,
    )}`;

  return screen(t, {
    locale,
    here: route.stress(),
    title: t('screen.stress.title'),
    subtitle: t('screen.stress.subtitle'),
    aside,
    children,
  });
}
