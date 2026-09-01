<!--
  The base every domain chip beside it is built from.

  `variant="assist"` throughout: these are informational, not filters and not
  removable user input. A screen that wants a toggleable facet wants
  `variant="filter"` and owns its own state.

  Every chip resolves BOTH halves of a domain value through the kit: the COLOUR
  through the status maps in `@awc-ui/showcase-kit/wealth`, the LABEL through
  the dictionary key that travels beside the value. Nothing here contains
  English, so nothing here can render English into a translated page.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{
    labelKey: string;
    color: string;
    appearance?: 'filled' | 'outlined' | 'elevated';
    icon?: string;
    title?: string;
  }>(),
  { appearance: 'filled' },
);

const t = useT();
</script>

<template>
  <md-chip
    variant="assist"
    :appearance="appearance"
    :color="color"
    :icon="icon"
    :label="t(labelKey)"
    :title="title"
  ></md-chip>
</template>
