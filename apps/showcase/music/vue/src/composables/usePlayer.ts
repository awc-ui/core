/**
 * The transport, the mixer and the edit history — a module-level store.
 *
 * THIS IS THE VERTICAL'S REASON FOR EXISTING, and Vue makes it simpler than
 * React does. `App` swaps the screen component on every navigation, so anything
 * a screen owns dies with it; the transport must not. React needs a provider
 * mounted above the router to achieve that. A Vue `reactive()` at module scope
 * is already outside the component tree — it is created once when the module is
 * first imported and every component that reads it re-renders when it changes.
 *
 * A MODULE SINGLETON IS THE RIGHT SHAPE HERE and would be wrong in an app that
 * served two users or ran on a server. This one is a single-page showcase with
 * one reader, and `provide`/`inject` would add a wrapper component whose only
 * job is to hold what a module already holds.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a track, moving a clip,
 * pulling a fader — all of it is overrides on top of what the fixture shipped.
 * A reload is a reset, which keeps every screenshot comparable.
 *
 * NOTHING PLAYS. The playhead advances on a one-second interval that runs only
 * while the state is `playing`; there is no audio and no `<audio>` element. See
 * the note on `tick()` in the kit for why the interval is gated.
 */

import { computed, reactive, readonly, watch } from 'vue';
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

interface State {
  transport: Transport;
  likes: Record<string, boolean>;
  follows: Record<string, boolean>;
  tracks: StudioTrack[];
  clipStarts: Record<string, number>;
  clipSpans: Record<string, number>;
  removed: Record<string, boolean>;
  history: History;
}

const state = reactive<State>({
  transport: initialTransport(getQueue()),
  likes: {},
  follows: {},
  tracks: getStudioTracks().map((track) => ({ ...track })),
  clipStarts: {},
  clipSpans: {},
  removed: {},
  history: emptyHistory,
});

let editSeq = 0;
const nextEditId = () => `edit-${(editSeq += 1)}`;

/*
 * AUDIBILITY IS DERIVED, never stored. Storing it would mean recomputing it in
 * four places — mute, solo and the undo of each — and the first one anybody
 * forgot would leave the mixer showing a track as silent that is not.
 */
const audible = computed(() => audibleTracks(state.tracks));

/*
 * ONE SECOND AT A TIME, and only while playing.
 *
 * A module-level `watch` rather than an `onMounted` in a component: the
 * interval belongs to the store, not to whichever screen happens to be on
 * screen, and a component-owned one would be torn down by the very navigation
 * the transport is supposed to survive.
 */
let ticker: number | null = null;
watch(
  () => [state.transport.state, state.transport.trackId] as const,
  ([playState, trackId]) => {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (playState !== 'playing' || trackId === null) return;
    ticker = window.setInterval(() => {
      const track = state.transport.trackId ? trackById(state.transport.trackId) : null;
      if (track) state.transport = tick(state.transport, track.durationSec);
    }, 1000);
  },
  { immediate: true },
);

/* ------------------------------------------------------------- the store */

