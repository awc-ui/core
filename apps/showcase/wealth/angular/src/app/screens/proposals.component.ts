import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
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
import { ShowcaseComponent } from '../lib/screen.base';
import { crumbsFor, type CrumbSpec } from '../lib/routes';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  FactComponent,
  KpiTileComponent,
  MoneyComponent,
  NumComponent,
} from '../components/bits.component';
import {
  KpiSkeletonComponent,
  PanelSkeletonComponent,
  TableSkeletonComponent,
} from '../components/skeletons.component';
import { ProposalBuilderComponent } from './proposal-builder.component';

/**
 * Screen 4 — advice documents moving through review. Ported from the React
 * build's `ProposalsScreen.tsx`.
 *
 * Three panels, in the order an advisor works in them:
 *
 *   1. THE BUILDER — `md-stepper` driving a four-step advice document. It
 *      lives in `proposal-builder.component.ts`, which carries the reasoning
 *      for every control choice and for why the stepper is NOT inside a
 *      dialog.
 *   2. THE BOOK — every proposal the fixture holds, filtered through the
 *      kit's selector, sorted and paged here, in `md-table-container` wrapping
 *      `md-table` with the toolbar in `top` and the pagination in `bottom`
 *      (§7.1). Clicking a row picks it up in panel 3.
 *   3. THE TRAIL — the five stages that proposal has moved through, as a
 *      read-only `md-stepper` whose step states come from the kit's
 *      `stepState` map, never from a ternary here.
 *
 * WHERE THE SORTING LIVES, AND WHY IT IS HERE. Every other list selector takes
 * a `sortBy` / `sortDir`; `ProposalFilter` does not, so the ordering cannot be
 * pushed into the kit and two framework ports would have to agree by hand. It
 * is isolated in `compareProposals` below and flagged in the hand-off notes.
 * The FILTERING goes through `getProposals` exactly as the contract requires —
 * no `.filter()` on a selector's result anywhere in this file.
 */

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
 * all derive from this, so a facet cannot be added to the row and forgotten in
 * the reset. Each `id` is also the chip's `data-facet`, which is how one
 * listener serves the whole set.
 *
 * WHY THESE FOUR. Each sits on a DIFFERENT axis — lifecycle, ownership, age,
 * size — and each splits a seven-row book into a useful subset. The obvious
 * fifth candidate, a "needs review" status group, is deliberately absent: it
 * would compete with the Status select for the same axis, and picking one
 * status plus a conflicting group is a guaranteed empty table that reads as a
 * bug.
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

/* ------------------------------------------------------------ review trail */

/**
 * One proposal's five stages, read-only.
 *
 * The fixture's `StepState` and `md-step`'s own four states are not the same
 * four — a `current` stage is the component's `active` and a `blocked` one is
 * its `error` — so the mapping goes through the kit's `stepState` and never
 * through a ternary here.
 *
 * THE STEPPER IS REMOUNTED PER PROPOSAL (the `@for` over `[proposal.id]` is
 * Angular's remount key): `active` is authored once per proposal, and because
 * the binding's value only changes when the view is recreated, Angular never
 * patches the attribute afterwards — so clicking a stage header moves the
 * stepper's own highlight without the framework fighting it back.
 * `auto-complete="false"` keeps the fixture's completion authoritative.
 *
 * `readonly` — this trail REPORTS where the proposal is; it does not move it.
 * `nav="false"` alone only hid the Back / Continue bar and left every header a
 * button, so the five stages invited a click that did nothing. `mode` is gone
 * with it: a trail has no navigation, so there is no linear-vs-non-linear
 * question left to answer.
 */
