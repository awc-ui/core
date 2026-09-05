<script setup lang="ts">
import PanelSkeleton from './PanelSkeleton.vue';
import TrackListSkeleton from './TrackListSkeleton.vue';
import ShelfSkeleton from './ShelfSkeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
</script>
<template>
  <div class="stack">
    <PanelSkeleton :head="false">
      <div class="release-head">
        <SkeletonBar width="200px" height="200px" radius="16px" />
        <div class="stack">
          <SkeletonLine w="260px" :h="28" />
          <SkeletonLine w="180px" :h="16" />
          <SkeletonLine w="120px" :h="16" />
          <SkeletonBar width="140px" height="40px" radius="20px" />
        </div>
      </div>
    </PanelSkeleton>
    <PanelSkeleton><TrackListSkeleton :rows="3" /></PanelSkeleton>
    <PanelSkeleton><ShelfSkeleton :count="2" /></PanelSkeleton>
  </div>
</template>
