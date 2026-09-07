<script lang="ts">
  import { SESSION_MODES, sessionCopy, listeningSession, clock, trackById, artistById, type SessionMode, type Track } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { player, play, toggle, playSession, removeFromQueue } from '$lib/player';
  import Art from '$lib/bits/Art.svelte';
  let mode: SessionMode = 'for-you';
  $: copy = sessionCopy($t.locale);
  $: session = listeningSession(mode);
  $: at = SESSION_MODES.indexOf(mode);
  $: queue = $player.transport.queue.map(trackById).filter((track): track is Track => track !== null);
  $: loaded = session.tracks.some((track) => track.id === $player.transport.trackId) && $player.transport.queue.every((id) => session.tracks.some((track) => track.id === id));
  $: playing = loaded && $player.transport.state === 'playing';
</script>
<section class="listening-room" aria-label={copy.choose}>
  <md-card class="listening-room__card" variant="filled" full-width><div class="listening-room__feature"><div class="listening-room__copy">
    <span class="listening-room__eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p>
    <md-button-group class="listening-room__modes" variant="standard" selection-mode="single-select" required aria-label={copy.choose}>{#each SESSION_MODES as value, index}<md-button variant="tonal" toggle {value} selected={mode === value || undefined} aria-pressed={mode === value} on:click={() => mode = value}>{copy.modes[index]}</md-button>{/each}</md-button-group>
    <div class="listening-room__session" aria-live="polite"><h3>{copy.names[at]}</h3><p>{copy.notes[at]}</p><div class="listening-room__facts"><span>{$t.formatNumber(session.tracks.length)} {copy.tracks}</span><span>{clock(session.duration)} {copy.duration}</span></div></div>
    <md-button class="listening-room__play" variant="filled" icon={playing ? 'pause' : 'play_arrow'} on:click={() => loaded ? toggle() : playSession(session.tracks)}>{playing ? copy.pause : loaded ? copy.resume : copy.play}</md-button>
    <small class="listening-room__demo">{copy.demo}</small>
  </div><div class="listening-room__artwork" aria-hidden="true">{#each session.albums as album, index (album.id)}<div class={`listening-room__cover listening-room__cover--${index}`}><Art art={album.art} eager /></div>{/each}<div class="listening-room__record" /></div></div>
  </md-card><md-card variant="outlined" role="complementary" class="listening-queue" aria-label={copy.queue}><div class="listening-queue__heading"><h3>{copy.queue}</h3><span>{$t.formatNumber(queue.length)} {copy.tracks}</span></div>
    <div class="listening-queue__list">{#each queue as track (track.id)}<div class="listening-queue__row" data-current={track.id === $player.transport.trackId || undefined}>
      <md-icon-button icon={track.id === $player.transport.trackId && $player.transport.state === 'playing' ? 'pause' : 'play_arrow'} size="sm" aria-label={`${$t(track.id === $player.transport.trackId && $player.transport.state === 'playing' ? 'music.action.pause' : 'music.action.play')}: ${track.title}`} on:click={() => track.id === $player.transport.trackId ? toggle() : play(track)} />
      <div class="listening-queue__track"><strong>{track.title}</strong><span>{artistById(track.artistId)?.name} · {clock(track.durationSec)}</span></div>
      <md-icon-button icon="close" size="sm" disabled={track.id === $player.transport.trackId || undefined} aria-label={`${copy.remove}: ${track.title}`} on:click={() => removeFromQueue(track.id)} />
    </div>{/each}</div>
  </md-card>
</section>
