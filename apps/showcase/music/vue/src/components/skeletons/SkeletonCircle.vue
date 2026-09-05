<script setup lang="ts">
import SkeletonBar from './SkeletonBar.vue';
withDefaults(defineProps<{ size?: number }>(), { size: 40 });
</script>
<template><SkeletonBar :width="`${size}px`" :height="`${size}px`" radius="50%" /></template>
