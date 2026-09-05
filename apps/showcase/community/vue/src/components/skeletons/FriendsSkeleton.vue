<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
</script>
<template>
  <div v-for="count in [4, 2, 6]" :key="count" class="skel-card">
    <SkeletonLine w="28%" :h="16" />
    <div class="person-grid" style="margin-block-start: 12px">
      <div v-for="i in count" :key="i" class="row" style="align-items: flex-start; gap: 12px">
        <SkeletonCircle :size="40" />
        <div class="stack" style="flex: 1; gap: 6px">
          <SkeletonLine w="72%" :h="15" />
          <SkeletonLine w="52%" :h="12" />
          <SkeletonBar height="32px" radius="9999px" />
        </div>
      </div>
    </div>
  </div>
</template>
