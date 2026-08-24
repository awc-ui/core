<!-- A titled surface. Everything on every screen lives in one of these. -->
<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
  variant?: 'elevated' | 'filled' | 'outlined';
}>();
</script>

<template>
  <md-card :variant="variant ?? 'outlined'" class="panel" full-width>
    <div class="panel__inner">
      <div v-if="title" class="panel__head">
        <div>
          <h2 class="panel__title">{{ title }}</h2>
          <p v-if="subtitle" class="panel__sub">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>
      <slot />
    </div>
  </md-card>
</template>
