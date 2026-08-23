'use client';

/**
 * The counterparty table, used by the overview ("largest exposures") and by
 * every sector screen.
 *
 * SORTING. `md-table` sorts nothing by itself — `sort-by`/`sort-order` are
 * display state and `mdSortChange` is a REQUEST. The handler pushes the request
 * into React state, and the rows are re-read through `getCounterparties()`,
 * whose filter takes the same sort keys the header offers. So the sort is done
 * by the selector that owns the data, not by a second comparator here that could
 * disagree with it.
 *
 * DRILLING. The legal name is a real anchor, not a row click: it is reachable by
 * keyboard, it has a URL you can copy, and it survives JavaScript being slow to
 * arrive. Legal names are proper nouns and are never translated.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getCounterparties,
  type Counterparty,
  type CounterpartySortKey,
  type SectorId,
} from '@awc-ui/showcase-kit/data';
import { useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { useCustomEvent } from './elements';
import { Drill, EmptyState } from './Shell';
import { RatingChip, WatchDot } from './bits';

type SortState = { column: CounterpartySortKey; order: 'asc' | 'desc' };

const NUMERIC_KEYS: CounterpartySortKey[] = ['ead', 'pd', 'expectedLoss', 'rwa', 'utilisation', 'grade'];

export function CounterpartyTable({
  sectorId,
  limit,
  showSector = true,
  initialSort = { column: 'ead', order: 'desc' },
}: {
  sectorId?: SectorId;
  limit?: number;
  showSector?: boolean;
  initialSort?: SortState;
}) {
  const t = useT();
  const layout = TABLES.counterparties(showSector);
  const [sort, setSort] = useState<SortState>(initialSort);
  const tableRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>>(
    tableRef,
    'mdSortChange',
    (event) => {
      const { column, order } = event.detail;
      if (!column || order === 'none') {
        setSort(initialSort);
        return;
      }
      setSort({ column: column as CounterpartySortKey, order });
    },
  );

  // PAGING. `limit` is the "top N" cap the overview asks for (largest exposures);
  // paging applies to whatever survives it. md-table-pagination is display state
  // plus a REQUEST, exactly like the sort header: it renders the readout and the
  // controls, and this component owns which slice is actually rendered.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const allRows = useMemo<Counterparty[]>(
    () => getCounterparties({ sectorId, sortBy: sort.column, sortDir: sort.order, limit }),
    [sectorId, sort.column, sort.order, limit],
  );

  // A sort or filter change can leave the reader stranded past the last page.
  const lastPage = Math.max(0, Math.ceil(allRows.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);

  const rows = useMemo<Counterparty[]>(
    () => allRows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [allRows, safePage, rowsPerPage],
  );

  const paginationRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ page: number }>>(paginationRef, 'mdPageChange', (event) => {
    setPage(event.detail.page);
  });
  useCustomEvent<CustomEvent<{ rowsPerPage: number }>>(
    paginationRef,
    'mdRowsPerPageChange',
    (event) => {
      // No setPage(0) here: md-table-pagination has already reset the page and
      // emitted mdPageChange, which the handler above consumes. Resetting again
      // is the component's documented anti-pattern.
      setRowsPerPage(event.detail.rowsPerPage);
    },
  );

  const columns: { key: CounterpartySortKey | null; label: string; numeric?: boolean }[] = [
    { key: 'legalName', label: t('table.counterparty') },
    ...(showSector ? [{ key: null, label: t('table.sector') }] : []),
    { key: null, label: t('table.country') },
    { key: 'grade', label: t('table.rating') },
    { key: 'pd', label: t('table.pd'), numeric: true },
    { key: null, label: t('table.lgd'), numeric: true },
    { key: 'ead', label: t('table.ead'), numeric: true },
    { key: 'expectedLoss', label: t('table.expectedLoss'), numeric: true },
    { key: 'rwa', label: t('table.rwa'), numeric: true },
    { key: 'utilisation', label: t('table.utilisation'), numeric: true },
  ];

  if (rows.length === 0) {
    return <EmptyState message={t('empty.counterparties')} hint />;
  }

  return (
    <md-table-container variant="outlined">
      <md-table
        ref={tableRef}
        label={t('screen.counterparties.title')}
        column-template={layout.columns}
        min-width={layout.minWidth}
        // md-table ratchets its height by default (keep-height) so paging cannot make
        // the page jump. That baseline is measured once and never recomputed, so a
        // density change strands the taller height and leaves dead space below the
        // rows — 176px at rung -4. Pagination already holds the row count steady
        // here, so the ratchet earns little; live density switching matters more.
        keep-height="false"
        striped
        sort-by={sort.column}
        sort-order={sort.order}
        // Without these, assistive tech announces "row 1 of 10" on every page
        // instead of the row's position in the whole book. row-count takes the
        // BODY total; md-table adds the head and foot rows itself.
        row-offset={safePage * rowsPerPage}
        row-count={allRows.length}
      >
        <md-table-head>
          {/* The sort labels carry no `active` / `order`: md-table already
              declares sort-by / sort-order above and pushes both down into
              every label on sync, so anything written here could only ever
              disagree with it. */}
          <md-table-row rowgroup="head">
            {columns.map((column) => (
              <md-table-cell key={column.label} head scope="col" numeric={column.numeric || undefined}>
                {column.key ? (
                  <md-table-sort-label
                    column={column.key}
                    default-order={NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc'}
                  >
                    {column.label}
                  </md-table-sort-label>
                ) : (
                  column.label
                )}
              </md-table-cell>
            ))}
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {rows.map((cp) => (
            <md-table-row key={cp.id} value={cp.id}>
              <md-table-cell>
                <span className="row" style={{ gap: 'var(--md-sys-spacing-gap-xs, 4px)' }}>
                  <WatchDot on={cp.watchlist} />
                  <Drill href={route.counterparty(cp.id)}>{cp.legalName}</Drill>
                </span>
              </md-table-cell>
              {showSector ? (
                <md-table-cell>
                  <Drill href={route.sector(cp.sectorId)}>{t(`sector.${cp.sectorId}`)}</Drill>
                </md-table-cell>
              ) : null}
              <md-table-cell>{t(`country.${cp.country}`)}</md-table-cell>
              <md-table-cell>
                <RatingChip label={cp.ratingLabel} band={cp.ratingBand} grade={cp.grade} />
              </md-table-cell>
              <md-table-cell numeric>{t.formatPercent(cp.pd, { maximumFractionDigits: 2 })}</md-table-cell>
              <md-table-cell numeric>{t.formatPercent(cp.lgd, { maximumFractionDigits: 0 })}</md-table-cell>
              <md-table-cell numeric>{t.formatCurrency(cp.ead, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>{t.formatCurrency(cp.expectedLoss, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>{t.formatCurrency(cp.rwa, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>
                <span style={{ color: `var(--md-sys-color-${utilisationColor(cp.utilisation)})` }}>
                  {t.formatPercent(cp.utilisation, { maximumFractionDigits: 0 })}
                </span>
              </md-table-cell>
            </md-table-row>
          ))}
        </md-table-body>
      </md-table>
      <md-table-pagination
        ref={paginationRef}
        slot="bottom"
        count={allRows.length}
        page={safePage}
        rows-per-page={rowsPerPage}
        rows-per-page-options="10,25,all"
        show-first-last
        label-rows-per-page={t('table.rowsPerPage')}
        label-displayed-rows={t('table.displayedRows')}
        label-first-page={t('table.firstPage')}
        label-previous-page={t('table.previousPage')}
        label-next-page={t('table.nextPage')}
        label-last-page={t('table.lastPage')}
        label-all={t('table.all')}
      ></md-table-pagination>
    </md-table-container>
  );
}
