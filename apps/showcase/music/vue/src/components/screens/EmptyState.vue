<script setup lang="ts">
defineProps<{ message: string; hint?: string }>();
</script>
<template>
  <div class="empty">
    <span class="material-symbols-outlined empty__icon" aria-hidden="true">music_off</span>
    <p class="empty__message">{{ message }}</p>
    <p v-if="hint" class="empty__hint">{{ hint }}</p>
  </div>
</template>
