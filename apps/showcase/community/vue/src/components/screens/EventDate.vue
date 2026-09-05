<!-- The month/day block. A date rendered inline inside a paragraph cannot be
     SCANNED — the eye has to read each row to find it. Month over day, fixed
     width, so every row's dates line up down the column. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ at: string }>();
const t = useT();
const d = computed(() => new Date(props.at));
const month = computed(() =>
  new Intl.DateTimeFormat(t.value.locale, { month: 'short', timeZone: 'UTC' }).format(d.value),
);
const day = computed(() =>
  new Intl.DateTimeFormat(t.value.locale, { day: 'numeric', timeZone: 'UTC' }).format(d.value),
);
</script>

<template>
  <time class="event-date" :datetime="props.at">
    <span class="event-date__month">{{ month }}</span>
    <span class="event-date__day">{{ day }}</span>
  </time>
</template>
