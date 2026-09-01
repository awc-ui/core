<script setup lang="ts">
import StateChip from './StateChip.vue';

defineProps<{ type: string }>();
</script>

<template>
  <StateChip :label-key="`wealth.proposalType.${type}`" color="secondary" appearance="outlined" />
</template>
