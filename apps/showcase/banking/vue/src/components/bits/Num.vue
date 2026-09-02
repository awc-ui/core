<!-- A plain number: a quantity, a count. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ value: number; digits?: number }>(), { digits: 0 });
const t = useT();
const text = computed(() =>
  t.value.formatNumber(props.value, {
    maximumFractionDigits: props.digits,
    minimumFractionDigits: props.digits,
  }),
);
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
