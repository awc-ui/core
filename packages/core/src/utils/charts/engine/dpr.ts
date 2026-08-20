/*
 * Chart engine — device-pixel-ratio watcher
 * ===========================================================
 * A canvas is drawn at a fixed `cssPx × devicePixelRatio` backing
 * store. Browser zoom changes `devicePixelRatio` WITHOUT changing
 * the element's CSS size, so a ResizeObserver never fires and the
 * canvas ends up under-resolved (upscaled → blurry) while the DOM
 * overlay stays crisp. This watches `devicePixelRatio` via a
 * `(resolution: Ndppx)` media query and re-renders when it changes.
 * ===========================================================
 */

export interface DprWatcher {
  /** Re-arm the watch for the current devicePixelRatio (call each render). */
  update(): void;
  dispose(): void;
}

export function watchDevicePixelRatio(onChange: () => void): DprWatcher {
  let mql: MediaQueryList | null = null;
  let listener: (() => void) | null = null;
  let armed = 0;

  const update = (): void => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const dpr = window.devicePixelRatio || 1;
    if (dpr === armed && mql) return; // already watching this ratio
    if (mql && listener) mql.removeEventListener?.('change', listener);
    armed = dpr;
    // Matches while the ratio equals `dpr`; stops matching (fires `change`)
    // the moment it shifts — e.g. a browser zoom step.
    mql = window.matchMedia(`(resolution: ${dpr}dppx)`);
    listener = onChange;
    mql.addEventListener?.('change', listener);
  };

  const dispose = (): void => {
    if (mql && listener) mql.removeEventListener?.('change', listener);
    mql = null;
    listener = null;
    armed = 0;
  };

  return { update, dispose };
}
