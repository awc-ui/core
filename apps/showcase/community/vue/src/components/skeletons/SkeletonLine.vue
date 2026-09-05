<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
withDefaults(defineProps<{ w?: string; h?: number }>(), { w: '100%', h: 14 });
</script>
<template><SkeletonBar :width="w" :height="`${h}px`" radius="4px" /></template>
