/**
 * The transport, the mixer and the edit history — all held above the router.
 *
 * THIS IS THE VERTICAL'S REASON FOR EXISTING. Every other showcase holds its
 * interaction state inside a screen, because nothing in those apps outlives a
 * navigation. Here the transport must: an app that stops playing when you open
 * an album is not a music app, and the whole point of putting the bar in the
 * shell is that it keeps its track, its position and its queue while everything
 * above it is replaced.
 *
 * `App` returns a different component per route, so React unmounts the entire
 * screen subtree on every navigation. State held in `HomeScreen` would be gone
 * the moment a reader followed the album link on the row they just started —
 * which is the first thing anyone tries.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a track, following an artist,
 * moving a clip, pulling a fader — all of it is overrides in this provider on
 * top of what the fixture shipped. A reload is a reset, which keeps the
 * showcase reproducible and every screenshot comparable.
 *
 * THE PLAYHEAD ADVANCES WHILE PLAYING, and there is still no audio anywhere.
 * A one-second interval calls `tick()` in the kit, which owns the end-of-track
 * rules so five builds cannot each invent their own. The interval runs ONLY
 * while the state is `playing`.
 *
 * THAT LAST CLAUSE IS WHAT KEEPS THE STATIC CHECKS HONEST. Every build ships
 * PAUSED at zero, and the parity, a11y and CSP checks never press play — they
 * measure the default state of a screen. So the readout they compare across
 * five builds is `0:00` in all five, and a run of the parity check cannot
 * disagree with itself depending on which build it measured first. A clock that
 * ran unconditionally would make that comparison meaningless, which is why this
 * one is gated rather than unconditional.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
  trackById,
  toggleMute as toggleTransportMute,
  togglePlay,
  undo as undoHistory,
  cycleRepeat,
  type Edit,
  type History,
  type StudioTrack,
  type Track,
  type Transport,
} from '@awc-ui/showcase-kit/music';

interface PlayerState {
  /* ---- transport ---- */
  transport: Transport;
  play(track: Track): void;
  toggle(): void;
  next(): void;
  previous(): void;
  seek(seconds: number, durationSec: number): void;
  setVolume(value: number): void;
  toggleMute(): void;
  cycleRepeat(): void;
  toggleShuffle(): void;
  enqueue(track: Track): void;

  /* ---- listening overrides ---- */
  likedFor(track: Track): boolean;
  toggleLike(track: Track): void;
  followedFor(handle: string, shipped: boolean): boolean;
  toggleFollow(handle: string, shipped: boolean): void;

  /* ---- the mixer ---- */
  tracks: readonly StudioTrack[];
  audible: ReadonlySet<string>;
  setTrackVolume(id: string, value: number): void;
  setTrackPan(id: string, value: number): void;
  toggleTrackMute(id: string): void;
  toggleTrackSolo(id: string): void;

  /* ---- clips ---- */
  clipStart(id: string, shipped: number): number;
  clipBars(id: string, shipped: number): number;
  clipRemoved(id: string): boolean;
  moveClip(id: string, shipped: number, startBar: number): void;
  resizeClip(id: string, shipped: number, bars: number): void;
  removeClip(id: string, labelKey: string): void;
  renameTrack(id: string, name: string): void;

  /* ---- history ---- */
  history: History;
  undo(): Edit | null;
  redo(): Edit | null;
}

const PlayerContext = createContext<PlayerState | null>(null);

