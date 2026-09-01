<!--
  The shared empty state.

  `hint` defaults to false because most empty states here are facts, not filter
  results: "every mandate is within its bands" is the whole story, and telling
  the reader to widen the filters underneath it would be nonsense. Pass `hint`
  only where a filter or a search actually produced the emptiness.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

defineProps<{ message: string; hint?: boolean }>();

const t = useT();
</script>

<template>
  <div class="empty">
    <p>{{ message }}</p>
    <p v-if="hint">{{ t('wealth.empty.hint') }}</p>
  </div>
</template>
