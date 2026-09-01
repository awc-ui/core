<!--
  The placeholder for THIS screen, rather than the generic one.

  `<Screen>` falls back to `ScreenSkeleton` — a KPI row and two panels — and on
  this screen that got two things wrong at once. Its tiles carry a sparkline
  and these do not, which made the KPI row 194px against a real 152 and rode
  everything below it 42px up the page; and it stopped after two half-width
  panels where this screen has a full-width objectives board and a wide/narrow
  split under it. Measured (on the React source) on a first visit through the
  rail: the content region went from 612px of placeholder to 2766px of screen.

  Every block below mirrors the real one — same wrapper, same class, same
  count — so only the contents of the boxes change when the data lands:

    .kpi-grid      four tiles, no spark        152px
    the panel      filters + twelve goals     1766px
    .grid-wide     projection | assumptions    816px

  `PanelSkeleton` draws 90px of its own chrome — a 16px card inset, a 16px
  panel inset, a 14px head and the 12px gap under it — so each `height` below
  is the real block MINUS 90. That is why they are not round numbers.

  ONE ANNOUNCEMENT. A screenful of polite live regions is a dozen announcements
  for one event. The first KPI tile carries the screen's name and is the only
  one that speaks.
-->
<script setup lang="ts">
import KpiSkeleton from '~/components/skeletons/KpiSkeleton.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';

defineProps<{ label: string }>();
</script>

<template>
  <!-- No `spark`: these tiles carry a figure and a hint, and the sparkline
       belongs to the overview's and the household's. `foot` is the tile's own
       last line — 32 where a chip sits beside the hint (the objective count,
       the at-risk count), 16 where the hint is text alone. -->
  <section class="kpi-grid">
    <KpiSkeleton announce :label="label" :spark="false" />
    <KpiSkeleton :spark="false" foot="16px" />
    <KpiSkeleton :spark="false" />
    <KpiSkeleton :spark="false" foot="16px" />
  </section>

  <!-- The objectives board: a filter row and twelve goal cards in a `.grid-3`.
       One block rather than twelve card outlines, following the rule
       `TableSkeleton` states — a grid of uniform tiles is the same grey
       rectangle with more elements in the accessibility tree. -->
  <PanelSkeleton height="1676px" />

  <!-- The projection beside its assumptions. `.grid-wide` is a 2fr/1fr pair
       and the row is as tall as the taller cell, so the chart panel is what
       sets the 816px; the two on the right are their own heights. -->
  <div class="grid-wide">
    <PanelSkeleton height="726px" />
    <div class="stack">
      <PanelSkeleton height="442px" />
      <PanelSkeleton height="74px" />
    </div>
  </div>
</template>
