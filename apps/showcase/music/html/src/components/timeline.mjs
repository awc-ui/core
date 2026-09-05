/**
 * The arrangement: a ruler, a lane per track, and clips placed in whole bars.
 *
 * NOT ONE PIXEL OFFSET IS COMPUTED HERE, and this build is where that
 * constraint is real rather than theoretical. The deployed policy is
 * `style-src-attr 'none'`; the four SPA builds could in principle set a style
 * through the CSSOM, which the policy does not touch — this one writes MARKUP,
 * so a `style="left: 340px"` on a clip would be refused outright and the whole
 * arrangement would collapse into column one.
 *
 * What it writes instead is `data-start` and `data-span`, and `app.css` — which
 * is allowed the arithmetic the element is not — places them. Dragging rewrites
 * the same two numbers, so the snap is a property of the layout and every build
 * drags identically.
 */

import {
  placeClip,
  playheadBar,
  rulerTicks,
  trackClips,
  trackIcon,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { peaks } from '../lib/bits.mjs';

export function timeline(t, project, tracks) {
  const ticks = rulerTicks(project.bars);
  const head = playheadBar(0, project.bars);

  return html`<div class="lanes">
    <div class="lane-names">
      <div class="lane-names__pad"></div>
      ${tracks.map(
        (track) => html`<div class="lane-name" role="button" tabindex="0"${attrs({
          'data-track': track.id,
          'aria-label': `${t('music.edit.trackRename')}: ${track.name}`,
        })}>
          <span class="material-symbols-outlined" aria-hidden="true">${trackIcon[track.kind]}</span>
          <span class="lane-name__text">${track.name}</span>
        </div>`,
      )}
    </div>

    <div class="timeline" data-zoom="md">
      <div class="timeline__inner">
        <div class="ruler"${attrs({ 'data-bars': project.bars })}>
          ${ticks.map(
            (tick) => html`<span class="ruler__tick"${attrs({
              'data-start': tick.bar,
              'data-span': 1,
              'data-labelled': tick.labelled ? true : undefined,
            })}>${tick.labelled ? html`<span class="ruler__label">${tick.bar}</span>` : ''}</span>`,
          )}
        </div>

        ${tracks.map((track) => {
          const clips = trackClips(track.id);
          return html`<div class="lane"${attrs({
            'data-bars': project.bars,
            'data-kind': track.kind,
          })}>
            ${clips.map((clip) => {
              const at = placeClip(clip, project.bars);
              return html`<div class="clip" role="button" tabindex="0"${attrs({
                'data-clip': clip.id,
                'data-start': at.startBar,
                'data-span': at.bars,
                'data-kind': clip.kind,
                'data-track': clip.trackId,
                /* THE NAME CARRIES THE POSITION, because a timeline of forty
                   identical "Verse" buttons is unusable with a screen reader.
                   Both the label and the two words around the numbers are
                   written now, so the client can rebuild the name after a drag
                   without a dictionary. */
                'aria-label': `${t(clip.labelKey)}, ${t('music.label.bar')} ${at.startBar}, ${at.bars} ${t('music.label.bars')}`,
                'aria-pressed': 'false',
                'data-name': t(clip.labelKey),
                'data-word-bar': t('music.label.bar'),
                'data-word-bars': t('music.label.bars'),
                'data-msg-moved': t('music.msg.clipMoved', { name: t(clip.labelKey) }),
                'data-msg-resized': t('music.msg.clipResized', { name: t(clip.labelKey) }),
                'data-msg-removed': t('music.msg.clipRemoved', { name: t(clip.labelKey) }),
              })}>
                <span class="clip__label">${t(clip.labelKey)}</span>
                ${peaks(clip.peaks)}
                <span class="clip__resize" aria-hidden="true"></span>
              </div>`;
            })}
            <span class="playhead"${attrs({ 'data-start': head, 'data-span': 1 })} aria-hidden="true"></span>
          </div>`;
        })}
      </div>
    </div>
  </div>`;
}
