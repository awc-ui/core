<!--
  Every chip in the app comes through here.

  One component, one mapping table, so a category is the same colour in the
  ring, the statement row and the budget meter. A screen never picks a `color`
  itself — it names the domain value and this resolves it through `status.ts`.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{ labelKey: string; color: string; icon?: string; appearance?: string }>(),
  { icon: undefined, appearance: 'outlined' },
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
  ></md-chip>
</template>
