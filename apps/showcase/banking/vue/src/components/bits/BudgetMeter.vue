<!-- A budget's usage. Clamped bar, uncapped text — 115% reads as 115%. -->
<script setup lang="ts">
import { budgetColor, type BudgetStatus } from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import RatioMeter from './RatioMeter.vue';

defineProps<{ fraction: number; status: BudgetStatus }>();
const t = useT();
</script>

<template>
  <RatioMeter :label="t('banking.kpi.budgetUsed')" :fraction="fraction" :color="budgetColor[status]" />
</template>
