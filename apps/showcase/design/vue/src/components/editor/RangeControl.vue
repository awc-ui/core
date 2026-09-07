<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = withDefaults(
  defineProps<{
    value: number;
    onValue: (value: number) => void;
    label: string;
    min?: number;
    max?: number;
    step?: number;
  }>(),
  { min: 0, max: 100, step: 5 },
);
const draft = ref(props.value);
watch(
  () => props.value,
  (value) => {
    draft.value = value;
  },
);
const read = (event: CustomEvent) =>
  Number(typeof event.detail === "number" ? event.detail : event.detail?.value);
const input = (event: CustomEvent) => {
  if (Number.isFinite(read(event))) draft.value = read(event);
};
const change = (event: CustomEvent) => {
  if (Number.isFinite(read(event))) {
    draft.value = read(event);
    props.onValue(read(event));
  }
};
</script>
<template>
  <div class="studio-range">
    <div>
      <span>{{ label }}</span
      ><strong>{{ draft }}{{ min === 0 && max === 100 ? "%" : "" }}</strong>
    </div>
    <md-slider
      v-awc="{
        props: { value: draft, min, max, step, valueIndicator: true },
        on: { mdInput: input, mdChange: change },
      }"
      :aria-label="label"
    />
  </div>
</template>
