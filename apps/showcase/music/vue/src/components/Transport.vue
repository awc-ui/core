<!--
  The transport bar. The one piece of chrome that makes this a music app.

  IT LIVES IN `AppFrame`, NOT IN A SCREEN, which is the architectural claim of
  this vertical. `App` swaps the screen on every navigation; this bar is
  rendered outside it, so it is the SAME element before and after — the track
  keeps playing, the playhead stays where it was, the queue is untouched.

  NOTHING PLAYS. Pressing Play flips a state and relabels a button; the playhead
  advances on an interval that runs only while playing, and there is no audio.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  albumById,
  artistById,
  clock,
  repeatIcon,
  repeatLabelKey,
  repeatTone,
  trackById,
  transportIcon,
  transportLabelKey,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import Art from '~/components/bits/Art.vue';

const t = useT();
const player = usePlayer();

const transport = computed(() => player.transport.value);
const track = computed(() => (transport.value.trackId ? trackById(transport.value.trackId) : null));
const album = computed(() => (track.value ? albumById(track.value.albumId) : null));
const artist = computed(() => (track.value ? artistById(track.value.artistId) : null));
const duration = computed(() => track.value?.durationSec ?? 0);
const playing = computed(() => transport.value.state === 'playing');

/*
 * `md-slider`'s `mdInput` detail is `{ value }`, AN OBJECT — while
 * `md-text-field`'s detail IS the bare string. Assuming one shape for both
 * yields `Number({value: 42})` → NaN, which then fails silently because the
 * clamps in `derive.ts` turn NaN back into the value already there.
 */
const sliderValue = (event: Event): number => {
  const raw = (event as CustomEvent<{ value: number }>).detail?.value;
  return Number.isFinite(raw) ? Number(raw) : 0;
};
</script>

<template>
  <div class="transport" role="region" :aria-label="t('music.label.nowPlaying')">
    <div class="transport__now">
      <Art v-if="album" :art="album.art" class-name="transport__art" />
      <div class="transport__text">
        <div class="transport__title">{{ track ? track.title : t('music.label.nothingLoaded') }}</div>
        <div class="transport__artist">{{ artist?.name ?? '' }}</div>
      </div>
    </div>

    <div class="transport__controls">
      <div class="transport__buttons">
        <md-icon-button
          class="transport__button transport__shuffle"
          icon="shuffle"
          size="sm"
          :color="transport.shuffle ? 'primary' : undefined"
          :data-on="transport.shuffle ? '' : undefined"
          :aria-pressed="String(transport.shuffle)"
          :aria-label="t('music.action.shuffle')"
          @click="player.toggleShuffle()"
        />
        <md-icon-button
          class="transport__button transport__previous"
          icon="skip_previous"
          :aria-label="t('music.action.previous')"
          @click="player.previous()"
        />
        <!-- THE GLYPH IS THE ACTION, NOT THE STATE: a transport that is playing
             shows PAUSE, because pressing it pauses. The icon and the label come
             from the same two maps in the kit so they cannot disagree. -->
        <md-icon-button
          class="transport__button transport__play"
          :icon="transportIcon[transport.state]"
          variant="filled"
          :aria-label="t(transportLabelKey[transport.state])"
          :data-playing="playing ? '' : undefined"
          @click="player.toggle()"
        />
        <md-icon-button
          class="transport__button transport__next"
          icon="skip_next"
          :aria-label="t('music.action.next')"
          @click="player.next()"
        />
        <md-icon-button
          class="transport__button transport__repeat"
          :icon="repeatIcon[transport.repeat]"
          size="sm"
          :color="repeatTone[transport.repeat] ?? undefined"
          :data-repeat="transport.repeat"
          :aria-label="t(repeatLabelKey[transport.repeat])"
          @click="player.cycleRepeat()"
        />
      </div>

      <div class="transport__scrub">
        <span class="transport__time transport__elapsed">{{ clock(transport.positionSec) }}</span>
        <md-slider
          class="transport__slider"
          :min="0"
          :max="Math.max(1, duration)"
          :step="1"
          :value="transport.positionSec"
          :aria-label="t('music.action.seek')"
          @mdInput="player.seek(sliderValue($event), duration)"
        />
        <span class="transport__time transport__duration">{{ clock(duration) }}</span>
      </div>
    </div>

    <div class="transport__side">
      <md-icon-button
        class="transport__mute"
        :icon="transport.muted || transport.volume === 0 ? 'volume_off' : 'volume_up'"
        size="sm"
        :aria-pressed="String(transport.muted)"
        :aria-label="t(transport.muted ? 'music.action.unmute' : 'music.action.mute')"
        @click="player.toggleMute()"
      />
      <!-- The fader shows where it IS, not what you can hear: muting must not
           slide it to zero, or un-muting cannot put it back. -->
      <md-slider
        class="transport__volume"
        :min="0"
        :max="100"
        :step="1"
        :value="Math.round(transport.volume * 100)"
        :aria-label="t('music.action.volume')"
        @mdInput="player.setVolume(sliderValue($event) / 100)"
      />
    </div>
  </div>
</template>
