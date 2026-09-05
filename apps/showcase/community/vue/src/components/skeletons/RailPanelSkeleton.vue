<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
withDefaults(defineProps<{ rows?: number; avatars?: boolean }>(), { rows: 3, avatars: false });
</script>
<template>
  <div class="skel-card">
    <SkeletonLine w="46%" :h="16" />
    <div class="stack" style="gap: 12px; margin-block-start: 8px">
      <div v-for="i in rows" :key="i" class="row" style="gap: 8px; align-items: center">
        <SkeletonCircle v-if="avatars" :size="28" />
        <SkeletonBar v-else width="20px" height="20px" radius="4px" />
        <SkeletonLine :w="`${58 + ((i * 13) % 26)}%`" :h="13" />
      </div>
    </div>
  </div>
</template>
