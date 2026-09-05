<script setup lang="ts">
import PanelSkeleton from './PanelSkeleton.vue';
import TrackListSkeleton from './TrackListSkeleton.vue';
import ShelfSkeleton from './ShelfSkeleton.vue';
import ProjectListSkeleton from './ProjectListSkeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
</script>
<template>
  <div class="stack">
    <PanelSkeleton :head="false">
      <div class="release-head">
        <SkeletonBar width="200px" height="200px" radius="16px" />
        <div class="stack">
          <SkeletonLine w="220px" :h="28" />
          <SkeletonLine w="140px" :h="16" />
          <div class="row">
            <div v-for="i in 4" :key="i" class="track-row__text">
              <SkeletonLine w="70px" :h="16" />
              <SkeletonLine w="46px" :h="20" />
            </div>
          </div>
        </div>
      </div>
    </PanelSkeleton>

    <PanelSkeleton>
      <div class="stack">
        <div v-for="i in 6" :key="i" class="queue-row">
          <SkeletonLine w="16px" :h="14" />
          <div class="track-row__text">
            <SkeletonLine w="26%" :h="20" />
            <SkeletonLine w="16%" :h="16" />
          </div>
        </div>
      </div>
    </PanelSkeleton>

    <PanelSkeleton><TrackListSkeleton :rows="6" albums /></PanelSkeleton>
    <PanelSkeleton><ShelfSkeleton :count="5" wide /></PanelSkeleton>
    <PanelSkeleton><ProjectListSkeleton :count="4" /></PanelSkeleton>
  </div>
</template>
