<!--
  Profile — the reader's own listening, playlists and projects.

  IT ALSO CARRIES THE QUEUE, the one place the whole of it is visible: the
  transport shows what is loaded, this shows what follows.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  artistById,
  getProjects,
  getTotals,
  getViewer,
  likedTracks,
  ownPlaylists,
  trackById,
  upNext,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Art from '~/components/bits/Art.vue';
import TrackList from '~/components/bits/TrackList.vue';
import PlaylistCard from '~/components/bits/PlaylistCard.vue';
import EmptyState from '~/components/screens/EmptyState.vue';
import ProfileSkeleton from '~/components/skeletons/ProfileSkeleton.vue';
import Drill from '~/components/Drill.vue';

const t = useT();
const player = usePlayer();
const viewer = getViewer();
const totals = getTotals();
const liked = likedTracks(6);
const playlists = ownPlaylists();
const projects = getProjects();

/* The whole remaining queue, not the transport's five-row preview. */
const queue = computed(() =>
  upNext(player.transport.value, 50)
    .map((id) => trackById(id))
    .filter((x): x is NonNullable<typeof x> => x !== null),
);
</script>

<template>
  <Screen :title="t('music.screen.profile.title')" :subtitle="t('music.screen.profile.subtitle')">
    <template #aside><Count :value="totals.likedTracks" /></template>
    <template #skeleton><ProfileSkeleton /></template>

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art :art="viewer.art" class-name="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{{ viewer.displayName }}</h2>
            <p class="person-row__meta">@{{ viewer.handle }}</p>
            <div class="stat-row">
              <div><dt>{{ t('music.panel.liked') }}</dt><dd><Count :value="totals.likedTracks" /></dd></div>
              <div><dt>{{ t('music.panel.yourPlaylists') }}</dt><dd><Count :value="playlists.length" /></dd></div>
              <div><dt>{{ t('music.panel.projects') }}</dt><dd><Count :value="totals.projects" /></dd></div>
              <div><dt>{{ t('music.label.minutes') }}</dt><dd><Count :value="totals.listeningMinutes" compact /></dd></div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.queue')">
        <template #actions><Count :value="queue.length" /></template>
        <EmptyState v-if="queue.length === 0" :message="t('music.empty.queue')" />
        <div v-else class="stack">
          <div v-for="(track, at) in queue" :key="track.id" class="queue-row">
            <span class="queue-row__index">{{ at + 1 }}</span>
            <span class="track-row__text">
              <Drill link-class="track-row__title link" :to="route.track(track.id)">{{ track.title }}</Drill>
              <span class="track-row__meta">{{ artistById(track.artistId)?.name }}</span>
            </span>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.liked')">
        <template #actions><Count :value="liked.length" /></template>
        <EmptyState v-if="liked.length === 0" :message="t('music.empty.liked')" />
        <TrackList v-else :tracks="liked" show-album />
      </Panel>

      <Panel :title="t('music.panel.yourPlaylists')">
        <template #actions><Count :value="playlists.length" /></template>
        <div class="shelf"><PlaylistCard v-for="p in playlists" :key="p.id" :playlist="p" /></div>
      </Panel>

      <Panel :title="t('music.panel.projects')">
        <template #actions><Count :value="projects.length" /></template>
        <div class="stack">
          <Drill v-for="p in projects" :key="p.id" link-class="project-card" :to="route.project(p.slug)">
            <Art :art="p.art" class-name="project-card__art" />
            <span class="project-card__text">
              <span class="track-row__title">{{ p.title }}</span>
              <span class="track-row__meta">{{ t(p.stateKey) }}</span>
            </span>
          </Drill>
        </div>
      </Panel>
    </div>
  </Screen>
</template>
