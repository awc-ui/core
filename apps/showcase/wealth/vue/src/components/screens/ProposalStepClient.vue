<!--
  Step 1 — who the advice is for, and when it will be reviewed.

  Every control is UNCONTROLLED (see `ProposalForm.vue`): the title field gets
  NO `value` binding at all, and the selects that depend on the household are
  re-keyed on it so a new household's defaults arrive as initial values rather
  than as writes.

  §7.2: a date picker and a time picker are a pair. Both are their own modal,
  which is exactly why the stepper is not inside one.
-->
<script setup lang="ts">
import { REPORTING_DATE, type Client, type Goal, type Household, type ProposalType } from '@awc-ui/showcase-kit/wealth';
import { datePickerLabels, timePickerLabels, useCopy } from './proposal-copy';
import { PROPOSAL_TYPES, STEP_CLIENT, STEP_MESSAGE } from './proposal-shared';

const props = defineProps<{
  households: Household[];
  clients: Client[];
  goals: Goal[];
  householdId: string;
  clientId: string;
  goalId: string;
  type: ProposalType;
  reviewDate: string;
  reviewTime: string;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}>();

const emit = defineEmits<{
  (e: 'title', value: string): void;
  (e: 'household', value: string): void;
  (e: 'client', value: string): void;
  (e: 'goal', value: string): void;
  (e: 'type', value: ProposalType): void;
  (e: 'date', value: string): void;
  (e: 'time', value: string): void;
}>();

const c = useCopy();

const err = (field: string) => props.fieldError(STEP_CLIENT, field);

const titleListeners = {
  mdInput(event: Event) {
    emit('title', (event as CustomEvent<string>).detail);
  },
};
const householdListeners = {
  mdChange(event: Event) {
    emit('household', (event as CustomEvent<string>).detail);
  },
};
const clientListeners = {
  mdChange(event: Event) {
    emit('client', (event as CustomEvent<string>).detail);
  },
};
const goalListeners = {
  mdChange(event: Event) {
    emit('goal', (event as CustomEvent<string>).detail);
  },
};
const dateListeners = {
  mdChange(event: Event) {
    emit('date', (event as CustomEvent<{ value: string }>).detail.value);
  },
};
const timeListeners = {
  mdChange(event: Event) {
    emit('time', (event as CustomEvent<{ value: string }>).detail.value);
  },
};

/*
 * ONE delegated listener for the radio group: the radios' `mdChange` bubbles
 * and is composed, and a composed event retargets to the shadow HOST — so
 * `event.target` is the `md-radio` itself.
 */
const typeListeners = {
  mdChange(event: Event) {
    const detail = (event as CustomEvent<{ checked: boolean; value: string }>).detail;
    if (detail.checked) emit('type', detail.value as ProposalType);
  },
};
</script>

