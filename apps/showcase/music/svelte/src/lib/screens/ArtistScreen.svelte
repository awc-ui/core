<script lang="ts">
  import { artistAlbums, artistByHandle, artistTopTracks } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { player, followedFor, toggleFollow } from '$lib/player';
  import { say } from '$lib/snackbar';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Art from '$lib/bits/Art.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import AlbumCard from '$lib/bits/AlbumCard.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import ReleaseSkeleton from '$lib/skeletons/ReleaseSkeleton.svelte';

  export let handle: string;
  $: artist = artistByHandle(handle);
  $: albums = artist ? artistAlbums(artist) : [];
  $: top = artist ? artistTopTracks(artist) : [];
  $: followed = artist ? followedFor($player, artist.handle, artist.followed) : false;
</script>

{#if !artist}
  <NotFoundScreen />
{:else}
  <Screen title={artist.name} subtitle={$t('music.screen.artist.subtitle')} crumbLabel={artist.name}>
    <Count slot="aside" value={albums.length} />
    <ReleaseSkeleton slot="skeleton" />

    <div class="stack">
      <Panel>
        <div class="release-head">
          <Art art={artist.art} className="release-head__art" eager />
          <div class="release-head__text">
            <h2 class="release-head__title">{artist.name}</h2>
            <p class="person-row__meta">{$t('music.label.listeners', {
              count: $t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
            })}</p>
            <p>{$t(artist.bioKey)}</p>
            <div class="row">
              <md-button
                class="artist__follow"
                variant={followed ? 'outlined' : 'filled'}
                icon={followed ? 'check' : 'person_add'}
                data-followed={followed ? '' : undefined}
                on:click={() => {
                  const was = followed;
                  if (artist) toggleFollow(artist.handle, artist.followed);
                  say(was ? 'music.msg.unfollowed' : 'music.msg.followed', { name: artist?.name ?? '' });
                }}
              >{$t(followed ? 'music.action.unfollow' : 'music.action.follow')}</md-button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={$t('music.panel.topTracks')}>
        <Count slot="actions" value={top.length} />
        <TrackList tracks={top} showArtist={false} showAlbum />
      </Panel>

      <Panel title={$t('music.panel.discography')}>
        <Count slot="actions" value={albums.length} />
        <div class="shelf">{#each albums as album (album.id)}<AlbumCard {album} />{/each}</div>
      </Panel>
    </div>
  </Screen>
{/if}
