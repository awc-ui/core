/** One track: its waveform, its facts, and what it sits on. */

import {
  albumById,
  albumTracks,
  artistById,
  clock,
  trackById,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { AlbumLink, Art, ArtistLink, Count, Peaks, TrackList } from '@/components/bits';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { useSnackbar } from '@/components/screens/Snackbar';
import { ReleaseSkeleton } from '@/components/skeletons';

export function TrackScreen({ trackId }: { trackId: string }) {
  const t = useT();
  const player = usePlayer();
  const say = useSnackbar();
  const track = trackById(trackId);

  if (!track) {
    return <NotFoundScreen />;
  }

  const album = albumById(track.albumId);
  const artist = artistById(track.artistId);
  const siblings = album ? albumTracks(album).filter((x) => x.id !== track.id) : [];
  const liked = player.likedFor(track);
  const current = player.transport.trackId === track.id;

  return (
    <Screen
      title={track.title}
      subtitle={t('music.screen.track.subtitle')}
      crumbLabel={track.title}
      aside={<span className="tabular">{clock(track.durationSec)}</span>}
      skeleton={<ReleaseSkeleton />}
    >
      <div className="stack">
        <Panel>
          <div className="release-head">
            {album ? <Art art={album.art} className="release-head__art" eager /> : null}
            <div className="release-head__text">
              <h2 className="release-head__title">{track.title}</h2>
              <div className="row">
                <ArtistLink id={track.artistId} />
                <span className="person-row__meta">·</span>
                <AlbumLink id={track.albumId} />
                <span className="person-row__meta">{album?.year}</span>
              </div>
              <Peaks peaks={track.peaks} />
              <div className="row">
                <md-button
                  class="track__play"
                  variant="filled"
                  icon={current && player.transport.state === 'playing' ? 'pause' : 'play_arrow'}
                  onClick={() => (current ? player.toggle() : player.play(track))}
                >
                  {t(current && player.transport.state === 'playing' ? 'music.action.pause' : 'music.action.play')}
                </md-button>
                <md-button
                  class="track__like"
                  variant={liked ? 'tonal' : 'outlined'}
                  icon={liked ? 'favorite' : 'favorite_border'}
                  data-liked={liked ? '' : undefined}
                  onClick={() => {
                    player.toggleLike(track);
                    say(liked ? 'music.msg.unliked' : 'music.msg.liked', { name: track.title });
                  }}
                >
                  {t(liked ? 'music.action.unlike' : 'music.action.like')}
                </md-button>
                <md-button
                  class="track__queue"
                  variant="text"
                  icon="queue_music"
                  onClick={() => {
                    player.enqueue(track);
                    say('music.msg.queued', { name: track.title });
                  }}
                >
                  {t('music.action.addToQueue')}
                </md-button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t('music.panel.listening')}>
          <div className="stat-row">
            <div>
              <dt>{t('music.label.duration')}</dt>
              <dd className="tabular">{clock(track.durationSec)}</dd>
            </div>
            <div>
              <dt>{t('music.label.playCount')}</dt>
              <dd>
                <Count value={track.playCount} compact />
              </dd>
            </div>
            <div>
              <dt>{t('music.label.year')}</dt>
              <dd>{album?.year ?? ''}</dd>
            </div>
          </div>
        </Panel>

        {siblings.length > 0 && album ? (
          <Panel title={t('music.panel.appearsOn')} subtitle={album.title} actions={<Count value={siblings.length} />}>
            <TrackList tracks={siblings} numbered showArtist={false} />
          </Panel>
        ) : null}
      </div>
    </Screen>
  );
}
