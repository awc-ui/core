/**
 * State that belongs to the FRAME rather than to a screen, and therefore has to
 * outlive one.
 *
 * The route outlet in `App.vue` renders a different component per route, so
 * anything held inside a screen is reset by each navigation. In the React
 * source this is `ShellProvider`, a context above the router; Vue has reactive
 * values that survive outside the tree, so a module-level ref is the whole
 * store — the same shape `useShowcase.ts` and `lib/router.ts` use.
 *
 * Only the rail's expansion lives here today. Resist adding screen state to it:
 * a screen's filters SHOULD reset when you leave the screen, and the per-route
 * unmount is exactly the mechanism that makes them.
 */

import { ref, type Ref } from 'vue';

// Collapsed by default: the rail's labels cost 140px of the width a
// twelve-column holdings table wants, and the icons plus the active indicator
// already say where you are.
const railExpanded: Ref<boolean> = ref(false);

export function useShell(): { railExpanded: Ref<boolean>; toggleRail(): void } {
  return {
    railExpanded,
    toggleRail: () => {
      railExpanded.value = !railExpanded.value;
    },
  };
}
