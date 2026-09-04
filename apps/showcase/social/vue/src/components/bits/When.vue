<!--
  How long ago, in words, inside a `<time>` that still carries the instant.

  THE MACHINE-READABLE VALUE SURVIVES. "3h ago" is unambiguous to a reader and
  useless to anything parsing the page, so the ISO instant stays in `datetime`,
  and the `title` carries the full formatted date — which is what a reader who
  actually wants the day does next.

  Measured against `REPORTING_INSTANT`, never `Date.now()`. Every screenshot,
  every parity comparison and every test would otherwise disagree with itself a
  minute later.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { REPORTING_INSTANT } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ at: string; style?: 'narrow' | 'short' | 'long' }>(),
  { style: 'narrow' },
);
const t = useT();
const text = computed(() =>
  t.value.formatRelativeTime(props.at, REPORTING_INSTANT, { style: props.style }),
);
const exact = computed(() => t.value.formatDate(props.at.slice(0, 10), 'long'));
</script>

<template>
  <time :datetime="at" :title="exact" class="when">{{ text }}</time>
</template>
