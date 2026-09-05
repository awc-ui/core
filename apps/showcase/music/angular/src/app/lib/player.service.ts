/**
 * The transport, the mixer and the edit history — one root-provided service.
 *
 * THIS IS THE VERTICAL'S REASON FOR EXISTING. The router swaps the routed
 * component on every navigation, so anything a screen owns dies with it; the
 * transport must not. A `providedIn: 'root'` service lives outside the
 * component tree — one instance for the life of the application, which is
 * exactly the lifetime the transport needs.
 *
 * SIGNALS, NOT `BehaviorSubject`. Every screen reads this in a template, and a
 * signal read in a template registers a fine-grained dependency without an
 * `async` pipe or a subscription to unsubscribe. `audible` is a `computed`, so
 * the solo/mute rule is evaluated once per change rather than once per strip.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Everything here is overrides on top
 * of what the fixture shipped; a reload is a reset.
 *
 * NOTHING PLAYS. The playhead advances on a one-second interval that runs only
 * while the state is `playing`, and there is no audio anywhere.
 */

import { Injectable, computed, effect, signal } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class PlayerService {
  readonly transport = signal<Transport>(initialTransport(getQueue()));
  readonly tracks = signal<StudioTrack[]>(getStudioTracks().map((t) => ({ ...t })));
  readonly history = signal<History>(emptyHistory);

  private readonly likes = signal<Record<string, boolean>>({});
  private readonly follows = signal<Record<string, boolean>>({});
  /*
   * PUBLIC, so a template can build a `computed()` that depends on them.
   *
   * They were private, and a component reading them through the methods below
   * could not declare a dependency on them — so the timeline rebuilt its lane
   * model by calling a function inside `*ngFor`, which returns a NEW array on
   * every change-detection pass. `NgForOf` sees a different collection,
   * re-renders, and schedules another pass: the Studio screen locked the tab
   * so hard that even an `evaluate` from the test harness timed out.
   */
  readonly clipStarts = signal<Record<string, number>>({});
  readonly clipSpans = signal<Record<string, number>>({});
  readonly removed = signal<Record<string, boolean>>({});

  /*
   * AUDIBILITY IS DERIVED, never stored. Storing it would mean recomputing it
   * in four places — mute, solo and the undo of each — and the first one
   * anybody forgot would leave the mixer showing a track as silent that is not.
   */
  readonly audible = computed(() => audibleTracks(this.tracks()));

  private editSeq = 0;
  private ticker: number | null = null;

  constructor() {
    /*
     * ONE SECOND AT A TIME, and only while playing.
     *
     * An `effect` keyed on the state and the track, not the position: reading
     * the position here would re-run the effect on every tick and restart the
     * interval, so each second would begin again and the clock would run slow.
     */
    effect(() => {
      const { state, trackId } = this.transport();
      if (this.ticker !== null) {
        clearInterval(this.ticker);
        this.ticker = null;
      }
      if (state !== 'playing' || trackId === null) return;
      this.ticker = setInterval(() => {
        const current = this.transport();
        const track = current.trackId ? trackById(current.trackId) : null;
        if (track) this.transport.set(tick(current, track.durationSec));
      }, 1000) as unknown as number;
    });
  }

  /* ---------------------------------------------------------- transport */

  play(track: Track) { this.transport.update((t) => playTrack(t, track.id)); }
  toggle() { this.transport.update(togglePlay); }
  next() { this.transport.update(advance); }
  previous() { this.transport.update(goBack); }
  seek(seconds: number, durationSec: number) {
    this.transport.update((t) => seekTo(t, seconds, durationSec));
  }
  setVolume(value: number) { this.transport.update((t) => setTransportVolume(t, value)); }
  toggleMute() { this.transport.update(toggleTransportMute); }
  cycleRepeat() { this.transport.update(cycleRepeatMode); }
  toggleShuffle() { this.transport.update((t) => ({ ...t, shuffle: !t.shuffle })); }

  /* An append that must not disturb the playhead — touching `trackId` here is
     how "add to queue" ends up behaving like "play now". */
  enqueue(track: Track) {
    this.transport.update((t) =>
      t.queue.includes(track.id) ? t : { ...t, queue: [...t.queue, track.id] },
    );
  }

  /* ------------------------------------------------- listening overrides */

  /* `in` rather than `??`, because `false` is a legitimate override: un-liking
     a track the fixture shipped as liked must stick. */
  likedFor(track: Track): boolean {
    const map = this.likes();
    return track.id in map ? map[track.id]! : track.liked;
  }
  toggleLike(track: Track) {
    const next = !this.likedFor(track);
    this.likes.update((m) => ({ ...m, [track.id]: next }));
  }
  followedFor(handle: string, shipped: boolean): boolean {
    const map = this.follows();
    return handle in map ? map[handle]! : shipped;
  }
  toggleFollow(handle: string, shipped: boolean) {
    const next = !this.followedFor(handle, shipped);
    this.follows.update((m) => ({ ...m, [handle]: next }));
  }

  /* ------------------------------------------------------------- mixer */

  private patchTrack(id: string, patch: Partial<StudioTrack>) {
    this.tracks.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  private push(edit: Edit) {
    this.history.update((h) => record(h, edit));
  }
  private id() { return `edit-${(this.editSeq += 1)}`; }

  setTrackVolume(id: string, value: number) {
    const before = this.tracks().find((t) => t.id === id)?.volume ?? 0;
    if (before === value) return;
    this.patchTrack(id, { volume: value });
    this.push(makeEdit(this.id(), 'track.volume', 'music.edit.trackVolume', id, { volume: before }, { volume: value }));
  }
  setTrackPan(id: string, value: number) {
    const before = this.tracks().find((t) => t.id === id)?.pan ?? 0;
    if (before === value) return;
    this.patchTrack(id, { pan: value });
    this.push(makeEdit(this.id(), 'track.pan', 'music.edit.trackPan', id, { pan: before }, { pan: value }));
  }
  toggleTrackMute(id: string) {
    const before = this.tracks().find((t) => t.id === id)?.muted ?? false;
    this.patchTrack(id, { muted: !before });
    this.push(makeEdit(this.id(), 'track.mute', 'music.edit.trackMute', id, { muted: before }, { muted: !before }));
  }
  toggleTrackSolo(id: string) {
    const before = this.tracks().find((t) => t.id === id)?.soloed ?? false;
    this.patchTrack(id, { soloed: !before });
    this.push(makeEdit(this.id(), 'track.solo', 'music.edit.trackSolo', id, { soloed: before }, { soloed: !before }));
  }
  renameTrack(id: string, name: string) {
    const before = this.tracks().find((t) => t.id === id)?.name ?? '';
    if (before === name || name.trim() === '') return;
    this.patchTrack(id, { name });
    this.push(makeEdit(this.id(), 'track.rename', 'music.edit.trackRename', id, { name: before }, { name }));
  }

  /* -------------------------------------------------------------- clips */

  clipStart(id: string, shipped: number): number {
    const map = this.clipStarts();
    return id in map ? map[id]! : shipped;
  }
  clipBars(id: string, shipped: number): number {
    const map = this.clipSpans();
    return id in map ? map[id]! : shipped;
  }
  clipRemoved(id: string): boolean { return this.removed()[id] === true; }

  moveClip(id: string, shipped: number, startBar: number) {
    const before = this.clipStart(id, shipped);
    if (before === startBar) return;
    this.clipStarts.update((m) => ({ ...m, [id]: startBar }));
    this.push(makeEdit(this.id(), 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar }));
  }
  resizeClip(id: string, shipped: number, bars: number) {
    const before = this.clipBars(id, shipped);
    if (before === bars) return;
    this.clipSpans.update((m) => ({ ...m, [id]: bars }));
    this.push(makeEdit(this.id(), 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars }));
  }
  /* A REMOVED CLIP IS A FLAG, NOT A DELETION. Undo has to bring it back, and
     the fixture is frozen — there would be nothing to splice it back into. */
  removeClip(id: string) {
    this.removed.update((m) => ({ ...m, [id]: true }));
    this.push(makeEdit(this.id(), 'clip.remove', 'music.edit.clipRemove', id, { removed: false }, { removed: true }));
  }

  /* ------------------------------------------------------------ history */

  /**
   * Put an edit's payload back onto whatever it names.
   *
   * ONE FUNCTION FOR BOTH DIRECTIONS. Undo applies the inverted edit and redo
   * applies the original, so there is no second copy of this switch to keep in
   * step — which is where a history usually goes wrong, with redo handling one
   * more case than undo.
   */
  private applyEdit(edit: Edit) {
    const value = edit.after;
    if ('startBar' in value) {
      this.clipStarts.update((m) => ({ ...m, [edit.targetId]: value.startBar }));
      return;
    }
    if ('bars' in value) {
      this.clipSpans.update((m) => ({ ...m, [edit.targetId]: value.bars }));
      return;
    }
    if ('removed' in value) {
      this.removed.update((m) => ({ ...m, [edit.targetId]: value.removed }));
      return;
    }
    if ('volume' in value) this.patchTrack(edit.targetId, { volume: value.volume });
    else if ('pan' in value) this.patchTrack(edit.targetId, { pan: value.pan });
    else if ('muted' in value) this.patchTrack(edit.targetId, { muted: value.muted });
    else if ('soloed' in value) this.patchTrack(edit.targetId, { soloed: value.soloed });
    else if ('name' in value) this.patchTrack(edit.targetId, { name: value.name });
  }

  undo(): Edit | null {
    const step = undoHistory(this.history());
    if (!step.edit) return null;
    this.history.set(step.history);
    this.applyEdit(invertEdit(step.edit));
    return step.edit;
  }

  redo(): Edit | null {
    const step = redoHistory(this.history());
    if (!step.edit) return null;
    this.history.set(step.history);
    this.applyEdit(step.edit);
    return step.edit;
  }
}
