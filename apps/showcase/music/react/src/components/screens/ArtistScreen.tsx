/** An artist: who they are, what they are known for, and everything they made. */

import { artistAlbums, artistByHandle, artistTopTracks } from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { AlbumCard, Art, Count, TrackList } from '@/components/bits';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { useSnackbar } from '@/components/screens/Snackbar';
import { ReleaseSkeleton } from '@/components/skeletons';

export function ArtistScreen({ handle }: { handle: string }) {
  const t = useT();
  const player = usePlayer();
  const say = useSnackbar();
  const artist = artistByHandle(handle);

  if (!artist) {
    return <NotFoundScreen />;
  }

  const albums = artistAlbums(artist);
  const top = artistTopTracks(artist);
  const followed = player.followedFor(artist.handle, artist.followed);

  return (
    <Screen
      title={artist.name}
      subtitle={t('music.screen.artist.subtitle')}
      crumbLabel={artist.name}
      aside={<Count value={albums.length} />}
      skeleton={<ReleaseSkeleton />}
    >
      <div className="stack">
        <Panel>
          <div className="release-head">
            <Art art={artist.art} className="release-head__art" eager />
            <div className="release-head__text">
              <h2 className="release-head__title">{artist.name}</h2>
              <p className="person-row__meta">
                {t('music.label.listeners', {
                  count: t.formatNumber(artist.monthlyListeners, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }),
                })}
              </p>
              <p>{t(artist.bioKey)}</p>
              <div className="row">
                <md-button
                  class="artist__follow"
                  variant={followed ? 'outlined' : 'filled'}
                  icon={followed ? 'check' : 'person_add'}
                  data-followed={followed ? '' : undefined}
                  onClick={() => {
                    player.toggleFollow(artist.handle, artist.followed);
                    say(followed ? 'music.msg.unfollowed' : 'music.msg.followed', {
                      name: artist.name,
                    });
                  }}
                >
                  {t(followed ? 'music.action.unfollow' : 'music.action.follow')}
                </md-button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t('music.panel.topTracks')} actions={<Count value={top.length} />}>
          <TrackList tracks={top} showArtist={false} showAlbum />
        </Panel>

        <Panel title={t('music.panel.discography')} actions={<Count value={albums.length} />}>
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
