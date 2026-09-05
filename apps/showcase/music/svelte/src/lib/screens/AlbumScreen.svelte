<script lang="ts">
  import { albumBySlug, albumDuration, albumTracks, artistAlbums, artistById, clock } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import { play } from '$lib/player';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Art from '$lib/bits/Art.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import AlbumCard from '$lib/bits/AlbumCard.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import ReleaseSkeleton from '$lib/skeletons/ReleaseSkeleton.svelte';

  export let slug: string;
  $: album = albumBySlug(slug);
  $: artist = album ? artistById(album.artistId) : null;
  $: tracks = album ? albumTracks(album) : [];
  $: others = artist ? artistAlbums(artist).filter((a) => a.id !== album?.id) : [];
</script>

{#if !album}
  <NotFoundScreen />
{:else}
  <Screen title={album.title} subtitle={$t('music.screen.album.subtitle')} crumbLabel={album.title}>
    <Count slot="aside" value={tracks.length} />
    <ReleaseSkeleton slot="skeleton" />

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art art={album.art} className="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{album.title}</h2>
            <div class="row">
              {#if artist}<Drill linkClass="link" href={route.artist(artist.handle)}>{artist.name}</Drill>{/if}
              <span class="person-row__meta">{album.year}</span>
              <span class="person-row__meta">{$t('music.count.tracks', { count: $t.formatNumber(tracks.length) })}</span>
              <span class="person-row__meta">{clock(albumDuration(album))}</span>
            </div>
            <div class="row">
              <md-button class="release-head__play" variant="filled" icon="play_arrow"
                on:click={() => tracks[0] && play(tracks[0])}>{$t('music.action.playAll')}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={$t('music.panel.tracks')}>
        <Count slot="actions" value={tracks.length} />
        <!-- Numbered by TRACK NUMBER: on an album the running order is the
             number printed on the sleeve. -->
        <TrackList {tracks} numbered showArtist={false} />
      </Panel>

      {#if others.length}
        <Panel title={$t('music.panel.discography')}>
          <Count slot="actions" value={others.length} />
          <div class="shelf">{#each others as other (other.id)}<AlbumCard album={other} />{/each}</div>
        </Panel>
      {/if}
    </div>
  </Screen>
{/if}
