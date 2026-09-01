import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import {
  ASSET_CLASS_ORDER,
  driftColor,
  getAllocationFor,
  getClientsFor,
  getGoalsFor,
  getHouseholds,
  getInstruments,
  getPortfolioFor,
  getPositionsFor,
  REPORTING_DATE,
  type AllocationRow,
  type AssetClass,
  type Client,
  type Goal,
  type Household,
  type Instrument,
  type InstrumentType,
  type Portfolio,
  type ProposalType,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { PanelComponent } from '../components/panel.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  FactComponent,
  MoneyComponent,
  PercentComponent,
  RatioMeterComponent,
} from '../components/bits.component';
import { datePickerLabels, timePickerLabels } from './proposal-copy';

/**
 * The proposal builder — `md-stepper` driving a four-step advice document.
 * Ported from the React build's `ProposalBuilder.tsx`; its header carries the
 * full reasoning, summarised here where the port depends on it.
 *
 * THE COMPOSITION RULE THIS FILE EXISTS TO OBEY (§7.3). A multi-step flow is
 * `md-stepper` inside ONE `md-dialog` — at most. Here it is inside NONE: step 1
 * opens `md-date-picker` and `md-time-picker`, and each of those IS its own
 * modal, so the stepper lives on the page and the single `md-dialog` on this
 * screen is the submit confirmation.
 *
 * WHY EVERY CONTROL IS UNCONTROLLED. These components own their value and
 * treat a property write as a commit — `md-number-field` reformats the display
 * under the caret. So a field is authored with an INITIAL value, state is
 * updated from the component's own `md*` event, and nothing ever writes a
 * value back mid-edit. Where React re-keys a subtree to deliver new defaults
 * as initial values, this build wraps the same subtree in
 * `@for (x of [key]; track x)` — Angular destroys and recreates the embedded
 * view when the tracked value changes, which is the same remount with the
 * framework's own mechanism.
 *
 * VALIDATION IS REAL, and enforced where `md-stepper`'s readme says to enforce
 * it: `mdBeforeChange` is cancelable, an invalid step vetoes the forward move
 * (backward is always allowed), and Finish is the one declaratively gated
 * action (`next-disabled` on the WHOLE form, because `auto-complete` +
 * `mode="linear"` would otherwise let a passed-then-blanked step 1 walk
 * forward to a Finish that only ever looked at step 4).
 *
 * WHERE REACT NEEDS A COMPONENT PER STEP (hook-count rules), this build does
 * not: Angular's event bindings are template syntax, so all four `md-step`s
 * are written inline and stay DIRECT children of `md-stepper` — which is the
 * only thing the stepper cares about (§7.1).
 *
 * ARITHMETIC. Rule zero says arithmetic belongs in the kit. What survives here
 * is quarantined in `draftMaths`, because it is about a DRAFT the fixture does
 * not contain and there is nothing in `derive.ts` to call. It is listed in the
 * hand-off notes as a kit candidate, together with the two enum rank records.
 */

/* ------------------------------------------------------------ enumerations */

/*
 * The two domain enumerations this form offers as choices.
 *
 * `Record<Union, number>` rather than an array so TypeScript demands every
 * member: adding a proposal type to the kit fails the build here instead of
 * silently dropping a radio. The kit exports `ASSET_CLASS_ORDER` for the third
 * enumeration and nothing equivalent for these two — see the hand-off notes.
 */
const PROPOSAL_TYPE_RANK: Record<ProposalType, number> = {
  rebalance: 0,
  'new-mandate': 1,
  'cash-raise': 2,
  'tax-harvest': 3,
  'goal-funding': 4,
};

const INSTRUMENT_TYPE_RANK: Record<InstrumentType, number> = {
  equity: 0,
  bond: 1,
  fund: 2,
  etf: 3,
  alternative: 4,
};

const PROPOSAL_TYPES = Object.keys(PROPOSAL_TYPE_RANK) as ProposalType[];
const INSTRUMENT_TYPES = Object.keys(INSTRUMENT_TYPE_RANK) as InstrumentType[];

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

/** Step indices, named so the rule table below reads as prose. */
const STEP_CLIENT = 0;
const STEP_RISK = 1;
const STEP_ALLOCATION = 2;
const STEP_SIGN = 3;
const LAST_STEP = STEP_SIGN;

const STEP_MESSAGE = [
  'wealth.proposal.error.step1',
  'wealth.proposal.error.step2',
  'wealth.proposal.error.step3',
  'wealth.proposal.error.step4',
];

/** The fixed ladder the fake submit climbs. No clock, no randomness. */
const SUBMIT_TICK = 20;
const SUBMIT_INTERVAL_MS = 160;
const SUBMIT_SETTLE_MS = 200;

/* ------------------------------------------------------------- draft maths */

/**
 * The arithmetic this screen cannot push into the kit.
 *
 * Every figure the fixture carries is derived in `derive.ts`; these are about a
 * DRAFT that does not exist there, so there is nothing to call. Collected in
 * one object rather than scattered through the template so that the day the
 * kit grows an allocation-draft helper there is exactly one place to delete.
 *
 * `balanced` needs a tolerance because five fractions summed in binary floating
 * point miss 1 by about 1e-16. The tolerance is a twentieth of the smallest
 * step the field offers, so it can never accept a total the user typed wrong.
 */
const WEIGHT_EPSILON = 0.0005;

const draftMaths = {
  total(weights: Record<AssetClass, number>): number {
    return ASSET_CLASS_ORDER.reduce((sum, cls) => sum + (weights[cls] || 0), 0);
  },
  /** Signed distance from a balanced book — exactly what `driftColor` reads. */
  imbalance(weights: Record<AssetClass, number>): number {
    return draftMaths.total(weights) - 1;
  },
  balanced(weights: Record<AssetClass, number>): boolean {
    return Math.abs(draftMaths.imbalance(weights)) <= WEIGHT_EPSILON;
  },
};

/** The mandate's own targets, as a full five-class record. */
function targetsFor(rows: AllocationRow[]): Record<AssetClass, number> {
  const seed = {} as Record<AssetClass, number>;
  for (const cls of ASSET_CLASS_ORDER) seed[cls] = 0;
  for (const row of rows) seed[row.assetClass] = row.targetWeight;
  return seed;
}

/* ------------------------------------------------------------ field errors */

interface Failure {
  step: number;
  field: string;
  key: string;
}

interface TransferItem {
  value: string;
  label: string;
  description: string;
  disabled: boolean;
}

/** The snackbar / menu methods used here. */
type SnackbarElement = HTMLElement & {
  show?: () => void;
  hide?: (reason: string) => void;
};

/* ---------------------------------------------------------------- the form */

/**
 * The form itself. Everything below `awc-proposal-builder`'s remount `@for`,
 * so "start another proposal" destroys this component — and with it every
 * uncontrolled custom element's own value. There is no reset routine to keep
 * in sync with the field list, which is the point.
 *
 * FIELD-ERROR RENDERING. `md-text-field`, `md-select`, `md-number-field`,
 * `md-otp-field`, `md-date-picker` and `md-time-picker` carry
 * `error` + `error-text` and are used that way. `md-slider`, `md-rating`,
 * `md-switch`, `md-transfer-list` and a group of `md-checkbox`es have no such
 * prop, so those messages render as the single supporting line under the
 * control — the hint, or the error, NEVER both, exactly as `md-text-field`
 * treats its own pair, so nothing moves when a message appears. The colour is
 * the `error` ROLE via `.field-error`, not a borrowed P/L class.
 */
