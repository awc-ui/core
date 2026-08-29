/**
 * The advisor's book, as a filtered, sortable table.
 *
 * Belongs to the overview screen and to nothing else: a household screen shows
 * ONE household, so there is no second caller to generalise for.
 *
 * THE TABLE SORTS NOTHING. `md-table`'s `sort-by` / `sort-order` are display
 * state and `mdSortChange` is a REQUEST — the handler pushes it into React
 * state and the rows are re-read through `getHouseholds()`, whose filter takes
 * the same six sort keys the header offers. The comparator therefore lives in
 * the kit, beside the data, and a second port cannot disagree with this one
 * about what "sorted by next review" means. The same is true of the two
 * filters: `search` and `segment` go into the selector, never into a `.filter()`
 * over its result.
 *
 * COMPOSITION. `md-table-container` WRAPS `md-table` (§7.1) and carries the
 * toolbar in its `top` slot, outside the scroll region, so the filters stay put
 * while the rows scroll. There is no pagination: eight households fit, and a
 * pagination bar reading "1–8 of 8" tells the reader nothing.
 *
 * DRILLING is the household name, which is a real anchor (`<Drill>`), not a
 * `clickable` row: it is reachable by Tab, it has a URL you can copy, and it
 * does not put a second activation target around the cells.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getHouseholds,
  TABLES,
  type Household,
  type HouseholdSortKey,
  type Segment,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { EmptyState } from '../Shell';
import { useCustomEvent } from '../elements';
import {
  Drill,
  Highlight,
  KycDot,
  MandateChip,
  NameCell,
  Num,
  DateText,
  Money,
  Percent,
  SegmentChip,
  Signed,
  StrategyChip,
} from '../bits';

interface SortState {
  column: HouseholdSortKey;
  order: 'asc' | 'desc';
}

/** Largest book first — the same default `getHouseholds()` applies with no filter. */
const DEFAULT_SORT: SortState = { column: 'totalAum', order: 'desc' };

/** Which columns want `desc` on their first click: the ones where big is the news. */
const NUMERIC_KEYS: HouseholdSortKey[] = ['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount'];

