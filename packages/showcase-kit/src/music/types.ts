/**
 * Domain model for the "Cygnus — Music & Studio" showcase vertical.
 *
 * A music app with two halves that share a shell: a LISTENING half (a home
 * page, a library, albums, artists, tracks) and an EDITING half (projects, an
 * arrangement timeline, a mixer). It is the SIXTH vertical, and what it adds to
 * the other five is not another noun — it is a different AXIS.
 *
 * WHAT MAKES IT A DIFFERENT APPLICATION FROM THE OTHER FIVE, in the order the
 * difference costs component work:
 *
 *   - THERE IS STATE ABOVE THE ROUTER, AND IT IS THE POINT. Every other
 *     vertical's state dies with the screen: Corvus's reactions are a map the
 *     feed owns, Lyra's follow flags belong to the profile. Here the TRANSPORT
 *     — what is loaded, where the playhead is, the queue behind it — has to
 *     survive every navigation, because an app that stops playing when you open
 *     an album is not a music app. The plain-HTML build cannot hold it in
 *     memory at all, which is the most interesting port in this repository.
 *   - TIME IS A CONTINUOUS AXIS, NOT A ROW INDEX. A table has rows and a feed
 *     has posts; an arrangement has a clip that starts at bar 17 and lasts 8
 *     bars, and a ruler above it that has to agree. Nothing in the other five
 *     lays anything out against a measured quantity.
 *   - CONTROLS COME IN BANKS. A mixer is twelve of the same strip side by side,
 *     each with a fader, a pan, a mute, a solo and a meter. Sixty controls on
 *     one screen is a different accessibility problem from six — every one
 *     needs a name that says WHICH track it belongs to.
 *   - SOLO IS NOT A BOOLEAN, AND MUTE IS NOT ITS OPPOSITE. They are two flags
 *     whose combination decides audibility, and the rule is not symmetric: any
 *     track soloed silences every track that is not soloed, but an explicitly
 *     muted track stays silent even if you solo it. This is the single most
 *     re-implemented-wrong piece of logic in audio software, which is exactly
 *     why it lives in `derive.ts` once rather than in five builds.
 *   - EDITS ARE UNDOABLE. Every other vertical's interactions are toggles that
 *     invert themselves. An arrangement edit is a real change with a real
 *     inverse, and a history with a redo branch that has to be discarded when
 *     you edit after undoing.
 *
 * NOTHING ACTUALLY PLAYS, AND THAT IS A DESIGN DECISION RATHER THAN A GAP.
 * There is no audio, no `<audio>` element and no timer. Pressing Play flips a
 * state and relabels a button; the playhead moves only when a reader moves it.
 * Three reasons, in the order they bite:
 *
 *   1. A RUNNING CLOCK IS UNTESTABLE. The parity check compares five builds'
 *      document heights and text content; a position that advances in real time
 *      would differ between the first build measured and the last, and the
 *      whole comparison would become noise.
 *   2. THERE IS NO AUDIO TO SHIP. Real tracks are licensed binaries; generated
 *      tones are a synthesiser, not a component demonstration.
 *   3. IT IS THE SAME PROMISE THE OTHER VERTICALS MAKE. Corvus never posts,
 *      Lyra never uploads, the consoles never trade. The showcase demonstrates
 *      the INTERFACE to an operation, not the operation.
 *
 * Everything is a plain, serialisable value. There is no runtime clock and no
 * randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-music-fixture.mjs`) and baked into `generated.ts`, so
 * every framework build renders byte-identical output.
 *
 * THE FIVE CONVENTIONS every fixture in this repository follows:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself.
 *   2. Every enum-ish value carries a `…Key` twin (`kind` / `kindKey`) that
 *      resolves through the shared dictionary. Render the key, never the raw
 *      value — the raw value is for logic and for `status.ts`.
 *   3. Proper nouns live here untranslated; prose lives in the dictionary. An
 *      artist's name, an album's title and a track's title are fixture data.
 *      Every description, bio and note is a `…Key`.
 *   4. TIME IS AN INSTANT, NOT A DATE — for anything on a calendar. Every
 *      timestamp is a full UTC instant rendered against `REPORTING_INSTANT`, so
 *      the screenshots do not age. Musical time is the exception and is
 *      measured in bars and seconds; see the note on `SECONDS_PER_BAR`.
 *   5. EVERY IMAGE IS SELF-DESCRIBING. Every `Artwork` carries an `altKey` and
 *      no screen may render an `<img>` without resolving it.
 *
 * WHERE THE PICTURES COME FROM. Cover art is generated SVG inlined as a
 * `data:` URI, for the reasons Lyra's `types.ts` sets out: the deployed policy
 * is `img-src 'self' data:`, the parity check compares document heights so
 * nothing may load at an unpredictable size, and real artwork is a licence
 * audit per file.
 */

