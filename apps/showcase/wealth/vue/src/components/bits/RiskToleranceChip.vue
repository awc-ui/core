<script setup lang="ts">
import { riskToleranceColor, type RiskTolerance } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ tolerance: RiskTolerance }>();
</script>

<template>
  <StateChip
    :label-key="`wealth.riskTolerance.${tolerance}`"
    :color="riskToleranceColor[tolerance]"
    appearance="outlined"
  />
</template>
