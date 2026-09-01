<!--
  The placeholder for THIS screen, rather than the generic one.

  `<Screen>` falls back to `ScreenSkeleton` — a KPI row and two panels — which
  is what none of the six screens actually opens with. Holdings opens with six
  blocks, and the generic shape got three of them wrong: it drew a two-panel
  grid where this screen has a filter bar, a tab bar and an 840px table, and it
  stopped before the three-up row and the concentration panel entirely. The
  swap therefore moved the whole page, which is precisely what a skeleton
  exists to prevent.

  Every block below mirrors the real one — same wrapper, same class, same
  count — so the only thing that changes when the data lands is the content of
  the boxes:

    .kpi-grid      four tiles          152px
    .stack         the filter bar      108px  (field row + filter-chip row)
    md-tabs        two tabs             48px
    the table                          840px
    .grid-3        three panels        268px
    the panel      concentration       498px

  THE BARS ARE SHORTER THAN THE CONTROLS THEY STAND FOR, AND THAT IS ALLOWED:
  the placeholder does not occupy layout (it is painted over content that keeps
  its own box), so height here is purely how heavy the placeholder LOOKS. Each
  bar keeps the flex basis and the corner of its control — search 1 1 260px at
  a 9999px pill, the asset-class select 0 1 220px and the instrument lookup
  1 1 240px at an outlined field's 4px, the export split button 143×40 at 20px,
  the overflow icon button as a circle — drawn at 32px, centred in the 56px
  field row by `.row`'s own `align-items: center`. The circle stays square
  because a squashed circle reads as a different control.

  ONE ANNOUNCEMENT. Every shape here takes `announce` off; the first KPI tile
  carries the screen's name and is the only one that speaks.
-->
<script setup lang="ts">
import KpiSkeleton from '~/components/skeletons/KpiSkeleton.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import SkeletonBar from '~/components/skeletons/SkeletonBar.vue';
import TableSkeleton from '~/components/skeletons/TableSkeleton.vue';

defineProps<{ label: string }>();
</script>

<template>
  <!-- No `spark`: these four tiles carry a figure, a hint and a count —
       the sparkline belongs to the overview's tiles, not these. -->
  <section class="kpi-grid">
    <KpiSkeleton v-for="i in 4" :key="i" :announce="i === 1" :label="label" :spark="false" />
  </section>

  <!--
    THE FILTER BAR, AS FIVE FIELDS AND A CHIP ROW — not two solid slabs. The
    `.stack` is 56 + 12 + 40 = 108, the real bar's own two rows measured on it:
    the field row is 56 because `md-search` is 56, and the chip row is the
    reservation `HoldingsFilters` holds so that picking a filter never pushes
    the table down.
  -->
  <div class="stack">
    <div class="row" style="min-block-size: 56px">
      <SkeletonBar radius="9999px" height="32px" flex="1 1 260px" />
      <SkeletonBar radius="4px" height="32px" flex="0 1 220px" />
      <SkeletonBar radius="4px" height="32px" flex="1 1 240px" />
      <SkeletonBar radius="16px" height="32px" width="143px" />
      <div class="skel skel--circle" style="inline-size: 32px; block-size: 32px"></div>
    </div>

    <!--
      THE CHIP ROW IS A RESERVATION, and the pills say what it reserves. Three
      of them rather than a bar: the row holds `md-chip variant="input"` tokens
      at 32px with an 8px corner, so three short pills read as "your filters
      will appear here" where a 662px slab read as content about to land.
    -->
    <div class="row">
      <SkeletonBar radius="8px" height="24px" width="104px" />
      <SkeletonBar radius="8px" height="24px" width="76px" />
      <SkeletonBar radius="8px" height="24px" width="120px" />
    </div>
  </div>

  <!--
    The tab bar. A single bar rather than two tab-shaped blocks: the real one
    is a continuous band with a divider under it, and two stubs would read as
    buttons.
  -->
  <div class="skel" style="inline-size: 100%; block-size: 28px"></div>

  <!-- 19 rows at 40px is the 760px the positions table opens at, inside the
       same panel chrome `TableSkeleton` draws for every other table. -->
  <TableSkeleton height="750px" />

  <section class="grid-3">
    <PanelSkeleton v-for="i in 3" :key="i" height="178px" />
  </section>

  <!-- Concentration: one block at the height of the ten cards it holds,
       following the same rule `TableSkeleton` states — a grid of uniform
       tiles is the same grey rectangle with more elements in the
       accessibility tree. -->
  <PanelSkeleton height="408px" />
</template>
