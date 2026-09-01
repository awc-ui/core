<!--
  The proposal builder — `md-stepper` driving a four-step advice document.

  THE COMPOSITION RULE THIS FILE EXISTS TO OBEY (§7.3). A dialog opened from
  inside a dialog is always wrong, so a multi-step flow is `md-stepper` inside
  ONE `md-dialog` — at most. Here it is inside NONE, and that is forced by the
  flow rather than by taste: step 1 opens `md-date-picker` and
  `md-time-picker`, and each of those IS its own modal (§7.2: "the picker is
  its own dialog — don't nest it in another one"). Put the stepper in a dialog
  and every meeting date the advisor picks becomes a dialog inside a dialog. So
  the stepper lives on the page, and the single `md-dialog` on this screen is
  the submit confirmation — opened from the page, with nothing above it.

  WHY EVERY CONTROL IS UNCONTROLLED. These components own their value and
  treat a property write as a commit: `md-number-field`'s readme says a
  programmatic write "reformats the display". Feeding state back into `value`
  on every keystroke therefore rewrites the box while the user is inside it.
  So a field is authored with an INITIAL value that only moves when the thing
  it derives from moves, state is updated from the component's own `md*` event,
  and a `{#key}` block remounts the subtree when the household changes and the
  defaults genuinely have to change with it. (The initial values here are bound
  to derivations of `householdId` alone, so within one household Svelte never
  rewrites them — the remount is the only delivery route for a new default.)

  VALIDATION IS REAL, and enforced where `md-stepper`'s readme says to enforce
  it. `mdBeforeChange` is cancelable: an invalid step vetoes the forward move,
  paints itself `error` with `error-text`, and turns on the inline error of
  every field that failed. Finish is the one exception — it is gated
  declaratively with `next-disabled`, because M3 wants a confirming action
  disabled until the choice is made, and a signature is not something to veto
  after the fact.

  WHERE THE REACT BUILD SPLIT EVERY STEP INTO ITS OWN COMPONENT, this file
  does not: that split existed so `md*` listener HOOKS stayed unconditional,
  and Svelte's `on:` directives bind per element on that element's mount, so a
  conditionally-rendered control gets its listener the moment it appears.
  `md-step` stays a DIRECT child of `md-stepper` either way — the only thing
  the stepper cares about (§7.1).

  ARITHMETIC. Rule zero says arithmetic belongs in the kit. What survives here
  is quarantined in `draftMaths`, because it is about a DRAFT the fixture does
  not contain and there is nothing in `derive.ts` to call. It is listed in the
  hand-off notes as a kit candidate.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
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
    type Goal,
    type Instrument,
    type InstrumentType,
    type ProposalType,
  } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import { objectProps } from '$lib/elements';
  import Panel from '$lib/components/Panel.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import RatioMeter from '$lib/bits/RatioMeter.svelte';
  import { datePickerLabels, timePickerLabels } from './proposal-copy';
  import './snackbar.css';

  /** Re-key the whole form — see `ProposalBuilder.svelte`. */
  export let onRestart: () => void;

  /* ---------------------------------------------------------- enumerations */

  /*
   * The two domain enumerations this form offers as choices.
   *
   * `Record<Union, number>` rather than an array so TypeScript demands every
   * member: adding a proposal type to the kit fails the build here instead of
   * silently dropping a radio. The kit exports `ASSET_CLASS_ORDER` for the
   * third enumeration and nothing equivalent for these two — see the hand-off
   * notes.
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

  /* ------------------------------------------------------------- constants */

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

  /* ----------------------------------------------------------- draft maths */

  /**
   * The arithmetic this screen cannot push into the kit.
   *
   * Every figure the fixture carries is derived in `derive.ts`; these are
   * about a DRAFT that does not exist there, so there is nothing to call.
   * Collected in one object rather than scattered through the markup so that
   * the day the kit grows an allocation-draft helper there is exactly one
   * place to delete.
   *
   * `balanced` needs a tolerance because five fractions summed in binary
   * floating point miss 1 by about 1e-16. The tolerance is a twentieth of the
   * smallest step the field offers, so it can never accept a total the user
   * typed wrong.
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

  /* ------------------------------------------------------------ form state */

  interface Failure {
    step: number;
    field: string;
    key: string;
  }

  const households = getHouseholds();
  const universe = getInstruments();
  const firstHousehold = households.length > 0 ? households[0] : undefined;

  /* ------------------------------------------------------------ step 1 */

  let title = '';
  let householdId = firstHousehold ? firstHousehold.id : '';
  let clientId = '';
  let goalId = '';
  let type: ProposalType = PROPOSAL_TYPES[0];
  let reviewDate = '';
  // Deliberately empty: the fixture has no meeting time, and an invented
  // default would let the advisor skip a decision the flow says is required.
  let reviewTime = '';

  $: household = households.find((h) => h.id === householdId);
  $: portfolio = householdId ? getPortfolioFor(householdId) : undefined;
  $: clients = householdId ? getClientsFor(householdId) : [];
  $: goals = householdId ? getGoalsFor(householdId) : [];
  $: allocation = householdId ? getAllocationFor(householdId) : [];
  $: mandateTargets = targetsFor(allocation);

  /* ------------------------------------------------------------ step 2 */

  let horizon = HORIZON_DEFAULT;
  let conviction = 0;
  let excluded: InstrumentType[] = [];
  let esg = false;

  /* ------------------------------------------------------------ step 3 */

  let weights: Record<AssetClass, number> = targetsFor(
    firstHousehold ? getAllocationFor(firstHousehold.id) : [],
  );
  let chosen: string[] = [];

  /* ------------------------------------------------------------ step 4 */

  let code = '';

  /* --------------------------------------------------------- flow state */

  let active = STEP_CLIENT;
  let touched: boolean[] = [false, false, false, false];
  let confirmOpen = false;
  let submitting = false;
  let progress = 0;
  let submitted = false;

  function markTouched(step: number) {
    touched = touched.map((was, index) => (index === step ? true : was));
  }

  /*
   * Seed everything that hangs off the household, on init and on every change.
   *
   * One statement rather than five, because they are one decision: which
   * mandate the advice is for. Every value it writes comes from the fixture —
   * the primary member (`getClientsFor` returns them first), the mandate's
   * real next review date, its target allocation, and the instruments it
   * actually holds. Nothing here is invented and nothing here is a clock.
   */
  $: seedHousehold(householdId);

  function seedHousehold(id: string) {
    if (!id) return;
    const members = getClientsFor(id);
    clientId = members.length > 0 ? members[0].id : '';
    goalId = '';
    weights = targetsFor(getAllocationFor(id));
    const mandate = getPortfolioFor(id);
    chosen = mandate ? getPositionsFor(mandate.id).map((p) => p.instrumentId) : [];
    const owner = getHouseholds().find((h) => h.id === id);
    reviewDate = owner ? owner.nextReviewDate : '';
  }

  /* ----------------------------------------------- the eligible universe */

  /**
   * Whether an instrument may be proposed at all.
   *
   * Three of the form's own answers feed this, which is what makes the four
   * steps a flow rather than four unrelated pages: excluding a type in step 2,
   * turning ESG screening on in step 2, and zeroing a class in step 3 each
   * take instruments off the table.
   */
  $: excludedSet = new Set<string>(excluded);
  $: eligible = (instrument: Instrument): boolean =>
    !excludedSet.has(instrument.type) &&
    !(esg && instrument.sector === 'energy') &&
    (weights[instrument.assetClass] || 0) > 0;

  /*
   * The proposed set, pruned to what is still eligible.
   *
   * `md-transfer-list` never moves a `disabled` item in EITHER direction, so
   * an instrument that becomes ineligible after it was added would be stranded
   * in the proposal with no way to take it out. Deriving the value instead of
   * storing it means the pruned ones are simply re-partitioned back to the
   * source column on the next assignment, where their disabled state is
   * honest.
   */
  const byId = new Map(universe.map((instrument) => [instrument.id, instrument] as const));
  $: proposed = chosen.filter((id) => {
    const instrument = byId.get(id);
    return instrument !== undefined && eligible(instrument);
  });

  $: proposedInstruments = proposed
    .map((id) => universe.find((instrument) => instrument.id === id))
    .filter((instrument): instrument is Instrument => instrument !== undefined);

  interface TransferItem {
    value: string;
    label: string;
    description: string;
    disabled: boolean;
  }

  $: transferItems = universe.map(
    (instrument): TransferItem => ({
      value: instrument.id,
      label: instrument.name,
      description: $t('wealth.proposal.instruments.meta', {
        ticker: instrument.ticker,
        assetClass: $t(instrument.assetClassKey),
        currency: instrument.currency,
      }),
      disabled: !eligible(instrument),
    }),
  );

  /*
   * `items` and `value` are JS properties on `md-transfer-list` (`value` has
   * no attribute at all), assigned by hand and KEYED on a disabled-signature
   * string plus the value list — the same deps the React build's
   * `useTransferList` used — so a recompute that changed nothing the list
   * cares about does not re-assign `items` and reset the list's own state.
   */
  let transferEl: HTMLElement | undefined;
  $: transferSignature = transferItems
    .map((item) => `${item.value}${item.disabled ? '!' : ''}`)
    .join('|');
  $: transferValueKey = proposed.join('|');
  $: applyTransfer(transferEl, transferSignature, transferValueKey);

  function applyTransfer(el: HTMLElement | undefined, _signature: string, _valueKey: string) {
    if (!el) return;
    const host = el as unknown as { items: TransferItem[]; value: string[] };
    host.items = transferItems;
    host.value = proposed;
  }

  function onTransferChange(event: Event) {
    chosen = (event as CustomEvent<string[]>).detail;
  }

  /* ------------------------------------------------------------ validation */

  $: chosenGoal = goals.find((goal) => goal.id === goalId);

  /**
   * Every rule as a flat table of `{ step, field, message }`.
   *
   * One list read by three consumers: the step's `error-text`, each field's
   * own inline error, and the `mdBeforeChange` veto. Splitting them would let
   * a rule block a step without ever saying which field failed.
   */
  $: failures = computeFailures(
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
  );

  function computeFailures(
    titleNow: string,
    householdNow: string,
    clientNow: string,
    dateNow: string,
    timeNow: string,
    convictionNow: number,
    goalNow: Goal | undefined,
    horizonNow: number,
    excludedNow: InstrumentType[],
    weightsNow: Record<AssetClass, number>,
    proposedNow: string[],
    codeNow: string,
  ): Failure[] {
    const rules: Failure[] = [];

    if (titleNow.trim().length < 6) {
      rules.push({ step: STEP_CLIENT, field: 'title', key: 'wealth.proposal.error.title' });
    }
    if (!householdNow) {
      rules.push({ step: STEP_CLIENT, field: 'household', key: 'wealth.proposal.error.household' });
    }
    if (!clientNow) {
      rules.push({ step: STEP_CLIENT, field: 'client', key: 'wealth.proposal.error.client' });
    }
    if (!dateNow) {
      rules.push({ step: STEP_CLIENT, field: 'date', key: 'wealth.proposal.error.date' });
    }
    if (!timeNow) {
      rules.push({ step: STEP_CLIENT, field: 'time', key: 'wealth.proposal.error.time' });
    }

    if (convictionNow < 1) {
      rules.push({ step: STEP_RISK, field: 'conviction', key: 'wealth.proposal.error.conviction' });
    }
    // The horizon is in months and so is `monthsRemaining`, so "the money has
    // to stay invested until the objective falls due" is a comparison rather
    // than a calculation.
    if (goalNow && horizonNow < goalNow.monthsRemaining) {
      rules.push({ step: STEP_RISK, field: 'horizon', key: 'wealth.proposal.error.horizon' });
    }
    if (excludedNow.length >= INSTRUMENT_TYPES.length) {
      rules.push({
        step: STEP_RISK,
        field: 'constraints',
        key: 'wealth.proposal.error.constraints',
      });
    }

    if (!draftMaths.balanced(weightsNow)) {
      rules.push({ step: STEP_ALLOCATION, field: 'weights', key: 'wealth.proposal.error.weights' });
    }
    if (proposedNow.length === 0) {
      rules.push({
        step: STEP_ALLOCATION,
        field: 'instruments',
        key: 'wealth.proposal.error.instruments',
      });
    }

    if (codeNow.length < CODE_LENGTH) {
      rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.code' });
    } else if (/^(\d)\1+$/.test(codeNow)) {
      rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.codeRepeat' });
    }

    return rules;
  }

  function stepValid(step: number): boolean {
    return !failures.some((failure) => failure.step === step);
  }

  /*
   * Finish is gated on the WHOLE form, not just on the step it sits in.
   *
   * `auto-complete` marks a step completed the moment you leave it, and
   * `mode="linear"` then lets you jump forward past it — so an advisor can
   * pass step 1, come back, blank the title, and walk forward again to a
   * Finish button that only ever looked at step 4. Reading `failures.length`
   * closes that, and the guard on `mdComplete` marks every failing step
   * touched so the red one is visible rather than merely blocking.
   */
  $: formValid = failures.length === 0;

  /** The inline message for one field, or `''` while its step is untouched. */
  $: fieldError = (step: number, field: string): string => {
    if (!touched[step]) return '';
    const hit = failures.find((failure) => failure.step === step && failure.field === field);
    return hit ? $t(hit.key) : '';
  };

  /** `error` per step — `touched[step] && !stepValid(step)`, inlined so the
      reactive statement sees `failures` as a dependency. */
  $: stepErrors = [STEP_CLIENT, STEP_RISK, STEP_ALLOCATION, STEP_SIGN].map(
    (step) => touched[step] && failures.some((failure) => failure.step === step),
  );

  /* ---------------------------------------------------------- the stepper */

  function onBeforeChange(event: Event) {
    const { index, previous } = (event as CustomEvent<{ index: number; previous: number }>).detail;
    // Backward is always allowed — a wizard that will not let you go back and
    // look is a trap. Only a forward move is ever blocked, and blocking it is
    // always paired with a visible reason: the step turns red and every
    // failing field grows its own error line.
    if (index > previous && !stepValid(previous)) {
      event.preventDefault();
      markTouched(previous);
    }
  }

  function onStepChange(event: Event) {
    active = (event as CustomEvent<{ index: number }>).detail.index;
  }

  // Finish on the last step. `next-disabled` already gates the button, so the
  // guard here is belt and braces rather than the primary defence.
  function onComplete() {
    if (formValid) {
      confirmOpen = true;
      return;
    }
    // Belt and braces: `next-disabled` already blocks this. If it ever fires
    // anyway, every failing step lights up rather than the press doing nothing.
    touched = touched.map(
      (was, index) => was || failures.some((failure) => failure.step === index),
    );
  }

  /* ----------------------------------------------------------- submitting */

  let snackbarEl: (HTMLElement & { show?: () => void; hide?: (reason: string) => void }) | undefined;
  let submitTimer: ReturnType<typeof setTimeout> | undefined;

  function abandon() {
    submitting = false;
    progress = 0;
    confirmOpen = false;
  }

  // A slotted action never closes the dialog by itself — md-dialog's readme is
  // explicit, and M3 says a dismissive action is never disabled, so Cancel
  // stays live during the submit and abandons it.
  function onSend() {
    if (submitting) return;
    progress = 0;
    submitting = true;
  }

  /*
   * The submit, as a fixed ladder of ticks.
   *
   * Five equal steps of a known size, so two runs produce the same sequence
   * and the same end state. The indicator is determinate for the same reason —
   * there is a real total, and M3 says to prefer one when you have it. Every
   * state change clears the pending timeout and schedules the next, which is
   * exactly the mount/cleanup cycle the React effect had.
   */
  $: ladder(submitting, progress);

  function ladder(active_: boolean, value: number) {
    if (submitTimer !== undefined) {
      clearTimeout(submitTimer);
      submitTimer = undefined;
    }
    if (!active_) return;

    if (value >= 100) {
      submitTimer = setTimeout(() => {
        submitting = false;
        confirmOpen = false;
        submitted = true;
        if (snackbarEl && typeof snackbarEl.show === 'function') snackbarEl.show();
      }, SUBMIT_SETTLE_MS);
      return;
    }

    submitTimer = setTimeout(() => {
      progress = value + SUBMIT_TICK;
    }, SUBMIT_INTERVAL_MS);
  }

  onDestroy(() => {
    if (submitTimer !== undefined) clearTimeout(submitTimer);
  });

  // The action button emits `mdAction` and restarts the timer; only `hide()`
  // produces `reason: 'action'`, which is what tells Undo from a timeout.
  function onSnackbarAction() {
    if (snackbarEl && typeof snackbarEl.hide === 'function') snackbarEl.hide('action');
  }

  function onSnackbarClose(event: Event) {
    if ((event as CustomEvent<{ reason: string }>).detail.reason === 'action') submitted = false;
  }

  /* ------------------------------------------------------- field handlers */

  function onTitleInput(event: Event) {
    title = (event as CustomEvent<string>).detail;
  }

  function onHouseholdChange(event: Event) {
    householdId = (event as CustomEvent<string>).detail;
  }

  function onClientChange(event: Event) {
    clientId = (event as CustomEvent<string>).detail;
  }

  function onGoalChange(event: Event) {
    goalId = (event as CustomEvent<string>).detail;
  }

  function onDateChange(event: Event) {
    reviewDate = (event as CustomEvent<{ value: string }>).detail.value;
  }

  function onTimeChange(event: Event) {
    reviewTime = (event as CustomEvent<{ value: string }>).detail.value;
  }

  /**
   * `mdChange` DELEGATED to the radiogroup wrapper. The radios' `mdChange`
   * bubbles and is composed, and a composed event retargets to the shadow
   * HOST — so `event.target` is always the `md-radio` itself.
   */
  function onTypeChange(event: Event) {
    const detail = (event as CustomEvent<{ checked: boolean; value: string }>).detail;
    if (detail.checked) type = detail.value as ProposalType;
  }

  // `mdInput` rather than `mdChange`: the horizon rule has to recompute while
  // the thumb moves, or the advisor drags past the objective and only learns
  // about it after letting go.
  function onHorizonInput(event: Event) {
    horizon = (event as CustomEvent<{ value: number }>).detail.value;
  }

  function onConvictionChange(event: Event) {
    conviction = (event as CustomEvent<number>).detail;
  }

  function onEsgChange(event: Event) {
    esg = (event as CustomEvent<{ selected: boolean }>).detail.selected;
  }

  /** Delegated over the checkbox list — the value rides on the retargeted host. */
  function onConstraintChange(event: Event) {
    // Property first — Svelte assigns `value` to the element rather than writing
    // the attribute, so reading the attribute alone found nothing and every
    // instrument-type exclusion was silently ignored. Same defect as Rail.svelte.
    const target = event.target as (HTMLElement & { value?: string }) | null;
    const value = (target?.value ?? target?.getAttribute('value')) as InstrumentType | null;
    if (!value) return;
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    excluded = checked
      ? excluded.includes(value)
        ? excluded
        : [...excluded, value]
      : excluded.filter((entry) => entry !== value);
  }

  function onWeightInput(cls: AssetClass, event: Event) {
    const value = (event as CustomEvent<{ value: number | null }>).detail.value;
    weights = { ...weights, [cls]: value === null ? 0 : value };
  }

  function onCodeInput(event: Event) {
    code = (event as CustomEvent<string>).detail;
    markTouched(STEP_SIGN);
  }

  /* ------------------------------------------------------------ rendering */

  /**
   * `md-rating`'s `getLabel` is a FUNCTION prop — no attribute form, so it is
   * assigned to the instance through the `objectProps` action. It drives both
   * `aria-valuetext` and the visible value label, which makes it the single
   * most useful i18n hook the component has. Rebuilt when `$t` changes, so a
   * locale switch re-assigns it.
   */
  $: ratingProps = {
    getLabel: (value: number) =>
      $t('wealth.proposal.summary.conviction', { value, max: CONVICTION_MAX }),
  };

  $: stepperWords = {
    label: $t('wealth.proposal.builder.label'),
    'step-word': $t('wealth.proposal.stepper.step'),
    'of-word': $t('wealth.proposal.stepper.of'),
    'completed-word': $t('wealth.proposal.stepper.completed'),
    'current-word': $t('wealth.proposal.stepper.current'),
    'error-word': $t('wealth.proposal.stepper.error'),
    'optional-word': $t('wealth.proposal.stepper.optional'),
    'next-label': $t('wealth.action.next'),
    'back-label': $t('wealth.action.back'),
    'finish-label': $t('wealth.action.submit'),
  };

  $: clientName = clients.find((member) => member.id === clientId)?.name ?? '';
