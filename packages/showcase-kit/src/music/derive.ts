/**
 * Everything computed rather than stored, in one place.
 *
 * THIS FILE EXISTS BECAUSE FIVE BUILDS MUST AGREE. A selector reads the
 * fixture; these functions decide things — where a clip sits, which tracks you
 * can hear, what undo does next. Every one of them was a candidate for being
 * re-implemented in React, Vue, Svelte, Angular and plain JavaScript, and the
 * four demands this vertical was built around are all here for that reason.
 *
 * The rule the whole vertical follows: NOTHING HERE READS A CLOCK, and nothing
 * here mutates. Every function takes state and returns new state, so the same
 * inputs give the same output in a browser, in a test and in a static build.
 */

import { REPEAT_ORDER } from './status';
import { BEATS_PER_BAR, HISTORY_LIMIT, MAX_BARS, SECONDS_PER_BAR } from './types';
import type {
  Clip,
  Edit,
  EditKind,
  EditValue,
  PlayState,
  RepeatMode,
  StudioTrack,
  Track,
} from './types';

/* =========================================================== 1. TRANSPORT */

/**
 * What the transport is doing and what it is doing it to.
 *
 * THE ONE PIECE OF STATE THAT OUTLIVES A NAVIGATION. Every build holds exactly
 * this shape above its router, and the plain-HTML build — which has no memory
 * between pages at all — writes it into `sessionStorage` and reads it back on
 * load. That is the honest port: a static site genuinely cannot keep a variable
 * across a page load, so it persists one instead of pretending.
 */
export interface Transport {
  readonly trackId: string | null;
  readonly state: PlayState;
  /** Whole seconds into the current track. Never a float; see `seekTo`. */
  readonly positionSec: number;
  /** 0..1. */
  readonly volume: number;
  readonly muted: boolean;
  readonly repeat: RepeatMode;
  readonly shuffle: boolean;
  /** Track ids, in play order. The current track is somewhere inside it. */
  readonly queue: readonly string[];
}

export const initialTransport = (queue: readonly string[]): Transport => ({
  trackId: queue[0] ?? null,
  state: 'paused',
  positionSec: 0,
  volume: 0.8,
  muted: false,
  repeat: 'off',
  shuffle: false,
  queue,
});

/**
 * Press play/pause.
 *
 * `stopped` and `paused` both start playing, and the difference between them is
 * only that `stopped` also means the playhead is at zero. Collapsing them into
 * one state would lose the distinction between "paused three minutes in" and
 * "not started", which is what the transport's readout shows.
 */
export const togglePlay = (t: Transport): Transport =>
  t.trackId === null ? t : { ...t, state: t.state === 'playing' ? 'paused' : 'playing' };

/**
 * Move the playhead.
 *
 * CLAMPED AT BOTH ENDS AND ROUNDED TO A WHOLE SECOND. The rounding is not
 * fussiness: the readout is mm:ss and the scrubber is an `md-slider` whose step
 * is 1, so a fractional position would render one way in the label and another
 * in the control. Clamping matters because a slider's max is the track's
 * duration and a keyboard End press can land exactly on it.
 */
export const seekTo = (t: Transport, seconds: number, durationSec: number): Transport => ({
  ...t,
  positionSec: Math.max(0, Math.min(durationSec, Math.round(seconds))),
});

/**
 * Load a track and start it.
 *
 * THE POSITION RESETS AND THE STATE BECOMES `playing`, which is what pressing a
 * row in a track list means. Keeping the old position would put the playhead
 * three minutes into a two-minute track — the bug that shows up as a scrubber
 * pinned to the far right on every short track after a long one.
 */
export const playTrack = (t: Transport, trackId: string): Transport => ({
  ...t,
  trackId,
  state: 'playing',
  positionSec: 0,
});

/** Where the current track sits in the queue, or -1. */
export const queueIndex = (t: Transport): number =>
  t.trackId === null ? -1 : t.queue.indexOf(t.trackId);

