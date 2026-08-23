'use client';

/**
 * Facilities booked to one counterparty.
 *
 * CURRENCY IS THE TRAP HERE. `commitment` and `drawn` are denominated in the
 * facility's OWN currency; `commitmentEur`/`drawnEur` are the converted twins and
 * `ead` is always EUR. The commitment column therefore formats with
 * `{ currency: facility.currency }` and shows the EUR equivalent underneath,
 * while the EAD column formats in the base currency with no override. Mixing the
 * two would quietly report a RON line as if it were euros.
 */

import { getFacilitiesFor, type Facility } from '@awc-ui/showcase-kit/data';
import { useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { Drill, EmptyState } from './Shell';
import { FacilityStatusChip } from './bits';

export function FacilityTable({ counterpartyId }: { counterpartyId: string }) {
  const t = useT();
  const rows: Facility[] = getFacilitiesFor(counterpartyId);

  if (rows.length === 0) {
    return <EmptyState message={t('empty.facilities')} />;
  }

  return (
    <md-table-container variant="outlined">
      <md-table
        label={t('screen.facilities.title')}
        column-template="132px minmax(150px, 1fr) 96px minmax(150px, 1.2fr) 128px 120px 104px 108px 116px"
        min-width="1120px"
        sticky-header
        striped
      >
        <md-table-head>
          <md-table-row rowgroup="head">
            <md-table-cell head scope="col">
              {t('table.facility')}
            </md-table-cell>
            <md-table-cell head scope="col">
              {t('table.type')}
            </md-table-cell>
            <md-table-cell head scope="col">
              {t('table.currency')}
            </md-table-cell>
            <md-table-cell head scope="col" numeric>
              {t('table.commitment')}
            </md-table-cell>
            <md-table-cell head scope="col" numeric>
              {t('table.ead')}
            </md-table-cell>
            <md-table-cell head scope="col" numeric>
              {t('table.utilisation')}
            </md-table-cell>
            <md-table-cell head scope="col" numeric>
              {t('table.margin')}
            </md-table-cell>
            <md-table-cell head scope="col">
              {t('table.maturity')}
            </md-table-cell>
            <md-table-cell head scope="col">
              {t('table.status')}
            </md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {rows.map((facility) => (
            <md-table-row key={facility.id} value={facility.id}>
              <md-table-cell>
                <Drill href={route.facility(facility.id)}>{facility.id}</Drill>
              </md-table-cell>
              <md-table-cell>{t(facility.typeKey)}</md-table-cell>
              <md-table-cell>{facility.currency}</md-table-cell>
              <md-table-cell numeric>
                <span className="num">
                  {t.formatCurrency(facility.commitment, {
                    currency: facility.currency,
                    notation: 'compact',
                  })}
                </span>
                {facility.currency === 'EUR' ? null : (
                  <>
                    <br />
                    <span className="muted num" style={{ font: 'var(--md-sys-typescale-label-small-font)' }}>
                      {t.formatCurrency(facility.commitmentEur, { notation: 'compact' })}
                    </span>
                  </>
                )}
              </md-table-cell>
              <md-table-cell numeric>{t.formatCurrency(facility.ead, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>
                {t.formatPercent(facility.utilisation, { maximumFractionDigits: 0 })}
              </md-table-cell>
              <md-table-cell numeric>{t('unit.bps', { value: t.formatNumber(facility.marginBps) })}</md-table-cell>
              <md-table-cell>{t.formatDate(facility.maturityDate, 'medium')}</md-table-cell>
              <md-table-cell>
                <FacilityStatusChip status={facility.status} />
              </md-table-cell>
            </md-table-row>
          ))}
        </md-table-body>
      </md-table>
    </md-table-container>
  );
}
