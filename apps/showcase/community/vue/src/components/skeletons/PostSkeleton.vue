<script setup lang="ts">
import PostCardSkeleton from './PostCardSkeleton.vue';
import RightRailSkeleton from './RightRailSkeleton.vue';
</script>
<template>
  <div class="columns">
    <div class="columns__main"><PostCardSkeleton media :lines="3" /></div>
    <RightRailSkeleton />
  </div>
</template>