export function OverviewBookTable() {
  const t = useT();
  const layout = TABLES.households(false);

  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment | ''>('');

  const tableRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLElement | null>(null);
  const segmentRef = useRef<HTMLElement | null>(null);

  /*
   * The three-state cycle ends in `none`, where the table clears its own
   * `sort-by` and reports an empty column. That is "no sort chosen", not "no
   * order at all" — the selector always returns something — so it falls back to
   * the same default the unfiltered book has.
   */
  useCustomEvent<CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>>(
    tableRef,
    'mdSortChange',
    (event) => {
      const { column, order } = event.detail;
      if (!column || order === 'none') {
        setSort(DEFAULT_SORT);
        return;
      }
      setSort({ column: column as HouseholdSortKey, order });
    },
  );

  // `mdInput` rather than `mdChange`: the field commits on blur, and a filter
  // that only applies when you leave it feels broken. The field is left
  // UNCONTROLLED — no `value` prop — so React never writes back into an input
  // the user is typing in; `clearable="internal"` gives it its own ✕, which
  // empties the field and emits `mdInput` with an empty string, landing here
  // like any other keystroke.
  useCustomEvent<CustomEvent<string>>(searchRef, 'mdInput', (event) => {
    setSearch(event.detail ?? '');
  });

  useCustomEvent<CustomEvent<string>>(segmentRef, 'mdChange', (event) => {
    setSegment((event.detail ?? '') as Segment | '');
  });

  const rows = useMemo<Household[]>(
    () =>
      getHouseholds({
        sortBy: sort.column,
        sortDir: sort.order,
        search: search.trim() || undefined,
        segment: segment || undefined,
      }),
    [sort.column, sort.order, search, segment],
  );

  /*
   * The facets the book actually contains, not every value the type allows.
   *
   * Offering a segment no household is in gives the reader a filter that can
   * only ever empty the table. Sorted by the raw value so two framework builds
   * list them in the same order regardless of how the fixture happens to be
   * ordered. (The kit would be a better home for this list — see the note in
   * the hand-off.)
   */
  const segments = useMemo<Segment[]>(
    () => [...new Set(getHouseholds().map((household) => household.segment))].sort(),
    [],
  );

  const total = getHouseholds().length;
  const filtered = search.trim() !== '' || segment !== '';

  const columns: { key: HouseholdSortKey | null; label: string; numeric?: boolean }[] = [
    { key: 'name', label: t('wealth.table.household') },
    { key: null, label: t('wealth.table.segment') },
    { key: null, label: t('wealth.table.mandate') },
    { key: null, label: t('wealth.table.strategy') },
    { key: 'totalAum', label: t('wealth.table.aum'), numeric: true },
    { key: 'ytdReturn', label: t('wealth.table.ytd'), numeric: true },
    { key: 'unrealisedPl', label: t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'memberCount', label: t('wealth.table.members'), numeric: true },
    { key: 'nextReviewDate', label: t('wealth.table.nextReview') },
  ];

  return (
    <div className="table-host">
      <md-table-container variant="outlined">
        <md-table-toolbar
          slot="top"
          headline={t('wealth.panel.book')}
          supporting-text={t('wealth.common.showing', { shown: rows.length, total })}
        />

        {/*
          THE FILTERS ARE A SECOND `top` CHILD, not the toolbar's `actions` slot,
          and that was measured rather than guessed.

          `md-table-toolbar` lays its band out as one non-wrapping row whose
          actions container is `flex: 0 0 auto` — sized for the icon buttons its
          manual shows. Two form fields are ~440px of intrinsic width, so at
          420px the band overflowed and the fields were drawn straight over the
          headline. The container's `top` part is a flex COLUMN, so a second
          child stacks under the toolbar, stays outside the scroll region with
          it, and wraps on its own at narrow widths.

          Both controls keep their own tab stop, which is what a form control
          should have — they never join a roving group.
        */}
        <div
          slot="top"
          className="row row--end"
          style={{
            paddingInline: 'var(--md-sys-spacing-inset-xl, 24px)',
            paddingBlockEnd: 'var(--md-sys-spacing-inset-md, 12px)',
          }}
        >
          <md-text-field
            ref={searchRef}
            variant="outlined"
            type="search"
            // Spelled out rather than bare. `clearable` is a three-way enum,
            // and the bare form only reads as "internal" when it arrives as an
            // ATTRIBUTE — which it never does from a framework binding.
            clearable="internal"
            label={t('wealth.action.searchHouseholds')}
            density="-2"
            style={{ flex: '1 1 200px', maxInlineSize: '300px' }}
          />
          <md-select
            ref={segmentRef}
            variant="outlined"
            clearable
            full-width
            label={t('wealth.table.segment')}
            value={segment}
            density="-2"
            clear-label={t('wealth.action.clearFilters')}
            style={{ flex: '0 1 200px', maxInlineSize: '240px' }}
          >
            {segments.map((value) => (
              <md-select-option key={value} value={value}>
                {t(`wealth.segment.${value}`)}
              </md-select-option>
            ))}
          </md-select>
        </div>

        <md-table
          ref={tableRef}
          label={t('wealth.panel.book')}
          column-template={layout.columns}
          min-width={layout.minWidth}
          // The ratchet is measured once and never recomputed, so filtering
          // down to two rows would leave the height of eight behind it.
          keep-height="false"
          striped
          sort-by={sort.column}
          sort-order={sort.order}
          empty={rows.length === 0 || undefined}
          row-count={rows.length}
        >
          <md-table-head>
            {/* No `active` / `order` on the labels: `md-table` declares the sort
                above and pushes both down into every label itself, so anything
                written here could only ever disagree with it. */}
            <md-table-row rowgroup="head">
              {columns.map((column) => (
                <md-table-cell
                  key={column.label}
                  head
                  scope="col"
                  numeric={column.numeric || undefined}
                >
                  {column.key ? (
                    <md-table-sort-label
                      column={column.key}
                      default-order={NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc'}
                      icon-position={column.numeric ? 'start' : 'end'}
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
            {rows.map((household) => (
              <md-table-row key={household.id} value={household.id}>
                <md-table-cell>
                  <NameCell dot={<KycDot status={household.kycStatus} />}>
                    {/* The name is the only searched field this table shows —
                        `getHouseholds` also matches on `id`, which no column
                        renders, so marking anything else would claim a hit on
                        something the reader cannot see. */}
                    <Drill href={route.household(household.id)}>
                      <Highlight text={household.name} query={search} />
                    </Drill>
                  </NameCell>
                </md-table-cell>
                <md-table-cell>
                  <SegmentChip segment={household.segment} />
                </md-table-cell>
                <md-table-cell>
                  <MandateChip mandate={household.mandate} />
                </md-table-cell>
                <md-table-cell>
                  <StrategyChip strategy={household.strategy} />
                </md-table-cell>
                <md-table-cell numeric>
                  <Money value={household.totalAum} compact />
                </md-table-cell>
                <md-table-cell numeric>
                  <Signed value={household.ytdReturn} kind="percent" />
                </md-table-cell>
                <md-table-cell numeric>
                  <Signed value={household.unrealisedPl} compact />
                </md-table-cell>
                <md-table-cell numeric>
                  <Num value={household.memberCount} />
                </md-table-cell>
                <md-table-cell>
                  <DateText value={household.nextReviewDate} />
                </md-table-cell>
              </md-table-row>
            ))}
          </md-table-body>

          {/*
            The empty state stays INSIDE the container rather than replacing it.
            Emptiness here is always the reader's own filter, and swapping the
            table out would take the search field and the segment select away
            with it — leaving no way to undo what caused it.
          */}
          {rows.length === 0 ? (
            <div slot="empty">
              <EmptyState
                message={
                  search.trim()
                    ? t('wealth.empty.search', { query: search.trim() })
                    : t('wealth.empty.households')
                }
                hint={filtered}
              />
            </div>
          ) : null}
        </md-table>
      </md-table-container>
    </div>
  );
}
