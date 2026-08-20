/**
 * FLIP (First · Last · Invert · Play) engine for expressive MD3 table motion —
 * used by `md-table` (built-in `motion="expressive"` sort / page transitions)
 * and exported from `@awc-ui/core` for consumers that mutate rows outside the
 * table's own events (async refetches, custom filters, …).
 *
 * Movement is transform/opacity ONLY (never top/left/height), so an element's
 * box stays layout-invariant — frozen-header column measurement keeps reading
 * correct tracks mid-flight. Honours `prefers-reduced-motion` by mutating
 * instantly with no animation.
 */

export interface FlipOptions {
  /** What to animate inside the container. Default: 'md-table-row'. */
  selector?: string;
  /**
   * Stable identity per element (movers persist, others enter). Default:
   * ELEMENT IDENTITY (a WeakMap-issued id) — reordered / re-shown elements are
   * tracked across the mutation with no data attributes required; elements
   * recreated by an innerHTML rebuild count as entrants.
   */
  key?: (el: HTMLElement) => string;
  /** Constrain movement to one axis. Default: both. */
  axis?: 'x' | 'y' | 'both';
  /** Movement spring. 'fast' = bouncy (350ms), 'default' = larger (500ms). */
  spring?: 'fast' | 'default';
  /** Per-element enter stagger in ms (0 = none). */
  stagger?: number;
  /** Cap the stagger to the first N elements so long lists don't drag. */
  staggerCap?: number;
  /** Fade + drop-in elements that appear (were hidden before the mutation). */
  enter?: boolean;
  /**
   * Enter offset (px). Default -8: entrants drop in from slightly ABOVE.
   * Deliberately negative — a positive (below) offset extends the container's
   * scrollable overflow past its bottom edge mid-animation (transformed boxes
   * count toward scrollable overflow), which blips a scrollbar into view on
   * tables that fit their scroll container exactly.
   */
  enterFrom?: number;
}

const SPRING = {
  fast: 'var(--md-sys-motion-spring-spatial-fast-duration,350ms) var(--md-sys-motion-spring-spatial-fast-easing,cubic-bezier(0.42,1.67,0.21,0.9))',
  default:
    'var(--md-sys-motion-spring-spatial-default-duration,500ms) var(--md-sys-motion-spring-spatial-default-easing,cubic-bezier(0.38,1.21,0.22,1))',
};
const FADE =
  'opacity var(--md-sys-motion-spring-effects-fast-duration,150ms) var(--md-sys-motion-spring-effects-fast-easing,cubic-bezier(0.31,0.94,0.34,1))';

const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ignore micro-shifts. Real row moves are at least a row height; animating a
 *  few-px layout tremor (divider add/remove, rounding) is imperceptible AND
 *  harmful: the transformed boxes inflate the scroll container's scrollable
 *  overflow mid-glide, blipping a scrollbar into view on content that fits
 *  its container exactly. */
const MIN_DELTA = 6;

const clearInline = (el: HTMLElement) => {
  el.style.transition = '';
  el.style.transform = '';
  el.style.transitionDelay = '';
  el.style.willChange = '';
  el.style.opacity = '';
};

// Identity keys: the same DOM node keeps its id across any reorder, so the
// default keying needs no data attributes on consumer rows.
const identityIds = new WeakMap<HTMLElement, string>();
let nextIdentityId = 0;
const identityKey = (el: HTMLElement): string => {
  let id = identityIds.get(el);
  if (!id) {
    id = String(++nextIdentityId);
    identityIds.set(el, id);
  }
  return id;
};

/**
 * Snapshot the container's elements NOW (FIRST) and return a `play()` that —
 * called after the DOM has been mutated — animates every surviving element
 * from its old box to its new one (and, with `enter`, fades + rises elements
 * that appeared). This is the bracketing primitive `md-table` uses around its
 * sort / page events; `flipRows` wraps it for synchronous mutations.
 *
 * Under `prefers-reduced-motion` the returned `play()` is a no-op.
 */