/**
 * The next track, honouring repeat — or `null` when the queue is finished.
 *
 * REPEAT `one` DOES NOT APPLY TO A DELIBERATE SKIP. Pressing Next with the
 * track set to repeat has to advance, or the button appears broken; `one` is a
 * rule about what happens when a track ENDS, and nothing here ends. That
 * distinction is why `advance` takes an `explicit` flag rather than being two
 * functions that would drift apart.
 */
export function nextTrackId(t: Transport, explicit: boolean): string | null {
  const at = queueIndex(t);
  if (at === -1) return t.queue[0] ?? null;
  if (t.repeat === 'one' && !explicit) return t.trackId;
  const following = at + 1;
  if (following < t.queue.length) return t.queue[following] ?? null;
  return t.repeat === 'all' ? (t.queue[0] ?? null) : null;
}

/**
 * The previous track — or a rewind to the start of this one.
 *
 * THE THREE-SECOND RULE, which every media player implements and no
 * specification mentions: pressing Previous more than a few seconds into a
 * track restarts THAT track rather than going back. Readers rely on it without
 * knowing it is there, and its absence reads as a skip button that overshoots.
 */
export const PREVIOUS_RESTART_SEC = 3;

export function previous(t: Transport): Transport {
  if (t.trackId === null) return t;
  if (t.positionSec > PREVIOUS_RESTART_SEC) return { ...t, positionSec: 0 };
  const at = queueIndex(t);
  if (at <= 0) {
    return t.repeat === 'all' && t.queue.length > 0
      ? { ...t, trackId: t.queue[t.queue.length - 1] ?? null, positionSec: 0 }
      : { ...t, positionSec: 0 };
  }
  return { ...t, trackId: t.queue[at - 1] ?? null, positionSec: 0 };
}

export function next(t: Transport): Transport {
  const id = nextTrackId(t, true);
  if (id === null) return { ...t, state: 'paused', positionSec: 0 };
  return { ...t, trackId: id, positionSec: 0 };
}

/**
 * One second of playback.
 *
 * THE ONLY THING IN THIS VERTICAL THAT MOVES ON ITS OWN, and it is called by a
 * timer in each build rather than reading a clock itself — so it stays a pure
 * function of its arguments and five builds share the end-of-track rules
 * instead of each inventing them.
 *
 * WHAT HAPPENS AT THE END is the part worth writing once:
 *
 *   - `repeat: one` restarts the SAME track. This is the natural end, which is
 *     the case that mode is actually about — a deliberate Next still advances,
 *     which is why `nextTrackId` takes an `explicit` flag.
 *   - Otherwise the queue advances, honouring `repeat: all` at the end.
 *   - With nothing left it PAUSES at zero rather than sitting at the duration
 *     with a full scrubber, which reads as a stuck player.
 *
 * A PAUSED TRANSPORT IS RETURNED UNCHANGED — identity-unchanged, so a build
 * that calls this on a paused transport does not re-render for nothing.
 *
 * The static checks are safe because of this: every build ships PAUSED, the
 * parity and a11y checks never press play, and so the readout they compare is
 * `0:00` in all five.
 */
export function tick(t: Transport, durationSec: number): Transport {
  if (t.state !== 'playing' || t.trackId === null) return t;

  const next = t.positionSec + 1;
  if (next < durationSec) return { ...t, positionSec: next };

  if (t.repeat === 'one') return { ...t, positionSec: 0 };

  const following = nextTrackId(t, false);
  if (following === null || following === t.trackId) {
    return { ...t, state: 'paused', positionSec: 0 };
  }
  return { ...t, trackId: following, positionSec: 0 };
}

/** Cycle off → all → one → off. The order is `REPEAT_ORDER`. */
export const cycleRepeat = (t: Transport): Transport => ({
  ...t,
  repeat: REPEAT_ORDER[(REPEAT_ORDER.indexOf(t.repeat) + 1) % REPEAT_ORDER.length] ?? 'off',
});

/**
 * Set the volume, and un-mute as a side effect when it is raised off zero.
 *
 * MOVING A FADER MEANS YOU WANT TO HEAR IT. Leaving `muted` set while the
 * reader drags the volume up produces a control that visibly moves and changes
 * nothing, which is the most confusing possible outcome for a slider.
 */
