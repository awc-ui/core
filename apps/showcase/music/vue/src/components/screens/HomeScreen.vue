<!--
  Home — what the reader has been playing and what is new.

  THE SHELVES ARE SHELVES, not a feed. A music home page is a set of short,
  scannable rows the reader recognises, each answering a different question.
-->
<script setup lang="ts">
import { followedArtists, getTotals, ownPlaylists, recentAlbums, topTracks } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import TrackList from '~/components/bits/TrackList.vue';
import AlbumCard from '~/components/bits/AlbumCard.vue';
import PlaylistCard from '~/components/bits/PlaylistCard.vue';
import ArtistRow from '~/components/bits/ArtistRow.vue';
import HomeSkeleton from '~/components/skeletons/HomeSkeleton.vue';

const t = useT();
const totals = getTotals();
const tracks = topTracks(6);
const albums = recentAlbums(6);
const playlists = ownPlaylists().slice(0, 4);
const artists = followedArtists().slice(0, 4);
</script>

<template>
  <Screen :title="t('music.screen.home.title')" :subtitle="t('music.screen.home.subtitle')">
    <template #aside><Count :value="totals.tracks" /></template>
    <template #skeleton><HomeSkeleton /></template>

    <div class="stack">
      <Panel :title="t('music.panel.topTracks')">
        <template #actions><Count :value="tracks.length" /></template>
        <TrackList :tracks="tracks" show-album />
      </Panel>

      <Panel :title="t('music.panel.recent')">
        <template #actions><Count :value="albums.length" /></template>
        <div class="shelf"><AlbumCard v-for="a in albums" :key="a.id" :album="a" /></div>
      </Panel>

      <Panel :title="t('music.panel.yourPlaylists')">
        <template #actions><Count :value="playlists.length" /></template>
        <div class="shelf"><PlaylistCard v-for="p in playlists" :key="p.id" :playlist="p" /></div>
      </Panel>

      <Panel :title="t('music.panel.artists')">
        <template #actions><Count :value="artists.length" /></template>
        <div class="stack"><ArtistRow v-for="a in artists" :key="a.id" :artist="a" /></div>
      </Panel>
    </div>
  </Screen>
</template>
