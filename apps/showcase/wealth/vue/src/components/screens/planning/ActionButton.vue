<!--
  An `md-button` that reports its activation.

  `mdClick` rather than a native `@click`: it is the event the component
  documents, it is cancelable, and it fires for Enter and Space as well as for
  the pointer. It goes through `v-awc` because `@mdClick` compiles to a
  listener for `md-click`, an event the library never emits — see lib/awc.ts.

  `disabled` binds with `.attr` via `flag()` so the OFF state removes the
  attribute instead of writing `disabled="false"` (a disabled button that looks
  enabled) or leaving a pre-upgrade attribute behind — see parts.ts.
-->
<script setup lang="ts">
import { flag } from './parts';

defineProps<{
  variant?: string;
  size?: string;
  icon?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ action: [] }>();

// Declared once so the directive's identity check never re-binds the listener.
const listeners = { mdClick: () => emit('action') };
</script>

<template>
  <md-button
    v-awc="{ on: listeners }"
    :variant="variant"
    :size="size"
    :icon="icon"
    :disabled.attr="flag(disabled)"
  >
    <slot />
  </md-button>
</template>
