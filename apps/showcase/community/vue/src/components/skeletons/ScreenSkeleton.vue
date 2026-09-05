<!--
  The fallback, for a screen that does not name its own.

  It is the FEED's shape rather than a neutral block, because the feed is the
  screen a reader arrives on and the one any unnamed screen is most likely to
  resemble. A neutral block is the generic placeholder these compositions exist
  to replace.
-->
<script setup lang="ts">
import FeedSkeleton from './FeedSkeleton.vue';
defineProps<{ label?: string }>();
</script>
<template>
  <div :aria-label="label" aria-busy="true"><FeedSkeleton /></div>
</template>
