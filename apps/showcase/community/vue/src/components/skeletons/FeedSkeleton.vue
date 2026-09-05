<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonCircle from './SkeletonCircle.vue';
import PostCardSkeleton from './PostCardSkeleton.vue';
import RightRailSkeleton from './RightRailSkeleton.vue';
</script>
<template>
  <div class="columns">
    <div class="columns__main">
      <div class="skel-card">
        <!-- `flex="1"`, not `width="100%"`: a 100%-wide bar in a flex row is
             100% of the ROW and wraps under the avatar. -->
        <div class="row" style="gap: 12px; align-items: center; flex-wrap: nowrap">
          <SkeletonCircle :size="40" />
          <SkeletonBar flex="1" height="44px" radius="9999px" />
        </div>
      </div>
      <PostCardSkeleton :lines="3" />
      <PostCardSkeleton media :lines="2" />
      <PostCardSkeleton :lines="4" />
    </div>
    <RightRailSkeleton />
  </div>
</template>