</script>

<Panel title={$t('wealth.proposal.builder.title')} subtitle={$t('wealth.proposal.builder.hint')}>
  {#if submitted}
    <div class="stack">
      <div class="row">
        <md-chip
          variant="assist"
          appearance="filled"
          color="success"
          icon="check"
          label={$t('wealth.proposal.builder.done')}
        ></md-chip>
        <span class="strong">{title}</span>
      </div>
      <p class="muted">{$t('wealth.proposal.builder.doneHint')}</p>
      <div class="row row--end">
        <md-button variant="tonal" icon="note_add" on:mdClick={() => onRestart()}>
          {$t('wealth.proposal.builder.restart')}
        </md-button>
      </div>
    </div>
  {:else}
    <!--
      `next-disabled` gates ONLY the built-in Continue / Finish. On the
      first three steps it is deliberately off: a disabled Continue
      cannot be pressed, so the user never finds out why. Vetoing
      `mdBeforeChange` instead lets the press land, paints the step red
      and names the failing fields. The last step is the exception —
      M3 disables a confirming action until the choice is made, and the
      OTP field beneath it says what is missing.
    -->
    <md-stepper
      {active}
      mode="linear"
      next-disabled={(active === LAST_STEP && !formValid) || undefined}
      loading={submitting || undefined}
      {...stepperWords}
      on:mdBeforeChange={onBeforeChange}
      on:mdStepChange={onStepChange}
      on:mdComplete={onComplete}
    >
      <!-- ============================================= step 1 — client -->
      <md-step
        label={$t('wealth.proposal.step.client')}
        description={$t('wealth.proposal.step.clientHint')}
        editable
        error={stepErrors[STEP_CLIENT] || undefined}
        error-text={stepErrors[STEP_CLIENT] ? $t(STEP_MESSAGE[STEP_CLIENT]) : ''}
      >
        <div class="stack form-stack">
          <div class="grid-2">
            <!-- No `value` attribute at all: the field owns its text, and
                 writing state back into it on every keystroke would reformat
                 under the caret. -->
            <md-text-field
              variant="outlined"
              name="proposalTitle"
              label={$t('wealth.proposal.field.title')}
              supporting-text={$t('wealth.proposal.field.titleHint')}
              error={fieldError(STEP_CLIENT, 'title') !== '' || undefined}
              error-text={fieldError(STEP_CLIENT, 'title')}
              reserve-supporting-space
              max-length={80}
              required
              on:mdInput={onTitleInput}
            ></md-text-field>

            <md-select
              variant="outlined"
              name="householdId"
              label={$t('wealth.proposal.field.household')}
              value={householdId}
              supporting-text={$t('wealth.proposal.field.householdHint')}
              error={fieldError(STEP_CLIENT, 'household') !== '' || undefined}
              error-text={fieldError(STEP_CLIENT, 'household')}
              value-missing-label={$t('wealth.proposal.error.household')}
              reserve-supporting-space
              full-width
              required
              on:mdChange={onHouseholdChange}
            >
              {#each households as option (option.id)}
                <md-select-option
                  value={option.id}
                  label={option.name}
                  supporting-text={$t(option.segmentKey)}
                ></md-select-option>
              {/each}
            </md-select>
          </div>

          <div class="grid-2">
            <!-- Re-keyed on the household: the option list AND the default
                 signer both move, and a remount is what lets the new default
                 reach the element as an initial value rather than as a write. -->
            {#key householdId}
              <md-select
                variant="outlined"
                name="clientId"
                label={$t('wealth.proposal.field.client')}
                value={clientId}
                supporting-text={$t('wealth.proposal.field.clientHint')}
                error={fieldError(STEP_CLIENT, 'client') !== '' || undefined}
                error-text={fieldError(STEP_CLIENT, 'client')}
                value-missing-label={$t('wealth.proposal.error.client')}
                no-options-text={$t('wealth.empty.clients')}
                reserve-supporting-space
                full-width
                required
                on:mdChange={onClientChange}
              >
                {#each clients as member (member.id)}
                  <md-select-option
                    value={member.id}
                    label={member.name}
                    supporting-text={$t(member.roleKey)}
                  ></md-select-option>
                {/each}
              </md-select>

              <md-select
                variant="outlined"
                name="goalId"
                label={$t('wealth.proposal.field.objective')}
                value={goalId}
                supporting-text={$t('wealth.proposal.field.objectiveHint')}
                clear-label={$t('wealth.proposal.field.objectiveNone')}
                no-options-text={$t('wealth.empty.goals')}
                reserve-supporting-space
                clearable
                full-width
                on:mdChange={onGoalChange}
              >
                {#each goals as goal (goal.id)}
                  <md-select-option
                    value={goal.id}
                    label={$t(goal.typeKey)}
                    supporting-text={$t('wealth.goal.monthsRemaining', {
                      count: goal.monthsRemaining,
                    })}
                  ></md-select-option>
                {/each}
              </md-select>
            {/key}
          </div>

          <!--
            Five mutually exclusive options, all visible — §5.3 puts that on
            `md-radio`, not on a select. `md-radio` has no slot, so each one is
            wrapped in a native `<label>` (which names it and enlarges the hit
            target), and the GROUP's name comes from a wrapper, because the
            component cannot supply it. One delegated listener is enough: the
            radios' `mdChange` bubbles and is composed.
          -->
          <div
            role="radiogroup"
            aria-labelledby="proposal-type-label"
            class="stack"
            on:mdChange={onTypeChange}
          >
            <p id="proposal-type-label" class="field-label">
              {$t('wealth.proposal.field.type')}
            </p>
            <div class="row">
              {#each PROPOSAL_TYPES as option (option)}
                <label class="row" style="cursor: pointer">
                  <md-radio
                    name="proposalType"
                    value={option}
                    checked={option === type || undefined}
                    required
                    value-missing-label={$t('wealth.proposal.error.step1')}
                  ></md-radio>
                  <span>{$t(`wealth.proposalType.${option}`)}</span>
                </label>
              {/each}
            </div>
          </div>

          <!-- §7.2: a date picker and a time picker are a pair. Both are their
               own modal, which is exactly why the stepper is not inside one. -->
          <div class="grid-2">
            {#key householdId}
              <md-date-picker
                name="reviewDate"
                label={$t('wealth.proposal.field.reviewDate')}
                value={reviewDate}
                min={REPORTING_DATE}
                locale={$t.locale}
                field-variant="outlined"
                supporting-text={$t('wealth.proposal.field.reviewDateHint')}
                error={fieldError(STEP_CLIENT, 'date') !== '' || undefined}
                error-text={fieldError(STEP_CLIENT, 'date')}
                reserve-supporting-space
                clearable
                required
                {...datePickerLabels($t)}
                on:mdChange={onDateChange}
              ></md-date-picker>
            {/key}

            <!-- Its own `error` / `error-text` / `reserve-supporting-space`,
                 the same three the date picker beside it uses, so the message
                 arrives in a line that was already reserved and nothing under
                 the pair ever moves. -->
            <md-time-picker
              name="reviewTime"
              label={$t('wealth.proposal.field.reviewTime')}
              value={reviewTime}
              format="24h"
              minute-step={15}
              min="08:00"
              max="19:00"
              supporting-text={$t('wealth.proposal.field.reviewTimeHint')}
              error={fieldError(STEP_CLIENT, 'time') !== '' || undefined}
              error-text={fieldError(STEP_CLIENT, 'time')}
              reserve-supporting-space
              responsive
              required
              {...timePickerLabels($t)}
              on:mdChange={onTimeChange}
            ></md-time-picker>
          </div>
        </div>
      </md-step>

      <!-- =============================================== step 2 — risk -->
      <md-step
        label={$t('wealth.proposal.step.risk')}
        description={$t('wealth.proposal.step.riskHint')}
        editable
        error={stepErrors[STEP_RISK] || undefined}
        error-text={stepErrors[STEP_RISK] ? $t(STEP_MESSAGE[STEP_RISK]) : ''}
      >
        <!--
          Two cards, not a 2×2 grid of bare stacks: what the money does (how
          long, and what it may not hold) on the left, what the advisor thinks
          of it (conviction, screening, and the mandate's own strategy) on the
          right. `.grid-2` stretches them so the pair reads as a matched pair
          however uneven the contents are.
        -->
        <div class="grid-2">
          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack form-stack">
              <div class="stack">
                <p class="field-label">{$t('wealth.proposal.field.horizon')}</p>
                <!-- A bounded value the advisor feels rather than types (§5.3).
                     The unit is months, so the objective rule is a comparison
                     and not a conversion. A single-thumb slider is named by
                     `aria-label`, and `value-text` is what stops a screen
                     reader announcing a bare number. -->
                <md-slider
                  name="horizonMonths"
                  aria-label={$t('wealth.proposal.field.horizon')}
                  min={HORIZON_MIN}
                  max={HORIZON_MAX}
                  step={HORIZON_STEP}
                  value={HORIZON_DEFAULT}
                  size="md"
                  value-indicator
                  value-text={$t('wealth.unit.months', { value: horizon })}
                  on:mdInput={onHorizonInput}
                ></md-slider>
                <!-- The hint, or the error, never both — the error REPLACES
                     the hint in the line the hint was already holding. -->
                {#if fieldError(STEP_RISK, 'horizon')}
                  <p class="field-error" role="alert">{fieldError(STEP_RISK, 'horizon')}</p>
                {:else}
                  <p class="muted">
                    {$t('wealth.proposal.field.horizonHint')}{chosenGoal
                      ? ` · ${$t('wealth.goal.monthsRemaining', { count: chosenGoal.monthsRemaining })}`
                      : ''}
                  </p>
                {/if}
              </div>

              <!--
                Several of a few, all visible — checkboxes, not a multi-select
                (§5.3). `md-checkbox` has no slot either, so each is wrapped in
                a `<label>`. One delegated `mdChange` on the group is enough
                because the event bubbles and is composed, and a composed event
                retargets to the checkbox host, so `event.target` is the
                element carrying the value.
              -->
              <div class="stack" on:mdChange={onConstraintChange}>
                <p class="field-label">{$t('wealth.proposal.field.constraints')}</p>
                {#each INSTRUMENT_TYPES as instrumentType (instrumentType)}
                  <label class="row" style="cursor: pointer">
                    <md-checkbox
                      name="excludedTypes"
                      value={instrumentType}
                      checked={excluded.includes(instrumentType) || undefined}
                    ></md-checkbox>
                    <span>{$t(`wealth.instrumentType.${instrumentType}`)}</span>
                  </label>
                {/each}
                {#if fieldError(STEP_RISK, 'constraints')}
                  <p class="field-error" role="alert">{fieldError(STEP_RISK, 'constraints')}</p>
                {:else}
                  <p class="muted">{$t('wealth.proposal.field.constraintsHint')}</p>
                {/if}
              </div>
            </div>
          </md-card>

          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack form-stack">
              <div class="stack">
                <p class="field-label">{$t('wealth.proposal.field.conviction')}</p>
                <!-- A subjective score on a small scale — §5.3 sends that to
                     `md-rating` and away from a slider. -->
                <md-rating
                  name="conviction"
                  max={CONVICTION_MAX}
                  precision={1}
                  size="lg"
                  show-value-label
                  rating-label={$t('wealth.proposal.field.conviction')}
                  use:objectProps={ratingProps}
                  on:mdChange={onConvictionChange}
                ></md-rating>
                {#if fieldError(STEP_RISK, 'conviction')}
                  <p class="field-error" role="alert">{fieldError(STEP_RISK, 'conviction')}</p>
                {:else}
                  <p class="muted">{$t('wealth.proposal.field.convictionHint')}</p>
                {/if}
              </div>

              <div class="stack">
                <p class="field-label">{$t('wealth.proposal.field.esg')}</p>
                <!-- An immediate setting with no save step — a switch, not a
                     checkbox (§5.3). It re-screens the universe the moment it
                     flips, which is what "immediate" has to mean here. -->
                <label class="row" style="cursor: pointer">
                  <md-switch
                    name="esgScreening"
                    icons
                    selected={esg || undefined}
                    on:mdChange={onEsgChange}
                  ></md-switch>
                  <span>{$t('wealth.proposal.field.esgHint')}</span>
                </label>

                <dl class="dl">
                  <Fact label={$t('wealth.table.strategy')}>
                    {#if household}
                      <Chips kind="strategy" value={household.strategy} />
                    {:else}—{/if}
                  </Fact>
                  <Fact label={$t('wealth.table.riskProfile')}>
                    {#if household}{$t(household.riskProfileKey)}{:else}—{/if}
                  </Fact>
                </dl>
              </div>
            </div>
          </md-card>
        </div>
      </md-step>

      <!-- ========================================= step 3 — allocation -->
      <md-step
        label={$t('wealth.proposal.step.allocation')}
        description={$t('wealth.proposal.step.allocationHint')}
        editable
        error={stepErrors[STEP_ALLOCATION] || undefined}
        error-text={stepErrors[STEP_ALLOCATION] ? $t(STEP_MESSAGE[STEP_ALLOCATION]) : ''}
      >
        <!--
          Two cards STACKED, not side by side: full width fits all five weights
          on one line, which is the row a reader actually wants — five weights
          that have to add up, readable in a single pass. The total that judges
          them then sits directly underneath, which is also the order you check
          it in.
        -->
        <div class="stack form-stack">
          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack">
              <p class="field-label">{$t('wealth.proposal.alloc.title')}</p>
              <p class="muted">{$t('wealth.proposal.alloc.hint')}</p>
              <!-- Re-keyed on the household so each field takes the new
                   mandate's target as an initial value. Within one household
                   nothing ever writes to these elements. -->
              {#key householdId}
                <div class="grid-3 weight-grid">
                  {#each ASSET_CLASS_ORDER as cls (cls)}
                    {@const actual =
                      allocation.find((row) => row.assetClass === cls)?.actualWeight ?? 0}
                    <div class="stack weight-field">
                      <Chips kind="assetClass" value={cls} />
                      <!-- A number with steppers and locale formatting — §5.2
                           rules out `md-text-field type="number"` here.
                           `style: percent` keeps the VALUE a fraction, which is
                           the fixture's convention for every ratio, so 0.35 in
                           state renders as 35% on screen with no multiplication
                           anywhere. -->
                      <md-number-field
                        variant="outlined"
                        name={`weight-${cls}`}
                        label={$t('wealth.proposal.field.weight')}
                        value={mandateTargets[cls]}
                        min={0}
                        max={1}
                        step={0.01}
                        small-step={0.005}
                        large-step={0.05}
                        snap-on-step
                        locale={$t.locale}
                        format-options={'{"style":"percent","maximumFractionDigits":1}'}
                        increment-label={$t('wealth.proposal.field.weight')}
                        decrement-label={$t('wealth.proposal.field.weight')}
                        on:mdInput={(event) => onWeightInput(cls, event)}
                      ></md-number-field>
                      <p class="muted">
                        {$t('wealth.table.actual')} <Percent value={actual} digits={1} />
                        {' · '}
                        {$t('wealth.proposal.alloc.mandateTarget')}
                        <Percent value={mandateTargets[cls]} digits={1} />
                      </p>
                    </div>
                  {/each}
                </div>
              {/key}
            </div>
          </md-card>

          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack">
              <!--
                A read-only value inside a known range — `md-meter`, not
                `md-progress-indicator`: nothing here is loading (§5.5). The
                colour comes from the kit's `driftColor`, which is literally
                the right map: the distance from a balanced book IS a drift,
                and it uses the same 2% / 5% bands the fixture classifies an
                allocation on, so an over-allocated draft is the same amber as
                an over-allocated mandate everywhere else in the console.
              -->
              <RatioMeter
                label={$t('wealth.proposal.alloc.total')}
                fraction={draftMaths.total(weights)}
                color={driftColor(draftMaths.imbalance(weights))}
                max={1}
              />
              {#if fieldError(STEP_ALLOCATION, 'weights')}
                <p class="field-error" role="alert">{fieldError(STEP_ALLOCATION, 'weights')}</p>
              {:else}
                <p class="muted">{$t('wealth.proposal.alloc.zeroed')}</p>
              {/if}
              <dl class="dl">
                <Fact label={$t('wealth.proposal.summary.instruments')}>
                  <Count value={proposed.length} />
                </Fact>
                <Fact label={$t('wealth.kpi.aum.short')}>
                  {#if portfolio}
                    <Money value={portfolio.marketValue} compact />
                  {:else}—{/if}
                </Fact>
              </dl>
            </div>
          </md-card>

          <div class="stack">
            <p class="field-label">{$t('wealth.proposal.instruments.title')}</p>
            <!--
              Assigning a subset out of a bounded pool with both sides
              visible — §5.3's row for `md-transfer-list`. `items` and `value`
              are JS properties (`value` has no attribute at all), assigned in
              `applyTransfer` above. The four mover glyphs are left at their
              defaults because the stylesheet mirrors them under `dir="rtl"`
              and passing pre-mirrored names would flip them twice.
            -->
            <md-transfer-list
              bind:this={transferEl}
              source-title={$t('wealth.proposal.transfer.source')}
              target-title={$t('wealth.proposal.transfer.target')}
              source-search-placeholder={$t('wealth.proposal.transfer.searchSource')}
              target-search-placeholder={$t('wealth.proposal.transfer.searchTarget')}
              count-template={$t('wealth.proposal.transfer.count')}
              empty-text={$t('wealth.proposal.transfer.empty')}
              empty-icon="inventory_2"
              move-right-label={$t('wealth.proposal.transfer.moveRight')}
              move-left-label={$t('wealth.proposal.transfer.moveLeft')}
              move-all-right-label={$t('wealth.proposal.transfer.moveAllRight')}
              move-all-left-label={$t('wealth.proposal.transfer.moveAllLeft')}
              density="-1"
              full-width
              style="--md-transfer-list-height: 360px"
              on:mdChange={onTransferChange}
            ></md-transfer-list>
            {#if fieldError(STEP_ALLOCATION, 'instruments')}
              <p class="field-error" role="alert">{fieldError(STEP_ALLOCATION, 'instruments')}</p>
            {:else}
              <p class="muted">{$t('wealth.proposal.instruments.hint')}</p>
            {/if}
          </div>
        </div>
      </md-step>

      <!-- =============================================== step 4 — sign -->
      <md-step
        label={$t('wealth.proposal.step.sign')}
        description={$t('wealth.proposal.step.signHint')}
        error={stepErrors[STEP_SIGN] || undefined}
        error-text={stepErrors[STEP_SIGN] ? $t(STEP_MESSAGE[STEP_SIGN]) : ''}
      >
        <!-- Two cards, same as the two steps before it: what is being signed
             on the left, what it holds on the right. The code stays at the
             foot of the summary card — it belongs to the thing it signs. -->
        <div class="grid-wide">
          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack">
              <p class="field-label">{$t('wealth.proposal.summary.title')}</p>
              <p class="muted">{$t('wealth.proposal.summary.hint')}</p>

              <dl class="dl">
                <Fact label={$t('wealth.proposal.field.title')}>{title || '—'}</Fact>
                <Fact label={$t('wealth.table.household')}>
                  {household ? household.name : '—'}
                </Fact>
                <Fact label={$t('wealth.proposal.field.client')}>{clientName || '—'}</Fact>
                <Fact label={$t('wealth.proposal.field.type')}>
                  <Chips kind="proposalType" value={type} />
                </Fact>
                <Fact label={$t('wealth.proposal.field.objective')}>
                  {chosenGoal ? $t(chosenGoal.typeKey) : $t('wealth.common.none')}
                </Fact>
                <Fact label={$t('wealth.proposal.summary.meeting')}>
                  {#if reviewDate}
                    <DateText value={reviewDate} />{reviewTime ? ` · ${reviewTime}` : ''}
                  {:else}—{/if}
                </Fact>
                <Fact label={$t('wealth.proposal.summary.horizon')}>
                  {$t('wealth.unit.months', { value: horizon })}
                </Fact>
                <Fact label={$t('wealth.proposal.field.conviction')}>
                  {$t('wealth.proposal.summary.conviction', {
                    value: conviction,
                    max: CONVICTION_MAX,
                  })}
                </Fact>
                <Fact label={$t('wealth.proposal.field.esg')}>
                  {esg ? $t('wealth.proposal.summary.esgOn') : $t('wealth.proposal.summary.esgOff')}
                </Fact>
                <Fact label={$t('wealth.proposal.summary.mandateValue')}>
                  <Money value={portfolio ? portfolio.marketValue : 0} />
                </Fact>
              </dl>

              <div class="alloc-summary">
                {#each ASSET_CLASS_ORDER.filter((cls) => (weights[cls] || 0) > 0) as cls (cls)}
                  <span>
                    <Chips kind="assetClass" value={cls} />
                    <Percent value={weights[cls]} digits={1} />
                  </span>
                {/each}
              </div>

              {#if excluded.length > 0}
                <div class="row">
                  <span class="muted">{$t('wealth.proposal.summary.excluded')}</span>
                  {#each excluded as entry (entry)}
                    <md-chip
                      variant="assist"
                      appearance="outlined"
                      color="warning"
                      icon="block"
                      label={$t(`wealth.instrumentType.${entry}`)}
                    ></md-chip>
                  {/each}
                </div>
              {/if}

              <!-- The code sits with the summary it signs, and at the foot of
                   it: in reading order (what is being signed, then the box
                   that signs it). -->
              <div class="sign-block">
                <!--
                  A one-time code goes in `md-otp-field`, never a row of text
                  fields (§5.2). `incomplete-label` is what makes a half-typed
                  code invalid rather than merely empty.

                  NO `error` HERE, deliberately. A partly-typed code is not a
                  mistake, it is a code that is not finished yet — and because
                  the message recomputes on every keystroke, painting it red
                  turned all six cells red from the first digit to the sixth
                  and told the advisor off for typing. The message still
                  appears; it just arrives as supporting text, in the line the
                  hint was already occupying, so nothing moves and nothing
                  shouts. What actually enforces the rule is `next-disabled`
                  on the stepper, which is where a confirming action belongs.
                -->
                <md-otp-field
                  name="confirmationCode"
                  length={CODE_LENGTH}
                  validation-type="numeric"
                  group-size={3}
                  label={$t('wealth.proposal.field.code')}
                  supporting-text={fieldError(STEP_SIGN, 'code') ||
                    $t('wealth.proposal.field.codeHint')}
                  cell-label-template={$t('wealth.proposal.field.codeCell')}
                  value-missing-label={$t('wealth.proposal.error.code')}
                  incomplete-label={$t('wealth.proposal.error.code')}
                  reserve-supporting-space
                  required
                  on:mdInput={onCodeInput}
                ></md-otp-field>
              </div>
            </div>
          </md-card>

          <md-card variant="outlined" full-width class="surface-card step-card">
            <div class="stack">
              <div class="row row--between">
                <p class="field-label">{$t('wealth.proposal.summary.instruments')}</p>
                <Count value={proposedInstruments.length} />
              </div>
              <!-- A vertical set of records, not a table (§5.5). `lines`
                   matches what is actually passed — a headline and one
                   supporting line. -->
              <md-list aria-label={$t('wealth.proposal.summary.instruments')}>
                {#each proposedInstruments.slice(0, SUMMARY_LIST_LIMIT) as instrument (instrument.id)}
                  <md-list-item
                    lines={2}
                    headline={instrument.name}
                    supporting-text={$t('wealth.proposal.instruments.meta', {
                      ticker: instrument.ticker,
                      assetClass: $t(instrument.assetClassKey),
                      currency: instrument.currency,
                    })}
                  ></md-list-item>
                {/each}
              </md-list>
              {#if proposedInstruments.length > SUMMARY_LIST_LIMIT}
                <p class="muted">
                  {$t('wealth.common.more', {
                    count: proposedInstruments.length - SUMMARY_LIST_LIMIT,
                  })}
                </p>
              {/if}
            </div>
          </md-card>
        </div>
      </md-step>
    </md-stepper>
  {/if}
</Panel>

<!--
  THE ONLY DIALOG ON THIS SCREEN.

  Opened from the stepper's Finish, which sits on the page — not from
  inside another dialog, and it opens none of its own. The two pickers in
  step 1 are modals too, which is exactly why the stepper is not wrapped
  in a dialog: that would have made them dialogs inside a dialog (§7.3).

  `scrim-dismissible` is a STRING on purpose: its default is true, and Svelte
  omits a `false` boolean, so an absent attribute could never turn it off
  during the submit.
-->
<md-dialog
  open={confirmOpen || undefined}
  headline={$t('wealth.proposal.confirm.headline')}
  icon="fact_check"
  divider
  scrim-dismissible={submitting ? 'false' : 'true'}
  locale={$t.locale}
  on:mdCancel={abandon}
>
  <p>{$t('wealth.proposal.confirm.body')}</p>
  <dl class="dl">
    <Fact label={$t('wealth.proposal.field.title')}>{title || '—'}</Fact>
    <Fact label={$t('wealth.table.household')}>{household ? household.name : '—'}</Fact>
    <Fact label={$t('wealth.proposal.field.type')}>
      <Chips kind="proposalType" value={type} />
    </Fact>
    <Fact label={$t('wealth.proposal.summary.instruments')}>
      <Count value={proposed.length} />
    </Fact>
  </dl>

  <!-- The bar appears mid-flow when the submit starts, so it needs a gap of
       its own above it: the fact grid ends on a chip and the wave started
       immediately under it, reading as part of the last row. -->
  {#if submitting}
    <md-progress-indicator
      class="submit-progress"
      variant="linear"
      value={progress}
      max={100}
      wave
      label={$t('wealth.proposal.submitting')}
    ></md-progress-indicator>
  {/if}

  <!-- M3 puts the dismissive action on the LEADING side and the component
       does not reorder them. Neither slotted button closes the dialog on
       its own — that wiring is in the handlers above. -->
  <md-button slot="actions" variant="text" on:mdClick={abandon}>
    {$t('wealth.action.cancel')}
  </md-button>
  <md-button slot="actions" variant="filled" loading={submitting || undefined} on:mdClick={onSend}>
    {$t('wealth.proposal.confirm.submit')}
  </md-button>
</md-dialog>

<!-- Brief confirmation of something that already happened, with a single
     reversing action — the snackbar's whole remit (§5.5). Centred on the
     bottom edge like every other toast in the app, and lifted clear of the
     dock and the navigation bar by `.wealth-snackbar`. -->
<md-snackbar
  bind:this={snackbarEl}
  class="wealth-snackbar"
  message={$t('wealth.proposal.submitted')}
  action={$t('wealth.proposal.undo')}
  position="bottom"
  auto-hide-duration={6000}
  dismiss-label={$t('wealth.action.close')}
  on:mdAction={onSnackbarAction}
  on:mdClose={onSnackbarClose}
></md-snackbar>
