<!--
  An `md-select` bound to state. `mdChange`'s detail is the new value, a string.

  The event goes through `v-awc` (camelCase md* events fail silently as `@`
  bindings — lib/awc.ts), and `full-width` through `flag()` so `false` omits
  the attribute rather than writing a value `:host([full-width])` would match.
-->
<script setup lang="ts">
import { flag } from './parts';

withDefaults(defineProps<{ label: string; value: string; fullWidth?: boolean }>(), {
  fullWidth: true,
});

const emit = defineEmits<{ change: [value: string] }>();

const listeners = {
  mdChange: (event: Event) => emit('change', (event as CustomEvent<string>).detail ?? ''),
};
</script>

<template>
  <md-select
    v-awc="{ on: listeners }"
    variant="outlined"
    :label="label"
    :value="value"
    :full-width.attr="flag(fullWidth)"
  >
    <slot />
  </md-select>
</template>