/* --------------------------------------------------------------- constants */

/** The frozen instant everything dated is measured from. */
export const REPORTING_INSTANT = '2026-11-18T15:20:00Z';

/** The calendar day `REPORTING_INSTANT` falls on, for the date-only fields. */
export const REPORTING_DATE = '2026-11-18';

/** The handle of the listener whose session this is. */
export const VIEWER_HANDLE = 'mira.halvorsen';

/**
 * How long one bar lasts, in seconds.
 *
 * FOUR BEATS AT 120 BPM IS EXACTLY TWO SECONDS, and every project in the
 * fixture is at 120 in 4/4 for that reason alone. It is not laziness about
 * tempo: it means bar boundaries fall on whole seconds, so the ruler's labels,
 * the clip edges and the transport's mm:ss readout all agree without anybody
 * rounding. A project at 137 BPM would put bar 5 at 8.759…s, and five builds
 * would each round it their own way — which the parity check would report as a
 * difference in five places with one cause.
 *
 * The tempo is still DATA on the project rather than a constant, because a
 * screen that says "120 BPM" should be reading it from somewhere. It simply
 * happens to be 120 everywhere.
 */
export const SECONDS_PER_BAR = 2;

/** Beats in a bar. Every project is in 4/4; see `SECONDS_PER_BAR`. */
export const BEATS_PER_BAR = 4;

/**
 * The bar counts a timeline may be, and the only ones `app.css` has a grid for.
 *
 * THE TIMELINE IS A CSS GRID WITH ONE COLUMN PER BAR, and that is forced by the
 * deployed content policy rather than chosen for elegance. `style-src-attr
 * 'none'` means no element may carry a `style` attribute, so a clip cannot be
 * positioned by writing `left: 340px` on it the way every audio editor on the
 * web does. What it CAN do is sit in a grid column, because `grid-column` comes
 * from a stylesheet rule matched on a data attribute.
 *
 * That turns clip placement into integers — start bar, span in bars — which has
 * two consequences worth stating. Clips are quantised to the bar, which is a
 * real limitation and an honest one for a showcase. And every build places them
 * identically, because none of them is doing arithmetic: they are writing the
 * same two data attributes and the stylesheet does the rest.
 *
 * The list is closed because `app.css` generates a rule per column, so a
 * project length that is not here would render as a one-column grid.
 */
export const TIMELINE_BARS = [32, 64, 96] as const;

/** The widest bar index any generated CSS rule covers. Keep in step with `app.css`. */
export const MAX_BARS = 96;

/** Zoom steps, as the name of the CSS rule that sets the column width. */
export const ZOOM_LEVELS = ['sm', 'md', 'lg'] as const;

/** How many tracks a library page shows before its pager. */
export const TRACK_PAGE = 12;

/** How deep the edit history goes before the oldest entry falls off. */
export const HISTORY_LIMIT = 20;

/* ------------------------------------------------------------------ unions */

/** Cover-art shapes. Square for releases, wide for playlists and banners. */
export type ArtworkShape = 'square' | 'wide';

/** What a transport is doing. There is no `buffering`: nothing loads. */
export type PlayState = 'playing' | 'paused' | 'stopped';

/**
 * What happens at the end of the queue.
 *
 * `one` repeats the current track and `all` repeats the queue — two different
 * things that a single boolean would conflate, and the reason the control is a
 * three-state cycle rather than a switch.
 */
export type RepeatMode = 'off' | 'all' | 'one';

/** What a library row is. Drives the icon and where a press goes. */
export type LibraryKind = 'album' | 'playlist' | 'artist';

/** The instrument family a studio track holds. Drives its icon and its colour. */
export type TrackKind = 'drums' | 'bass' | 'keys' | 'guitar' | 'vocal' | 'synth' | 'fx';

/** What a clip contains. `midi` renders a note grid, `audio` a waveform. */
export type ClipKind = 'audio' | 'midi';

/** Where a project is in its life. Drives the chip beside its name. */
export type ProjectState = 'draft' | 'mixing' | 'mastering' | 'released';

/**
 * The edits the history can record and reverse.
 *
 * EVERY ONE OF THESE HAS AN EXACT INVERSE, which is what makes undo a
 * transformation rather than a snapshot. `derive.ts` refuses to build an entry
 * it cannot invert — see `invertEdit`.
 */
