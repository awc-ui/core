/**
 * The transport, the mixer and the edit history — a module-level store.
 *
 * THIS IS THE VERTICAL'S REASON FOR EXISTING. `App` swaps the screen component
 * on every navigation, so anything a screen owns dies with it; the transport
 * must not. A Svelte store at module scope lives outside the component tree —
 * created once when the module is first imported, and every component that
 * subscribes re-renders when it changes.
 *
 * ONE STORE, NOT SEVEN. The obvious shape is a store per concern, and it is
 * wrong here: the mixer's audibility is derived from the whole track array, and
 * an edit has to move the history AND the thing it edits in one step. Separate
 * stores would make that two subscriptions that can be observed half-applied.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Everything here is overrides on top
 * of what the fixture shipped; a reload is a reset.
 *
 * NOTHING PLAYS. The playhead advances on a one-second interval that runs only
 * while the state is `playing`, and there is no audio.
 */

import { derived, get, writable } from 'svelte/store';
import {
  audibleTracks,
  emptyHistory,
  getQueue,
  getStudioTracks,
  initialTransport,
  invertEdit,
  makeEdit,
  next as advance,
  playTrack,
  previous as goBack,
  record,
  redo as redoHistory,
  seekTo,
  setVolume as setTransportVolume,
  tick,
  toggleMute as toggleTransportMute,
  togglePlay,
  trackById,
  undo as undoHistory,
  cycleRepeat as cycleRepeatMode,
  type Edit,
  type History,
  type StudioTrack,
  type Track,
  type Transport,
} from '@awc-ui/showcase-kit/music';

export interface PlayerState {
  transport: Transport;
  likes: Record<string, boolean>;
  follows: Record<string, boolean>;
  tracks: StudioTrack[];
  clipStarts: Record<string, number>;
  clipSpans: Record<string, number>;
  removed: Record<string, boolean>;
  history: History;
}

export const player = writable<PlayerState>({
  transport: initialTransport(getQueue()),
  likes: {},
  follows: {},
  tracks: getStudioTracks().map((track) => ({ ...track })),
  clipStarts: {},
  clipSpans: {},
  removed: {},
  history: emptyHistory,
});

/*
 * AUDIBILITY IS DERIVED, never stored. Storing it would mean recomputing it in
 * four places — mute, solo and the undo of each — and the first one anybody
 * forgot would leave the mixer showing a track as silent that is not.
 */
export const audible = derived(player, ($p) => audibleTracks($p.tracks));

let editSeq = 0;
const nextEditId = () => `edit-${(editSeq += 1)}`;

const update = (fn: (s: PlayerState) => PlayerState) => player.update(fn);
const push = (s: PlayerState, edit: Edit): PlayerState => ({ ...s, history: record(s.history, edit) });

