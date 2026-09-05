<script lang="ts">
  import { albumById, albumTracks, artistById, clock, trackById } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import { player, likedFor, toggleLike, play, toggle, enqueue } from '$lib/player';
  import { say } from '$lib/snackbar';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Art from '$lib/bits/Art.svelte';
  import Peaks from '$lib/bits/Peaks.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import ReleaseSkeleton from '$lib/skeletons/ReleaseSkeleton.svelte';

  export let trackId: string;
  $: track = trackById(trackId);
  $: album = track ? albumById(track.albumId) : null;
  $: artist = track ? artistById(track.artistId) : null;
  $: siblings = album ? albumTracks(album).filter((x) => x.id !== track?.id) : [];
  $: liked = track ? likedFor($player, track) : false;
  $: current = $player.transport.trackId === trackId;
  $: playing = current && $player.transport.state === 'playing';
</script>

{#if !track}
  <NotFoundScreen />
{:else}
  <Screen title={track.title} subtitle={$t('music.screen.track.subtitle')} crumbLabel={track.title}>
    <span class="tabular" slot="aside">{clock(track.durationSec)}</span>
    <ReleaseSkeleton slot="skeleton" />

    <div class="stack">
      <Panel>
        <div class="release-head">
          {#if album}<Art art={album.art} className="release-head__art" eager />{/if}
          <div class="release-head__text">
            <h2 class="release-head__title">{track.title}</h2>
            <div class="row">
              {#if artist}<Drill linkClass="link" href={route.artist(artist.handle)}>{artist.name}</Drill>{/if}
              <span class="person-row__meta">·</span>
              {#if album}<Drill linkClass="link" href={route.album(album.slug)}>{album.title}</Drill>{/if}
              <span class="person-row__meta">{album?.year ?? ''}</span>
            </div>
            <Peaks peaks={track.peaks} />
            <div class="row">
              <md-button class="track__play" variant="filled" icon={playing ? 'pause' : 'play_arrow'}
                on:click={() => (current ? toggle() : track && play(track))}
              >{$t(playing ? 'music.action.pause' : 'music.action.play')}</md-button>
              <md-button
                class="track__like"
                variant={liked ? 'tonal' : 'outlined'}
                icon={liked ? 'favorite' : 'favorite_border'}
                data-liked={liked ? '' : undefined}
                on:click={() => {
                  const was = liked;
                  if (track) toggleLike(track);
                  say(was ? 'music.msg.unliked' : 'music.msg.liked', { name: track?.title ?? '' });
                }}
              >{$t(liked ? 'music.action.unlike' : 'music.action.like')}</md-button>
              <md-button class="track__queue" variant="text" icon="queue_music"
                on:click={() => {
                  if (track) enqueue(track);
                  say('music.msg.queued', { name: track?.title ?? '' });
                }}
              >{$t('music.action.addToQueue')}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={$t('music.panel.listening')}>
        <div class="stat-row">
          <div><dt>{$t('music.label.duration')}</dt><dd class="tabular">{clock(track.durationSec)}</dd></div>
          <div><dt>{$t('music.label.playCount')}</dt><dd><Count value={track.playCount} compact /></dd></div>
          <div><dt>{$t('music.label.year')}</dt><dd>{album?.year ?? ''}</dd></div>
        </div>
      </Panel>

      {#if siblings.length && album}
        <Panel title={$t('music.panel.appearsOn')} subtitle={album.title}>
          <Count slot="actions" value={siblings.length} />
          <TrackList tracks={siblings} numbered showArtist={false} />
        </Panel>
      {/if}
    </div>
  </Screen>
{/if}
