<!--
  A count.

  COMPACT ABOVE TEN THOUSAND, EXACT BELOW IT. Higher than Lyra's threshold and
  deliberately: the numbers here are members, friends and reactions, all of
  which a reader compares between rows — "1.2K members" against "1.4K members"
  is a comparison the rounding has already thrown away.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ value: number; compact?: boolean }>(), { compact: false });
const t = useT();
</script>

<template>
  <span class="num">{{
    t.formatNumber(
      props.value,
      props.compact && props.value >= 10_000
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 },
    )
  }}</span>
</template>
