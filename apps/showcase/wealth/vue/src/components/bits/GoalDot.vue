<!-- Labelled, like every dot here — see KycDot.vue for the rule. -->
<script setup lang="ts">
import { goalDot, type GoalStatus } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ status: GoalStatus }>();

const t = useT();
</script>

<template>
  <md-status-dot
    inline
    :state="goalDot[status]"
    size="small"
    :label="t(`wealth.goalStatus.${status}`)"
  ></md-status-dot>
</template>
