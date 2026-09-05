/**
 * Studio — the projects, and the arrangement of whichever one is open.
 *
 * THERE IS NO PROJECTS INDEX SCREEN. Studio IS the list of projects with one of
 * them open, which is what the even five-destination split leaves room for and
 * is also how arrangement software actually opens.
 *
 * MOVING A CLIP IS A BUTTON, NOT A DRAG. Drag-and-drop on a timeline needs
 * pointer capture, an autoscroll and a drop preview to be usable, and none of
 * that would demonstrate a component — it would demonstrate a drag library. The
 * two nudge buttons make the same edit, go through the same history, and are
 * reachable from a keyboard, which a drag is not.
 */

import { useState } from 'react';
import {
  canRedo,
  canUndo,
  currentProject,
  editIcon,
  getProjects,
  nextRedo,
  nextUndo,
  clipFits,
  projectBySlug,
  projectClips,
  projectStateIcon,
  projectStateTone,
  projectTracks,
  trackClips,
  type Clip,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { Art, Count, DateText } from '@/components/bits';
import { Timeline } from '@/components/screens/Timeline';
import { EmptyState } from '@/components/screens/EmptyState';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { Link } from '@/lib/router';
import { route, withBase } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { useSnackbar } from '@/components/screens/Snackbar';
import { StudioSkeleton } from '@/components/skeletons';

export type Zoom = 'sm' | 'md' | 'lg';
const ZOOMS: readonly Zoom[] = ['sm', 'md', 'lg'];

export function StudioScreen({ slug }: { slug?: string }) {
  const t = useT();
  const player = usePlayer();
  const say = useSnackbar();
  const [zoom, setZoom] = useState<Zoom>('md');
  const [selected, setSelected] = useState<string | null>(null);

  const project = slug ? projectBySlug(slug) : currentProject();
  const projects = getProjects();

  if (!project) {
    return <NotFoundScreen />;
  }

  const tracks = projectTracks(project).map(
    (track) => player.tracks.find((t2) => t2.id === track.id) ?? track,
  );
  const clips = projectClips(project).filter((clip) => !player.clipRemoved(clip.id));
  const selectedClip = clips.find((c) => c.id === selected) ?? null;

  /*
   * The toolbar's edits, which are the SAME operations the drag performs.
   *
   * Both routes go through `clipFits` in the kit, so a button cannot put a clip
   * somewhere a drag would refuse to — which is the drift you get the moment
   * the pointer path and the button path each do their own bounds check.
   */
  const laneOf = (clip: Clip) =>
    trackClips(clip.trackId)
      .filter((c) => !player.clipRemoved(c.id))
      .map((c) => ({
        id: c.id,
        startBar: player.clipStart(c.id, c.startBar),
        bars: player.clipBars(c.id, c.bars),
      }));

  const nudge = (clip: Clip, delta: number) => {
    const from = player.clipStart(clip.id, clip.startBar);
    const bars = player.clipBars(clip.id, clip.bars);
    const to = from + delta;
    if (!clipFits(laneOf(clip), clip.id, to, bars, project.bars)) return;
    player.moveClip(clip.id, clip.startBar, to);
    say('music.msg.clipMoved', { name: t(clip.labelKey) });
  };

  const stretch = (clip: Clip, delta: number) => {
    const from = player.clipStart(clip.id, clip.startBar);
    const bars = player.clipBars(clip.id, clip.bars) + delta;
    if (bars < 1 || !clipFits(laneOf(clip), clip.id, from, bars, project.bars)) return;
    player.resizeClip(clip.id, clip.bars, bars);
    say('music.msg.clipResized', { name: t(clip.labelKey) });
  };

  const drop = (clip: Clip) => {
    player.removeClip(clip.id, clip.labelKey);
    setSelected(null);
    say('music.msg.clipRemoved', { name: t(clip.labelKey) });
  };

  const undoable = canUndo(player.history);
  const redoable = canRedo(player.history);
  const pendingUndo = nextUndo(player.history);
  const pendingRedo = nextRedo(player.history);

  return (
    <Screen
      title={t('music.screen.studio.title')}
      subtitle={t('music.screen.studio.subtitle')}
      /* THE TRAIL NAMES THE PROJECT. `crumbsFor` puts a proper-noun crumb last
         for a project path, and without this it was handed `null` — React
         rendered a blank crumb and Svelte rendered the string "null". Passing
         the title is what the crumb is for. */
      crumbLabel={project.title}
      aside={<Count value={projects.length} />}
      skeleton={<StudioSkeleton />}
    >
      <div className="stack">
        <Panel>
          <div className="studio-head">
            <div className="studio-head__facts">
              <Art art={project.art} className="project-card__art" eager />
              <div className="project-card__text">
                <h2 className="release-head__title">{project.title}</h2>
                <div className="row">
                  <md-chip
                    variant="assist"
                    appearance="outlined"
                    color={projectStateTone[project.state]}
                    icon={projectStateIcon[project.state]}
                    label={t(project.stateKey)}
                  />
                  <span className="person-row__meta">
                    {project.bpm} {t('music.label.bpm')}
                  </span>
                  <span className="person-row__meta">
                    {project.bars} {t('music.label.bars')}
                  </span>
                  <span className="person-row__meta">
                    {t('music.hint.updated', { date: '' })}
                    <DateText at={project.updatedAt} />
                  </span>
                </div>
              </div>
            </div>

            <div className="studio-head__tools">
              {/*
               * UNDO NAMES WHAT IT WILL REVERSE. "Undo" alone makes a reader
               * press it to find out; "Undo: Change level" does not. The label
               * comes from the edit's own key, so it is translated and it
               * cannot drift from what the history list shows.
               */}
              <md-button
                class="studio__undo"
                variant="text"
                icon="undo"
                size="sm"
                soft-disabled={!undoable || undefined}
                aria-label={
                  pendingUndo
                    ? `${t('music.action.undo')}: ${t(pendingUndo.labelKey)}`
                    : t('music.action.undo')
                }
                onClick={() => {
                  const edit = player.undo();
                  say(edit ? 'music.msg.undone' : 'music.msg.nothingToUndo', {
                    name: edit ? t(edit.labelKey) : '',
                  });
                }}
              >
                {t('music.action.undo')}
              </md-button>
              <md-button
                class="studio__redo"
                variant="text"
                icon="redo"
                size="sm"
                soft-disabled={!redoable || undefined}
                aria-label={
                  pendingRedo
                    ? `${t('music.action.redo')}: ${t(pendingRedo.labelKey)}`
                    : t('music.action.redo')
                }
                onClick={() => {
                  const edit = player.redo();
                  say(edit ? 'music.msg.redone' : 'music.msg.nothingToRedo', {
                    name: edit ? t(edit.labelKey) : '',
                  });
                }}
              >
                {t('music.action.redo')}
              </md-button>

              <md-icon-button
                class="studio__zoom-out"
                icon="zoom_out"
                size="sm"
                soft-disabled={zoom === 'sm' || undefined}
                aria-label={t('music.action.zoomOut')}
                onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)]!)}
              />
              <md-icon-button
                class="studio__zoom-in"
                icon="zoom_in"
                size="sm"
                soft-disabled={zoom === 'lg' || undefined}
                aria-label={t('music.action.zoomIn')}
                onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)]!)}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title={t('music.panel.arrangement')}
          subtitle={t('music.hint.editing')}
          actions={
            <span className="row">
              <Count value={clips.length} />
              {selectedClip ? (
                <>
                  <md-icon-button
                    class="studio__nudge-back"
                    icon="chevron_left"
                    size="sm"
                    aria-label={`${t('music.edit.clipMove')}: ${t(selectedClip.labelKey)}`}
                    onClick={() => nudge(selectedClip, -1)}
                  />
                  <md-icon-button
                    class="studio__nudge-forward"
                    icon="chevron_right"
                    size="sm"
                    aria-label={`${t('music.edit.clipMove')}: ${t(selectedClip.labelKey)}`}
                    onClick={() => nudge(selectedClip, 1)}
                  />
                  <md-icon-button
                    class="studio__shrink"
                    icon="compress"
                    size="sm"
                    aria-label={`${t('music.edit.clipResize')}: ${t(selectedClip.labelKey)}`}
                    onClick={() => stretch(selectedClip, -1)}
                  />
                  <md-icon-button
                    class="studio__grow"
                    icon="expand"
                    size="sm"
                    aria-label={`${t('music.edit.clipResize')}: ${t(selectedClip.labelKey)}`}
                    onClick={() => stretch(selectedClip, 1)}
                  />
                  <md-icon-button
                    class="studio__delete"
                    icon="delete"
                    size="sm"
                    color="error"
                    aria-label={`${t('music.edit.clipRemove')}: ${t(selectedClip.labelKey)}`}
                    onClick={() => drop(selectedClip)}
                  />
                </>
              ) : null}
            </span>
          }
        >
          <Timeline
            project={project}
            tracks={tracks}
            zoom={zoom}
            selectedClipId={selected}
            onSelectClip={(clip) => setSelected(clip === null ? null : clip.id)}
            onMessage={say}
          />
        </Panel>

        <Panel title={t('music.panel.history')} actions={<Count value={player.history.done.length} />}>
          {player.history.done.length === 0 && player.history.undone.length === 0 ? (
            <EmptyState message={t('music.empty.history')} />
          ) : (
            <div className="stack">
              {player.history.done.map((edit) => (
                <div className="history-row" key={edit.id}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {editIcon[edit.kind]}
                  </span>
                  <span>{t(edit.labelKey)}</span>
                </div>
              ))}
              {/* An undone edit is still listed — it is what redo will
                  reapply — and reads as pending rather than as gone. */}
              {player.history.undone.map((edit) => (
                <div className="history-row" key={edit.id} data-undone="">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {editIcon[edit.kind]}
                  </span>
                  <span>{t(edit.labelKey)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('music.panel.projects')} actions={<Count value={projects.length} />}>
          <div className="stack">
            {projects.map((other) => (
              <Link
                className="project-card"
                key={other.id}
                href={withBase(route.project(other.slug))}
                data-current={other.id === project.id ? '' : undefined}
                data-project={other.slug}
              >
                <Art art={other.art} className="project-card__art" />
                <span className="project-card__text">
                  <span className="track-row__title">{other.title}</span>
                  <span className="track-row__meta">
                    {t(other.stateKey)} · {other.bars} {t('music.label.bars')}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
