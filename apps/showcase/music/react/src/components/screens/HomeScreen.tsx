/**
 * Home — what the reader has been playing and what is new.
 *
 * THE SHELVES ARE HORIZONTAL SHELVES, not a feed. A music home page is a set of
 * short, scannable rows the reader recognises, and each one answers a different
 * question: what do I play most, what is new, what have I made. A single
 * infinite list would be the Corvus feed with album covers on it.
 */

import {
  followedArtists,
  getTotals,
  ownPlaylists,
  recentAlbums,
  topTracks,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { AlbumCard, ArtistRow, Count, PlaylistCard, TrackList } from '@/components/bits';
import { useT } from '@/lib/showcase';
import { HomeSkeleton } from '@/components/skeletons';

export function HomeScreen() {
  const t = useT();
  const totals = getTotals();
  const tracks = topTracks(6);
  const albums = recentAlbums(6);
  const playlists = ownPlaylists().slice(0, 4);
  const artists = followedArtists().slice(0, 4);

  return (
    <Screen
      title={t('music.screen.home.title')}
      subtitle={t('music.screen.home.subtitle')}
      aside={<Count value={totals.tracks} />}
      skeleton={<HomeSkeleton />}
    >
      <div className="stack">
        <Panel
          title={t('music.panel.topTracks')}
          actions={<Count value={tracks.length} />}
        >
          <TrackList tracks={tracks} showAlbum />
        </Panel>

        <Panel title={t('music.panel.recent')} actions={<Count value={albums.length} />}>
          <div className="shelf">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </Panel>

        <Panel title={t('music.panel.yourPlaylists')} actions={<Count value={playlists.length} />}>
          <div className="shelf">
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </Panel>

        <Panel title={t('music.panel.artists')} actions={<Count value={artists.length} />}>
          <div className="stack">
            {artists.map((artist) => (
              <ArtistRow key={artist.id} artist={artist} />
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
