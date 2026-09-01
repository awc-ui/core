/**
 * The planning screen's own non-component helpers — the Svelte translation of
 * the two hooks in the React build's `planning-parts.tsx`.
 *
 * Everything component-shaped from that file lives beside this as `.svelte`
 * files (`GoalCard`, `SliderControl`, `SelectField`, `Controls`,
 * `AdviceInFlight`, `MandateAssumptions`); React's `ActionButton` and `flag()`
 * have no Svelte counterpart at all — `on:mdClick` is a real listener on a raw
 * `md-button`, and a toggled boolean rides as `{cond || undefined}` (the same
 * `|| undefined` idiom the React build uses) so the off state is an ABSENT
 * attribute/undefined property, never the string `"false"` (an attribute's
 * presence disables a form-associated element regardless of its value).
 *
 * Nothing here is shared beyond this screen — `bits/` and `elements.ts` are
 * where the app-wide pieces live, and this directory must not grow into a
 * second one of those.
 */

import { readable, type Readable } from 'svelte/store';

/**
 * The 900px breakpoint the shell already swaps the rail and the bar at.
 *
 * The adjust controls are rendered in exactly ONE place — inline in the panel
 * above it, inside an `md-bottom-sheet` below it. Rendering both and hiding one
 * with CSS would put two identically-labelled sliders in the document, and
 * `md-bottom-sheet` never unmounts its content, so the copy in the sheet would
 * be permanent.
 */
const QUERY = '(max-width: 899px)';

export const compact: Readable<boolean> = readable(
  typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  (set) => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(QUERY);
    const sync = () => set(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  },
);

/**
 * Resolve MD3 colour roles to the hex strings the current theme defines.
 *
 * `md-color-picker` needs concrete colours for `value` and `presets` — a
 * `var(--md-sys-color-primary)` reference is not something it can parse. Rather
 * than inline a palette (which §9 forbids and which would ignore the accent
 * preset entirely), the values are read back off the token sheet, which is the
 * one place they are defined. The caller re-invokes this from a reactive
 * statement keyed on the dock state's `theme|seed` signature, since theme and
 * accent both rewrite these custom properties — that is what the otherwise
 * unused `signature` parameter is for.
 */
export function roleColors(roles: readonly string[], _signature: string): string[] {
  if (typeof window === 'undefined') return [];
  const styles = window.getComputedStyle(document.documentElement);
  return (
    roles
      .map((role) => styles.getPropertyValue(`--md-sys-color-${role}`).trim())
      // Anything that is not a plain hex is dropped rather than handed to the
      // picker, which would flag its hex field invalid and keep its old colour.
      .filter((value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))
  );
}