@Component({
  selector: 'awc-proposal-form',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    PanelComponent,
    ChipComponent,
    CountComponent,
    DateTextComponent,
    FactComponent,
    MoneyComponent,
    PercentComponent,
    RatioMeterComponent,
  ],
  template: `
    <awc-panel
      [title]="t('wealth.proposal.builder.title')"
      [subtitle]="t('wealth.proposal.builder.hint')"
    >
      @if (submitted) {
        <div class="stack">
          <div class="row">
            <md-chip
              variant="assist"
              appearance="filled"
              color="success"
              icon="check"
              [attr.label]="t('wealth.proposal.builder.done')"
            ></md-chip>
            <span class="strong">{{ title }}</span>
          </div>
          <p class="muted">{{ t('wealth.proposal.builder.doneHint') }}</p>
          <div class="row row--end">
            <md-button variant="tonal" icon="note_add" (mdClick)="restart.emit()">
              {{ t('wealth.proposal.builder.restart') }}
            </md-button>
          </div>
        </div>
      } @else {
        <!--
          next-disabled gates ONLY the built-in Continue / Finish. On the first
          three steps it is deliberately off: a disabled Continue cannot be
          pressed, so the user never finds out why. Vetoing mdBeforeChange
          instead lets the press land, paints the step red and names the
          failing fields. The last step is the exception — M3 disables a
          confirming action until the choice is made, and the OTP field beneath
          it says what is missing.
        -->
        <md-stepper
          [attr.active]="active"
          mode="linear"
          [attr.next-disabled]="active === lastStep && !formValid ? '' : null"
          [attr.loading]="submitting ? '' : null"
          [attr.label]="t('wealth.proposal.builder.label')"
          [attr.step-word]="t('wealth.proposal.stepper.step')"
          [attr.of-word]="t('wealth.proposal.stepper.of')"
          [attr.completed-word]="t('wealth.proposal.stepper.completed')"
          [attr.current-word]="t('wealth.proposal.stepper.current')"
          [attr.error-word]="t('wealth.proposal.stepper.error')"
          [attr.optional-word]="t('wealth.proposal.stepper.optional')"
          [attr.next-label]="t('wealth.action.next')"
          [attr.back-label]="t('wealth.action.back')"
          [attr.finish-label]="t('wealth.action.submit')"
          (mdBeforeChange)="onBeforeChange($event)"
          (mdStepChange)="onStepChange($event)"
          (mdComplete)="onComplete()"
        >
          <!-- ------------------------------------------------------ step 1 -->
          <md-step
            [attr.label]="t('wealth.proposal.step.client')"
            [attr.description]="t('wealth.proposal.step.clientHint')"
            editable
            [attr.error]="stepError(0) ? '' : null"
            [attr.error-text]="stepError(0) ? t(stepMessage[0]) : ''"
          >
            <div class="stack form-stack">
              <div class="grid-2">
                <!-- No value binding at all: the field owns its text, and
                     writing state back into it on every change-detection pass
                     would reformat under the caret. -->
                <md-text-field
                  variant="outlined"
                  name="proposalTitle"
                  [attr.label]="t('wealth.proposal.field.title')"
                  [attr.supporting-text]="t('wealth.proposal.field.titleHint')"
                  [attr.error]="err(0, 'title') ? '' : null"
                  [attr.error-text]="err(0, 'title')"
                  reserve-supporting-space
                  max-length="80"
                  required
                  (mdInput)="onTitle($event)"
                ></md-text-field>

                <md-select
                  variant="outlined"
                  name="householdId"
                  [attr.label]="t('wealth.proposal.field.household')"
                  [attr.value]="householdId"
                  [attr.supporting-text]="t('wealth.proposal.field.householdHint')"
                  [attr.error]="err(0, 'household') ? '' : null"
                  [attr.error-text]="err(0, 'household')"
                  [attr.value-missing-label]="t('wealth.proposal.error.household')"
                  reserve-supporting-space
                  full-width
                  required
                  (mdChange)="onHousehold($event)"
                >
                  @for (option of households; track option.id) {
                    <md-select-option
                      [attr.value]="option.id"
                      [attr.label]="option.name"
                      [attr.supporting-text]="t(option.segmentKey)"
                    ></md-select-option>
                  }
                </md-select>
              </div>

              <div class="grid-2">
                <!-- Remounted with the household (the @for's track key): the
                     option list AND the default signer both move, and the
                     remount is what lets the new default reach the element as
                     an initial value rather than as a write. -->
                @for (hid of [householdId]; track hid) {
                  <md-select
                    variant="outlined"
                    name="clientId"
                    [attr.label]="t('wealth.proposal.field.client')"
                    [attr.value]="clientId"
                    [attr.supporting-text]="t('wealth.proposal.field.clientHint')"
                    [attr.error]="err(0, 'client') ? '' : null"
                    [attr.error-text]="err(0, 'client')"
                    [attr.value-missing-label]="t('wealth.proposal.error.client')"
                    [attr.no-options-text]="t('wealth.empty.clients')"
                    reserve-supporting-space
                    full-width
                    required
                    (mdChange)="onClient($event)"
                  >
                    @for (member of clients; track member.id) {
                      <md-select-option
                        [attr.value]="member.id"
                        [attr.label]="member.name"
                        [attr.supporting-text]="t(member.roleKey)"
                      ></md-select-option>
                    }
                  </md-select>

                  <md-select
                    variant="outlined"
                    name="goalId"
                    [attr.label]="t('wealth.proposal.field.objective')"
                    [attr.value]="goalId"
                    [attr.supporting-text]="t('wealth.proposal.field.objectiveHint')"
                    [attr.clear-label]="t('wealth.proposal.field.objectiveNone')"
                    [attr.no-options-text]="t('wealth.empty.goals')"
                    reserve-supporting-space
                    clearable
                    full-width
                    (mdChange)="onGoal($event)"
                  >
                    @for (goal of goals; track goal.id) {
                      <md-select-option
                        [attr.value]="goal.id"
                        [attr.label]="t(goal.typeKey)"
                        [attr.supporting-text]="
                          t('wealth.goal.monthsRemaining', { count: goal.monthsRemaining })
                        "
                      ></md-select-option>
                    }
                  </md-select>
                }
              </div>

              <!--
                Five mutually exclusive options, all visible — §5.3 puts that
                on md-radio, not on a select. md-radio has no slot, so each one
                is wrapped in a native label (which names it and enlarges the
                hit target), and the GROUP's name comes from a wrapper, because
                the component cannot supply it. One delegated listener is
                enough: the radios' mdChange bubbles and is composed.
              -->
              <div
                role="radiogroup"
                aria-labelledby="proposal-type-label"
                class="stack"
                (mdChange)="onTypeChange($event)"
              >
                <p id="proposal-type-label" class="field-label">
                  {{ t('wealth.proposal.field.type') }}
                </p>
                <div class="row">
                  @for (option of proposalTypes; track option) {
                    <label class="row" style="cursor: pointer">
                      <md-radio
                        name="proposalType"
                        [attr.value]="option"
                        [attr.checked]="option === type ? '' : null"
                        required
                        [attr.value-missing-label]="t('wealth.proposal.error.step1')"
                      ></md-radio>
                      <span>{{ t('wealth.proposalType.' + option) }}</span>
                    </label>
                  }
                </div>
              </div>

              <!-- §7.2: a date picker and a time picker are a pair. Both are
                   their own modal, which is exactly why the stepper is not
                   inside one. The date picker is remounted with the household
                   (the mandate's real next review date is its default); the
                   time picker is not — the fixture has no meeting time, and an
                   invented default would let the advisor skip a decision the
                   flow says is required. -->
              <div class="grid-2">
                @for (hid of [householdId]; track hid) {
                  <md-date-picker
                    name="reviewDate"
                    [attr.label]="t('wealth.proposal.field.reviewDate')"
                    [attr.value]="reviewDate"
                    [attr.min]="reportingDate"
                    [attr.locale]="t.locale"
                    field-variant="outlined"
                    [attr.supporting-text]="t('wealth.proposal.field.reviewDateHint')"
                    [attr.error]="err(0, 'date') ? '' : null"
                    [attr.error-text]="err(0, 'date')"
                    reserve-supporting-space
                    clearable
                    required
                    [attr.headline]="dateLabels['headline']"
                    [attr.select-date-label]="dateLabels['select-date-label']"
                    [attr.enter-dates-label]="dateLabels['enter-dates-label']"
                    [attr.invalid-date-label]="dateLabels['invalid-date-label']"
                    [attr.value-missing-label]="dateLabels['value-missing-label']"
                    [attr.clear-label]="dateLabels['clear-label']"
                    [attr.previous-month-label]="dateLabels['previous-month-label']"
                    [attr.next-month-label]="dateLabels['next-month-label']"
                    [attr.previous-year-label]="dateLabels['previous-year-label']"
                    [attr.next-year-label]="dateLabels['next-year-label']"
                    [attr.choose-month-label]="dateLabels['choose-month-label']"
                    [attr.choose-year-label]="dateLabels['choose-year-label']"
                    [attr.choose-month-year-label]="dateLabels['choose-month-year-label']"
                    [attr.choose-month-and-year-label]="dateLabels['choose-month-and-year-label']"
                    [attr.open-calendar-label]="dateLabels['open-calendar-label']"
                    [attr.close-calendar-label]="dateLabels['close-calendar-label']"
                    [attr.toggle-calendar-label]="dateLabels['toggle-calendar-label']"
                    [attr.toggle-text-label]="dateLabels['toggle-text-label']"
                    [attr.year-grid-label]="dateLabels['year-grid-label']"
                    [attr.cancel-label]="dateLabels['cancel-label']"
                    [attr.ok-label]="dateLabels['ok-label']"
                    (mdChange)="onDate($event)"
                  ></md-date-picker>
                }

                <!-- Its own error / error-text / reserve-supporting-space, the
                     same three the date picker beside it uses, so a message
                     replaces the hint in a line that was already there. -->
                <md-time-picker
                  name="reviewTime"
                  [attr.label]="t('wealth.proposal.field.reviewTime')"
                  [attr.value]="reviewTime"
                  format="24h"
                  minute-step="15"
                  min="08:00"
                  max="19:00"
                  [attr.supporting-text]="t('wealth.proposal.field.reviewTimeHint')"
                  [attr.error]="err(0, 'time') ? '' : null"
                  [attr.error-text]="err(0, 'time')"
                  reserve-supporting-space
                  responsive
                  required
                  [attr.headline-input-label]="timeLabels['headline-input-label']"
                  [attr.headline-dial-label]="timeLabels['headline-dial-label']"
                  [attr.hour-label]="timeLabels['hour-label']"
                  [attr.minute-label]="timeLabels['minute-label']"
                  [attr.period-label]="timeLabels['period-label']"
                  [attr.am-label]="timeLabels['am-label']"
                  [attr.pm-label]="timeLabels['pm-label']"
                  [attr.toggle-dial-label]="timeLabels['toggle-dial-label']"
                  [attr.toggle-input-label]="timeLabels['toggle-input-label']"
                  [attr.value-missing-label]="timeLabels['value-missing-label']"
                  [attr.range-underflow-label]="timeLabels['range-underflow-label']"
                  [attr.range-overflow-label]="timeLabels['range-overflow-label']"
                  [attr.range-outside-label]="timeLabels['range-outside-label']"
                  [attr.cancel-label]="timeLabels['cancel-label']"
                  [attr.ok-label]="timeLabels['ok-label']"
                  (mdChange)="onTime($event)"
                ></md-time-picker>
              </div>
            </div>
          </md-step>

          <!-- ------------------------------------------------------ step 2 -->
          <md-step
            [attr.label]="t('wealth.proposal.step.risk')"
            [attr.description]="t('wealth.proposal.step.riskHint')"
            editable
            [attr.error]="stepError(1) ? '' : null"
            [attr.error-text]="stepError(1) ? t(stepMessage[1]) : ''"
          >
            <!--
              Two cards, not a 2×2 grid of bare stacks: what the money does
              (how long, and what it may not hold) on the left, what the
              advisor thinks of it (conviction, screening, the mandate's own
              strategy) on the right — see the React source for the measured
              reading-order reasoning.
            -->
            <div class="grid-2">
              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack form-stack">
                  <div class="stack">
                    <p class="field-label">{{ t('wealth.proposal.field.horizon') }}</p>
                    <!-- A bounded value the advisor feels rather than types
                         (§5.3). The unit is months, so the objective rule is a
                         comparison and not a conversion. mdInput rather than
                         mdChange: the horizon rule has to recompute while the
                         thumb moves, or the advisor drags past the objective
                         and only learns about it after letting go. -->
                    <md-slider
                      name="horizonMonths"
                      [attr.aria-label]="t('wealth.proposal.field.horizon')"
                      [attr.min]="horizonMin"
                      [attr.max]="horizonMax"
                      [attr.step]="horizonStep"
                      [attr.value]="horizonDefault"
                      size="md"
                      value-indicator
                      [attr.value-text]="t('wealth.unit.months', { value: horizon })"
                      (mdInput)="onHorizon($event)"
                    ></md-slider>
                    @if (err(1, 'horizon'); as message) {
                      <p class="field-error" role="alert">{{ message }}</p>
                    } @else {
                      <p class="muted">{{
                        t('wealth.proposal.field.horizonHint') +
                          (chosenGoal
                            ? ' · ' +
                              t('wealth.goal.monthsRemaining', {
                                count: chosenGoal.monthsRemaining
                              })
                            : '')
                      }}</p>
                    }
                  </div>

                  <!--
                    Several of a few, all visible — checkboxes, not a
                    multi-select (§5.3). md-checkbox has no slot either, so
                    each is wrapped in a label. One delegated mdChange on the
                    group is enough: the event bubbles and is composed, and a
                    composed event retargets to the checkbox HOST, so
                    event.target is the element carrying the value.
                  -->
                  <div class="stack" (mdChange)="onConstraint($event)">
                    <p class="field-label">{{ t('wealth.proposal.field.constraints') }}</p>
                    @for (instrumentType of instrumentTypes; track instrumentType) {
                      <label class="row" style="cursor: pointer">
                        <md-checkbox
                          name="excludedTypes"
                          [attr.value]="instrumentType"
                          [attr.checked]="excluded.includes(instrumentType) ? '' : null"
                        ></md-checkbox>
                        <span>{{ t('wealth.instrumentType.' + instrumentType) }}</span>
                      </label>
                    }
                    @if (err(1, 'constraints'); as message) {
                      <p class="field-error" role="alert">{{ message }}</p>
                    } @else {
                      <p class="muted">{{ t('wealth.proposal.field.constraintsHint') }}</p>
                    }
                  </div>
                </div>
              </md-card>

              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack form-stack">
                  <div class="stack">
                    <p class="field-label">{{ t('wealth.proposal.field.conviction') }}</p>
                    <!-- A subjective score on a small scale — §5.3 sends that
                         to md-rating and away from a slider. getLabel is a
                         FUNCTION prop with no attribute form: a property
                         binding, memoised per locale, driving both
                         aria-valuetext and the visible value label. -->
                    <md-rating
                      name="conviction"
                      [attr.max]="convictionMax"
                      precision="1"
                      size="lg"
                      show-value-label
                      [attr.rating-label]="t('wealth.proposal.field.conviction')"
                      [getLabel]="ratingLabel"
                      (mdChange)="onConviction($event)"
                    ></md-rating>
                    @if (err(1, 'conviction'); as message) {
                      <p class="field-error" role="alert">{{ message }}</p>
                    } @else {
                      <p class="muted">{{ t('wealth.proposal.field.convictionHint') }}</p>
                    }
                  </div>

                  <div class="stack">
                    <p class="field-label">{{ t('wealth.proposal.field.esg') }}</p>
                    <!-- An immediate setting with no save step — a switch, not
                         a checkbox (§5.3). It re-screens the universe the
                         moment it flips. -->
                    <label class="row" style="cursor: pointer">
                      <md-switch
                        name="esgScreening"
                        icons
                        [attr.selected]="esg ? '' : null"
                        (mdChange)="onEsg($event)"
                      ></md-switch>
                      <span>{{ t('wealth.proposal.field.esgHint') }}</span>
                    </label>

                    <dl class="dl">
                      <div awcFact [label]="t('wealth.table.strategy')">
                        @if (household) {
                          <md-chip awcChip kind="strategy" [value]="household.strategy"></md-chip>
                        } @else {
                          —
                        }
                      </div>
                      <div awcFact [label]="t('wealth.table.riskProfile')">
                        @if (household) {
                          {{ t(household.riskProfileKey) }}
                        } @else {
                          —
                        }
                      </div>
                    </dl>
                  </div>
                </div>
              </md-card>
            </div>
          </md-step>

          <!-- ------------------------------------------------------ step 3 -->
          <md-step
            [attr.label]="t('wealth.proposal.step.allocation')"
            [attr.description]="t('wealth.proposal.step.allocationHint')"
            editable
            [attr.error]="stepError(2) ? '' : null"
            [attr.error-text]="stepError(2) ? t(stepMessage[2]) : ''"
          >
            <!-- Two cards STACKED, not side by side: full width fits all five
                 weights on one line — the row a reader actually wants, five
                 weights that have to add up, readable in a single pass — and
                 the total that judges them sits directly underneath. -->
            <div class="stack form-stack">
              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack">
                  <p class="field-label">{{ t('wealth.proposal.alloc.title') }}</p>
                  <p class="muted">{{ t('wealth.proposal.alloc.hint') }}</p>
                  <!-- Remounted with the household so each field takes the new
                       mandate's target as an initial value. Within one
                       household nothing ever writes to these elements. -->
                  <div class="grid-3 weight-grid">
                    @for (hid of [householdId]; track hid) {
                      @for (cls of assetClassOrder; track cls) {
                        <div class="stack weight-field">
                          <md-chip awcChip kind="assetClass" [value]="cls"></md-chip>
                          <!-- A number with steppers and locale formatting —
                               §5.2 rules out md-text-field type="number".
                               style: percent keeps the VALUE a fraction, the
                               fixture's convention for every ratio, so 0.35 in
                               state renders as 35% with no multiplication
                               anywhere. -->
                          <md-number-field
                            variant="outlined"
                            [attr.name]="'weight-' + cls"
                            [attr.label]="t('wealth.proposal.field.weight')"
                            [attr.value]="mandateTargets[cls]"
                            min="0"
                            max="1"
                            step="0.01"
                            small-step="0.005"
                            large-step="0.05"
                            snap-on-step
                            [attr.locale]="t.locale"
                            format-options='{"style":"percent","maximumFractionDigits":1}'
                            [attr.increment-label]="t('wealth.proposal.field.weight')"
                            [attr.decrement-label]="t('wealth.proposal.field.weight')"
                            (mdInput)="onWeight(cls, $event)"
                          ></md-number-field>
                          <p class="muted">
                            {{ t('wealth.table.actual') }}
                            <span awcPercent [value]="actualFor(cls)" [digits]="1"></span
                            >{{ ' · ' }}{{ t('wealth.proposal.alloc.mandateTarget') }}
                            <span awcPercent [value]="mandateTargets[cls]" [digits]="1"></span>
                          </p>
                        </div>
                      }
                    }
                  </div>
                </div>
              </md-card>

              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack">
                  <!-- A read-only value inside a known range — md-meter, not
                       md-progress-indicator: nothing here is loading (§5.5).
                       driftColor is literally the right map: the distance from
                       a balanced book IS a drift, on the same 2% / 5% bands
                       the fixture classifies an allocation on. -->
                  <awc-ratio-meter
                    [label]="t('wealth.proposal.alloc.total')"
                    [fraction]="weightsTotal"
                    [color]="totalColor"
                    [max]="1"
                  />
                  @if (err(2, 'weights'); as message) {
                    <p class="field-error" role="alert">{{ message }}</p>
                  } @else {
                    <p class="muted">{{ t('wealth.proposal.alloc.zeroed') }}</p>
                  }
                  <dl class="dl">
                    <div awcFact [label]="t('wealth.proposal.summary.instruments')">
                      <md-chip awcCount [value]="proposed.length"></md-chip>
                    </div>
                    <div awcFact [label]="t('wealth.kpi.aum.short')">
                      @if (portfolio) {
                        <span awcMoney [value]="portfolio.marketValue" [compact]="true"></span>
                      } @else {
                        —
                      }
                    </div>
                  </dl>
                </div>
              </md-card>

              <div class="stack">
                <p class="field-label">{{ t('wealth.proposal.instruments.title') }}</p>
                <!--
                  Assigning a subset out of a bounded pool with both sides
                  visible — §5.3's row for md-transfer-list. items and value
                  are JS PROPERTIES (value has no attribute at all), so they
                  are property bindings with cached references. The four mover
                  glyphs are left at their defaults because the stylesheet
                  mirrors them under dir="rtl" and passing pre-mirrored names
                  would flip them twice.
                -->
                <md-transfer-list
                  [items]="transferItems"
                  [value]="proposed"
                  [attr.source-title]="t('wealth.proposal.transfer.source')"
                  [attr.target-title]="t('wealth.proposal.transfer.target')"
                  [attr.source-search-placeholder]="t('wealth.proposal.transfer.searchSource')"
                  [attr.target-search-placeholder]="t('wealth.proposal.transfer.searchTarget')"
                  [attr.count-template]="t('wealth.proposal.transfer.count')"
                  [attr.empty-text]="t('wealth.proposal.transfer.empty')"
                  empty-icon="inventory_2"
                  [attr.move-right-label]="t('wealth.proposal.transfer.moveRight')"
                  [attr.move-left-label]="t('wealth.proposal.transfer.moveLeft')"
                  [attr.move-all-right-label]="t('wealth.proposal.transfer.moveAllRight')"
                  [attr.move-all-left-label]="t('wealth.proposal.transfer.moveAllLeft')"
                  density="-1"
                  full-width
                  style="--md-transfer-list-height: 360px"
                  (mdChange)="onChosen($event)"
                ></md-transfer-list>
                @if (err(2, 'instruments'); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                } @else {
                  <p class="muted">{{ t('wealth.proposal.instruments.hint') }}</p>
                }
              </div>
            </div>
          </md-step>

          <!-- ------------------------------------------------------ step 4 -->
          <md-step
            [attr.label]="t('wealth.proposal.step.sign')"
            [attr.description]="t('wealth.proposal.step.signHint')"
            [attr.error]="stepError(3) ? '' : null"
            [attr.error-text]="stepError(3) ? t(stepMessage[3]) : ''"
          >
            <!-- Two cards: what is being signed on the left, what it holds on
                 the right. The code stays at the foot of the summary card — it
                 belongs to the thing it signs, and carrying it there closes
                 most of the columns' height gap from the short side. -->
            <div class="grid-wide">
              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack">
                  <p class="field-label">{{ t('wealth.proposal.summary.title') }}</p>
                  <p class="muted">{{ t('wealth.proposal.summary.hint') }}</p>

                  <dl class="dl">
                    <div awcFact [label]="t('wealth.proposal.field.title')">
                      {{ title || '—' }}
                    </div>
                    <div awcFact [label]="t('wealth.table.household')">
                      {{ household ? household.name : '—' }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.field.client')">
                      {{ clientName || '—' }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.field.type')">
                      <md-chip awcChip kind="proposalType" [value]="type"></md-chip>
                    </div>
                    <div awcFact [label]="t('wealth.proposal.field.objective')">
                      {{ goalLabel }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.summary.meeting')">
                      @if (reviewDate) {
                        <time awcDate [value]="reviewDate"></time
                        >{{ reviewTime ? ' · ' + reviewTime : '' }}
                      } @else {
                        —
                      }
                    </div>
                    <div awcFact [label]="t('wealth.proposal.summary.horizon')">
                      {{ t('wealth.unit.months', { value: horizon }) }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.field.conviction')">
                      {{
                        t('wealth.proposal.summary.conviction', {
                          value: conviction,
                          max: convictionMax
                        })
                      }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.field.esg')">
                      {{
                        esg
                          ? t('wealth.proposal.summary.esgOn')
                          : t('wealth.proposal.summary.esgOff')
                      }}
                    </div>
                    <div awcFact [label]="t('wealth.proposal.summary.mandateValue')">
                      <span awcMoney [value]="portfolio ? portfolio.marketValue : 0"></span>
                    </div>
                  </dl>

                  <div class="alloc-summary">
                    @for (cls of nonZeroClasses; track cls) {
                      <span>
                        <md-chip awcChip kind="assetClass" [value]="cls"></md-chip>
                        <span awcPercent [value]="weights[cls]" [digits]="1"></span>
                      </span>
                    }
                  </div>

                  @if (excluded.length > 0) {
                    <div class="row">
                      <span class="muted">{{ t('wealth.proposal.summary.excluded') }}</span>
                      @for (entry of excluded; track entry) {
                        <md-chip
                          variant="assist"
                          appearance="outlined"
                          color="warning"
                          icon="block"
                          [attr.label]="t('wealth.instrumentType.' + entry)"
                        ></md-chip>
                      }
                    </div>
                  }

                  <div class="sign-block">
                    <!--
                      A one-time code goes in md-otp-field, never a row of text
                      fields (§5.2). incomplete-label is what makes a
                      half-typed code invalid rather than merely empty.

                      NO error HERE, deliberately: the message recomputes on
                      every keystroke, and painting it red turned all six cells
                      red from the first digit. The message arrives as
                      supporting text, in the line the hint was already
                      occupying, so nothing moves and nothing shouts. What
                      actually enforces the rule is next-disabled on the
                      stepper, where a confirming action belongs.
                    -->
                    <md-otp-field
                      name="confirmationCode"
                      [attr.length]="codeLength"
                      validation-type="numeric"
                      group-size="3"
                      [attr.label]="t('wealth.proposal.field.code')"
                      [attr.supporting-text]="
                        err(3, 'code') || t('wealth.proposal.field.codeHint')
                      "
                      [attr.cell-label-template]="t('wealth.proposal.field.codeCell')"
                      [attr.value-missing-label]="t('wealth.proposal.error.code')"
                      [attr.incomplete-label]="t('wealth.proposal.error.code')"
                      reserve-supporting-space
                      required
                      (mdInput)="onCode($event)"
                    ></md-otp-field>
                  </div>
                </div>
              </md-card>

              <md-card variant="outlined" full-width class="surface-card step-card">
                <div class="stack">
                  <div class="row row--between">
                    <p class="field-label">{{ t('wealth.proposal.summary.instruments') }}</p>
                    <md-chip awcCount [value]="proposedInstruments.length"></md-chip>
                  </div>
                  <!-- A vertical set of records, not a table (§5.5). lines
                       matches what is actually passed — a headline and one
                       supporting line. -->
                  <md-list [attr.aria-label]="t('wealth.proposal.summary.instruments')">
                    @for (instrument of summaryInstruments; track instrument.id) {
                      <md-list-item
                        lines="2"
                        [attr.headline]="instrument.name"
                        [attr.supporting-text]="
                          t('wealth.proposal.instruments.meta', {
                            ticker: instrument.ticker,
                            assetClass: t(instrument.assetClassKey),
                            currency: instrument.currency
                          })
                        "
                      ></md-list-item>
                    }
                  </md-list>
                  @if (proposedInstruments.length > summaryListLimit) {
                    <p class="muted">
                      {{
                        t('wealth.common.more', {
                          count: proposedInstruments.length - summaryListLimit
                        })
                      }}
                    </p>
                  }
                </div>
              </md-card>
            </div>
          </md-step>
        </md-stepper>
      }
    </awc-panel>

    <!--
      THE ONLY DIALOG ON THIS SCREEN. Opened from the stepper's Finish, which
      sits on the page — not from inside another dialog, and it opens none of
      its own. The two pickers in step 1 are modals too, which is exactly why
      the stepper is not wrapped in a dialog (§7.3).
    -->
    <md-dialog
      [attr.open]="confirmOpen ? '' : null"
      [attr.headline]="t('wealth.proposal.confirm.headline')"
      icon="fact_check"
      divider
      [attr.scrim-dismissible]="submitting ? 'false' : ''"
      [attr.locale]="t.locale"
      (mdCancel)="abandon()"
    >
      <p>{{ t('wealth.proposal.confirm.body') }}</p>
      <dl class="dl">
        <div awcFact [label]="t('wealth.proposal.field.title')">{{ title || '—' }}</div>
        <div awcFact [label]="t('wealth.table.household')">
          {{ household ? household.name : '—' }}
        </div>
        <div awcFact [label]="t('wealth.proposal.field.type')">
          <md-chip awcChip kind="proposalType" [value]="type"></md-chip>
        </div>
        <div awcFact [label]="t('wealth.proposal.summary.instruments')">
          <md-chip awcCount [value]="proposed.length"></md-chip>
        </div>
      </dl>

      <!-- The bar appears mid-flow when the submit starts, so it needs a gap
           of its own above it: the fact grid ends on a chip and the wave would
           otherwise read as part of the last row. -->
      @if (submitting) {
        <md-progress-indicator
          class="submit-progress"
          variant="linear"
          [attr.value]="progress"
          max="100"
          wave
          [attr.label]="t('wealth.proposal.submitting')"
        ></md-progress-indicator>
      }

      <!-- M3 puts the dismissive action on the LEADING side and the component
           does not reorder them. Neither slotted button closes the dialog on
           its own — md-dialog's readme is explicit, and M3 says a dismissive
           action is never disabled, so Cancel stays live during the submit
           and abandons it. -->
      <md-button slot="actions" variant="text" (mdClick)="abandon()">
        {{ t('wealth.action.cancel') }}
      </md-button>
      <md-button
        slot="actions"
        variant="filled"
        [attr.loading]="submitting ? '' : null"
        (mdClick)="onSend()"
      >
        {{ t('wealth.proposal.confirm.submit') }}
      </md-button>
    </md-dialog>

    <!-- Brief confirmation of something that already happened, with a single
         reversing action — the snackbar's whole remit (§5.5). Centred on the
         bottom edge like every other toast in the app, and lifted clear of the
         dock and the navigation bar by .wealth-snackbar (snackbar.css). -->
    <md-snackbar
      #snackbar
      class="wealth-snackbar"
      [attr.message]="t('wealth.proposal.submitted')"
      [attr.action]="t('wealth.proposal.undo')"
      position="bottom"
      auto-hide-duration="6000"
      [attr.dismiss-label]="t('wealth.action.close')"
      (mdAction)="onSnackbarAction()"
      (mdClose)="onSnackbarClose($event)"
    ></md-snackbar>
  `,
})
export class ProposalFormComponent extends ShowcaseComponent implements OnInit, OnDestroy {
  /** "Start another proposal" — the builder above bumps its remount key. */
  @Output() readonly restart = new EventEmitter<void>();

