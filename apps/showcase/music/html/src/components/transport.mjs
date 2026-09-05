/**
 * The transport bar, written into every page.
 *
 * THIS IS THE HARDEST PART OF THE PORT, AND THE MOST HONEST. In the four SPA
 * builds the transport is state held above the router: navigating swaps the
 * screen and leaves the bar alone. This build has no router — every navigation
 * is a real page load, and a page load destroys every variable there is.
 *
 * SO IT PERSISTS RATHER THAN PRETENDS. The bar is written into the markup of
 * all 303 pages in its default state, and `client/transport.mjs` reads what the
 * reader was actually doing out of `sessionStorage` and applies it before the
 * first paint the reader notices. A static site genuinely cannot keep a
 * variable across a load; what it CAN do is write one down.
 *
 * `sessionStorage` AND NOT `localStorage`: the transport is a property of this
 * visit, not of this browser. Coming back tomorrow to a half-finished track
 * would be a surprising thing for a showcase to remember.
 *
 * EVERY LABEL IS WRITTEN HERE, in the page's language — the client has no
 * dictionary, so both spellings of every control's name ship in the markup.
 */

import { clock, repeatIcon, repeatLabelKey, repeatTone, trackById, albumById, artistById, transportIcon, transportLabelKey } from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { art } from '../lib/bits.mjs';

export function transport(t, { queue }) {
  /* The bar ships loaded with the first queued track and PAUSED, which is what
     every build ships and what keeps the parity comparison meaningful: the
     static checks never press play, so the readout they compare is 0:00. */
  const trackId = queue[0] ?? null;
  const track = trackId ? trackById(trackId) : null;
  const album = track ? albumById(track.albumId) : null;
  const artist = track ? artistById(track.artistId) : null;
  const duration = track?.durationSec ?? 0;

  return html`<div class="transport" role="region"${attrs({
    'aria-label': t('music.label.nowPlaying'),
    /* The whole queue, so the client can skip without a dictionary or a
       fixture lookup of its own. */
    'data-queue': queue.join(','),
  })}>
    <div class="transport__now">
      ${album ? art(t, album.art, { className: 'transport__art' }) : ''}
      <div class="transport__text">
        <div class="transport__title">${track ? track.title : t('music.label.nothingLoaded')}</div>
        <div class="transport__artist">${artist?.name ?? ''}</div>
      </div>
    </div>

    <div class="transport__controls">
      <div class="transport__buttons">
        <md-icon-button${attrs({
          class: 'transport__button transport__shuffle',
          icon: 'shuffle',
          size: 'sm',
          'aria-pressed': 'false',
          'aria-label': t('music.action.shuffle'),
        })}></md-icon-button>
        <md-icon-button${attrs({
          class: 'transport__button transport__previous',
          icon: 'skip_previous',
          'aria-label': t('music.action.previous'),
        })}></md-icon-button>
        <!--
          THE GLYPH IS THE ACTION, NOT THE STATE: a transport that is playing
          shows PAUSE, because pressing it pauses. Both spellings are written
          onto the element so the client can swap without a dictionary.
        -->
        <md-icon-button${attrs({
          class: 'transport__button transport__play',
          icon: transportIcon.paused,
          variant: 'filled',
          'aria-label': t(transportLabelKey.paused),
          'data-icon-play': transportIcon.paused,
          'data-icon-pause': transportIcon.playing,
          'data-label-play': t(transportLabelKey.paused),
          'data-label-pause': t(transportLabelKey.playing),
        })}></md-icon-button>
        <md-icon-button${attrs({
          class: 'transport__button transport__next',
          icon: 'skip_next',
          'aria-label': t('music.action.next'),
        })}></md-icon-button>
        <md-icon-button${attrs({
          class: 'transport__button transport__repeat',
          icon: repeatIcon.off,
          size: 'sm',
          'data-repeat': 'off',
          'aria-label': t(repeatLabelKey.off),
          /* All three states, already translated and already toned. */
          'data-off-icon': repeatIcon.off,
          'data-off-label': t(repeatLabelKey.off),
          'data-all-icon': repeatIcon.all,
          'data-all-label': t(repeatLabelKey.all),
          'data-all-tone': repeatTone.all ?? '',
          'data-one-icon': repeatIcon.one,
          'data-one-label': t(repeatLabelKey.one),
          'data-one-tone': repeatTone.one ?? '',
        })}></md-icon-button>
      </div>

      <div class="transport__scrub">
        <span class="transport__time transport__elapsed">${clock(0)}</span>
        <md-slider${attrs({
          class: 'transport__slider',
          min: 0,
          max: Math.max(1, duration),
          step: 1,
          value: 0,
          'aria-label': t('music.action.seek'),
        })}></md-slider>
        <span class="transport__time transport__duration">${clock(duration)}</span>
      </div>
    </div>

    <!--
      THE QUEUE'S OWN LABELS, IN A TEMPLATE.

      The bar has to name whatever it skips to, and it cannot read that off the
      page: the home screen lists six tracks and the queue holds seven, so
      pressing Next landed on a track the document had never mentioned and the
      title simply did not change. Every queued track therefore ships its title,
      its artist and its length here, already in the page's language.

      A TEMPLATE and not a hidden list, because the parity census counts
      ELEMENTS and not visible ones — a hidden span per queued track would read
      as seven extra elements the four SPA builds do not have. A template's
      contents are an inert fragment outside the document.
    -->
    <template class="transport__queue">${queue.map((id) => {
      const queued = trackById(id);
      if (!queued) return '';
      return html`<span${attrs({
        'data-track': queued.id,
        'data-title': queued.title,
        'data-artist': artistById(queued.artistId)?.name ?? '',
        'data-seconds': queued.durationSec,
      })}></span>`;
    })}</template>

    <div class="transport__side">
      <md-icon-button${attrs({
        class: 'transport__mute',
        icon: 'volume_up',
        size: 'sm',
        'aria-pressed': 'false',
        'aria-label': t('music.action.mute'),
        'data-label-mute': t('music.action.mute'),
        'data-label-unmute': t('music.action.unmute'),
      })}></md-icon-button>
      <md-slider${attrs({
        class: 'transport__volume',
        min: 0,
        max: 100,
        step: 1,
        value: 80,
        'aria-label': t('music.action.volume'),
      })}></md-slider>
    </div>
  </div>`;
}
