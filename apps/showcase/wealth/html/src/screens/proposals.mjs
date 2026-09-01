/**
 * Screen 4 — advice documents moving through review.
 *
 * Three panels, in the order an advisor works in them — the same three the
 * React build renders, and in its DOM shape:
 *
 *   1. THE BUILDER — `md-stepper` driving a four-step advice document, on the
 *      PAGE and not in a dialog: step 1 opens `md-date-picker` and
 *      `md-time-picker`, and each of those IS its own modal, so wrapping the
 *      stepper in a dialog would nest dialogs. The single `md-dialog` on this
 *      screen is the submit confirmation.
 *   2. THE BOOK — every proposal through the kit's selector, paged five to a
 *      page exactly like React; the other rows ride in a `<template>` so the
 *      live DOM holds the same five rows React's does.
 *   3. THE TRAIL — the picked proposal's five stages as a READ-ONLY
 *      `md-stepper` whose states come from the kit's `stepState` map. One trail
 *      per proposal waits in a `<template>`; the live panel starts as the
 *      empty state, which is what React renders before a row is clicked.
 *
 * WHAT IS STATIC AND WHAT IS BEHAVIOUR. The whole document — all four KPI
 * tiles, the complete builder form seeded with the first household's fixture
 * values, page one of the book, the pick-a-row trail — is written here at
 * build time in the page's language. Everything that MOVES is progressive
 * enhancement in `src/client/proposals-book.mjs` and
 * `src/client/proposal-builder.mjs`: filtering, sorting, paging, row → trail,
 * and the entire stepper flow (validation, veto, submit ladder, undo,
 * restart). The md-* form controls render nothing without the runtime anyway,
 * so unlike the tables nothing readable is lost by leaving their wiring to the
 * script.
 *
 * THE SEEDED STATE IS REACT'S SETTLED STATE. React's first render has empty
 * client/date fields; a mount effect immediately seeds them from the first
 * household. A static page has no "before the effect", so this build writes
 * the settled values directly — the same DOM a reader (and the parity census)
 * ever sees.
 *
 * KEY-REMOUNTS BECOME TEMPLATE SWAPS. React re-keys the client select, goal
 * select, date picker and weights grid per household so new defaults arrive as
 * INITIAL values, never as writes into a field the user owns. This build bakes
 * those four fragments (plus the strategy facts) per household into
 * `<template data-tpl-household>` elements; the client script swaps the live
 * fragment for a fresh clone — a brand-new element taking the value as its
 * initial value, which is precisely what a remount is.
 *
 * LOCAL ARITHMETIC, flagged exactly as the React file flags it: the three KPI
 * reduce() sums (the fixture has no book-level proposal aggregate) and
 * `draftMathsTotal` over the seeded weights. The client script carries the
 * live twin of the draft maths. Both are kit candidates, listed in the
 * hand-off notes; sorting the book lives in the client (`compareProposals`
 * there) because `ProposalFilter` has no `sortBy`.
 */

import {
  ASSET_CLASS_ORDER,
  crumbsFor,
  driftColor,
  getAdvisor,
  getAllocationFor,
  getBookTotals,
  getClientsFor,
  getGoalsFor,
  getHouseholds,
  getInstruments,
  getPortfolioFor,
  getPositionsFor,
  getProposals,
  PROPOSAL_AGEING_DAYS,
  PROPOSAL_HIGH_VALUE_EUR,
  REPORTING_DATE,
  route,
  stepState,
  TABLES,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html } from '../lib/html.mjs';
