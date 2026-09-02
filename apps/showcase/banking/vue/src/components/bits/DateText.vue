<!-- A calendar date, formatted through the translator (pinned to UTC). -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

/*
 * `format`, NOT `style`. Vue reserves `style` on every component for the HTML
 * style binding, so a prop of that name is shadowed and arrives as an object —
 * the compiler catches it, which is how this was found rather than shipped.
 */
const props = withDefaults(
  defineProps<{ value: string; format?: 'short' | 'medium' | 'long' | 'monthYear' }>(),
  { format: 'medium' },
);
const t = useT();
const text = computed(() => t.value.formatDate(props.value, props.format));
</script>

<template>
  <time :datetime="value">{{ text }}</time>
</template>
