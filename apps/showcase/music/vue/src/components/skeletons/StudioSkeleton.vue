<script setup lang="ts">
import PanelSkeleton from './PanelSkeleton.vue';
import ProjectListSkeleton from './ProjectListSkeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
</script>
<template>
  <div class="stack">
    <!-- The project header carries no panel title. -->
    <PanelSkeleton :head="false">
      <div class="studio-head">
        <div class="studio-head__facts">
          <SkeletonBar width="64px" height="64px" radius="8px" />
          <div class="track-row__text">
            <SkeletonLine w="180px" :h="28" />
            <SkeletonLine w="240px" :h="20" />
          </div>
        </div>
        <div class="row">
          <SkeletonBar width="84px" height="32px" radius="16px" />
          <SkeletonBar width="84px" height="32px" radius="16px" />
        </div>
      </div>
    </PanelSkeleton>

    <!-- The arrangement, in the REAL lane grid: a ruler with seven lanes says
         a timeline is coming and how many tracks are on it, which a grey box
         does not. The lanes borrow `.lane-name`'s own 56px. -->
    <PanelSkeleton>
      <div class="lanes">
        <div class="lane-names">
          <div class="lane-names__pad" />
          <div v-for="i in 7" :key="i" class="lane-name"><SkeletonLine w="70%" :h="16" /></div>
        </div>
        <div>
          <SkeletonBar height="28px" radius="0" />
          <SkeletonBar v-for="i in 7" :key="i" height="56px" radius="0" />
        </div>
      </div>
    </PanelSkeleton>

    <!-- The history opens empty, so this is the empty state's height. -->
    <PanelSkeleton><SkeletonBar height="96px" radius="8px" /></PanelSkeleton>

    <PanelSkeleton><ProjectListSkeleton :count="4" /></PanelSkeleton>
  </div>
</template>
