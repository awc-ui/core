<!--
  An `md-button` that reports through `mdClick`.

  §9.1: listen to the component's own event, never the native `click` — the
  native one fires even when the component's `disabled` / `soft-disabled` /
  `loading` guard has already suppressed the action. `mdClick` goes through
  `v-awc` because `@mdClick` compiles to a listener for `md-click`, an event the
  library never emits — see lib/awc.ts.

  The root is the `md-button` itself, with no wrapper element: an `md-toolbar`
  wires roving focus over its DIRECT children, and a wrapper around the button
  would drop it out of that group. (In the React source this component is
  exported from HouseholdTabs.tsx; an SFC is one component per file, so it lives
  beside its screen instead.)

  `soft-disabled` keeps the control focusable while it is unavailable — the
  guard in the handler is what actually suppresses the action, because a
  soft-disabled button still emits `mdClick`.
-->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    icon: string;
    variant?: 'text' | 'tonal' | 'filled' | 'outlined' | 'elevated';
    softDisabled?: boolean;
  }>(),
  { variant: 'text', softDisabled: false },
);

const emit = defineEmits<{ (e: 'activate'): void }>();

// Declared once so the directive's identity check never re-binds the listener;
// it reads the prop at call time rather than closing over a stale value.
const listeners = {
  mdClick: () => {
    if (props.softDisabled) return;
    emit('activate');
  },
};
</script>

<template>
  <md-button
    v-awc="{ on: listeners }"
    :variant="variant"
    size="sm"
    :icon="icon"
    :soft-disabled="softDisabled || undefined"
  >
    <slot />
  </md-button>
</template>
