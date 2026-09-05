<!--
  The mixer: a strip per track, and the rule that decides what you hear.

  THE ASYMMETRY IS THE WHOLE SCREEN. Soloing silences every track that is not
  soloed; an explicitly muted track stays silent regardless, including when it
  is itself soloed. `audibleTracks()` in the kit is the only place that rule is
  written, and `data-silent` is keyed on its answer rather than on the mute flag
  — which is why soloing one strip visibly drops the others back.

  SIXTY CONTROLS ON ONE SCREEN is a different accessibility problem from six:
  every control takes its track's name into its accessible name.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  currentProject,
  muteIcon,
  muteLabelKey,
  projectTracks,
  soloLabelKey,
  trackIcon,
  trackLabelKey,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { useSnackbar } from '~/components/screens/useSnackbar';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Readouts from '~/components/bits/Readouts.vue';
import EmptyState from '~/components/screens/EmptyState.vue';
import MixerSkeleton from '~/components/skeletons/MixerSkeleton.vue';

const t = useT();
const player = usePlayer();
const { say } = useSnackbar();
const project = currentProject();

const tracks = computed(() =>
  project
    ? projectTracks(project).map((track) => player.tracks.value.find((x) => x.id === track.id) ?? track)
    : [],
);

/* See the note in the React build: `md-slider`'s detail is an OBJECT. */
const sliderValue = (event: Event): number => {
  const raw = (event as CustomEvent<{ value: number }>).detail?.value;
  return Number.isFinite(raw) ? Number(raw) : 0;
};
</script>

<template>
  <Screen :title="t('music.screen.mixer.title')" :subtitle="t('music.screen.mixer.subtitle')">
    <template #aside><Count :value="tracks.length" /></template>
    <template #skeleton><MixerSkeleton /></template>

    <EmptyState v-if="!project" :message="t('music.empty.clips')" />
    <Panel v-else :title="project.title" :subtitle="t('music.hint.soloRule')">
      <template #actions><Count :value="tracks.length" /></template>

      <div class="mixer" role="group" :aria-label="t('music.screen.mixer.title')">
        <div
          v-for="track in tracks"
          :key="track.id"
          class="strip"
          :data-track="track.id"
          :data-silent="player.audible.value.has(track.id) ? undefined : ''"
        >
          <span class="strip__name">{{ track.name }}</span>
          <span class="strip__kind">
            <span class="material-symbols-outlined" aria-hidden="true">{{ trackIcon[track.kind] }}</span>
            <span class="visually-hidden">{{ t(trackLabelKey[track.kind]) }}</span>
          </span>

          <div class="strip__body">
            <!-- A REAL vertical slider, via the component's own prop. Rotating
                 a horizontal one leaves its hit area and arrow keys
                 horizontal — a control that looks vertical and behaves
                 otherwise. -->
            <md-slider
              class="strip__fader"
              orientation="vertical"
              full-height
              :min="0"
              :max="100"
              :step="1"
              :value="Math.round(track.volume * 100)"
              :aria-label="`${t('music.label.level')}: ${track.name}`"
              @mdInput="player.setTrackVolume(track.id, sliderValue($event) / 100)"
            />
          </div>

          <!-- Horizontal, because `md-meter` has no vertical orientation: it is
               linear or circular, and a linear one squeezed into a ten-pixel
               column reads as a smudge. Static, since nothing plays. -->
          <md-meter
            class="strip__meter"
            :value="Math.round(track.level * 100)"
            :min="0"
            :max="100"
            :color="track.level > 0.85 ? 'error' : 'primary'"
            :label="`${t('music.label.level')}: ${track.name}`"
          />

          <Readouts :volume="track.volume" />

          <md-slider
            class="strip__pan"
            :min="-100"
            :max="100"
            :step="5"
            :value="Math.round(track.pan * 100)"
            :aria-label="`${t('music.label.pan')}: ${track.name}`"
            @mdInput="player.setTrackPan(track.id, sliderValue($event) / 100)"
          />
          <Readouts :pan="track.pan" />

          <div class="strip__buttons">
            <md-icon-button
              class="strip__mute"
              :icon="muteIcon(player.audible.value.has(track.id))"
              size="sm"
              :color="track.muted ? 'error' : undefined"
              :data-on="track.muted ? '' : undefined"
              :aria-pressed="String(track.muted)"
              :aria-label="`${t(muteLabelKey(track.muted))}: ${track.name}`"
              @click="
                player.toggleTrackMute(track.id);
                say(track.muted ? 'music.msg.unmuted' : 'music.msg.muted', { name: track.name });
              "
            />
            <md-icon-button
              class="strip__solo"
              icon="headphones"
              size="sm"
              :color="track.soloed ? 'primary' : undefined"
              :data-on="track.soloed ? '' : undefined"
              :aria-pressed="String(track.soloed)"
              :aria-label="`${t(soloLabelKey(track.soloed))}: ${track.name}`"
              @click="
                player.toggleTrackSolo(track.id);
                say(track.soloed ? 'music.msg.unsoloed' : 'music.msg.soloed', { name: track.name });
              "
            />
          </div>

          <span class="visually-hidden">{{
            t(player.audible.value.has(track.id) ? 'music.label.audible' : 'music.label.inaudible')
          }} — {{ t(trackLabelKey[track.kind]) }}</span>
        </div>
      </div>
    </Panel>
  </Screen>
</template>
