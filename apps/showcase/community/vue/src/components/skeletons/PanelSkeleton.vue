<!-- A panel's shape: a head, then one block the size the real content will be. -->
<script setup lang="ts">
withDefaults(defineProps<{ height?: string; lines?: number }>(), { lines: 0 });
</script>

<template>
  <div class="skel-card panel">
    <div class="panel__inner">
      <div class="panel__head">
        <div class="skel" style="block-size: 20px; inline-size: 140px"></div>
        <div class="skel" style="block-size: 20px; inline-size: 60px"></div>
      </div>
      <div v-if="height" class="skel" :style="{ blockSize: height, inlineSize: '100%' }"></div>
      <template v-if="lines > 0">
        <div
          v-for="i in lines"
          :key="i"
          class="skel"
          :style="{ blockSize: '16px', inlineSize: i === lines ? '60%' : '100%' }"
        ></div>
      </template>
    </div>
  </div>
</template>
