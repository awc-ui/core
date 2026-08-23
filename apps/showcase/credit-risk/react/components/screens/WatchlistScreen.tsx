'use client';

/**
 * Screen 5 — early-warning signals.
 *
 * `getWatchlist()` returns rows already denormalised with the counterparty name,
 * sector, grade and EAD, and already sorted highest severity first then largest
 * exposure — so the table needs no join and no comparator, and the filters can
 * be a plain `Array.filter` over the selector's output rather than a second
 * ordering that could disagree with it.
 *
 * FILTERS. Severity is a multiselect segmented set (`mdChange` gives the value
 * of every selected segment, in DOM order); sector is a clearable select. An
 * empty severity selection means "all", which is the same thing the set reports
 * when the user clears the last segment — so no separate "all" segment is
 * needed, and the reset button restores exactly that state.
 *
 * `frozen-header`, NOT `sticky-header`. This is the only table in the app inside
 * a bounded container, so the only one that scrolls vertically, and the two
 * props give different architectures for that. `sticky-header` pins the header
 * inside the scroll port, which means the scroll port — and therefore the
 * scrollbar — spans the header too. `frozen-header` renders the header OUTSIDE
 * the scrolling area so the bar runs beside the rows only. md-table's readme:
 * "the header is rendered OUTSIDE the vertical scroll area, so the scrollbar
 * spans only the body and runs UNDER the head."
 */

import { useMemo, useRef, useState } from 'react';
import {
  getRatingGrade,
  getSectors,
  getWatchlist,
  type SectorId,
  type SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import { useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { useCustomEvent } from '../elements';
import { Drill, EmptyState, Panel, Screen } from '../Shell';
import { RatingChip, SeverityChip } from '../bits';

const SEVERITIES: SignalSeverity[] = ['high', 'medium', 'low'];

export function WatchlistScreen() {
  const t = useT();
  const sectors = getSectors();
  const signals = getWatchlist();

  const [severities, setSeverities] = useState<SignalSeverity[]>([]);
  const [sectorId, setSectorId] = useState<SectorId | ''>('');

  const severityRef = useRef<HTMLElement | null>(null);
  const sectorRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<string[]>>(severityRef, 'mdChange', (event) => {
    setSeverities((event.detail ?? []) as SignalSeverity[]);
  });
  useCustomEvent<CustomEvent<string>>(sectorRef, 'mdChange', (event) => {
    setSectorId((event.detail ?? '') as SectorId | '');
  });

  const rows = useMemo(
    () =>
      signals.filter(
        (signal) =>
          (severities.length === 0 || severities.includes(signal.severity)) &&
          (sectorId === '' || signal.sectorId === sectorId),
      ),
    [signals, severities, sectorId],
  );

  const counterparties = new Set(rows.map((signal) => signal.counterpartyId));

  const clearFilters = () => {
    setSeverities([]);
    setSectorId('');
    // The custom elements own their own visual state, so the reset has to be
    // pushed back into them; React does not re-render an attribute it never set.
    severityRef.current?.querySelectorAll('md-segmented-button').forEach((segment) => {
      (segment as unknown as { selected: boolean }).selected = false;
    });
    if (sectorRef.current) (sectorRef.current as unknown as { value: string }).value = '';
  };

  return (
    <Screen
      title={t('screen.watchlist.title')}
      subtitle={t('screen.watchlist.subtitle', {
        signals: signals.length,
        counterparties: new Set(signals.map((s) => s.counterpartyId)).size,
      })}
      crumbs={[{ label: t('nav.overview'), href: route.overview() }, { label: t('nav.watchlist') }]}
      aside={
        <md-chip
          variant="assist"
          appearance="filled"
          color="error"
          icon="crisis_alert"
          label={t('common.showing', { shown: rows.length, total: signals.length })}
        />
      }
    >
      <Panel title={t('action.filter')} subtitle={t('table.severity')}>
        <div className="row">
          <md-segmented-button-set ref={severityRef} multiselect aria-label={t('table.severity')}>
            {SEVERITIES.map((severity) => (
              <md-segmented-button key={severity} value={severity} label={t(`severity.${severity}`)} />
            ))}
          </md-segmented-button-set>

          <md-select
            ref={sectorRef}
            label={t('table.sector')}
            placeholder={t('common.all')}
            clearable
            clear-label={t('action.clearFilters')}
          >
            {sectors.map((sector) => (
              <md-select-option key={sector.id} value={sector.id} label={t(sector.nameKey)}>
                {t(sector.nameKey)}
              </md-select-option>
            ))}
          </md-select>

          <md-button variant="text" size="sm" icon="filter_alt_off" onClick={clearFilters}>
            {t('action.clearFilters')}
          </md-button>
        </div>
      </Panel>

      <Panel
        title={t('table.signal')}
        subtitle={t('common.of', { count: counterparties.size, total: rows.length })}
      >
        {rows.length === 0 ? (
          <EmptyState message={t('empty.signals')} hint />
        ) : (
          <md-table-container variant="outlined" max-height="60vh">
            <md-table
              label={t('screen.watchlist.title')}
              column-template={TABLES.watchlist.columns}
              min-width={TABLES.watchlist.minWidth}
              frozen-header
              striped
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">
                    {t('table.counterparty')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.sector')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.rating')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.signal')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.severity')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('table.ead')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.opened')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {t('table.daysOpen')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {t('table.owner')}
                  </md-table-cell>
                </md-table-row>
              </md-table-head>
              <md-table-body>
                {rows.map((signal) => (
                  <md-table-row key={signal.id} value={signal.id}>
                    <md-table-cell>
                      <Drill href={route.counterparty(signal.counterpartyId)}>{signal.counterpartyName}</Drill>
                    </md-table-cell>
                    <md-table-cell>
                      <Drill href={route.sector(signal.sectorId)}>{t(`sector.${signal.sectorId}`)}</Drill>
                    </md-table-cell>
                    <md-table-cell>
                      {/* The signal row carries the grade but not the band, so
                          the band comes from the rating scale rather than from a
                          second set of thresholds invented here. */}
                      <RatingChip
                        label={signal.ratingLabel}
                        band={getRatingGrade(signal.grade)?.band ?? 'speculative'}
                      />
                    </md-table-cell>
                    <md-table-cell>{t(signal.typeKey)}</md-table-cell>
                    <md-table-cell>
                      <SeverityChip severity={signal.severity} />
                    </md-table-cell>
                    <md-table-cell numeric>{t.formatCurrency(signal.ead, { notation: 'compact' })}</md-table-cell>
                    <md-table-cell>{t.formatDate(signal.openedDate, 'medium')}</md-table-cell>
                    <md-table-cell numeric>
                      <span title={t('signal.openFor', { days: signal.daysOpen })}>
                        {t.formatNumber(signal.daysOpen)}
                      </span>
                    </md-table-cell>
                    <md-table-cell>{signal.owner}</md-table-cell>
                  </md-table-row>
                ))}
              </md-table-body>
            </md-table>
          </md-table-container>
        )}
      </Panel>
    </Screen>
  );
}
