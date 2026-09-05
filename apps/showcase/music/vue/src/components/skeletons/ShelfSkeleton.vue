<!--
  The card is the real `.shelf-card`, so the art keeps its aspect ratio and the
  grid keeps its `auto-fill` columns. Only the art's height is stated — 165px
  square, measured — and the wide banner is half of it, because
  `.shelf-card__art--wide` is 2:1.
-->
<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
withDefaults(defineProps<{ count?: number; wide?: boolean }>(), { count: 6, wide: false });
</script>
<template>
  <div class="shelf">
    <div v-for="i in count" :key="i" class="shelf-card">
      <SkeletonBar :height="wide ? '83px' : '165px'" radius="12px" />
      <SkeletonLine w="72%" :h="20" />
      <SkeletonLine w="46%" :h="16" />
    </div>
  </div>
</template>
