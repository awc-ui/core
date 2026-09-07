<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = withDefaults(
  defineProps<{
    value: string;
    onValue: (value: string) => void;
    live?: boolean;
    label?: string;
    placeholder?: string;
  }>(),
  { live: false },
);
const input = (event: CustomEvent) => {
  if (props.live) props.onValue(String(event.detail ?? ""));
};
const change = (event: CustomEvent) => {
  if (!props.live) props.onValue(String(event.detail ?? ""));
};
</script>
<template>
  <md-text-field
    v-awc="{ props: { value }, on: { mdInput: input, mdChange: change } }"
    :label="label"
    :placeholder="placeholder"
    variant="outlined"
    :density="-2"
  />
</template>
