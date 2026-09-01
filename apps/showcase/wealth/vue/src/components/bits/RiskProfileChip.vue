<script setup lang="ts">
import { riskProfileColor, type RiskProfile } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ profile: RiskProfile }>();
</script>

<template>
  <StateChip :label-key="`wealth.riskProfile.${profile}`" :color="riskProfileColor[profile]" />
</template>