/** Each edit needs an id, and a counter is enough — nothing persists. */
let editSeq = 0;
const nextEditId = () => `edit-${(editSeq += 1)}`;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [transport, setTransport] = useState<Transport>(() => initialTransport(getQueue()));
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [tracks, setTracks] = useState<readonly StudioTrack[]>(() => getStudioTracks());
  const [clipStarts, setClipStarts] = useState<Record<string, number>>({});
  const [clipSpans, setClipSpans] = useState<Record<string, number>>({});
  /* A REMOVED CLIP IS A FLAG, NOT A DELETION. Undo has to bring it back, and a
     clip spliced out of the fixture is gone for good — the fixture is frozen
     and there is nothing to splice it back into. */
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<History>(emptyHistory);

  /*
   * AUDIBILITY IS DERIVED ON EVERY RENDER, never stored.
   *
   * Storing it would mean recomputing it in four places — mute, solo, and the
   * undo of each — and the first one anybody forgot would leave the mixer
   * showing a track as silent that is not. It is a pure function of the array;
   * `useMemo` is here for the strips' sake, not for correctness.
   */
  const audible = useMemo(() => audibleTracks(tracks), [tracks]);

  /*
   * ONE SECOND AT A TIME, and only while playing.
   *
   * The dependency is the STATE and the TRACK, not the position: depending on
   * `positionSec` would tear down and rebuild the interval on every tick, which
   * makes the first second after each tick a fresh full second and the clock
   * runs slow. The functional update inside reads the current transport, so the
   * effect does not need it.
   */
  useEffect(() => {
    if (transport.state !== 'playing' || transport.trackId === null) return;
    const id = window.setInterval(() => {
      setTransport((current) => {
        const track = current.trackId ? trackById(current.trackId) : null;
        return track ? tick(current, track.durationSec) : current;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [transport.state, transport.trackId]);

  /* ---------------------------------------------------------- transport */

  const play = useCallback((track: Track) => {
    setTransport((t) => playTrack(t, track.id));
  }, []);

  const toggle = useCallback(() => setTransport(togglePlay), []);
  const next = useCallback(() => setTransport(advance), []);
  const previous = useCallback(() => setTransport(goBack), []);

  const seek = useCallback((seconds: number, durationSec: number) => {
    setTransport((t) => seekTo(t, seconds, durationSec));
  }, []);

  const setVolume = useCallback((value: number) => {
    setTransport((t) => setTransportVolume(t, value));
  }, []);

  const toggleMute = useCallback(() => setTransport(toggleTransportMute), []);
  const cycleRepeatMode = useCallback(() => setTransport(cycleRepeat), []);
  const toggleShuffle = useCallback(
    () => setTransport((t) => ({ ...t, shuffle: !t.shuffle })),
    [],
  );

  /*
   * ADDING TO THE QUEUE IS AN APPEND, and it must not disturb the playhead.
   * Rebuilding the queue array with the new track in it would be fine; what
   * would not is touching `trackId` or `positionSec`, which is how "add to
   * queue" ends up behaving like "play now" in half the implementations.
   */
  const enqueue = useCallback((track: Track) => {
    setTransport((t) =>
      t.queue.includes(track.id) ? t : { ...t, queue: [...t.queue, track.id] },
    );
  }, []);

  /* ------------------------------------------------- listening overrides */

  /* `in` rather than `??`, because `false` is a legitimate override: a reader
     un-liking a track the fixture shipped as liked must stick. */
  const likedFor = useCallback(
    (track: Track) => (track.id in likes ? likes[track.id]! : track.liked),
    [likes],
  );

  const toggleLike = useCallback((track: Track) => {
    setLikes((current) => ({
      ...current,
      [track.id]: !(track.id in current ? current[track.id]! : track.liked),
    }));
  }, []);

  const followedFor = useCallback(
    (handle: string, shipped: boolean) => (handle in follows ? follows[handle]! : shipped),
    [follows],
  );

  const toggleFollow = useCallback((handle: string, shipped: boolean) => {
    setFollows((current) => ({
      ...current,
      [handle]: !(handle in current ? current[handle]! : shipped),
    }));
  }, []);

  /* ------------------------------------------------------------- mixer */

  /*
   * EVERY MIXER CHANGE RECORDS AN EDIT, which is what makes undo work across
   * the mixer and the timeline with one stack. The edit carries both ends of
   * the change, so undoing it is applying `before` — see `applyEdit` below.
   */
  const patchTrack = useCallback(
    (id: string, patch: Partial<StudioTrack>) => {
      setTracks((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [],
  );

  const setTrackVolume = useCallback(
    (id: string, value: number) => {
      const before = tracks.find((t) => t.id === id)?.volume ?? 0;
      patchTrack(id, { volume: value });
      setHistory((h) =>
        record(
          h,
          makeEdit(nextEditId(), 'track.volume', 'music.edit.trackVolume', id, { volume: before }, { volume: value }),
        ),
      );
    },
    [patchTrack, tracks],
  );

  const setTrackPan = useCallback(
    (id: string, value: number) => {
      const before = tracks.find((t) => t.id === id)?.pan ?? 0;
      patchTrack(id, { pan: value });
      setHistory((h) =>
        record(h, makeEdit(nextEditId(), 'track.pan', 'music.edit.trackPan', id, { pan: before }, { pan: value })),
      );
    },
    [patchTrack, tracks],
  );

  const toggleTrackMute = useCallback(
    (id: string) => {
      const before = tracks.find((t) => t.id === id)?.muted ?? false;
      patchTrack(id, { muted: !before });
      setHistory((h) =>
        record(h, makeEdit(nextEditId(), 'track.mute', 'music.edit.trackMute', id, { muted: before }, { muted: !before })),
      );
    },
    [patchTrack, tracks],
  );

  const toggleTrackSolo = useCallback(
    (id: string) => {
      const before = tracks.find((t) => t.id === id)?.soloed ?? false;
      patchTrack(id, { soloed: !before });
      setHistory((h) =>
        record(h, makeEdit(nextEditId(), 'track.solo', 'music.edit.trackSolo', id, { soloed: before }, { soloed: !before })),
      );
    },
    [patchTrack, tracks],
  );

  /* -------------------------------------------------------------- clips */

  const clipStart = useCallback(
    (id: string, shipped: number) => (id in clipStarts ? clipStarts[id]! : shipped),
    [clipStarts],
  );

  const clipBars = useCallback(
    (id: string, shipped: number) => (id in clipSpans ? clipSpans[id]! : shipped),
    [clipSpans],
  );

  const clipRemoved = useCallback((id: string) => removed[id] === true, [removed]);

  const moveClip = useCallback(
    (id: string, shipped: number, startBar: number) => {
      const before = id in clipStarts ? clipStarts[id]! : shipped;
      if (before === startBar) return;
      setClipStarts((current) => ({ ...current, [id]: startBar }));
      setHistory((h) =>
        record(
          h,
          makeEdit(nextEditId(), 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar }),
        ),
      );
    },
    [clipStarts],
  );

  const resizeClip = useCallback(
    (id: string, shipped: number, bars: number) => {
      const before = id in clipSpans ? clipSpans[id]! : shipped;
      if (before === bars) return;
      setClipSpans((current) => ({ ...current, [id]: bars }));
      setHistory((h) =>
        record(h, makeEdit(nextEditId(), 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars })),
      );
    },
    [clipSpans],
  );

  const removeClip = useCallback((id: string) => {
    setRemoved((current) => ({ ...current, [id]: true }));
    setHistory((h) =>
      record(
        h,
        makeEdit(nextEditId(), 'clip.remove', 'music.edit.clipRemove', id, { removed: false }, { removed: true }),
      ),
    );
  }, []);

  const renameTrack = useCallback(
    (id: string, name: string) => {
      const before = tracks.find((t) => t.id === id)?.name ?? '';
      if (before === name || name.trim() === '') return;
      patchTrack(id, { name });
      setHistory((h) =>
        record(h, makeEdit(nextEditId(), 'track.rename', 'music.edit.trackRename', id, { name: before }, { name })),
      );
    },
    [patchTrack, tracks],
  );

  /* ------------------------------------------------------------ history */

  /**
   * Put an edit's payload back onto whatever it names.
   *
   * ONE FUNCTION FOR BOTH DIRECTIONS. Undo applies the inverted edit and redo
   * applies the original, so there is no second copy of this switch to keep in
   * step — which is where a history usually goes wrong, with redo handling one
   * more case than undo.
   */
  const applyEdit = useCallback((edit: Edit) => {
    const value = edit.after;
    if ('startBar' in value) {
      setClipStarts((current) => ({ ...current, [edit.targetId]: value.startBar }));
      return;
    }
    if ('bars' in value) {
      setClipSpans((current) => ({ ...current, [edit.targetId]: value.bars }));
      return;
    }
    if ('removed' in value) {
      setRemoved((current) => ({ ...current, [edit.targetId]: value.removed }));
      return;
    }
    setTracks((current) =>
      current.map((t) => {
        if (t.id !== edit.targetId) return t;
        if ('volume' in value) return { ...t, volume: value.volume };
        if ('pan' in value) return { ...t, pan: value.pan };
        if ('muted' in value) return { ...t, muted: value.muted };
        if ('soloed' in value) return { ...t, soloed: value.soloed };
        if ('name' in value) return { ...t, name: value.name };
        return t;
      }),
    );
  }, []);

  const undo = useCallback(() => {
    let undone: Edit | null = null;
    setHistory((h) => {
      const step = undoHistory(h);
      undone = step.edit;
      if (step.edit) applyEdit(invertEdit(step.edit));
      return step.history;
    });
    return undone;
  }, [applyEdit]);

  const redo = useCallback(() => {
    let redone: Edit | null = null;
    setHistory((h) => {
      const step = redoHistory(h);
      redone = step.edit;
      if (step.edit) applyEdit(step.edit);
      return step.history;
    });
    return redone;
  }, [applyEdit]);

  const value = useMemo<PlayerState>(
    () => ({
      transport,
      play,
      toggle,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      cycleRepeat: cycleRepeatMode,
      toggleShuffle,
      enqueue,
      likedFor,
      toggleLike,
      followedFor,
      toggleFollow,
      tracks,
      audible,
      setTrackVolume,
      setTrackPan,
      toggleTrackMute,
      toggleTrackSolo,
      clipStart,
      clipBars,
      clipRemoved,
      moveClip,
      resizeClip,
      removeClip,
      renameTrack,
      history,
      undo,
      redo,
    }),
    [
      transport, play, toggle, next, previous, seek, setVolume, toggleMute, cycleRepeatMode,
      toggleShuffle, enqueue, likedFor, toggleLike, followedFor, toggleFollow, tracks, audible,
      setTrackVolume, setTrackPan, toggleTrackMute, toggleTrackSolo, clipStart, clipBars,
      clipRemoved, moveClip, resizeClip, removeClip, renameTrack, history, undo, redo,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/** Every screen reads the player through this. Throws rather than returning a
    silent default, because a screen outside the provider is a wiring bug. */
export function usePlayer(): PlayerState {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer() outside <PlayerProvider>');
  return value;
}
