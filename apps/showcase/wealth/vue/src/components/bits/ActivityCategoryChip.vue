<script setup lang="ts">
import StateChip from './StateChip.vue';

defineProps<{ category: string }>();
</script>

<template>
  <StateChip
    :label-key="`wealth.activityCategory.${category}`"
    color="secondary"
    appearance="outlined"
  />
</template>
