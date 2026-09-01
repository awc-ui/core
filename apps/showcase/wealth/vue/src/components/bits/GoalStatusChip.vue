<script setup lang="ts">
import { goalColor, type GoalStatus } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ status: GoalStatus }>();
</script>

<template>
  <StateChip :label-key="`wealth.goalStatus.${status}`" :color="goalColor[status]" />
</template>
