<!-- A full UTC instant from the audit trail. The date part is what is shown. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ value: string }>();

const t = useT();
const date = computed(() => props.value.slice(0, 10));
</script>

<template>
  <time :datetime="value">{{ t.formatDate(date, 'medium') }}</time>
</template>
