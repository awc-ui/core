/**
 * The proposal builder — `md-stepper` driving a four-step advice document.
 *
 * THE COMPOSITION RULE THIS FILE EXISTS TO OBEY (§7.3). A dialog opened from
 * inside a dialog is always wrong, so a multi-step flow is `md-stepper` inside
 * ONE `md-dialog` — at most. Here it is inside NONE, and that is forced by the
 * flow rather than by taste: step 1 opens `md-date-picker` and
 * `md-time-picker`, and each of those IS its own modal (§7.2: "the picker is
 * its own dialog — don't nest it in another one"). Put the stepper in a dialog
 * and every meeting date the advisor picks becomes a dialog inside a dialog. So
 * the stepper lives on the page, and the single `md-dialog` on this screen is
 * the submit confirmation — opened from the page, with nothing above it.
 *
 * WHY EVERY CONTROL IS UNCONTROLLED. These components own their value and
 * treat a property write as a commit: `md-number-field`'s readme says a
 * programmatic write "reformats the display". Feeding React state back into
 * `value` on every keystroke therefore rewrites the box while the user is
 * inside it. So a field is authored with an INITIAL value that only moves when
 * the thing it derives from moves, React state is updated from the component's
 * own `md*` event, and a `key` remounts the subtree when the household changes
 * and the defaults genuinely have to change with it.
 *
 * VALIDATION IS REAL, and enforced where `md-stepper`'s readme says to enforce
 * it. `mdBeforeChange` is cancelable: an invalid step vetoes the forward move,
 * paints itself `error` with `error-text`, and turns on the inline error of
 * every field that failed. Finish is the one exception — it is gated
 * declaratively with `next-disabled`, because M3 wants a confirming action
 * disabled until the choice is made, and a signature is not something to veto
 * after the fact.
 *
 * WHY EACH STEP IS ITS OWN COMPONENT. Every `md*` listener is a hook, and a
 * step's controls live behind a conditional (`submitted ? … : …`). Calling
 * those hooks in one function body would change the hook count the moment the
 * proposal is sent. React components create no DOM, so `<StepClient />` still
 * renders an `md-step` that is a DIRECT child of `md-stepper` — which is the
 * only thing the stepper cares about (§7.1).
 *
 * ARITHMETIC. Rule zero says arithmetic belongs in the kit. What survives here
 * is quarantined in `draftMaths`, because it is about a DRAFT the fixture does
 * not contain and there is nothing in `derive.ts` to call. It is listed in the
 * hand-off notes as a kit candidate.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from 'react';
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
import { useCustomEvent, useElementProps } from '../elements';
import {
  AssetClassChip,
  Count,
  DateText,
  Fact,
  Money,
  Percent,
  ProposalTypeChip,
  RatioMeter,
  StrategyChip,
} from '../bits';
import { Panel } from '../Shell';
import { datePickerLabels, timePickerLabels, useCopy } from './proposal-copy';
import './snackbar.css';
import type { T } from '@/lib/showcase';

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
 * one object rather than scattered through the JSX so that the day the kit
 * grows an allocation-draft helper there is exactly one place to delete.
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

/* ------------------------------------------------------------ field errors */

/**
 * An inline validation message for a control that has nowhere to put one.
 *
 * `md-text-field`, `md-select`, `md-number-field`, `md-otp-field` and
 * `md-date-picker` all carry `error` + `error-text`, and every one of them is
 * used that way here — a message belongs next to the control, in the control,
 * wherever the control can hold it. `md-slider`, `md-rating`, `md-switch`,
 * `md-transfer-list` and a group of `md-checkbox`es have no such prop, so those
 * four messages are ours to render.
 *
 * The colour is the `error` ROLE, not a hex and not a borrowed class: `.pl-down`
 * is the same red but it means "this figure went down", and reusing it here
 * would put a P/L class on a validation message. `app.css` lives in the kit and
 * has no `.field-error` yet — that is in the hand-off notes; the day it does,
 * this becomes a class name.
 */
function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="field-error" role="alert">
      {children}
    </p>
  );
}

/**
 * The single supporting line under a control that has no supporting line of its
 * own — the hint, or the error, never both.
 *
 * An error REPLACES the hint rather than appearing beneath it. That is the rule
 * `md-text-field` applies to its own two (and `md-date-picker` and now
 * `md-time-picker` forward it), and it is the reason nothing moves when a
 * message appears: the line was already there, holding the hint. Rendering the
 * error as an extra paragraph — which is what this file used to do — meant every
 * failed validation grew the card and pushed whatever sat under it down the
 * page.
 */
function FieldNote({ hint, error }: { hint: ReactNode; error: string }) {
  return error ? <FieldError>{error}</FieldError> : <p className="muted">{hint}</p>;
}

/** The mandate's own targets, as a full five-class record. */
function targetsFor(rows: AllocationRow[]): Record<AssetClass, number> {
  const seed = {} as Record<AssetClass, number>;
  for (const cls of ASSET_CLASS_ORDER) seed[cls] = 0;
  for (const row of rows) seed[row.assetClass] = row.targetWeight;
  return seed;
}

/* ---------------------------------------------------------------- the shell */

/**
 * The builder, with a remount key.
 *
 * "Start another proposal" has to clear a dozen uncontrolled custom elements.
 * Re-keying the form is the only honest way to do it: every control drops its
 * own value with the element, so there is no reset routine to keep in sync with
 * the field list.
 */
export function ProposalBuilder() {
  const [generation, setGeneration] = useState(0);
  return <ProposalForm key={generation} onRestart={() => setGeneration((n) => n + 1)} />;
}

/* --------------------------------------------------------------- form state */

interface Failure {
  step: number;
  field: string;
  key: string;
}

