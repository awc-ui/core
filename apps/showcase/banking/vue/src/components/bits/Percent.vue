<!-- A ratio. The value is a FRACTION — `0.0135` renders as `1.35%`. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ value: number; digits?: number }>(), { digits: 2 });
const t = useT();
const text = computed(() =>
  t.value.formatPercent(props.value, {
    maximumFractionDigits: props.digits,
    minimumFractionDigits: Math.min(props.digits, 1),
  }),
);
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