  @ViewChild('snackbar') private snackbarEl?: ElementRef<HTMLElement>;

  /* ------------------------------------------------------------- fixtures */

  protected readonly households: Household[] = getHouseholds();
  private readonly universe: Instrument[] = getInstruments();

  protected readonly proposalTypes = PROPOSAL_TYPES;
  protected readonly instrumentTypes = INSTRUMENT_TYPES;
  protected readonly assetClassOrder = ASSET_CLASS_ORDER;
  protected readonly stepMessage = STEP_MESSAGE;
  protected readonly reportingDate = REPORTING_DATE;
  protected readonly horizonMin = HORIZON_MIN;
  protected readonly horizonMax = HORIZON_MAX;
  protected readonly horizonStep = HORIZON_STEP;
  protected readonly horizonDefault = HORIZON_DEFAULT;
  protected readonly convictionMax = CONVICTION_MAX;
  protected readonly codeLength = CODE_LENGTH;
  protected readonly summaryListLimit = SUMMARY_LIST_LIMIT;
  protected readonly lastStep = LAST_STEP;

  /* ----------------------------------------------------------- form state */

  protected title = '';
  protected householdId = this.households.length > 0 ? this.households[0].id : '';
  protected clientId = '';
  protected goalId = '';
  protected type: ProposalType = PROPOSAL_TYPES[0];
  protected reviewDate = '';
  // Deliberately empty: the fixture has no meeting time, and an invented
  // default would let the advisor skip a decision the flow says is required.
  protected reviewTime = '';

