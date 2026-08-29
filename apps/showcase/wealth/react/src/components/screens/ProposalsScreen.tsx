/**
 * Screen 4 — advice documents moving through review.
 *
 * Three panels, in the order an advisor works in them:
 *
 *   1. THE BUILDER — `md-stepper` driving a four-step advice document. It lives
 *      in `ProposalBuilder.tsx`, which carries the reasoning for every control
 *      choice and for why the stepper is NOT inside a dialog.
 *   2. THE BOOK — every proposal the fixture holds, filtered through the kit's
 *      selector, sorted and paged here, in `md-table-container` wrapping
 *      `md-table` with the toolbar in `top` and the pagination in `bottom`
 *      (§7.1). Clicking a row picks it up in panel 3.
 *   3. THE TRAIL — the five stages that proposal has moved through, as a
 *      read-only `md-stepper` whose step states come from the kit's `stepState`
 *      map, never from a ternary here.
 *
 * WHERE THE SORTING LIVES, AND WHY IT IS HERE. Every other list selector takes
 * a `sortBy` / `sortDir`; `ProposalFilter` does not, so the ordering cannot be
 * pushed into the kit and two framework ports would have to agree by hand. It
 * is isolated in `compareProposals` below and flagged in the hand-off notes.
 * The FILTERING goes through `getProposals` exactly as the contract requires —
 * no `.filter()` on a selector's result anywhere in this file.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getAdvisor,
  getBookTotals,
  getProposals,
  PROPOSAL_AGEING_DAYS,
  PROPOSAL_HIGH_VALUE_EUR,
  stepState,
  TABLES,
  type Proposal,
  type ProposalStatus,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor } from '@/lib/routes';
import { usePathname } from '@/lib/router';
import { useCustomEvent } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import {
  Count,
  DateText,
  Fact,
  KpiTile,
  Money,
  Num,
  ProposalStatusChip,
  ProposalTypeChip,
} from '../bits';
import { ProposalBuilder } from './ProposalBuilder';
import { useCopy } from './proposal-copy';
import { KpiSkeleton, PanelSkeleton, TableSkeleton } from '../skeletons';

/* --------------------------------------------------------------- ordering */

/** The four columns this table can be ordered by. */
type SortKey = 'householdName' | 'estimatedValue' | 'createdDate' | 'daysOpen';
type SortOrder = 'asc' | 'desc' | 'none';

const SORTABLE: Record<SortKey, true> = {
  householdName: true,
  estimatedValue: true,
  createdDate: true,
  daysOpen: true,
};

/**
 * The comparator the kit does not have.
 *
 * `localeCompare` is pinned to `'en'` on purpose — the same thing the kit's own
 * selectors do. An ambient locale would make the row order depend on the
 * machine, and the whole point of this fixture is that two runs agree.
 */
function compareProposals(a: Proposal, b: Proposal, key: SortKey): number {
  switch (key) {
    case 'householdName':
      return a.householdName.localeCompare(b.householdName, 'en');
    case 'estimatedValue':
      return a.estimatedValue - b.estimatedValue;
    case 'daysOpen':
      return a.daysOpen - b.daysOpen;
    case 'createdDate':
    default:
      return a.createdDate.localeCompare(b.createdDate, 'en');
  }
}

const STATUS_FILTERS: ProposalStatus[] = [
  'draft',
  'in-review',
  'compliance',
  'client-review',
  'approved',
  'rejected',
];

/**
 * The facets, as data — one list read by four consumers.
 *
 * The chip row, the delegated handler, `filtersActive` and the clear action all
 * derive from this, so a facet cannot be added to the row and forgotten in the
 * reset. Each `id` is also the chip's `data-facet`, which is how one listener
 * serves the whole set.
 *
 * WHY THESE FOUR. Each sits on a DIFFERENT axis — lifecycle, ownership, age,
 * size — and each splits a seven-row book into a useful subset: open 5, mine 4,
 * ageing 4, high value 3. A facet that matched six of seven, or one, would be
 * decoration. The obvious fifth candidate, a "needs review" status group, is
 * deliberately absent: it would compete with the Status select for the same
 * axis, and picking one status plus a conflicting group is a guaranteed empty
 * table that reads as a bug.
 */