@Component({
  selector: 'awc-review-trail',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    DateTextComponent,
    FactComponent,
    MoneyComponent,
    NumComponent,
  ],
  template: `
    @if (proposal; as p) {
      <awc-panel
        [title]="t('wealth.proposal.trail.title')"
        [subtitle]="t('wealth.proposal.trail.hint')"
      >
        <md-chip awcChip actions kind="proposalStatus" [value]="p.status"></md-chip>

        <div class="stack">
          @for (id of [p.id]; track id) {
            <md-stepper
              [attr.active]="p.currentStepIndex"
              nav="false"
              readonly
              auto-complete="false"
              [attr.label]="t('wealth.proposal.trail.label', { id: p.id })"
              [attr.step-word]="t('wealth.proposal.stepper.step')"
              [attr.of-word]="t('wealth.proposal.stepper.of')"
              [attr.completed-word]="t('wealth.proposal.stepper.completed')"
              [attr.current-word]="t('wealth.proposal.stepper.current')"
              [attr.error-word]="t('wealth.proposal.stepper.error')"
              [attr.optional-word]="t('wealth.proposal.stepper.optional')"
            >
              @for (step of p.steps; track step.id) {
                <md-step
                  [attr.label]="t(step.nameKey)"
                  [attr.description]="t(step.stateKey)"
                  [attr.completed]="stepStates[step.state] === 'complete' ? '' : null"
                  [attr.error]="stepStates[step.state] === 'error' ? '' : null"
                  [attr.error-text]="stepStates[step.state] === 'error' ? t(step.stateKey) : ''"
                ></md-step>
              }
            </md-stepper>
          }

          <dl class="dl">
            <div awcFact [label]="t('wealth.table.id')">{{ p.id }}</div>
            <div awcFact [label]="t('wealth.table.household')">{{ p.householdName }}</div>
            <div awcFact [label]="t('wealth.table.type')">
              <md-chip awcChip kind="proposalType" [value]="p.type"></md-chip>
            </div>
            <div awcFact [label]="t('wealth.table.estimatedValue')">
              <span awcMoney [value]="p.estimatedValue"></span>
            </div>
            <div awcFact [label]="t('wealth.table.fee')">
              <span awcMoney [value]="p.estimatedFeeImpact"></span>
            </div>
            <div awcFact [label]="t('wealth.table.created')">
              <time awcDate [value]="p.createdDate"></time>
            </div>
            <div awcFact [label]="t('wealth.table.updated')">
              <time awcDate [value]="p.updatedDate"></time>
            </div>
            <div awcFact [label]="t('wealth.table.daysOpen')">
              <span awcNum [value]="p.daysOpen"></span>
            </div>
            <div awcFact [label]="t('wealth.table.advisor')">{{ p.advisorName }}</div>
          </dl>
        </div>
      </awc-panel>
    } @else {
      <awc-panel
        [title]="t('wealth.proposal.trail.title')"
        [subtitle]="t('wealth.proposal.trail.hint')"
      >
        <awc-empty-state [message]="t('wealth.proposal.trail.pick')" />
      </awc-panel>
    }
  `,
})
export class ReviewTrailComponent extends ShowcaseComponent {
  @Input() proposal?: Proposal;

  protected readonly stepStates = stepState;
}

/* ----------------------------------------------------------------- screen */

