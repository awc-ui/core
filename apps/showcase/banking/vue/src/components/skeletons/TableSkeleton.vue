<!--
  A table's shape: the panel head, then one block where the rows will be.

  `height` overrides the row arithmetic when the real table's height is known
  and is not a whole number of 40px rows — a pagination bar, a toolbar with a
  wrapped filter row.
-->
<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; height?: string }>(), { rows: 8 });
</script>

<template>
  <div class="table-host">
    <div class="skel-card panel">
      <div class="panel__inner">
        <div class="panel__head">
          <div class="skel" style="block-size: 20px; inline-size: 120px"></div>
          <div class="skel" style="block-size: 20px; inline-size: 220px"></div>
        </div>
        <!-- One block rather than a row of bars: a table's rows are uniform,
             and N stacked bars at row height is the same grey rectangle with
             more elements in the accessibility tree. -->
        <div class="skel" :style="{ blockSize: height ?? `${rows * 40}px`, inlineSize: '100%' }"></div>
      </div>
    </div>
  </div>
</template>
