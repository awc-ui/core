<script setup lang="ts">
import StateChip from './StateChip.vue';

defineProps<{ type: string }>();
</script>

<template>
  <StateChip :label-key="`wealth.instrumentType.${type}`" color="info" appearance="outlined" />
</template>
