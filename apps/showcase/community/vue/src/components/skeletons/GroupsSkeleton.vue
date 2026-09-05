<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
</script>
<template>
  <div v-for="count in [6, 4]" :key="count" class="skel-card">
    <SkeletonLine w="24%" :h="16" />
    <div class="card-grid" style="margin-block-start: 12px">
      <div v-for="i in count" :key="i" class="stack" style="gap: 8px">
        <SkeletonBar width="100%" height="120px" radius="12px" />
        <SkeletonLine w="62%" :h="17" />
        <div class="row" style="gap: 8px">
          <SkeletonBar width="72px" height="28px" radius="9999px" />
          <SkeletonBar width="84px" height="28px" radius="9999px" />
        </div>
        <SkeletonLine w="100%" :h="12" />
        <SkeletonLine w="80%" :h="12" />
        <SkeletonBar width="100%" height="32px" radius="9999px" />
      </div>
    </div>
  </div>
</template>
