<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

defineProps<{ id: string; selected?: boolean }>();
const t = useT();
</script>

<template>
  <!-- `|| undefined` so a false value emits NO ATTRIBUTE. `selected` is a
       boolean attribute — presence means true — and a literal `false` would
       write `selected="false"`, which the Svelte port omits entirely. Two
       builds would then disagree on the DOM for a chip that is simply not
       chosen. -->
  <md-chip
    variant="filter"
    appearance="outlined"
    :data-topic="id"
    :selected="selected || undefined"
    :label="t(`social.topic.${id}`)"
  ></md-chip>
</template>
