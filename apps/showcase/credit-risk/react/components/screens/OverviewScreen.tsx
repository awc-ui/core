'use client';

/**
 * Screen 1 — portfolio overview, and the head of the drill path.
 *
 * Four KPI tiles, each with its own eight-quarter sparkline; exposure by sector;
 * the rating distribution; the exposure trend split by rating band; and the ten
 * largest exposures. Both the sector bars and the table rows are doors: sector
 * bars drill on click, counterparty names are anchors.
 *
 * Every trend on this screen is computed in `lib/derive.ts` from the fixture's
 * rating history, calibrated so the last point equals the KPI above it.
 */

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCounterparties,
  getPortfolioTotals,
  getRatingScale,
  getSectors,
  REPORTING_DATE,
  REPORTING_QUARTER,
} from '@awc-ui/showcase-kit/data';
import { useShowcase, useT } from '@/lib/showcase';
import { monthlyEadSeries, quarterlySeries } from '@/lib/derive';
import { route, withBase } from '@/lib/routes';
import { AreaChart, BarChart, useCustomEvent } from '../elements';
import { Drill, Panel, Screen } from '../Shell';
import { KpiTile } from '../bits';
import { CounterpartyTable } from '../CounterpartyTable';

export function OverviewScreen() {
  const t = useT();
  const { state } = useShowcase();
  const router = useRouter();

  const totals = getPortfolioTotals();
  const sectors = getSectors();
  const scale = getRatingScale();
  const quarters = quarterlySeries();
  const months = monthlyEadSeries();

  const sectorChartRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ dataIndex: number }>>(sectorChartRef, 'mdBarClick', (event) => {
    const sector = sectors[event.detail?.dataIndex ?? -1];
    if (sector) router.push(route.sector(sector.id));
  });

  const money = useMemo(() => (v: number | null) => t.formatCurrency(v ?? 0, { notation: 'compact' }), [t]);
  const percent = useMemo(() => (v: number | null) => t.formatPercent(v ?? 0, { maximumFractionDigits: 2 }), [t]);

  /** EAD by rating grade — the concentration a credit committee reads first. */
  const byGrade = useMemo(() => {
    const counterparties = getCounterparties();
    return scale.map((grade) =>
      counterparties.filter((cp) => cp.grade === grade.grade).reduce((sum, cp) => sum + cp.ead, 0),
    );
  }, [scale]);

  const quarterLabels = quarters.map((q) => q.quarter);

  return (
    <Screen
      title={t('screen.overview.title')}
      subtitle={t('screen.overview.subtitle', { date: t.formatDate(REPORTING_DATE, 'long') })}
      aside={
        <>
          <md-chip
            variant="assist"
            appearance="outlined"
            icon="account_balance"
            label={t('common.of', { count: totals.counterpartyCount, total: totals.facilityCount })}
            title={`${t('kpi.counterparties')} / ${t('kpi.facilities')}`}
          />
          <md-button variant="tonal" size="sm" icon="warning" href={withBase(route.watchlist())}>
            {t('kpi.watchlist')}
            <md-badge slot="trailing-icon" variant="large" value={String(totals.watchlistCount)} />
          </md-button>
        </>
      }
    >
      <section className="kpi-grid">
        <KpiTile
          label={t('kpi.ead')}
          value={t.formatCurrency(totals.ead, { notation: 'compact' })}
          hint={t('kpi.ead.help')}
          trend={months.map((m) => m.ead)}
          trendLabels={months.map((m) => t.formatDate(m.date, 'monthYear'))}
          formatTrend={money}
          color="primary"
        />
        <KpiTile
          label={t('kpi.expectedLoss')}
          value={t.formatCurrency(totals.expectedLoss, { notation: 'compact' })}
          hint={`${t('kpi.expectedLossRatio')} ${t.formatPercent(totals.expectedLossRatio, { maximumFractionDigits: 2 })}`}
          trend={quarters.map((q) => q.expectedLoss)}
          trendLabels={quarterLabels}
          formatTrend={money}
          color="error"
        />
        <KpiTile
          label={t('kpi.rwa')}
          value={t.formatCurrency(totals.rwa, { notation: 'compact' })}
          hint={`${t('kpi.rwaDensity')} ${t.formatPercent(totals.rwaDensity, { maximumFractionDigits: 1 })}`}
          trend={quarters.map((q) => q.rwa)}
          trendLabels={quarterLabels}
          formatTrend={money}
          color="tertiary"
        />
        <KpiTile
          label={t('kpi.weightedAvgPd')}
          value={t.formatPercent(totals.weightedAvgPd, { maximumFractionDigits: 2 })}
          hint={`${t('kpi.weightedAvgLgd')} ${t.formatPercent(totals.weightedAvgLgd, { maximumFractionDigits: 1 })}`}
          trend={quarters.map((q) => q.weightedAvgPd)}
          trendLabels={quarterLabels}
          formatTrend={percent}
          color="warning"
        />
      </section>

      {/* The chart components render their own `label`/`subtitle` header, which
          is also their accessible name — so these panels deliberately carry no
          title of their own. Two headings saying the same thing is worse than
          one, and dropping the chart's would cost the a11y name. */}
      <section className="grid-2">
        <Panel>
          <BarChart
            elementRef={sectorChartRef}
            series={[{ label: t('kpi.ead'), data: sectors.map((s) => s.ead) }]}
            xAxis={{ data: sectors.map((s) => t(s.nameKey)) }}
            yAxis={{ label: t('kpi.ead') }}
            valueFormatter={money}
            locale={state.locale}
            layout="horizontal"
            legend="none"
            clickable
            chevron
            axis-ticks
            height="320px"
            label={t('kpi.ead')}
            subtitle={t('table.sector')}
          />
        </Panel>

        <Panel>
          <BarChart
            series={[{ label: t('kpi.ead'), data: byGrade }]}
            xAxis={{ data: scale.map((g) => t(`rating.${g.label}`)) }}
            yAxis={{ label: t('kpi.ead') }}
            valueFormatter={money}
            locale={state.locale}
            legend="none"
            axis-ticks
            height="320px"
            label={t('screen.ratings.title')}
            subtitle={t('screen.ratings.subtitle')}
          />
        </Panel>
      </section>

      <Panel>
        <AreaChart
          series={[
            { label: t('ratingBand.investment'), data: quarters.map((q) => q.byBand.investment) },
            { label: t('ratingBand.speculative'), data: quarters.map((q) => q.byBand.speculative) },
            { label: t('ratingBand.default'), data: quarters.map((q) => q.byBand.default) },
          ]}
          xAxis={{ data: quarterLabels, scale: 'category' }}
          yAxis={{ label: t('kpi.ead'), min: 0 }}
          valueFormatter={money}
          locale={state.locale}
          stack="normal"
          curve="monotone"
          legend="top-end"
          axis-ticks
          height="300px"
          label={`${t('kpi.ead')} · ${t('table.band')}`}
          subtitle={t('rating.historyHint', { quarter: REPORTING_QUARTER })}
        />
      </Panel>

      <Panel
        title={t('screen.counterparties.title')}
        subtitle={t('common.showing', { shown: 10, total: totals.counterpartyCount })}
        actions={<Drill href={route.watchlist()}>{t('nav.watchlist')}</Drill>}
      >
        <CounterpartyTable limit={10} />
      </Panel>
    </Screen>
  );
}
