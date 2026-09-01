<script setup lang="ts">
import { segmentColor, type Segment } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ segment: Segment }>();
</script>

<template>
  <StateChip
    :label-key="`wealth.segment.${segment}`"
    :color="segmentColor[segment]"
    appearance="outlined"
  />
</template>
