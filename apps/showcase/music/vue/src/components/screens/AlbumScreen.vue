<script setup lang="ts">
import { computed } from 'vue';
import { albumBySlug, albumDuration, albumTracks, artistAlbums, artistById, clock } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Art from '~/components/bits/Art.vue';
import TrackList from '~/components/bits/TrackList.vue';
import AlbumCard from '~/components/bits/AlbumCard.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import ReleaseSkeleton from '~/components/skeletons/ReleaseSkeleton.vue';
import Drill from '~/components/Drill.vue';

const props = defineProps<{ slug: string }>();
const t = useT();
const player = usePlayer();

const album = computed(() => albumBySlug(props.slug));
const artist = computed(() => (album.value ? artistById(album.value.artistId) : null));
const tracks = computed(() => (album.value ? albumTracks(album.value) : []));
const others = computed(() =>
  artist.value ? artistAlbums(artist.value).filter((a) => a.id !== album.value?.id) : [],
);
</script>

<template>
  <NotFoundScreen v-if="!album" />
  <Screen v-else :title="album.title" :subtitle="t('music.screen.album.subtitle')" :crumb-label="album.title">
    <template #aside><Count :value="tracks.length" /></template>
    <template #skeleton><ReleaseSkeleton /></template>

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art :art="album.art" class-name="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{{ album.title }}</h2>
            <div class="row">
              <Drill v-if="artist" link-class="link" :to="route.artist(artist.handle)">{{ artist.name }}</Drill>
              <span class="person-row__meta">{{ album.year }}</span>
              <span class="person-row__meta">{{ t('music.count.tracks', { count: t.formatNumber(tracks.length) }) }}</span>
              <span class="person-row__meta">{{ clock(albumDuration(album)) }}</span>
            </div>
            <div class="row">
              <md-button
                class="release-head__play"
                variant="filled"
                icon="play_arrow"
                @click="tracks[0] && player.play(tracks[0])"
              >{{ t('music.action.playAll') }}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.tracks')">
        <template #actions><Count :value="tracks.length" /></template>
        <!-- Numbered by TRACK NUMBER here: on an album the running order is the
             number printed on the sleeve. -->
        <TrackList :tracks="tracks" numbered :show-artist="false" />
      </Panel>

      <Panel v-if="others.length" :title="t('music.panel.discography')">
        <template #actions><Count :value="others.length" /></template>
        <div class="shelf"><AlbumCard v-for="a in others" :key="a.id" :album="a" /></div>
      </Panel>
    </div>
  </Screen>
</template>