@Component({
  selector: 'awc-proposals-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    CountComponent,
    DateTextComponent,
    KpiTileComponent,
    MoneyComponent,
    NumComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    TableSkeletonComponent,
    ProposalBuilderComponent,
    ReviewTrailComponent,
  ],
  template: `
    <awc-screen
      [title]="t('wealth.screen.proposals.title')"
      [subtitle]="
        t('wealth.screen.proposals.subtitle', {
          open: totals.openProposalCount,
          total: totals.proposalCount
        })
      "
      [crumbs]="crumbs"
      [hasActions]="true"
      [customSkeleton]="true"
    >
      <!--
        One screen-level action, and it is a real one. §9.2's exact
        recommendation for a contextually-unavailable control: soft-disabled
        keeps it focusable and announced — so a keyboard user can find out WHY
        it is off — and the tooltip supplies the why. disabled would drop it
        out of the tab order and take the explanation with it. The tooltip
        wraps its trigger; it never points at one by id (§7.1).
      -->
      <md-tooltip
        actions
        [attr.text]="
          filtersActive
            ? t('wealth.proposal.filter.clearHint')
            : t('wealth.proposal.filter.noneActive')
        "
        position="bottom"
      >
        <md-button
          variant="text"
          size="sm"
          icon="filter_alt_off"
          [attr.soft-disabled]="!filtersActive ? '' : null"
          (mdClick)="clearFilters()"
        >
          {{ t('wealth.action.clearFilters') }}
        </md-button>
      </md-tooltip>

      <section class="kpi-grid">
        <awc-kpi-tile [label]="t('wealth.kpi.openProposals')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">{{ open.length }}</ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.proposals') }}</ng-container>
          <ng-container ngProjectAs="[trailing]">
            <md-chip awcCount [value]="everyProposal.length"></md-chip>
          </ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.table.estimatedValue')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcMoney [value]="openValue" [compact]="true"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.common.total') }}</ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.table.daysOpen')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcNum [value]="oldest"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">
            {{ t('wealth.common.more', { count: open.length }) }}
          </ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.kpi.households')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">{{ openHouseholds }}</ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.openProposals') }}</ng-container>
        </awc-kpi-tile>
      </section>

      <awc-proposal-builder />

      <awc-panel
        [title]="t('wealth.proposal.table.title')"
        [subtitle]="t('wealth.proposal.table.hint')"
      >
        <md-chip awcCount actions [value]="rows.length"></md-chip>

        <div class="table-host">
          <!--
            md-table-container WRAPS md-table — the toolbar goes in its top
            slot and the pagination in its bottom slot, both OUTSIDE the
            scroll region, and neither ever goes inside the table (§7.1). The
            container is also what arms the table's row motion for a page
            change, which is why the pagination is slotted here rather than
            placed beside the container.
          -->
          <md-table-container variant="outlined" max-height="60vh">
            <md-table-toolbar
              slot="top"
              [attr.headline]="t('wealth.proposal.table.title')"
              [attr.supporting-text]="t('wealth.proposal.table.hint')"
            >
              <md-select
                slot="actions"
                variant="outlined"
                density="-2"
                [attr.label]="t('wealth.proposal.filter.status')"
                [attr.value]="status"
                [attr.placeholder]="t('wealth.proposal.filter.anyStatus')"
                clearable
                [attr.clear-label]="t('wealth.proposal.filter.anyStatus')"
                [attr.no-options-text]="t('wealth.empty.proposals')"
                (mdChange)="onStatus($event)"
              >
                @for (option of statusFilters; track option) {
                  <md-select-option
                    [attr.value]="option"
                    [attr.label]="t('wealth.proposalStatus.' + option)"
                  ></md-select-option>
                }
              </md-select>
            </md-table-toolbar>

            <!--
              THE FACET SET IS A SECOND top CHILD, not one more thing in the
              toolbar's actions slot: md-table-toolbar is a single non-wrapping
              flex row, and four chips in there truncate (measured — see the
              React source). The container's top part is a flex COLUMN, so this
              stacks under the toolbar, stays outside the scroll viewport with
              it, and wraps on its own line when the panel is narrow.

              role="group" + aria-label is md-chip's own Filter-sets contract:
              four chips are a set, and a set needs a name. The chips stay
              non-removable so each host keeps role="button" + aria-pressed.

              ONE delegated listener for the whole set: mdSelect bubbles and is
              composed, and a composed event retargets to the shadow HOST — so
              event.target is the md-chip and its data-facet can be read
              straight off it. The chip has already flipped its own selected by
              the time this runs; all that is left is to mirror it into state.
            -->
            <div
              slot="top"
              class="row facet-row"
              role="group"
              [attr.aria-label]="t('wealth.proposal.filter.group')"
              (mdSelect)="onFacet($event)"
            >
              @for (facet of facetDefs; track facet.id) {
                <md-chip
                  [attr.data-facet]="facet.id"
                  variant="filter"
                  appearance="outlined"
                  [attr.label]="t(facet.labelKey)"
                  [attr.selected]="facets[facet.id] ? '' : null"
                ></md-chip>
              }
            </div>

            <md-table
              [attr.column-template]="layout.columns"
              [attr.min-width]="layout.minWidth"
              [attr.label]="t('wealth.proposal.table.label')"
              sticky-header
              hoverable
              [attr.sort-by]="sortBy"
              [attr.sort-order]="sortOrder"
              [attr.empty]="pageRows.length === 0 ? '' : null"
              [attr.row-offset]="offset"
              [attr.row-count]="rows.length"
              (mdSortChange)="onSort($event)"
              (mdRowClick)="onRowClick($event)"
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">{{ t('wealth.table.id') }}</md-table-cell>
                  <md-table-cell head scope="col">
                    <md-table-sort-label column="householdName">{{
                      t('wealth.table.household')
                    }}</md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">{{ t('wealth.table.type') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('wealth.table.status') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('wealth.table.progress') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    <md-table-sort-label column="estimatedValue" default-order="desc">{{
                      t('wealth.table.estimatedValue')
                    }}</md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">
                    <md-table-sort-label column="createdDate" default-order="desc">{{
                      t('wealth.table.created')
                    }}</md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    <md-table-sort-label column="daysOpen" default-order="desc">{{
                      t('wealth.table.daysOpen')
                    }}</md-table-sort-label>
                  </md-table-cell>
                  <md-table-cell head scope="col">{{ t('wealth.table.advisor') }}</md-table-cell>
                </md-table-row>
              </md-table-head>

              <md-table-body>
                @for (proposal of pageRows; track proposal.id) {
                  <md-table-row
                    [attr.value]="proposal.id"
                    clickable
                    [attr.highlight]="proposal.id === selectedId ? '' : null"
                  >
                    <md-table-cell>{{ proposal.id }}</md-table-cell>
                    <md-table-cell ellipsis>{{ proposal.householdName }}</md-table-cell>
                    <md-table-cell>
                      <md-chip awcChip kind="proposalType" [value]="proposal.type"></md-chip>
                    </md-table-cell>
                    <md-table-cell>
                      <md-chip awcChip kind="proposalStatus" [value]="proposal.status"></md-chip>
                    </md-table-cell>
                    <md-table-cell>
                      <!-- Two facts, no arithmetic: how many stages are done,
                           and the name of the one it is sitting in. -->
                      <span class="with-dot">
                        <span>
                          {{
                            t('wealth.common.of', {
                              count: proposal.completedStepCount,
                              total: proposal.stepCount
                            })
                          }}
                        </span>
                        <span class="muted">
                          {{
                            t('wealth.proposal.currentStep', {
                              name: t(proposal.steps[proposal.currentStepIndex].nameKey)
                            })
                          }}
                        </span>
                      </span>
                    </md-table-cell>
                    <md-table-cell numeric>
                      <span awcMoney [value]="proposal.estimatedValue"></span>
                    </md-table-cell>
                    <md-table-cell>
                      <time awcDate [value]="proposal.createdDate"></time>
                    </md-table-cell>
                    <md-table-cell numeric>
                      <span awcNum [value]="proposal.daysOpen"></span>
                    </md-table-cell>
                    <md-table-cell ellipsis>{{ proposal.advisorName }}</md-table-cell>
                  </md-table-row>
                }
              </md-table-body>

              @if (pageRows.length === 0) {
                <div slot="empty">
                  <awc-empty-state [message]="t('wealth.empty.proposals')" [hint]="filtersActive" />
                </div>
              }
            </md-table>

            <md-table-pagination
              slot="bottom"
              [attr.count]="rows.length"
              [attr.page]="page"
              [attr.rows-per-page]="rowsPerPage"
              [attr.rows-per-page-options]="rowsPerPageOptions"
              show-first-last
              [attr.label-rows-per-page]="t('wealth.table.rowsPerPage')"
              [attr.label-displayed-rows]="t('wealth.table.displayedRows')"
              [attr.label-first-page]="t('wealth.table.firstPage')"
              [attr.label-previous-page]="t('wealth.table.previousPage')"
              [attr.label-next-page]="t('wealth.table.nextPage')"
              [attr.label-last-page]="t('wealth.table.lastPage')"
              [attr.label-all]="t('wealth.table.all')"
              (mdPageChange)="onPageChange($event)"
              (mdRowsPerPageChange)="onRowsPerPageChange($event)"
            ></md-table-pagination>
          </md-table-container>
        </div>
      </awc-panel>

      <awc-review-trail [proposal]="selected" />

      <!--
        The placeholder for THIS screen, rather than the generic one, whose
        four sparkline tiles and two half-width panels are nothing like the
        three stacked full-width blocks here. Measured off the React
        reference: KPI row 152px, the builder panel 612px, the book table
        570px, the trail 164px — PanelSkeleton and TableSkeleton draw 90px of
        their own chrome, so each height is the real block minus 90. ONE
        announcement: the first KPI tile carries the screen's name.
      -->
      <ng-container ngProjectAs="[skeleton]">
        <!-- No spark — these tiles are a figure and a hint. Only the first
             has a chip in its foot (the total proposal count), so only it is
             32px. -->
        <section class="kpi-grid">
          <awc-kpi-skeleton
            [announce]="true"
            [label]="t('wealth.screen.proposals.title')"
            [spark]="false"
          />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
        </section>

        <!-- The builder. One block rather than four step outlines: md-stepper
             shows one step at a time and the panel is a single surface. -->
        <awc-panel-skeleton height="522px" />

        <!-- The book. TableSkeleton because the real block is a .table-host,
             and height rather than a row count because the table carries a
             toolbar and a pagination bar as well as its five rows. -->
        <awc-table-skeleton height="480px" />

        <!-- The review trail, which opens with nothing picked: a heading and
             the empty state telling you to pick a row. -->
        <awc-panel-skeleton height="74px" />
      </ng-container>
    </awc-screen>
  `,
})
export class ProposalsScreen extends ShowcaseComponent {
  protected readonly crumbs: CrumbSpec[] = crumbsFor(this.route.proposals());

