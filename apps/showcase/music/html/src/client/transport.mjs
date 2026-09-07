/**
 * The transport, restored from `sessionStorage` on every page load.
 *
 * THE ONE PLACE THIS BUILD IS GENUINELY DIFFERENT. The four SPA builds hold the
 * transport in memory above their router; a navigation swaps the screen and
 * leaves the bar alone. Here every navigation is a real page load and every
 * variable is gone, so the state is WRITTEN DOWN and read back — which is not a
 * workaround, it is the only honest thing a static site can do. The reader sees
 * the same behaviour: the track that was playing is still loaded, still
 * playing, and the playhead has kept going.
 *
 * NOTHING IS FORMATTED OR TRANSLATED HERE. Every label the bar can show was
 * written into a data attribute at build time, in the page's language. This
 * module swaps between strings it was handed and computes only mm:ss, which is
 * Latin digits in every locale by design.
 */

import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  startSession,
  removeQueuedTrack,
  getTracks,
  clock,
  cycleRepeat,
  initialTransport,
  next,
  previous,
  seekTo,
  setVolume,
  tick,
  togglePlay,
  toggleMute,
} from '@awc-ui/showcase-kit/music';
import { raise } from './snackbar.mjs';

const KEY = 'cygnus.transport';
let activeTransport = null;

/** Durations, read off the markup so the client needs no fixture of its own. */
const durations = new Map();

function load(queue) {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const valid = new Set(getTracks().map((track) => track.id));
      const savedQueue = Array.isArray(parsed.queue)
        ? [...new Set(parsed.queue.filter((id) => valid.has(id)))]
        : queue;
      const restored = { ...initialTransport(savedQueue), ...parsed, queue: savedQueue };
      if (!valid.has(restored.trackId)) return initialTransport(queue);
      return restored;
    }
  } catch {
    /* A refused or corrupt store is not an error worth showing anybody — the
       bar simply starts where a first visit starts. */
  }
  return initialTransport(queue);
}

function save(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Private browsing refuses the write. The session simply does not persist,
       which is a smaller failure than throwing on every press. */
  }
}

/*
 * THESE LISTEN FOR `click`, NOT `mdClick`.
 *
 * `mdClick` is raised by the real `<button>` inside the component's shadow
 * root, so it fires for a reader's press and NOT for `element.click()` on the
 * host. The native `click` is composed and crosses the shadow boundary, so it
 * covers both — which matters because the browser suite presses by calling
 * `click()`, and a control wired to `mdClick` alone looks completely inert to
 * it while working perfectly for a person. That asymmetry is exactly the kind
 * of thing a test suite exists to rule out, so the build takes the event both
 * can raise.
 */
