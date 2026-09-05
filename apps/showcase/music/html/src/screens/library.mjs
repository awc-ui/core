/**
 * Library — four sections ordered by how often they are opened, not
 * alphabetically: liked tracks first, because that is the list people live in.
 */
import {
  followedPlaylists,
  getAlbums,
  getTotals,
  likedTracks,
  ownPlaylists,
} from '@awc-ui/showcase-kit/music';
import { html } from '../lib/html.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { albumCard, count, playlistCard, trackList } from '../lib/bits.mjs';
import { route } from '@awc-ui/showcase-kit/music';

export function libraryScreen(t, locale) {
  const totals = getTotals();
  const liked = likedTracks();
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
        actions: count(t, liked.length),
        children:
          liked.length === 0
            ? emptyState(t('music.empty.liked'))
            : trackList(t, locale, liked, { showAlbum: true }),
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
