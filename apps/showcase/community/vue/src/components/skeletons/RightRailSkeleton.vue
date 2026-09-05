<!-- Only rendered where the real rail is. Below 1200px `app.css` hides
     `.columns__rail` outright, and this is inside the same class — so it
     disappears at exactly the width the thing it stands for does. -->
<script setup lang="ts">
import RailPanelSkeleton from './RailPanelSkeleton.vue';
</script>
<template>
  <aside class="columns__rail">
    <RailPanelSkeleton :rows="2" />
    <RailPanelSkeleton :rows="3" />
    <RailPanelSkeleton :rows="5" avatars />
  </aside>
</template>
