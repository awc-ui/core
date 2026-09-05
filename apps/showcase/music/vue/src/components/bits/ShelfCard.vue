<script setup lang="ts">
import type { Artwork } from '@awc-ui/showcase-kit/music';
import Art from '~/components/bits/Art.vue';
import Drill from '~/components/Drill.vue';

defineProps<{ to: string; art: Artwork; title: string; meta?: string }>();
</script>

<template>
  <Drill link-class="shelf-card" :to="to">
    <Art :art="art" :class-name="`shelf-card__art${art.shape === 'wide' ? ' shelf-card__art--wide' : ''}`" />
    <span class="shelf-card__title">{{ title }}</span>
    <span v-if="meta" class="shelf-card__meta">{{ meta }}</span>
  </Drill>
</template>