  protected horizon = HORIZON_DEFAULT;
  protected conviction = 0;
  protected excluded: InstrumentType[] = [];
  protected esg = false;

  protected weights: Record<AssetClass, number> = targetsFor(
    this.householdId ? getAllocationFor(this.householdId) : [],
  );
  protected chosen: string[] = [];

  protected code = '';

  /* ----------------------------------------------------------- flow state */

  protected active = STEP_CLIENT;
  protected touched: boolean[] = [false, false, false, false];
  protected confirmOpen = false;
  protected submitting = false;
  protected progress = 0;
  protected submitted = false;

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Seed everything that hangs off the household, on mount as on every
    // change — one routine rather than five, because they are one decision:
    // which mandate the advice is for. Every value it writes comes from the
    // fixture; nothing here is invented and nothing here is a clock.
    if (this.householdId) this.seedHousehold(this.householdId);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  /* ------------------------------------------------- household derivations */

  private hhCache: {
    id: string;
    household: Household | undefined;
    portfolio: Portfolio | undefined;
    clients: Client[];
    goals: Goal[];
    allocation: AllocationRow[];
    targets: Record<AssetClass, number>;
  } | null = null;

  private get hh() {
    let cache = this.hhCache;
    if (!cache || cache.id !== this.householdId) {
      const id = this.householdId;
      const allocation = id ? getAllocationFor(id) : [];
      cache = {
        id,
        household: this.households.find((h) => h.id === id),
        portfolio: id ? getPortfolioFor(id) : undefined,
        clients: id ? getClientsFor(id) : [],
        goals: id ? getGoalsFor(id) : [],
        allocation,
        targets: targetsFor(allocation),
      };
      this.hhCache = cache;
    }
    return cache;
  }

