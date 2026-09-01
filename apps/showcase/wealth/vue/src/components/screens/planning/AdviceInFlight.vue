<!--
  The household's open advice, each with its review position.

  The determinate bar is `completedStepCount` of `stepCount` — a count against
  its total, handed to the component rather than pre-divided into a percentage,
  which is what `value` / `max` are for. A multi-step job with a measurable
  position is the progress indicator's canonical case (an ACTIVITY); funding is
  a STATE and stays an `md-meter` — see the screen's header.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getProposals } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import Money from '~/components/bits/Money.vue';

type Proposal = ReturnType<typeof getProposals>[number];

const props = defineProps<{ householdId: string }>();

const t = useT();

const proposals = computed(() => getProposals({ householdId: props.householdId, open: true }));

const position = (proposal: Proposal) =>
  t.value('wealth.proposal.stepProgress', {
    // 1-based for the reader; `currentStepIndex` is an array index.
    current: proposal.currentStepIndex + 1,
    total: proposal.stepCount,
  });

const stepLabel = (proposal: Proposal) => {
  const step = proposal.steps[proposal.currentStepIndex];
  return step ? t.value(step.nameKey) : t.value(proposal.statusKey);
};
</script>

<template>
  <EmptyState v-if="proposals.length === 0" :message="t('wealth.empty.proposals')" />
  <div v-else>
    <div v-for="proposal in proposals" :key="proposal.id" class="plan-progress">
      <div class="row row--between">
        <span class="strong">{{ t(proposal.typeKey) }}</span>
        <bdi class="muted">{{ position(proposal) }}</bdi>
      </div>
      <md-progress-indicator
        variant="linear"
        :value="proposal.completedStepCount"
        :max="proposal.stepCount"
        :label="position(proposal)"
      ></md-progress-indicator>
      <div class="row row--between">
        <span class="muted">{{ stepLabel(proposal) }}</span>
        <span class="muted">
          <Money :value="proposal.estimatedValue" compact />
        </span>
      </div>
    </div>
  </div>
</template>
