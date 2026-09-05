/**
 * The mixer: a strip per track, and the rule that decides what you hear.
 *
 * THE ASYMMETRY IS THE WHOLE SCREEN. Soloing a track silences every track that
 * is not soloed; an explicitly muted track stays silent regardless, including
 * when it is itself soloed. `audibleTracks()` in the kit is the only place that
 * rule is written, and `data-silent` here is keyed on its answer rather than on
 * the mute flag — which is why pressing solo on one strip visibly drops eleven
 * others back. A mixer keyed on the flag would leave them looking live while
 * telling the reader they are not.
 *
 * SIXTY CONTROLS ON ONE SCREEN is a different accessibility problem from six.
 * "Mute, button" announced twelve times is useless, so every control here takes
 * its track's name into its accessible name.
 */

import {
  currentProject,
  muteIcon,
  muteLabelKey,
  projectTracks,
  soloLabelKey,
  trackLabelKey,
} from '@awc-ui/showcase-kit/music';
import { Panel, Screen } from '@/components/Shell';
import { Count, PanReadout, TrackKindMark, VolumeReadout } from '@/components/bits';
import { Slider } from '@/components/elements';
import { EmptyState } from '@/components/screens/EmptyState';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { useSnackbar } from '@/components/screens/Snackbar';
import { MixerSkeleton } from '@/components/skeletons';

export function MixerScreen() {
  const t = useT();
  const player = usePlayer();
  const say = useSnackbar();
  const project = currentProject();

  if (!project) {
    return (
      <Screen title={t('music.screen.mixer.title')} subtitle={t('music.screen.mixer.subtitle')}>
        <EmptyState message={t('music.empty.clips')} />
      </Screen>
    );
  }

  const tracks = projectTracks(project).map(
    (track) => player.tracks.find((t2) => t2.id === track.id) ?? track,
  );

  return (
    <Screen
      title={t('music.screen.mixer.title')}
      subtitle={t('music.screen.mixer.subtitle')}
      aside={<Count value={tracks.length} />}
      skeleton={<MixerSkeleton />}
    >
      <Panel
        title={project.title}
        subtitle={t('music.hint.soloRule')}
        actions={<Count value={tracks.length} />}
      >
        <div className="mixer" role="group" aria-label={t('music.screen.mixer.title')}>
          {tracks.map((track) => {
            const audible = player.audible.has(track.id);
            return (
              <div
                className="strip"
                key={track.id}
                data-track={track.id}
                /* Derived, not the mute flag — see the header. */
                data-silent={audible ? undefined : ''}
              >
                <span className="strip__name">{track.name}</span>
                <span className="strip__kind">
                  <TrackKindMark track={track} />
                </span>

                <div className="strip__body">
                  {/*
                   * A REAL VERTICAL SLIDER, via the component's own
                   * `orientation` prop. Rotating a horizontal one with a
                   * transform leaves its hit area, focus ring and arrow keys
                   * horizontal — a control that looks vertical and behaves
                   * otherwise.
                   */}
                  <Slider
                    class="strip__fader"
                    orientation="vertical"
                    full-height
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(track.volume * 100)}
                    aria-label={`${t('music.label.level')}: ${track.name}`}
                    onInput={(value) => player.setTrackVolume(track.id, value / 100)}
                  />
                </div>

                {/*
                 * THE METER IS HORIZONTAL, AND THAT IS THE COMPONENT'S DOING
                 * RATHER THAN A CHOICE. A hardware mixer puts a vertical meter
                 * beside the fader, and the first version asked for one with
                 * `orientation="vertical"` — a prop `md-meter` does not have.
                 * It silently stayed linear and got squeezed into a ten-pixel
                 * column, which read as a coloured smudge. A full-width bar
                 * under the fader uses the component as designed and is
                 * legible; inventing a vertical one out of divs would be
                 * drawing a meter rather than demonstrating the library's.
                 *
                 * It is a STATIC reading: nothing plays, so nothing animates.
                 */}
                <md-meter
                  class="strip__meter"
                  value={Math.round(track.level * 100)}
                  min={0}
                  max={100}
                  color={track.level > 0.85 ? 'error' : 'primary'}
                  label={`${t('music.label.level')}: ${track.name}`}
                />

                <VolumeReadout volume={track.volume} />

                <Slider
                  class="strip__pan"
                  min={-100}
                  max={100}
                  step={5}
                  value={Math.round(track.pan * 100)}
                  aria-label={`${t('music.label.pan')}: ${track.name}`}
                  onInput={(value) => player.setTrackPan(track.id, value / 100)}
                />
                <PanReadout pan={track.pan} />

                <div className="strip__buttons">
                  <md-icon-button
                    class="strip__mute"
                    icon={muteIcon(audible)}
                    size="sm"
                    color={track.muted ? 'error' : undefined}
                    data-on={track.muted ? '' : undefined}
                    aria-pressed={track.muted}
                    aria-label={`${t(muteLabelKey(track.muted))}: ${track.name}`}
                    onClick={() => {
                      player.toggleTrackMute(track.id);
                      say(track.muted ? 'music.msg.unmuted' : 'music.msg.muted', {
                        name: track.name,
                      });
                    }}
                  />
                  <md-icon-button
                    class="strip__solo"
                    icon="headphones"
                    size="sm"
                    color={track.soloed ? 'primary' : undefined}
                    data-on={track.soloed ? '' : undefined}
                    aria-pressed={track.soloed}
                    aria-label={`${t(soloLabelKey(track.soloed))}: ${track.name}`}
                    onClick={() => {
                      player.toggleTrackSolo(track.id);
                      say(track.soloed ? 'music.msg.unsoloed' : 'music.msg.soloed', {
                        name: track.name,
                      });
                    }}
                  />
                </div>

                <span className="visually-hidden">
                  {t(audible ? 'music.label.audible' : 'music.label.inaudible')}
                  {' — '}
                  {t(trackLabelKey[track.kind])}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </Screen>
  );
}
