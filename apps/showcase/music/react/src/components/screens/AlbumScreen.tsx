/** An album: its cover, its running order, and the rest of the discography. */

import {
  albumBySlug,
  albumDuration,
  albumTracks,
  artistById,
  artistAlbums,
  clock,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { AlbumCard, Art, Count, TrackList } from '@/components/bits';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { Link } from '@/lib/router';
import { route, withBase } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { ReleaseSkeleton } from '@/components/skeletons';

export function AlbumScreen({ slug }: { slug: string }) {
  const t = useT();
  const player = usePlayer();
  const album = albumBySlug(slug);

  if (!album) {
    return <NotFoundScreen />;
  }

  const artist = artistById(album.artistId);
  const tracks = albumTracks(album);
  const others = artistAlbums(artist!).filter((a) => a.id !== album.id);

  return (
    <Screen
      title={album.title}
      subtitle={t('music.screen.album.subtitle')}
      crumbLabel={album.title}
      aside={<Count value={tracks.length} />}
      skeleton={<ReleaseSkeleton />}
    >
      <div className="stack">
        <Panel>
          <div className="release-head">
            <Art art={album.art} className="release-head__art" eager />
            <div className="release-head__text">
              <h2 className="release-head__title">{album.title}</h2>
              <div className="row">
                {artist ? (
                  <Link className="link" href={withBase(route.artist(artist.handle))}>
                    {artist.name}
                  </Link>
                ) : null}
                <span className="person-row__meta">{album.year}</span>
                <span className="person-row__meta">
                  {t('music.count.tracks', { count: t.formatNumber(tracks.length) })}
                </span>
                <span className="person-row__meta">{clock(albumDuration(album))}</span>
              </div>
              <div className="row">
                <md-button
                  class="release-head__play"
                  variant="filled"
                  icon="play_arrow"
                  onClick={() => tracks[0] && player.play(tracks[0])}
                >
                  {t('music.action.playAll')}
                </md-button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t('music.panel.tracks')} actions={<Count value={tracks.length} />}>
          {/* Numbered by TRACK NUMBER here, not by position: on an album the
              running order is the number printed on the sleeve. */}
          <TrackList tracks={tracks} numbered showArtist={false} />
        </Panel>

        {others.length > 0 ? (
          <Panel title={t('music.panel.discography')} actions={<Count value={others.length} />}>
            <div className="shelf">
              {others.map((other) => (
                <AlbumCard key={other.id} album={other} />
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </Screen>
  );
}
