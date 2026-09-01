<script setup lang="ts">
import { strategyColor, type Strategy } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ strategy: Strategy }>();
</script>

<template>
  <StateChip :label-key="`wealth.strategy.${strategy}`" :color="strategyColor[strategy]" />
</template>
