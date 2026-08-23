'use client';

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

import { useMemo } from 'react';
import { getSectorById, REPORTING_QUARTER, type Sector } from '@awc-ui/showcase-kit/data';
import { useShowcase, useT } from '@/lib/showcase';
import { quarterlySeries, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { route } from '@/lib/routes';
import { LineChart } from '../elements';
import { Panel, Screen } from '../Shell';
import { Fact, RatioMeter } from '../bits';
import { CounterpartyTable } from '../CounterpartyTable';

/** House single-sector concentration guideline, as a share of portfolio EAD. */
const CONCENTRATION_CAP = 0.2;

export function SectorScreen({ sectorId }: { sectorId: string }) {
  const t = useT();
  const { state } = useShowcase();
  const sector = getSectorById(sectorId) as Sector | undefined;
  const quarters = quarterlySeries(sectorId as Sector['id']);

  const money = useMemo(() => (v: number | null) => t.formatCurrency(v ?? 0, { notation: 'compact' }), [t]);

  if (!sector) {
    // generateStaticParams only emits the seven real ids, so this is a guard
    // against a hand-typed URL, not a state the export can reach.
    return (
      <Screen title={t('empty.generic')} subtitle={t('empty.hint')}>
        <Panel>
          <p className="muted">{t('empty.generic')}</p>
        </Panel>
      </Screen>
    );
  }

  const share = sector.portfolioShare;
  const quarterLabels = quarters.map((q) => q.quarter);

  return (
    <Screen
      title={t(sector.nameKey)}
      subtitle={t('screen.counterparties.subtitle', { count: sector.counterpartyCount })}
      crumbs={[
        { label: t('nav.overview'), href: route.overview() },
        { label: t(sector.nameKey) },
      ]}
      aside={
        <md-chip
          variant="assist"
          appearance="filled"
          color={share > CONCENTRATION_CAP ? 'error' : 'secondary'}
          icon="donut_large"
          label={`${t('table.share')} ${t.formatPercent(share, { maximumFractionDigits: 1 })}`}
        />
      }
    >
      <section className="grid-2">
        <Panel title={t('table.share')} subtitle={t('kpi.ead')}>
          <RatioMeter
            label={t('table.share')}
            fraction={share}
            max={CONCENTRATION_CAP}
            color={share > CONCENTRATION_CAP ? 'error' : 'primary'}
          />
          <RatioMeter
            label={t('kpi.utilisation')}
            fraction={sector.utilisation}
            color={utilisationColor(sector.utilisation)}
          />
          <dl className="dl dl--numeric">
            <Fact label={t('kpi.ead')}>{t.formatCurrency(sector.ead, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.limit')}>{t.formatCurrency(sector.limit, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.drawn')}>{t.formatCurrency(sector.drawn, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.undrawn')}>{t.formatCurrency(sector.undrawn, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.expectedLoss')}>
              {t.formatCurrency(sector.expectedLoss, { notation: 'compact' })}
            </Fact>
            <Fact label={t('kpi.rwa')}>{t.formatCurrency(sector.rwa, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.weightedAvgPd')}>
              {t.formatPercent(sector.weightedAvgPd, { maximumFractionDigits: 2 })}
            </Fact>
            <Fact label={t('kpi.weightedAvgLgd')}>
              {t.formatPercent(sector.weightedAvgLgd, { maximumFractionDigits: 1 })}
            </Fact>
            <Fact label={t('kpi.facilities')}>{t.formatNumber(sector.facilityCount)}</Fact>
          </dl>
        </Panel>

        {/* No panel title: the chart carries its own header, which is also its
            accessible name. */}
        <Panel>
          {/* TWO SCALES, NOT ONE. Expected loss runs in single-digit millions
              while RWA runs in hundreds of millions, so on a shared axis the EL
              line flattens onto the baseline and reads as zero. Each series gets
              its own axis (`yAxes` + `series[].yAxisIndex`) — EL on the left,
              RWA on the right — so both curves are legible at their own scale.
              A broken axis would have been the other option, but it distorts
              slope, and slope is the whole point of a trend chart. */}
          <LineChart
            series={[
              { label: t('kpi.expectedLoss'), data: quarters.map((q) => q.expectedLoss) },
              { label: t('kpi.rwa'), data: quarters.map((q) => q.rwa), yAxisIndex: 1 },
            ]}
            xAxis={{ data: quarterLabels, scale: 'category' }}
            yAxes={[
              { label: t('kpi.expectedLoss'), min: 0, valueFormatter: money },
              { label: t('kpi.rwa'), min: 0, position: 'right', valueFormatter: money },
            ]}
            valueFormatter={money}
            locale={state.locale}
            curve="monotone"
            show-marks
            grid="horizontal"
            axis-ticks
            legend="top-end"
            height="340px"
            label={`${t('kpi.expectedLoss')} · ${t('kpi.rwa')}`}
            subtitle={t('rating.historyHint', { quarter: REPORTING_QUARTER })}
            summary={t('chart.summary.line', {
              label: `${t('kpi.expectedLoss')} · ${t('kpi.rwa')}`,
              count: 2,
            })}
          />
        </Panel>
      </section>

      <Panel
        title={t('screen.counterparties.title')}
        subtitle={t('screen.counterparties.subtitle', { count: sector.counterpartyCount })}
      >
        <CounterpartyTable sectorId={sector.id} showSector={false} />
      </Panel>
    </Screen>
  );
}
