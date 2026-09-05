/**
 * Profile — the reader's own listening, playlists and projects.
 *
 * IT ALSO CARRIES THE QUEUE, which is the one place in the app the whole of it
 * is visible. The transport shows what is loaded; this shows what follows, and
 * marks the row that is playing — the same `data-current` the track lists use,
 * so a reader recognises it.
 */

import {
  getTotals,
  getViewer,
  likedTracks,
  ownPlaylists,
  getProjects,
  trackById,
  artistById,
  upNext,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { Art, Count, PlaylistCard, TrackList } from '@/components/bits';
import { EmptyState } from '@/components/screens/EmptyState';
import { Link } from '@/lib/router';
import { route, withBase } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { ProfileSkeleton } from '@/components/skeletons';

export function ProfileScreen() {
  const t = useT();
  const player = usePlayer();
  const viewer = getViewer();
  const totals = getTotals();
  const liked = likedTracks(6);
  const playlists = ownPlaylists();
  const projects = getProjects();

  /* The whole remaining queue, not the transport's five-row preview. */
  const queue = upNext(player.transport, 50);

  return (
    <Screen
      title={t('music.screen.profile.title')}
      subtitle={t('music.screen.profile.subtitle')}
      aside={<Count value={totals.likedTracks} />}
      skeleton={<ProfileSkeleton />}
    >
      <div className="stack">
        <Panel>
          <div className="release-head">
            <Art art={viewer.art} className="release-head__art" eager />
            <div className="release-head__text">
              <h2 className="release-head__title">{viewer.displayName}</h2>
              <p className="person-row__meta">@{viewer.handle}</p>
              <div className="stat-row">
                <div>
                  <dt>{t('music.panel.liked')}</dt>
                  <dd>
                    <Count value={totals.likedTracks} />
                  </dd>
                </div>
                <div>
                  <dt>{t('music.panel.yourPlaylists')}</dt>
                  <dd>
                    <Count value={playlists.length} />
                  </dd>
                </div>
                <div>
                  <dt>{t('music.panel.projects')}</dt>
                  <dd>
                    <Count value={totals.projects} />
                  </dd>
                </div>
                <div>
                  <dt>{t('music.label.minutes')}</dt>
                  <dd>
                    <Count value={totals.listeningMinutes} compact />
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t('music.panel.queue')} actions={<Count value={queue.length} />}>
          {queue.length === 0 ? (
            <EmptyState message={t('music.empty.queue')} />
          ) : (
            <div className="stack">
              {queue.map((id, at) => {
                const track = trackById(id);
                if (!track) return null;
                return (
                  <div className="queue-row" key={id}>
                    <span className="queue-row__index">{at + 1}</span>
                    <span className="track-row__text">
                      <Link className="track-row__title link" href={withBase(route.track(track.id))}>
                        {track.title}
                      </Link>
                      <span className="track-row__meta">{artistById(track.artistId)?.name}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title={t('music.panel.liked')} actions={<Count value={liked.length} />}>
          {liked.length === 0 ? (
            <EmptyState message={t('music.empty.liked')} />
          ) : (
            <TrackList tracks={liked} showAlbum />
          )}
        </Panel>

        <Panel title={t('music.panel.yourPlaylists')} actions={<Count value={playlists.length} />}>
          <div className="shelf">
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </Panel>

        <Panel title={t('music.panel.projects')} actions={<Count value={projects.length} />}>
          <div className="stack">
            {projects.map((project) => (
              <Link
                className="project-card"
                key={project.id}
                href={withBase(route.project(project.slug))}
              >
                <Art art={project.art} className="project-card__art" />
                <span className="project-card__text">
                  <span className="track-row__title">{project.title}</span>
                  <span className="track-row__meta">{t(project.stateKey)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
