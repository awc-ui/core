<script setup lang="ts">
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
</script>
<template>
  <div class="artist-row">
    <SkeletonCircle :size="48" />
    <div class="track-row__text">
      <SkeletonLine w="34%" :h="20" />
      <SkeletonLine w="22%" :h="16" />
    </div>
  </div>
</template>