export function enhanceTransport(root = document) {
  const bar = root.querySelector('.transport:not([data-bound])');
  if (!bar) return null;
  bar.setAttribute('data-bound', '');

  const queue = (bar.getAttribute('data-queue') ?? '').split(',').filter(Boolean);
  let state = load(queue);

  const play = bar.querySelector('.transport__play');
  const slider = bar.querySelector('.transport__slider');
  const elapsed = bar.querySelector('.transport__elapsed');
  const total = bar.querySelector('.transport__duration');
  const title = bar.querySelector('.transport__title');
  const artist = bar.querySelector('.transport__artist');
  const repeat = bar.querySelector('.transport__repeat');
  const shuffle = bar.querySelector('.transport__shuffle');
  const mute = bar.querySelector('.transport__mute');
  const volume = bar.querySelector('.transport__volume');

  /*
   * WHAT THE ROWS ON THIS PAGE KNOW. Each track row carries its own title, its
   * artist and its duration, so switching tracks needs no dictionary and no
   * fixture — the markup already says everything the bar has to show.
   */
  /*
   * WHAT THE BAR CAN NAME: every track listed on this page, PLUS every track in
   * the queue. The queue's labels come out of the template the build wrote —
   * without them, skipping to a track the page does not list left the title
   * unchanged and the bar silently lied about what was playing.
   */
  const rows = new Map();
  const remember = (el) => {
    const id = el.getAttribute('data-track');
    if (!id) return;
    rows.set(id, {
      title: el.getAttribute('data-title') ?? '',
      artist: el.getAttribute('data-artist') ?? '',
      seconds: Number(el.getAttribute('data-seconds') ?? 0),
      artSrc: el.getAttribute('data-art-src'),
      artAlt: el.getAttribute('data-art-alt'),
    });
  };
  for (const row of document.querySelectorAll('.track-row[data-track]')) remember(row);
  const queueTemplate = bar.querySelector('template.transport__queue');
  if (queueTemplate) {
    for (const entry of queueTemplate.content.querySelectorAll('[data-track]')) remember(entry);
  }
  for (const [id, info] of rows) durations.set(id, info.seconds);

  const durationOf = (id) => durations.get(id) ?? Number(slider?.getAttribute('max') ?? 0);

  function render() {
    const playing = state.state === 'playing';
    play?.setAttribute(
      'icon',
      play.getAttribute(playing ? 'data-icon-pause' : 'data-icon-play') ?? '',
    );
    play?.setAttribute(
      'aria-label',
      play.getAttribute(playing ? 'data-label-pause' : 'data-label-play') ?? '',
    );
    play?.toggleAttribute('data-playing', playing);

    const info = state.trackId ? rows.get(state.trackId) : null;
    if (info && title) title.textContent = info.title;
    if (info && artist) artist.textContent = info.artist;
    const artwork = bar.querySelector('.transport__art');
    if (artwork && info?.artSrc) {
      artwork.setAttribute('src', info.artSrc);
      artwork.setAttribute('alt', info.artAlt ?? '');
    }

    const duration = durationOf(state.trackId);
    if (elapsed) elapsed.textContent = clock(state.positionSec);
    if (total) total.textContent = clock(duration);
    slider?.setAttribute('max', String(Math.max(1, duration)));
    slider?.setAttribute('value', String(state.positionSec));

    repeat?.setAttribute('data-repeat', state.repeat);
    repeat?.setAttribute('icon', repeat.getAttribute(`data-${state.repeat}-icon`) ?? '');
    repeat?.setAttribute('aria-label', repeat.getAttribute(`data-${state.repeat}-label`) ?? '');
    const tone = repeat?.getAttribute(`data-${state.repeat}-tone`);
    if (tone) repeat?.setAttribute('color', tone);
    else repeat?.removeAttribute('color');

    shuffle?.setAttribute('aria-pressed', String(state.shuffle));
    shuffle?.toggleAttribute('data-on', state.shuffle);

    const silent = state.muted || state.volume === 0;
    mute?.setAttribute('icon', silent ? 'volume_off' : 'volume_up');
    mute?.setAttribute('aria-pressed', String(state.muted));
    mute?.setAttribute(
      'aria-label',
      mute.getAttribute(state.muted ? 'data-label-unmute' : 'data-label-mute') ?? '',
    );
    volume?.setAttribute('value', String(Math.round(state.volume * 100)));

    /* The row that is loaded is marked on whatever screen is showing it — the
       same signal the four SPA builds give, arrived at differently. */
    for (const row of document.querySelectorAll('.track-row[data-track]')) {
      row.toggleAttribute('data-current', row.getAttribute('data-track') === state.trackId);
    }
    renderListeningRoom();
    save(state);
  }

  const set = (nextState) => {
    state = nextState;
    render();
    restartTicker();
  };

  /*
   * ONE SECOND AT A TIME, and only while playing — the same rule as the four
   * SPA builds, and gated for the same reason: every build ships paused, and
   * the parity, a11y and CSP checks never press play, so what they compare is
   * 0:00 in all five.
   */
  let ticker = null;
  function restartTicker() {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
    if (state.state !== 'playing' || state.trackId === null) return;
    ticker = setInterval(() => {
      state = tick(state, durationOf(state.trackId));
      render();
    }, 1000);
  }

  const room = root.querySelector('.listening-room');
  const copy = sessionCopy(document.documentElement.lang);
  const number = new Intl.NumberFormat(document.documentElement.lang || 'en');
  let mode = 'for-you';
  const queueList = room?.querySelector('.listening-queue__list');
  const queueTemplateRows = room?.querySelector('.listening-queue__template')?.content;

  function renderListeningRoom() {
    if (!room) return;
    const session = listeningSession(mode);
    const loaded =
      session.tracks.some((track) => track.id === state.trackId) &&
      state.queue.every((id) => session.tracks.some((track) => track.id === id));
    const playing = loaded && state.state === 'playing';
    const start = room.querySelector('.listening-room__play');
    start.textContent = playing ? copy.pause : loaded ? copy.resume : copy.play;
    start.setAttribute('icon', playing ? 'pause' : 'play_arrow');
    room.querySelector('.listening-queue__heading span').textContent =
      `${number.format(state.queue.length)} ${copy.tracks}`;
    for (const row of [...queueList.children])
      if (!state.queue.includes(row.getAttribute('data-track'))) row.remove();
    for (const [index, id] of state.queue.entries()) {
      let row = [...queueList.children].find((item) => item.getAttribute('data-track') === id);
      if (!row)
        row = [...queueTemplateRows.children]
          .find((item) => item.getAttribute('data-track') === id)
          ?.cloneNode(true);
      if (!row) continue;
      if (queueList.children[index] !== row)
        queueList.insertBefore(row, queueList.children[index] ?? null);
      const current = id === state.trackId;
      row.toggleAttribute('data-current', current);
      row.querySelector('[data-queue-remove]').toggleAttribute('disabled', current);
      const button = row.querySelector('[data-queue-play]');
      const paused = !(current && state.state === 'playing');
      button.setAttribute('icon', paused ? 'play_arrow' : 'pause');
      button.setAttribute(
        'aria-label',
        button.getAttribute(paused ? 'data-label-play' : 'data-label-pause'),
      );
    }
  }

  for (const button of room?.querySelectorAll('[data-session-mode]') ?? []) {
    button.addEventListener('click', () => {
      mode = button.getAttribute('data-session-mode');
      const at = SESSION_MODES.indexOf(mode);
      const session = listeningSession(mode);
      for (const option of room.querySelectorAll('[data-session-mode]')) {
        const selected = option === button;
        option.toggleAttribute('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      }
      room.querySelector('.listening-room__session h3').textContent = copy.names[at];
      room.querySelector('.listening-room__session p').textContent = copy.notes[at];
      const facts = room.querySelectorAll('.listening-room__facts span');
      facts[0].textContent = `${number.format(session.tracks.length)} ${copy.tracks}`;
      facts[1].textContent = `${clock(session.duration)} ${copy.duration}`;
      const artwork = [...room.querySelectorAll('[data-session-art]')].find(
        (item) => item.getAttribute('data-session-art') === mode,
      );
      room
        .querySelector('.listening-room__artwork')
        .replaceChildren(artwork.content.cloneNode(true));
      renderListeningRoom();
    });
  }
  room?.querySelector('.listening-room__play')?.addEventListener('click', () => {
    const session = listeningSession(mode);
    const loaded =
      session.tracks.some((track) => track.id === state.trackId) &&
      state.queue.every((id) => session.tracks.some((track) => track.id === id));
    set(loaded ? togglePlay(state) : startSession(state, session.tracks));
  });
  queueList?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-queue-remove]');
    if (remove) {
      set(removeQueuedTrack(state, remove.getAttribute('data-queue-remove')));
      return;
    }
    const play = event.target.closest('[data-queue-play]');
    if (play) {
      const id = play.getAttribute('data-queue-play');
      set(
        state.trackId === id
          ? togglePlay(state)
          : { ...state, trackId: id, state: 'playing', positionSec: 0 },
      );
    }
  });

  play?.addEventListener('click', () => set(togglePlay(state)));
  bar.querySelector('.transport__next')?.addEventListener('click', () => set(next(state)));
  bar.querySelector('.transport__previous')?.addEventListener('click', () => set(previous(state)));
  repeat?.addEventListener('click', () => set(cycleRepeat(state)));
  shuffle?.addEventListener('click', () => set({ ...state, shuffle: !state.shuffle }));
  mute?.addEventListener('click', () => set(toggleMute(state)));

  /* `md-slider`'s `mdInput` detail is `{ value }`, AN OBJECT — while
     `md-text-field`'s detail IS the bare string. */
  const sliderValue = (event) => {
    const raw = event.detail?.value;
    return Number.isFinite(raw) ? Number(raw) : 0;
  };
  slider?.addEventListener('mdInput', (event) =>
    set(seekTo(state, sliderValue(event), durationOf(state.trackId))),
  );
  volume?.addEventListener('mdInput', (event) => set(setVolume(state, sliderValue(event) / 100)));

  /* Every play button in every track list loads that track. */
  for (const button of document.querySelectorAll('[data-play]')) {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-play');
      if (state.trackId === id) {
        set(togglePlay(state));
        return;
      }
      set({ ...state, trackId: id, state: 'playing', positionSec: 0 });
    });
  }

  render();
  restartTicker();
  activeTransport = {
    get state() {
      return state;
    },
    enqueue(id) {
      if (rows.has(id) && !state.queue.includes(id)) set({ ...state, queue: [...state.queue, id] });
    },
  };
  return activeTransport;
}

/** Add to the queue without disturbing the playhead. */
export function enhanceQueueButtons(root = document) {
  for (const button of root.querySelectorAll('.track__queue:not([data-bound])')) {
    button.setAttribute('data-bound', '');
    button.addEventListener('click', () => {
      activeTransport?.enqueue(button.getAttribute('data-enqueue'));
      raise(button.getAttribute('data-msg'));
    });
  }
}
