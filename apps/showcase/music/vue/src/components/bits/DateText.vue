<!-- A calendar date, for a project's "updated" line. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';
const props = defineProps<{ at: string }>();
const t = useT();
const text = computed(() => t.value.formatDate(props.at.slice(0, 10), 'medium'));
</script>
<template>
  <time :datetime="at">{{ text }}</time>
</template>