import {
  assetClassChip,
  count,
  dateText,
  fact,
  money,
  num,
  percent,
  proposalStatusChip,
  proposalTypeChip,
  ratioMeter,
  strategyChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

/* ------------------------------------------------------------ enumerations */

/*
 * The two domain enumerations this form offers as choices, in the React
 * build's rank order. The kit exports `ASSET_CLASS_ORDER` for the third
 * enumeration and nothing equivalent for these two — flagged there, so
 * flagged here.
 */
const PROPOSAL_TYPES = ['rebalance', 'new-mandate', 'cash-raise', 'tax-harvest', 'goal-funding'];
const INSTRUMENT_TYPES = ['equity', 'bond', 'fund', 'etf', 'alternative'];

const STATUS_FILTERS = ['draft', 'in-review', 'compliance', 'client-review', 'approved', 'rejected'];

/**
 * The facets, as data — the chip row and the row `data-*` attributes both
 * derive from this, so a facet cannot exist in the row and be unmatchable on
 * the rows. Each `id` is the chip's `data-facet` AND (kebab-cased) the row
 * attribute the client script matches, which is how one delegated listener
 * serves the whole set. The thresholds behind `ageing` and `highValue` are the
 * kit's — stamped onto the rows at build time so the client never re-derives a
 * threshold the book owns.
 */
const FACETS = [
  { id: 'open', labelKey: 'wealth.proposal.filter.openOnly' },
  { id: 'mine', labelKey: 'wealth.proposal.filter.mine' },
  { id: 'ageing', labelKey: 'wealth.proposal.filter.ageing' },
  { id: 'highValue', labelKey: 'wealth.proposal.filter.highValue' },
];

/* --------------------------------------------------------------- constants */

/** Horizon slider, in MONTHS — the unit `Goal.monthsRemaining` already uses. */
const HORIZON_MIN = 12;
const HORIZON_MAX = 240;
const HORIZON_STEP = 12;
/** A form default, not a fixture value: five years. */
const HORIZON_DEFAULT = 60;

const CONVICTION_MAX = 5;
const CODE_LENGTH = 6;

/** How many instruments the summary lists before it stops and counts the rest. */
const SUMMARY_LIST_LIMIT = 5;

/** Rows shown per page before the reader changes it. Matches the React build. */
const ROWS_PER_PAGE_OPTIONS = '5,10,25';
const DEFAULT_ROWS_PER_PAGE = 5;

/* ------------------------------------------------------------ picker labels */

/**
 * Every localizable prop of `md-date-picker`, resolved — the port of the React
 * build's `proposal-copy.ts` bundles. The picker ships an English default for
 * twenty-odd props; leaving any of them unset ships English into a translated
 * page. Bundling them keeps the call site readable and means the set cannot
 * rot out of sync between the two pickers.
 */
function datePickerLabels(t) {
  return {
    headline: t('wealth.proposal.date.headline'),
    'select-date-label': t('wealth.proposal.date.selectDate'),
    'enter-dates-label': t('wealth.proposal.date.enterDate'),
    'invalid-date-label': t('wealth.proposal.date.invalid'),
    'value-missing-label': t('wealth.proposal.date.missing'),
    'clear-label': t('wealth.proposal.date.clear'),
    'previous-month-label': t('wealth.proposal.date.previousMonth'),
    'next-month-label': t('wealth.proposal.date.nextMonth'),
    'previous-year-label': t('wealth.proposal.date.previousYear'),
    'next-year-label': t('wealth.proposal.date.nextYear'),
    'choose-month-label': t('wealth.proposal.date.chooseMonth'),
    'choose-year-label': t('wealth.proposal.date.chooseYear'),
    'choose-month-year-label': t('wealth.proposal.date.chooseMonthYear'),
    'choose-month-and-year-label': t('wealth.proposal.date.chooseMonthYear'),
    'open-calendar-label': t('wealth.proposal.date.openCalendar'),
    'close-calendar-label': t('wealth.proposal.date.closeCalendar'),
    'toggle-calendar-label': t('wealth.proposal.date.toggleCalendar'),
    'toggle-text-label': t('wealth.proposal.date.toggleText'),
    'year-grid-label': t('wealth.proposal.date.yearGrid'),
    'cancel-label': t('wealth.action.cancel'),
    'ok-label': t('wealth.proposal.ok'),
  };
}

/** The same for `md-time-picker`. `{min}` / `{max}` stay in the range messages. */
function timePickerLabels(t) {
  return {
    'headline-input-label': t('wealth.proposal.time.headlineInput'),
    'headline-dial-label': t('wealth.proposal.time.headlineDial'),
    'hour-label': t('wealth.proposal.time.hour'),
    'minute-label': t('wealth.proposal.time.minute'),
    'period-label': t('wealth.proposal.time.period'),
    'am-label': t('wealth.proposal.time.am'),
    'pm-label': t('wealth.proposal.time.pm'),
    'toggle-dial-label': t('wealth.proposal.time.toggleDial'),
    'toggle-input-label': t('wealth.proposal.time.toggleInput'),
    'value-missing-label': t('wealth.proposal.time.missing'),
    'range-underflow-label': t('wealth.proposal.time.underflow'),
    'range-overflow-label': t('wealth.proposal.time.overflow'),
    'range-outside-label': t('wealth.proposal.time.outside'),
    'cancel-label': t('wealth.action.cancel'),
    'ok-label': t('wealth.proposal.ok'),
  };
}

/* ------------------------------------------------------------- draft maths */

/** The mandate's own targets, as a full five-class record. */
function targetsFor(rows) {
  const seed = {};
  for (const cls of ASSET_CLASS_ORDER) seed[cls] = 0;
  for (const row of rows) seed[row.assetClass] = row.targetWeight;
  return seed;
}

/**
 * The build-time half of the React file's quarantined `draftMaths` — only the
 * total is needed here (to seed the meter); the live epsilon test belongs to
 * the client script, which carries the other half. Kit candidate, flagged.
 */
function draftMathsTotal(weights) {
  return ASSET_CLASS_ORDER.reduce((sum, cls) => sum + (weights[cls] || 0), 0);
}

/**
 * A `FieldNote`: the single supporting line under a control that has no
 * supporting line of its own — the hint, or (once the client script validates)
 * the error, never both. The base hint travels in `data-hint` so the script
 * can restore it after an error clears without re-translating anything.
 */
function fieldNote(hint, note) {
  return html`<p class="muted"${attrs({ 'data-note': note, 'data-hint': hint })}>${hint}</p>`;
}

/* ----------------------------------------------------------------- screen */

export function proposalsScreen(t, locale) {
  const path = route.proposals();

  const totals = getBookTotals();
  const everyProposal = getProposals();
  const open = getProposals({ open: true });
  // Pre-existing shape of the KPI row: the fixture has no book-level proposal
  // aggregate, so these three are summed here. Listed in the hand-off notes.
  const openValue = open.reduce((sum, proposal) => sum + proposal.estimatedValue, 0);
  const oldest = open.reduce((max, proposal) => Math.max(max, proposal.daysOpen), 0);

  const kpis = html`<section class="kpi-grid">
    ${kpiCard(t, {
      label: t('wealth.kpi.openProposals'),
      value: String(open.length),
      hint: t('wealth.kpi.proposals'),
      trailing: count(t, everyProposal.length),
    })}
    ${kpiCard(t, {
      label: t('wealth.table.estimatedValue'),
      value: money(t, openValue, { compact: true }),
      hint: t('wealth.common.total'),
    })}
    ${kpiCard(t, {
      label: t('wealth.table.daysOpen'),
      value: num(t, oldest),
      hint: t('wealth.common.more', { count: open.length }),
    })}
    ${kpiCard(t, {
      label: t('wealth.kpi.households'),
      value: String(new Set(open.map((proposal) => proposal.householdId)).size),
      hint: t('wealth.kpi.openProposals'),
    })}
  </section>`;

  const children = html`${kpis}

    ${builderPanel(t)}

    ${bookPanel(t, everyProposal)}

    ${trailPanel(t, everyProposal)}`;

  return screen(t, {
    locale,
    here: path,
    title: t('wealth.screen.proposals.title'),
    subtitle: t('wealth.screen.proposals.subtitle', {
      open: totals.openProposalCount,
      total: totals.proposalCount,
    }),
    crumbs: crumbsFor(path),
    actions: html`<md-tooltip${attrs({
      'data-book-clear-tooltip': true,
      text: t('wealth.proposal.filter.noneActive'),
      position: 'bottom',
    })}><md-button${attrs({
      'data-book-clear': true,
      variant: 'text',
      size: 'sm',
      icon: 'filter_alt_off',
      'soft-disabled': true,
    })}>${t('wealth.action.clearFilters')}</md-button></md-tooltip>`,
    children,
  });
}

/**
 * A KPI tile without a sparkline — the shape this screen's four tiles share.
 * `kpiTile` from bits handles the trend-less case already; this wrapper only
 * keeps the call sites as short as the React ones.
 */
function kpiCard(t, options) {
  return html`${kpiTileImport(t, options)}`;
}

// Re-exported through a local name so the four call sites above read like the
// React screen's <KpiTile>s.
import { kpiTile } from '../lib/bits.mjs';
const kpiTileImport = kpiTile;

/* ---------------------------------------------------------------- the book */

function bookPanel(t, everyProposal) {
  const advisor = getAdvisor();
  const layout = TABLES.proposals;

  const sortableHead = [
    { key: null, label: t('wealth.table.id') },
    { key: 'householdName', label: t('wealth.table.household') },
    { key: null, label: t('wealth.table.type') },
    { key: null, label: t('wealth.table.status') },
    { key: null, label: t('wealth.table.progress') },
    { key: 'estimatedValue', label: t('wealth.table.estimatedValue'), numeric: true, order: 'desc' },
    { key: 'createdDate', label: t('wealth.table.created'), order: 'desc' },
    { key: 'daysOpen', label: t('wealth.table.daysOpen'), numeric: true, order: 'desc' },
    { key: null, label: t('wealth.table.advisor') },
  ];

  /**
   * One row. The `data-*` attributes are what the client script filters and
   * sorts on — never the cell text, which is localised and compacted and would
   * make the same filter behave differently in each of the three languages.
   * The facet flags are stamped from the kit's own thresholds at build time.
   */
  const row = (proposal) => html`<md-table-row${attrs({
    value: proposal.id,
    clickable: true,
    'data-status': proposal.status,
    'data-open': proposal.open,
    'data-mine': proposal.advisorId === advisor.id,
    'data-ageing': proposal.daysOpen >= PROPOSAL_AGEING_DAYS,
    'data-high-value': proposal.estimatedValue >= PROPOSAL_HIGH_VALUE_EUR,
    'data-sort-householdname': proposal.householdName,
    'data-sort-estimatedvalue': proposal.estimatedValue,
    'data-sort-createddate': proposal.createdDate,
    'data-sort-daysopen': proposal.daysOpen,
  })}>
    <md-table-cell>${proposal.id}</md-table-cell>
    <md-table-cell ellipsis>${proposal.householdName}</md-table-cell>
    <md-table-cell>${proposalTypeChip(t, proposal.type)}</md-table-cell>
    <md-table-cell>${proposalStatusChip(t, proposal.status)}</md-table-cell>
    <md-table-cell>
      <!-- Two facts, no arithmetic: how many stages are done, and the name of
           the one it is sitting in. -->
      <span class="with-dot">
        <span>${t('wealth.common.of', {
          count: proposal.completedStepCount,
          total: proposal.stepCount,
        })}</span>
        <span class="muted">${t('wealth.proposal.currentStep', {
          name: t(proposal.steps[proposal.currentStepIndex].nameKey),
        })}</span>
      </span>
    </md-table-cell>
    <md-table-cell numeric>${money(t, proposal.estimatedValue)}</md-table-cell>
    <md-table-cell>${dateText(t, proposal.createdDate)}</md-table-cell>
    <md-table-cell numeric>${num(t, proposal.daysOpen)}</md-table-cell>
    <md-table-cell ellipsis>${proposal.advisorName}</md-table-cell>
  </md-table-row>`;

  return panel({
    title: t('wealth.proposal.table.title'),
    subtitle: t('wealth.proposal.table.hint'),
    actions: html`<md-chip${attrs({
      'data-book-count': true,
      variant: 'assist',
      appearance: 'outlined',
      color: 'primary',
      label: t.formatNumber(everyProposal.length, { maximumFractionDigits: 0 }),
    })}></md-chip>`,
    children: html`<div class="table-host">
      <!-- md-table-container WRAPS md-table — the toolbar goes in its top slot
           and the pagination in its bottom slot, both OUTSIDE the scroll
           region. The facet set is a SECOND top child, not one more thing in
           the toolbar's actions slot: the toolbar is a single non-wrapping
           flex row and four chips do not survive it; the container's top part
           is a flex column, so this stacks under the toolbar and wraps on its
           own line when the panel is narrow. -->
      <md-table-container variant="outlined" max-height="60vh">
        <md-table-toolbar${attrs({
          slot: 'top',
          headline: t('wealth.proposal.table.title'),
          'supporting-text': t('wealth.proposal.table.hint'),
        })}>
          <md-select${attrs({
            'data-book-status': true,
            slot: 'actions',
            variant: 'outlined',
            density: '-2',
            label: t('wealth.proposal.filter.status'),
            placeholder: t('wealth.proposal.filter.anyStatus'),
            clearable: true,
            'clear-label': t('wealth.proposal.filter.anyStatus'),
            'no-options-text': t('wealth.empty.proposals'),
          })}>
            ${STATUS_FILTERS.map(
              (option) => html`<md-select-option${attrs({
                value: option,
                label: t(`wealth.proposalStatus.${option}`),
              })}></md-select-option>`,
            )}
          </md-select>
        </md-table-toolbar>

        <div${attrs({
          slot: 'top',
          'data-book-facets': true,
          class: 'row facet-row',
          role: 'group',
          'aria-label': t('wealth.proposal.filter.group'),
        })}>
          ${FACETS.map(
            (facet) => html`<md-chip${attrs({
              'data-facet': facet.id,
              variant: 'filter',
              appearance: 'outlined',
              label: t(facet.labelKey),
            })}></md-chip>`,
          )}
        </div>

        <md-table${attrs({
          'data-book-table': true,
          'column-template': layout.columns,
          'min-width': layout.minWidth,
          label: t('wealth.proposal.table.label'),
          'sticky-header': true,
          hoverable: true,
          empty: 'false',
          // So assistive tech says "row 6 of 14" on page two rather than
          // "row 1 of 5".
          'row-offset': 0,
          'row-count': everyProposal.length,
        })}>
          <md-table-head>
            <md-table-row rowgroup="head">
              ${sortableHead.map(
                (column) => html`<md-table-cell head scope="col"${attrs({ numeric: column.numeric || undefined })}>${
                  column.key
                    ? html`<md-table-sort-label${attrs({
                        column: column.key,
                        'default-order': column.order,
                      })}>${column.label}</md-table-sort-label>`
                    : column.label
                }</md-table-cell>`,
              )}
            </md-table-row>
          </md-table-head>

          <md-table-body>${everyProposal.slice(0, DEFAULT_ROWS_PER_PAGE).map(row)}</md-table-body>

          <div slot="empty">${emptyState(t, t('wealth.empty.proposals'), {
            attributes: { 'data-book-empty': true },
          })}</div>
        </md-table>

        <md-table-pagination${attrs({
          slot: 'bottom',
          count: everyProposal.length,
          page: 0,
          'rows-per-page': DEFAULT_ROWS_PER_PAGE,
          'rows-per-page-options': ROWS_PER_PAGE_OPTIONS,
          'show-first-last': true,
          'label-rows-per-page': t('wealth.table.rowsPerPage'),
          'label-displayed-rows': t('wealth.table.displayedRows'),
          'label-first-page': t('wealth.table.firstPage'),
          'label-previous-page': t('wealth.table.previousPage'),
          'label-next-page': t('wealth.table.nextPage'),
          'label-last-page': t('wealth.table.lastPage'),
          'label-all': t('wealth.table.all'),
        })}></md-table-pagination>
      </md-table-container>
      <!-- The whole book, parked where the document tree cannot see it. A
           template's content is inert, so this page holds exactly the five
           live rows React's does while the client script has all seven to
           filter, sort and page through. -->
      <template data-book-rows>${everyProposal.map(row)}</template>
    </div>`,
  });
}

/* ------------------------------------------------------------ review trail */

/**
 * The live trail panel — React's no-selection branch — plus one `<template>`
 * per proposal holding the selected-variant panel. Clicking a row swaps the
 * live panel for a clone of the picked one (the `data-trail-panel` marker
 * travels with whatever is live, the scenario-selector idiom), so the document
 * always holds exactly ONE trail, which is what React renders.
 */
function trailPanel(t, proposals) {
  const empty = panel({
    title: t('wealth.proposal.trail.title'),
    subtitle: t('wealth.proposal.trail.hint'),
    attributes: { 'data-trail-panel': true, 'data-trail-id': '' },
    children: emptyState(t, t('wealth.proposal.trail.pick')),
  });

  const one = (proposal) => panel({
    title: t('wealth.proposal.trail.title'),
    subtitle: t('wealth.proposal.trail.hint'),
    actions: proposalStatusChip(t, proposal.status),
    attributes: { 'data-trail-id': proposal.id },
    children: html`<div class="stack">
      <!-- readonly — this trail REPORTS where the proposal is; it does not
           move it. nav="false" removes the Back / Continue bar, and the
           fixture's own StepState vocabulary maps onto md-step's through the
           kit's stepState, never a ternary here. -->
      <md-stepper${attrs({
        active: proposal.currentStepIndex,
        nav: 'false',
        readonly: true,
        'auto-complete': 'false',
        label: t('wealth.proposal.trail.label', { id: proposal.id }),
        'step-word': t('wealth.proposal.stepper.step'),
        'of-word': t('wealth.proposal.stepper.of'),
        'completed-word': t('wealth.proposal.stepper.completed'),
        'current-word': t('wealth.proposal.stepper.current'),
        'error-word': t('wealth.proposal.stepper.error'),
        'optional-word': t('wealth.proposal.stepper.optional'),
      })}>
        ${proposal.steps.map((step) => {
          const state = stepState[step.state];
          return html`<md-step${attrs({
            label: t(step.nameKey),
            description: t(step.stateKey),
            completed: state === 'complete',
            error: state === 'error',
            'error-text': state === 'error' ? t(step.stateKey) : undefined,
          })}></md-step>`;
        })}
      </md-stepper>

      <dl class="dl">
        ${fact(t('wealth.table.id'), proposal.id)}
        ${fact(t('wealth.table.household'), proposal.householdName)}
        ${fact(t('wealth.table.type'), proposalTypeChip(t, proposal.type))}
        ${fact(t('wealth.table.estimatedValue'), money(t, proposal.estimatedValue))}
        ${fact(t('wealth.table.fee'), money(t, proposal.estimatedFeeImpact))}
        ${fact(t('wealth.table.created'), dateText(t, proposal.createdDate))}
        ${fact(t('wealth.table.updated'), dateText(t, proposal.updatedDate))}
        ${fact(t('wealth.table.daysOpen'), num(t, proposal.daysOpen))}
        ${fact(t('wealth.table.advisor'), proposal.advisorName)}
      </dl>
    </div>`,
  });

  return html`${empty}
  ${proposals.map(
    (proposal) => html`<template${attrs({ 'data-trail': proposal.id })}>${one(proposal)}</template>`,
  )}`;
}

/* ------------------------------------------------------------- the builder */

function builderPanel(t) {
  const households = getHouseholds();
  const universe = getInstruments();
  const first = households[0];
  const firstClients = getClientsFor(first.id);
  const firstGoals = getGoalsFor(first.id);
  const firstAllocation = getAllocationFor(first.id);
  const firstTargets = targetsFor(firstAllocation);
  const firstPortfolio = getPortfolioFor(first.id);
  const firstChosen = firstPortfolio
    ? getPositionsFor(firstPortfolio.id).map((position) => position.instrumentId)
    : [];

  // The seeded eligibility: nothing excluded, ESG off, weights = the mandate's
  // targets — so an instrument is eligible iff its class carries any weight.
  const byId = new Map(universe.map((instrument) => [instrument.id, instrument]));
  const proposed = firstChosen.filter((id) => {
    const instrument = byId.get(id);
    return instrument !== undefined && (firstTargets[instrument.assetClass] || 0) > 0;
  });

  /**
   * What the client script cannot re-derive without bundling the fixture: the
   * transfer-list universe (labels and descriptions already in this page's
   * language, plus the three fields eligibility reads). Everything
   * per-household rides on the household templates instead.
   */
  const config = {
    household: first.id,
    /*
     * The instruments already held, which seed the transfer list's TARGET side.
     * `value` has no attribute form, so without this the control would open with
     * everything on the source side and the reader would have to re-add a
     * portfolio that already exists — and the element census would differ from
     * every other build by exactly the positions this household holds.
     */
    proposed,
    conviction: { max: CONVICTION_MAX },
    code: { length: CODE_LENGTH },
    horizon: { min: HORIZON_MIN, max: HORIZON_MAX, default: HORIZON_DEFAULT },
    summaryLimit: SUMMARY_LIST_LIMIT,
    instrumentTypes: INSTRUMENT_TYPES,
    items: universe.map((instrument) => ({
      value: instrument.id,
      label: instrument.name,
      description: t('wealth.proposal.instruments.meta', {
        ticker: instrument.ticker,
        assetClass: t(instrument.assetClassKey),
        currency: instrument.currency,
      }),
      type: instrument.type,
      sector: instrument.sector,
      assetClass: instrument.assetClass,
    })),
  };

  const stepperWords = {
    label: t('wealth.proposal.builder.label'),
    'step-word': t('wealth.proposal.stepper.step'),
    'of-word': t('wealth.proposal.stepper.of'),
    'completed-word': t('wealth.proposal.stepper.completed'),
    'current-word': t('wealth.proposal.stepper.current'),
    'error-word': t('wealth.proposal.stepper.error'),
    'optional-word': t('wealth.proposal.stepper.optional'),
    'next-label': t('wealth.action.next'),
    'back-label': t('wealth.action.back'),
    'finish-label': t('wealth.action.submit'),
  };

  return html`${panel({
    title: t('wealth.proposal.builder.title'),
    subtitle: t('wealth.proposal.builder.hint'),
    children: html`<md-stepper${attrs({
        'data-builder': true,
        'data-config': JSON.stringify(config),
        active: 0,
        mode: 'linear',
        ...stepperWords,
      })}>
        ${stepClient(t, { households, first, firstClients, firstGoals })}
        ${stepRisk(t, { first })}
        ${stepAllocation(t, { first, firstAllocation, firstTargets, firstPortfolio, proposedCount: proposed.length })}
        ${stepSign(t, {
          first,
          firstClients,
          firstTargets,
          firstPortfolio,
          proposed,
          byId,
        })}
      </md-stepper>

      ${householdTemplates(t, households)}
      ${submittedTemplate(t)}
      ${excludedTemplate(t)}
      ${instrumentTemplates(t, universe)}`,
  })}

  ${confirmDialog(t, { first, firstClients, proposedCount: proposed.length })}

  ${progressTemplate(t)}

  <md-snackbar${attrs({
    'data-builder-snackbar': true,
    class: 'wealth-snackbar',
    message: t('wealth.proposal.submitted'),
    action: t('wealth.proposal.undo'),
    position: 'bottom',
    'auto-hide-duration': 6000,
    'dismiss-label': t('wealth.action.close'),
  })}></md-snackbar>`;
}

/* ------------------------------------------------------------------ step 1 */

/** The four re-keyed fragments, rendered for one household. */
function clientSelect(t, household, clients) {
  return html`<md-select${attrs({
    'data-field': 'client',
    variant: 'outlined',
    name: 'clientId',
    label: t('wealth.proposal.field.client'),
    value: clients.length > 0 ? clients[0].id : '',
    'supporting-text': t('wealth.proposal.field.clientHint'),
    'value-missing-label': t('wealth.proposal.error.client'),
    'no-options-text': t('wealth.empty.clients'),
    'reserve-supporting-space': true,
    'full-width': true,
    required: true,
  })}>
    ${clients.map(
      (member) => html`<md-select-option${attrs({
        value: member.id,
        label: member.name,
        'supporting-text': t(member.roleKey),
      })}></md-select-option>`,
    )}
  </md-select>`;
}

function goalSelect(t, household, goals) {
  return html`<md-select${attrs({
    'data-field': 'goal',
    variant: 'outlined',
    name: 'goalId',
    label: t('wealth.proposal.field.objective'),
    'supporting-text': t('wealth.proposal.field.objectiveHint'),
    'clear-label': t('wealth.proposal.field.objectiveNone'),
    'no-options-text': t('wealth.empty.goals'),
    'reserve-supporting-space': true,
    clearable: true,
    'full-width': true,
  })}>
    ${goals.map(
      (goal) => html`<md-select-option${attrs({
        value: goal.id,
        label: t(goal.typeKey),
        'data-months': goal.monthsRemaining,
        'supporting-text': t('wealth.goal.monthsRemaining', { count: goal.monthsRemaining }),
      })}></md-select-option>`,
    )}
  </md-select>`;
}

function reviewDatePicker(t, household) {
  return html`<md-date-picker${attrs({
    'data-field': 'date',
    name: 'reviewDate',
    label: t('wealth.proposal.field.reviewDate'),
    value: household.nextReviewDate,
    min: REPORTING_DATE,
    locale: t.locale,
    'field-variant': 'outlined',
    'supporting-text': t('wealth.proposal.field.reviewDateHint'),
    'reserve-supporting-space': true,
    clearable: true,
    required: true,
    ...datePickerLabels(t),
  })}></md-date-picker>`;
}

function stepClient(t, { households, first, firstClients, firstGoals }) {
  return html`<md-step${attrs({
    label: t('wealth.proposal.step.client'),
    description: t('wealth.proposal.step.clientHint'),
    editable: true,
  })}>
    <div class="stack form-stack">
      <div class="grid-2">
        <!-- No value attribute at all: the field owns its text, exactly as the
             React build renders no value prop. -->
        <md-text-field${attrs({
          'data-field': 'title',
          variant: 'outlined',
          name: 'proposalTitle',
          label: t('wealth.proposal.field.title'),
          'supporting-text': t('wealth.proposal.field.titleHint'),
          'reserve-supporting-space': true,
          'max-length': 80,
          required: true,
        })}></md-text-field>

        <md-select${attrs({
          'data-field': 'household',
          variant: 'outlined',
          name: 'householdId',
          label: t('wealth.proposal.field.household'),
          value: first.id,
          'supporting-text': t('wealth.proposal.field.householdHint'),
          'value-missing-label': t('wealth.proposal.error.household'),
          'reserve-supporting-space': true,
          'full-width': true,
          required: true,
        })}>
          ${households.map(
            (option) => html`<md-select-option${attrs({
              value: option.id,
              label: option.name,
              'supporting-text': t(option.segmentKey),
            })}></md-select-option>`,
          )}
        </md-select>
      </div>

      <div class="grid-2">
        ${clientSelect(t, first, firstClients)}
        ${goalSelect(t, first, firstGoals)}
      </div>

      <!-- Five mutually exclusive options, all visible — md-radio, not a
           select. md-radio has no slot, so each one is wrapped in a native
           label, and the GROUP's name comes from the wrapper. One delegated
           listener serves the set: mdChange bubbles and is composed, and a
           composed event retargets to the shadow host carrying the value. -->
      <div${attrs({
        'data-field': 'type',
        role: 'radiogroup',
        'aria-labelledby': 'proposal-type-label',
        class: 'stack',
      })}>
        <p id="proposal-type-label" class="field-label">${t('wealth.proposal.field.type')}</p>
        <div class="row">
          ${PROPOSAL_TYPES.map(
            (option, index) => html`<label class="row" style="cursor: pointer">
              <md-radio${attrs({
                name: 'proposalType',
                value: option,
                checked: index === 0,
                required: true,
                'value-missing-label': t('wealth.proposal.error.step1'),
              })}></md-radio>
              <span>${t(`wealth.proposalType.${option}`)}</span>
            </label>`,
          )}
        </div>
      </div>

      <!-- A date picker and a time picker are a pair. Both are their own
           modal, which is exactly why the stepper is not inside one. -->
      <div class="grid-2">
        ${reviewDatePicker(t, first)}

        <md-time-picker${attrs({
          'data-field': 'time',
          name: 'reviewTime',
          label: t('wealth.proposal.field.reviewTime'),
          format: '24h',
          'minute-step': 15,
          min: '08:00',
          max: '19:00',
          'supporting-text': t('wealth.proposal.field.reviewTimeHint'),
          'reserve-supporting-space': true,
          responsive: true,
          required: true,
          ...timePickerLabels(t),
        })}></md-time-picker>
      </div>
    </div>
  </md-step>`;
}

/* ------------------------------------------------------------------ step 2 */

/** The strategy facts, per household — swapped with the other fragments. */
function riskFacts(t, household) {
  return html`<dl class="dl" data-part="riskfacts">
    ${fact(t('wealth.table.strategy'), strategyChip(t, household.strategy))}
    ${fact(t('wealth.table.riskProfile'), t(household.riskProfileKey))}
  </dl>`;
}

function stepRisk(t, { first }) {
  return html`<md-step${attrs({
    label: t('wealth.proposal.step.risk'),
    description: t('wealth.proposal.step.riskHint'),
    editable: true,
  })}>
    <!-- Two cards: what the money does (how long, what it may not hold) on the
         left, what the advisor thinks of it on the right — the React build's
         reading order, kept exactly. -->
    <div class="grid-2">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack form-stack">
          <div class="stack">
            <p class="field-label">${t('wealth.proposal.field.horizon')}</p>
            <md-slider${attrs({
              'data-field': 'horizon',
              name: 'horizonMonths',
              'aria-label': t('wealth.proposal.field.horizon'),
              min: HORIZON_MIN,
              max: HORIZON_MAX,
              step: HORIZON_STEP,
              value: HORIZON_DEFAULT,
              size: 'md',
              'value-indicator': true,
              'value-text': t('wealth.unit.months', { value: HORIZON_DEFAULT }),
            })}></md-slider>
            ${fieldNote(t('wealth.proposal.field.horizonHint'), 'horizon')}
          </div>

          <!-- Several of a few, all visible — checkboxes, not a multi-select.
               One delegated mdChange on the group; the composed event
               retargets to the checkbox host carrying the value. -->
          <div class="stack"${attrs({ 'data-field': 'constraints' })}>
            <p class="field-label">${t('wealth.proposal.field.constraints')}</p>
            ${INSTRUMENT_TYPES.map(
              (instrumentType) => html`<label class="row" style="cursor: pointer">
                <md-checkbox${attrs({ name: 'excludedTypes', value: instrumentType })}></md-checkbox>
                <span>${t(`wealth.instrumentType.${instrumentType}`)}</span>
              </label>`,
            )}
            ${fieldNote(t('wealth.proposal.field.constraintsHint'), 'constraints')}
          </div>
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack form-stack">
          <div class="stack">
            <p class="field-label">${t('wealth.proposal.field.conviction')}</p>
            <!-- A subjective score on a small scale — md-rating, away from a
                 slider. Its getLabel is a FUNCTION prop; the client script
                 assigns it, which is this build's useElementProps. -->
            <md-rating${attrs({
              'data-field': 'conviction',
              name: 'conviction',
              max: CONVICTION_MAX,
              precision: 1,
              size: 'lg',
              'show-value-label': true,
              'rating-label': t('wealth.proposal.field.conviction'),
            })}></md-rating>
            ${fieldNote(t('wealth.proposal.field.convictionHint'), 'conviction')}
          </div>

          <div class="stack">
            <p class="field-label">${t('wealth.proposal.field.esg')}</p>
            <!-- An immediate setting with no save step — a switch. It
                 re-screens the universe the moment it flips. -->
            <label class="row" style="cursor: pointer">
              <md-switch${attrs({ 'data-field': 'esg', name: 'esgScreening', icons: true })}></md-switch>
              <span>${t('wealth.proposal.field.esgHint')}</span>
            </label>

            ${riskFacts(t, first)}
          </div>
        </div>
      </md-card>
    </div>
  </md-step>`;
}

/* ------------------------------------------------------------------ step 3 */

/** One asset class's proposed weight — the React WeightField, as markup. */
function weightField(t, { assetClass, target, actual }) {
  return html`<div class="stack weight-field">
    ${assetClassChip(t, assetClass)}
    <!-- style: percent keeps the VALUE a fraction, the fixture's convention
         for every ratio, so 0.35 renders as 35% with no multiplication. -->
    <md-number-field${attrs({
      'data-class': assetClass,
      variant: 'outlined',
      name: `weight-${assetClass}`,
      label: t('wealth.proposal.field.weight'),
      value: target,
      min: 0,
      max: 1,
      step: 0.01,
      'small-step': 0.005,
      'large-step': 0.05,
      'snap-on-step': true,
      locale: t.locale,
      'format-options': '{"style":"percent","maximumFractionDigits":1}',
      'increment-label': t('wealth.proposal.field.weight'),
      'decrement-label': t('wealth.proposal.field.weight'),
    })}></md-number-field>
    <p class="muted">
      ${t('wealth.table.actual')} ${percent(t, actual, { digits: 1 })}
      · ${t('wealth.proposal.alloc.mandateTarget')} ${percent(t, target, { digits: 1 })}
    </p>
  </div>`;
}

function weightsGrid(t, household, allocation, targets) {
  return html`<div class="grid-3 weight-grid"${attrs({ 'data-field': 'weights' })}>
    ${ASSET_CLASS_ORDER.map((cls) =>
      weightField(t, {
        assetClass: cls,
        target: targets[cls],
        actual: allocation.find((row) => row.assetClass === cls)?.actualWeight ?? 0,
      }),
    )}
  </div>`;
}

function stepAllocation(t, { first, firstAllocation, firstTargets, firstPortfolio, proposedCount }) {
  const total = draftMathsTotal(firstTargets);

  return html`<md-step${attrs({
    label: t('wealth.proposal.step.allocation'),
    description: t('wealth.proposal.step.allocationHint'),
    editable: true,
  })}>
    <!-- Two cards STACKED, not side by side: full width fits all five weights
         on one line, the row a reader actually wants, and the total that
         judges them sits directly underneath. -->
    <div class="stack form-stack">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <p class="field-label">${t('wealth.proposal.alloc.title')}</p>
          <p class="muted">${t('wealth.proposal.alloc.hint')}</p>
          ${weightsGrid(t, first, firstAllocation, firstTargets)}
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <!-- A read-only value inside a known range — md-meter, nothing here
               is loading. driftColor is literally the right map: the distance
               from a balanced book IS a drift. The client script re-derives
               value, colour and value-text as the weights move. -->
          <span${attrs({ 'data-sum': 'alloc-total', style: 'display: contents' })}>${ratioMeter(t, {
            label: t('wealth.proposal.alloc.total'),
            fraction: total,
            color: driftColor(total - 1),
            max: 1,
          })}</span>
          ${fieldNote(t('wealth.proposal.alloc.zeroed'), 'weights')}
          <dl class="dl">
            ${fact(
              t('wealth.proposal.summary.instruments'),
              html`<md-chip${attrs({
                'data-sum': 'instrument-count',
                variant: 'assist',
                appearance: 'outlined',
                color: 'primary',
                label: t.formatNumber(proposedCount, { maximumFractionDigits: 0 }),
              })}></md-chip>`,
            )}
            ${fact(
              t('wealth.kpi.aum.short'),
              firstPortfolio
                ? html`<span${attrs({ 'data-sum': 'aum' })}>${money(t, firstPortfolio.marketValue, { compact: true })}</span>`
                : '—',
            )}
          </dl>
        </div>
      </md-card>

      <div class="stack">
        <p class="field-label">${t('wealth.proposal.instruments.title')}</p>
        <!-- items and value are JS properties (value has no attribute at all),
             so they arrive from the client script — this build's
             useElementProps. The four mover glyphs stay at their defaults
             because the stylesheet mirrors them under dir="rtl". -->
        <md-transfer-list${attrs({
          'data-field': 'transfer',
          'source-title': t('wealth.proposal.transfer.source'),
          'target-title': t('wealth.proposal.transfer.target'),
          'source-search-placeholder': t('wealth.proposal.transfer.searchSource'),
          'target-search-placeholder': t('wealth.proposal.transfer.searchTarget'),
          'count-template': t('wealth.proposal.transfer.count'),
          'empty-text': t('wealth.proposal.transfer.empty'),
          'empty-icon': 'inventory_2',
          'move-right-label': t('wealth.proposal.transfer.moveRight'),
          'move-left-label': t('wealth.proposal.transfer.moveLeft'),
          'move-all-right-label': t('wealth.proposal.transfer.moveAllRight'),
          'move-all-left-label': t('wealth.proposal.transfer.moveAllLeft'),
          density: '-1',
          'full-width': true,
          style: '--md-transfer-list-height: 360px',
        })}></md-transfer-list>
        ${fieldNote(t('wealth.proposal.instruments.hint'), 'instruments')}
      </div>
    </div>
  </md-step>`;
}

/* ------------------------------------------------------------------ step 4 */

function stepSign(t, { first, firstClients, firstTargets, firstPortfolio, proposed, byId }) {
  const clientName = firstClients.length > 0 ? firstClients[0].name : '';
  const instruments = proposed
    .map((id) => byId.get(id))
    .filter((instrument) => instrument !== undefined);

  return html`<md-step${attrs({
    label: t('wealth.proposal.step.sign'),
    description: t('wealth.proposal.step.signHint'),
  })}>
    <!-- Two cards: what is being signed on the left, what it holds on the
         right. The code stays at the foot of the summary card — it belongs to
         the thing it signs. -->
    <div class="grid-wide">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <p class="field-label">${t('wealth.proposal.summary.title')}</p>
          <p class="muted">${t('wealth.proposal.summary.hint')}</p>

          <dl class="dl">
            ${fact(t('wealth.proposal.field.title'), html`<span${attrs({ 'data-sum': 'title' })}>—</span>`)}
            ${fact(t('wealth.table.household'), html`<span${attrs({ 'data-sum': 'household' })}>${first.name}</span>`)}
            ${fact(t('wealth.proposal.field.client'), html`<span${attrs({ 'data-sum': 'client' })}>${clientName || '—'}</span>`)}
            ${fact(
              t('wealth.proposal.field.type'),
              html`<md-chip${attrs({
                'data-sum': 'type',
                variant: 'assist',
                appearance: 'outlined',
                color: 'secondary',
                label: t(`wealth.proposalType.${PROPOSAL_TYPES[0]}`),
              })}></md-chip>`,
            )}
            ${fact(t('wealth.proposal.field.objective'), html`<span${attrs({ 'data-sum': 'objective' })}>${t('wealth.common.none')}</span>`)}
            ${fact(t('wealth.proposal.summary.meeting'), html`<span${attrs({ 'data-sum': 'meeting' })}>${dateText(t, first.nextReviewDate)}</span>`)}
            ${fact(t('wealth.proposal.summary.horizon'), html`<span${attrs({ 'data-sum': 'horizon' })}>${t('wealth.unit.months', { value: HORIZON_DEFAULT })}</span>`)}
            ${fact(
              t('wealth.proposal.field.conviction'),
              html`<span${attrs({ 'data-sum': 'conviction' })}>${t('wealth.proposal.summary.conviction', { value: 0, max: CONVICTION_MAX })}</span>`,
            )}
            ${fact(t('wealth.proposal.field.esg'), html`<span${attrs({ 'data-sum': 'esg' })}>${t('wealth.proposal.summary.esgOff')}</span>`)}
            ${fact(
              t('wealth.proposal.summary.mandateValue'),
              html`<span${attrs({ 'data-sum': 'mandate-value' })}>${firstPortfolio ? money(t, firstPortfolio.marketValue) : '—'}</span>`,
            )}
          </dl>

          <div class="alloc-summary"${attrs({ 'data-sum-alloc': true })}>
            ${ASSET_CLASS_ORDER.filter((cls) => (firstTargets[cls] || 0) > 0).map(
              (cls) => html`<span${attrs({ 'data-alloc': cls })}>
                ${assetClassChip(t, cls)}
                <span${attrs({ 'data-alloc-pct': true })}>${percent(t, firstTargets[cls], { digits: 1 })}</span>
              </span>`,
            )}
          </div>

          <div class="sign-block">
            <!-- A one-time code goes in md-otp-field, never a row of text
                 fields. NO error attribute, deliberately: a partly-typed code
                 is not a mistake, so the message arrives as supporting text in
                 the line the hint already occupies. What actually enforces the
                 rule is next-disabled on the stepper. -->
            <md-otp-field${attrs({
              'data-field': 'otp',
              name: 'confirmationCode',
              length: CODE_LENGTH,
              'validation-type': 'numeric',
              'group-size': 3,
              label: t('wealth.proposal.field.code'),
              'supporting-text': t('wealth.proposal.field.codeHint'),
              'data-hint': t('wealth.proposal.field.codeHint'),
              'cell-label-template': t('wealth.proposal.field.codeCell'),
              'value-missing-label': t('wealth.proposal.error.code'),
              'incomplete-label': t('wealth.proposal.error.code'),
              'reserve-supporting-space': true,
              required: true,
            })}></md-otp-field>
          </div>
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <div class="row row--between">
            <p class="field-label">${t('wealth.proposal.summary.instruments')}</p>
            <md-chip${attrs({
              'data-sum': 'instrument-count',
              variant: 'assist',
              appearance: 'outlined',
              color: 'primary',
              label: t.formatNumber(proposed.length, { maximumFractionDigits: 0 }),
            })}></md-chip>
          </div>
          <!-- A vertical set of records, not a table. -->
          <md-list${attrs({ 'data-sum-instruments': true, 'aria-label': t('wealth.proposal.summary.instruments') })}>
            ${instruments.slice(0, SUMMARY_LIST_LIMIT).map(
              (instrument) => html`<md-list-item${attrs({
                lines: 2,
                headline: instrument.name,
                'supporting-text': t('wealth.proposal.instruments.meta', {
                  ticker: instrument.ticker,
                  assetClass: t(instrument.assetClassKey),
                  currency: instrument.currency,
                }),
              })}></md-list-item>`,
            )}
          </md-list>
          ${instruments.length > SUMMARY_LIST_LIMIT
            ? html`<p class="muted"${attrs({ 'data-sum-more': true })}>${t('wealth.common.more', {
                count: instruments.length - SUMMARY_LIST_LIMIT,
              })}</p>`
            : null}
        </div>
      </md-card>
    </div>
  </md-step>`;
}

/* ------------------------------------------------- templates and side pieces */

/**
 * The per-household re-keyed fragments. React re-keys these four controls (and
 * re-renders the strategy facts) when the household changes so new defaults
 * arrive as INITIAL values; the client script swaps in a clone from here,
 * which is the same thing: a fresh element that takes the value as its own.
 * The template also carries the household data the script cannot re-derive.
 */
function householdTemplates(t, households) {
  return html`${households.map((household) => {
    const clients = getClientsFor(household.id);
    const goals = getGoalsFor(household.id);
    const allocation = getAllocationFor(household.id);
    const targets = targetsFor(allocation);
    const portfolio = getPortfolioFor(household.id);
    const chosen = portfolio
      ? getPositionsFor(portfolio.id).map((position) => position.instrumentId)
      : [];

    return html`<template${attrs({
      'data-tpl-household': household.id,
      'data-name': household.name,
      'data-chosen': JSON.stringify(chosen),
      'data-portfolio-value': portfolio ? portfolio.marketValue : 0,
    })}>
      ${clientSelect(t, household, clients)}
      ${goalSelect(t, household, goals)}
      ${reviewDatePicker(t, household)}
      ${weightsGrid(t, household, allocation, targets)}
      ${riskFacts(t, household)}
    </template>`;
  })}`;
}

/** React's SubmittedNotice, waiting for the submit to finish. */
function submittedTemplate(t) {
  return html`<template data-tpl-submitted>
    <div class="stack">
      <div class="row">
        <md-chip${attrs({
          variant: 'assist',
          appearance: 'filled',
          color: 'success',
          icon: 'check',
          label: t('wealth.proposal.builder.done'),
        })}></md-chip>
        <span class="strong" data-notice-title></span>
      </div>
      <p class="muted">${t('wealth.proposal.builder.doneHint')}</p>
      <div class="row row--end">
        <md-button${attrs({ 'data-builder-restart': true, variant: 'tonal', icon: 'note_add' })}>${t('wealth.proposal.builder.restart')}</md-button>
      </div>
    </div>
  </template>`;
}

/**
 * The excluded-types row for the signing summary — absent from the live DOM
 * until something is excluded, exactly as React renders it, so it waits here
 * with all five chips; the script clones it and prunes to the excluded set.
 */
function excludedTemplate(t) {
  return html`<template data-tpl-excluded>
    <div class="row"${attrs({ 'data-sum-excluded': true })}>
      <span class="muted">${t('wealth.proposal.summary.excluded')}</span>
      ${INSTRUMENT_TYPES.map(
        (entry) => html`<md-chip${attrs({
          'data-type': entry,
          variant: 'assist',
          appearance: 'outlined',
          color: 'warning',
          icon: 'block',
          label: t(`wealth.instrumentType.${entry}`),
        })}></md-chip>`,
      )}
    </div>
  </template>`;
}

/**
 * One summary list item per instrument in the universe, pre-rendered in this
 * page's language so the script rebuilds the signing list by cloning rather
 * than by composing strings.
 */
function instrumentTemplates(t, universe) {
  return html`${universe.map(
    (instrument) => html`<template${attrs({ 'data-tpl-instrument': instrument.id })}>
      <md-list-item${attrs({
        lines: 2,
        headline: instrument.name,
        'supporting-text': t('wealth.proposal.instruments.meta', {
          ticker: instrument.ticker,
          assetClass: t(instrument.assetClassKey),
          currency: instrument.currency,
        }),
      })}></md-list-item>
    </template>`,
  )}`;
}

/**
 * THE ONLY DIALOG ON THIS SCREEN — the submit confirmation, closed in the
 * initial markup (a dialog never opens itself on load), opened by the
 * stepper's Finish. The determinate progress indicator is NOT here: React
 * mounts it only while submitting, so it waits in `progressTemplate`.
 */
function confirmDialog(t, { first, firstClients, proposedCount }) {
  return html`<md-dialog${attrs({
    'data-builder-dialog': true,
    headline: t('wealth.proposal.confirm.headline'),
    icon: 'fact_check',
    divider: true,
    'scrim-dismissible': true,
    locale: t.locale,
  })}>
    <p>${t('wealth.proposal.confirm.body')}</p>
    <dl class="dl">
      ${fact(t('wealth.proposal.field.title'), html`<span${attrs({ 'data-sum': 'title' })}>—</span>`)}
      ${fact(t('wealth.table.household'), html`<span${attrs({ 'data-sum': 'household' })}>${first.name}</span>`)}
      ${fact(
        t('wealth.proposal.field.type'),
        html`<md-chip${attrs({
          'data-sum': 'type',
          variant: 'assist',
          appearance: 'outlined',
          color: 'secondary',
          label: t(`wealth.proposalType.${PROPOSAL_TYPES[0]}`),
        })}></md-chip>`,
      )}
      ${fact(
        t('wealth.proposal.summary.instruments'),
        html`<md-chip${attrs({
          'data-sum': 'instrument-count',
          variant: 'assist',
          appearance: 'outlined',
          color: 'primary',
          label: t.formatNumber(proposedCount, { maximumFractionDigits: 0 }),
        })}></md-chip>`,
      )}
    </dl>

    <!-- M3 puts the dismissive action on the LEADING side. Neither slotted
         button closes the dialog on its own — that wiring is the script's. -->
    <md-button${attrs({ 'data-dialog-cancel': true, slot: 'actions', variant: 'text' })}>${t('wealth.action.cancel')}</md-button>
    <md-button${attrs({ 'data-dialog-send': true, slot: 'actions', variant: 'filled' })}>${t('wealth.proposal.confirm.submit')}</md-button>
  </md-dialog>`;
}

/** The submit bar React mounts mid-flow; `class`, not `className`, obviously. */
function progressTemplate(t) {
  return html`<template data-tpl-progress>
    <md-progress-indicator${attrs({
      class: 'submit-progress',
      variant: 'linear',
      value: 0,
      max: 100,
      wave: true,
      label: t('wealth.proposal.submitting'),
    })}></md-progress-indicator>
  </template>`;
}
