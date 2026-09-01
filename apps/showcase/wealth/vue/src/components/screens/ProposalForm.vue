<!--
  The proposal form — `md-stepper` driving a four-step advice document.

  THE COMPOSITION RULE THIS FILE EXISTS TO OBEY (§7.3). A dialog opened from
  inside a dialog is always wrong, so a multi-step flow is `md-stepper` inside
  ONE `md-dialog` — at most. Here it is inside NONE, and that is forced by the
  flow rather than by taste: step 1 opens `md-date-picker` and `md-time-picker`,
  and each of those IS its own modal (§7.2). So the stepper lives on the page,
  and the single `md-dialog` on this screen is the submit confirmation.

  WHY EVERY CONTROL IS UNCONTROLLED. These components own their value and treat
  a property write as a commit: `md-number-field`'s readme says a programmatic
  write "reformats the display". So a field is authored with an INITIAL value
  that only moves when the thing it derives from moves, state is updated from
  the component's own `md*` event, and a `:key` remounts the subtree when the
  household changes and the defaults genuinely have to change with it.

  VALIDATION IS REAL, and enforced where `md-stepper`'s readme says to enforce
  it. `mdBeforeChange` is cancelable: an invalid step vetoes the forward move,
  paints itself `error` with `error-text`, and turns on the inline error of
  every field that failed. Finish is the one exception — it is gated
  declaratively with `next-disabled`, because M3 wants a confirming action
  disabled until the choice is made, and a signature is not something to veto
  after the fact.

  EACH STEP IS ITS OWN SFC. Vue components render no wrapper element, so
  `<ProposalStepClient />` still yields an `md-step` that is a DIRECT child of
  `md-stepper` — the only thing the stepper cares about (§7.1). The React
  source splits them so its listener hooks stay unconditional; here the split
  is simply what a multi-root SFC build requires, and it keeps the two builds
  file-for-file comparable.

  ARITHMETIC. Rule zero says arithmetic belongs in the kit. What survives here
  is quarantined in `draftMaths` (see `proposal-shared.ts`) and listed in the
  hand-off notes as a kit candidate.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  getAllocationFor,
  getClientsFor,
  getGoalsFor,
  getHouseholds,
  getInstruments,
  getPortfolioFor,
  getPositionsFor,
  type AssetClass,
  type Instrument,
  type InstrumentType,
  type ProposalType,
} from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import {
  CODE_LENGTH,
  draftMaths,
  HORIZON_DEFAULT,
  INSTRUMENT_TYPES,
  LAST_STEP,
  PROPOSAL_TYPES,
  STEP_ALLOCATION,
  STEP_CLIENT,
  STEP_RISK,
  STEP_SIGN,
  SUBMIT_INTERVAL_MS,
  SUBMIT_SETTLE_MS,
  SUBMIT_TICK,
  targetsFor,
  type Failure,
} from './proposal-shared';
import ProposalStepAllocation from './ProposalStepAllocation.vue';
import ProposalStepClient from './ProposalStepClient.vue';
import ProposalStepRisk from './ProposalStepRisk.vue';
import ProposalStepSign from './ProposalStepSign.vue';
import ProposalSubmittedNotice from './ProposalSubmittedNotice.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Fact from '~/components/bits/Fact.vue';
import ProposalTypeChip from '~/components/bits/ProposalTypeChip.vue';

const emit = defineEmits<{ (e: 'restart'): void }>();

const c = useCopy();

const households = getHouseholds();
const universe = getInstruments();
const firstHousehold = households.length > 0 ? households[0] : undefined;

/* -------------------------------------------------------------- step 1 */

const title = ref('');
const householdId = ref(firstHousehold ? firstHousehold.id : '');
const clientId = ref('');
const goalId = ref('');
const type = ref<ProposalType>(PROPOSAL_TYPES[0]);
const reviewDate = ref('');
// Deliberately empty: the fixture has no meeting time, and an invented
// default would let the advisor skip a decision the flow says is required.
const reviewTime = ref('');

const household = computed(() => households.find((h) => h.id === householdId.value));
const portfolio = computed(() =>
  householdId.value ? getPortfolioFor(householdId.value) : undefined,
);
const clients = computed(() => (householdId.value ? getClientsFor(householdId.value) : []));
const goals = computed(() => (householdId.value ? getGoalsFor(householdId.value) : []));
const allocation = computed(() =>
  householdId.value ? getAllocationFor(householdId.value) : [],
);
const mandateTargets = computed(() => targetsFor(allocation.value));

