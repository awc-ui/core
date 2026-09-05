<script setup lang="ts">
import { computed } from 'vue';
import { artistById, type Album } from '@awc-ui/showcase-kit/music';
import { route } from '~/lib/routes';
import ShelfCard from '~/components/bits/ShelfCard.vue';

const props = defineProps<{ album: Album }>();
const meta = computed(() => artistById(props.album.artistId)?.name ?? '');
</script>

<template>
  <ShelfCard :to="route.album(album.slug)" :art="album.art" :title="album.title" :meta="meta" />
</template>
