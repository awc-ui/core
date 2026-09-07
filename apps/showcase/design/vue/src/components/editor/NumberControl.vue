<script setup lang="ts">
const t = useT();
import { useT } from "~/composables/useShowcase";

import { ref, watch, computed } from "vue";
const props = withDefaults(
  defineProps<{
    value: number | null;
    onValue: (value: number) => void;
    label: string;
    min?: number;
    max?: number;
  }>(),
  { min: 0, max: 48 },
);
const change = (event: CustomEvent) => {
  const value = event.detail?.value;
  if (typeof value === "number" && Number.isFinite(value)) props.onValue(value);
};
</script>
<template>
  <md-number-field
    :locale="t.locale === 'ar' ? 'ar-u-nu-arab' : t.locale"
    :increment-label="t('Increment')"
    :decrement-label="t('Decrement')"
    :value-missing-label="t('Please enter a number.')"
    v-awc="{ props: { value, min, max }, on: { mdChange: change } }"
    :label="label"
    :placeholder="value === null ? t('Mixed') : undefined"
    :step="1"
    variant="outlined"
    :density="-2"
    steppers="none"
  />
</template>
