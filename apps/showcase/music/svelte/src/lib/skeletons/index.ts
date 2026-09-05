export { default as HomeSkeleton } from './HomeSkeleton.svelte';
export { default as LibrarySkeleton } from './LibrarySkeleton.svelte';
export { default as StudioSkeleton } from './StudioSkeleton.svelte';
export { default as MixerSkeleton } from './MixerSkeleton.svelte';
export { default as ReleaseSkeleton } from './ReleaseSkeleton.svelte';
export { default as ProfileSkeleton } from './ProfileSkeleton.svelte';
export { default as ScreenSkeleton } from './ScreenSkeleton.svelte';

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides
 * it for inspection.
 */
export const SKELETON_MS = 550;
