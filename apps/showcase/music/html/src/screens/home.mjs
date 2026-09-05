/**
 * Home — the shelves are shelves, not a feed: short scannable rows the reader
 * recognises, each answering a different question.
 */
import {
  followedArtists,
  getTotals,
  ownPlaylists,
  recentAlbums,
  topTracks,
} from '@awc-ui/showcase-kit/music';
import { html } from '../lib/html.mjs';
import { panel, screen } from '../components/shell.mjs';
import { albumCard, artistRow, count, playlistCard, trackList } from '../lib/bits.mjs';

export function homeScreen(t, locale) {
  const totals = getTotals();
  const tracks = topTracks(6);
  const albums = recentAlbums(6);
  const playlists = ownPlaylists().slice(0, 4);
  const artists = followedArtists().slice(0, 4);

  return screen(t, {
    locale,
    here: '/',
    title: t('music.screen.home.title'),
    subtitle: t('music.screen.home.subtitle'),
    aside: count(t, totals.tracks),
    children: html`<div class="stack">
      ${panel({
        title: t('music.panel.topTracks'),
        actions: count(t, tracks.length),
        children: trackList(t, locale, tracks, { showAlbum: true }),
      })}
      ${panel({
        title: t('music.panel.recent'),
        actions: count(t, albums.length),
        children: html`<div class="shelf">${albums.map((a) => albumCard(t, locale, a))}</div>`,
      })}
      ${panel({
        title: t('music.panel.yourPlaylists'),
        actions: count(t, playlists.length),
        children: html`<div class="shelf">${playlists.map((p) => playlistCard(t, locale, p))}</div>`,
      })}
      ${panel({
        title: t('music.panel.artists'),
        actions: count(t, artists.length),
        children: html`<div class="stack">${artists.map((a) => artistRow(t, locale, a))}</div>`,
      })}
    </div>`,
  });
}
