<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
defineProps<{ count: number }>();
</script>
<template>
  <div class="stack">
    <div v-for="i in count" :key="i" class="project-card">
      <SkeletonBar width="64px" height="64px" radius="8px" />
      <div class="track-row__text">
        <SkeletonLine w="30%" :h="20" />
        <SkeletonLine w="18%" :h="16" />
      </div>
    </div>
  </div>
</template>
