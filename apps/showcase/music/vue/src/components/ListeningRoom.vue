<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  clock,
  trackById,
  artistById,
  type SessionMode,
  type Track,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import Art from '~/components/bits/Art.vue';
const t = useT();
const player = usePlayer();
const mode = ref<SessionMode>('for-you');
const copy = computed(() => sessionCopy(t.value.locale));
const session = computed(() => listeningSession(mode.value));
const at = computed(() => SESSION_MODES.indexOf(mode.value));
const queue = computed(() =>
  player.transport.value.queue.map(trackById).filter((track): track is Track => track !== null),
);
const loaded = computed(
  () =>
    session.value.tracks.some((track) => track.id === player.transport.value.trackId) &&
    player.transport.value.queue.every((id) =>
      session.value.tracks.some((track) => track.id === id),
    ),
);
const playing = computed(() => loaded.value && player.transport.value.state === 'playing');
</script>
<template>
  <section class="listening-room" :aria-label="copy.choose">
    <md-card class="listening-room__card" variant="filled" full-width
      ><div class="listening-room__feature">
        <div class="listening-room__copy">
          <span class="listening-room__eyebrow">{{ copy.eyebrow }}</span>
          <h2>{{ copy.title }}</h2>
          <p>{{ copy.description }}</p>
          <md-button-group
            class="listening-room__modes"
            variant="standard"
            selection-mode="single-select"
            required
            :aria-label="copy.choose"
          >
            <md-button
              v-for="(value, index) in SESSION_MODES"
              :key="value"
              variant="tonal"
              toggle
              :value="value"
              :selected="mode === value || undefined"
              :aria-pressed="mode === value"
              @click="mode = value"
              >{{ copy.modes[index] }}</md-button
            >
          </md-button-group>
          <div class="listening-room__session" aria-live="polite">
            <h3>{{ copy.names[at] }}</h3>
            <p>{{ copy.notes[at] }}</p>
            <div class="listening-room__facts">
              <span>{{ t.formatNumber(session.tracks.length) }} {{ copy.tracks }}</span
              ><span>{{ clock(session.duration) }} {{ copy.duration }}</span>
            </div>
          </div>
          <md-button
            class="listening-room__play"
            variant="filled"
            :icon="playing ? 'pause' : 'play_arrow'"
            @click="loaded ? player.toggle() : player.playSession(session.tracks)"
            >{{ playing ? copy.pause : loaded ? copy.resume : copy.play }}</md-button
          >
          <small class="listening-room__demo">{{ copy.demo }}</small>
        </div>
        <div class="listening-room__artwork" aria-hidden="true">
          <div
            v-for="(album, index) in session.albums"
            :key="album.id"
            :class="`listening-room__cover listening-room__cover--${index}`"
          >
            <Art :art="album.art" eager />
          </div>
          <div class="listening-room__record" />
        </div>
      </div> </md-card
    ><md-card
      variant="outlined"
      role="complementary"
      class="listening-queue"
      :aria-label="copy.queue"
      ><div class="listening-queue__heading">
        <h3>{{ copy.queue }}</h3>
        <span>{{ t.formatNumber(queue.length) }} {{ copy.tracks }}</span>
      </div>
      <div class="listening-queue__list">
        <div
          v-for="track in queue"
          :key="track.id"
          class="listening-queue__row"
          :data-current="track.id === player.transport.value.trackId || undefined"
        >
          <md-icon-button
            :icon="
              track.id === player.transport.value.trackId &&
              player.transport.value.state === 'playing'
                ? 'pause'
                : 'play_arrow'
            "
            size="sm"
            :aria-label="`${t(track.id === player.transport.value.trackId && player.transport.value.state === 'playing' ? 'music.action.pause' : 'music.action.play')}: ${track.title}`"
            @click="
              track.id === player.transport.value.trackId ? player.toggle() : player.play(track)
            "
          />
          <div class="listening-queue__track">
            <strong>{{ track.title }}</strong
            ><span>{{ artistById(track.artistId)?.name }} · {{ clock(track.durationSec) }}</span>
          </div>
          <md-icon-button
            icon="close"
            size="sm"
            :disabled="track.id === player.transport.value.trackId || undefined"
            :aria-label="`${copy.remove}: ${track.title}`"
            @click="player.removeFromQueue(track.id)"
          />
        </div>
      </div>
    </md-card>
  </section>
</template>
