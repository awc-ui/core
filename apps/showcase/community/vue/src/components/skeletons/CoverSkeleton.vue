<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import PostCardSkeleton from './PostCardSkeleton.vue';
import RailPanelSkeleton from './RailPanelSkeleton.vue';
withDefaults(defineProps<{ timeline?: boolean }>(), { timeline: false });
</script>
<template>
  <div class="columns">
    <div class="columns__main">
      <div class="skel-card">
        <SkeletonBar width="100%" height="240px" radius="16px" />
        <SkeletonLine w="52%" :h="26" />
        <div class="row" style="gap: 8px">
          <SkeletonBar width="86px" height="30px" radius="9999px" />
          <SkeletonBar width="104px" height="30px" radius="9999px" />
          <SkeletonBar width="128px" height="36px" radius="9999px" />
        </div>
        <SkeletonLine w="100%" :h="13" />
        <SkeletonLine w="88%" :h="13" />
      </div>
      <template v-if="timeline">
        <PostCardSkeleton :lines="2" />
        <PostCardSkeleton media :lines="3" />
      </template>
    </div>
    <aside class="columns__rail">
      <RailPanelSkeleton :rows="1" avatars />
      <RailPanelSkeleton :rows="4" avatars />
    </aside>
  </div>
</template>
