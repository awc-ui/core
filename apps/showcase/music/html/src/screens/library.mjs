/**
 * Library — four sections ordered by how often they are opened, not
 * alphabetically: liked tracks first, because that is the list people live in.
 */
import {
  followedPlaylists,
  getAlbums,
  getTotals,
  getTracks,
  ownPlaylists,
} from '@awc-ui/showcase-kit/music';
import { html } from '../lib/html.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { albumCard, count, playlistCard, trackList, trackRow } from '../lib/bits.mjs';
import { route } from '@awc-ui/showcase-kit/music';

export function libraryScreen(t, locale) {
  const totals = getTotals();
  const liked = getTracks().filter((track) => track.liked);
  const own = ownPlaylists();
  const followed = followedPlaylists();
  const albums = getAlbums();

  return screen(t, {
    locale,
    here: route.library(),
    title: t('music.screen.library.title'),
    subtitle: t('music.screen.library.subtitle'),
    aside: count(t, totals.tracks),
    children: html`<div class="stack">
      ${panel({
        title: t('music.panel.liked'),
        actions: html`<span data-liked-count>${count(t, liked.length)}</span>`,
        children: html`<div data-liked-library>
          ${trackList(t, locale, liked, { showAlbum: true })}<template data-library-tracks
            >${getTracks().map((track) => trackRow(t, locale, track, { showAlbum: true }))}</template
          >
          <div data-liked-empty hidden>${emptyState(t('music.empty.liked'))}</div>
        </div>`,
      })}
      ${panel({
        title: t('music.panel.yourPlaylists'),
        actions: count(t, own.length),
        children: html`<div class="shelf">${own.map((p) => playlistCard(t, locale, p))}</div>`,
      })}
      ${panel({
        title: t('music.panel.followedPlaylists'),
        actions: count(t, followed.length),
        children: html`<div class="shelf">${followed.map((p) => playlistCard(t, locale, p))}</div>`,
      })}
      ${panel({
        title: t('music.panel.albums'),
        actions: count(t, albums.length),
        children: html`<div class="shelf">${albums.map((a) => albumCard(t, locale, a))}</div>`,
      })}
    </div>`,
  });
}