export function captureFlip(container: HTMLElement, opts: FlipOptions = {}): () => void {
  const selector = opts.selector ?? 'md-table-row';
  const key = opts.key ?? identityKey;
  const axis = opts.axis ?? 'both';
  const springVal = SPRING[opts.spring ?? 'fast'];
  const stagger = opts.stagger ?? 0;
  const staggerCap = opts.staggerCap ?? 6;
  const enterFrom = opts.enterFrom ?? -8;

  if (prefersReduced()) return () => undefined;

  // FIRST — snapshot boxes of every currently laid-out element.
  const first = new Map<string, DOMRect>();
  (Array.from(container.querySelectorAll(selector)) as HTMLElement[]).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) first.set(key(el), r);
  });

  return () => {
    requestAnimationFrame(() => {
      const movers: Array<{ el: HTMLElement; dx: number; dy: number }> = [];
      const enterers: HTMLElement[] = [];
      (Array.from(container.querySelectorAll(selector)) as HTMLElement[]).forEach((el) => {
        // Skip elements already animating (e.g. a consumer's own flipRows call
        // overlapping the built-in bracketing) — never double-animate.
        if (el.style.transition.includes('transform')) return;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return; // still hidden — not part of this frame
        const f = first.get(key(el));
        if (f) {
          const dx = axis === 'y' ? 0 : f.left - r.left;
          const dy = axis === 'x' ? 0 : f.top - r.top;
          if (Math.abs(dx) > MIN_DELTA || Math.abs(dy) > MIN_DELTA) movers.push({ el, dx, dy });
        } else if (opts.enter) {
          enterers.push(el);
        }
      });

      // INVERT — jump each element back to where it was (transform only).
      movers.forEach(({ el, dx, dy }) => {
        el.style.transition = 'none';
        el.style.willChange = 'transform';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      enterers.forEach((el) => {
        el.style.transition = 'none';
        el.style.transform = `translateY(${enterFrom}px)`;
        el.style.opacity = '0';
      });

      // PLAY — force one style recalc so the inverted transforms are committed
      // BEFORE release, then let the transition carry each element to rest.
      // NB: this must be a method CALL, not a bare property read like
      // `void container.offsetHeight` — Stencil's production minifier runs with
      // pure_getters and deletes side-effect-free reads, which silently kills
      // the reflow (and with it the whole animation) in the dist build.
      container.getBoundingClientRect();
      const play = (el: HTMLElement, i: number, isEnter: boolean) => {
        el.style.transition = `transform ${springVal}` + (isEnter ? `, ${FADE}` : '');
        el.style.transitionDelay = `${Math.min(i, staggerCap) * stagger}ms`;
        el.style.transform = '';
        if (isEnter) el.style.opacity = '';
        const done = (e: TransitionEvent) => {
          if (e.propertyName !== 'transform') return;
          el.removeEventListener('transitionend', done);
          el.removeEventListener('transitioncancel', done);
          clearInline(el);
        };
        el.addEventListener('transitionend', done);
        // An interrupted transition (row hidden / restyled mid-flight) fires
        // cancel, not end — clear immediately rather than lingering on the
        // timeout with a transform that inflates the scrollable overflow.
        el.addEventListener('transitioncancel', done);
        // Fallback: a zero-delta element never fires transitionend, and a
        // dropped event must not strand a row mid-transform / at opacity 0.
        setTimeout(() => clearInline(el), 700 + staggerCap * stagger);
      };
      movers.forEach((m, i) => play(m.el, i, false));
      enterers.forEach((el, i) => play(el, i, true));
    });
  };
}

/**
 * Run `mutate` (a real DOM change — reorder / show-hide) and animate the
 * visible elements from their old boxes to their new ones. Persisting elements
 * glide; newly-shown elements fade + rise (when `enter`). Honours
 * prefers-reduced-motion by mutating instantly.
 */
export function flipRows(container: HTMLElement, mutate: () => void, opts: FlipOptions = {}): void {
  if (prefersReduced()) {
    mutate();
    return;
  }
  const play = captureFlip(container, opts);
  mutate();
  play();
}
