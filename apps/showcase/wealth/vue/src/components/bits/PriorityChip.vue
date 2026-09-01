<script setup lang="ts">
import { priorityColor, type Priority } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ priority: Priority }>();
</script>

<template>
  <StateChip
    :label-key="`wealth.priority.${priority}`"
    :color="priorityColor[priority]"
    appearance="outlined"
  />
</template>
