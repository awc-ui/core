/**
 * Profile — the reader's own listening, playlists and projects.
 *
 * IT ALSO CARRIES THE QUEUE, the one place the whole of it is visible.
 */
import {
  artistById, getProjects, getTotals, getViewer, initialTransport, getQueue,
  likedTracks, ownPlaylists, route, trackById, upNext,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { art, count, playlistCard, trackList } from '../lib/bits.mjs';
import { localeHref } from '../lib/i18n.mjs';

export function profileScreen(t, locale) {
  const viewer = getViewer();
  const totals = getTotals();
  const liked = likedTracks(6);
  const playlists = ownPlaylists();
  const projects = getProjects();
  /* The queue AS SHIPPED. The client re-renders it from `sessionStorage` if the
     reader has skipped, but the document has to hold the default or the page
     would be empty before the script runs. */
  const queue = upNext(initialTransport(getQueue()), 50)
    .map((id) => trackById(id))
    .filter(Boolean);

  return screen(t, {
    locale,
    here: route.profile(),
    title: t('music.screen.profile.title'),
    subtitle: t('music.screen.profile.subtitle'),
    aside: count(t, totals.likedTracks),
    children: html`<div class="stack">
      ${panel({
        children: html`<div class="release-head">
          ${art(t, viewer.art, { className: 'release-head__art', eager: true })}
          <div class="release-head__text">
            <h2 class="release-head__title">${viewer.displayName}</h2>
            <p class="person-row__meta">@${viewer.handle}</p>
            <div class="stat-row">
              <div><dt>${t('music.panel.liked')}</dt><dd>${count(t, totals.likedTracks)}</dd></div>
              <div><dt>${t('music.panel.yourPlaylists')}</dt><dd>${count(t, playlists.length)}</dd></div>
              <div><dt>${t('music.panel.projects')}</dt><dd>${count(t, totals.projects)}</dd></div>
              <div><dt>${t('music.label.minutes')}</dt><dd>${count(t, totals.listeningMinutes, { compact: true })}</dd></div>
            </div>
          </div>
        </div>`,
      })}
      ${panel({
        title: t('music.panel.queue'),
        actions: count(t, queue.length),
        children:
          queue.length === 0
            ? emptyState(t('music.empty.queue'))
            : html`<div class="stack">${queue.map(
                (track, at) => html`<div class="queue-row">
                  <span class="queue-row__index">${at + 1}</span>
                  <span class="track-row__text">
                    <a class="track-row__title link"${attrs({
                      href: localeHref(locale, route.track(track.id)),
                    })}>${track.title}</a>
                    <span class="track-row__meta">${artistById(track.artistId)?.name ?? ''}</span>
                  </span>
                </div>`,
              )}</div>`,
      })}
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
        actions: count(t, playlists.length),
        children: html`<div class="shelf">${playlists.map((p) => playlistCard(t, locale, p))}</div>`,
      })}
      ${panel({
        title: t('music.panel.projects'),
        actions: count(t, projects.length),
        children: html`<div class="stack">${projects.map(
          (p) => html`<a class="project-card"${attrs({ href: localeHref(locale, route.project(p.slug)) })}>
            ${art(t, p.art, { className: 'project-card__art' })}
            <span class="project-card__text">
              <span class="track-row__title">${p.title}</span>
              <span class="track-row__meta">${t(p.stateKey)}</span>
            </span>
          </a>`,
        )}</div>`,
      })}
    </div>`,
  });
}
