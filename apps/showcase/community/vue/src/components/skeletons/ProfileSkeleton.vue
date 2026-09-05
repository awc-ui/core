<!-- The overlap is drawn from the same `--profile-overlap` the real header
     uses, so the two cannot disagree about where the avatar sits. The ring is
     what makes it visible: a grey disc on a grey band is one shape. -->
<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
import PostCardSkeleton from './PostCardSkeleton.vue';
import RailPanelSkeleton from './RailPanelSkeleton.vue';
</script>
<template>
  <div class="columns">
    <div class="columns__main">
      <div class="skel-card" style="padding: 0">
        <SkeletonBar width="100%" height="205px" radius="12px 12px 0 0" />
        <div
          class="row"
          style="
            align-items: flex-start;
            gap: 16px;
            padding: 0 16px 16px;
            margin-block-start: calc(var(--profile-overlap, 36px) * -1);
          "
        >
          <span class="profile-head__avatar" style="position: relative; z-index: 1">
            <SkeletonCircle :size="62" />
          </span>
          <div
            class="stack"
            style="flex: 1; gap: 6px; padding-block-start: calc(var(--profile-overlap, 36px) + 8px)"
          >
            <SkeletonLine w="40%" :h="24" />
            <SkeletonLine w="26%" :h="14" />
          </div>
        </div>
        <div class="row" style="gap: 32px; padding: 0 16px 16px">
          <div v-for="i in 4" :key="i" class="stack" style="gap: 4px">
            <SkeletonLine w="48px" :h="20" />
            <SkeletonLine w="64px" :h="12" />
          </div>
        </div>
      </div>
      <PostCardSkeleton :lines="2" />
      <PostCardSkeleton media :lines="3" />
    </div>
    <aside class="columns__rail">
      <RailPanelSkeleton :rows="4" />
      <div class="skel-card">
        <SkeletonLine w="40%" :h="16" />
        <div class="photo-grid" style="margin-block-start: 8px; background: transparent">
          <SkeletonBar v-for="i in 6" :key="i" width="100%" height="86px" radius="0" />
        </div>
      </div>
    </aside>
  </div>
</template>
