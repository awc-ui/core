<!--
  The shape a screen gets when it has not described its own.

  IT IS NOT THE COMMON CASE, and that is the point. In the React source every
  one of the six screens passes its own measured `skeleton` to `<Screen>`,
  because "a KPI row and two panels" was never any of their real layouts. What
  is left on this fallback is the not-found screen and the household guard —
  pages with nothing much to stand in for — plus the stub screens until the
  screens phase lands its measured ones.

  So treat a screen reaching this as one that has not been measured yet.
  Exactly ONE shape announces (role=status on the first KPI's label bar), with
  the screen name.
-->
<script setup lang="ts">
import KpiSkeleton from './KpiSkeleton.vue';
import PanelSkeleton from './PanelSkeleton.vue';

withDefaults(defineProps<{ kpis?: number; panels?: number; label?: string }>(), {
  kpis: 4,
  panels: 2,
});
</script>

<template>
  <section v-if="kpis > 0" class="kpi-grid">
    <KpiSkeleton v-for="i in kpis" :key="i" :announce="i === 1" :label="label" />
  </section>

  <section class="grid-2">
    <PanelSkeleton v-for="i in panels" :key="i" :lines="8" />
  </section>
</template>
