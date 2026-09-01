<!--
  The placeholder for THIS screen, rather than the generic one.

  `<Screen>` falls back to `ScreenSkeleton`, whose four tiles carry a sparkline
  these do not — 194px of KPI row against a real 152, which rode everything
  below it 42px up the page — and whose two half-width panels are nothing like
  the three stacked full-width ones here. Measured on a first visit through the
  rail: 612px of placeholder swapped for 1546px of screen.

  Every block mirrors the real one, so only the contents of the boxes change:

    .kpi-grid      four tiles, no spark     152px
    the panel      the stepper builder      612px
    the table      the proposal book        570px
    the panel      the review trail         164px

  `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a 16px
  card inset, a 16px panel inset, a 14px head and the 12px gap under it — so
  each `height` here is the real block MINUS 90.

  ONE ANNOUNCEMENT: the first KPI tile carries the screen's name and every
  other shape is silent, because a screenful of polite live regions is a dozen
  announcements for one event.
-->
<script setup lang="ts">
import KpiSkeleton from '~/components/skeletons/KpiSkeleton.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import TableSkeleton from '~/components/skeletons/TableSkeleton.vue';

defineProps<{ label: string }>();
</script>

<template>
  <!-- No `spark` — these tiles are a figure and a hint. Only the first has a
       chip in its foot (the total proposal count), so only it is 32px. -->
  <section class="kpi-grid">
    <KpiSkeleton announce :label="label" :spark="false" />
    <KpiSkeleton :spark="false" foot="16px" />
    <KpiSkeleton :spark="false" foot="16px" />
    <KpiSkeleton :spark="false" foot="16px" />
  </section>

  <!-- The builder. One block rather than four step outlines: `md-stepper`
       shows one step at a time and the panel is a single 516px surface. -->
  <PanelSkeleton height="522px" />

  <!-- The book. `TableSkeleton` rather than `PanelSkeleton` because the real
       block is a `.table-host`, and `height` rather than a row count because
       the table carries a toolbar and a pagination bar as well as its five
       rows — `rows * 40` cannot reach 480. -->
  <TableSkeleton height="480px" />

  <!-- The review trail, which opens with nothing picked: a heading and the
       empty state telling you to pick a row. -->
  <PanelSkeleton height="74px" />
</template>
