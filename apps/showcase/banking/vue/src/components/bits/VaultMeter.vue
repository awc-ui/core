<!--
  A vault's progress towards its goal.

  Always `primary`: saving towards something is not a state that can go wrong,
  so there is no colour to earn. A vault at 12% is not a problem.
-->
<script setup lang="ts">
import RatioMeter from './RatioMeter.vue';

defineProps<{ fraction: number; label: string }>();
</script>

<template>
  <RatioMeter :label="label" :fraction="fraction" color="primary" :thickness="8" />
</template>
