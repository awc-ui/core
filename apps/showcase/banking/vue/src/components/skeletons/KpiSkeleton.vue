<!--
  A KPI tile's shape: label line, value line, optional sparkline, foot line.

  `spark` is what the tile actually has, not decoration. `KpiTile` draws a
  sparkline only when the screen gives it one — the overview's tiles do, the
  holdings tiles do not.

  `foot` is the same fact about the tile's last line: a foot carrying a bare
  hint is one 16px text line; a foot carrying a chip beside that text is 32,
  because the chip is 32.
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    announce?: boolean;
    label?: string;
    spark?: boolean;
    /** `'32px'` when the real tile's foot holds a chip, `'16px'` when it is text alone. */
    foot?: string;
  }>(),
  { spark: true, foot: '32px' },
);
</script>

<template>
  <div class="skel-card skel-card--filled">
    <!-- The heights are the tile's OWN, measured off a rendered `KpiTile`: a
         16px label, a 32px value, a 34px sparkline, and a foot of 16 or 32. -->
    <div class="kpi">
      <div
        class="skel"
        style="block-size: 16px; inline-size: 60%"
        :role="announce ? 'status' : undefined"
        :aria-label="announce ? label : undefined"
      ></div>
      <div class="skel" style="block-size: 32px; inline-size: 45%"></div>
      <div v-if="spark" class="kpi__spark">
        <div class="skel" style="block-size: 34px; inline-size: 100%"></div>
      </div>
      <div class="skel" :style="{ blockSize: foot, inlineSize: '70%' }"></div>
    </div>
  </div>
</template>
