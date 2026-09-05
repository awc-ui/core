/**
 * The placeholder shapes every screen shows while it settles.
 *
 * PLAIN DOM, NOT `md-skeleton`. Every shape is a `<div class="skel">` styled
 * from tokens in the kit's `app.css`, and that is the single most important
 * thing about this directory. `md-skeleton` and `md-card` are lazily-hydrated
 * custom elements exactly like the content they stand in for, so a placeholder
 * built from them catches the same disease it is there to treat: measured on
 * holdings (in the React build), it was 172px tall for three frames, 228px for
 * one more, and only then its real 1986. Divs have their size in the first
 * paint, before a chunk has loaded — the only property a placeholder actually
 * needs.
 *
 * `md-skeleton` remains the right answer for a placeholder INSIDE an already-
 * hydrated screen — a panel waiting on one fetch, a row streaming in. It is
 * the wrong answer for the placeholder that covers a screen's own first paint.
 *
 * THE PLACEHOLDER DOES NOT HAVE TO BE THE RIGHT HEIGHT. It is absolutely
 * positioned over the real content, which keeps its own box the whole time
 * (see the note in `components/Screen.svelte`), so revealing is a `visibility`
 * flip with no reflow. The heights in these files are still measured rather
 * than invented — copied from the React build's `skeletons.tsx`, which
 * measured them off rendered screens — because the shape should look like what
 * is coming.
 *
 * THE BEAT IS A CONSTANT, NEVER A MEASURED DURATION. These screens read
 * synchronous selectors out of the kit — there is no network here, and the
 * pause exists to demonstrate the pattern rather than to cover a real wait. A
 * clock-derived or random delay would also make two runs of the showcase
 * disagree, which the cross-framework parity check cannot tolerate.
 */

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides
 * it for inspection; see `useScreenReady` in `components/Screen.svelte`.
 */
export const SKELETON_MS = 550;

export { default as SkelBar } from './SkelBar.svelte';
export { default as SkelLine } from './SkelLine.svelte';
export { default as SkelCircle } from './SkelCircle.svelte';
export { default as PanelSkeleton } from './PanelSkeleton.svelte';
export { default as ScreenSkeleton } from './ScreenSkeleton.svelte';

/*
 * THE COMPOSITIONS — one per screen, each the SHAPE of what it covers rather
 * than a grey rectangle of about the right height. They are built from the
 * screens' own classes (`.columns`, `.person-grid`, `.event-row`,
 * `.photo-grid`), so a placeholder inherits every layout rule and cannot drift
 * from the screen at a breakpoint.
 */
export { default as PostCardSkeleton } from './PostCardSkeleton.svelte';
export { default as RailPanelSkeleton } from './RailPanelSkeleton.svelte';
export { default as RightRailSkeleton } from './RightRailSkeleton.svelte';
export { default as FeedSkeleton } from './FeedSkeleton.svelte';
export { default as FriendsSkeleton } from './FriendsSkeleton.svelte';
export { default as GroupsSkeleton } from './GroupsSkeleton.svelte';
export { default as EventsSkeleton } from './EventsSkeleton.svelte';
export { default as ProfileSkeleton } from './ProfileSkeleton.svelte';
export { default as PostSkeleton } from './PostSkeleton.svelte';
export { default as CoverSkeleton } from './CoverSkeleton.svelte';
