import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  clock,
  getQueue,
  getTracks,
  trackById,
  artistById,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { art } from '../lib/bits.mjs';

function queueRow(t, track, current) {
  const copy = sessionCopy(t.locale);
  return html`<div class="listening-queue__row"${attrs({ 'data-track': track.id, 'data-current': current || undefined })}>
    <md-icon-button${attrs({ icon: 'play_arrow', size: 'sm', 'data-queue-play': track.id, 'aria-label': `${t('music.action.play')}: ${track.title}`, 'data-label-play': `${t('music.action.play')}: ${track.title}`, 'data-label-pause': `${t('music.action.pause')}: ${track.title}` })}></md-icon-button>
    <div class="listening-queue__track"><strong>${track.title}</strong><span>${artistById(track.artistId)?.name} · ${clock(track.durationSec)}</span></div>
    <md-icon-button${attrs({ icon: 'close', size: 'sm', 'data-queue-remove': track.id, disabled: current || undefined, 'aria-label': `${copy.remove}: ${track.title}` })}></md-icon-button>
  </div>`;
}

export function listeningRoom(t) {
  const copy = sessionCopy(t.locale);
  const session = listeningSession('for-you');
  const queue = getQueue();
  return html`<section class="listening-room" ${attrs({ 'aria-label': copy.choose })}>
    <md-card class="listening-room__card" variant="filled" full-width
      ><div class="listening-room__feature">
        <div class="listening-room__copy">
          <span class="listening-room__eyebrow">${copy.eyebrow}</span>
          <h2>${copy.title}</h2>
          <p>${copy.description}</p>
          <md-button-group
            class="listening-room__modes"
            variant="standard"
            selection-mode="single-select"
            required${attrs({ 'aria-label': copy.choose })}
            >${SESSION_MODES.map((mode, index) => html`<md-button variant="tonal" toggle${attrs({ value: mode, 'data-session-mode': mode, selected: index === 0 || undefined, 'aria-pressed': String(index === 0) })}>${copy.modes[index]}</md-button>`)}</md-button-group
          >
          <div class="listening-room__session" aria-live="polite">
            <h3>${copy.names[0]}</h3>
            <p>${copy.notes[0]}</p>
            <div class="listening-room__facts">
              <span>${t.formatNumber(session.tracks.length)} ${copy.tracks}</span
              ><span>${clock(session.duration)} ${copy.duration}</span>
            </div>
          </div>
          <md-button class="listening-room__play" variant="filled" icon="play_arrow"
            >${copy.play}</md-button
          >
          <small class="listening-room__demo">${copy.demo}</small>
        </div>
        <div class="listening-room__artwork" aria-hidden="true">
          ${session.albums.map((album, index) => html`<div${attrs({ class: `listening-room__cover listening-room__cover--${index}` })}>${art(t, album.art, { eager: true })}</div>`)}
          <div class="listening-room__record"></div>
        </div>
      </div> </md-card
    ><md-card
      variant="outlined"
      role="complementary"
      class="listening-queue"
      ${attrs({ 'aria-label': copy.queue })}
      ><div class="listening-queue__heading">
        <h3>${copy.queue}</h3>
        <span>${t.formatNumber(queue.length)} ${copy.tracks}</span>
      </div>
      <div class="listening-queue__list">
        ${queue
          .map((id) => trackById(id))
          .filter(Boolean)
          .map((track, index) => queueRow(t, track, index === 0))}
      </div>
    </md-card>
    <template class="listening-queue__template"
      >${getTracks().map((track) => queueRow(t, track, false))}</template
    >
    ${SESSION_MODES.map((mode) => html`<template${attrs({ 'data-session-art': mode })}>${listeningSession(mode).albums.map((album, index) => html`<div${attrs({ class: `listening-room__cover listening-room__cover--${index}` })}>${art(t, album.art, { eager: true })}</div>`)}<div class="listening-room__record"></div></template>`)}
  </section>`;
}