export type EditKind =
  | 'clip.move'
  | 'clip.resize'
  | 'clip.remove'
  | 'track.rename'
  | 'track.volume'
  | 'track.pan'
  | 'track.mute'
  | 'track.solo';

/* ------------------------------------------------------------------ shapes */

export interface Artwork {
  readonly src: string;
  readonly altKey: string;
  readonly shape: ArtworkShape;
}

export interface Artist {
  readonly id: string;
  readonly handle: string;
  readonly name: string;
  readonly bioKey: string;
  readonly art: Artwork;
  readonly monthlyListeners: number;
  readonly followed: boolean;
}

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artistId: string;
  readonly albumId: string;
  /** Whole seconds. Rendered as mm:ss, never as a bare number. */
  readonly durationSec: number;
  readonly playCount: number;
  readonly liked: boolean;
  /** Position on the album, 1-based. */
  readonly trackNumber: number;
  /**
   * Sixteen loudness samples, each a fraction of full scale.
   *
   * NOT A WAVEFORM — a waveform is thousands of samples and would be a
   * kilobyte per track. Sixteen bars is enough to make one track look unlike
   * another at a glance, which is all a row in a list needs.
   */
  readonly peaks: readonly number[];
}

export interface Album {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly artistId: string;
  readonly year: number;
  readonly art: Artwork;
  readonly trackIds: readonly string[];
}

export interface Playlist {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly descriptionKey: string;
  readonly art: Artwork;
  readonly trackIds: readonly string[];
  /** Whether the viewer made it. Theirs are editable; the rest are followed. */
  readonly own: boolean;
  readonly updatedAt: string;
}

/** One clip on one track, placed in whole bars. See `TIMELINE_BARS`. */
export interface Clip {
  readonly id: string;
  readonly trackId: string;
  readonly kind: ClipKind;
  readonly labelKey: string;
  /** 1-based start bar, so it matches the ruler a reader is looking at. */
  readonly startBar: number;
  /** Length in bars, at least 1. */
  readonly bars: number;
  /** Eight loudness samples for the clip body. Shorter than a track's sixteen. */
  readonly peaks: readonly number[];
}

export interface StudioTrack {
  readonly id: string;
  readonly name: string;
  readonly kind: TrackKind;
  /** 0..1. A fader is a fraction, not a decibel — the label does that. */
  readonly volume: number;
  /** -1 (hard left) .. 1 (hard right), 0 centred. */
  readonly pan: number;
  readonly muted: boolean;
  readonly soloed: boolean;
  /** 0..1, the meter's static reading. Nothing animates; see the header. */
  readonly level: number;
}

export interface Project {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly state: ProjectState;
  readonly stateKey: string;
  readonly art: Artwork;
  readonly bpm: number;
  readonly bars: number;
  readonly trackIds: readonly string[];
  readonly updatedAt: string;
}

/** One entry in the edit history. `before` and `after` are both required. */
export interface Edit {
  readonly id: string;
  readonly kind: EditKind;
  readonly labelKey: string;
  /** What the edit applies to — a clip id or a track id, by `kind`. */
  readonly targetId: string;
  readonly before: EditValue;
  readonly after: EditValue;
}

/** The payload an edit moves between. One shape per `EditKind` family. */
export type EditValue =
  | { readonly startBar: number }
  | { readonly bars: number }
  | { readonly removed: boolean }
  | { readonly name: string }
  | { readonly volume: number }
  | { readonly pan: number }
  | { readonly muted: boolean }
  | { readonly soloed: boolean };

export interface MusicTotals {
  readonly tracks: number;
  readonly albums: number;
  readonly artists: number;
  readonly playlists: number;
  readonly projects: number;
  readonly likedTracks: number;
  readonly listeningMinutes: number;
}

/**
 * Whose session this is.
 *
 * A RECORD RATHER THAN A DICTIONARY ENTRY, because a display name is a proper
 * noun and convention 3 keeps those in the fixture. The dictionary holds the
 * sentence around it ("Signed in as {name}"), which is the part that
 * translates.
 */
export interface Viewer {
  readonly handle: string;
  readonly displayName: string;
  readonly art: Artwork;
}

export interface MusicFixture {
  readonly viewer: Viewer;
  readonly artists: readonly Artist[];
  readonly albums: readonly Album[];
  readonly tracks: readonly Track[];
  readonly playlists: readonly Playlist[];
  readonly projects: readonly Project[];
  readonly studioTracks: readonly StudioTrack[];
  readonly clips: readonly Clip[];
  /** The queue the transport starts with, as track ids in order. */
  readonly queue: readonly string[];
  readonly totals: MusicTotals;
}
