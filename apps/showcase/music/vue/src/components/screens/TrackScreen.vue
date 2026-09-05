<script setup lang="ts">
import { computed } from 'vue';
import { albumById, albumTracks, artistById, clock, trackById } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { useSnackbar } from '~/components/screens/useSnackbar';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Art from '~/components/bits/Art.vue';
import Peaks from '~/components/bits/Peaks.vue';
import TrackList from '~/components/bits/TrackList.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import ReleaseSkeleton from '~/components/skeletons/ReleaseSkeleton.vue';
import Drill from '~/components/Drill.vue';

const props = defineProps<{ trackId: string }>();
const t = useT();
const player = usePlayer();
const { say } = useSnackbar();

const track = computed(() => trackById(props.trackId));
const album = computed(() => (track.value ? albumById(track.value.albumId) : null));
const artist = computed(() => (track.value ? artistById(track.value.artistId) : null));
const siblings = computed(() =>
  album.value ? albumTracks(album.value).filter((x) => x.id !== track.value?.id) : [],
);
const liked = computed(() => (track.value ? player.likedFor(track.value) : false));
const current = computed(() => player.transport.value.trackId === props.trackId);
const playing = computed(() => current.value && player.transport.value.state === 'playing');
</script>

<template>
  <NotFoundScreen v-if="!track" />
  <Screen v-else :title="track.title" :subtitle="t('music.screen.track.subtitle')" :crumb-label="track.title">
    <template #aside><span class="tabular">{{ clock(track.durationSec) }}</span></template>
    <template #skeleton><ReleaseSkeleton /></template>

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art v-if="album" :art="album.art" class-name="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{{ track.title }}</h2>
            <div class="row">
              <Drill v-if="artist" link-class="link" :to="route.artist(artist.handle)">{{ artist.name }}</Drill>
              <span class="person-row__meta">·</span>
              <Drill v-if="album" link-class="link" :to="route.album(album.slug)">{{ album.title }}</Drill>
              <span class="person-row__meta">{{ album?.year }}</span>
            </div>
            <Peaks :peaks="track.peaks" />
            <div class="row">
              <md-button
                class="track__play"
                variant="filled"
                :icon="playing ? 'pause' : 'play_arrow'"
                @click="current ? player.toggle() : player.play(track)"
              >{{ t(playing ? 'music.action.pause' : 'music.action.play') }}</md-button>
              <md-button
                class="track__like"
                :variant="liked ? 'tonal' : 'outlined'"
                :icon="liked ? 'favorite' : 'favorite_border'"
                :data-liked="liked ? '' : undefined"
                @click="
                  player.toggleLike(track);
                  say(liked ? 'music.msg.unliked' : 'music.msg.liked', { name: track.title });
                "
              >{{ t(liked ? 'music.action.unlike' : 'music.action.like') }}</md-button>
              <md-button
                class="track__queue"
                variant="text"
                icon="queue_music"
                @click="
                  player.enqueue(track);
                  say('music.msg.queued', { name: track.title });
                "
              >{{ t('music.action.addToQueue') }}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.listening')">
        <div class="stat-row">
          <div>
            <dt>{{ t('music.label.duration') }}</dt>
            <dd class="tabular">{{ clock(track.durationSec) }}</dd>
          </div>
          <div>
            <dt>{{ t('music.label.playCount') }}</dt>
            <dd><Count :value="track.playCount" compact /></dd>
          </div>
          <div>
            <dt>{{ t('music.label.year') }}</dt>
            <dd>{{ album?.year ?? '' }}</dd>
          </div>
        </div>
      </Panel>

      <Panel v-if="siblings.length && album" :title="t('music.panel.appearsOn')" :subtitle="album.title">
        <template #actions><Count :value="siblings.length" /></template>
        <TrackList :tracks="siblings" numbered :show-artist="false" />
      </Panel>
    </div>
  </Screen>
</template>
