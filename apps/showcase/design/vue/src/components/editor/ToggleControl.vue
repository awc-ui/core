<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = defineProps<{
  selected: boolean;
  onValue: (value: boolean) => void;
  label: string;
}>();
const change = (event: CustomEvent) => props.onValue(event.detail.selected);
</script>
<template>
  <label class="studio-toggle"
    ><span>{{ label }}</span
    ><md-switch
      v-awc="{ props: { selected }, on: { mdChange: change } }"
      :aria-label="label"
  /></label>
</template>
