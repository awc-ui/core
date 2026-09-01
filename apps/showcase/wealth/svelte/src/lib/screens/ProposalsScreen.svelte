<!--
  Screen 4 — advice documents moving through review.

  Three panels, in the order an advisor works in them:

    1. THE BUILDER — `md-stepper` driving a four-step advice document. It lives
       in `ProposalBuilder.svelte` / `ProposalForm.svelte`, which carry the
       reasoning for every control choice and for why the stepper is NOT inside
       a dialog.
    2. THE BOOK — every proposal the fixture holds, filtered through the kit's
       selector, sorted and paged here, in `md-table-container` wrapping
       `md-table` with the toolbar in `top` and the pagination in `bottom`
       (§7.1). Clicking a row picks it up in panel 3.
    3. THE TRAIL — the five stages that proposal has moved through, as a
       read-only `md-stepper` whose step states come from the kit's `stepState`
       map, never from a ternary here.

  WHERE THE SORTING LIVES, AND WHY IT IS HERE. Every other list selector takes
  a `sortBy` / `sortDir`; `ProposalFilter` does not, so the ordering cannot be
  pushed into the kit and two framework ports would have to agree by hand. It
  is isolated in `compareProposals` below and flagged in the hand-off notes.
  The FILTERING goes through `getProposals` exactly as the contract requires —
  no `.filter()` on a selector's result anywhere in this file.
