<!-- The 56px square is the date block, which is the one element on that screen
     a reader navigates by — so it is the one the placeholder most needs to
     promise. -->
<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
</script>
<template>
  <div v-for="count in [2, 3, 3]" :key="count" class="skel-card">
    <SkeletonLine w="22%" :h="16" />
    <div class="event-list" style="margin-block-start: 12px">
      <div v-for="i in count" :key="i" class="event-row">
        <SkeletonBar width="56px" height="58px" radius="12px" />
        <div class="stack" style="gap: 6px">
          <SkeletonLine w="46%" :h="15" />
          <SkeletonLine w="34%" :h="12" />
          <SkeletonLine w="40%" :h="12" />
          <SkeletonBar width="104px" height="30px" radius="9999px" />
        </div>
        <div class="row" style="gap: 4px">
          <SkeletonCircle v-for="n in 3" :key="n" :size="32" />
        </div>
      </div>
    </div>
  </div>
</template>
