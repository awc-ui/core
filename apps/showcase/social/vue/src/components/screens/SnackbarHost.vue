<!--
  The one snackbar, and the state that raises it.

  FOUR SCREENS RAISE ONE, so the wiring is written once. Each holds its own
  instance — a snackbar is `position: fixed` and paints over the viewport, so
  two mounted at once are two overlays fighting for the same corner.

  THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A screen that
  built "Following Ada Lindqvist" itself would have composed a sentence in
  English word order and handed it to the Arabic build intact.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

const props = defineProps<{ message: SnackbarMessage | null }>();
const emit = defineEmits<{ close: [] }>();
const t = useT();

/* The component closes itself on the timeout and on the dismiss button; this
   listens so the screen's own state follows, or the next identical message
   would set `open` to a value it already has and never re-open. */
const listeners = { mdClose: () => emit('close') };
const text = computed(() =>
  props.message ? t.value(props.message.key, props.message.params) : '',
);
</script>

<template>
  <md-snackbar
    v-awc="{ on: listeners }"
    class="app-snackbar"
    position="bottom"
    closeable
    auto-hide
    :open="message !== null || undefined"
    :message="text"
    :dismiss-label="t('social.action.close')"
  ></md-snackbar>
</template>
