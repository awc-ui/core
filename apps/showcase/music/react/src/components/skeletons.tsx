/**
 * The placeholder shapes every screen shows while it settles.
 *
 * PLAIN DOM, NOT `md-skeleton`. Every shape here is a `<div class="skel">`
 * styled from tokens in `app.css`, and that is the single most important thing
 * about this file.
 *
 * The obvious version used `md-skeleton` and `md-card` — the library HAS a
 * skeleton component, and §5.5 recommends it. But those are lazily-hydrated
 * custom elements exactly like the content they stand in for, so the placeholder
 * caught the same disease it was there to treat: measured on holdings, the
 * placeholder was 172px tall for three frames, 228px for one more, and only then
 * its real 1986. A loading state that pops open cannot hide a loading state that
 * pops open. Divs have their size in the first paint, before a chunk has
 * loaded — which is the only property a placeholder actually needs.
 *
 * `md-skeleton` remains the right answer for a placeholder INSIDE an already-
 * hydrated screen — a panel waiting on one fetch, a row streaming in. It is the
 * wrong answer for the placeholder that covers a screen's own first paint.
 *
 * THE PLACEHOLDER NO LONGER HAS TO BE THE RIGHT HEIGHT. It is absolutely
 * positioned over the real content, which keeps its own box the whole time (see
 * the note in `Shell.tsx`), so revealing is a `visibility` flip with no reflow.
 * The heights below are still measured rather than invented, because the shape
 * should look like what is coming — but a few pixels out no longer moves the
 * page, and chasing exact heights across every breakpoint is what this design
 * replaced.
 *
 * THE BEAT IS A CONSTANT, NEVER A MEASURED DURATION. These screens read
 * synchronous selectors out of the kit — there is no network here, and the pause
 * exists to demonstrate the pattern rather than to cover a real wait. A
 * clock-derived or random delay would also make two runs of the showcase
 * disagree, which the cross-framework parity check cannot tolerate.
 */

import type { CSSProperties } from 'react';

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides it
 * for inspection; see `useScreenReady` in `Shell.tsx`.
 */
export const SKELETON_MS = 550;

/**
 * One placeholder bar with a corner of its own.
 *
 * A single `border-radius` for everything would be wrong in both directions:
 * measured off the real holdings filter bar, `md-search` is a 9999px pill, an
 * outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.
 *
 * `flex` is how a bar takes the SAME share of a `.row` its control does — the
 * fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
 * placeholder that guessed a percentage instead would break at the first
 * breakpoint.
 */
export function Bar({
  radius,
  height,
  width,
  flex,
}: {
  /** A CSS length. The control's own corner, measured, not a guess. */
  radius: string;
  height: string;
  /** Omit to let the bar fill its box. */
  width?: string;
  flex?: string;
}) {
  return (
    <div
      className="skel"
      style={
        {
          blockSize: height,
          inlineSize: width ?? (flex ? undefined : '100%'),
          borderRadius: radius,
          ...(flex ? { flex } : null),
        } as CSSProperties
      }
    />
  );
}

/* ============================================================================
 * THE COMPOSITIONS.
 *
 * Each one is the SHAPE OF THE SCREEN IT COVERS, not a grey rectangle of about
 * the right height. That distinction is the whole reason this file is long:
 * a placeholder that only says "something is coming" tells the reader nothing
 * they did not already know, whereas one that says "a column of posts is coming,
 * with a picture in the second one" lets them start reading the layout before
 * the content lands — and makes the swap feel like content arriving rather than
 * like a screen replacing itself.
 *
 * They are built from the same primitives the real screens are laid out with —
 * `.shelf`, `.track-row`, `.strip`, `.lane` — so the placeholder inherits every
 * one of those rules and cannot drift from the layout at a breakpoint. A
 * skeleton with its own private grid agrees with the screen at exactly the
 * width it was written at.
 *
 * THE INLINE STYLES HERE ARE FINE, AND THE TIMELINE'S ABSENCE OF THEM IS NOT
 * INCONSISTENCY. React sets styles through the CSSOM (`el.style.blockSize =`),
 * which `style-src-attr 'none'` does not touch — it refuses the ATTRIBUTE. The
 * plain-HTML port has no CSSOM to reach for: it writes markup, so a `style="…"`
 * on a clip would be refused outright. Since all five builds must lay the
 * arrangement out identically, the grid is the answer all five can share; a
 * placeholder, which only this build renders, is not under that constraint.
 * ========================================================================= */

