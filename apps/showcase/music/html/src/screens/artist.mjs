import { artistAlbums, artistByHandle, artistTopTracks, route } from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { panel, screen } from '../components/shell.mjs';
import { albumCard, art, count, trackList } from '../lib/bits.mjs';
import { notFoundScreen } from './not-found.mjs';

export function artistScreen(t, locale, handle) {
  const artist = artistByHandle(handle);
  if (!artist) return notFoundScreen(t, locale);
  const albums = artistAlbums(artist);
  const top = artistTopTracks(artist);
  const followed = artist.followed;

  return screen(t, {
    locale,
    here: route.artist(artist.handle),
    title: artist.name,
    subtitle: t('music.screen.artist.subtitle'),
    crumbs: [
      { labelKey: 'music.nav.library', label: null, href: route.library() },
      { labelKey: null, label: artist.name, href: null },
    ],
    aside: count(t, albums.length),
    children: html`<div class="stack">
      ${panel({
        children: html`<div class="release-head">
          ${art(t, artist.art, { className: 'release-head__art', eager: true })}
          <div class="release-head__text">
            <h2 class="release-head__title">${artist.name}</h2>
            <p class="person-row__meta">${t('music.label.listeners', {
              count: t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
            })}</p>
            <p>${t(artist.bioKey)}</p>
            <div class="row">
              <md-button${attrs({
                class: 'artist__follow',
                variant: followed ? 'outlined' : 'filled',
                icon: followed ? 'check' : 'person_add',
                'data-followed': followed ? true : undefined,
                /* Both states, already translated — the client has no
                   dictionary and only swaps between strings it was handed. */
                'data-label-follow': t('music.action.follow'),
                'data-label-unfollow': t('music.action.unfollow'),
                'data-msg-followed': t('music.msg.followed', { name: artist.name }),
                'data-msg-unfollowed': t('music.msg.unfollowed', { name: artist.name }),
              })}>${t(followed ? 'music.action.unfollow' : 'music.action.follow')}</md-button>
            </div>
          </div>
        </div>`,
      })}
      ${panel({
        title: t('music.panel.topTracks'),
        actions: count(t, top.length),
        children: trackList(t, locale, top, { showArtist: false, showAlbum: true }),
      })}
      ${panel({
        title: t('music.panel.discography'),
        actions: count(t, albums.length),
        children: html`<div class="shelf">${albums.map((a) => albumCard(t, locale, a))}</div>`,
      })}
    </div>`,
  });
}