  protected readonly totals = getBookTotals();
  protected readonly everyProposal = getProposals();
  protected readonly open = getProposals({ open: true });
  // Pre-existing shape of the KPI row: the fixture has no book-level proposal
  // aggregate, so these three are summed here. Listed in the hand-off notes.
  protected readonly openValue = this.open.reduce(
    (sum, proposal) => sum + proposal.estimatedValue,
    0,
  );
  protected readonly oldest = this.open.reduce((max, proposal) => Math.max(max, proposal.daysOpen), 0);
  protected readonly openHouseholds = new Set(
    this.open.map((proposal) => proposal.householdId),
  ).size;

  protected readonly layout = TABLES.proposals;
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly facetDefs = FACETS;
  protected readonly rowsPerPageOptions = ROWS_PER_PAGE_OPTIONS;

  /* ------------------------------------------------------- table state */

  protected status: ProposalStatus | '' = '';
  protected facets: FacetState = NO_FACETS;
  protected sortBy: SortKey | '' = '';
  protected sortOrder: SortOrder = 'asc';
  protected page = 0;
  protected rowsPerPage = DEFAULT_ROWS_PER_PAGE;
  protected selectedId = '';

  protected get filtersActive(): boolean {
    return this.status !== '' || FACETS.some((facet) => this.facets[facet.id]);
  }