export const setVolume = (t: Transport, volume: number): Transport => {
  const next = Math.max(0, Math.min(1, volume));
  return { ...t, volume: next, muted: next === 0 ? t.muted : false };
};

export const toggleMute = (t: Transport): Transport => ({ ...t, muted: !t.muted });

/** What the reader actually hears: zero when muted, whatever the fader says otherwise. */
export const effectiveVolume = (t: Transport): number => (t.muted ? 0 : t.volume);

/** The queue from the current track onward, excluding it. */
export function upNext(t: Transport, limit = 5): readonly string[] {
  const at = queueIndex(t);
  if (at === -1) return t.queue.slice(0, limit);
  return t.queue.slice(at + 1, at + 1 + limit);
}

/* ============================================================ 2. TIMELINE */

/** Seconds → bars, at the fixed grid this vertical uses. */
export const secondsToBars = (seconds: number): number => seconds / SECONDS_PER_BAR;

/** Bars → seconds. */
export const barsToSeconds = (bars: number): number => bars * SECONDS_PER_BAR;

/**
 * Where a clip sits, as the two data attributes the stylesheet reads.
 *
 * THIS IS THE WHOLE LAYOUT ENGINE, and it returns integers rather than pixels
 * on purpose. The deployed policy is `style-src-attr 'none'`, so no element may
 * carry a `style` attribute and a clip cannot be placed by computing a left
 * offset. Instead the lane is a CSS grid with one column per bar, and a clip
 * declares which column it starts in and how many it spans; `app.css` has a
 * rule per column and does the arithmetic in the stylesheet, where the policy
 * permits it.
 *
 * The consequence is that five builds cannot place a clip differently, because
 * none of them is placing it at all — they are writing two numbers.
 *
 * Both are CLAMPED to the grid the stylesheet actually has rules for. A clip
 * that started at bar 400 would otherwise silently collapse to the first
 * column, which looks like a data error rather than a missing rule.
 */
export interface ClipPlacement {
  readonly startBar: number;
  readonly bars: number;
  /** The last bar the clip covers, for the "does it fit" check below. */
  readonly endBar: number;
}

export function placeClip(clip: Clip, projectBars: number): ClipPlacement {
  const limit = Math.min(projectBars, MAX_BARS);
  const startBar = Math.max(1, Math.min(limit, Math.round(clip.startBar)));
  const bars = Math.max(1, Math.min(limit - startBar + 1, Math.round(clip.bars)));
  return { startBar, bars, endBar: startBar + bars - 1 };
}

/**
 * Would a clip fit here?
 *
 * TWO RULES, AND THE SECOND IS THE ONE THAT MATTERS. It has to stay inside the
 * grid, and it may not overlap another clip on the same lane — because two
 * clips in the same grid columns render ON TOP OF each other. In a pixel
 * timeline an overlap is ugly; here it is a clip that has vanished, and the
 * only way to get it back is to move the one now covering it.
 *
 * A DRAG THAT WOULD OVERLAP IS REFUSED RATHER THAN CLAMPED. Clamping to the
 * nearest legal bar sounds friendlier and is worse: the clip stops following
 * the pointer and settles somewhere the reader did not aim for, which reads as
 * the drag having broken. Refusing leaves it where it was, which reads as an
 * edge.
 *
 * `self` is excluded so a clip may always be dropped back where it started.
 */
export function clipFits(
  lane: readonly { id: string; startBar: number; bars: number }[],
  self: string,
  startBar: number,
  bars: number,
  projectBars: number,
): boolean {
  if (startBar < 1 || bars < 1) return false;
  if (startBar + bars - 1 > Math.min(projectBars, MAX_BARS)) return false;
  const end = startBar + bars - 1;
  return !lane.some((other) => {
    if (other.id === self) return false;
    const otherEnd = other.startBar + other.bars - 1;
    return startBar <= otherEnd && other.startBar <= end;
  });
}

/**
 * How many bars a pointer has travelled.
 *
 * MEASURED FROM THE LANE, never from a table of zoom widths. The stylesheet
 * owns the column width — `--bar` is 12, 24 or 44px by zoom — and a copy of
 * those numbers in JavaScript would be a second source of truth that silently
 * disagrees the first time one is changed. Dividing the lane's own width by its
 * bar count asks the layout what it actually did.
 */
