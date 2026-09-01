<!--
  The placeholder for the household screen, rather than the generic one.

  Measured on a first drill from the overview: the fallback put 612px of
  placeholder where 3248px of screen was coming, and its four-tile row was 16px
  short of this five-tile one — the only KPI row in the app whose tiles carry a
  sparkline AND a bare text foot, which is what makes it 178 rather than 152.

  The five panels are the reading order of a review meeting, and the skeleton
  keeps it: how it did, how far off, what is in it, who it is for, and the four
  sibling views at the foot.

    .kpi-grid      five tiles, spark, text feet    178px
    the panel      performance                     356px
    the panel      allocation + tickets            951px
    the table      holdings                        740px
    the panel      objectives                      270px
    the panel      the four tabs                   673px

  `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a 16px
  card inset, a 16px panel inset, a 14px head and the 12px gap under it — so
  each `height` here is the real block MINUS 90.

  THE OVERLAYS ARE NOT DRAWN, and that is correct rather than an omission: the
  settings side sheet and the snackbar are out of flow and closed, so they
  occupy nothing and a placeholder for them would occupy something.

  THREE OF THE SIX BLOCKS ARE NOT CONSTANTS, because this is the one screen
  that is drawn for eight different subjects and their panels are different
  heights. None of the three is a guess: each is a COUNT the screen has already
  read out of the fixture before the placeholder goes up, times a row height
  measured across all eight households.

    holdings     263 + 53 × positions   `HouseholdHoldings` does not paginate
                                        (its own note: nine rows is nowhere for
                                        pagination to go), so the table is
                                        exactly `positionCount` rows tall.
    allocation   771 + 90 × orders      the blotter under the rebalance cards is
                 −12 when in band       88px per list row with a 2px seam
                                        between them, and the panel head loses
                                        12px when there is no drift chip in it.
    the tabs     497 + 88 × members     `md-tab-panels sizing="active"` takes
                                        its height from the open panel, and the
                                        open one is the members list.

  Verified on every household in the fixture: hh-01 through hh-08 all swap at
  0px.

  ONE ANNOUNCEMENT: the first KPI tile names the household, the rest are silent.
-->
<script setup lang="ts">
import KpiSkeleton from '~/components/skeletons/KpiSkeleton.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import TableSkeleton from '~/components/skeletons/TableSkeleton.vue';

defineProps<{
  label: string;
  positions: number;
  /** Tickets in the blotter under the rebalance cards. Never 0 in the fixture. */
  orders: number;
  members: number;
  /** Whether the allocation panel's head carries a drift chip — 12px of it. */
  drifted: boolean;
}>();
</script>

<template>
  <!-- The first two tiles carry a sparkline — AUM and YTD return both plot
       the performance series — and every foot on this row is a bare line or
       a chip: 16px where the hint stands alone, 32px where a count sits
       beside it. The row is as tall as its tallest tile, so the two 146px
       sparkline tiles are what set the 178. -->
  <section class="kpi-grid">
    <KpiSkeleton announce :label="label" foot="16px" />
    <KpiSkeleton foot="16px" />
    <KpiSkeleton :spark="false" foot="16px" />
    <KpiSkeleton :spark="false" />
    <KpiSkeleton :spark="false" />
  </section>

  <!-- Performance: a 260px chart beside its return windows. -->
  <PanelSkeleton height="266px" />

  <!-- Allocation: the bar chart, the rebalance cards, and the blotter. -->
  <PanelSkeleton :height="`${681 + 90 * orders - (drifted ? 0 : 12)}px`" />

  <!-- A real `md-table` inside a `.table-host`, so it gets the table shape. -->
  <TableSkeleton :height="`${173 + 53 * positions}px`" />

  <!-- Objectives: one `.goal-row` per goal in a `.grid-3`. -->
  <PanelSkeleton height="180px" />

  <!-- The four sibling views, open on the members list. -->
  <PanelSkeleton :height="`${407 + 88 * members}px`" />
</template>
