/**
 * The mixer: a strip per track, and the rule that decides what you hear.
 *
 * THE ASYMMETRY IS THE WHOLE SCREEN. Soloing silences every track that is not
 * soloed; an explicitly muted track stays silent regardless. `audibleTracks()`
 * in the kit is the only place that rule is written, and `data-silent` is keyed
 * on its answer rather than on the mute flag.
 *
 * SIXTY CONTROLS ON ONE SCREEN: every control takes its track's name into its
 * accessible name, and BOTH spellings of every label ship in the markup,
 * because the client has no dictionary.
 */
import {
  audibleTracks,
  currentProject,
  muteIcon,
  muteLabelKey,
  projectTracks,
  route,
  soloLabelKey,
  trackLabelKey,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { count, panReadout, trackKindMark, volumeReadout } from '../lib/bits.mjs';

export function mixerScreen(t, locale) {
  const project = currentProject();
  const tracks = project ? projectTracks(project) : [];
  const audible = audibleTracks(tracks);

  return screen(t, {
    locale,
    here: route.mixer(),
    title: t('music.screen.mixer.title'),
    subtitle: t('music.screen.mixer.subtitle'),
    aside: count(t, tracks.length),
    children: !project
      ? emptyState(t('music.empty.clips'))
      : panel({
          title: project.title,
          subtitle: t('music.hint.soloRule'),
          actions: count(t, tracks.length),
          children: html`<div class="mixer" role="group"${attrs({
            'aria-label': t('music.screen.mixer.title'),
          })}>${tracks.map((track) => {
            const heard = audible.has(track.id);
            return html`<div class="strip"${attrs({
              'data-track': track.id,
              'data-silent': heard ? undefined : true,
            })}>
              <span class="strip__name">${track.name}</span>
              <span class="strip__kind">${trackKindMark(t, track)}</span>

              <div class="strip__body">
                <md-slider${attrs({
                  class: 'strip__fader',
                  orientation: 'vertical',
                  'full-height': true,
                  min: 0,
                  max: 100,
                  step: 1,
                  value: Math.round(track.volume * 100),
                  'aria-label': `${t('music.label.level')}: ${track.name}`,
                })}></md-slider>
              </div>

              <md-meter${attrs({
                class: 'strip__meter',
                value: Math.round(track.level * 100),
                min: 0,
                max: 100,
                color: track.level > 0.85 ? 'error' : 'primary',
                label: `${t('music.label.level')}: ${track.name}`,
              })}></md-meter>

              ${volumeReadout(t, track.volume)}

              <md-slider${attrs({
                class: 'strip__pan',
                min: -100,
                max: 100,
                step: 5,
                value: Math.round(track.pan * 100),
                'aria-label': `${t('music.label.pan')}: ${track.name}`,
              })}></md-slider>
              ${panReadout(t, track.pan)}

              <div class="strip__buttons">
                <md-icon-button${attrs({
                  class: 'strip__mute',
                  icon: muteIcon(heard),
                  size: 'sm',
                  'aria-pressed': 'false',
                  'aria-label': `${t(muteLabelKey(false))}: ${track.name}`,
                  'data-label-mute': `${t(muteLabelKey(false))}: ${track.name}`,
                  'data-label-unmute': `${t(muteLabelKey(true))}: ${track.name}`,
                  'data-msg-muted': t('music.msg.muted', { name: track.name }),
                  'data-msg-unmuted': t('music.msg.unmuted', { name: track.name }),
                })}></md-icon-button>
                <md-icon-button${attrs({
                  class: 'strip__solo',
                  icon: 'headphones',
                  size: 'sm',
                  'aria-pressed': 'false',
                  'aria-label': `${t(soloLabelKey(false))}: ${track.name}`,
                  'data-label-solo': `${t(soloLabelKey(false))}: ${track.name}`,
                  'data-label-unsolo': `${t(soloLabelKey(true))}: ${track.name}`,
                  'data-msg-soloed': t('music.msg.soloed', { name: track.name }),
                  'data-msg-unsoloed': t('music.msg.unsoloed', { name: track.name }),
                })}></md-icon-button>
              </div>

              <span class="visually-hidden"${attrs({
                'data-audible': t('music.label.audible'),
                'data-inaudible': t('music.label.inaudible'),
              })}>${t(heard ? 'music.label.audible' : 'music.label.inaudible')} — ${t(trackLabelKey[track.kind])}</span>
            </div>`;
          })}</div>`,
        }),
  });
}
