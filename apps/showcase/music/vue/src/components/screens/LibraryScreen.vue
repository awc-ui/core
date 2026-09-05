<!--
  Library — four sections ordered by how often they are opened, not
  alphabetically: liked tracks first, because that is the list people live in.
-->
<script setup lang="ts">
import { followedPlaylists, getAlbums, getTotals, likedTracks, ownPlaylists } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import TrackList from '~/components/bits/TrackList.vue';
import AlbumCard from '~/components/bits/AlbumCard.vue';
import PlaylistCard from '~/components/bits/PlaylistCard.vue';
import EmptyState from '~/components/screens/EmptyState.vue';
import LibrarySkeleton from '~/components/skeletons/LibrarySkeleton.vue';

const t = useT();
const totals = getTotals();
const liked = likedTracks();
const own = ownPlaylists();
const followed = followedPlaylists();
const albums = getAlbums();
</script>

<template>
  <Screen :title="t('music.screen.library.title')" :subtitle="t('music.screen.library.subtitle')">
    <template #aside><Count :value="totals.tracks" /></template>
    <template #skeleton><LibrarySkeleton /></template>

    <div class="stack">
      <Panel :title="t('music.panel.liked')">
        <template #actions><Count :value="liked.length" /></template>
        <EmptyState v-if="liked.length === 0" :message="t('music.empty.liked')" />
        <TrackList v-else :tracks="liked" show-album />
      </Panel>

      <Panel :title="t('music.panel.yourPlaylists')">
        <template #actions><Count :value="own.length" /></template>
        <div class="shelf"><PlaylistCard v-for="p in own" :key="p.id" :playlist="p" /></div>
      </Panel>

      <Panel :title="t('music.panel.followedPlaylists')">
        <template #actions><Count :value="followed.length" /></template>
        <div class="shelf"><PlaylistCard v-for="p in followed" :key="p.id" :playlist="p" /></div>
      </Panel>

      <Panel :title="t('music.panel.albums')">
        <template #actions><Count :value="albums.length" /></template>
        <div class="shelf"><AlbumCard v-for="a in albums" :key="a.id" :album="a" /></div>
      </Panel>
    </div>
  </Screen>
</template>
