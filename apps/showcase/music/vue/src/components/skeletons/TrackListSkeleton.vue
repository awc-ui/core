<script setup lang="ts">
import TrackRowSkeleton from './TrackRowSkeleton.vue';
withDefaults(defineProps<{ rows: number; albums?: boolean }>(), { albums: false });
</script>
<template>
  <div class="track-list" :data-albums="albums ? '' : undefined">
    <TrackRowSkeleton v-for="i in rows" :key="i" :albums="albums" />
  </div>
</template>