const patchTrack = (s: PlayerState, id: string, patch: Partial<StudioTrack>): PlayerState => ({
  ...s,
  tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

/*
 * ONE SECOND AT A TIME, and only while playing.
 *
 * A module-level subscription rather than an `onMount` in a component: the
 * interval belongs to the store, not to whichever screen is on screen, and a
 * component-owned one would be torn down by the very navigation the transport
 * is supposed to survive.
 */
let ticker: number | null = null;
let lastKey = '';
player.subscribe(($p) => {
  const key = `${$p.transport.state}:${$p.transport.trackId ?? ''}`;
  if (key === lastKey) return;
  lastKey = key;
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
  if ($p.transport.state !== 'playing' || $p.transport.trackId === null) return;
  ticker = setInterval(() => {
    const current = get(player);
    const track = current.transport.trackId ? trackById(current.transport.trackId) : null;
    if (track) player.update((s) => ({ ...s, transport: tick(s.transport, track.durationSec) }));
  }, 1000) as unknown as number;
});

/* ---------------------------------------------------------------- actions */

export const play = (track: Track) =>
  update((s) => ({ ...s, transport: playTrack(s.transport, track.id) }));
export const toggle = () => update((s) => ({ ...s, transport: togglePlay(s.transport) }));
export const next = () => update((s) => ({ ...s, transport: advance(s.transport) }));
export const previous = () => update((s) => ({ ...s, transport: goBack(s.transport) }));
export const seek = (seconds: number, durationSec: number) =>
  update((s) => ({ ...s, transport: seekTo(s.transport, seconds, durationSec) }));
export const setVolume = (value: number) =>
  update((s) => ({ ...s, transport: setTransportVolume(s.transport, value) }));
export const toggleMute = () =>
  update((s) => ({ ...s, transport: toggleTransportMute(s.transport) }));
export const cycleRepeat = () =>
  update((s) => ({ ...s, transport: cycleRepeatMode(s.transport) }));
export const toggleShuffle = () =>
  update((s) => ({ ...s, transport: { ...s.transport, shuffle: !s.transport.shuffle } }));

/* An append that must not disturb the playhead — touching `trackId` here is how
   "add to queue" ends up behaving like "play now". */
export const enqueue = (track: Track) =>
  update((s) =>
    s.transport.queue.includes(track.id)
      ? s
      : { ...s, transport: { ...s.transport, queue: [...s.transport.queue, track.id] } },
  );

/* `in` rather than `??`, because `false` is a legitimate override: un-liking a
   track the fixture shipped as liked must stick. */
export const likedFor = (s: PlayerState, track: Track) =>
  track.id in s.likes ? s.likes[track.id]! : track.liked;
export const toggleLike = (track: Track) =>
  update((s) => ({
    ...s,
    likes: { ...s.likes, [track.id]: !likedFor(s, track) },
  }));

export const followedFor = (s: PlayerState, handle: string, shipped: boolean) =>
  handle in s.follows ? s.follows[handle]! : shipped;
export const toggleFollow = (handle: string, shipped: boolean) =>
  update((s) => ({
    ...s,
    follows: { ...s.follows, [handle]: !followedFor(s, handle, shipped) },
  }));

export const setTrackVolume = (id: string, value: number) =>
  update((s) => {
    const before = s.tracks.find((t) => t.id === id)?.volume ?? 0;
    if (before === value) return s;
    return push(patchTrack(s, id, { volume: value }),
      makeEdit(nextEditId(), 'track.volume', 'music.edit.trackVolume', id, { volume: before }, { volume: value }));
  });

export const setTrackPan = (id: string, value: number) =>
  update((s) => {
    const before = s.tracks.find((t) => t.id === id)?.pan ?? 0;
    if (before === value) return s;
    return push(patchTrack(s, id, { pan: value }),
      makeEdit(nextEditId(), 'track.pan', 'music.edit.trackPan', id, { pan: before }, { pan: value }));
  });

export const toggleTrackMute = (id: string) =>
  update((s) => {
    const before = s.tracks.find((t) => t.id === id)?.muted ?? false;
    return push(patchTrack(s, id, { muted: !before }),
      makeEdit(nextEditId(), 'track.mute', 'music.edit.trackMute', id, { muted: before }, { muted: !before }));
  });

export const toggleTrackSolo = (id: string) =>
  update((s) => {
    const before = s.tracks.find((t) => t.id === id)?.soloed ?? false;
    return push(patchTrack(s, id, { soloed: !before }),
      makeEdit(nextEditId(), 'track.solo', 'music.edit.trackSolo', id, { soloed: before }, { soloed: !before }));
  });

export const clipStart = (s: PlayerState, id: string, shipped: number) =>
  id in s.clipStarts ? s.clipStarts[id]! : shipped;
export const clipBars = (s: PlayerState, id: string, shipped: number) =>
  id in s.clipSpans ? s.clipSpans[id]! : shipped;
export const clipRemoved = (s: PlayerState, id: string) => s.removed[id] === true;

export const moveClip = (id: string, shipped: number, startBar: number) =>
  update((s) => {
    const before = clipStart(s, id, shipped);
    if (before === startBar) return s;
    return push({ ...s, clipStarts: { ...s.clipStarts, [id]: startBar } },
      makeEdit(nextEditId(), 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar }));
  });

export const resizeClip = (id: string, shipped: number, bars: number) =>
  update((s) => {
    const before = clipBars(s, id, shipped);
    if (before === bars) return s;
    return push({ ...s, clipSpans: { ...s.clipSpans, [id]: bars } },
      makeEdit(nextEditId(), 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars }));
  });

/* A REMOVED CLIP IS A FLAG, NOT A DELETION. Undo has to bring it back, and the
   fixture is frozen — there would be nothing to splice it back into. */
export const removeClip = (id: string) =>
  update((s) =>
    push({ ...s, removed: { ...s.removed, [id]: true } },
      makeEdit(nextEditId(), 'clip.remove', 'music.edit.clipRemove', id, { removed: false }, { removed: true })),
  );

export const renameTrack = (id: string, name: string) =>
  update((s) => {
    const before = s.tracks.find((t) => t.id === id)?.name ?? '';
    if (before === name || name.trim() === '') return s;
    return push(patchTrack(s, id, { name }),
      makeEdit(nextEditId(), 'track.rename', 'music.edit.trackRename', id, { name: before }, { name }));
  });

/**
 * Put an edit's payload back onto whatever it names.
 *
 * ONE FUNCTION FOR BOTH DIRECTIONS. Undo applies the inverted edit and redo
 * applies the original, so there is no second copy of this switch to keep in
 * step — which is where a history usually goes wrong, with redo handling one
 * more case than undo.
 */
function applyEdit(s: PlayerState, edit: Edit): PlayerState {
  const value = edit.after;
  if ('startBar' in value) return { ...s, clipStarts: { ...s.clipStarts, [edit.targetId]: value.startBar } };
  if ('bars' in value) return { ...s, clipSpans: { ...s.clipSpans, [edit.targetId]: value.bars } };
  if ('removed' in value) return { ...s, removed: { ...s.removed, [edit.targetId]: value.removed } };
  if ('volume' in value) return patchTrack(s, edit.targetId, { volume: value.volume });
  if ('pan' in value) return patchTrack(s, edit.targetId, { pan: value.pan });
  if ('muted' in value) return patchTrack(s, edit.targetId, { muted: value.muted });
  if ('soloed' in value) return patchTrack(s, edit.targetId, { soloed: value.soloed });
  if ('name' in value) return patchTrack(s, edit.targetId, { name: value.name });
  return s;
}

export function undo(): Edit | null {
  let done: Edit | null = null;
  update((s) => {
    const step = undoHistory(s.history);
    done = step.edit;
    if (!step.edit) return s;
    return { ...applyEdit(s, invertEdit(step.edit)), history: step.history };
  });
  return done;
}

export function redo(): Edit | null {
  let done: Edit | null = null;
  update((s) => {
    const step = redoHistory(s.history);
    done = step.edit;
    if (!step.edit) return s;
    return { ...applyEdit(s, step.edit), history: step.history };
  });
  return done;
}
