<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = defineProps<{
  value: string;
  onValue: (value: string) => void;
  label: string;
  options: readonly { value: string; label: string }[];
}>();
const change = (event: CustomEvent) => props.onValue(String(event.detail));
</script>
<template>
  <md-select
    v-awc="{ props: { value }, on: { mdChange: change } }"
    :label="label"
    variant="outlined"
    :density="-2"
    ><md-select-option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :label="option.label"
  /></md-select>
</template>
