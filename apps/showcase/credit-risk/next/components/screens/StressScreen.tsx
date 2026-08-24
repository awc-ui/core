'use client';

/**
 * Screen 6 — stress testing.
 *
 * Three scenarios, EAD invariant across all of them, EL and RWA strictly
 * monotone. The comparison charts therefore always plot all three side by side
 * rather than only the selected one: the point of the screen is the SHAPE of the
 * deterioration, and a single-scenario chart hides it. The segmented selector
 * drives the per-sector table and the highlighted deltas underneath.
 *
 * Baseline's `expectedLossDelta` is exactly zero by construction — its EL equals
 * the portfolio EL — so the delta column reads `n/a` there rather than a
 * formatted `+0`, which would look like a rounded-away number.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getSectors,
  getStressScenarioById,
  getStressScenarios,
  type ScenarioId,
} from '@awc-ui/showcase-kit/data';
import { useShowcase, useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { BarChart, useCustomEvent } from '../elements';
import { Drill, Panel, Screen } from '../Shell';
import { Fact } from '../bits';

export function StressScreen() {
  const t = useT();
  const { state } = useShowcase();
  const scenarios = getStressScenarios();
  const sectors = getSectors();

  const [scenarioId, setScenarioId] = useState<ScenarioId>('adverse');
  const selectorRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<string[]>>(selectorRef, 'mdChange', (event) => {
    const [value] = event.detail ?? [];
    if (value) setScenarioId(value as ScenarioId);
  });

  const scenario = getStressScenarioById(scenarioId) ?? scenarios[0];
  const money = useMemo(() => (v: number | null) => t.formatCurrency(v ?? 0, { notation: 'compact' }), [t]);

  const describe = (id: ScenarioId) => {
    const s = getStressScenarioById(id);
    if (!s) return '';
    return t(s.descriptionKey, {
      pd: t.formatNumber(s.pdMultiplier, { maximumFractionDigits: 2 }),
      lgd: t.formatPercent(s.lgdUplift, { maximumFractionDigits: 0 }),
    });
  };

  const sectorLabels = sectors.map((s) => t(s.nameKey));

  return (
    <Screen
      title={t('screen.stress.title')}
      subtitle={t('screen.stress.subtitle')}
      aside={
        <md-segmented-button-set ref={selectorRef} aria-label={t('table.scenario')}>
          {scenarios.map((s) => (
            <md-segmented-button
              key={s.id}
              value={s.id}
              label={t(s.nameKey)}
              selected={s.id === 'adverse' || undefined}
            />
          ))}
        </md-segmented-button-set>
      }
    >
      <Panel title={t(scenario.nameKey)} subtitle={describe(scenario.id)}>
        <dl className="dl dl--numeric">
          <Fact label={t('table.pdMultiplier')}>
            {t('unit.times', { value: t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 }) })}
          </Fact>
          <Fact label={t('table.lgdUplift')}>
            {t.formatPercent(scenario.lgdUplift, { maximumFractionDigits: 0, signDisplay: 'exceptZero' })}
          </Fact>
          <Fact label={t('kpi.ead')}>{t.formatCurrency(scenario.totals.ead, { notation: 'compact' })}</Fact>
          <Fact label={t('kpi.expectedLoss')}>
            {t.formatCurrency(scenario.totals.expectedLoss, { notation: 'compact' })}
          </Fact>
          <Fact label={t('table.elDelta')}>
            {scenario.totals.expectedLossDelta === 0
              ? t('common.na')
              : t.formatCurrency(scenario.totals.expectedLossDelta, {
                  notation: 'compact',
                })}
          </Fact>
          <Fact label={t('kpi.rwa')}>{t.formatCurrency(scenario.totals.rwa, { notation: 'compact' })}</Fact>
          <Fact label={t('table.rwaDelta')}>
            {scenario.totals.rwaDelta === 0
              ? t('common.na')
              : t.formatCurrency(scenario.totals.rwaDelta, { notation: 'compact' })}
          </Fact>
          <Fact label={t('kpi.weightedAvgPd')}>
            {t.formatPercent(scenario.totals.weightedAvgPd, { maximumFractionDigits: 2 })}
          </Fact>
          <Fact label={t('kpi.rwaDensity')}>
            {t.formatPercent(scenario.totals.rwaDensity, { maximumFractionDigits: 1 })}
          </Fact>
        </dl>
      </Panel>

      {/* Both charts carry their own header; the panels stay untitled so the
          heading is not printed twice. */}
      <section className="grid-2">
        <Panel>
          <BarChart
            series={scenarios.map((s) => ({
              id: s.id,
              label: t(s.nameKey),
              data: s.bySector.map((row) => row.expectedLoss),
            }))}
            xAxis={{ data: sectorLabels }}
            yAxis={{ label: t('kpi.expectedLoss'), min: 0 }}
            valueFormatter={money}
            locale={state.locale}
            legend="top-end"
            axis-ticks
            height="340px"
            label={t('kpi.expectedLoss')}
            subtitle={t('scenario.compare')}
          />
        </Panel>

        <Panel>
          <BarChart
            series={scenarios.map((s) => ({
              id: s.id,
              label: t(s.nameKey),
              data: s.bySector.map((row) => row.rwa),
            }))}
            xAxis={{ data: sectorLabels }}
            yAxis={{ label: t('kpi.rwa'), min: 0 }}
            valueFormatter={money}
            locale={state.locale}
            legend="top-end"
            axis-ticks
            height="340px"
            label={t('kpi.rwa')}
            subtitle={t('scenario.compare')}
          />
        </Panel>
      </section>

      <Panel title={t('table.sector')} subtitle={`${t(scenario.nameKey)} · ${t('scenario.vsBaseline')}`}>
        <md-table-container variant="outlined">
          <md-table
            label={t('screen.stress.title')}
            column-template={TABLES.stress.columns}
            min-width={TABLES.stress.minWidth}
            striped
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell head scope="col">
                  {t('table.sector')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.ead')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.pd')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.lgd')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.expectedLoss')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.elDelta')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.rwa')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.rwaDelta')}
                </md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              {scenario.bySector.map((row) => (
                <md-table-row key={row.sectorId} value={row.sectorId}>
                  <md-table-cell>
                    <Drill href={route.sector(row.sectorId)}>{t(`sector.${row.sectorId}`)}</Drill>
                  </md-table-cell>
                  <md-table-cell numeric>{t.formatCurrency(row.ead, { notation: 'compact' })}</md-table-cell>
                  <md-table-cell numeric>
                    {t.formatPercent(row.weightedAvgPd, { maximumFractionDigits: 2 })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {t.formatPercent(row.weightedAvgLgd, { maximumFractionDigits: 1 })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {t.formatCurrency(row.expectedLoss, { notation: 'compact' })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    <span
                      style={{ color: row.expectedLossDelta > 0 ? 'var(--md-sys-color-error)' : undefined }}
                    >
                      {row.expectedLossDelta === 0
                        ? t('common.na')
                        : t.formatCurrency(row.expectedLossDelta, { notation: 'compact' })}
                    </span>
                  </md-table-cell>
                  <md-table-cell numeric>{t.formatCurrency(row.rwa, { notation: 'compact' })}</md-table-cell>
                  <md-table-cell numeric>
                    <span style={{ color: row.rwaDelta > 0 ? 'var(--md-sys-color-warning)' : undefined }}>
                      {row.rwaDelta === 0
                        ? t('common.na')
                        : t.formatCurrency(row.rwaDelta, { notation: 'compact' })}
                    </span>
                  </md-table-cell>
                </md-table-row>
              ))}
            </md-table-body>
          </md-table>
        </md-table-container>
      </Panel>
    </Screen>
  );
}
