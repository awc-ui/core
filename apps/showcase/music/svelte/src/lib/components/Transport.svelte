<!--
  The transport bar. The one piece of chrome that makes this a music app.

  IT LIVES IN `AppFrame`, NOT IN A SCREEN. `App` swaps the screen on every
  navigation; this bar is rendered outside it, so it is the SAME element before
  and after — the track keeps playing and the playhead stays where it was.

  NOTHING PLAYS: the playhead advances on an interval that runs only while
  playing, and there is no audio anywhere.
-->
<script lang="ts">
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
  import { t } from '$lib/showcase';
  import {
    player,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
  } from '$lib/player';
  import Art from '$lib/bits/Art.svelte';

  $: transport = $player.transport;
  $: track = transport.trackId ? trackById(transport.trackId) : null;
  $: album = track ? albumById(track.albumId) : null;
  $: artist = track ? artistById(track.artistId) : null;
  $: duration = track?.durationSec ?? 0;
  $: playing = transport.state === 'playing';

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

<div class="transport" role="region" aria-label={$t('music.label.nowPlaying')}>
  <div class="transport__now">
    {#if album}<Art art={album.art} className="transport__art" />{/if}
    <div class="transport__text">
      <div class="transport__title">{track ? track.title : $t('music.label.nothingLoaded')}</div>
      <div class="transport__artist">{artist?.name ?? ''}</div>
    </div>
  </div>

  <div class="transport__controls">
    <div class="transport__buttons">
      <md-icon-button
        class="transport__button transport__shuffle"
        icon="shuffle"
        size="sm"
        color={transport.shuffle ? 'primary' : undefined}
        data-on={transport.shuffle ? '' : undefined}
        aria-pressed={String(transport.shuffle)}
        aria-label={$t('music.action.shuffle')}
        on:click={toggleShuffle}
      ></md-icon-button>
      <md-icon-button
        class="transport__button transport__previous"
        icon="skip_previous"
        aria-label={$t('music.action.previous')}
        on:click={previous}
      ></md-icon-button>
      <!-- THE GLYPH IS THE ACTION, NOT THE STATE: a transport that is playing
           shows PAUSE, because pressing it pauses. Icon and label come from the
           same two maps in the kit so they cannot disagree. -->
      <md-icon-button
        class="transport__button transport__play"
        icon={transportIcon[transport.state]}
        variant="filled"
        aria-label={$t(transportLabelKey[transport.state])}
        data-playing={playing ? '' : undefined}
        on:click={toggle}
      ></md-icon-button>
      <md-icon-button
        class="transport__button transport__next"
        icon="skip_next"
        aria-label={$t('music.action.next')}
        on:click={next}
      ></md-icon-button>
      <md-icon-button
        class="transport__button transport__repeat"
        icon={repeatIcon[transport.repeat]}
        size="sm"
        color={repeatTone[transport.repeat] ?? undefined}
        data-repeat={transport.repeat}
        aria-label={$t(repeatLabelKey[transport.repeat])}
        on:click={cycleRepeat}
      ></md-icon-button>
    </div>

    <div class="transport__scrub">
      <span class="transport__time transport__elapsed">{clock(transport.positionSec)}</span>
      <md-slider
        class="transport__slider"
        min={0}
        max={Math.max(1, duration)}
        step={1}
        value={transport.positionSec}
        aria-label={$t('music.action.seek')}
        on:mdInput={(event) => seek(sliderValue(event), duration)}
      ></md-slider>
      <span class="transport__time transport__duration">{clock(duration)}</span>
    </div>
  </div>

  <div class="transport__side">
    <md-icon-button
      class="transport__mute"
      icon={transport.muted || transport.volume === 0 ? 'volume_off' : 'volume_up'}
      size="sm"
      aria-pressed={String(transport.muted)}
      aria-label={$t(transport.muted ? 'music.action.unmute' : 'music.action.mute')}
      on:click={toggleMute}
    ></md-icon-button>
    <!-- The fader shows where it IS, not what you can hear: muting must not
         slide it to zero, or un-muting cannot put it back. -->
    <md-slider
      class="transport__volume"
      min={0}
      max={100}
      step={1}
      value={Math.round(transport.volume * 100)}
      aria-label={$t('music.action.volume')}
      on:mdInput={(event) => setVolume(sliderValue(event) / 100)}
    ></md-slider>
  </div>
</div>