/* -------------------------------------------------------------- step 2 */

const horizon = ref(HORIZON_DEFAULT);
const conviction = ref(0);
const excluded = ref<InstrumentType[]>([]);
const esg = ref(false);

/* -------------------------------------------------------------- step 3 */

const weights = ref<Record<AssetClass, number>>(
  targetsFor(firstHousehold ? getAllocationFor(firstHousehold.id) : []),
);
const chosen = ref<string[]>([]);

/* -------------------------------------------------------------- step 4 */

const code = ref('');

/* ----------------------------------------------------------- flow state */

const active = ref(STEP_CLIENT);
const touched = ref<boolean[]>([false, false, false, false]);
const confirmOpen = ref(false);
const submitting = ref(false);
const progress = ref(0);
const submitted = ref(false);

const markTouched = (step: number) => {
  touched.value = touched.value.map((was, index) => (index === step ? true : was));
};

/*
 * Seed everything that hangs off the household, on mount and on every change.
 *
 * One watcher rather than five, because they are one decision: which mandate
 * the advice is for. Every value it writes comes from the fixture — the
 * primary member (`getClientsFor` returns them first), the mandate's real next
 * review date, its target allocation, and the instruments it actually holds.
 * Nothing here is invented and nothing here is a clock.
 */
watch(
  householdId,
  (id) => {
    if (!id) return;
    const members = getClientsFor(id);
    clientId.value = members.length > 0 ? members[0].id : '';
    goalId.value = '';
    weights.value = targetsFor(getAllocationFor(id));
    const mandate = getPortfolioFor(id);
    chosen.value = mandate ? getPositionsFor(mandate.id).map((p) => p.instrumentId) : [];
    const owner = getHouseholds().find((h) => h.id === id);
    reviewDate.value = owner ? owner.nextReviewDate : '';
  },
  { immediate: true },
);

/* --------------------------------------------- the eligible universe */

/**
 * Whether an instrument may be proposed at all. Three of the form's own
 * answers feed this, which is what makes the four steps a flow rather than
 * four unrelated pages.
 */
const eligible = computed(() => {
  const excludedSet = new Set<string>(excluded.value);
  const esgOn = esg.value;
  const currentWeights = weights.value;
  return (instrument: Instrument): boolean =>
    !excludedSet.has(instrument.type) &&
    !(esgOn && instrument.sector === 'energy') &&
    (currentWeights[instrument.assetClass] || 0) > 0;
});

/*
 * The proposed set, pruned to what is still eligible.
 *
 * `md-transfer-list` never moves a `disabled` item in EITHER direction, so an
 * instrument that becomes ineligible after it was added would be stranded in
 * the proposal with no way to take it out. Deriving the value instead of
 * storing it means the pruned ones are simply re-partitioned back to the
 * source column on the next assignment, where their disabled state is honest.
 */
const proposed = computed(() => {
  const byId = new Map(universe.map((instrument) => [instrument.id, instrument] as const));
  return chosen.value.filter((id) => {
    const instrument = byId.get(id);
    return instrument !== undefined && eligible.value(instrument);
  });
});

const proposedInstruments = computed(() =>
  proposed.value
    .map((id) => universe.find((instrument) => instrument.id === id))
    .filter((instrument): instrument is Instrument => instrument !== undefined),
);

const transferItems = computed(() =>
  universe.map((instrument) => ({
    value: instrument.id,
    label: instrument.name,
    description: c.value('wealth.proposal.instruments.meta', {
      ticker: instrument.ticker,
      assetClass: c.value(instrument.assetClassKey),
      currency: instrument.currency,
    }),
    disabled: !eligible.value(instrument),
  })),
);

/* ------------------------------------------------------------ validation */

const chosenGoal = computed(() => goals.value.find((goal) => goal.id === goalId.value));

/**
 * Every rule as a flat table of `{ step, field, key }` — one list read by
 * three consumers: the step's `error-text`, each field's own inline error, and
 * the `mdBeforeChange` veto. Splitting them would let a rule block a step
 * without ever saying which field failed.
 */
