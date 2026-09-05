<script setup lang="ts">
import { computed } from 'vue';
import type { Artist } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { route, withBase } from '~/lib/routes';
import Art from '~/components/bits/Art.vue';
import Drill from '~/components/Drill.vue';

const props = defineProps<{ artist: Artist }>();
const t = useT();
const listeners = computed(() =>
  t.value('music.label.listeners', {
    count: t.value.formatNumber(props.artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
  }),
);
</script>

<template>
  <Drill link-class="artist-row" :to="route.artist(artist.handle)">
    <Art :art="artist.art" class-name="artist-row__art" />
    <span class="track-row__text">
      <span class="track-row__title">{{ artist.name }}</span>
      <span class="track-row__meta">{{ listeners }}</span>
    </span>
  </Drill>
</template>