  protected get household(): Household | undefined {
    return this.hh.household;
  }

  protected get portfolio(): Portfolio | undefined {
    return this.hh.portfolio;
  }

  protected get clients(): Client[] {
    return this.hh.clients;
  }

  protected get goals(): Goal[] {
    return this.hh.goals;
  }

  protected get mandateTargets(): Record<AssetClass, number> {
    return this.hh.targets;
  }

  protected actualFor(cls: AssetClass): number {
    return this.hh.allocation.find((row) => row.assetClass === cls)?.actualWeight ?? 0;
  }

  protected get chosenGoal(): Goal | undefined {
    return this.goals.find((goal) => goal.id === this.goalId);
  }

  protected get clientName(): string {
    return this.clients.find((member) => member.id === this.clientId)?.name ?? '';
  }

  protected get goalLabel(): string {
    const goal = this.chosenGoal;
    return goal ? this.t(goal.typeKey) : this.t('wealth.common.none');
  }

  private seedHousehold(id: string): void {
    const members = getClientsFor(id);
    this.clientId = members.length > 0 ? members[0].id : '';
    this.goalId = '';
    this.weights = targetsFor(getAllocationFor(id));
    const mandate = getPortfolioFor(id);
    this.chosen = mandate ? getPositionsFor(mandate.id).map((p) => p.instrumentId) : [];
    const owner = getHouseholds().find((h) => h.id === id);
    this.reviewDate = owner ? owner.nextReviewDate : '';
  }

