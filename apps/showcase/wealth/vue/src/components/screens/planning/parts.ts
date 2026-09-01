/**
 * The planning screen's own composables and helpers — the Vue counterpart of
 * the hooks section of the React source's `planning-parts.tsx`.
 *
 * Nothing here is shared beyond this screen: `~/components/bits/` and
 * `~/lib/awc.ts` are where the app-wide pieces live, and this file must not
 * grow into a second one of those.
 */

import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { goalProjection } from '@awc-ui/showcase-kit/wealth';

/** One sample of `goalProjection`'s path. The kit exports the function, not the point. */
export type ProjectionPoint = ReturnType<typeof goalProjection>[number];

/**
 * NEVER WRITE `false` INTO A BOOLEAN ATTRIBUTE ON AN `md-*` ELEMENT. Omit it.
 *
 * The React source's `planning-parts.tsx` records the hour this cost: several of
 * these elements are `formAssociated: true`, and HTML says a form-associated
 * custom element CARRYING the `disabled` attribute is actually disabled — the
 * value is never looked at, so `disabled="false"` is a disabled button that
 * looks and reports as enabled. The same shape of bug applies to any attribute
 * a component's CSS selects on (`:host([full-width])` matches
 * `full-width="false"`).
 *
 * The Vue wrinkle is worse than the React one: once an element has upgraded,
 * Vue writes a plain `:disabled` binding as a PROPERTY (`key in el` is now
 * true) and leaves any attribute it wrote before the upgrade in place — so a
 * button disabled on first paint would stay platform-disabled forever after
 * being "enabled". Every changing boolean below therefore binds with the
 * `.attr` modifier, which forces the attribute path both ways: present (empty
 * string) when on, REMOVED when off. `flag()` is that convention with a name.
 */
export const flag = (on: boolean | undefined): '' | undefined => (on ? '' : undefined);

/**
 * The 900px breakpoint the shell already swaps the rail and the bar at.
 *
 * The adjust controls are rendered in exactly ONE mounted place — inline in the
 * projection panel above it, inside an `md-bottom-sheet` below it. Rendering
 * both and hiding one with CSS would put two identically-labelled sliders in
 * the document, and `md-bottom-sheet` never unmounts its content, so the copy
 * in the sheet would be permanent.
 */
export function useCompact(): Ref<boolean> {
  const query = '(max-width: 899px)';
  const mq = window.matchMedia(query);
  const compact = ref(mq.matches);
  const sync = () => {
    compact.value = mq.matches;
  };
  mq.addEventListener('change', sync);
  onScopeDispose(() => mq.removeEventListener('change', sync));
  return compact;
}

/**
 * Resolve MD3 colour roles to the hex strings the current theme defines.
 *
 * `md-color-picker` needs concrete colours for `value` and `presets` — a
 * `var(--md-sys-color-primary)` reference is not something it can parse. Rather
 * than inline a palette (which the house rules forbid and which would ignore
 * the accent preset entirely), the values are read back off the token sheet,
 * which is the one place they are defined. Re-read whenever `signature` (the
 * dock's theme|seed) changes, since theme and accent both rewrite these custom
 * properties; `flush: 'post'` so the read happens after the change has landed,
 * as the React source's effect does.
 */
export function useRoleColors(roles: readonly string[], signature: () => string): Ref<string[]> {
  const colors = ref<string[]>([]);

  watch(
    signature,
    () => {
      const styles = window.getComputedStyle(document.documentElement);
      colors.value = roles
        .map((role) => styles.getPropertyValue(`--md-sys-color-${role}`).trim())
        // Anything that is not a plain hex is dropped rather than handed to the
        // picker, which would flag its hex field invalid and keep its old colour.
        .filter((value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value));
    },
    { immediate: true, flush: 'post' },
  );

  return colors;
}
