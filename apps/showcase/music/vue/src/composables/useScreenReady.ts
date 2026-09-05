/**
 * False for a beat the FIRST time a screen is opened, true immediately after.
 *
 * WHY NOT ON EVERY NAVIGATION. These screens read synchronous selectors out of
 * the kit — there is no fetch, and the real render cost is a few milliseconds.
 * A placeholder on every click therefore does not cover a wait, it MANUFACTURES
 * one: measured on the React source at 603ms from click to content, of which
 * 550ms was this timer. So the skeleton shows once per screen, where it is
 * honest about a first paint, and never again. Going back to a screen you have
 * already opened is immediate.
 *
 * Keyed on the PATHNAME, not on mount: two visits to the same screen TYPE — one
 * household then another — reuse the component instance, so a mount-only hook
 * would never re-run for the second.
 *
 * `?skeleton=` — an inspection handle on a state that is otherwise 550ms long:
 *
 *   ?skeleton=hold   the placeholder stays up and never resolves
 *   ?skeleton=4000   the placeholder lasts 4000ms instead of 550
 *
 * Either form also defeats the once-per-screen rule, so the placeholder shows
 * again every time you navigate rather than only on a first visit. Read once,
 * at module scope: it is a URL flag for looking at the app, not state.
 */

import { computed, onScopeDispose, ref, watch, type ComputedRef } from 'vue';
import { usePathname } from '~/lib/router';
import { SKELETON_MS } from '~/components/skeletons/constants';

/** Screens already visited in this session. Module scope, so it outlives every navigation. */
const seen = new Set<string>();

const SKELETON_FLAG = (() => {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('skeleton');
  if (raw === null) return null;
  if (raw === 'hold' || raw === '') return { hold: true, ms: 0 };
  const ms = Number.parseInt(raw, 10);
  return Number.isFinite(ms) && ms > 0 ? { hold: false, ms } : { hold: true, ms: 0 };
})();

export function useScreenReady(): ComputedRef<boolean> {
  const pathname = usePathname();
  const ready = ref(SKELETON_FLAG ? false : seen.has(pathname.value));
  let pending: ReturnType<typeof setTimeout> | undefined;

  watch(
    pathname,
    (path) => {
      // Cleared on the way out, so a fast click-through does not leave a
      // pending timeout that flips a screen the reader has already left.
      if (pending) clearTimeout(pending);
      // Held open on purpose — nothing to schedule, and nothing is ever marked
      // seen, so every navigation shows the placeholder again.
      if (SKELETON_FLAG?.hold) {
        ready.value = false;
        return;
      }
      if (!SKELETON_FLAG && seen.has(path)) {
        ready.value = true;
        return;
      }
      ready.value = false;
      pending = setTimeout(() => {
        seen.add(path);
        ready.value = true;
      }, SKELETON_FLAG?.ms ?? SKELETON_MS);
    },
    { immediate: true },
  );

  // The React source clears its timeout in the effect cleanup; this is the
  // same promise — a screen left before the beat ends is never marked seen.
  onScopeDispose(() => {
    if (pending) clearTimeout(pending);
  });

  return computed(() => ready.value);
}
