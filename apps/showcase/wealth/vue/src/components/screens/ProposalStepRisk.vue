<!--
  Step 2 — the risk conversation: horizon, conviction, exclusions, screening.

  Two cards, not a 2×2 grid of bare stacks: what the money does (how long, and
  what it may not hold) on the left, what the advisor thinks of it (conviction,
  screening, and the mandate's own strategy) on the right. `.grid-2` stretches
  them so the pair reads as a matched pair however uneven the contents are.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Goal, Household, InstrumentType } from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import { CONVICTION_MAX, HORIZON_DEFAULT, HORIZON_MAX, HORIZON_MIN, HORIZON_STEP, INSTRUMENT_TYPES, STEP_MESSAGE, STEP_RISK } from './proposal-shared';
import ProposalFieldNote from './ProposalFieldNote.vue';
import Fact from '~/components/bits/Fact.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';

const props = defineProps<{
  household: Household | undefined;
  goal: Goal | undefined;
  horizon: number;
  conviction: number;
  excluded: InstrumentType[];
  esg: boolean;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}>();

const emit = defineEmits<{
  (e: 'horizon', value: number): void;
  (e: 'conviction', value: number): void;
  (e: 'excluded', value: InstrumentType[]): void;
  (e: 'esg', value: boolean): void;
}>();

const c = useCopy();

const err = (field: string) => props.fieldError(STEP_RISK, field);

/*
 * `mdInput` rather than `mdChange`: the horizon rule has to recompute while
 * the thumb moves, or the advisor drags past the objective and only learns
 * about it after letting go.
 */
const sliderListeners = {
  mdInput(event: Event) {
    emit('horizon', (event as CustomEvent<{ value: number }>).detail.value);
  },
};

const ratingListeners = {
  mdChange(event: Event) {
    emit('conviction', (event as CustomEvent<number>).detail);
  },
};

/*
 * `md-rating`'s `getLabel` is a FUNCTION prop — no attribute form, so it is
 * assigned to the instance through `v-awc`. It drives both `aria-valuetext`
 * and the visible value label, which makes it the single most useful i18n
 * hook the component has. A `computed` gives the function a NEW identity per
 * locale, which is what makes the element re-render its label after a locale
 * switch (assigning the same reference would be a no-op for it).
 */
const ratingProps = computed(() => ({
  getLabel: (value: number) =>
    c.value('wealth.proposal.summary.conviction', { value, max: CONVICTION_MAX }),
}));

const switchListeners = {
  mdChange(event: Event) {
    emit('esg', (event as CustomEvent<{ selected: boolean }>).detail.selected);
  },
};

/*
 * One delegated `mdChange` for the checkbox list: the event bubbles and is
 * composed, and a composed event retargets to the checkbox host, so
 * `event.target` is the element carrying the value.
 */
const constraintsListeners = {
  mdChange(event: Event) {
    const detail = (event as CustomEvent<{ checked: boolean }>).detail;
    const target = event.target as HTMLElement | null;
    const value = target?.getAttribute('value') as InstrumentType | null;
    if (!value) return;
    emit(
      'excluded',
      detail.checked
        ? props.excluded.includes(value)
          ? props.excluded
          : [...props.excluded, value]
        : props.excluded.filter((entry) => entry !== value),
    );
  },
};
</script>

<template>
  <md-step
    :label="c('wealth.proposal.step.risk')"
    :description="c('wealth.proposal.step.riskHint')"
    editable
    :error="inError"
    :error-text="inError ? c(STEP_MESSAGE[STEP_RISK]) : ''"
  >
    <div class="grid-2">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack form-stack">
          <div class="stack">
            <p class="field-label">{{ c('wealth.proposal.field.horizon') }}</p>
            <!-- A bounded value the advisor feels rather than types (§5.3).
                 The unit is months, so the objective rule is a comparison and
                 not a conversion. A single-thumb slider is named by
                 `aria-label`, and `value-text` is what stops a screen reader
                 announcing a bare number. -->
            <md-slider
              v-awc="{ on: sliderListeners }"
              name="horizonMonths"
              :aria-label="c('wealth.proposal.field.horizon')"
              :min="HORIZON_MIN"
              :max="HORIZON_MAX"
              :step="HORIZON_STEP"
              :value="HORIZON_DEFAULT"
              size="md"
              value-indicator
              :value-text="c('wealth.unit.months', { value: horizon })"
            ></md-slider>
            <ProposalFieldNote :error="err('horizon')">
              {{ c('wealth.proposal.field.horizonHint')
              }}{{ goal ? ` · ${c('wealth.goal.monthsRemaining', { count: goal.monthsRemaining })}` : '' }}
            </ProposalFieldNote>
          </div>

          <!-- Several of a few, all visible — checkboxes, not a multi-select
               (§5.3). `md-checkbox` has no slot either, so each is wrapped in
               a `<label>`. -->
          <div v-awc="{ on: constraintsListeners }" class="stack">
            <p class="field-label">{{ c('wealth.proposal.field.constraints') }}</p>
            <label
              v-for="instrumentType in INSTRUMENT_TYPES"
              :key="instrumentType"
              class="row"
              style="cursor: pointer"
            >
              <md-checkbox
                name="excludedTypes"
                :value="instrumentType"
                :checked="excluded.includes(instrumentType)"
              ></md-checkbox>
              <span>{{ c(`wealth.instrumentType.${instrumentType}`) }}</span>
            </label>
            <ProposalFieldNote :error="err('constraints')">
              {{ c('wealth.proposal.field.constraintsHint') }}
            </ProposalFieldNote>
          </div>
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack form-stack">
          <div class="stack">
            <p class="field-label">{{ c('wealth.proposal.field.conviction') }}</p>
            <!-- A subjective score on a small scale — §5.3 sends that to
                 `md-rating` and away from a slider. -->
            <md-rating
              v-awc="{ props: ratingProps, on: ratingListeners }"
              name="conviction"
              :max="CONVICTION_MAX"
              :precision="1"
              size="lg"
              show-value-label
              :rating-label="c('wealth.proposal.field.conviction')"
            ></md-rating>
            <ProposalFieldNote :error="err('conviction')">
              {{ c('wealth.proposal.field.convictionHint') }}
            </ProposalFieldNote>
          </div>

          <div class="stack">
            <p class="field-label">{{ c('wealth.proposal.field.esg') }}</p>
            <!-- An immediate setting with no save step — a switch, not a
                 checkbox (§5.3). It re-screens the universe the moment it
                 flips, which is what "immediate" has to mean here. -->
            <label class="row" style="cursor: pointer">
              <md-switch v-awc="{ on: switchListeners }" name="esgScreening" icons :selected="esg"></md-switch>
              <span>{{ c('wealth.proposal.field.esgHint') }}</span>
            </label>

            <dl class="dl">
              <Fact :label="c('wealth.table.strategy')">
                <StrategyChip v-if="household" :strategy="household.strategy" />
                <template v-else>—</template>
              </Fact>
              <Fact :label="c('wealth.table.riskProfile')">
                {{ household ? c(household.riskProfileKey) : '—' }}
              </Fact>
            </dl>
          </div>
        </div>
      </md-card>
    </div>
  </md-step>
</template>
