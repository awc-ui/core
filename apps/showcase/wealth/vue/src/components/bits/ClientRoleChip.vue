<script setup lang="ts">
import StateChip from './StateChip.vue';

defineProps<{ role: string }>();
</script>

<template>
  <StateChip :label-key="`wealth.clientRole.${role}`" color="secondary" appearance="outlined" />
</template>
