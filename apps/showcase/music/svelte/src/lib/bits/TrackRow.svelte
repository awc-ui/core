<!--
  One row in a track list.

  IT MARKS ITSELF WHEN IT IS THE LOADED TRACK, on every screen that lists it, so
  a reader never has to look at the bar to find where they are.

  THE WHOLE ROW IS NOT A LINK: it carries a link and two buttons, and a control
  inside an anchor fires both on a keyboard press.
-->
<script lang="ts">
  import { albumById, artistById, type Track } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import { player, toggleLike, likedFor, play, toggle } from '$lib/player';
  import Drill from '$lib/components/Drill.svelte';
  import Clock from '$lib/bits/Clock.svelte';

  export let track: Track;
  export let index: number | undefined = undefined;
  export let showArtist = true;
  export let showAlbum = false;

  $: current = $player.transport.trackId === track.id;
  $: liked = likedFor($player, track);
  $: artist = artistById(track.artistId);
  $: album = albumById(track.albumId);
</script>

<div class="track-row" data-track={track.id} data-current={current ? '' : undefined}>
  <span class="track-row__index">{index ?? track.trackNumber}</span>
  <span class="track-row__text">
    <Drill linkClass="track-row__title link" href={route.track(track.id)}>{track.title}</Drill>
    {#if showArtist}
      <span class="track-row__meta">
        {#if artist}<Drill linkClass="link" href={route.artist(artist.handle)}>{artist.name}</Drill>{/if}
      </span>
    {/if}
  </span>
  {#if showAlbum}
    <span class="track-row__album">
      {#if album}<Drill linkClass="link" href={route.album(album.slug)}>{album.title}</Drill>{/if}
    </span>
  {/if}
  <span class="track-row__time"><Clock seconds={track.durationSec} /></span>
  <span class="row">
    <!-- `toggle` + `selected`; the FILL comes from the font axis in `app.css`,
         because the Outlined face draws `favorite` and `favorite_border` the
         same and swapping the ligature alone changes nothing. -->
    <md-icon-button
      class="track-row__like"
      toggle
      selected={liked || undefined}
      icon={liked ? 'favorite' : 'favorite_border'}
      size="sm"
      data-liked={liked ? '' : undefined}
      aria-label={`${$t(liked ? 'music.action.unlike' : 'music.action.like')}: ${track.title}`}
      on:click={() => toggleLike(track)}
    ></md-icon-button>
    <md-icon-button
      class="track-row__play"
      icon={current && $player.transport.state === 'playing' ? 'pause' : 'play_arrow'}
      size="sm"
      aria-label={`${$t('music.action.play')}: ${track.title}`}
      on:click={() => (current ? toggle() : play(track))}
    ></md-icon-button>
  </span>
</div>
