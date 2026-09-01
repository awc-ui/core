<script setup lang="ts">
import { mandateColor, type Mandate } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ mandate: Mandate }>();
</script>

<template>
  <StateChip
    :label-key="`wealth.mandate.${mandate}`"
    :color="mandateColor[mandate]"
    appearance="outlined"
  />
</template>
