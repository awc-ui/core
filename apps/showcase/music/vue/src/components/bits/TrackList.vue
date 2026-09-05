<!--
  The COLUMN COUNT lives on the list, not the row: rows in one list must all use
  the same grid template or the durations form a ragged edge, which is the whole
  reason a row is a grid rather than a flex line.
-->
<script setup lang="ts">
import type { Track } from '@awc-ui/showcase-kit/music';
import TrackRow from '~/components/bits/TrackRow.vue';

withDefaults(
  defineProps<{
    tracks: readonly Track[];
    numbered?: boolean;
    showArtist?: boolean;
    showAlbum?: boolean;
  }>(),
  { numbered: false, showArtist: true, showAlbum: false },
);
</script>

<template>
  <div class="track-list" :data-albums="showAlbum ? '' : undefined">
    <TrackRow
      v-for="(track, at) in tracks"
      :key="track.id"
      :track="track"
      :index="numbered ? track.trackNumber : at + 1"
      :show-artist="showArtist"
      :show-album="showAlbum"
    />
  </div>
</template>
