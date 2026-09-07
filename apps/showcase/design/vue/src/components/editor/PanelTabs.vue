<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = defineProps<{
  value: string;
  onValue: (value: string) => void;
  label: string;
  options: readonly { value: string; label: string; icon?: string }[];
}>();
const active = computed(() =>
  Math.max(
    0,
    props.options.findIndex((option) => option.value === props.value),
  ),
);
const change = (event: CustomEvent) => {
  if (event.target !== event.currentTarget) return;
  const option = props.options[event.detail.index];
  if (option) props.onValue(option.value);
};
</script>
<template>
  <md-tabs
    class="studio-panel-tabs"
    :aria-label="label"
    variant="secondary"
    tab-width="equal"
    v-awc="{ props: { activeTabIndex: active }, on: { mdTabChange: change } }"
    ><md-tab
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :density="0"
      v-awc="{ props: { active: value === option.value } }"
  /></md-tabs>
</template>