export const barsMoved = (deltaPx: number, laneWidthPx: number, projectBars: number): number =>
  laneWidthPx <= 0 ? 0 : Math.round(deltaPx / (laneWidthPx / Math.max(1, projectBars)));

/**
 * The ruler's tick marks.
 *
 * NOT EVERY BAR GETS A LABEL. At 96 bars a number on each one is unreadable and
 * overlaps itself, so the interval widens with the project: every bar at 32,
 * every second at 64, every fourth at 96. The ticks themselves are still one
 * per bar — a reader needs the grid even where they do not need the number.
 */
export interface Tick {
  readonly bar: number;
  readonly labelled: boolean;
}

export function rulerTicks(projectBars: number): readonly Tick[] {
  const bars = Math.max(1, Math.min(projectBars, MAX_BARS));
  const every = bars <= 32 ? 4 : bars <= 64 ? 8 : 16;
  const ticks: Tick[] = [];
  for (let bar = 1; bar <= bars; bar += 1) {
    ticks.push({ bar, labelled: (bar - 1) % every === 0 });
  }
  return ticks;
}

/**
 * The playhead's column, given a position in seconds.
 *
 * ONE-BASED AND CLAMPED, to match a clip's `startBar`, so the playhead and the
 * clips are placed by the same rule and cannot disagree by one column — which
 * is exactly the off-by-one that makes a playhead appear to lead or trail the
 * audio it is supposedly tracking.
 */
export const playheadBar = (positionSec: number, projectBars: number): number =>
  Math.max(1, Math.min(Math.min(projectBars, MAX_BARS), Math.floor(secondsToBars(positionSec)) + 1));

/** A position in bars:beats, for the transport's musical readout. */
export function barsBeats(positionSec: number): { bar: number; beat: number } {
  const totalBeats = Math.floor((positionSec / SECONDS_PER_BAR) * BEATS_PER_BAR);
  return {
    bar: Math.floor(totalBeats / BEATS_PER_BAR) + 1,
    beat: (totalBeats % BEATS_PER_BAR) + 1,
  };
}

/* =============================================================== 3. MIXER */

/**
 * Which tracks the reader can actually hear.
 *
 * THE ASYMMETRY IS THE WHOLE POINT, and it is the single most re-implemented-
 * wrong rule in audio software:
 *
 *   - If ANY track is soloed, every track that is not soloed is silent.
 *   - An explicitly muted track is silent REGARDLESS, including when it is
 *     itself soloed. Mute wins, because it is the more deliberate statement.
 *   - With nothing soloed, audibility is just "not muted".
 *
 * The bug this prevents is the common one: implementing solo as "mute
 * everything else", which then leaves those tracks muted after the solo is
 * released, and cannot represent two tracks soloed at once. Solo is a QUERY
 * over the set, not a mutation of it — which is why this takes the whole array.
 */
export function audibleTracks(tracks: readonly StudioTrack[]): ReadonlySet<string> {
  const soloing = tracks.some((t) => t.soloed);
  const audible = new Set<string>();
  for (const track of tracks) {
    if (track.muted) continue;
    if (soloing && !track.soloed) continue;
    audible.add(track.id);
  }
  return audible;
}

/** Whether one track is audible, for a strip that does not have the array. */
export const isAudible = (tracks: readonly StudioTrack[], id: string): boolean =>
  audibleTracks(tracks).has(id);

/**
 * A fader's decibel label.
 *
 * A FADER IS A FRACTION AND A LABEL IS DECIBELS, and the conversion belongs
 * here rather than in a component: `0` is not "0 dB", it is silence, and every
 * build would have to special-case it identically. Unity gain is 1.0 → 0 dB.
 */
export function volumeDb(volume: number): number | null {
  if (volume <= 0) return null;
  return Math.round(20 * Math.log10(volume) * 10) / 10;
}

/**
 * A pan position's label, as a side and an amount.
 *
 * `0` IS CENTRE AND HAS NO SIDE, which is why this returns a discriminated
 * shape rather than a signed number: "L 0" and "R 0" are both wrong, and a
 * build left to format a signed float will produce one of them.
 */