-->
<script lang="ts">
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
  import { pathname } from '$lib/router';
  import { crumbsFor } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import ProposalBuilder from './ProposalBuilder.svelte';
  import { KpiSkeleton, PanelSkeleton, TableSkeleton } from '$lib/skeletons';

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
   * `localeCompare` is pinned to `'en'` on purpose — the same thing the kit's
   * own selectors do. An ambient locale would make the row order depend on the
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
   * The chip row, the delegated handler, `filtersActive` and the clear action
   * all derive from this, so a facet cannot be added to the row and forgotten
   * in the reset. Each `id` is also the chip's `data-facet`, which is how one
   * listener serves the whole set.
   *
   * WHY THESE FOUR. Each sits on a DIFFERENT axis — lifecycle, ownership, age,
   * size — and each splits a seven-row book into a useful subset: open 5,
   * mine 4, ageing 4, high value 3. A facet that matched six of seven, or one,
   * would be decoration. The obvious fifth candidate, a "needs review" status
   * group, is deliberately absent: it would compete with the Status select for
   * the same axis, and picking one status plus a conflicting group is a
   * guaranteed empty table that reads as a bug.
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

  const totals = getBookTotals();
  const everyProposal = getProposals();
  const open = getProposals({ open: true });
  // Pre-existing shape of the KPI row: the fixture has no book-level proposal
  // aggregate, so these three are summed here. Listed in the hand-off notes.
  const openValue = open.reduce((sum, proposal) => sum + proposal.estimatedValue, 0);
  const oldest = open.reduce((max, proposal) => Math.max(max, proposal.daysOpen), 0);

  /* --------------------------------------------------------- table state */

  let status: ProposalStatus | '' = '';
  let facets: FacetState = { ...NO_FACETS };
  let sortBy: SortKey | '' = '';
  let sortOrder: SortOrder = 'asc';
  let page = 0;
  let rowsPerPage = DEFAULT_ROWS_PER_PAGE;
  let selectedId = '';

  $: filtersActive = status !== '' || FACETS.some((facet) => facets[facet.id]);

  /*
   * FILTER through the selector, then order, then slice.
   *
   * `getProposals` returns a fresh array, so sorting it in place is safe and no
   * copy is needed. Its default order is the one the kit calls attention-first,
   * which is what an unsorted table should show — so `sortBy === ''` leaves it
   * exactly as the selector handed it over.
   */
  function orderBook(
    statusNow: ProposalStatus | '',
    facetsNow: FacetState,
    by: SortKey | '',
    order: SortOrder,
  ): Proposal[] {
    const filtered = getProposals({
      status: statusNow === '' ? undefined : statusNow,
      // Every facet is a FIELD ON THE FILTER, never a `.filter()` on the
      // result — the contract at the top of this file. The two that had no
      // field (`minDaysOpen`, `minEstimatedValue`) grew one in the kit rather
      // than being applied here; a threshold is the book's opinion, not a
      // view's, and both live beside the fixture that justifies them.
      open: facetsNow.open ? true : undefined,
      advisorId: facetsNow.mine ? getAdvisor().id : undefined,
      minDaysOpen: facetsNow.ageing ? PROPOSAL_AGEING_DAYS : undefined,
      minEstimatedValue: facetsNow.highValue ? PROPOSAL_HIGH_VALUE_EUR : undefined,
    });
    if (by === '' || order === 'none') return filtered;
    const direction = order === 'desc' ? -1 : 1;
    return filtered.sort((a, b) => direction * compareProposals(a, b, by));
  }

  $: rows = orderBook(status, facets, sortBy, sortOrder);

  $: offset = page * rowsPerPage;
  $: pageRows = rows.slice(offset, offset + rowsPerPage);

  $: selected = selectedId ? everyProposal.find((p) => p.id === selectedId) : undefined;

  /* -------------------------------------------------------- table events */

  /*
   * `md-table` sorts nothing by itself — `mdSortChange` is a REQUEST and the
   * rows are ours to reorder. The table has already cycled its own three-state
   * `sort-by` / `sort-order` and pushed them into every sort label by the time
   * this fires, so all that is left is to mirror them into state.
   *
   * The readme asks for a SYNCHRONOUS reorder so its FLIP animation has
   * something to measure. Svelte batches the reorder into the flush after this
   * handler returns, so the motion is a no-op here too; the sort itself is
   * unaffected, and this is the one place where the framework's model and the
   * component's differ — same as the React build.
   */
  function onSortChange(event: Event) {
    const detail = (event as CustomEvent<{ column: string; order: SortOrder }>).detail;
    const column = detail.column as SortKey | '';
    if (column === '' || detail.order === 'none' || !(column in SORTABLE)) {
      sortBy = '';
      sortOrder = 'asc';
    } else {
      sortBy = column;
      sortOrder = detail.order;
    }
    page = 0;
  }

  function onRowClick(event: Event) {
    selectedId = (event as CustomEvent<{ value: string }>).detail.value;
  }

  function onPageChange(event: Event) {
    page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  // The component resets `page` to 0 itself and emits both events in order, so
  // this handler must not reset it a second time.
  function onRowsPerPageChange(event: Event) {
    rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }

  /* ------------------------------------------------------ toolbar events */

  function onStatusChange(event: Event) {
    status = (event as CustomEvent<string>).detail as ProposalStatus | '';
    page = 0;
  }

  /*
   * ONE listener for the whole set, not one per chip.
   *
   * `mdSelect` bubbles and is composed, and a composed event retargets to the
   * shadow HOST — so `event.target` is the `md-chip` and its `data-facet` can
   * be read straight off it. The chip has already flipped its own `selected` by
   * the time this runs; all that is left is to mirror it into state. Same
   * delegation `HouseholdHoldings` uses for its chip row.
   */
  function onFacetSelect(event: Event) {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    facets = { ...facets, [id]: (event as CustomEvent<{ selected: boolean }>).detail.selected };
    page = 0;
  }

  function clearFilters() {
    if (!filtersActive) return;
    status = '';
    facets = { ...NO_FACETS };
    page = 0;
  }

  const layout = TABLES.proposals;
</script>

<Screen
  crumbs={crumbsFor($pathname)}
  title={$t('wealth.screen.proposals.title')}
  subtitle={$t('wealth.screen.proposals.subtitle', {
    open: totals.openProposalCount,
    total: totals.proposalCount,
  })}
>
  <svelte:fragment slot="actions">
    <!--
      One screen-level action, and it is a real one.

      §9.2's exact recommendation for a contextually-unavailable control:
      `soft-disabled` keeps it focusable and announced — so a keyboard user
      can find out WHY it is off — and the tooltip supplies the why.
      `disabled` would drop it out of the tab order and take the
      explanation with it. The tooltip wraps its trigger; it never points
      at one by id (§7.1).
    -->
    <md-tooltip
      text={filtersActive
        ? $t('wealth.proposal.filter.clearHint')
        : $t('wealth.proposal.filter.noneActive')}
      position="bottom"
    >
      <md-button
        variant="text"
        size="sm"
        icon="filter_alt_off"
        soft-disabled={!filtersActive || undefined}
        on:mdClick={clearFilters}
      >
        {$t('wealth.action.clearFilters')}
      </md-button>
    </md-tooltip>
  </svelte:fragment>

  <!--
    The placeholder for THIS screen, rather than the generic one.

    Every block mirrors the real one, so only the contents of the boxes change:

      .kpi-grid      four tiles, no spark     152px
      the panel      the stepper builder      612px
      the table      the proposal book        570px
      the panel      the review trail         164px

    `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a 16px
    card inset, a 16px panel inset, a 14px head and the 12px gap under it — so
    each `height` here is the real block MINUS 90.

    ONE ANNOUNCEMENT: the first KPI tile carries the screen's name and every
    other shape is silent, because a screenful of live regions is a dozen
    announcements for one event.
  -->
  <svelte:fragment slot="skeleton">
    <!-- No `spark` — these tiles are a figure and a hint. Only the first has a
         chip in its foot (the total proposal count), so only it is 32px. -->
    <section class="kpi-grid">
      <KpiSkeleton announce label={$t('wealth.screen.proposals.title')} spark={false} />
      <KpiSkeleton spark={false} foot="16px" />
      <KpiSkeleton spark={false} foot="16px" />
      <KpiSkeleton spark={false} foot="16px" />
    </section>

    <!-- The builder. One block rather than four step outlines: `md-stepper`
         shows one step at a time and the panel is a single 516px surface. -->
    <PanelSkeleton height="522px" />

    <!-- The book. `TableSkeleton` rather than `PanelSkeleton` because the real
         block is a `.table-host`, and `height` rather than a row count because
         the table carries a toolbar and a pagination bar as well as its five
         rows — `rows * 40` cannot reach 480. -->
    <TableSkeleton height="480px" />

    <!-- The review trail, which opens with nothing picked: a heading and the
         empty state telling you to pick a row. -->
    <PanelSkeleton height="74px" />
  </svelte:fragment>

  <section class="kpi-grid">
    <KpiTile
      label={$t('wealth.kpi.openProposals')}
      value={String(open.length)}
      hint={$t('wealth.kpi.proposals')}
    >
      <svelte:fragment slot="trailing"><Count value={everyProposal.length} /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('wealth.table.estimatedValue')} hint={$t('wealth.common.total')}>
      <svelte:fragment slot="value"><Money value={openValue} compact /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('wealth.table.daysOpen')} hint={$t('wealth.common.more', { count: open.length })}>
      <svelte:fragment slot="value"><Num value={oldest} /></svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.kpi.households')}
      value={String(new Set(open.map((proposal) => proposal.householdId)).size)}
      hint={$t('wealth.kpi.openProposals')}
    />
  </section>

  <ProposalBuilder />

  <Panel title={$t('wealth.proposal.table.title')} subtitle={$t('wealth.proposal.table.hint')}>
    <svelte:fragment slot="actions"><Count value={rows.length} /></svelte:fragment>
    <div class="table-host">
      <!--
        `md-table-container` WRAPS `md-table` — the toolbar goes in its
        `top` slot and the pagination in its `bottom` slot, both OUTSIDE
        the scroll region, and neither ever goes inside the table (§7.1).
        The container is also what arms the table's row motion for a page
        change, which is why the pagination is slotted here rather than
        placed beside the container.
      -->
      <md-table-container variant="outlined" max-height="60vh">
        <md-table-toolbar
          slot="top"
          headline={$t('wealth.proposal.table.title')}
          supporting-text={$t('wealth.proposal.table.hint')}
        >
          <md-select
            slot="actions"
            variant="outlined"
            density="-2"
            label={$t('wealth.proposal.filter.status')}
            value={status}
            placeholder={$t('wealth.proposal.filter.anyStatus')}
            clearable
            clear-label={$t('wealth.proposal.filter.anyStatus')}
            no-options-text={$t('wealth.empty.proposals')}
            on:mdChange={onStatusChange}
          >
            {#each STATUS_FILTERS as option (option)}
              <md-select-option value={option} label={$t(`wealth.proposalStatus.${option}`)}
              ></md-select-option>
            {/each}
          </md-select>
        </md-table-toolbar>

        <!--
          THE FACET SET IS A SECOND `top` CHILD, not one more thing in the
          toolbar's `actions` slot.

          `md-table-toolbar` is a single non-wrapping flex row, and its own
          CSS now carries the note about what that did to the ONE chip that
          used to live there: 95px of chip squeezed into 79, "Open only"
          rendered as "Open ...". Four would be worse. The container's
          `top` part is a flex COLUMN, so this stacks under the toolbar,
          stays outside the scroll viewport with it (the sticky header
          sticks below, so they never collide), and wraps on its own line
          when the panel is narrow.

          `role="group"` + `aria-label` is md-chip's own Filter-sets
          contract: four chips are a set, and a set needs a name. The chips
          stay non-removable so each host keeps `role="button"` +
          `aria-pressed` — a remove button would step the host down to its
          own nested `group` and lose the selection state a filter set is
          entirely about.
        -->
        <div
          slot="top"
          class="row facet-row"
          role="group"
          aria-label={$t('wealth.proposal.filter.group')}
          on:mdSelect={onFacetSelect}
        >
          {#each FACETS as facet (facet.id)}
            <md-chip
              data-facet={facet.id}
              variant="filter"
              appearance="outlined"
              label={$t(facet.labelKey)}
              selected={facets[facet.id] || undefined}
            ></md-chip>
          {/each}
        </div>

        <md-table
          column-template={layout.columns}
          min-width={layout.minWidth}
          label={$t('wealth.proposal.table.label')}
          sticky-header
          hoverable
          sort-by={sortBy}
          sort-order={sortOrder}
          empty={pageRows.length === 0 || undefined}
          row-offset={offset}
          row-count={rows.length}
          on:mdSortChange={onSortChange}
          on:mdRowClick={onRowClick}
        >
          <!-- `row-offset` / `row-count`: so assistive tech says "row 6 of 14"
               on page two rather than "row 1 of 5". -->
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{$t('wealth.table.id')}</md-table-cell>
              <md-table-cell head scope="col">
                <md-table-sort-label column="householdName">
                  {$t('wealth.table.household')}
                </md-table-sort-label>
              </md-table-cell>
              <md-table-cell head scope="col">{$t('wealth.table.type')}</md-table-cell>
              <md-table-cell head scope="col">{$t('wealth.table.status')}</md-table-cell>
              <md-table-cell head scope="col">{$t('wealth.table.progress')}</md-table-cell>
              <md-table-cell head scope="col" numeric>
                <md-table-sort-label column="estimatedValue" default-order="desc">
                  {$t('wealth.table.estimatedValue')}
                </md-table-sort-label>
              </md-table-cell>
              <md-table-cell head scope="col">
                <md-table-sort-label column="createdDate" default-order="desc">
                  {$t('wealth.table.created')}
                </md-table-sort-label>
              </md-table-cell>
              <md-table-cell head scope="col" numeric>
                <md-table-sort-label column="daysOpen" default-order="desc">
                  {$t('wealth.table.daysOpen')}
                </md-table-sort-label>
              </md-table-cell>
              <md-table-cell head scope="col">{$t('wealth.table.advisor')}</md-table-cell>
            </md-table-row>
          </md-table-head>

          <md-table-body>
            {#each pageRows as proposal (proposal.id)}
              <md-table-row
                value={proposal.id}
                clickable
                highlight={proposal.id === selectedId || undefined}
              >
                <md-table-cell>{proposal.id}</md-table-cell>
                <md-table-cell ellipsis>{proposal.householdName}</md-table-cell>
                <md-table-cell>
                  <Chips kind="proposalType" value={proposal.type} />
                </md-table-cell>
                <md-table-cell>
                  <Chips kind="proposalStatus" value={proposal.status} />
                </md-table-cell>
                <md-table-cell>
                  <!-- Two facts, no arithmetic: how many stages are done,
                       and the name of the one it is sitting in. -->
                  <span class="with-dot">
                    <span>
                      {$t('wealth.common.of', {
                        count: proposal.completedStepCount,
                        total: proposal.stepCount,
                      })}
                    </span>
                    <span class="muted">
                      {$t('wealth.proposal.currentStep', {
                        name: $t(proposal.steps[proposal.currentStepIndex].nameKey),
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
            {/each}
          </md-table-body>

          <div slot="empty">
            <EmptyState message={$t('wealth.empty.proposals')} hint={filtersActive} />
          </div>
        </md-table>

        <md-table-pagination
          slot="bottom"
          count={rows.length}
          {page}
          rows-per-page={rowsPerPage}
          rows-per-page-options={ROWS_PER_PAGE_OPTIONS}
          show-first-last
          label-rows-per-page={$t('wealth.table.rowsPerPage')}
          label-displayed-rows={$t('wealth.table.displayedRows')}
          label-first-page={$t('wealth.table.firstPage')}
          label-previous-page={$t('wealth.table.previousPage')}
          label-next-page={$t('wealth.table.nextPage')}
          label-last-page={$t('wealth.table.lastPage')}
          label-all={$t('wealth.table.all')}
          on:mdPageChange={onPageChange}
          on:mdRowsPerPageChange={onRowsPerPageChange}
        ></md-table-pagination>
      </md-table-container>
    </div>
  </Panel>

  <!--
    THE REVIEW TRAIL — one proposal's five stages, read-only.

    The fixture's `StepState` and `md-step`'s own four states are not the same
    four — a `current` stage is the component's `active` and a `blocked` one is
    its `error` — so the mapping goes through the kit's `stepState` and never
    through a ternary here.

    `{#key selected.id}` is what makes this a readout rather than a control.
    `active` is authored once per proposal; because the value only changes when
    the key does, Svelte never patches the attribute afterwards, so clicking a
    stage header moves the stepper's own highlight without the framework
    fighting it back. `auto-complete="false"` keeps the fixture's completion
    authoritative, and `nav="false"` removes the Back / Continue bar that would
    imply this is something you can drive. Both are STRING attributes on
    purpose: the props default to true, and Svelte omits a `false` boolean —
    an absent attribute would leave the defaults on.
  -->
  {#if !selected}
    <Panel title={$t('wealth.proposal.trail.title')} subtitle={$t('wealth.proposal.trail.hint')}>
      <EmptyState message={$t('wealth.proposal.trail.pick')} />
    </Panel>
  {:else}
    <Panel title={$t('wealth.proposal.trail.title')} subtitle={$t('wealth.proposal.trail.hint')}>
      <svelte:fragment slot="actions">
        <Chips kind="proposalStatus" value={selected.status} />
      </svelte:fragment>
      <div class="stack">
        <!-- `readonly` — this trail REPORTS where the proposal is; it does not
             move it. `nav="false"` alone only hid the Back / Continue bar and
             left every header a button, so the five stages invited a click that
             did nothing. `mode` is gone with it: a trail has no navigation, so
             there is no linear-vs-non-linear question left to answer. -->
        {#key selected.id}
          <md-stepper
            active={selected.currentStepIndex}
            nav="false"
            readonly
            auto-complete="false"
            label={$t('wealth.proposal.trail.label', { id: selected.id })}
            step-word={$t('wealth.proposal.stepper.step')}
            of-word={$t('wealth.proposal.stepper.of')}
            completed-word={$t('wealth.proposal.stepper.completed')}
            current-word={$t('wealth.proposal.stepper.current')}
            error-word={$t('wealth.proposal.stepper.error')}
            optional-word={$t('wealth.proposal.stepper.optional')}
          >
            {#each selected.steps as step (step.id)}
              {@const state = stepState[step.state]}
              <md-step
                label={$t(step.nameKey)}
                description={$t(step.stateKey)}
                completed={state === 'complete' || undefined}
                error={state === 'error' || undefined}
                error-text={state === 'error' ? $t(step.stateKey) : ''}
              ></md-step>
            {/each}
          </md-stepper>
        {/key}

        <dl class="dl">
          <Fact label={$t('wealth.table.id')}>{selected.id}</Fact>
          <Fact label={$t('wealth.table.household')}>{selected.householdName}</Fact>
          <Fact label={$t('wealth.table.type')}>
            <Chips kind="proposalType" value={selected.type} />
          </Fact>
          <Fact label={$t('wealth.table.estimatedValue')}>
            <Money value={selected.estimatedValue} />
          </Fact>
          <Fact label={$t('wealth.table.fee')}>
            <Money value={selected.estimatedFeeImpact} />
          </Fact>
          <Fact label={$t('wealth.table.created')}>
            <DateText value={selected.createdDate} />
          </Fact>
          <Fact label={$t('wealth.table.updated')}>
            <DateText value={selected.updatedDate} />
          </Fact>
          <Fact label={$t('wealth.table.daysOpen')}>
            <Num value={selected.daysOpen} />
          </Fact>
          <Fact label={$t('wealth.table.advisor')}>{selected.advisorName}</Fact>
        </dl>
      </div>
    </Panel>
  {/if}
</Screen>
