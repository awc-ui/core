<script setup lang="ts">
import PanelSkeleton from './PanelSkeleton.vue';
import TrackListSkeleton from './TrackListSkeleton.vue';
import ShelfSkeleton from './ShelfSkeleton.vue';
import ArtistRowSkeleton from './ArtistRowSkeleton.vue';
</script>
<template>
  <div class="stack">
    <PanelSkeleton><TrackListSkeleton :rows="6" albums /></PanelSkeleton>
    <PanelSkeleton><ShelfSkeleton /></PanelSkeleton>
    <PanelSkeleton><ShelfSkeleton :count="4" wide /></PanelSkeleton>
    <!-- The last home panel is a list of ARTISTS — rows with round portraits,
         not a shelf of square cards. `.stack` and not a bare div, because the
         real list's 12px gap is 24px over four rows. -->
    <PanelSkeleton>
      <div class="stack"><ArtistRowSkeleton v-for="i in 4" :key="i" /></div>
    </PanelSkeleton>
  </div>
</template>
