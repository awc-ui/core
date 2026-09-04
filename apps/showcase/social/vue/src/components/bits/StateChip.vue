<!-- Every chip in the app resolves its label and colour the same way. -->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{ labelKey: string; color?: string; icon?: string; appearance?: string }>(),
  { appearance: 'outlined' },
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
