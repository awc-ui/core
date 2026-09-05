<!--
  A track row, in the REAL row's grid — `.track-row` itself rather than an
  approximation, so the columns are the screen's own and the reveal cannot shift
  anything sideways.

  MEASURED, NOT GUESSED. Off the real row at 1440px: title 20, artist 16,
  album 16, duration 16, buttons 40, row 56.
-->
<script setup lang="ts">
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';

withDefaults(defineProps<{ albums?: boolean }>(), { albums: false });
</script>

<template>
  <div class="track-row">
    <SkeletonLine w="100%" :h="12" />
    <div class="track-row__text">
      <SkeletonLine w="54%" :h="20" />
      <SkeletonLine w="32%" :h="16" />
    </div>
    <SkeletonLine v-if="albums" w="46%" :h="16" />
    <SkeletonLine w="32px" :h="16" />
    <div class="row">
      <SkeletonCircle :size="40" />
      <SkeletonCircle :size="40" />
    </div>
  </div>
</template>