/** A line of text. `w` is a percentage so it wraps with its column. */
function Line({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return <Bar width={w} height={`${h}px`} radius="4px" />;
}

/** An avatar-shaped hole. */
function Circle({ size = 40 }: { size?: number }) {
  return <Bar width={`${size}px`} height={`${size}px`} radius="50%" />;
}

/* ============================================================ compositions */

/**
 * A track row, in the REAL row's grid.
 *
 * It renders `.track-row` itself rather than approximating one, so the columns
 * are the screen's own — index, text, album, duration, controls — and the
 * reveal cannot shift anything sideways. The first version laid out four loose
 * bars and they landed nowhere near the real columns.
 *
 * `albums` mirrors the list's own flag, because the grid template changes with
 * it: a placeholder with four columns over a list with five is misaligned for
 * every row.
 */
function TrackRowSkeleton({ albums = false }: { albums?: boolean }) {
  /* MEASURED, NOT GUESSED. Off the real row at 1440px: title 20, artist 16,
     album 16, duration 16, buttons 40, row 56. Bars an approximate height
     short compound down a twelve-row list into a panel eighty pixels too
     small, which is what made the reveal jump. */
  return (
    <div className="track-row">
      <Line w="100%" h={12} />
      <div className="track-row__text">
        <Line w="54%" h={20} />
        <Line w="32%" h={16} />
      </div>
      {albums ? <Line w="46%" h={16} /> : null}
      <Line w="32px" h={16} />
      <div className="row">
        <Circle size={40} />
        <Circle size={40} />
      </div>
    </div>
  );
}

/** A run of them, inside the list wrapper that owns the grid template. */
function TrackListSkeleton({ rows, albums = false }: { rows: number; albums?: boolean }) {
  return (
    <div className="track-list" data-albums={albums ? '' : undefined}>
      {Array.from({ length: rows }, (_, i) => (
        <TrackRowSkeleton key={i} albums={albums} />
      ))}
    </div>
  );
}

/** A shelf of square cards, which is what four of the screens open with. */
function ShelfSkeleton({ count = 6, wide = false }: { count?: number; wide?: boolean }) {
  /*
   * THE CARD IS THE REAL `.shelf-card`, so the art keeps its aspect ratio and
   * the grid keeps its `auto-fill` columns — a placeholder with a fixed pixel
   * height would be right at one viewport width and wrong at every other. Only
   * the art's height is stated, measured at 165px square, and the wide banner
   * is half of it because `.shelf-card__art--wide` is 2:1.
   */
  return (
    <div className="shelf">
      {Array.from({ length: count }, (_, i) => (
        <div className="shelf-card" key={i}>
          <Bar height={wide ? '83px' : '165px'} radius="12px" />
          <Line w="72%" h={20} />
          <Line w="46%" h={16} />
        </div>
      ))}
    </div>
  );
}

/**
 * The card a panel is, without the card.
 *
 * `.skel-panel` carries the outlined card's border, radius and surface, and
 * `.panel__inner` is the REAL panel's padding rule — shared rather than copied,
 * so the placeholder's content starts on the same pixel as the content it is
 * standing in for.
 */
function PanelSkeleton({ head = true, children }: { head?: boolean; children: React.ReactNode }) {
  /* `head` is not decoration: `Panel` renders no head at all when it has no
     title, and a placeholder that draws one anyway is 32px too tall — a heading
     plus the inner gap — for every such panel on the screen. */
  return (
    <div className="skel-panel">
      <div className="panel__inner">
        {head ? (
          <div className="panel__head">
            <Line w="180px" h={20} />
            <Line w="24px" h={20} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** An artist row: a round portrait with a name over a listener count. */
function ArtistRowSkeleton() {
  return (
    <div className="artist-row">
      <Circle size={48} />
      <div className="track-row__text">
        <Line w="34%" h={20} />
        <Line w="22%" h={16} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ home */

export function HomeSkeleton() {
  return (
    <div className="stack">
      <PanelSkeleton>
        <TrackListSkeleton rows={6} albums />
      </PanelSkeleton>
      <PanelSkeleton>
        <ShelfSkeleton />
      </PanelSkeleton>
      <PanelSkeleton>
        <ShelfSkeleton count={4} wide />
      </PanelSkeleton>
      {/* The last home panel is a list of ARTISTS, which are rows with round
          portraits — not a shelf of square cards. */}
      <PanelSkeleton>
        {/* `.stack` and not a bare div: the real list is a stack, and its 12px
            gap between rows is what the placeholder was missing — 24px over
            four rows, which is exactly the shortfall it showed. */}
        <div className="stack">
          {Array.from({ length: 4 }, (_, i) => (
            <ArtistRowSkeleton key={i} />
          ))}
        </div>
      </PanelSkeleton>
    </div>
  );
}

/* --------------------------------------------------------------- library */

export function LibrarySkeleton() {
  return (
    <div className="stack">
      <PanelSkeleton>
        <TrackListSkeleton rows={12} albums />
      </PanelSkeleton>
      <PanelSkeleton>
        <ShelfSkeleton count={5} wide />
      </PanelSkeleton>
      <PanelSkeleton>
        <ShelfSkeleton count={3} wide />
      </PanelSkeleton>
      {/* Sixteen, because the library lists every album — a six-card
          placeholder over a sixteen-card shelf is a panel 550px short. */}
      <PanelSkeleton>
        <ShelfSkeleton count={16} />
      </PanelSkeleton>
    </div>
  );
}

/* ---------------------------------------------------------------- studio */

/**
 * The arrangement's shape, and this one earns its length.
 *
 * A grey box where the timeline goes would tell the reader nothing; a ruler
 * with lanes under it tells them a timeline is coming and roughly how many
 * tracks are on it. The lanes use the real `.lane-name` height so the reveal
 * does not move anything.
 */
export function StudioSkeleton() {
  return (
    <div className="stack">
      {/* The project header carries no panel title. */}
      <PanelSkeleton head={false}>
        <div className="studio-head">
          <div className="studio-head__facts">
            <Bar width="64px" height="64px" radius="8px" />
            <div className="track-row__text">
              <Line w="180px" h={28} />
              <Line w="240px" h={20} />
            </div>
          </div>
          <div className="row">
            <Bar width="84px" height="32px" radius="16px" />
            <Bar width="84px" height="32px" radius="16px" />
          </div>
        </div>
      </PanelSkeleton>

      {/*
       * The arrangement, in the REAL lane grid.
       *
       * A grey box where the timeline goes would tell the reader nothing; a
       * ruler with seven lanes under it says a timeline is coming and how many
       * tracks are on it. The lanes borrow `.lane-name`'s own 56px so the
       * reveal cannot shift a row.
       */}
      <PanelSkeleton>
        <div className="lanes">
          <div className="lane-names">
            <div className="lane-names__pad" />
            {Array.from({ length: 7 }, (_, i) => (
              <div className="lane-name" key={i}>
                <Line w="70%" h={16} />
              </div>
            ))}
          </div>
          <div>
            <Bar height="28px" radius="0" />
            {Array.from({ length: 7 }, (_, i) => (
              <Bar key={i} height="56px" radius="0" />
            ))}
          </div>
        </div>
      </PanelSkeleton>

      {/* The edit history, which opens empty — so this is the empty state's
          height rather than a list of rows. */}
      <PanelSkeleton>
        <Bar height="96px" radius="8px" />
      </PanelSkeleton>

      <PanelSkeleton>
        <ProjectListSkeleton count={4} />
      </PanelSkeleton>
    </div>
  );
}

/** The project cards that close both Studio and Profile. */
function ProjectListSkeleton({ count }: { count: number }) {
  return (
    <div className="stack">
      {Array.from({ length: count }, (_, i) => (
        <div className="project-card" key={i}>
          <Bar width="64px" height="64px" radius="8px" />
          <div className="track-row__text">
            <Line w="30%" h={20} />
            <Line w="18%" h={16} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- mixer */

export function MixerSkeleton() {
  return (
    <PanelSkeleton>
      <div className="mixer">
        {/* Seven strips, and each one measured: the real strip is 435px tall
            and holds a name, a kind, a 160px fader, a meter, two readouts, a
            pan slider and two buttons. */}
        {Array.from({ length: 7 }, (_, i) => (
          <div className="strip" key={i}>
            <Line w="70%" h={16} />
            {/* The kind glyph is a 24px icon, and the pan control is a slider
                at its own 40px — not the 16px bars these were first drawn as. */}
            <Line w="40%" h={24} />
            <div className="strip__body">
              <Bar width="48px" height="160px" radius="8px" />
            </div>
            <Bar height="10px" radius="5px" />
            <Line w="50%" h={16} />
            <Bar height="40px" radius="20px" />
            <Line w="50%" h={16} />
            <div className="row">
              <Circle size={40} />
              <Circle size={40} />
            </div>
          </div>
        ))}
      </div>
    </PanelSkeleton>
  );
}

/* ------------------------------------------------------- release / drill */

export function ReleaseSkeleton() {
  return (
    <div className="stack">
      <PanelSkeleton head={false}>
        <div className="release-head">
          <Bar width="200px" height="200px" radius="16px" />
          <div className="stack">
            <Line w="260px" h={28} />
            <Line w="180px" h={14} />
            <Line w="120px" h={14} />
            <Bar width="140px" height="40px" radius="20px" />
          </div>
        </div>
      </PanelSkeleton>
      <PanelSkeleton>
        <TrackListSkeleton rows={3} />
      </PanelSkeleton>
      {/* The third panel is the rest of the discography, which the album and
          artist screens both carry. */}
      <PanelSkeleton>
        <ShelfSkeleton count={2} />
      </PanelSkeleton>
    </div>
  );
}

/* --------------------------------------------------------------- profile */

export function ProfileSkeleton() {
  return (
    <div className="stack">
      <PanelSkeleton head={false}>
        <div className="release-head">
          <Bar width="200px" height="200px" radius="16px" />
          <div className="stack">
            <Line w="220px" h={28} />
            <Line w="140px" h={16} />
            <div className="row">
              {Array.from({ length: 4 }, (_, i) => (
                <div className="track-row__text" key={i}>
                  <Line w="70px" h={16} />
                  <Line w="46px" h={20} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PanelSkeleton>

      {/* The queue. */}
      <PanelSkeleton>
        <div className="stack">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="queue-row" key={i}>
              <Line w="16px" h={14} />
              <div className="track-row__text">
                <Line w="26%" h={20} />
                <Line w="16%" h={16} />
              </div>
            </div>
          ))}
        </div>
      </PanelSkeleton>

      <PanelSkeleton>
        <TrackListSkeleton rows={6} albums />
      </PanelSkeleton>

      <PanelSkeleton>
        <ShelfSkeleton count={5} wide />
      </PanelSkeleton>

      <PanelSkeleton>
        <ProjectListSkeleton count={4} />
      </PanelSkeleton>
    </div>
  );
}

export function ScreenSkeleton({ label }: { label?: string }) {
  return (
    <div aria-label={label} aria-busy="true">
      <HomeSkeleton />
    </div>
  );
}
