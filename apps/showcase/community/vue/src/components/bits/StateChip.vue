<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{
    labelKey: string;
    color?: string;
    icon?: string;
    appearance?: 'outlined' | 'filled';
  }>(),
  { appearance: 'outlined' },
);
const t = useT();
</script>

<template>
  <md-chip
    variant="assist"
    :appearance="props.appearance"
    :color="props.color"
    :icon="props.icon"
    :label="t(props.labelKey)"
  />
</template>
