<!--
  The what-if's two sliders and the reset row.

  A component rather than a template chunk because the SAME stack renders in
  exactly ONE of two mounted places — inline in the projection panel on wide
  layouts, inside the `md-bottom-sheet` on compact ones (see `useCompact` in
  parts.ts for why never both). The screen owns every value and handler; this
  file is layout.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Goal } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import DateText from '~/components/bits/DateText.vue';
import Money from '~/components/bits/Money.vue';
import ActionButton from './ActionButton.vue';
import SliderControl from './SliderControl.vue';
import type { ProjectionPoint } from './parts';

/**
 * The what-if contribution slider's ceiling, as a multiple of the objective's
 * own monthly contribution, and its increment in euro.
 *
 * These bound a CONTROL; they are not a figure this screen reports. The value
 * the slider produces is fed to the kit and everything downstream of it comes
 * back out of `goalProjection`.
 */
const CONTRIBUTION_HEADROOM = 3;
const CONTRIBUTION_STEP = 500;

const props = defineProps<{
  goal: Goal;
  contribution: number;
  horizonIndex: number;
  lastIndex: number;
  livePoint?: ProjectionPoint;
  adjusted: boolean;
}>();

const emit = defineEmits<{
  contribution: [value: number];
  horizon: [value: number];
  reset: [];
}>();

const t = useT();

const contributionMax = computed(() =>
  Math.max(
    CONTRIBUTION_STEP,
    Math.ceil((props.goal.monthlyContribution * CONTRIBUTION_HEADROOM) / CONTRIBUTION_STEP) *
      CONTRIBUTION_STEP,
  ),
);

const monthsRemaining = computed(() =>
  t.value('wealth.goal.monthsRemaining', {
    count: t.value.formatNumber(props.livePoint?.month ?? 0, { maximumFractionDigits: 0 }),
  }),
);
</script>

<template>
  <div class="stack">
    <SliderControl
      :label="t('wealth.table.contribution')"
      :value-text="t.formatCurrency(contribution, { maximumFractionDigits: 0 })"
      :value="contribution"
      :min="0"
      :max="contributionMax"
      :step="CONTRIBUTION_STEP"
      @change="emit('contribution', $event)"
    >
      <template #display><Money :value="contribution" /></template>
    </SliderControl>

    <SliderControl
      :label="t('wealth.table.targetDate')"
      :value-text="monthsRemaining"
      :value="horizonIndex"
      :min="1"
      :max="lastIndex"
      :step="1"
      stops
      @change="emit('horizon', $event)"
    >
      <!-- The increments ARE the projection's own sample points (hence `stops`),
           so the ticks are meaningful rather than implied precision. -->
      <template #display><DateText v-if="livePoint" :value="livePoint.date" /></template>
    </SliderControl>

    <div class="row row--between">
      <bdi class="muted">{{ monthsRemaining }}</bdi>
      <!--
        `action.reset` is a CORE key, not a `wealth.` one. The wealth block has
        no reset verb, and an invented key renders as the key itself —
        `createTranslator` falls back to English and then to the string. The
        core block is the shared chrome and is translated in every locale, so
        borrowing it is the least-wrong option until `wealth.action.reset`
        exists. Flagged in the handover.
      -->
      <ActionButton
        variant="text"
        size="sm"
        icon="restart_alt"
        :disabled="!adjusted"
        @action="emit('reset')"
      >
        {{ t('action.reset') }}
      </ActionButton>
    </div>
  </div>
</template>
