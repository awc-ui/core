/**
 * Library — everything the reader has saved.
 *
 * FOUR SECTIONS ORDERED BY HOW OFTEN THEY ARE OPENED, not alphabetically:
 * liked tracks first because that is the list people actually live in, then
 * their own playlists, then followed playlists, then albums.
 */

import {
  followedPlaylists,
  getAlbums,
  getTotals,
  likedTracks,
  ownPlaylists,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { AlbumCard, Count, PlaylistCard, TrackList } from '@/components/bits';
import { EmptyState } from '@/components/screens/EmptyState';
import { useT } from '@/lib/showcase';
import { LibrarySkeleton } from '@/components/skeletons';

export function LibraryScreen() {
  const t = useT();
  const totals = getTotals();
  const liked = likedTracks();
  const own = ownPlaylists();
  const followed = followedPlaylists();
  const albums = getAlbums();

  return (
    <Screen
      title={t('music.screen.library.title')}
      subtitle={t('music.screen.library.subtitle')}
      aside={<Count value={totals.tracks} />}
      skeleton={<LibrarySkeleton />}
    >
      <div className="stack">
        <Panel title={t('music.panel.liked')} actions={<Count value={liked.length} />}>
          {liked.length === 0 ? (
            <EmptyState message={t('music.empty.liked')} />
          ) : (
            <TrackList tracks={liked} showAlbum />
          )}
        </Panel>

        <Panel title={t('music.panel.yourPlaylists')} actions={<Count value={own.length} />}>
          <div className="shelf">
            {own.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </Panel>

        <Panel
          title={t('music.panel.followedPlaylists')}
          actions={<Count value={followed.length} />}
        >
          <div className="shelf">
            {followed.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </Panel>

        <Panel title={t('music.panel.albums')} actions={<Count value={albums.length} />}>
          <div className="shelf">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
