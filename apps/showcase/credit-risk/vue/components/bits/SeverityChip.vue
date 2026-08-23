<!-- The severity, as a chip. The dot that goes with it leads the row. -->
<script setup lang="ts">
import Chip from './Chip.vue';

defineProps<{ severity: string }>();
</script>

<template>
  <Chip kind="severity" :value="severity" />
</template>