const failures = computed<Failure[]>(() => {
  const rules: Failure[] = [];

  if (title.value.trim().length < 6) {
    rules.push({ step: STEP_CLIENT, field: 'title', key: 'wealth.proposal.error.title' });
  }
  if (!householdId.value) {
    rules.push({ step: STEP_CLIENT, field: 'household', key: 'wealth.proposal.error.household' });
  }
  if (!clientId.value) {
    rules.push({ step: STEP_CLIENT, field: 'client', key: 'wealth.proposal.error.client' });
  }
  if (!reviewDate.value) {
    rules.push({ step: STEP_CLIENT, field: 'date', key: 'wealth.proposal.error.date' });
  }
  if (!reviewTime.value) {
    rules.push({ step: STEP_CLIENT, field: 'time', key: 'wealth.proposal.error.time' });
  }

  if (conviction.value < 1) {
    rules.push({ step: STEP_RISK, field: 'conviction', key: 'wealth.proposal.error.conviction' });
  }
  // The horizon is in months and so is `monthsRemaining`, so "the money has to
  // stay invested until the objective falls due" is a comparison rather than a
  // calculation.
  if (chosenGoal.value && horizon.value < chosenGoal.value.monthsRemaining) {
    rules.push({ step: STEP_RISK, field: 'horizon', key: 'wealth.proposal.error.horizon' });
  }
  if (excluded.value.length >= INSTRUMENT_TYPES.length) {
    rules.push({ step: STEP_RISK, field: 'constraints', key: 'wealth.proposal.error.constraints' });
  }

  if (!draftMaths.balanced(weights.value)) {
    rules.push({ step: STEP_ALLOCATION, field: 'weights', key: 'wealth.proposal.error.weights' });
  }
  if (proposed.value.length === 0) {
    rules.push({
      step: STEP_ALLOCATION,
      field: 'instruments',
      key: 'wealth.proposal.error.instruments',
    });
  }

  if (code.value.length < CODE_LENGTH) {
    rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.code' });
  } else if (/^(\d)\1+$/.test(code.value)) {
    rules.push({ step: STEP_SIGN, field: 'code', key: 'wealth.proposal.error.codeRepeat' });
  }

  return rules;
});

const stepValid = (step: number) => !failures.value.some((failure) => failure.step === step);

/*
 * Finish is gated on the WHOLE form, not just on the step it sits in.
 *
 * `auto-complete` marks a step completed the moment you leave it, and
 * `mode="linear"` then lets you jump forward past it — so an advisor can pass
 * step 1, come back, blank the title, and walk forward again to a Finish
 * button that only ever looked at step 4. Reading the whole failures table
 * closes that, and the guard on `mdComplete` marks every failing step touched
 * so the red one is visible rather than merely blocking.
 */
const formValid = computed(() => failures.value.length === 0);

/** The inline message for one field, or `''` while its step is untouched. */
const fieldError = (step: number, field: string): string => {
  if (!touched.value[step]) return '';
  const hit = failures.value.find((failure) => failure.step === step && failure.field === field);
  return hit ? c.value(hit.key) : '';
};

const stepError = (step: number) => touched.value[step] && !stepValid(step);

/* ------------------------------------------------------------ the stepper */

const stepperListeners = {
  mdBeforeChange(event: Event) {
    const { index, previous } = (event as CustomEvent<{ index: number; previous: number }>).detail;
    // Backward is always allowed — a wizard that will not let you go back and
    // look is a trap. Only a forward move is ever blocked, and blocking it is
    // always paired with a visible reason: the step turns red and every
    // failing field grows its own error line.
    if (index > previous && !stepValid(previous)) {
      event.preventDefault();
      markTouched(previous);
    }
  },
  mdStepChange(event: Event) {
    active.value = (event as CustomEvent<{ index: number }>).detail.index;
  },
  // Finish on the last step. `next-disabled` already gates the button, so the
  // guard here is belt and braces rather than the primary defence.
  mdComplete() {
    if (formValid.value) {
      confirmOpen.value = true;
      return;
    }
    // If it ever fires anyway, every failing step lights up rather than the
    // press doing nothing.
    touched.value = touched.value.map(
      (was, index) => was || failures.value.some((failure) => failure.step === index),
    );
  },
};

/* ------------------------------------------------------------- submitting */

const snackbar = ref<HTMLElement | null>(null);

const abandon = () => {
  submitting.value = false;
  progress.value = 0;
  confirmOpen.value = false;
};

const dialogListeners = {
  mdCancel() {
    abandon();
  },
};

