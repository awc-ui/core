<!-- The time of day, for an event's start and end. Pinned to UTC, like every
     other formatter in this app, so the fixture reads the same everywhere. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ at: string }>();
const t = useT();

const text = computed(() =>
  new Intl.DateTimeFormat(t.value.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(props.at),
  ),
);
</script>

<template>
  <time :datetime="props.at">{{ text }}</time>
</template>
