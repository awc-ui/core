/**
 * State that belongs to the FRAME rather than to a screen, and therefore has
 * to outlive one.
 *
 * The route outlet in `App.svelte` swaps a different screen component per
 * route, so anything a screen holds is torn down by each navigation. The frame
 * (`AppFrame.svelte`) is mounted once, above the outlet, and this store is
 * module-scoped beside it — expand the rail, go to Holdings, and it stays
 * expanded.
 *
 * Only the rail's expansion lives here today. Resist adding screen state to
 * it: a screen's filters SHOULD reset when you leave the screen, and the
 * outlet's teardown is exactly the mechanism that makes them.
 */

import { writable } from 'svelte/store';

/** Collapsed by default: the rail's labels cost 140px of the width a
 * twelve-column holdings table wants, and the icons plus the active indicator
 * already say where you are. */
export const railExpanded = writable(false);

export function toggleRail(): void {
  railExpanded.update((open) => !open);
}
