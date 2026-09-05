<script setup lang="ts">
import { computed } from 'vue';
import type { Playlist } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import ShelfCard from '~/components/bits/ShelfCard.vue';

const props = defineProps<{ playlist: Playlist }>();
const t = useT();
const meta = computed(() =>
  t.value('music.count.tracks', { count: t.value.formatNumber(props.playlist.trackIds.length) }),
);
</script>

<template>
  <ShelfCard :to="route.library()" :art="playlist.art" :title="playlist.title" :meta="meta" />
</template>
