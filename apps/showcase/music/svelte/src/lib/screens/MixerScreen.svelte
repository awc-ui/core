<!--
  The mixer: a strip per track, and the rule that decides what you hear.

  THE ASYMMETRY IS THE WHOLE SCREEN. Soloing silences every track that is not
  soloed; an explicitly muted track stays silent regardless. `audibleTracks()`
  in the kit is the only place that rule is written, and `data-silent` is keyed
  on its answer rather than on the mute flag — which is why soloing one strip
  visibly drops the others back.

  SIXTY CONTROLS ON ONE SCREEN: every control takes its track's name into its
  accessible name, because "Mute, button" twelve times is useless.
-->
<script lang="ts">
  import {
    currentProject,
    muteIcon,
    muteLabelKey,
    projectTracks,
    soloLabelKey,
    trackIcon,
    trackLabelKey,
  } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { player, audible, setTrackVolume, setTrackPan, toggleTrackMute, toggleTrackSolo } from '$lib/player';
  import { say } from '$lib/snackbar';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import VolumeReadout from '$lib/bits/VolumeReadout.svelte';
  import PanReadout from '$lib/bits/PanReadout.svelte';
  import MixerSkeleton from '$lib/skeletons/MixerSkeleton.svelte';

  const project = currentProject();
  $: tracks = project
    ? projectTracks(project).map((track) => $player.tracks.find((x) => x.id === track.id) ?? track)
    : [];

  /* `md-slider`'s detail is an OBJECT — see the note in Transport.svelte. */
  const sliderValue = (event: Event): number => {
    const raw = (event as CustomEvent<{ value: number }>).detail?.value;
    return Number.isFinite(raw) ? Number(raw) : 0;
  };
</script>

<Screen title={$t('music.screen.mixer.title')} subtitle={$t('music.screen.mixer.subtitle')}>
  <Count slot="aside" value={tracks.length} />
  <MixerSkeleton slot="skeleton" />

  {#if !project}
    <EmptyState message={$t('music.empty.clips')} />
  {:else}
    <Panel title={project.title} subtitle={$t('music.hint.soloRule')}>
      <Count slot="actions" value={tracks.length} />

      <div class="mixer" role="group" aria-label={$t('music.screen.mixer.title')}>
        {#each tracks as track (track.id)}
          <div class="strip" data-track={track.id} data-silent={$audible.has(track.id) ? undefined : ''}>
            <span class="strip__name">{track.name}</span>
            <span class="strip__kind">
              <span class="material-symbols-outlined" aria-hidden="true">{trackIcon[track.kind]}</span>
              <span class="visually-hidden">{$t(trackLabelKey[track.kind])}</span>
            </span>

            <div class="strip__body">
              <!-- A REAL vertical slider, via the component's own prop.
                   Rotating a horizontal one leaves its hit area and arrow keys
                   horizontal — a control that looks vertical and behaves
                   otherwise. -->
              <md-slider
                class="strip__fader"
                orientation="vertical"
                full-height
                min={0}
                max={100}
                step={1}
                value={Math.round(track.volume * 100)}
                aria-label={`${$t('music.label.level')}: ${track.name}`}
                on:mdInput={(event) => setTrackVolume(track.id, sliderValue(event) / 100)}
              ></md-slider>
            </div>

            <!-- Horizontal, because `md-meter` has no vertical orientation: a
                 linear one squeezed into a ten-pixel column reads as a smudge.
                 Static, since nothing plays. -->
            <md-meter
              class="strip__meter"
              value={Math.round(track.level * 100)}
              min={0}
              max={100}
              color={track.level > 0.85 ? 'error' : 'primary'}
              label={`${$t('music.label.level')}: ${track.name}`}
            ></md-meter>

            <VolumeReadout volume={track.volume} />

            <md-slider
              class="strip__pan"
              min={-100}
              max={100}
              step={5}
              value={Math.round(track.pan * 100)}
              aria-label={`${$t('music.label.pan')}: ${track.name}`}
              on:mdInput={(event) => setTrackPan(track.id, sliderValue(event) / 100)}
            ></md-slider>
            <PanReadout pan={track.pan} />

            <div class="strip__buttons">
              <md-icon-button
                class="strip__mute"
                icon={muteIcon($audible.has(track.id))}
                size="sm"
                color={track.muted ? 'error' : undefined}
                data-on={track.muted ? '' : undefined}
                aria-pressed={String(track.muted)}
                aria-label={`${$t(muteLabelKey(track.muted))}: ${track.name}`}
                on:click={() => {
                  const wasMuted = track.muted;
                  toggleTrackMute(track.id);
                  say(wasMuted ? 'music.msg.unmuted' : 'music.msg.muted', { name: track.name });
                }}
              ></md-icon-button>
              <md-icon-button
                class="strip__solo"
                icon="headphones"
                size="sm"
                color={track.soloed ? 'primary' : undefined}
                data-on={track.soloed ? '' : undefined}
                aria-pressed={String(track.soloed)}
                aria-label={`${$t(soloLabelKey(track.soloed))}: ${track.name}`}
                on:click={() => {
                  const wasSoloed = track.soloed;
                  toggleTrackSolo(track.id);
                  say(wasSoloed ? 'music.msg.unsoloed' : 'music.msg.soloed', { name: track.name });
                }}
              ></md-icon-button>
            </div>

            <span class="visually-hidden">{$t($audible.has(track.id) ? 'music.label.audible' : 'music.label.inaudible')} — {$t(trackLabelKey[track.kind])}</span>
          </div>
        {/each}
      </div>
    </Panel>
  {/if}
</Screen>
