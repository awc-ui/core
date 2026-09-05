<!--
  One row in a track list.

  IT MARKS ITSELF WHEN IT IS THE LOADED TRACK, on every screen that lists it, so
  a reader never has to look at the bar to find where they are. That is the
  visible payoff of holding the transport outside the component tree.

  THE WHOLE ROW IS NOT A LINK: it carries a link and two buttons, and a control
  inside an anchor fires both on a keyboard press. The title is the link.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { albumById, artistById, type Track } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { route, withBase } from '~/lib/routes';
import Clock from '~/components/bits/Clock.vue';
import Drill from '~/components/Drill.vue';

const props = withDefaults(
  defineProps<{ track: Track; index?: number; showArtist?: boolean; showAlbum?: boolean }>(),
  { showArtist: true, showAlbum: false },
);
const t = useT();
const player = usePlayer();

const current = computed(() => player.transport.value.trackId === props.track.id);
const liked = computed(() => player.likedFor(props.track));
const artist = computed(() => artistById(props.track.artistId));
const album = computed(() => albumById(props.track.albumId));
</script>

<template>
  <div class="track-row" :data-track="track.id" :data-current="current ? '' : undefined">
    <span class="track-row__index">{{ index ?? track.trackNumber }}</span>
    <span class="track-row__text">
      <Drill link-class="track-row__title link" :to="route.track(track.id)">{{ track.title }}</Drill>
      <span v-if="showArtist" class="track-row__meta">
        <Drill v-if="artist" link-class="link" :to="route.artist(artist.handle)">{{ artist.name }}</Drill>
      </span>
    </span>
    <span v-if="showAlbum" class="track-row__album">
      <Drill v-if="album" link-class="link" :to="route.album(album.slug)">{{ album.title }}</Drill>
    </span>
    <span class="track-row__time"><Clock :seconds="track.durationSec" /></span>
    <span class="row">
      <!-- `toggle` + `selected`, and the FILL comes from the font axis in
           `app.css` — swapping the ligature name alone leaves the heart an
           outline, because the Outlined face draws both names the same. -->
      <md-icon-button
        class="track-row__like"
        toggle
        :selected="liked || undefined"
        :icon="liked ? 'favorite' : 'favorite_border'"
        size="sm"
        :data-liked="liked ? '' : undefined"
        :aria-label="`${t(liked ? 'music.action.unlike' : 'music.action.like')}: ${track.title}`"
        @click="player.toggleLike(track)"
      />
      <md-icon-button
        class="track-row__play"
        :icon="current && player.transport.value.state === 'playing' ? 'pause' : 'play_arrow'"
        size="sm"
        :aria-label="`${t('music.action.play')}: ${track.title}`"
        @click="current ? player.toggle() : player.play(track)"
      />
    </span>
  </div>
</template>
