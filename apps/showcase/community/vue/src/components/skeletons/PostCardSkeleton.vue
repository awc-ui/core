<!--
  One post: byline, prose, sometimes a picture, and the action row.

  `media` is a real property of the post it stands for rather than decoration —
  roughly a third of this feed carries pictures, so a placeholder where every
  card had one would promise a feed that does not exist.
-->
<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
withDefaults(defineProps<{ media?: boolean; lines?: number }>(), { media: false, lines: 3 });
</script>
<template>
  <div class="skel-card">
    <div class="row" style="align-items: center">
      <SkeletonCircle :size="40" />
      <div class="stack" style="flex: 1; gap: 6px">
        <SkeletonLine w="38%" :h="15" />
        <SkeletonLine w="22%" :h="12" />
      </div>
    </div>
    <div class="stack" style="gap: 8px; margin-block-start: 12px">
      <SkeletonLine v-for="i in lines" :key="i" :w="i === lines ? '64%' : '100%'" />
    </div>
    <SkeletonBar v-if="media" width="100%" height="240px" radius="12px" />
    <div class="row" style="margin-block-start: 12px; gap: 24px">
      <SkeletonBar v-for="i in 3" :key="i" width="84px" height="20px" radius="4px" />
    </div>
  </div>
</template>