  /* ---------------------------------------------- the eligible universe */

  private get weightsSig(): string {
    return ASSET_CLASS_ORDER.map((cls) => this.weights[cls] || 0).join(',');
  }

  /*
   * items, the pruned value and its Instrument records, in ONE cache with ONE
   * key — the exact equivalent of the React build's `useElementProps({items,
   * value}, [signature, value.join('|')])`, which reassigns both together.
   * The locale is in the key too, so a language switch rebuilds the item
   * labels (the React reference only rebuilds them on the next eligibility
   * change — flagged in the hand-off notes).
   *
   * THE PROPOSED SET IS DERIVED-PRUNED, never stored: `md-transfer-list`
   * never moves a `disabled` item in EITHER direction, so an instrument that
   * becomes ineligible after it was added would be stranded in the proposal
   * with no way to take it out. Deriving the value means the pruned ones are
   * simply re-partitioned back to the source column on the next assignment,
   * where their disabled state is honest.
   */
  private derivedCache: {
    key: string;
    items: TransferItem[];
    proposed: string[];
    instruments: Instrument[];
  } | null = null;

  private get derived() {
    const eligKey = `${this.excluded.join('|')}!${this.esg}!${this.weightsSig}`;
    const key = `${this.t.locale}§${eligKey}§${this.chosen.join('|')}`;
    let cache = this.derivedCache;
    if (!cache || cache.key !== key) {
      // Three of the form's own answers feed eligibility, which is what makes
      // the four steps a flow rather than four unrelated pages: excluding a
      // type in step 2, turning ESG screening on in step 2, and zeroing a
      // class in step 3 each take instruments off the table.
      const excludedSet = new Set<string>(this.excluded);
      const eligible = (instrument: Instrument): boolean =>
        !excludedSet.has(instrument.type) &&
        !(this.esg && instrument.sector === 'energy') &&
        (this.weights[instrument.assetClass] || 0) > 0;
      const byId = new Map(this.universe.map((instrument) => [instrument.id, instrument] as const));
      const proposed = this.chosen.filter((id) => {
        const instrument = byId.get(id);
        return instrument !== undefined && eligible(instrument);
      });
      cache = {
        key,
        items: this.universe.map((instrument) => ({
          value: instrument.id,
          label: instrument.name,
          description: this.t('wealth.proposal.instruments.meta', {
            ticker: instrument.ticker,
            assetClass: this.t(instrument.assetClassKey),
            currency: instrument.currency,
          }),
          disabled: !eligible(instrument),
        })),
        proposed,
        instruments: proposed
          .map((id) => byId.get(id))
          .filter((instrument): instrument is Instrument => instrument !== undefined),
      };
      this.derivedCache = cache;
    }
    return cache;
  }

