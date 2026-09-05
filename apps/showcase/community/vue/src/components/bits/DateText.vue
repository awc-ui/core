<!--
  A calendar date, for the one thing in this app that genuinely has one.

  THE PROP IS `format`, NOT `style`. `style` is reserved on a Vue component —
  it is the HTML style binding — so a `style="long"` prop is swallowed by the
  attribute layer and never reaches the component. The React port can call it
  `style` because JSX has no such reservation; this is one of the small places
  the two ports genuinely cannot share a name.

  AN EVENT IS NOT "IN 3 DAYS", IT IS ON A DATE. Relative time is right for a
  post — the reader wants to know how fresh it is — and wrong for an event,
  which the reader is planning around. This is the exception convention 4 in the
  kit calls out.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ at: string; format?: 'medium' | 'long' }>(), {
  format: 'medium',
});
const t = useT();
</script>

<template>
  <time :datetime="props.at">{{ t.formatDate(props.at.slice(0, 10), props.format) }}</time>
</template>