export function usePlayer() {
  const patchTrack = (id: string, patch: Partial<StudioTrack>) => {
    const at = state.tracks.findIndex((t) => t.id === id);
    if (at !== -1) state.tracks[at] = { ...state.tracks[at]!, ...patch };
  };

  const push = (edit: Edit) => {
    state.history = record(state.history, edit);
  };

  /**
   * Put an edit's payload back onto whatever it names.
   *
   * ONE FUNCTION FOR BOTH DIRECTIONS. Undo applies the inverted edit and redo
   * applies the original, so there is no second copy of this switch to keep in
   * step — which is where a history usually goes wrong, with redo handling one
   * more case than undo.
   */
  const applyEdit = (edit: Edit) => {
    const value = edit.after;
    if ('startBar' in value) {
      state.clipStarts[edit.targetId] = value.startBar;
      return;
    }
    if ('bars' in value) {
      state.clipSpans[edit.targetId] = value.bars;
      return;
    }
    if ('removed' in value) {
      state.removed[edit.targetId] = value.removed;
      return;
    }
    if ('volume' in value) patchTrack(edit.targetId, { volume: value.volume });
    else if ('pan' in value) patchTrack(edit.targetId, { pan: value.pan });
    else if ('muted' in value) patchTrack(edit.targetId, { muted: value.muted });
    else if ('soloed' in value) patchTrack(edit.targetId, { soloed: value.soloed });
    else if ('name' in value) patchTrack(edit.targetId, { name: value.name });
  };

  return {
    transport: computed(() => state.transport),
    tracks: computed(() => state.tracks),
    history: computed(() => state.history),
    audible,

    /* ---- transport ---- */
    play: (track: Track) => {
      state.transport = playTrack(state.transport, track.id);
    },
    toggle: () => {
      state.transport = togglePlay(state.transport);
    },
    next: () => {
      state.transport = advance(state.transport);
    },
    previous: () => {
      state.transport = goBack(state.transport);
    },
    seek: (seconds: number, durationSec: number) => {
      state.transport = seekTo(state.transport, seconds, durationSec);
    },
    setVolume: (value: number) => {
      state.transport = setTransportVolume(state.transport, value);
    },
    toggleMute: () => {
      state.transport = toggleTransportMute(state.transport);
    },
    cycleRepeat: () => {
      state.transport = cycleRepeatMode(state.transport);
    },
    toggleShuffle: () => {
      state.transport = { ...state.transport, shuffle: !state.transport.shuffle };
    },
    /* An append that must not disturb the playhead — touching `trackId` here is
       how "add to queue" ends up behaving like "play now". */
    enqueue: (track: Track) => {
      if (!state.transport.queue.includes(track.id)) {
        state.transport = { ...state.transport, queue: [...state.transport.queue, track.id] };
      }
    },

    /* ---- listening overrides. `in` rather than `??`, because `false` is a
       legitimate override: un-liking a track the fixture shipped as liked must
       stick. ---- */
    likedFor: (track: Track) => (track.id in state.likes ? state.likes[track.id]! : track.liked),
    toggleLike: (track: Track) => {
      state.likes[track.id] = !(track.id in state.likes ? state.likes[track.id]! : track.liked);
    },
    followedFor: (handle: string, shipped: boolean) =>
      handle in state.follows ? state.follows[handle]! : shipped,
    toggleFollow: (handle: string, shipped: boolean) => {
      state.follows[handle] = !(handle in state.follows ? state.follows[handle]! : shipped);
    },

    /* ---- mixer ---- */
    setTrackVolume: (id: string, value: number) => {
      const before = state.tracks.find((t) => t.id === id)?.volume ?? 0;
      if (before === value) return;
      patchTrack(id, { volume: value });
      push(makeEdit(nextEditId(), 'track.volume', 'music.edit.trackVolume', id, { volume: before }, { volume: value }));
    },
    setTrackPan: (id: string, value: number) => {
      const before = state.tracks.find((t) => t.id === id)?.pan ?? 0;
      if (before === value) return;
      patchTrack(id, { pan: value });
      push(makeEdit(nextEditId(), 'track.pan', 'music.edit.trackPan', id, { pan: before }, { pan: value }));
    },
    toggleTrackMute: (id: string) => {
      const before = state.tracks.find((t) => t.id === id)?.muted ?? false;
      patchTrack(id, { muted: !before });
      push(makeEdit(nextEditId(), 'track.mute', 'music.edit.trackMute', id, { muted: before }, { muted: !before }));
    },
    toggleTrackSolo: (id: string) => {
      const before = state.tracks.find((t) => t.id === id)?.soloed ?? false;
      patchTrack(id, { soloed: !before });
      push(makeEdit(nextEditId(), 'track.solo', 'music.edit.trackSolo', id, { soloed: before }, { soloed: !before }));
    },

    /* ---- clips ---- */
    clipStart: (id: string, shipped: number) =>
      id in state.clipStarts ? state.clipStarts[id]! : shipped,
    clipBars: (id: string, shipped: number) =>
      id in state.clipSpans ? state.clipSpans[id]! : shipped,
    clipRemoved: (id: string) => state.removed[id] === true,
    moveClip: (id: string, shipped: number, startBar: number) => {
      const before = id in state.clipStarts ? state.clipStarts[id]! : shipped;
      if (before === startBar) return;
      state.clipStarts[id] = startBar;
      push(makeEdit(nextEditId(), 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar }));
    },
    resizeClip: (id: string, shipped: number, bars: number) => {
      const before = id in state.clipSpans ? state.clipSpans[id]! : shipped;
      if (before === bars) return;
      state.clipSpans[id] = bars;
      push(makeEdit(nextEditId(), 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars }));
    },
    /* A REMOVED CLIP IS A FLAG, NOT A DELETION. Undo has to bring it back, and
       the fixture is frozen — there would be nothing to splice it back into. */
    removeClip: (id: string) => {
      state.removed[id] = true;
      push(makeEdit(nextEditId(), 'clip.remove', 'music.edit.clipRemove', id, { removed: false }, { removed: true }));
    },
    renameTrack: (id: string, name: string) => {
      const before = state.tracks.find((t) => t.id === id)?.name ?? '';
      if (before === name || name.trim() === '') return;
      patchTrack(id, { name });
      push(makeEdit(nextEditId(), 'track.rename', 'music.edit.trackRename', id, { name: before }, { name }));
    },

    /* ---- history ---- */
    undo: (): Edit | null => {
      const step = undoHistory(state.history);
      state.history = step.history;
      if (step.edit) applyEdit(invertEdit(step.edit));
      return step.edit;
    },
    redo: (): Edit | null => {
      const step = redoHistory(state.history);
      state.history = step.history;
      if (step.edit) applyEdit(step.edit);
      return step.edit;
    },
  };
}

/** Read-only view, for anything that only displays. */
export const playerState = readonly(state);