export function panPosition(pan: number): { side: 'left' | 'right' | 'centre'; amount: number } {
  const clamped = Math.max(-1, Math.min(1, pan));
  const amount = Math.round(Math.abs(clamped) * 100);
  if (amount === 0) return { side: 'centre', amount: 0 };
  return { side: clamped < 0 ? 'left' : 'right', amount };
}

/* ============================================================= 4. HISTORY */

/**
 * The undo/redo stack.
 *
 * TWO ARRAYS RATHER THAN ONE ARRAY AND AN INDEX, because the invariant that
 * matters is easier to hold: `done` is what has happened, `undone` is what can
 * be replayed, and a NEW edit clears `undone` outright. That last rule is the
 * one implementations forget, and its absence produces a redo button that
 * reapplies an edit onto a document it no longer fits.
 */
export interface History {
  readonly done: readonly Edit[];
  readonly undone: readonly Edit[];
}

export const emptyHistory: History = { done: [], undone: [] };

/**
 * Record an edit.
 *
 * `undone` IS DISCARDED — see above. `done` is capped at `HISTORY_LIMIT` from
 * the OLD end, so the most recent edits survive; dropping from the new end
 * would make the most recent action the first to become un-undoable.
 */
export function record(history: History, edit: Edit): History {
  const done = [...history.done, edit];
  return { done: done.slice(Math.max(0, done.length - HISTORY_LIMIT)), undone: [] };
}

export const canUndo = (h: History): boolean => h.done.length > 0;
export const canRedo = (h: History): boolean => h.undone.length > 0;

/** The edit undo would reverse, for the button's label. `null` when empty. */
export const nextUndo = (h: History): Edit | null => h.done[h.done.length - 1] ?? null;

/** The edit redo would reapply, for the button's label. `null` when empty. */
export const nextRedo = (h: History): Edit | null => h.undone[h.undone.length - 1] ?? null;

/**
 * Move one edit from `done` to `undone`, returning it and the new history.
 *
 * The caller applies the returned edit's `before` value. Splitting it that way
 * keeps this file free of any knowledge of the document being edited, which is
 * what lets the same history drive a clip move and a fader.
 */
export function undo(history: History): { history: History; edit: Edit | null } {
  const edit = nextUndo(history);
  if (!edit) return { history, edit: null };
  return {
    history: { done: history.done.slice(0, -1), undone: [...history.undone, edit] },
    edit,
  };
}

export function redo(history: History): { history: History; edit: Edit | null } {
  const edit = nextRedo(history);
  if (!edit) return { history, edit: null };
  return {
    history: { done: [...history.done, edit], undone: history.undone.slice(0, -1) },
    edit,
  };
}

/**
 * An edit's inverse.
 *
 * Every `EditKind` is defined so that reversing it is swapping `before` and
 * `after` — which is why `Edit` requires both rather than storing a delta. A
 * delta cannot reverse a rename, and a snapshot of the whole document per edit
 * would be the other, heavier way to get the same guarantee.
 */
export const invertEdit = (edit: Edit): Edit => ({
  ...edit,
  before: edit.after,
  after: edit.before,
});

/** Build an edit, with both ends of the change. */
export function makeEdit(
  id: string,
  kind: EditKind,
  labelKey: string,
  targetId: string,
  before: EditValue,
  after: EditValue,
): Edit {
  return { id, kind, labelKey, targetId, before, after };
}

/* ========================================================== presentational */

/**
 * mm:ss for a duration or a position.
 *
 * NOT `Intl`, and deliberately: a track length is not a time of day and no
 * locale writes it differently. `Intl.NumberFormat` would localise the digits
 * in Arabic, which sounds right until the scrubber's two labels are Arabic-
 * Indic and the ruler's bar numbers next to them are not. The digits here stay
 * Latin in every locale, and the SEPARATOR is what a reader parses anyway.
 */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** A track list's total running time, for a header. */
export const totalDuration = (tracks: readonly Track[]): number =>
  tracks.reduce((sum, track) => sum + track.durationSec, 0);
