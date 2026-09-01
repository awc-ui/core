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
        <!--
          Title and subtitle are ONE heading and share a row, so the pair
          needs a box of its own to sit in — an unclassed `div` here is a
          block container, which stacks them and reads as two headings.
          `.panel__heading` in `app.css` lays the two out side by side and
          drops the subtitle beneath the title only when the card is too
          narrow to hold both.
        -->
        <div class="panel__heading">
          <h2 class="panel__title">{{ title }}</h2>
          <p v-if="subtitle" class="panel__sub">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>
      <slot />
    </div>
  </md-card>
</template>