  protected get transferItems(): TransferItem[] {
    return this.derived.items;
  }

  protected get proposed(): string[] {
    return this.derived.proposed;
  }

  protected get proposedInstruments(): Instrument[] {
    return this.derived.instruments;
  }

  protected get summaryInstruments(): Instrument[] {
    return this.proposedInstruments.slice(0, SUMMARY_LIST_LIMIT);
  }

  protected get nonZeroClasses(): AssetClass[] {
    return ASSET_CLASS_ORDER.filter((cls) => (this.weights[cls] || 0) > 0);
  }

  protected get weightsTotal(): number {
    return draftMaths.total(this.weights);
  }

  protected get totalColor(): string {
    return driftColor(draftMaths.imbalance(this.weights));
  }

  /* ------------------------------------------------------------ validation */

  /**
   * Every rule as a flat table of `{ step, field, key }` — one list read by
   * three consumers: the step's `error-text`, each field's own inline error,
   * and the `mdBeforeChange` veto. Splitting them would let a rule block a
   * step without ever saying which field failed.
   */
  private failuresCache: { key: string; rules: Failure[] } | null = null;

  protected get failures(): Failure[] {
    const key = [
      this.title,
      this.householdId,
      this.clientId,
      this.reviewDate,
      this.reviewTime,
      this.conviction,
      this.goalId,
      this.horizon,
      this.excluded.join('|'),
      this.weightsSig,
      this.proposed.join('|'),
      this.code,
    ].join('§');
    if (this.failuresCache?.key === key) return this.failuresCache.rules;

    const rules: Failure[] = [];

    if (this.title.trim().length < 6) {
      rules.push({ step: STEP_CLIENT, field: 'title', key: 'wealth.proposal.error.title' });
    }
    if (!this.householdId) {
      rules.push({ step: STEP_CLIENT, field: 'household', key: 'wealth.proposal.error.household' });
    }
    if (!this.clientId) {
      rules.push({ step: STEP_CLIENT, field: 'client', key: 'wealth.proposal.error.client' });
    }
    if (!this.reviewDate) {
      rules.push({ step: STEP_CLIENT, field: 'date', key: 'wealth.proposal.error.date' });
    }
    if (!this.reviewTime) {
      rules.push({ step: STEP_CLIENT, field: 'time', key: 'wealth.proposal.error.time' });
    }

    if (this.conviction < 1) {
      rules.push({ step: STEP_RISK, field: 'conviction', key: 'wealth.proposal.error.conviction' });
    }
    // The horizon is in months and so is `monthsRemaining`, so "the money has
    // to stay invested until the objective falls due" is a comparison rather
    // than a calculation.
    const goal = this.chosenGoal;
    if (goal && this.horizon < goal.monthsRemaining) {
      rules.push({ step: STEP_RISK, field: 'horizon', key: 'wealth.proposal.error.horizon' });
    }
    if (this.excluded.length >= INSTRUMENT_TYPES.length) {
      rules.push({
        step: STEP_RISK,
        field: 'constraints',
        key: 'wealth.proposal.error.constraints',
      });
    }

    if (!draftMaths.balanced(this.weights)) {
      rules.push({ step: STEP_ALLOCATION, field: 'weights', key: 'wealth.proposal.error.weights' });
    }
    if (this.proposed.length === 0) {
      rules.push({
        step: STEP_ALLOCATION,
        field: 'instruments',
        key: 'wealth.proposal.error.instruments',
      });
    }

    if (this.code.length < CODE_LENGTH) {
      rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.code' });
    } else if (/^(\d)\1+$/.test(this.code)) {
      rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.codeRepeat' });
    }

    this.failuresCache = { key, rules };
    return rules;
  }

  private stepValid(step: number): boolean {
    return !this.failures.some((failure) => failure.step === step);
  }

  /*
   * Finish is gated on the WHOLE form, not just on the step it sits in:
   * `auto-complete` marks a step completed the moment you leave it, and
   * `mode="linear"` then lets you jump forward past it — so an advisor could
   * pass step 1, come back, blank the title, and walk forward again to a
   * Finish that only ever looked at step 4.
   */
  protected get formValid(): boolean {
    return this.failures.length === 0;
  }