// A slotted action never closes the dialog by itself — md-dialog's readme is
// explicit, and M3 says a dismissive action is never disabled, so Cancel stays
// live during the submit and abandons it.
const cancelListeners = {
  mdClick() {
    abandon();
  },
};

const sendListeners = {
  mdClick() {
    if (submitting.value) return;
    progress.value = 0;
    submitting.value = true;
  },
};

/*
 * The submit, as a fixed ladder of ticks — five equal steps of a known size,
 * so two runs produce the same sequence and the same end state. The indicator
 * is determinate for the same reason: there is a real total, and M3 says to
 * prefer one when you have it.
 */
watch(
  [submitting, progress],
  (_value, _old, onCleanup) => {
    if (!submitting.value) return;

    if (progress.value >= 100) {
      const settle = window.setTimeout(() => {
        submitting.value = false;
        confirmOpen.value = false;
        submitted.value = true;
        const bar = snackbar.value as (HTMLElement & { show?: () => void }) | null;
        if (bar && typeof bar.show === 'function') bar.show();
      }, SUBMIT_SETTLE_MS);
      onCleanup(() => window.clearTimeout(settle));
      return;
    }

    const tick = window.setTimeout(() => {
      progress.value += SUBMIT_TICK;
    }, SUBMIT_INTERVAL_MS);
    onCleanup(() => window.clearTimeout(tick));
  },
  { immediate: true },
);

// The action button emits `mdAction` and restarts the timer; only `hide()`
// produces `reason: 'action'`, which is what tells Undo from a timeout.
const snackbarListeners = {
  mdAction() {
    const bar = snackbar.value as (HTMLElement & { hide?: (reason: string) => void }) | null;
    if (bar && typeof bar.hide === 'function') bar.hide('action');
  },
  mdClose(event: Event) {
    if ((event as CustomEvent<{ reason: string }>).detail.reason === 'action') {
      submitted.value = false;
    }
  },
};

/* -------------------------------------------------------------- rendering */

const stepperWords = computed(() => ({
  label: c.value('wealth.proposal.builder.label'),
  'step-word': c.value('wealth.proposal.stepper.step'),
  'of-word': c.value('wealth.proposal.stepper.of'),
  'completed-word': c.value('wealth.proposal.stepper.completed'),
  'current-word': c.value('wealth.proposal.stepper.current'),
  'error-word': c.value('wealth.proposal.stepper.error'),
  'optional-word': c.value('wealth.proposal.stepper.optional'),
  'next-label': c.value('wealth.action.next'),
  'back-label': c.value('wealth.action.back'),
  'finish-label': c.value('wealth.action.submit'),
}));

const clientName = computed(
  () => clients.value.find((member) => member.id === clientId.value)?.name ?? '',
);

const onWeight = (cls: AssetClass, value: number) => {
  weights.value = { ...weights.value, [cls]: value };
};

const onCode = (value: string) => {
  code.value = value;
  markTouched(STEP_SIGN);
};
</script>

