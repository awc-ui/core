<!--
  A calendar date.

  Rendered inside a `<time>` with a machine-readable `dateTime`, so the ISO
  value survives even though the visible text is localised. `formatDate` is
  pinned to UTC in the kit, so 2026-06-30 is 30 June west of Greenwich too.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{ value: string; dateStyle?: 'short' | 'medium' | 'long' | 'monthYear' }>(),
  { dateStyle: 'medium' },
);

const t = useT();
</script>

<template>
  <time :datetime="value">{{ t.formatDate(value, dateStyle) }}</time>
</template>
