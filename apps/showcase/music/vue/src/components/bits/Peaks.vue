<!--
  A run of loudness samples as bars.

  THE HEIGHT IS A DATA ATTRIBUTE, NOT A STYLE. `style-src-attr 'none'` refuses
  `style="height: 62%"`, so each sample is rounded to one of eleven buckets and
  `app.css` carries a rule per bucket — coarser than the data and imperceptible
  at three pixels wide.

  `aria-hidden`, because it is a texture rather than information.
-->
<script setup lang="ts">
defineProps<{ peaks: readonly number[] }>();
const bucket = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10);
</script>

<template>
  <span class="peaks" aria-hidden="true">
    <span v-for="(value, index) in peaks" :key="index" class="peaks__bar" :data-h="bucket(value)" />
  </span>
</template>
