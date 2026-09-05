<!--
  Home — the shelves are shelves, not a feed: a set of short scannable rows the
  reader recognises, each answering a different question.
-->
<script lang="ts">
  import { followedArtists, getTotals, ownPlaylists, recentAlbums, topTracks } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Count from '$lib/bits/Count.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import AlbumCard from '$lib/bits/AlbumCard.svelte';
  import PlaylistCard from '$lib/bits/PlaylistCard.svelte';
  import ArtistRow from '$lib/bits/ArtistRow.svelte';
  import HomeSkeleton from '$lib/skeletons/HomeSkeleton.svelte';

  const totals = getTotals();
  const tracks = topTracks(6);
  const albums = recentAlbums(6);
  const playlists = ownPlaylists().slice(0, 4);
  const artists = followedArtists().slice(0, 4);
</script>

<Screen title={$t('music.screen.home.title')} subtitle={$t('music.screen.home.subtitle')}>
  <Count slot="aside" value={totals.tracks} />
  <HomeSkeleton slot="skeleton" />

  <div class="stack">
    <Panel title={$t('music.panel.topTracks')}>
      <Count slot="actions" value={tracks.length} />
      <TrackList {tracks} showAlbum />
    </Panel>

    <Panel title={$t('music.panel.recent')}>
      <Count slot="actions" value={albums.length} />
      <div class="shelf">{#each albums as album (album.id)}<AlbumCard {album} />{/each}</div>
    </Panel>

    <Panel title={$t('music.panel.yourPlaylists')}>
      <Count slot="actions" value={playlists.length} />
      <div class="shelf">{#each playlists as playlist (playlist.id)}<PlaylistCard {playlist} />{/each}</div>
    </Panel>

    <Panel title={$t('music.panel.artists')}>
      <Count slot="actions" value={artists.length} />
      <div class="stack">{#each artists as artist (artist.id)}<ArtistRow {artist} />{/each}</div>
    </Panel>
  </div>
</Screen>