  /** The inline message for one field, or `''` while its step is untouched. */
  protected err(step: number, field: string): string {
    if (!this.touched[step]) return '';
    const hit = this.failures.find((failure) => failure.step === step && failure.field === field);
    return hit ? this.t(hit.key) : '';
  }

  protected stepError(step: number): boolean {
    return this.touched[step] && !this.stepValid(step);
  }

  private markTouched(step: number): void {
    this.touched = this.touched.map((was, index) => (index === step ? true : was));
  }

  /* ------------------------------------------------------- picker bundles */

  protected get dateLabels(): Record<string, string> {
    return this.memo('dateLabels', () => datePickerLabels(this.t));
  }

  protected get timeLabels(): Record<string, string> {
    return this.memo('timeLabels', () => timePickerLabels(this.t));
  }

  /** `md-rating`'s function prop, memoised per locale — a property binding. */
  protected get ratingLabel() {
    return this.memo('ratingLabel', () => (value: number) =>
      this.t('wealth.proposal.summary.conviction', { value, max: CONVICTION_MAX }),
    );
  }

  /* -------------------------------------------------------- field events */

  protected onTitle(event: Event): void {
    this.title = (event as CustomEvent<string>).detail ?? '';
  }

  protected onHousehold(event: Event): void {
    const id = (event as CustomEvent<string>).detail ?? '';
    this.householdId = id;
    if (id) this.seedHousehold(id);
  }

  protected onClient(event: Event): void {
    this.clientId = (event as CustomEvent<string>).detail ?? '';
  }

  protected onGoal(event: Event): void {
    this.goalId = (event as CustomEvent<string>).detail ?? '';
  }

  // One delegated listener for the radio group: mdChange bubbles and is
  // composed, and a composed event's detail carries both halves.
  protected onTypeChange(event: Event): void {
    const detail = (event as CustomEvent<{ checked: boolean; value: string }>).detail;
    if (detail?.checked) this.type = detail.value as ProposalType;
  }

  protected onDate(event: Event): void {
    this.reviewDate = (event as CustomEvent<{ value: string }>).detail.value;
  }

  protected onTime(event: Event): void {
    this.reviewTime = (event as CustomEvent<{ value: string }>).detail.value;
  }

  protected onHorizon(event: Event): void {
    this.horizon = (event as CustomEvent<{ value: number }>).detail.value;
  }

  protected onConviction(event: Event): void {
    this.conviction = (event as CustomEvent<number>).detail;
  }

  protected onEsg(event: Event): void {
    this.esg = (event as CustomEvent<{ selected: boolean }>).detail.selected;
  }

  // Delegated over the checkbox list; a composed event retargets to the
  // md-checkbox HOST, so event.target carries the value attribute.
  protected onConstraint(event: Event): void {
    const detail = (event as CustomEvent<{ checked: boolean }>).detail;
    const value = (event.target as HTMLElement | null)?.getAttribute?.(
      'value',
    ) as InstrumentType | null;
    if (!value) return;
    this.excluded = detail.checked
      ? this.excluded.includes(value)
        ? this.excluded
        : [...this.excluded, value]
      : this.excluded.filter((entry) => entry !== value);
  }

  protected onWeight(cls: AssetClass, event: Event): void {
    const detail = (event as CustomEvent<{ value: number | null }>).detail;
    this.weights = { ...this.weights, [cls]: detail.value === null ? 0 : detail.value };
  }

  protected onChosen(event: Event): void {
    this.chosen = (event as CustomEvent<string[]>).detail ?? [];
  }

  protected onCode(event: Event): void {
    this.code = (event as CustomEvent<string>).detail ?? '';
    this.markTouched(STEP_SIGN);
  }

  /* ------------------------------------------------------------ the stepper */

  protected onBeforeChange(event: Event): void {
    const { index, previous } = (
      event as CustomEvent<{ index: number; previous: number }>
    ).detail;
    // Backward is always allowed — a wizard that will not let you go back and
    // look is a trap. Only a forward move is ever blocked, and blocking it is
    // always paired with a visible reason: the step turns red and every
    // failing field grows its own error line.
    if (index > previous && !this.stepValid(previous)) {
      event.preventDefault();
      this.markTouched(previous);
    }
  }

  protected onStepChange(event: Event): void {
    this.active = (event as CustomEvent<{ index: number }>).detail.index;
  }

  // Finish on the last step. `next-disabled` already gates the button, so the
  // guard here is belt and braces rather than the primary defence.
  protected onComplete(): void {
    if (this.formValid) {
      this.confirmOpen = true;
      return;
    }
    // If it ever fires anyway, every failing step lights up rather than the
    // press doing nothing.
    this.touched = this.touched.map(
      (was, index) => was || this.failures.some((failure) => failure.step === index),
    );
  }

  /* ------------------------------------------------------------ submitting */

  protected abandon(): void {
    this.clearTimer();
    this.submitting = false;
    this.progress = 0;
    this.confirmOpen = false;
  }

  protected onSend(): void {
    if (this.submitting) return;
    this.progress = 0;
    this.submitting = true;
    this.scheduleTick();
  }

  /*
   * The submit, as a fixed ladder of ticks: five equal steps of a known size,
   * so two runs produce the same sequence and the same end state. The
   * indicator is determinate for the same reason — there is a real total, and
   * M3 says to prefer one when you have it.
   */
  private scheduleTick(): void {
    this.clearTimer();
    if (this.progress >= 100) {
      this.timer = setTimeout(() => {
        this.submitting = false;
        this.confirmOpen = false;
        this.submitted = true;
        const bar = this.snackbarEl?.nativeElement as SnackbarElement | undefined;
        if (bar && typeof bar.show === 'function') bar.show();
      }, SUBMIT_SETTLE_MS);
      return;
    }
    this.timer = setTimeout(() => {
      this.progress += SUBMIT_TICK;
      this.scheduleTick();
    }, SUBMIT_INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // The action button emits `mdAction` and restarts the timer; only `hide()`
  // produces `reason: 'action'`, which is what tells Undo from a timeout.
  protected onSnackbarAction(): void {
    const bar = this.snackbarEl?.nativeElement as SnackbarElement | undefined;
    if (bar && typeof bar.hide === 'function') bar.hide('action');
  }

  protected onSnackbarClose(event: Event): void {
    if ((event as CustomEvent<{ reason: string }>).detail.reason === 'action') {
      this.submitted = false;
    }
  }
}

/* --------------------------------------------------------------- the shell */

/**
 * The builder, with a remount key.
 *
 * "Start another proposal" has to clear a dozen uncontrolled custom elements.
 * Re-keying the form is the only honest way to do it: every control drops its
 * own value with the element, so there is no reset routine to keep in sync
 * with the field list. The `@for` over a one-element array is Angular's
 * remount: when the tracked value changes, the embedded view — and the form
 * component inside it — is destroyed and recreated.
 */
@Component({
  selector: 'awc-proposal-builder',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [ProposalFormComponent],
  template: `
    @for (gen of [generation]; track gen) {
      <awc-proposal-form (restart)="generation = generation + 1" />
    }
  `,
})
export class ProposalBuilderComponent {
  protected generation = 0;
}