  /*
   * FILTER through the selector, then order, then slice.
   *
   * Every facet is a FIELD ON THE FILTER, never a `.filter()` on the result.
   * The two that had no field (`minDaysOpen`, `minEstimatedValue`) grew one in
   * the kit rather than being applied here; a threshold is the book's opinion,
   * not a view's, and both live beside the fixture that justifies them.
   *
   * `getProposals` returns a fresh array, so sorting it in place is safe and
   * no copy is needed. Its default order is the one the kit calls
   * attention-first, which is what an unsorted table should show — so
   * `sortBy === ''` leaves it exactly as the selector handed it over. The
   * cache key is the exact equivalent of the React build's useMemo deps, and
   * a stable array is what keeps the `@for` from churning on unrelated
   * change-detection passes.
   */
  private rowsCache: { key: string; rows: Proposal[] } | null = null;

  protected get rows(): Proposal[] {
    const facetSig = FACETS.map((facet) => (this.facets[facet.id] ? '1' : '0')).join('');
    const key = `${this.status}|${facetSig}|${this.sortBy}|${this.sortOrder}`;
    let cache = this.rowsCache;
    if (!cache || cache.key !== key) {
      const filtered = getProposals({
        status: this.status === '' ? undefined : this.status,
        open: this.facets.open ? true : undefined,
        advisorId: this.facets.mine ? getAdvisor().id : undefined,
        minDaysOpen: this.facets.ageing ? PROPOSAL_AGEING_DAYS : undefined,
        minEstimatedValue: this.facets.highValue ? PROPOSAL_HIGH_VALUE_EUR : undefined,
      });
      const rows =
        this.sortBy === '' || this.sortOrder === 'none'
          ? filtered
          : filtered.sort(
              (a, b) =>
                (this.sortOrder === 'desc' ? -1 : 1) *
                compareProposals(a, b, this.sortBy as SortKey),
            );
      cache = { key, rows };
      this.rowsCache = cache;
    }
    return cache.rows;
  }