<template>
  <Panel :title="c('wealth.proposal.builder.title')" :subtitle="c('wealth.proposal.builder.hint')">
    <ProposalSubmittedNotice v-if="submitted" :title="title" @restart="emit('restart')" />
    <!--
      `next-disabled` gates ONLY the built-in Continue / Finish. On the first
      three steps it is deliberately off: a disabled Continue cannot be
      pressed, so the user never finds out why. Vetoing `mdBeforeChange`
      instead lets the press land, paints the step red and names the failing
      fields. The last step is the exception — M3 disables a confirming action
      until the choice is made, and the OTP field beneath it says what is
      missing.
    -->
    <md-stepper
      v-else
      v-awc="{ on: stepperListeners }"
      :active="active"
      mode="linear"
      :next-disabled="active === LAST_STEP && !formValid"
      :loading="submitting"
      v-bind="stepperWords"
    >
      <ProposalStepClient
        :households="households"
        :clients="clients"
        :goals="goals"
        :household-id="householdId"
        :client-id="clientId"
        :goal-id="goalId"
        :type="type"
        :review-date="reviewDate"
        :review-time="reviewTime"
        :field-error="fieldError"
        :in-error="stepError(STEP_CLIENT)"
        @title="title = $event"
        @household="householdId = $event"
        @client="clientId = $event"
        @goal="goalId = $event"
        @type="type = $event"
        @date="reviewDate = $event"
        @time="reviewTime = $event"
      />

      <ProposalStepRisk
        :household="household"
        :goal="chosenGoal"
        :horizon="horizon"
        :conviction="conviction"
        :excluded="excluded"
        :esg="esg"
        :field-error="fieldError"
        :in-error="stepError(STEP_RISK)"
        @horizon="horizon = $event"
        @conviction="conviction = $event"
        @excluded="excluded = $event"
        @esg="esg = $event"
      />

      <ProposalStepAllocation
        :household-id="householdId"
        :allocation="allocation"
        :mandate-targets="mandateTargets"
        :weights="weights"
        :portfolio="portfolio"
        :proposed-count="proposed.length"
        :transfer-items="transferItems"
        :proposed="proposed"
        :field-error="fieldError"
        :in-error="stepError(STEP_ALLOCATION)"
        @weight="onWeight"
        @chosen="chosen = $event"
      />

      <ProposalStepSign
        :title="title"
        :household-name="household ? household.name : ''"
        :client-name="clientName"
        :type="type"
        :goal-label="chosenGoal ? c(chosenGoal.typeKey) : c('wealth.common.none')"
        :review-date="reviewDate"
        :review-time="reviewTime"
        :horizon="horizon"
        :conviction="conviction"
        :excluded="excluded"
        :esg="esg"
        :weights="weights"
        :instruments="proposedInstruments"
        :mandate-value="portfolio ? portfolio.marketValue : 0"
        :field-error="fieldError"
        :in-error="stepError(STEP_SIGN)"
        @code="onCode"
      />
    </md-stepper>
  </Panel>

  <!--
    THE ONLY DIALOG ON THIS SCREEN.

    Opened from the stepper's Finish, which sits on the page — not from inside
    another dialog, and it opens none of its own. The two pickers in step 1 are
    modals too, which is exactly why the stepper is not wrapped in a dialog:
    that would have made them dialogs inside a dialog (§7.3).
  -->
  <md-dialog
    v-awc="{ on: dialogListeners }"
    :open="confirmOpen"
    :headline="c('wealth.proposal.confirm.headline')"
    icon="fact_check"
    divider
    :scrim-dismissible="!submitting"
    :locale="c.locale"
  >
    <p>{{ c('wealth.proposal.confirm.body') }}</p>
    <dl class="dl">
      <Fact :label="c('wealth.proposal.field.title')">{{ title || '—' }}</Fact>
      <Fact :label="c('wealth.table.household')">{{ household ? household.name : '—' }}</Fact>
      <Fact :label="c('wealth.proposal.field.type')">
        <ProposalTypeChip :type="type" />
      </Fact>
      <Fact :label="c('wealth.proposal.summary.instruments')">
        <Count :value="proposed.length" />
      </Fact>
    </dl>

    <!-- The bar appears mid-flow when the submit starts, so it needs a gap of
         its own above it: the fact grid ends on a chip and the wave started
         immediately under it, reading as part of the last row. -->
    <md-progress-indicator
      v-if="submitting"
      class="submit-progress"
      variant="linear"
      :value="progress"
      :max="100"
      wave
      :label="c('wealth.proposal.submitting')"
    ></md-progress-indicator>

    <!-- M3 puts the dismissive action on the LEADING side and the component
         does not reorder them. Neither slotted button closes the dialog on its
         own — that wiring is in the listeners above. -->
    <md-button v-awc="{ on: cancelListeners }" slot="actions" variant="text">
      {{ c('wealth.action.cancel') }}
    </md-button>
    <md-button v-awc="{ on: sendListeners }" slot="actions" variant="filled" :loading="submitting">
      {{ c('wealth.proposal.confirm.submit') }}
    </md-button>
  </md-dialog>

  <!-- Brief confirmation of something that already happened, with a single
       reversing action — the snackbar's whole remit (§5.5). Centred on the
       bottom edge like every other toast in the app, and lifted clear of the
       dock and the navigation bar by `.wealth-snackbar`. -->
  <md-snackbar
    ref="snackbar"
    v-awc="{ on: snackbarListeners }"
    class="wealth-snackbar"
    :message="c('wealth.proposal.submitted')"
    :action="c('wealth.proposal.undo')"
    position="bottom"
    :auto-hide-duration="6000"
    :dismiss-label="c('wealth.action.close')"
  ></md-snackbar>
</template>
