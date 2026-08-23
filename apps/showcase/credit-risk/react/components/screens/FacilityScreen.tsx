'use client';

/**
 * Screen 4 — the facility, and the bottom of the drill path.
 *
 * Terms, then the three things a credit officer checks after them: covenant
 * headroom, collateral net of haircuts, and the balance profile to maturity.
 *
 * COLLATERAL. `valuation` is in the collateral's own currency, `valuationEur` is
 * the converted twin and `netValue` — always EUR — is already
 * `valuationEur × (1 − haircut)`. The table shows all three so the haircut is
 * visible rather than implied, and the panel footer compares total net value
 * against the facility's EAD, which is the coverage ratio that actually matters.
 *
 * SCHEDULE. See `drawdownSchedule()` in `@awc-ui/showcase-kit/credit-risk`:
 * term loans amortise straight-line to maturity, committed revolving lines hold
 * and retire in one step. Both shapes come out of the fixture's own dates, so
 * the table is a projection of the data rather than an invention on top of it.
 */

import { useMemo } from 'react';
import {
  getCollateralFor,
  getCounterpartyById,
  getCovenantsFor,
  getFacilityById,
  type Facility,
} from '@awc-ui/showcase-kit/data';
import { useT } from '@/lib/showcase';
import { drawdownSchedule, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { route } from '@/lib/routes';
import { EmptyState, Panel, Screen } from '../Shell';
import { CovenantMeter, Fact, FacilityStatusChip, RatioMeter } from '../bits';

export function FacilityScreen({ facilityId }: { facilityId: string }) {
  const t = useT();
  const facility = getFacilityById(facilityId) as Facility | undefined;
  const counterparty = facility ? getCounterpartyById(facility.counterpartyId) : undefined;
  const covenants = useMemo(() => (facility ? getCovenantsFor(facility.id) : []), [facility]);
  const collateral = useMemo(() => (facility ? getCollateralFor(facility.id) : []), [facility]);
  const schedule = useMemo(() => (facility ? drawdownSchedule(facility) : []), [facility]);

  if (!facility) {
    return (
      <Screen title={t('empty.generic')} subtitle={t('empty.hint')}>
        <Panel>
          <p className="muted">{t('empty.generic')}</p>
        </Panel>
      </Screen>
    );
  }

  const netCollateral = collateral.reduce((sum, item) => sum + item.netValue, 0);
  const coverage = facility.ead > 0 ? netCollateral / facility.ead : 0;
  const localCurrency = { currency: facility.currency } as const;

  return (
    <Screen
      title={`${facility.id} · ${t(facility.typeKey)}`}
      subtitle={facility.counterpartyName}
      crumbs={[
        { label: t('nav.overview'), href: route.overview() },
        ...(counterparty
          ? [
              { label: t(`sector.${counterparty.sectorId}`), href: route.sector(counterparty.sectorId) },
              { label: counterparty.legalName, href: route.counterparty(counterparty.id) },
            ]
          : []),
        { label: facility.id },
      ]}
      aside={
        <>
          <FacilityStatusChip status={facility.status} />
          <md-chip
            variant="assist"
            appearance="outlined"
            icon={facility.secured ? 'lock' : 'lock_open'}
            label={facility.secured ? t('common.secured') : t('common.unsecured')}
          />
        </>
      }
    >
      <section className="grid-2">
        <Panel title={t('table.facility')} subtitle={t(facility.typeKey)}>
          <dl className="dl">
            <Fact label={t('table.currency')}>{facility.currency}</Fact>
            <Fact label={t('table.commitment')}>
              {t.formatCurrency(facility.commitment, { ...localCurrency, notation: 'compact' })}
            </Fact>
            <Fact label={t('table.drawn')}>
              {t.formatCurrency(facility.drawn, { ...localCurrency, notation: 'compact' })}
            </Fact>
            <Fact label={t('table.undrawn')}>
              {t.formatCurrency(facility.undrawn, { ...localCurrency, notation: 'compact' })}
            </Fact>
            <Fact label={t('table.ead')}>{t.formatCurrency(facility.ead, { notation: 'compact' })}</Fact>
            <Fact label={t('table.ccf')}>{t.formatPercent(facility.ccf, { maximumFractionDigits: 0 })}</Fact>
            <Fact label={t('table.margin')}>{t('unit.bps', { value: t.formatNumber(facility.marginBps) })}</Fact>
            <Fact label={t('table.maturity')}>{t.formatDate(facility.maturityDate, 'long')}</Fact>
            <Fact label={t('table.tenor')}>
              {t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) })}
            </Fact>
          </dl>
          <RatioMeter
            label={t('kpi.utilisation')}
            fraction={facility.utilisation}
            color={utilisationColor(facility.utilisation)}
          />
        </Panel>

        <Panel
          title={t('screen.covenants.title')}
          subtitle={t('screen.covenants.subtitle', {
            breaches: covenants.filter((c) => c.status === 'breach').length,
            watch: covenants.filter((c) => c.status === 'watch').length,
          })}
        >
          {covenants.length === 0 ? (
            <EmptyState message={t('empty.covenants')} />
          ) : (
            <div className="stack">
              {covenants.map((covenant) => (
                <CovenantMeter key={covenant.id} covenant={covenant} />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel
        title={t('screen.collateral.title')}
        subtitle={t('screen.collateral.subtitle')}
        actions={
          collateral.length > 0 ? (
            <md-chip
              variant="assist"
              appearance="filled"
              color={coverage >= 1 ? 'success' : coverage >= 0.5 ? 'warning' : 'error'}
              label={`${t('kpi.collateralCoverage')} ${t.formatPercent(coverage, { maximumFractionDigits: 0 })}`}
            />
          ) : null
        }
      >
        {collateral.length === 0 ? (
          <EmptyState message={t('empty.collateral')} />
        ) : (
          <md-table-container variant="outlined">
            <md-table
              label={t('screen.collateral.title')}
              column-template="minmax(150px, 1.2fr) 88px minmax(130px, 1fr) minmax(130px, 1fr) 96px minmax(130px, 1fr) 128px minmax(150px, 1fr)"
              min-width="1060px"
              striped
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">
                    {t('table.collateral')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.currency')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('table.valuation')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('app.baseCurrency', { currency: 'EUR' })}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('table.haircut')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('table.netValue')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.lastValuation')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.basis')}
                  </md-table-cell>
                </md-table-row>
              </md-table-head>
              <md-table-body>
                {collateral.map((item) => (
                  <md-table-row key={item.id} value={item.id}>
                    <md-table-cell>{t(item.typeKey)}</md-table-cell>
                    <md-table-cell>{item.currency}</md-table-cell>
                    <md-table-cell numeric>
                      {t.formatCurrency(item.valuation, { currency: item.currency, notation: 'compact' })}
                    </md-table-cell>
                    <md-table-cell numeric>
                      {t.formatCurrency(item.valuationEur, { notation: 'compact' })}
                    </md-table-cell>
                    <md-table-cell numeric>
                      {t.formatPercent(item.haircutPct, { maximumFractionDigits: 0 })}
                    </md-table-cell>
                    <md-table-cell numeric>{t.formatCurrency(item.netValue, { notation: 'compact' })}</md-table-cell>
                    <md-table-cell>{t.formatDate(item.lastValuationDate, 'medium')}</md-table-cell>
                    <md-table-cell>{t(item.valuationBasisKey)}</md-table-cell>
                  </md-table-row>
                ))}
              </md-table-body>
              <md-table-foot>
                <md-table-row rowgroup="foot">
                  <md-table-cell>{t('common.total')}</md-table-cell>
                  <md-table-cell />
                  <md-table-cell />
                  <md-table-cell />
                  <md-table-cell />
                  <md-table-cell numeric>{t.formatCurrency(netCollateral, { notation: 'compact' })}</md-table-cell>
                  <md-table-cell />
                  <md-table-cell />
                </md-table-row>
              </md-table-foot>
            </md-table>
          </md-table-container>
        )}
      </Panel>

      <Panel
        title={t('table.tenor')}
        subtitle={t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) })}
      >
        <md-table-container variant="outlined">
          <md-table
            label={t('table.tenor')}
            column-template="110px minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) 108px"
            min-width="820px"
            striped
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell head scope="col">
                  {t('table.quarter')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.commitment')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.drawn')}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.undrawn')}
                </md-table-cell>
                {/* No dictionary key for "movement in the drawn balance"; the
                    delta sign is composed onto the translated noun the same way
                    `table.elDelta` composes it in the dictionary itself. */}
                <md-table-cell head scope="col" numeric>
                  {`Δ ${t('table.drawn')}`}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  {t('table.utilisation')}
                </md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              {schedule.map((row, index) => (
                <md-table-row key={row.quarter} value={row.quarter}>
                  <md-table-cell>{row.quarter}</md-table-cell>
                  <md-table-cell numeric>
                    {t.formatCurrency(row.commitment, { ...localCurrency, notation: 'compact' })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {t.formatCurrency(row.drawn, { ...localCurrency, notation: 'compact' })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {t.formatCurrency(row.undrawn, { ...localCurrency, notation: 'compact' })}
                  </md-table-cell>
                  <md-table-cell numeric>
                    <span
                      style={{
                        color:
                          row.movement < 0
                            ? 'var(--md-sys-color-success)'
                            : row.movement > 0
                              ? 'var(--md-sys-color-error)'
                              : undefined,
                      }}
                    >
                      {/* The opening row has nothing to move against, so it
                          reads n/a. A genuine zero movement in a later quarter
                          is a real number and is printed as one. Movements are
                          money in the facility's own currency, like the columns
                          beside them — a bare number here would read as euros. */}
                      {index === 0
                        ? t('common.na')
                        : t.formatCurrency(row.movement, { ...localCurrency, notation: 'compact' })}
                    </span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    {t.formatPercent(row.utilisation, { maximumFractionDigits: 0 })}
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