<template>
  <md-step
    :label="c('wealth.proposal.step.client')"
    :description="c('wealth.proposal.step.clientHint')"
    editable
    :error="inError"
    :error-text="inError ? c(STEP_MESSAGE[STEP_CLIENT]) : ''"
  >
    <div class="stack form-stack">
      <div class="grid-2">
        <!-- No `value` binding at all: the field owns its text, and writing
             state back into it on every keystroke would reformat under the
             caret. -->
        <md-text-field
          v-awc="{ on: titleListeners }"
          variant="outlined"
          name="proposalTitle"
          :label="c('wealth.proposal.field.title')"
          :supporting-text="c('wealth.proposal.field.titleHint')"
          :error="err('title') !== ''"
          :error-text="err('title')"
          reserve-supporting-space
          :max-length="80"
          required
        ></md-text-field>

        <md-select
          v-awc="{ on: householdListeners }"
          variant="outlined"
          name="householdId"
          :label="c('wealth.proposal.field.household')"
          :value="householdId"
          :supporting-text="c('wealth.proposal.field.householdHint')"
          :error="err('household') !== ''"
          :error-text="err('household')"
          :value-missing-label="c('wealth.proposal.error.household')"
          reserve-supporting-space
          full-width
          required
        >
          <md-select-option
            v-for="option in households"
            :key="option.id"
            :value="option.id"
            :label="option.name"
            :supporting-text="c(option.segmentKey)"
          ></md-select-option>
        </md-select>
      </div>

      <div class="grid-2">
        <!-- Re-keyed on the household: the option list AND the default signer
             both move, and a remount is what lets the new default reach the
             element as an initial value rather than as a write. -->
        <md-select
          :key="`client-${householdId}`"
          v-awc="{ on: clientListeners }"
          variant="outlined"
          name="clientId"
          :label="c('wealth.proposal.field.client')"
          :value="clientId"
          :supporting-text="c('wealth.proposal.field.clientHint')"
          :error="err('client') !== ''"
          :error-text="err('client')"
          :value-missing-label="c('wealth.proposal.error.client')"
          :no-options-text="c('wealth.empty.clients')"
          reserve-supporting-space
          full-width
          required
        >
          <md-select-option
            v-for="member in clients"
            :key="member.id"
            :value="member.id"
            :label="member.name"
            :supporting-text="c(member.roleKey)"
          ></md-select-option>
        </md-select>

        <md-select
          :key="`goal-${householdId}`"
          v-awc="{ on: goalListeners }"
          variant="outlined"
          name="goalId"
          :label="c('wealth.proposal.field.objective')"
          :value="goalId"
          :supporting-text="c('wealth.proposal.field.objectiveHint')"
          :clear-label="c('wealth.proposal.field.objectiveNone')"
          :no-options-text="c('wealth.empty.goals')"
          reserve-supporting-space
          clearable
          full-width
        >
          <md-select-option
            v-for="goal in goals"
            :key="goal.id"
            :value="goal.id"
            :label="c(goal.typeKey)"
            :supporting-text="c('wealth.goal.monthsRemaining', { count: goal.monthsRemaining })"
          ></md-select-option>
        </md-select>
      </div>

      <!--
        Five mutually exclusive options, all visible — §5.3 puts that on
        `md-radio`, not on a select. `md-radio` has no slot, so each one is
        wrapped in a native `<label>` (which names it and enlarges the hit
        target), and the GROUP's name comes from a wrapper, because the
        component cannot supply it.
      -->
      <div
        v-awc="{ on: typeListeners }"
        role="radiogroup"
        aria-labelledby="proposal-type-label"
        class="stack"
      >
        <p id="proposal-type-label" class="field-label">
          {{ c('wealth.proposal.field.type') }}
        </p>
        <div class="row">
          <label v-for="option in PROPOSAL_TYPES" :key="option" class="row" style="cursor: pointer">
            <md-radio
              name="proposalType"
              :value="option"
              :checked="option === type"
              required
              :value-missing-label="c('wealth.proposal.error.step1')"
            ></md-radio>
            <span>{{ c(`wealth.proposalType.${option}`) }}</span>
          </label>
        </div>
      </div>

      <div class="grid-2">
        <md-date-picker
          :key="`date-${householdId}`"
          v-awc="{ on: dateListeners }"
          name="reviewDate"
          :label="c('wealth.proposal.field.reviewDate')"
          :value="reviewDate"
          :min="REPORTING_DATE"
          :locale="c.locale"
          field-variant="outlined"
          :supporting-text="c('wealth.proposal.field.reviewDateHint')"
          :error="err('date') !== ''"
          :error-text="err('date')"
          reserve-supporting-space
          clearable
          required
          v-bind="datePickerLabels(c)"
        ></md-date-picker>

        <!-- Its own `error` / `error-text` / `reserve-supporting-space`, the
             same three the date picker beside it uses, so a message appears in
             the line the hint already occupied and nothing moves. -->
        <md-time-picker
          v-awc="{ on: timeListeners }"
          name="reviewTime"
          :label="c('wealth.proposal.field.reviewTime')"
          :value="reviewTime"
          format="24h"
          :minute-step="15"
          min="08:00"
          max="19:00"
          :supporting-text="c('wealth.proposal.field.reviewTimeHint')"
          :error="err('time') !== ''"
          :error-text="err('time')"
          reserve-supporting-space
          responsive
          required
          v-bind="timePickerLabels(c)"
        ></md-time-picker>
      </div>
    </div>
  </md-step>
</template>