const FACETS = [
  { id: 'open', labelKey: 'wealth.proposal.filter.openOnly' },
  { id: 'mine', labelKey: 'wealth.proposal.filter.mine' },
  { id: 'ageing', labelKey: 'wealth.proposal.filter.ageing' },
  { id: 'highValue', labelKey: 'wealth.proposal.filter.highValue' },
] as const;

type FacetId = (typeof FACETS)[number]['id'];
type FacetState = Record<FacetId, boolean>;

const NO_FACETS: FacetState = { open: false, mine: false, ageing: false, highValue: false };

const ROWS_PER_PAGE_OPTIONS = '5,10,25';
const DEFAULT_ROWS_PER_PAGE = 5;

/* ----------------------------------------------------------------- screen */

export function ProposalsScreen() {
  const c = useCopy();
  const pathname = usePathname();

  const totals = getBookTotals();
  const everyProposal = getProposals();
  const open = getProposals({ open: true });
  // Pre-existing shape of the KPI row: the fixture has no book-level proposal
  // aggregate, so these three are summed here. Listed in the hand-off notes.
  const openValue = open.reduce((sum, proposal) => sum + proposal.estimatedValue, 0);
  const oldest = open.reduce((max, proposal) => Math.max(max, proposal.daysOpen), 0);

  /* ------------------------------------------------------- table state */

  const [status, setStatus] = useState<ProposalStatus | ''>('');
  const [facets, setFacets] = useState<FacetState>(NO_FACETS);
  const [sortBy, setSortBy] = useState<SortKey | ''>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [selectedId, setSelectedId] = useState('');

  const filtersActive = status !== '' || FACETS.some((facet) => facets[facet.id]);

  /*
   * FILTER through the selector, then order, then slice.
   *
   * `getProposals` returns a fresh array, so sorting it in place is safe and no
   * copy is needed. Its default order is the one the kit calls attention-first,
   * which is what an unsorted table should show — so `sortBy === ''` leaves it
   * exactly as the selector handed it over.
   */
  const rows = useMemo(() => {
    const filtered = getProposals({
      status: status === '' ? undefined : status,
      // Every facet is a FIELD ON THE FILTER, never a `.filter()` on the
      // result — the contract at the top of this file. The two that had no
      // field (`minDaysOpen`, `minEstimatedValue`) grew one in the kit rather
      // than being applied here; a threshold is the book's opinion, not a
      // view's, and both live beside the fixture that justifies them.
      open: facets.open ? true : undefined,
      advisorId: facets.mine ? getAdvisor().id : undefined,
      minDaysOpen: facets.ageing ? PROPOSAL_AGEING_DAYS : undefined,
      minEstimatedValue: facets.highValue ? PROPOSAL_HIGH_VALUE_EUR : undefined,
    });
    if (sortBy === '' || sortOrder === 'none') return filtered;
    const direction = sortOrder === 'desc' ? -1 : 1;
    return filtered.sort((a, b) => direction * compareProposals(a, b, sortBy));
  }, [status, facets, sortBy, sortOrder]);

  const offset = page * rowsPerPage;
  const pageRows = rows.slice(offset, offset + rowsPerPage);

  const selected = selectedId ? everyProposal.find((p) => p.id === selectedId) : undefined;

  /* -------------------------------------------------------- table events */

  const tableRef = useRef<HTMLElement | null>(null);

  /*
   * `md-table` sorts nothing by itself — `mdSortChange` is a REQUEST and the
   * rows are ours to reorder. The table has already cycled its own three-state
   * `sort-by` / `sort-order` and pushed them into every sort label by the time
   * this fires, so all that is left is to mirror them into state.
   *
   * The readme asks for a SYNCHRONOUS reorder so its FLIP animation has
   * something to measure. React commits after the handler returns, so the
   * reorder motion is a no-op here; the sort itself is unaffected, and this is
   * the one place where React's model and the component's differ.
   */
  useCustomEvent<CustomEvent<{ column: string; order: SortOrder }>>(
    tableRef,
    'mdSortChange',
    (event) => {
      const column = event.detail.column as SortKey | '';
      if (column === '' || event.detail.order === 'none' || !(column in SORTABLE)) {
        setSortBy('');
        setSortOrder('asc');
      } else {
        setSortBy(column);
        setSortOrder(event.detail.order);
      }
      setPage(0);
    },
  );

  useCustomEvent<CustomEvent<{ value: string }>>(tableRef, 'mdRowClick', (event) => {
    setSelectedId(event.detail.value);
  });

  const paginationRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ page: number }>>(paginationRef, 'mdPageChange', (event) => {
    setPage(event.detail.page);
  });

  // The component resets `page` to 0 itself and emits both events in order, so
  // this handler must not reset it a second time.
  useCustomEvent<CustomEvent<{ rowsPerPage: number }>>(
    paginationRef,
    'mdRowsPerPageChange',
    (event) => {
      setRowsPerPage(event.detail.rowsPerPage);
    },
  );

  /* ------------------------------------------------------ toolbar events */

  const statusRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(statusRef, 'mdChange', (event) => {
    setStatus(event.detail as ProposalStatus | '');
    setPage(0);
  });

  /*
   * ONE listener for the whole set, not one per chip.
   *
   * `mdSelect` bubbles and is composed, and a composed event retargets to the
   * shadow HOST — so `event.target` is the `md-chip` and its `data-facet` can
   * be read straight off it. The chip has already flipped its own `selected` by
   * the time this runs; all that is left is to mirror it into state. Same
   * delegation `HouseholdHoldings` uses for its chip row.
   */
  // `HTMLDivElement`, matching the element it lands on — `HouseholdHoldings`
  // types its own facet row the same way.
  const facetsRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(facetsRef, 'mdSelect', (event) => {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    setFacets((current) => ({ ...current, [id]: event.detail.selected }));
    setPage(0);
  });

  const clearRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<unknown>>(clearRef, 'mdClick', () => {
    if (!filtersActive) return;
    setStatus('');
    setFacets(NO_FACETS);
    setPage(0);
  });

  const layout = TABLES.proposals;

  return (
    <Screen
      crumbs={crumbsFor(pathname)}
      title={c('wealth.screen.proposals.title')}
      subtitle={c('wealth.screen.proposals.subtitle', {
        open: totals.openProposalCount,
        total: totals.proposalCount,
      })}
      skeleton={<ProposalsSkeleton label={c('wealth.screen.proposals.title')} />}
      actions={
        /*
         * One screen-level action, and it is a real one.
         *
         * §9.2's exact recommendation for a contextually-unavailable control:
         * `soft-disabled` keeps it focusable and announced — so a keyboard user
         * can find out WHY it is off — and the tooltip supplies the why.
         * `disabled` would drop it out of the tab order and take the
         * explanation with it. The tooltip wraps its trigger; it never points
         * at one by id (§7.1).
         */
        <md-tooltip
          text={
            filtersActive
              ? c('wealth.proposal.filter.clearHint')
              : c('wealth.proposal.filter.noneActive')
          }
          position="bottom"
        >
          <md-button
            ref={clearRef}
            variant="text"
            size="sm"
            icon="filter_alt_off"
            soft-disabled={!filtersActive}
          >
            {c('wealth.action.clearFilters')}
          </md-button>
        </md-tooltip>
      }
    >
      <section className="kpi-grid">
        <KpiTile
          label={c('wealth.kpi.openProposals')}
          value={String(open.length)}
          hint={c('wealth.kpi.proposals')}
          trailing={<Count value={everyProposal.length} />}
        />
        <KpiTile
          label={c('wealth.table.estimatedValue')}
          value={<Money value={openValue} compact />}
          hint={c('wealth.common.total')}
        />
        <KpiTile
          label={c('wealth.table.daysOpen')}
          value={<Num value={oldest} />}
          hint={c('wealth.common.more', { count: open.length })}
        />
        <KpiTile
          label={c('wealth.kpi.households')}
          value={String(new Set(open.map((proposal) => proposal.householdId)).size)}
          hint={c('wealth.kpi.openProposals')}
        />
      </section>

      <ProposalBuilder />

      <Panel
        title={c('wealth.proposal.table.title')}
        subtitle={c('wealth.proposal.table.hint')}
        actions={<Count value={rows.length} />}
      >
        <div className="table-host">
          {/*
           * `md-table-container` WRAPS `md-table` — the toolbar goes in its
           * `top` slot and the pagination in its `bottom` slot, both OUTSIDE
           * the scroll region, and neither ever goes inside the table (§7.1).
           * The container is also what arms the table's row motion for a page
           * change, which is why the pagination is slotted here rather than
           * placed beside the container.
           */}
          <md-table-container variant="outlined" max-height="60vh">
            <md-table-toolbar
              slot="top"
              headline={c('wealth.proposal.table.title')}
              supporting-text={c('wealth.proposal.table.hint')}
            >
              <md-select
                ref={statusRef}
                slot="actions"
                variant="outlined"
                density="-2"
                label={c('wealth.proposal.filter.status')}
                value={status}
                placeholder={c('wealth.proposal.filter.anyStatus')}
                clearable
                clear-label={c('wealth.proposal.filter.anyStatus')}
                no-options-text={c('wealth.empty.proposals')}
              >
                {STATUS_FILTERS.map((option) => (
                  <md-select-option
                    key={option}
                    value={option}
                    label={c(`wealth.proposalStatus.${option}`)}
                  />
                ))}
              </md-select>
            </md-table-toolbar>

            {/*
             * THE FACET SET IS A SECOND `top` CHILD, not one more thing in the
             * toolbar's `actions` slot.
             *
             * `md-table-toolbar` is a single non-wrapping flex row, and its own
             * CSS now carries the note about what that did to the ONE chip that
             * used to live there: 95px of chip squeezed into 79, "Open only"
             * rendered as "Open ...". Four would be worse. The container's
             * `top` part is a flex COLUMN, so this stacks under the toolbar,
             * stays outside the scroll viewport with it (the sticky header
             * sticks below, so they never collide), and wraps on its own line
             * when the panel is narrow.
             *
             * `role="group"` + `aria-label` is md-chip's own Filter-sets
             * contract: four chips are a set, and a set needs a name. The chips
             * stay non-removable so each host keeps `role="button"` +
             * `aria-pressed` — a remove button would step the host down to its
             * own nested `group` and lose the selection state a filter set is
             * entirely about.
             *
             * The inline padding mirrors the toolbar's own, through the public
             * property that now actually works, so the first chip's leading
             * edge lands on the headline's at every density rung.
             */}
            <div
              slot="top"
              ref={facetsRef}
              className="row facet-row"
              role="group"
              aria-label={c('wealth.proposal.filter.group')}
            >
              {FACETS.map((facet) => (
                <md-chip
                  key={facet.id}
                  data-facet={facet.id}
                  variant="filter"
                  appearance="outlined"
                  label={c(facet.labelKey)}
                  selected={facets[facet.id]}
                />
              ))}
            </div>

            <md-table
              ref={tableRef}
              column-template={layout.columns}
              min-width={layout.minWidth}
              label={c('wealth.proposal.table.label')}
              sticky-header
              hoverable
              sort-by={sortBy}
              sort-order={sortOrder}
              empty={pageRows.length === 0}
              /* So assistive tech says "row 6 of 14" on page two rather than
                 "row 1 of 5". */
              row-offset={offset}
              row-count={rows.length}
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">
                    {c('wealth.table.id')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    <md-table-sort-label column="householdName">
                      {c('wealth.table.household')}
                    </md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {c('wealth.table.type')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {c('wealth.table.status')}
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {c('wealth.table.progress')}
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    <md-table-sort-label column="estimatedValue" default-order="desc">
                      {c('wealth.table.estimatedValue')}
                    </md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    <md-table-sort-label column="createdDate" default-order="desc">
                      {c('wealth.table.created')}
                    </md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    <md-table-sort-label column="daysOpen" default-order="desc">
                      {c('wealth.table.daysOpen')}
                    </md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    {c('wealth.table.advisor')}
                  </md-table-cell>
                </md-table-row>
              </md-table-head>

              <md-table-body>
                {pageRows.map((proposal) => (
                  <md-table-row
                    key={proposal.id}
                    value={proposal.id}
                    clickable
                    highlight={proposal.id === selectedId}
                  >
                    <md-table-cell>{proposal.id}</md-table-cell>
                    <md-table-cell ellipsis>{proposal.householdName}</md-table-cell>
                    <md-table-cell>
                      <ProposalTypeChip type={proposal.type} />
                    </md-table-cell>
                    <md-table-cell>
                      <ProposalStatusChip status={proposal.status} />
                    </md-table-cell>
                    <md-table-cell>
                      {/* Two facts, no arithmetic: how many stages are done,
                          and the name of the one it is sitting in. */}
                      <span className="with-dot">
                        <span>
                          {c('wealth.common.of', {
                            count: proposal.completedStepCount,
                            total: proposal.stepCount,
                          })}
                        </span>
                        <span className="muted">
                          {c('wealth.proposal.currentStep', {
                            name: c(proposal.steps[proposal.currentStepIndex].nameKey),
                          })}
                        </span>
                      </span>
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Money value={proposal.estimatedValue} />
                    </md-table-cell>
                    <md-table-cell>
                      <DateText value={proposal.createdDate} />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Num value={proposal.daysOpen} />
                    </md-table-cell>
                    <md-table-cell ellipsis>{proposal.advisorName}</md-table-cell>
                  </md-table-row>
                ))}
              </md-table-body>

              <div slot="empty">
                <EmptyState message={c('wealth.empty.proposals')} hint={filtersActive} />
              </div>
            </md-table>

            <md-table-pagination
              ref={paginationRef}
              slot="bottom"
              count={rows.length}
              page={page}
              rows-per-page={rowsPerPage}
              rows-per-page-options={ROWS_PER_PAGE_OPTIONS}
              show-first-last
              label-rows-per-page={c('wealth.table.rowsPerPage')}
              label-displayed-rows={c('wealth.table.displayedRows')}
              label-first-page={c('wealth.table.firstPage')}
              label-previous-page={c('wealth.table.previousPage')}
              label-next-page={c('wealth.table.nextPage')}
              label-last-page={c('wealth.table.lastPage')}
              label-all={c('wealth.table.all')}
            />
          </md-table-container>
        </div>
      </Panel>

      <ReviewTrail proposal={selected} />
    </Screen>
  );
}

/* ------------------------------------------------------------ review trail */

/**
 * One proposal's five stages, read-only.
 *
 * The fixture's `StepState` and `md-step`'s own four states are not the same
 * four — a `current` stage is the component's `active` and a `blocked` one is
 * its `error` — so the mapping goes through the kit's `stepState` and never
 * through a ternary here.
 *
 * `key={proposal.id}` is what makes this a readout rather than a control.
 * `active` is authored once per proposal; because the value only changes when
 * the key does, React never patches the attribute afterwards, so clicking a
 * stage header moves the stepper's own highlight without React fighting it
 * back. `auto-complete="false"` keeps the fixture's completion authoritative,
 * and `nav="false"` removes the Back / Continue bar that would imply this is
 * something you can drive.
 */
function ReviewTrail({ proposal }: { proposal: Proposal | undefined }) {
  const c = useCopy();

  if (!proposal) {
    return (
      <Panel title={c('wealth.proposal.trail.title')} subtitle={c('wealth.proposal.trail.hint')}>
        <EmptyState message={c('wealth.proposal.trail.pick')} />
      </Panel>
    );
  }

  return (
    <Panel
      title={c('wealth.proposal.trail.title')}
      subtitle={c('wealth.proposal.trail.hint')}
      actions={<ProposalStatusChip status={proposal.status} />}
    >
      <div className="stack">
        {/* `readonly` — this trail REPORTS where the proposal is; it does not
            move it. `nav={false}` alone only hid the Back / Continue bar and
            left every header a button, so the five stages invited a click that
            did nothing. `mode` is gone with it: a trail has no navigation, so
            there is no linear-vs-non-linear question left to answer. */}
        <md-stepper
          key={proposal.id}
          active={proposal.currentStepIndex}
          nav={false}
          readonly
          auto-complete={false}
          label={c('wealth.proposal.trail.label', { id: proposal.id })}
          step-word={c('wealth.proposal.stepper.step')}
          of-word={c('wealth.proposal.stepper.of')}
          completed-word={c('wealth.proposal.stepper.completed')}
          current-word={c('wealth.proposal.stepper.current')}
          error-word={c('wealth.proposal.stepper.error')}
          optional-word={c('wealth.proposal.stepper.optional')}
        >
          {proposal.steps.map((step) => {
            const state = stepState[step.state];
            return (
              <md-step
                key={step.id}
                label={c(step.nameKey)}
                description={c(step.stateKey)}
                completed={state === 'complete'}
                error={state === 'error'}
                error-text={state === 'error' ? c(step.stateKey) : ''}
              />
            );
          })}
        </md-stepper>

        <dl className="dl">
          <Fact label={c('wealth.table.id')}>{proposal.id}</Fact>
          <Fact label={c('wealth.table.household')}>{proposal.householdName}</Fact>
          <Fact label={c('wealth.table.type')}>
            <ProposalTypeChip type={proposal.type} />
          </Fact>
          <Fact label={c('wealth.table.estimatedValue')}>
            <Money value={proposal.estimatedValue} />
          </Fact>
          <Fact label={c('wealth.table.fee')}>
            <Money value={proposal.estimatedFeeImpact} />
          </Fact>
          <Fact label={c('wealth.table.created')}>
            <DateText value={proposal.createdDate} />
          </Fact>
          <Fact label={c('wealth.table.updated')}>
            <DateText value={proposal.updatedDate} />
          </Fact>
          <Fact label={c('wealth.table.daysOpen')}>
            <Num value={proposal.daysOpen} />
          </Fact>
          <Fact label={c('wealth.table.advisor')}>{proposal.advisorName}</Fact>
        </dl>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- skeleton */

/**
 * The placeholder for THIS screen, rather than the generic one.
 *
 * `<Screen>` falls back to `ScreenSkeleton`, whose four tiles carry a sparkline
 * these do not — 194px of KPI row against a real 152, which rode everything
 * below it 42px up the page — and whose two half-width panels are nothing like
 * the three stacked full-width ones here. Measured on a first visit through the
 * rail: 612px of placeholder swapped for 1546px of screen.
 *
 * Every block mirrors the real one, so only the contents of the boxes change:
 *
 *   .kpi-grid      four tiles, no spark     152px
 *   the panel      the stepper builder      612px
 *   the table      the proposal book        570px
 *   the panel      the review trail         164px
 *
 * `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a 16px
 * card inset, a 16px panel inset, a 14px head and the 12px gap under it — so
 * each `height` here is the real block MINUS 90.
 *
 * ONE ANNOUNCEMENT: the first KPI tile carries the screen's name and every
 * other shape is silent, because `md-skeleton` is a polite live region and a
 * screenful of them is a dozen announcements for one event.
 */
function ProposalsSkeleton({ label }: { label: string }) {
  return (
    <>
      {/* No `spark` — these tiles are a figure and a hint. Only the first has a
          chip in its foot (the total proposal count), so only it is 32px. */}
      <section className="kpi-grid">
        <KpiSkeleton announce label={label} spark={false} />
        <KpiSkeleton spark={false} foot="16px" />
        <KpiSkeleton spark={false} foot="16px" />
        <KpiSkeleton spark={false} foot="16px" />
      </section>

      {/* The builder. One block rather than four step outlines: `md-stepper`
          shows one step at a time and the panel is a single 516px surface. */}
      <PanelSkeleton height="522px" />

      {/* The book. `TableSkeleton` rather than `PanelSkeleton` because the real
          block is a `.table-host`, and `height` rather than a row count because
          the table carries a toolbar and a pagination bar as well as its five
          rows — `rows * 40` cannot reach 480. */}
      <TableSkeleton height="480px" />

      {/* The review trail, which opens with nothing picked: a heading and the
          empty state telling you to pick a row. */}
      <PanelSkeleton height="74px" />
    </>
  );
}
