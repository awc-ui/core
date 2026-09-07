<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = defineProps<{
  value: string;
  onValue: (value: string) => void;
  label: string;
  options: readonly { value: string; label: string; icon?: string }[];
}>();
const change = (event: CustomEvent) => {
  if (event.detail[0]) props.onValue(event.detail[0]);
};
</script>
<template>
  <md-segmented-button-set
    class="studio-segments"
    v-awc="{ on: { mdChange: change } }"
    :aria-label="label"
    :density="-2"
    ><md-segmented-button
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :label="option.label"
      :icon="option.icon"
      v-awc="{ props: { selected: value === option.value } }"
  /></md-segmented-button-set>
</template>
