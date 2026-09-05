import { albumById, albumTracks, artistById, clock, route, trackById } from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { panel, screen } from '../components/shell.mjs';
import { art, count, peaks, trackList } from '../lib/bits.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { notFoundScreen } from './not-found.mjs';

export function trackScreen(t, locale, trackId) {
  const track = trackById(trackId);
  if (!track) return notFoundScreen(t, locale);
  const album = albumById(track.albumId);
  const artist = artistById(track.artistId);
  const siblings = album ? albumTracks(album).filter((x) => x.id !== track.id) : [];
  const liked = track.liked;

  return screen(t, {
    locale,
    here: route.track(track.id),
    title: track.title,
    subtitle: t('music.screen.track.subtitle'),
    crumbs: [
      { labelKey: 'music.nav.library', label: null, href: route.library() },
      { labelKey: null, label: track.title, href: null },
    ],
    aside: html`<span class="tabular">${clock(track.durationSec)}</span>`,
    children: html`<div class="stack">
      ${panel({
        children: html`<div class="release-head">
          ${album ? art(t, album.art, { className: 'release-head__art', eager: true }) : ''}
          <div class="release-head__text">
            <h2 class="release-head__title">${track.title}</h2>
            <div class="row">
              ${artist ? html`<a class="link"${attrs({ href: localeHref(locale, route.artist(artist.handle)) })}>${artist.name}</a>` : ''}
              <span class="person-row__meta">·</span>
              ${album ? html`<a class="link"${attrs({ href: localeHref(locale, route.album(album.slug)) })}>${album.title}</a>` : ''}
              <span class="person-row__meta">${album?.year ?? ''}</span>
            </div>
            ${peaks(track.peaks)}
            <div class="row">
              <md-button${attrs({
                class: 'track__play',
                variant: 'filled',
                icon: 'play_arrow',
                'data-play': track.id,
                'data-label-play': t('music.action.play'),
                'data-label-pause': t('music.action.pause'),
              })}>${t('music.action.play')}</md-button>
              <md-button${attrs({
                class: 'track__like',
                variant: liked ? 'tonal' : 'outlined',
                icon: liked ? 'favorite' : 'favorite_border',
                'data-liked': liked ? true : undefined,
                'data-label-like': t('music.action.like'),
                'data-label-unlike': t('music.action.unlike'),
                'data-msg-liked': t('music.msg.liked', { name: track.title }),
                'data-msg-unliked': t('music.msg.unliked', { name: track.title }),
              })}>${t(liked ? 'music.action.unlike' : 'music.action.like')}</md-button>
              <md-button${attrs({
                class: 'track__queue',
                variant: 'text',
                icon: 'queue_music',
                'data-msg': t('music.msg.queued', { name: track.title }),
              })}>${t('music.action.addToQueue')}</md-button>
            </div>
          </div>
        </div>`,
      })}
      ${panel({
        title: t('music.panel.listening'),
        children: html`<div class="stat-row">
          <div><dt>${t('music.label.duration')}</dt><dd class="tabular">${clock(track.durationSec)}</dd></div>
          <div><dt>${t('music.label.playCount')}</dt><dd>${count(t, track.playCount, { compact: true })}</dd></div>
          <div><dt>${t('music.label.year')}</dt><dd>${album?.year ?? ''}</dd></div>
        </div>`,
      })}
      ${siblings.length > 0 && album
        ? panel({
            title: t('music.panel.appearsOn'),
            subtitle: album.title,
            actions: count(t, siblings.length),
            children: trackList(t, locale, siblings, { numbered: true, showArtist: false }),
          })
        : ''}
    </div>`,
  });
}
