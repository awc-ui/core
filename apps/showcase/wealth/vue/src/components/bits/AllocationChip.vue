<script setup lang="ts">
import { allocationColor, type AllocationStatus } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ status: AllocationStatus }>();
</script>

<template>
  <StateChip :label-key="`wealth.allocationStatus.${status}`" :color="allocationColor[status]" />
</template>
