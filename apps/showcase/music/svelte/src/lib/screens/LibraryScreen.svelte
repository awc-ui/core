<!--
  Library — four sections ordered by how often they are opened, not
  alphabetically: liked tracks first, because that is the list people live in.
-->
<script lang="ts">
  import { followedPlaylists, getAlbums, getTotals, likedTracks, ownPlaylists } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import AlbumCard from '$lib/bits/AlbumCard.svelte';
  import PlaylistCard from '$lib/bits/PlaylistCard.svelte';
  import LibrarySkeleton from '$lib/skeletons/LibrarySkeleton.svelte';

  const totals = getTotals();
  const liked = likedTracks();
  const own = ownPlaylists();
  const followed = followedPlaylists();
  const albums = getAlbums();
</script>

<Screen title={$t('music.screen.library.title')} subtitle={$t('music.screen.library.subtitle')}>
  <Count slot="aside" value={totals.tracks} />
  <LibrarySkeleton slot="skeleton" />

  <div class="stack">
    <Panel title={$t('music.panel.liked')}>
      <Count slot="actions" value={liked.length} />
      {#if liked.length === 0}
        <EmptyState message={$t('music.empty.liked')} />
      {:else}
        <TrackList tracks={liked} showAlbum />
      {/if}
    </Panel>

    <Panel title={$t('music.panel.yourPlaylists')}>
      <Count slot="actions" value={own.length} />
      <div class="shelf">{#each own as playlist (playlist.id)}<PlaylistCard {playlist} />{/each}</div>
    </Panel>

    <Panel title={$t('music.panel.followedPlaylists')}>
      <Count slot="actions" value={followed.length} />
      <div class="shelf">{#each followed as playlist (playlist.id)}<PlaylistCard {playlist} />{/each}</div>
    </Panel>

    <Panel title={$t('music.panel.albums')}>
      <Count slot="actions" value={albums.length} />
      <div class="shelf">{#each albums as album (album.id)}<AlbumCard {album} />{/each}</div>
    </Panel>
  </div>
</Screen>
