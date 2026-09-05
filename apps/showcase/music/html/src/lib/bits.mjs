/**
 * The small, repeated pieces, as functions that return markup.
 *
 * EVERY LABEL AND EVERY NUMBER IS RESOLVED HERE, AT BUILD TIME, in the page's
 * language. `client/` has no dictionary and no formatter: anything a press can
 * put on screen was written into a data attribute by these functions. That is
 * the rule the whole build rests on, and it is why a Romanian page stays
 * Romanian after the first press.
 */

import {
  albumById,
  artistById,
  clock,
  libraryIcon,
  panPosition,
  trackIcon,
  trackLabelKey,
  volumeDb,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from './html.mjs';
import { localeHref } from './i18n.mjs';
import { route } from '@awc-ui/showcase-kit/music';

/* ------------------------------------------------------------------ numbers */

/** `compact` only above ten thousand; below that it hides a real difference. */
export const count = (t, value, { compact = false } = {}) =>
  html`<span class="num">${t.formatNumber(
    value,
    compact && value >= 10_000
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 },
  )}</span>`;

/** mm:ss. Latin digits in every locale — see `clock()` in the kit. */
export const clockText = (seconds) => html`<span class="tabular">${clock(seconds)}</span>`;

export const dateText = (t, at) =>
  html`<time${attrs({ datetime: at })}>${t.formatDate(at.slice(0, 10), 'medium')}</time>`;

/* ------------------------------------------------------------------ artwork */

export const art = (t, artwork, { className, eager = false } = {}) =>
  html`<img${attrs({
    class: className,
    src: artwork.src,
    alt: t(artwork.altKey),
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false',
  })} />`;

/* -------------------------------------------------------------- peak strips */

/**
 * THE HEIGHT IS A DATA ATTRIBUTE, NOT A STYLE. `style-src-attr 'none'` refuses
 * `style="height: 62%"`, and this build is the one where that bites hardest:
 * it writes markup, so there is no CSSOM to reach for. Each sample is rounded
 * to one of eleven buckets and `app.css` carries a rule per bucket.
 */
export const peaks = (samples) =>
  html`<span class="peaks" aria-hidden="true">${samples.map(
    (value) =>
      html`<span class="peaks__bar"${attrs({
        'data-h': Math.round(Math.max(0, Math.min(1, value)) * 10),
      })}></span>`,
  )}</span>`;

/* -------------------------------------------------------------- track rows */

/**
 * One row in a track list.
 *
 * `data-current` IS WRITTEN BY THE BUILD for the track the transport starts on
 * and MOVED BY THE CLIENT thereafter. On a static build the transport's state
 * survives a page load in `sessionStorage`, so the row that is playing has to
 * be marked after the document is parsed — see `client/transport.mjs`.
 */
export function trackRow(t, locale, track, { index, showArtist = true, showAlbum = false } = {}) {
  const artist = artistById(track.artistId);
  const album = albumById(track.albumId);
  const liked = track.liked;

  return html`<div class="track-row"${attrs({
    'data-track': track.id,
    /*
     * THE TITLE, THE ARTIST AND THE LENGTH, WRITTEN DOWN.
     *
     * The transport rebuilds its own labels from whichever row the reader
     * pressed, and it cannot read them off the visible markup: an album's list
     * hides the artist column and a playlist's hides the number, so the row
     * that is on screen is not a reliable source. Every row therefore states
     * all three, in the page's language, whether or not it shows them.
     */
    'data-title': track.title,
    'data-artist': artist?.name ?? '',
    'data-seconds': track.durationSec,
  })}>
    <span class="track-row__index">${index ?? track.trackNumber}</span>
    <span class="track-row__text">
      <a class="track-row__title link"${attrs({
        href: localeHref(locale, route.track(track.id)),
      })}>${track.title}</a>
      ${showArtist
        ? html`<span class="track-row__meta">${
            artist
              ? html`<a class="link"${attrs({
                  href: localeHref(locale, route.artist(artist.handle)),
                })}>${artist.name}</a>`
              : ''
          }</span>`
        : ''}
    </span>
    ${showAlbum
      ? html`<span class="track-row__album">${
          album
            ? html`<a class="link"${attrs({
                href: localeHref(locale, route.album(album.slug)),
              })}>${album.title}</a>`
            : ''
        }</span>`
      : ''}
    <span class="track-row__time">${clockText(track.durationSec)}</span>
    <span class="row">
      <md-icon-button${attrs({
        class: 'track-row__like',
        toggle: true,
        selected: liked || undefined,
        icon: liked ? 'favorite' : 'favorite_border',
        size: 'sm',
        'data-liked': liked ? true : undefined,
        'aria-label': `${t(liked ? 'music.action.unlike' : 'music.action.like')}: ${track.title}`,
        /* BOTH LABELS, ALREADY TRANSLATED. The client swaps between strings it
           was handed; it never composes one. */
        'data-label-like': `${t('music.action.like')}: ${track.title}`,
        'data-label-unlike': `${t('music.action.unlike')}: ${track.title}`,
        'data-msg-liked': t('music.msg.liked', { name: track.title }),
        'data-msg-unliked': t('music.msg.unliked', { name: track.title }),
      })}></md-icon-button>
      <md-icon-button${attrs({
        class: 'track-row__play',
        icon: 'play_arrow',
        size: 'sm',
        'aria-label': `${t('music.action.play')}: ${track.title}`,
        'data-play': track.id,
      })}></md-icon-button>
    </span>
  </div>`;
}

export const trackList = (t, locale, tracks, { numbered = false, showArtist = true, showAlbum = false } = {}) =>
  html`<div class="track-list"${attrs({ 'data-albums': showAlbum ? true : undefined })}>${tracks.map(
    (track, at) =>
      trackRow(t, locale, track, {
        index: numbered ? track.trackNumber : at + 1,
        showArtist,
        showAlbum,
      }),
  )}</div>`;

/* ---------------------------------------------------------------- shelves */

export const shelfCard = (t, { href, artwork, title, meta, wide = false }) =>
  html`<a class="shelf-card"${attrs({ href })}>
    ${art(t, artwork, { className: `shelf-card__art${wide ? ' shelf-card__art--wide' : ''}` })}
    <span class="shelf-card__title">${title}</span>
    ${meta ? html`<span class="shelf-card__meta">${meta}</span>` : ''}
  </a>`;

export const albumCard = (t, locale, album) =>
  shelfCard(t, {
    href: localeHref(locale, route.album(album.slug)),
    artwork: album.art,
    title: album.title,
    meta: artistById(album.artistId)?.name ?? '',
  });

export const playlistCard = (t, locale, playlist) =>
  shelfCard(t, {
    href: localeHref(locale, route.library()),
    artwork: playlist.art,
    title: playlist.title,
    meta: t('music.count.tracks', { count: t.formatNumber(playlist.trackIds.length) }),
    wide: true,
  });

export const artistRow = (t, locale, artist) =>
  html`<a class="artist-row"${attrs({ href: localeHref(locale, route.artist(artist.handle)) })}>
    ${art(t, artist.art, { className: 'artist-row__art' })}
    <span class="track-row__text">
      <span class="track-row__title">${artist.name}</span>
      <span class="track-row__meta">${t('music.label.listeners', {
        count: t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
      })}</span>
    </span>
  </a>`;

/* ------------------------------------------------------------ mixer bits */

/** `volumeDb()` returns null at zero: a fader all the way down reads "Silent". */
export function volumeReadout(t, volume) {
  const db = volumeDb(volume);
  /* THE TWO SPELLINGS TRAVEL WITH THE ELEMENT. The client recomputes the
     decibel figure as the fader moves, but it must not compose the sentence
     around it — so both forms ship here, with `{value}` left for it to fill. */
  return html`<span class="strip__readout"${attrs({
    'data-silent': t('music.label.silent'),
    'data-db': t('music.label.decibels', { value: '{value}' }),
  })}>${
    db === null
      ? t('music.label.silent')
      : t('music.label.decibels', { value: t.formatNumber(db, { maximumFractionDigits: 1 }) })
  }</span>`;
}

/** A side and an amount, never a signed number. */
export function panReadout(t, pan) {
  const position = panPosition(pan);
  return html`<span class="strip__readout"${attrs({
    'data-centre': t('music.label.panCentre'),
    'data-left': t('music.label.panLeft', { amount: '{amount}' }),
    'data-right': t('music.label.panRight', { amount: '{amount}' }),
  })}>${
    position.side === 'centre'
      ? t('music.label.panCentre')
      : t(position.side === 'left' ? 'music.label.panLeft' : 'music.label.panRight', {
          amount: t.formatNumber(position.amount),
        })
  }</span>`;
}

export const trackKindMark = (t, track) =>
  html`<span class="material-symbols-outlined" aria-hidden="true">${trackIcon[track.kind]}</span>
    <span class="visually-hidden">${t(trackLabelKey[track.kind])}</span>`;

export const kindIcon = (kind) =>
  html`<span class="material-symbols-outlined" aria-hidden="true">${libraryIcon[kind]}</span>`;
