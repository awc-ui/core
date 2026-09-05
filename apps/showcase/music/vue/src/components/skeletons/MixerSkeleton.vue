<script setup lang="ts">
import PanelSkeleton from './PanelSkeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonLine from './SkeletonLine.vue';
import SkeletonCircle from './SkeletonCircle.vue';
</script>
<template>
  <PanelSkeleton>
    <div class="mixer">
      <!-- Seven strips, each measured: the real strip is 435px and holds a
           name, a 24px kind glyph, a 160px fader, a meter, two readouts, a
           40px pan slider and two buttons. -->
      <div v-for="i in 7" :key="i" class="strip">
        <SkeletonLine w="70%" :h="16" />
        <SkeletonLine w="40%" :h="24" />
        <div class="strip__body"><SkeletonBar width="48px" height="160px" radius="8px" /></div>
        <SkeletonBar height="10px" radius="5px" />
        <SkeletonLine w="50%" :h="16" />
        <SkeletonBar height="40px" radius="20px" />
        <SkeletonLine w="50%" :h="16" />
        <div class="row"><SkeletonCircle :size="40" /><SkeletonCircle :size="40" /></div>
      </div>
    </div>
  </PanelSkeleton>
</template>