  protected get offset(): number {
    return this.page * this.rowsPerPage;
  }

  protected get pageRows(): Proposal[] {
    return this.rows.slice(this.offset, this.offset + this.rowsPerPage);
  }

  protected get selected(): Proposal | undefined {
    return this.selectedId
      ? this.everyProposal.find((proposal) => proposal.id === this.selectedId)
      : undefined;
  }

  /* -------------------------------------------------------- table events */

  /*
   * `md-table` sorts nothing by itself — `mdSortChange` is a REQUEST and the
   * rows are ours to reorder. The table has already cycled its own three-state
   * `sort-by` / `sort-order` and pushed them into every sort label by the time
   * this fires, so all that is left is to mirror them into state.
   */
  protected onSort(event: Event): void {
    const detail = (event as CustomEvent<{ column: string; order: SortOrder }>).detail;
    const column = detail.column as SortKey | '';
    if (column === '' || detail.order === 'none' || !(column in SORTABLE)) {
      this.sortBy = '';
      this.sortOrder = 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = detail.order;
    }
    this.page = 0;
  }

  protected onRowClick(event: Event): void {
    this.selectedId = (event as CustomEvent<{ value: string }>).detail.value;
  }

  protected onPageChange(event: Event): void {
    this.page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  // The component resets `page` to 0 itself and emits both events in order, so
  // this handler must not reset it a second time.
  protected onRowsPerPageChange(event: Event): void {
    this.rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }

  /* ------------------------------------------------------ toolbar events */

  protected onStatus(event: Event): void {
    this.status = ((event as CustomEvent<string>).detail ?? '') as ProposalStatus | '';
    this.page = 0;
  }

  protected onFacet(event: Event): void {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset['facet'] as FacetId | undefined;
    if (!id) return;
    const { selected } = (event as CustomEvent<{ selected: boolean }>).detail;
    this.facets = { ...this.facets, [id]: selected };
    this.page = 0;
  }

  protected clearFilters(): void {
    if (!this.filtersActive) return;
    this.status = '';
    this.facets = NO_FACETS;
    this.page = 0;
  }
}
