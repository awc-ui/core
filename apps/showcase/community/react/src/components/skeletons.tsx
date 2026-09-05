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
 * `.columns`, `.post-card`, `.person-grid`, `.event-row` — so the placeholder
 * inherits every one of those rules and cannot drift from the layout at a
 * breakpoint. A skeleton with its own private grid agrees with the screen at
 * exactly the width it was written at.
 * ========================================================================= */

/** A line of text. `w` is a percentage so it wraps with its column. */
function Line({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return <Bar width={w} height={`${h}px`} radius="4px" />;
}

/** An avatar-shaped hole. */
function Circle({ size = 40 }: { size?: number }) {
  return <Bar width={`${size}px`} height={`${size}px`} radius="50%" />;
}

/* ------------------------------------------------------------ post card */

/**
 * One post: byline, prose, sometimes a picture, and the action row.
 *
 * `media` is a real property of the post it stands for rather than decoration —
 * roughly a third of this feed carries pictures, so a placeholder where every
 * card had one would promise a feed that does not exist, and the reveal would
 * be a column of cards visibly shrinking.
 */
export function PostCardSkeleton({ media = false, lines = 3 }: { media?: boolean; lines?: number }) {
  return (
    <div className="skel-card">
      <div className="row" style={{ alignItems: 'center' }}>
        <Circle size={40} />
        <div className="stack" style={{ flex: 1, gap: '6px' }}>
          <Line w="38%" h={15} />
          <Line w="22%" h={12} />
        </div>
      </div>
      <div className="stack" style={{ gap: '8px', marginBlockStart: '12px' }}>
        {Array.from({ length: lines }, (_, i) => (
          <Line key={i} w={i === lines - 1 ? '64%' : '100%'} />
        ))}
      </div>
      {media ? <Bar width="100%" height="240px" radius="12px" /> : null}
      <div className="row" style={{ marginBlockStart: '12px', gap: '24px' }}>
        <Bar width="84px" height="20px" radius="4px" />
        <Bar width="84px" height="20px" radius="4px" />
        <Bar width="84px" height="20px" radius="4px" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- the rail */

/** One right-rail panel: a heading and a few rows. */
function RailPanelSkeleton({ rows = 3, avatars = false }: { rows?: number; avatars?: boolean }) {
  return (
    <div className="skel-card">
      <Line w="46%" h={16} />
      <div className="stack" style={{ gap: '12px', marginBlockStart: '8px' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="row" style={{ gap: '8px', alignItems: 'center' }}>
            {avatars ? <Circle size={28} /> : <Bar width="20px" height="20px" radius="4px" />}
            <Line w={`${58 + ((i * 13) % 26)}%`} h={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The three blocks beside the feed.
 *
 * Only rendered where the real rail is. Below 1200px `app.css` hides
 * `.columns__rail` outright, and the placeholder is inside the same class — so
 * it disappears at exactly the width the thing it stands for does, with no
 * media query of its own to keep in step.
 */
export function RightRailSkeleton() {
  return (
    <aside className="columns__rail">
      <RailPanelSkeleton rows={2} />
      <RailPanelSkeleton rows={3} />
      <RailPanelSkeleton rows={5} avatars />
    </aside>
  );
}

/* --------------------------------------------------------------- feed */

/** The feed: composer, then posts, with the rail beside them. */
export function FeedSkeleton() {
  return (
    <div className="columns">
      <div className="columns__main">
        <div className="skel-card">
          {/* `flex="1"` and not `width="100%"`: a 100%-wide bar in a flex row is
              100% of the ROW, so it could not sit beside the avatar and wrapped
              underneath it. `Bar` takes a flex value for exactly this — the same
              way the real composer's trigger is `flex: 1`. */}
          <div className="row" style={{ gap: '12px', alignItems: 'center', flexWrap: 'nowrap' }}>
            <Circle size={40} />
            <Bar flex="1" height="44px" radius="9999px" />
          </div>
        </div>
        <PostCardSkeleton lines={3} />
        <PostCardSkeleton media lines={2} />
        <PostCardSkeleton lines={4} />
      </div>
      <RightRailSkeleton />
    </div>
  );
}

/* ------------------------------------------------------------ friends */

/**
 * The friends screen: panels of person cells.
 *
 * `.person-grid` is the screen's own class, so the placeholder reflows into the
 * same number of columns at the same widths the real grid does.
 */
export function FriendsSkeleton() {
  return (
    <>
      {[4, 2, 6].map((count, panel) => (
        <div key={panel} className="skel-card">
          <Line w="28%" h={16} />
          <div className="person-grid" style={{ marginBlockStart: '12px' }}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start', gap: '12px' }}>
                <Circle size={40} />
                <div className="stack" style={{ flex: 1, gap: '6px' }}>
                  <Line w="72%" h={15} />
                  <Line w="52%" h={12} />
                  <Bar height="32px" radius="9999px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- groups */

/** Card grid: cover, name, two chips, description, button. */
export function GroupsSkeleton() {
  return (
    <>
      {[6, 4].map((count, panel) => (
        <div key={panel} className="skel-card">
          <Line w="24%" h={16} />
          <div className="card-grid" style={{ marginBlockStart: '12px' }}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="stack" style={{ gap: '8px' }}>
                <Bar width="100%" height="120px" radius="12px" />
                <Line w="62%" h={17} />
                <div className="row" style={{ gap: '8px' }}>
                  <Bar width="72px" height="28px" radius="9999px" />
                  <Bar width="84px" height="28px" radius="9999px" />
                </div>
                <Line w="100%" h={12} />
                <Line w="80%" h={12} />
                <Bar width="100%" height="32px" radius="9999px" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- events */

/**
 * Buckets of event rows.
 *
 * The 56px square is the date block, which is the one element on that screen a
 * reader navigates by — so it is the one the placeholder most needs to promise.
 */
export function EventsSkeleton() {
  return (
    <>
      {[2, 3, 3].map((count, panel) => (
        <div key={panel} className="skel-card">
          <Line w="22%" h={16} />
          <div className="event-list" style={{ marginBlockStart: '12px' }}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="event-row">
                <Bar width="56px" height="58px" radius="12px" />
                <div className="stack" style={{ gap: '6px' }}>
                  <Line w="46%" h={15} />
                  <Line w="34%" h={12} />
                  <Line w="40%" h={12} />
                  <Bar width="104px" height="30px" radius="9999px" />
                </div>
                <div className="row" style={{ gap: '4px' }}>
                  <Circle size={32} />
                  <Circle size={32} />
                  <Circle size={32} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------ profile */

/**
 * A profile: the cover banner with the avatar straddling its lower edge, the
 * counts, then a timeline — with the about and photo panels in the rail.
 *
 * The overlap is drawn the same way the real header draws it, from the same
 * `--profile-overlap`, so the two cannot disagree about where the avatar sits.
 */
export function ProfileSkeleton() {
  return (
    <div className="columns">
      <div className="columns__main">
        {/* No `overflow: hidden`: it clipped the avatar where it straddles the
            cover's lower edge, which is the one detail of this header worth
            promising. The cover keeps its own corners instead. */}
        <div className="skel-card" style={{ padding: 0 }}>
          <Bar width="100%" height="205px" radius="12px 12px 0 0" />
          <div
            className="row"
            style={{
              alignItems: 'flex-start',
              gap: '16px',
              padding: '0 16px 16px',
              marginBlockStart: 'calc(var(--profile-overlap, 36px) * -1)',
            }}
          >
            {/*
              THE RING IS WHAT MAKES IT VISIBLE, not the z-index.
              The circle was already painting over the cover and still could not
              be seen: a grey disc on a grey band is one shape. The real header
              separates them with a ring of the page's own ground
              (`.profile-head__avatar`), so the placeholder borrows the class
              rather than reinventing it.
            */}
            <span className="profile-head__avatar" style={{ position: 'relative', zIndex: 1 }}>
              <Circle size={62} />
            </span>
            <div
              className="stack"
              style={{
                flex: 1,
                gap: '6px',
                paddingBlockStart: 'calc(var(--profile-overlap, 36px) + 8px)',
              }}
            >
              <Line w="40%" h={24} />
              <Line w="26%" h={14} />
            </div>
          </div>
          <div className="row" style={{ gap: '32px', padding: '0 16px 16px' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="stack" style={{ gap: '4px' }}>
                <Line w="48px" h={20} />
                <Line w="64px" h={12} />
              </div>
            ))}
          </div>
        </div>
        <PostCardSkeleton lines={2} />
        <PostCardSkeleton media lines={3} />
      </div>
      <aside className="columns__rail">
        <RailPanelSkeleton rows={4} />
        <div className="skel-card">
          <Line w="40%" h={16} />
          <div
            className="photo-grid"
            style={{ marginBlockStart: '8px', background: 'transparent' }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Bar key={i} width="100%" height="86px" radius="0" />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* --------------------------------------------------------------- drills */

/** One post and the rail beside it. */
export function PostSkeleton() {
  return (
    <div className="columns">
      <div className="columns__main">
        <PostCardSkeleton media lines={3} />
      </div>
      <RightRailSkeleton />
    </div>
  );
}

/**
 * A group or an event: a banner, a title, some facts, then either a timeline or
 * a description — with two panels in the rail.
 */
export function CoverSkeleton({ timeline = false }: { timeline?: boolean }) {
  return (
    <div className="columns">
      <div className="columns__main">
        <div className="skel-card">
          <Bar width="100%" height="240px" radius="16px" />
          <Line w="52%" h={26} />
          <div className="row" style={{ gap: '8px' }}>
            <Bar width="86px" height="30px" radius="9999px" />
            <Bar width="104px" height="30px" radius="9999px" />
            <Bar width="128px" height="36px" radius="9999px" />
          </div>
          <Line w="100%" h={13} />
          <Line w="88%" h={13} />
        </div>
        {timeline ? (
          <>
            <PostCardSkeleton lines={2} />
            <PostCardSkeleton media lines={3} />
          </>
        ) : null}
      </div>
      <aside className="columns__rail">
        <RailPanelSkeleton rows={1} avatars />
        <RailPanelSkeleton rows={4} avatars />
      </aside>
    </div>
  );
}

/**
 * The fallback, for a screen that does not name its own.
 *
 * It is the FEED's shape rather than a neutral block, because the feed is the
 * screen a reader arrives on and the one any unnamed screen is most likely to
 * resemble. A neutral block would be the generic placeholder this file exists
 * to replace.
 */
export function ScreenSkeleton({ label }: { label?: string }) {
  return (
    <div aria-label={label} aria-busy="true">
      <FeedSkeleton />
    </div>
  );
}
