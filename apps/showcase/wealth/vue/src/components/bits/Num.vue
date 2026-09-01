<!-- A plain number: a quantity, a count, a basis-point figure. -->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(defineProps<{ value: number; digits?: number }>(), { digits: 0 });

const t = useT();
</script>

<template>
  <span class="num">{{
    t.formatNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: digits })
  }}</span>
</template>
