<!--
  A count.

  COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and `exact` forces the long form
  where the reader would dispute the rounding — a follower total on a profile
  header is a number people check, a like count on a feed post is not. The
  threshold and the digit rule are the kit's, not this component's.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { countOptions } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ value: number; exact?: boolean }>();
const t = useT();
const text = computed(() =>
  t.value.formatNumber(props.value, countOptions(props.value, props.exact ? 'exact' : 'compact')),
);
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
