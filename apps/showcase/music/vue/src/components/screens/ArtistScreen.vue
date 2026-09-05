<script setup lang="ts">
import { computed } from 'vue';
import { artistAlbums, artistByHandle, artistTopTracks } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { useSnackbar } from '~/components/screens/useSnackbar';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Art from '~/components/bits/Art.vue';
import TrackList from '~/components/bits/TrackList.vue';
import AlbumCard from '~/components/bits/AlbumCard.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import ReleaseSkeleton from '~/components/skeletons/ReleaseSkeleton.vue';

const props = defineProps<{ handle: string }>();
const t = useT();
const player = usePlayer();
const { say } = useSnackbar();

const artist = computed(() => artistByHandle(props.handle));
const albums = computed(() => (artist.value ? artistAlbums(artist.value) : []));
const top = computed(() => (artist.value ? artistTopTracks(artist.value) : []));
const followed = computed(() =>
  artist.value ? player.followedFor(artist.value.handle, artist.value.followed) : false,
);
</script>

<template>
  <NotFoundScreen v-if="!artist" />
  <Screen v-else :title="artist.name" :subtitle="t('music.screen.artist.subtitle')" :crumb-label="artist.name">
    <template #aside><Count :value="albums.length" /></template>
    <template #skeleton><ReleaseSkeleton /></template>

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art :art="artist.art" class-name="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{{ artist.name }}</h2>
            <p class="person-row__meta">{{
              t('music.label.listeners', {
                count: t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
              })
            }}</p>
            <p>{{ t(artist.bioKey) }}</p>
            <div class="row">
              <md-button
                class="artist__follow"
                :variant="followed ? 'outlined' : 'filled'"
                :icon="followed ? 'check' : 'person_add'"
                :data-followed="followed ? '' : undefined"
                @click="
                  player.toggleFollow(artist.handle, artist.followed);
                  say(followed ? 'music.msg.unfollowed' : 'music.msg.followed', { name: artist.name });
                "
              >{{ t(followed ? 'music.action.unfollow' : 'music.action.follow') }}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.topTracks')">
        <template #actions><Count :value="top.length" /></template>
        <TrackList :tracks="top" :show-artist="false" show-album />
      </Panel>

      <Panel :title="t('music.panel.discography')">
        <template #actions><Count :value="albums.length" /></template>
        <div class="shelf"><AlbumCard v-for="a in albums" :key="a.id" :album="a" /></div>
      </Panel>
    </div>
  </Screen>
</template>
