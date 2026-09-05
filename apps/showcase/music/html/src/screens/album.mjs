import {
  albumBySlug, albumDuration, albumTracks, artistAlbums, artistById, clock, route,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { panel, screen } from '../components/shell.mjs';
import { albumCard, art, count, trackList } from '../lib/bits.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { notFoundScreen } from './not-found.mjs';

export function albumScreen(t, locale, slug) {
  const album = albumBySlug(slug);
  if (!album) return notFoundScreen(t, locale);
  const artist = artistById(album.artistId);
  const tracks = albumTracks(album);
  const others = artist ? artistAlbums(artist).filter((a) => a.id !== album.id) : [];

  return screen(t, {
    locale,
    here: route.album(album.slug),
    title: album.title,
    subtitle: t('music.screen.album.subtitle'),
    crumbs: [
      { labelKey: 'music.nav.library', label: null, href: route.library() },
      { labelKey: null, label: album.title, href: null },
    ],
    aside: count(t, tracks.length),
    children: html`<div class="stack">
      ${panel({
        children: html`<div class="release-head">
          ${art(t, album.art, { className: 'release-head__art', eager: true })}
          <div class="release-head__text">
            <h2 class="release-head__title">${album.title}</h2>
            <div class="row">
              ${artist ? html`<a class="link"${attrs({ href: localeHref(locale, route.artist(artist.handle)) })}>${artist.name}</a>` : ''}
              <span class="person-row__meta">${album.year}</span>
              <span class="person-row__meta">${t('music.count.tracks', { count: t.formatNumber(tracks.length) })}</span>
              <span class="person-row__meta">${clock(albumDuration(album))}</span>
            </div>
            <div class="row">
              <md-button${attrs({
                class: 'release-head__play',
                variant: 'filled',
                icon: 'play_arrow',
                'data-play': tracks[0]?.id,
              })}>${t('music.action.playAll')}</md-button>
            </div>
          </div>
        </div>`,
      })}
      ${panel({
        title: t('music.panel.tracks'),
        actions: count(t, tracks.length),
        children: trackList(t, locale, tracks, { numbered: true, showArtist: false }),
      })}
      ${others.length > 0
        ? panel({
            title: t('music.panel.discography'),
            actions: count(t, others.length),
            children: html`<div class="shelf">${others.map((o) => albumCard(t, locale, o))}</div>`,
          })
        : ''}
    </div>`,
  });
}