function ProposalForm({ onRestart }: { onRestart: () => void }) {
  const c = useCopy();

  const households = useMemo(() => getHouseholds(), []);
  const universe = useMemo(() => getInstruments(), []);
  const firstHousehold = households.length > 0 ? households[0] : undefined;

  /* ------------------------------------------------------------ step 1 */

  const [title, setTitle] = useState('');
  const [householdId, setHouseholdId] = useState(firstHousehold ? firstHousehold.id : '');
  const [clientId, setClientId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [type, setType] = useState<ProposalType>(PROPOSAL_TYPES[0]);
  const [reviewDate, setReviewDate] = useState('');
  // Deliberately empty: the fixture has no meeting time, and an invented
  // default would let the advisor skip a decision the flow says is required.
  const [reviewTime, setReviewTime] = useState('');

  const household = households.find((h) => h.id === householdId);
  const portfolio = useMemo(
    () => (householdId ? getPortfolioFor(householdId) : undefined),
    [householdId],
  );
  const clients = useMemo(() => (householdId ? getClientsFor(householdId) : []), [householdId]);
  const goals = useMemo(() => (householdId ? getGoalsFor(householdId) : []), [householdId]);
  const allocation = useMemo(
    () => (householdId ? getAllocationFor(householdId) : []),
    [householdId],
  );
  const mandateTargets = useMemo(() => targetsFor(allocation), [allocation]);

  /* ------------------------------------------------------------ step 2 */

  const [horizon, setHorizon] = useState(HORIZON_DEFAULT);
  const [conviction, setConviction] = useState(0);
  const [excluded, setExcluded] = useState<InstrumentType[]>([]);
  const [esg, setEsg] = useState(false);

  /* ------------------------------------------------------------ step 3 */

  const [weights, setWeights] = useState<Record<AssetClass, number>>(() =>
    targetsFor(firstHousehold ? getAllocationFor(firstHousehold.id) : []),
  );
  const [chosen, setChosen] = useState<string[]>([]);

  /* ------------------------------------------------------------ step 4 */

  const [code, setCode] = useState('');

  /* --------------------------------------------------------- flow state */

  const [active, setActive] = useState(STEP_CLIENT);
  const [touched, setTouched] = useState<boolean[]>([false, false, false, false]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const markTouched = (step: number) =>
    setTouched((current) => current.map((was, index) => (index === step ? true : was)));

  /*
   * Seed everything that hangs off the household, on mount and on every change.
   *
   * One effect rather than five, because they are one decision: which mandate
   * the advice is for. Every value it writes comes from the fixture — the
   * primary member (`getClientsFor` returns them first), the mandate's real
   * next review date, its target allocation, and the instruments it actually
   * holds. Nothing here is invented and nothing here is a clock.
   */
  useEffect(() => {
    if (!householdId) return;
    const members = getClientsFor(householdId);
    setClientId(members.length > 0 ? members[0].id : '');
    setGoalId('');
    setWeights(targetsFor(getAllocationFor(householdId)));
    const mandate = getPortfolioFor(householdId);
    setChosen(mandate ? getPositionsFor(mandate.id).map((p) => p.instrumentId) : []);
    const owner = getHouseholds().find((h) => h.id === householdId);
    setReviewDate(owner ? owner.nextReviewDate : '');
  }, [householdId]);

  /* -------------------------------------------------- the eligible universe */

  /**
   * Whether an instrument may be proposed at all.
   *
   * Three of the form's own answers feed this, which is what makes the four
   * steps a flow rather than four unrelated pages: excluding a type in step 2,
   * turning ESG screening on in step 2, and zeroing a class in step 3 each take
   * instruments off the table.
   */
  const eligible = useMemo(() => {
    const excludedSet = new Set<string>(excluded);
    return (instrument: Instrument): boolean =>
      !excludedSet.has(instrument.type) &&
      !(esg && instrument.sector === 'energy') &&
      (weights[instrument.assetClass] || 0) > 0;
  }, [excluded, esg, weights]);

  /*
   * The proposed set, pruned to what is still eligible.
   *
   * `md-transfer-list` never moves a `disabled` item in EITHER direction, so an
   * instrument that becomes ineligible after it was added would be stranded in
   * the proposal with no way to take it out. Deriving the value instead of
   * storing it means the pruned ones are simply re-partitioned back to the
   * source column on the next assignment, where their disabled state is honest.
   */
  const proposed = useMemo(() => {
    const byId = new Map(universe.map((instrument) => [instrument.id, instrument] as const));
    return chosen.filter((id) => {
      const instrument = byId.get(id);
      return instrument !== undefined && eligible(instrument);
    });
  }, [chosen, universe, eligible]);

  const proposedInstruments = useMemo(
    () =>
      proposed
        .map((id) => universe.find((instrument) => instrument.id === id))
        .filter((instrument): instrument is Instrument => instrument !== undefined),
    [proposed, universe],
  );

  const transferItems = useMemo(
    () =>
      universe.map((instrument) => ({
        value: instrument.id,
        label: instrument.name,
        description: c('wealth.proposal.instruments.meta', {
          ticker: instrument.ticker,
          assetClass: c(instrument.assetClassKey),
          currency: instrument.currency,
        }),
        disabled: !eligible(instrument),
      })),
    [universe, eligible, c],
  );

  /* -------------------------------------------------------------- validation */

  const chosenGoal = goals.find((goal) => goal.id === goalId);

  /**
   * Every rule as a flat table of `{ step, field, message }`.
   *
   * One list read by three consumers: the step's `error-text`, each field's own
   * inline error, and the `mdBeforeChange` veto. Splitting them would let a rule
   * block a step without ever saying which field failed.
   */
  const failures = useMemo<Failure[]>(() => {
    const rules: Failure[] = [];

    if (title.trim().length < 6) {
      rules.push({
        step: STEP_CLIENT,
        field: 'title',
        key: 'wealth.proposal.error.title',
      });
    }
    if (!householdId) {
      rules.push({
        step: STEP_CLIENT,
        field: 'household',
        key: 'wealth.proposal.error.household',
      });
    }
    if (!clientId) {
      rules.push({
        step: STEP_CLIENT,
        field: 'client',
        key: 'wealth.proposal.error.client',
      });
    }
    if (!reviewDate) {
      rules.push({
        step: STEP_CLIENT,
        field: 'date',
        key: 'wealth.proposal.error.date',
      });
    }
    if (!reviewTime) {
      rules.push({
        step: STEP_CLIENT,
        field: 'time',
        key: 'wealth.proposal.error.time',
      });
    }

    if (conviction < 1) {
      rules.push({
        step: STEP_RISK,
        field: 'conviction',
        key: 'wealth.proposal.error.conviction',
      });
    }
    // The horizon is in months and so is `monthsRemaining`, so "the money has
    // to stay invested until the objective falls due" is a comparison rather
    // than a calculation.
    if (chosenGoal && horizon < chosenGoal.monthsRemaining) {
      rules.push({
        step: STEP_RISK,
        field: 'horizon',
        key: 'wealth.proposal.error.horizon',
      });
    }
    if (excluded.length >= INSTRUMENT_TYPES.length) {
      rules.push({
        step: STEP_RISK,
        field: 'constraints',
        key: 'wealth.proposal.error.constraints',
      });
    }

    if (!draftMaths.balanced(weights)) {
      rules.push({
        step: STEP_ALLOCATION,
        field: 'weights',
        key: 'wealth.proposal.error.weights',
      });
    }
    if (proposed.length === 0) {
      rules.push({
        step: STEP_ALLOCATION,
        field: 'instruments',
        key: 'wealth.proposal.error.instruments',
      });
    }

    if (code.length < CODE_LENGTH) {
      rules.push({
        step: STEP_SIGN,
        field: 'code',
        key: 'wealth.proposal.error.code',
      });
    } else if (/^(\d)\1+$/.test(code)) {
      rules.push({
        step: STEP_SIGN,
        field: 'code',
        key: 'wealth.proposal.error.codeRepeat',
      });
    }

    return rules;
  }, [
    title,
    householdId,
    clientId,
    reviewDate,
    reviewTime,
    conviction,
    chosenGoal,
    horizon,
    excluded,
    weights,
    proposed,
    code,
  ]);

  const stepValid = (step: number) => !failures.some((failure) => failure.step === step);

  /*
   * Finish is gated on the WHOLE form, not just on the step it sits in.
   *
   * `auto-complete` marks a step completed the moment you leave it, and
   * `mode="linear"` then lets you jump forward past it — so an advisor can pass
   * step 1, come back, blank the title, and walk forward again to a Finish
   * button that only ever looked at step 4. Reading `failures.length` closes
   * that, and the guard on `mdComplete` marks every failing step touched so the
   * red one is visible rather than merely blocking.
   */
  const formValid = failures.length === 0;

  /** The inline message for one field, or `''` while its step is untouched. */
  const fieldError = (step: number, field: string): string => {
    if (!touched[step]) return '';
    const hit = failures.find((failure) => failure.step === step && failure.field === field);
    return hit ? c(hit.key) : '';
  };

  const stepError = (step: number) => touched[step] && !stepValid(step);

  /* ------------------------------------------------------------ the stepper */

  const stepperRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ index: number; previous: number }>>(
    stepperRef,
    'mdBeforeChange',
    (event) => {
      const { index, previous } = event.detail;
      // Backward is always allowed — a wizard that will not let you go back and
      // look is a trap. Only a forward move is ever blocked, and blocking it is
      // always paired with a visible reason: the step turns red and every
      // failing field grows its own error line.
      if (index > previous && !stepValid(previous)) {
        event.preventDefault();
        markTouched(previous);
      }
    },
  );

  useCustomEvent<CustomEvent<{ index: number }>>(stepperRef, 'mdStepChange', (event) => {
    setActive(event.detail.index);
  });

  // Finish on the last step. `next-disabled` already gates the button, so the
  // guard here is belt and braces rather than the primary defence.
  useCustomEvent<CustomEvent<void>>(stepperRef, 'mdComplete', () => {
    if (formValid) {
      setConfirmOpen(true);
      return;
    }
    // Belt and braces: `next-disabled` already blocks this. If it ever fires
    // anyway, every failing step lights up rather than the press doing nothing.
    setTouched((current) =>
      current.map((was, index) => was || failures.some((failure) => failure.step === index)),
    );
  });

  /* ------------------------------------------------------------- submitting */

  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLElement | null>(null);
  const sendRef = useRef<HTMLElement | null>(null);
  const snackbarRef = useRef<HTMLElement | null>(null);

  const abandon = () => {
    setSubmitting(false);
    setProgress(0);
    setConfirmOpen(false);
  };

  useCustomEvent<CustomEvent<void>>(dialogRef, 'mdCancel', () => abandon());

  // A slotted action never closes the dialog by itself — md-dialog's readme is
  // explicit, and M3 says a dismissive action is never disabled, so Cancel stays
  // live during the submit and abandons it.
  useCustomEvent<CustomEvent<unknown>>(cancelRef, 'mdClick', () => abandon());

  useCustomEvent<CustomEvent<unknown>>(sendRef, 'mdClick', () => {
    if (submitting) return;
    setProgress(0);
    setSubmitting(true);
  });

  /*
   * The submit, as a fixed ladder of ticks.
   *
   * Five equal steps of a known size, so two runs produce the same sequence and
   * the same end state. The indicator is determinate for the same reason —
   * there is a real total, and M3 says to prefer one when you have it.
   */
  useEffect(() => {
    if (!submitting) return undefined;

    if (progress >= 100) {
      const settle = window.setTimeout(() => {
        setSubmitting(false);
        setConfirmOpen(false);
        setSubmitted(true);
        const bar = snackbarRef.current as (HTMLElement & { show?: () => void }) | null;
        if (bar && typeof bar.show === 'function') bar.show();
      }, SUBMIT_SETTLE_MS);
      return () => window.clearTimeout(settle);
    }

    const tick = window.setTimeout(
      () => setProgress((value) => value + SUBMIT_TICK),
      SUBMIT_INTERVAL_MS,
    );
    return () => window.clearTimeout(tick);
  }, [submitting, progress]);

  // The action button emits `mdAction` and restarts the timer; only `hide()`
  // produces `reason: 'action'`, which is what tells Undo from a timeout.
  useCustomEvent<CustomEvent<void>>(snackbarRef, 'mdAction', () => {
    const bar = snackbarRef.current as (HTMLElement & { hide?: (r: string) => void }) | null;
    if (bar && typeof bar.hide === 'function') bar.hide('action');
  });

  useCustomEvent<CustomEvent<{ reason: string }>>(snackbarRef, 'mdClose', (event) => {
    if (event.detail.reason === 'action') setSubmitted(false);
  });

  /* --------------------------------------------------------------- rendering */

  const stepperWords = {
    label: c('wealth.proposal.builder.label'),
    'step-word': c('wealth.proposal.stepper.step'),
    'of-word': c('wealth.proposal.stepper.of'),
    'completed-word': c('wealth.proposal.stepper.completed'),
    'current-word': c('wealth.proposal.stepper.current'),
    'error-word': c('wealth.proposal.stepper.error'),
    'optional-word': c('wealth.proposal.stepper.optional'),
    'next-label': c('wealth.action.next'),
    'back-label': c('wealth.action.back'),
    'finish-label': c('wealth.action.submit'),
  };

  const clientName = clients.find((member) => member.id === clientId)?.name ?? '';

  return (
    <>
      <Panel
        title={c('wealth.proposal.builder.title')}
        subtitle={c('wealth.proposal.builder.hint')}
      >
        {submitted ? (
          <SubmittedNotice c={c} title={title} onRestart={onRestart} />
        ) : (
          <md-stepper
            ref={stepperRef}
            active={active}
            mode="linear"
            /*
             * `next-disabled` gates ONLY the built-in Continue / Finish. On the
             * first three steps it is deliberately off: a disabled Continue
             * cannot be pressed, so the user never finds out why. Vetoing
             * `mdBeforeChange` instead lets the press land, paints the step red
             * and names the failing fields. The last step is the exception —
             * M3 disables a confirming action until the choice is made, and the
             * OTP field beneath it says what is missing.
             */
            next-disabled={active === LAST_STEP && !formValid}
            loading={submitting}
            {...stepperWords}
          >
            <StepClient
              c={c}
              households={households}
              clients={clients}
              goals={goals}
              householdId={householdId}
              clientId={clientId}
              goalId={goalId}
              type={type}
              reviewDate={reviewDate}
              reviewTime={reviewTime}
              onTitle={setTitle}
              onHousehold={setHouseholdId}
              onClient={setClientId}
              onGoal={setGoalId}
              onType={setType}
              onDate={setReviewDate}
              onTime={setReviewTime}
              fieldError={fieldError}
              inError={stepError(STEP_CLIENT)}
            />

            <StepRisk
              c={c}
              household={household}
              horizon={horizon}
              conviction={conviction}
              excluded={excluded}
              esg={esg}
              goal={chosenGoal}
              onHorizon={setHorizon}
              onConviction={setConviction}
              onExcluded={setExcluded}
              onEsg={setEsg}
              fieldError={fieldError}
              inError={stepError(STEP_RISK)}
            />

            <StepAllocation
              c={c}
              householdId={householdId}
              allocation={allocation}
              mandateTargets={mandateTargets}
              weights={weights}
              portfolio={portfolio}
              proposedCount={proposed.length}
              transferItems={transferItems}
              proposed={proposed}
              onWeight={(cls, value) => setWeights((current) => ({ ...current, [cls]: value }))}
              onChosen={setChosen}
              fieldError={fieldError}
              inError={stepError(STEP_ALLOCATION)}
            />

            <StepSign
              c={c}
              title={title}
              householdName={household ? household.name : ''}
              clientName={clientName}
              type={type}
              goalLabel={chosenGoal ? c(chosenGoal.typeKey) : c('wealth.common.none')}
              reviewDate={reviewDate}
              reviewTime={reviewTime}
              horizon={horizon}
              conviction={conviction}
              excluded={excluded}
              esg={esg}
              weights={weights}
              instruments={proposedInstruments}
              mandateValue={portfolio ? portfolio.marketValue : 0}
              onCode={(value) => {
                setCode(value);
                markTouched(STEP_SIGN);
              }}
              fieldError={fieldError}
              inError={stepError(STEP_SIGN)}
            />
          </md-stepper>
        )}
      </Panel>

      {/*
       * THE ONLY DIALOG ON THIS SCREEN.
       *
       * Opened from the stepper's Finish, which sits on the page — not from
       * inside another dialog, and it opens none of its own. The two pickers in
       * step 1 are modals too, which is exactly why the stepper is not wrapped
       * in a dialog: that would have made them dialogs inside a dialog (§7.3).
       */}
      <md-dialog
        ref={dialogRef}
        open={confirmOpen}
        headline={c('wealth.proposal.confirm.headline')}
        icon="fact_check"
        divider
        scrim-dismissible={!submitting}
        locale={c.locale}
      >
        <p>{c('wealth.proposal.confirm.body')}</p>
        <dl className="dl">
          <Fact label={c('wealth.proposal.field.title')}>{title || '—'}</Fact>
          <Fact label={c('wealth.table.household')}>{household ? household.name : '—'}</Fact>
          <Fact label={c('wealth.proposal.field.type')}>
            <ProposalTypeChip type={type} />
          </Fact>
          <Fact label={c('wealth.proposal.summary.instruments')}>
            <Count value={proposed.length} />
          </Fact>
        </dl>

        {/* `class`, not `className` — see the note in `Panel`. The bar appears
            mid-flow when the submit starts, so it needs a gap of its own above
            it: the fact grid ends on a chip and the wave started immediately
            under it, reading as part of the last row. */}
        {submitting ? (
          <md-progress-indicator
            class="submit-progress"
            variant="linear"
            value={progress}
            max={100}
            wave
            label={c('wealth.proposal.submitting')}
          />
        ) : null}

        {/* M3 puts the dismissive action on the LEADING side and the component
            does not reorder them. Neither slotted button closes the dialog on
            its own — that wiring is above. */}
        <md-button ref={cancelRef} slot="actions" variant="text">
          {c('wealth.action.cancel')}
        </md-button>
        <md-button ref={sendRef} slot="actions" variant="filled" loading={submitting}>
          {c('wealth.proposal.confirm.submit')}
        </md-button>
      </md-dialog>

      {/* Brief confirmation of something that already happened, with a single
          reversing action — the snackbar's whole remit (§5.5). Centred on the
          bottom edge like every other toast in the app, and lifted clear of the
          dock and the navigation bar by `.wealth-snackbar`. */}
      <md-snackbar
        ref={snackbarRef}
        class="wealth-snackbar"
        message={c('wealth.proposal.submitted')}
        action={c('wealth.proposal.undo')}
        position="bottom"
        auto-hide-duration={6000}
        dismiss-label={c('wealth.action.close')}
      />
    </>
  );
}

/* ------------------------------------------------------------------ step 1 */

interface StepClientProps {
  c: T;
  households: Household[];
  clients: Client[];
  goals: Goal[];
  householdId: string;
  clientId: string;
  goalId: string;
  type: ProposalType;
  reviewDate: string;
  reviewTime: string;
  onTitle: (value: string) => void;
  onHousehold: (value: string) => void;
  onClient: (value: string) => void;
  onGoal: (value: string) => void;
  onType: (value: ProposalType) => void;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}

function StepClient(props: StepClientProps) {
  const { c, fieldError } = props;

  const titleRef = useMdEvent<string>('mdInput', props.onTitle);
  const householdRef = useMdEvent<string>('mdChange', props.onHousehold);
  const clientRef = useMdEvent<string>('mdChange', props.onClient);
  const goalRef = useMdEvent<string>('mdChange', props.onGoal);
  const dateRef = useMdEvent<{ value: string }>('mdChange', (detail) => props.onDate(detail.value));
  const timeRef = useMdEvent<{ value: string }>('mdChange', (detail) => props.onTime(detail.value));
  const typeRef = useMdDelegate<{ checked: boolean; value: string }>((detail) => {
    if (detail.checked) props.onType(detail.value as ProposalType);
  });

  const err = (field: string) => fieldError(STEP_CLIENT, field);

  return (
    <md-step
      label={c('wealth.proposal.step.client')}
      description={c('wealth.proposal.step.clientHint')}
      editable
      error={props.inError}
      error-text={props.inError ? c(STEP_MESSAGE[STEP_CLIENT]) : ''}
    >
      <div className="stack form-stack">
        <div className="grid-2">
          {/* No `value` prop at all: the field owns its text, and writing state
              back into it on every keystroke would reformat under the caret. */}
          <md-text-field
            ref={titleRef}
            variant="outlined"
            name="proposalTitle"
            label={c('wealth.proposal.field.title')}
            supporting-text={c('wealth.proposal.field.titleHint')}
            error={err('title') !== ''}
            error-text={err('title')}
            reserve-supporting-space
            max-length={80}
            required
          />

          <md-select
            ref={householdRef}
            variant="outlined"
            name="householdId"
            label={c('wealth.proposal.field.household')}
            value={props.householdId}
            supporting-text={c('wealth.proposal.field.householdHint')}
            error={err('household') !== ''}
            error-text={err('household')}
            value-missing-label={c('wealth.proposal.error.household')}
            reserve-supporting-space
            full-width
            required
          >
            {props.households.map((option) => (
              <md-select-option
                key={option.id}
                value={option.id}
                label={option.name}
                supporting-text={c(option.segmentKey)}
              />
            ))}
          </md-select>
        </div>

        <div className="grid-2">
          {/* Re-keyed on the household: the option list AND the default signer
              both move, and a remount is what lets the new default reach the
              element as an initial value rather than as a write. */}
          <md-select
            key={`client-${props.householdId}`}
            ref={clientRef}
            variant="outlined"
            name="clientId"
            label={c('wealth.proposal.field.client')}
            value={props.clientId}
            supporting-text={c('wealth.proposal.field.clientHint')}
            error={err('client') !== ''}
            error-text={err('client')}
            value-missing-label={c('wealth.proposal.error.client')}
            no-options-text={c('wealth.empty.clients')}
            reserve-supporting-space
            full-width
            required
          >
            {props.clients.map((member) => (
              <md-select-option
                key={member.id}
                value={member.id}
                label={member.name}
                supporting-text={c(member.roleKey)}
              />
            ))}
          </md-select>

          <md-select
            key={`goal-${props.householdId}`}
            ref={goalRef}
            variant="outlined"
            name="goalId"
            label={c('wealth.proposal.field.objective')}
            value={props.goalId}
            supporting-text={c('wealth.proposal.field.objectiveHint')}
            clear-label={c('wealth.proposal.field.objectiveNone')}
            no-options-text={c('wealth.empty.goals')}
            reserve-supporting-space
            clearable
            full-width
          >
            {props.goals.map((goal) => (
              <md-select-option
                key={goal.id}
                value={goal.id}
                label={c(goal.typeKey)}
                supporting-text={c('wealth.goal.monthsRemaining', {
                  count: goal.monthsRemaining,
                })}
              />
            ))}
          </md-select>
        </div>

        {/*
         * Five mutually exclusive options, all visible — §5.3 puts that on
         * `md-radio`, not on a select. `md-radio` has no slot, so each one is
         * wrapped in a native `<label>` (which names it and enlarges the hit
         * target), and the GROUP's name comes from a wrapper, because the
         * component cannot supply it. One delegated listener is enough: the
         * radios' `mdChange` bubbles and is composed.
         */}
        <div
          role="radiogroup"
          aria-labelledby="proposal-type-label"
          className="stack"
          ref={typeRef}
        >
          <p id="proposal-type-label" className="field-label">
            {c('wealth.proposal.field.type')}
          </p>
          <div className="row">
            {PROPOSAL_TYPES.map((option) => (
              <label key={option} className="row" style={{ cursor: 'pointer' }}>
                <md-radio
                  name="proposalType"
                  value={option}
                  checked={option === props.type}
                  required
                  value-missing-label={c('wealth.proposal.error.step1')}
                />
                <span>{c(`wealth.proposalType.${option}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* §7.2: a date picker and a time picker are a pair. Both are their own
            modal, which is exactly why the stepper is not inside one. */}
        <div className="grid-2">
          <md-date-picker
            key={`date-${props.householdId}`}
            ref={dateRef}
            name="reviewDate"
            label={c('wealth.proposal.field.reviewDate')}
            value={props.reviewDate}
            min={REPORTING_DATE}
            locale={c.locale}
            field-variant="outlined"
            supporting-text={c('wealth.proposal.field.reviewDateHint')}
            error={err('date') !== ''}
            error-text={err('date')}
            reserve-supporting-space
            clearable
            required
            {...datePickerLabels(c)}
          />

          {/* Its own `error` / `error-text` / `reserve-supporting-space`, the
              same three the date picker beside it uses. The message used to be
              a `FieldError` paragraph in a wrapping stack, because the
              component had no way to hold one — which meant it also had no
              reserved line, so every appearance pushed the form below it down.
              The props exist now; the wrapper does not. */}
          <md-time-picker
            ref={timeRef}
            name="reviewTime"
            label={c('wealth.proposal.field.reviewTime')}
            value={props.reviewTime}
            format="24h"
            minute-step={15}
            min="08:00"
            max="19:00"
            supporting-text={c('wealth.proposal.field.reviewTimeHint')}
            error={err('time') !== ''}
            error-text={err('time')}
            reserve-supporting-space
            responsive
            required
            {...timePickerLabels(c)}
          />
        </div>
      </div>
    </md-step>
  );
}

/* ------------------------------------------------------------------ step 2 */

interface StepRiskProps {
  c: T;
  household: Household | undefined;
  goal: Goal | undefined;
  horizon: number;
  conviction: number;
  excluded: InstrumentType[];
  esg: boolean;
  onHorizon: (value: number) => void;
  onConviction: (value: number) => void;
  onExcluded: (next: (current: InstrumentType[]) => InstrumentType[]) => void;
  onEsg: (value: boolean) => void;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}

function StepRisk(props: StepRiskProps) {
  const { c, fieldError } = props;

  // `mdInput` rather than `mdChange`: the horizon rule has to recompute while
  // the thumb moves, or the advisor drags past the objective and only learns
  // about it after letting go.
  const sliderRef = useMdEvent<{ value: number }>('mdInput', (detail) =>
    props.onHorizon(detail.value),
  );
  const ratingRef = useRatingRef(c, props.onConviction);
  const switchRef = useMdEvent<{ selected: boolean }>('mdChange', (detail) =>
    props.onEsg(detail.selected),
  );
  const constraintsRef = useMdDelegate<{ checked: boolean }>((detail, target) => {
    const value = target.getAttribute('value') as InstrumentType | null;
    if (!value) return;
    props.onExcluded((current) =>
      detail.checked
        ? current.includes(value)
          ? current
          : [...current, value]
        : current.filter((entry) => entry !== value),
    );
  });

  const err = (field: string) => fieldError(STEP_RISK, field);

  return (
    <md-step
      label={c('wealth.proposal.step.risk')}
      description={c('wealth.proposal.step.riskHint')}
      editable
      error={props.inError}
      error-text={props.inError ? c(STEP_MESSAGE[STEP_RISK]) : ''}
    >
      {/*
       * Two cards, not a 2×2 grid of bare stacks.
       *
       * The four groups used to sit in two `.grid-2` rows — horizon beside
       * conviction, constraints beside ESG — which made the reading unit a ROW,
       * so the eye crossed the panel twice and the two halves never separated.
       * They are really two columns of related settings: what the money does
       * (how long, and what it may not hold) on the left, what the advisor
       * thinks of it (conviction, screening, and the mandate's own strategy) on
       * the right. One card each says that, and `.grid-2` stretches them so the
       * pair reads as a matched pair however uneven the contents are.
       *
       * `class`, not `className` — see the note in `Panel`: React passes an
       * unknown prop through verbatim on a custom element, so `className` on an
       * `md-*` would emit a literal `className` attribute that matches nothing.
       */}
      <div className="grid-2">
        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack form-stack">
            <div className="stack">
              <p className="field-label">{c('wealth.proposal.field.horizon')}</p>
              {/* A bounded value the advisor feels rather than types (§5.3). The
                unit is months, so the objective rule is a comparison and not a
                conversion. A single-thumb slider is named by `aria-label`, and
                `value-text` is what stops a screen reader announcing a bare
                number. */}
              <md-slider
                ref={sliderRef}
                name="horizonMonths"
                aria-label={c('wealth.proposal.field.horizon')}
                min={HORIZON_MIN}
                max={HORIZON_MAX}
                step={HORIZON_STEP}
                value={HORIZON_DEFAULT}
                size="md"
                value-indicator
                value-text={c('wealth.unit.months', { value: props.horizon })}
              />
              <FieldNote
                error={err('horizon')}
                hint={
                  <>
                    {c('wealth.proposal.field.horizonHint')}
                    {props.goal
                      ? ` · ${c('wealth.goal.monthsRemaining', { count: props.goal.monthsRemaining })}`
                      : ''}
                  </>
                }
              />
            </div>

            {/*
             * Several of a few, all visible — checkboxes, not a multi-select
             * (§5.3). `md-checkbox` has no slot either, so each is wrapped in a
             * `<label>`. One delegated `mdChange` on the group is enough because
             * the event bubbles and is composed, and a composed event retargets
             * to the checkbox host, so `event.target` is the element carrying
             * the value.
             */}
            <div className="stack" ref={constraintsRef}>
              <p className="field-label">{c('wealth.proposal.field.constraints')}</p>
              {INSTRUMENT_TYPES.map((instrumentType) => (
                <label key={instrumentType} className="row" style={{ cursor: 'pointer' }}>
                  <md-checkbox
                    name="excludedTypes"
                    value={instrumentType}
                    checked={props.excluded.includes(instrumentType)}
                  />
                  <span>{c(`wealth.instrumentType.${instrumentType}`)}</span>
                </label>
              ))}
              <FieldNote
                hint={c('wealth.proposal.field.constraintsHint')}
                error={err('constraints')}
              />
            </div>
          </div>
        </md-card>

        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack form-stack">
            <div className="stack">
              <p className="field-label">{c('wealth.proposal.field.conviction')}</p>
              {/* A subjective score on a small scale — §5.3 sends that to
                  `md-rating` and away from a slider. */}
              <md-rating
                ref={ratingRef}
                name="conviction"
                max={CONVICTION_MAX}
                precision={1}
                size="lg"
                show-value-label
                rating-label={c('wealth.proposal.field.conviction')}
              />
              <FieldNote
                hint={c('wealth.proposal.field.convictionHint')}
                error={err('conviction')}
              />
            </div>

            <div className="stack">
              <p className="field-label">{c('wealth.proposal.field.esg')}</p>
              {/* An immediate setting with no save step — a switch, not a
                  checkbox (§5.3). It re-screens the universe the moment it
                  flips, which is what "immediate" has to mean here. */}
              <label className="row" style={{ cursor: 'pointer' }}>
                <md-switch ref={switchRef} name="esgScreening" icons selected={props.esg} />
                <span>{c('wealth.proposal.field.esgHint')}</span>
              </label>

              <dl className="dl">
                <Fact label={c('wealth.table.strategy')}>
                  {props.household ? <StrategyChip strategy={props.household.strategy} /> : '—'}
                </Fact>
                <Fact label={c('wealth.table.riskProfile')}>
                  {props.household ? c(props.household.riskProfileKey) : '—'}
                </Fact>
              </dl>
            </div>
          </div>
        </md-card>
      </div>
    </md-step>
  );
}

/* ------------------------------------------------------------------ step 3 */

interface TransferItem {
  value: string;
  label: string;
  description: string;
  disabled: boolean;
}

interface StepAllocationProps {
  c: T;
  householdId: string;
  allocation: AllocationRow[];
  mandateTargets: Record<AssetClass, number>;
  weights: Record<AssetClass, number>;
  portfolio: Portfolio | undefined;
  proposedCount: number;
  transferItems: TransferItem[];
  proposed: string[];
  onWeight: (cls: AssetClass, value: number) => void;
  onChosen: (next: string[]) => void;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}

function StepAllocation(props: StepAllocationProps) {
  const { c, fieldError } = props;
  const transferRef = useTransferList(props.transferItems, props.proposed, props.onChosen);
  const err = (field: string) => fieldError(STEP_ALLOCATION, field);

  return (
    <md-step
      label={c('wealth.proposal.step.allocation')}
      description={c('wealth.proposal.step.allocationHint')}
      editable
      error={props.inError}
      error-text={props.inError ? c(STEP_MESSAGE[STEP_ALLOCATION]) : ''}
    >
      {/*
       * Two cards STACKED, not side by side.
       *
       * Side by side they were 931 and 465, and the weights grid could only fit
       * three columns in 931 — so five asset classes wrapped to 3 + 2 and left a
       * hole where the sixth would go. Full width fits all five on one line,
       * which is the row a reader actually wants: five weights that have to add
       * up, readable in a single pass. The total that judges them then sits
       * directly underneath, which is also the order you check it in.
       */}
      <div className="stack form-stack">
        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack">
            <p className="field-label">{c('wealth.proposal.alloc.title')}</p>
            <p className="muted">{c('wealth.proposal.alloc.hint')}</p>
            {/* Re-keyed on the household so each field takes the new
                  mandate's target as an initial value. Within one household
                  React never writes to these elements. */}
            <div className="grid-3 weight-grid" key={`weights-${props.householdId}`}>
              {ASSET_CLASS_ORDER.map((cls) => (
                <WeightField
                  key={cls}
                  c={c}
                  assetClass={cls}
                  initial={props.mandateTargets[cls]}
                  actual={props.allocation.find((row) => row.assetClass === cls)?.actualWeight ?? 0}
                  onChange={props.onWeight}
                />
              ))}
            </div>
          </div>
        </md-card>

        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack">
            {/*
             * A read-only value inside a known range — `md-meter`, not
             * `md-progress-indicator`: nothing here is loading (§5.5). The
             * colour comes from the kit's `driftColor`, which is literally the
             * right map: the distance from a balanced book IS a drift, and it
             * uses the same 2% / 5% bands the fixture classifies an allocation
             * on, so an over-allocated draft is the same amber as an
             * over-allocated mandate everywhere else in the console.
             */}
            <RatioMeter
              label={c('wealth.proposal.alloc.total')}
              fraction={draftMaths.total(props.weights)}
              color={driftColor(draftMaths.imbalance(props.weights))}
              max={1}
            />
            <FieldNote hint={c('wealth.proposal.alloc.zeroed')} error={err('weights')} />
            <dl className="dl">
              <Fact label={c('wealth.proposal.summary.instruments')}>
                <Count value={props.proposedCount} />
              </Fact>
              <Fact label={c('wealth.kpi.aum.short')}>
                {props.portfolio ? <Money value={props.portfolio.marketValue} compact /> : '—'}
              </Fact>
            </dl>
          </div>
        </md-card>

        <div className="stack">
          <p className="field-label">{c('wealth.proposal.instruments.title')}</p>
          {/*
           * Assigning a subset out of a bounded pool with both sides visible —
           * §5.3's row for `md-transfer-list`. `items` and `value` are JS
           * properties (`value` has no attribute at all), so they go through
           * `useElementProps`. The four mover glyphs are left at their defaults
           * because the stylesheet mirrors them under `dir="rtl"` and passing
           * pre-mirrored names would flip them twice.
           */}
          <md-transfer-list
            ref={transferRef}
            source-title={c('wealth.proposal.transfer.source')}
            target-title={c('wealth.proposal.transfer.target')}
            source-search-placeholder={c('wealth.proposal.transfer.searchSource')}
            target-search-placeholder={c('wealth.proposal.transfer.searchTarget')}
            count-template={c('wealth.proposal.transfer.count')}
            empty-text={c('wealth.proposal.transfer.empty')}
            empty-icon="inventory_2"
            move-right-label={c('wealth.proposal.transfer.moveRight')}
            move-left-label={c('wealth.proposal.transfer.moveLeft')}
            move-all-right-label={c('wealth.proposal.transfer.moveAllRight')}
            move-all-left-label={c('wealth.proposal.transfer.moveAllLeft')}
            density="-1"
            full-width
            style={{ '--md-transfer-list-height': '360px' } as CSSProperties}
          />
          <FieldNote hint={c('wealth.proposal.instruments.hint')} error={err('instruments')} />
        </div>
      </div>
    </md-step>
  );
}

/**
 * One asset class's proposed weight.
 *
 * Its own component so its `mdInput` listener is a hook at the top of a
 * component rather than a hook inside a `.map()`.
 */
function WeightField({
  c,
  assetClass,
  initial,
  actual,
  onChange,
}: {
  c: T;
  assetClass: AssetClass;
  initial: number;
  actual: number;
  onChange: (cls: AssetClass, value: number) => void;
}) {
  const ref = useMdEvent<{ value: number | null }>('mdInput', (detail) =>
    onChange(assetClass, detail.value === null ? 0 : detail.value),
  );

  return (
    <div className="stack weight-field">
      <AssetClassChip assetClass={assetClass} />
      {/* A number with steppers and locale formatting — §5.2 rules out
          `md-text-field type="number"` here. `style: percent` keeps the VALUE a
          fraction, which is the fixture's convention for every ratio, so 0.35
          in state renders as 35% on screen with no multiplication anywhere. */}
      <md-number-field
        ref={ref}
        variant="outlined"
        name={`weight-${assetClass}`}
        label={c('wealth.proposal.field.weight')}
        value={initial}
        min={0}
        max={1}
        step={0.01}
        small-step={0.005}
        large-step={0.05}
        snap-on-step
        locale={c.locale}
        format-options={'{"style":"percent","maximumFractionDigits":1}'}
        increment-label={c('wealth.proposal.field.weight')}
        decrement-label={c('wealth.proposal.field.weight')}
      />
      <p className="muted">
        {c('wealth.table.actual')} <Percent value={actual} digits={1} />
        {' · '}
        {c('wealth.proposal.alloc.mandateTarget')} <Percent value={initial} digits={1} />
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ step 4 */

interface StepSignProps {
  c: T;
  title: string;
  householdName: string;
  clientName: string;
  type: ProposalType;
  goalLabel: string;
  reviewDate: string;
  reviewTime: string;
  horizon: number;
  conviction: number;
  excluded: InstrumentType[];
  esg: boolean;
  weights: Record<AssetClass, number>;
  instruments: Instrument[];
  mandateValue: number;
  onCode: (value: string) => void;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}

function StepSign(props: StepSignProps) {
  const { c, fieldError } = props;
  const otpRef = useMdEvent<string>('mdInput', props.onCode);
  const codeError = fieldError(STEP_SIGN, 'code');

  return (
    <md-step
      label={c('wealth.proposal.step.sign')}
      description={c('wealth.proposal.step.signHint')}
      error={props.inError}
      error-text={props.inError ? c(STEP_MESSAGE[STEP_SIGN]) : ''}
    >
      {/* Two cards, same as the two steps before it: what is being signed on the
          left, what it holds on the right. The code stays at the foot of the
          summary card — it belongs to the thing it signs, and carrying it there
          is also what brings the two columns to within 70px of each other
          instead of 550. */}
      <div className="grid-wide">
        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack">
            <p className="field-label">{c('wealth.proposal.summary.title')}</p>
            <p className="muted">{c('wealth.proposal.summary.hint')}</p>

            <dl className="dl">
              <Fact label={c('wealth.proposal.field.title')}>{props.title || '—'}</Fact>
              <Fact label={c('wealth.table.household')}>{props.householdName || '—'}</Fact>
              <Fact label={c('wealth.proposal.field.client')}>{props.clientName || '—'}</Fact>
              <Fact label={c('wealth.proposal.field.type')}>
                <ProposalTypeChip type={props.type} />
              </Fact>
              <Fact label={c('wealth.proposal.field.objective')}>{props.goalLabel}</Fact>
              <Fact label={c('wealth.proposal.summary.meeting')}>
                {props.reviewDate ? (
                  <>
                    <DateText value={props.reviewDate} />
                    {props.reviewTime ? ` · ${props.reviewTime}` : ''}
                  </>
                ) : (
                  '—'
                )}
              </Fact>
              <Fact label={c('wealth.proposal.summary.horizon')}>
                {c('wealth.unit.months', { value: props.horizon })}
              </Fact>
              <Fact label={c('wealth.proposal.field.conviction')}>
                {c('wealth.proposal.summary.conviction', {
                  value: props.conviction,
                  max: CONVICTION_MAX,
                })}
              </Fact>
              <Fact label={c('wealth.proposal.field.esg')}>
                {props.esg
                  ? c('wealth.proposal.summary.esgOn')
                  : c('wealth.proposal.summary.esgOff')}
              </Fact>
              <Fact label={c('wealth.proposal.summary.mandateValue')}>
                <Money value={props.mandateValue} />
              </Fact>
            </dl>

            <div className="alloc-summary">
              {ASSET_CLASS_ORDER.filter((cls) => (props.weights[cls] || 0) > 0).map((cls) => (
                <span key={cls}>
                  <AssetClassChip assetClass={cls} />
                  <Percent value={props.weights[cls]} digits={1} />
                </span>
              ))}
            </div>

            {props.excluded.length > 0 ? (
              <div className="row">
                <span className="muted">{c('wealth.proposal.summary.excluded')}</span>
                {props.excluded.map((entry) => (
                  <md-chip
                    key={entry}
                    variant="assist"
                    appearance="outlined"
                    color="warning"
                    icon="block"
                    label={c(`wealth.instrumentType.${entry}`)}
                  />
                ))}
              </div>
            ) : null}

            {/*
             * The code sits with the summary it signs, and at the foot of it.
             *
             * Three placements were measured. At the foot of the RIGHT column,
             * under eight instruments and a "N more" line, the one thing the
             * advisor has to DO on this step was buried last in the secondary
             * column. Below both columns, it was reachable but left a 550px
             * hole in the middle of the panel, because the instrument list made
             * the right column 636px against the summary's 325px — a hole in
             * the middle reads as something that failed to load, which a hole
             * at the end does not. Here the summary column carries it, which
             * both puts it in reading order (what is being signed, then the box
             * that signs it) and closes most of that height gap from the short
             * side rather than by truncating the list further.
             */}
            <div className="sign-block">
              {/*
               * A one-time code goes in `md-otp-field`, never a row of text
               * fields (§5.2). `incomplete-label` is what makes a half-typed
               * code invalid rather than merely empty.
               *
               * NO `error` HERE, deliberately. A partly-typed code is not a
               * mistake, it is a code that is not finished yet — and because
               * the message recomputes on every keystroke, painting it red
               * turned all six cells red from the first digit to the sixth and
               * told the advisor off for typing. The message still appears; it
               * just arrives as supporting text, in the line the hint was
               * already occupying, so nothing moves and nothing shouts. What
               * actually enforces the rule is `next-disabled` on the stepper,
               * which is where a confirming action belongs.
               */}
              <md-otp-field
                ref={otpRef}
                name="confirmationCode"
                length={CODE_LENGTH}
                validation-type="numeric"
                group-size={3}
                label={c('wealth.proposal.field.code')}
                supporting-text={codeError || c('wealth.proposal.field.codeHint')}
                cell-label-template={c('wealth.proposal.field.codeCell')}
                value-missing-label={c('wealth.proposal.error.code')}
                incomplete-label={c('wealth.proposal.error.code')}
                reserve-supporting-space
                required
              />
            </div>
          </div>
        </md-card>

        <md-card variant="outlined" full-width class="surface-card step-card">
          <div className="stack">
            <div className="row row--between">
              <p className="field-label">{c('wealth.proposal.summary.instruments')}</p>
              <Count value={props.instruments.length} />
            </div>
            {/* A vertical set of records, not a table (§5.5). `lines` matches what
              is actually passed — a headline and one supporting line. */}
            <md-list aria-label={c('wealth.proposal.summary.instruments')}>
              {props.instruments.slice(0, SUMMARY_LIST_LIMIT).map((instrument) => (
                <md-list-item
                  key={instrument.id}
                  lines={2}
                  headline={instrument.name}
                  supporting-text={c('wealth.proposal.instruments.meta', {
                    ticker: instrument.ticker,
                    assetClass: c(instrument.assetClassKey),
                    currency: instrument.currency,
                  })}
                />
              ))}
            </md-list>
            {props.instruments.length > SUMMARY_LIST_LIMIT ? (
              <p className="muted">
                {c('wealth.common.more', {
                  count: props.instruments.length - SUMMARY_LIST_LIMIT,
                })}
              </p>
            ) : null}
          </div>
        </md-card>
      </div>
    </md-step>
  );
}

/* ------------------------------------------------------------- sub-renders */

function SubmittedNotice({ c, title, onRestart }: { c: T; title: string; onRestart: () => void }) {
  const restartRef = useMdEvent<unknown>('mdClick', () => onRestart());

  return (
    <div className="stack">
      <div className="row">
        <md-chip
          variant="assist"
          appearance="filled"
          color="success"
          icon="check"
          label={c('wealth.proposal.builder.done')}
        />
        <span className="strong">{title}</span>
      </div>
      <p className="muted">{c('wealth.proposal.builder.doneHint')}</p>
      <div className="row row--end">
        <md-button ref={restartRef} variant="tonal" icon="note_add">
          {c('wealth.proposal.builder.restart')}
        </md-button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- ref hooks */

/*
 * React 18 maps no `md*` event to a prop, so every one of them needs a real
 * listener. These wrappers keep that out of the JSX; each returns the ref to
 * hand straight to the element. They are hooks, so every call site is at the
 * top of a component — never inside a `.map()` and never behind a condition.
 */

/** One `md*` listener on one element. */
function useMdEvent<D>(
  name: string,
  handler: (detail: D) => void,
): MutableRefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<D>>(ref, name, (event) => handler(event.detail));
  return ref;
}

/**
 * `mdChange` DELEGATED to a container.
 *
 * A radio group and a checkbox list are several elements answering one
 * question; their `mdChange` bubbles and is composed, so one listener on the
 * wrapper beats N refs. A composed event retargets to the shadow HOST, so
 * `event.target` is always the `md-radio` / `md-checkbox` itself and its
 * `value` can be read straight off it.
 */
function useMdDelegate<D>(
  handler: (detail: D, target: HTMLElement) => void,
): (node: HTMLElement | null) => void {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<D>>(ref, 'mdChange', (event) => {
    const target = event.target as HTMLElement | null;
    if (target) handler(event.detail, target);
  });
  return (node: HTMLElement | null) => {
    ref.current = node;
  };
}

/**
 * `md-rating`'s `getLabel` is a FUNCTION prop — no attribute form, so it is
 * assigned to the instance. It drives both `aria-valuetext` and the visible
 * value label, which makes it the single most useful i18n hook the component
 * has.
 */
function useRatingRef(c: T, onChange: (value: number) => void) {
  const ref = useElementProps<HTMLElement>(
    {
      getLabel: (value: number) =>
        c('wealth.proposal.summary.conviction', { value, max: CONVICTION_MAX }),
    },
    [c.locale],
  );
  useCustomEvent<CustomEvent<number>>(ref, 'mdChange', (event) => onChange(event.detail));
  return ref;
}

/** `items` and `value` are JS properties on `md-transfer-list`. */
function useTransferList(
  items: TransferItem[],
  value: string[],
  onChange: (next: string[]) => void,
) {
  const signature = items.map((item) => `${item.value}${item.disabled ? '!' : ''}`).join('|');
  const ref = useElementProps<HTMLElement>({ items, value }, [signature, value.join('|')]);
  useCustomEvent<CustomEvent<string[]>>(ref, 'mdChange', (event) => onChange(event.detail));
  return ref;
}
