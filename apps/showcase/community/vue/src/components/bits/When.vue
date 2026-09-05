<!--
  How long ago, in words, inside a `<time>` that still carries the instant.

  Measured against `REPORTING_INSTANT`, never `Date.now()` — every screenshot,
  every parity comparison and every test would otherwise disagree with itself a
  minute later.
-->
<script setup lang="ts">
import { REPORTING_INSTANT } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ at: string }>();
const t = useT();
</script>

<template>
  <time
    :datetime="props.at"
    :title="t.formatDate(props.at.slice(0, 10), 'long')"
    class="when"
    >{{ t.formatRelativeTime(props.at, REPORTING_INSTANT, { style: 'narrow' }) }}</time
  >
</template>
