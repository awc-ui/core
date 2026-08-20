/**
 * True only when the story-coverage sweep is driving the browser.
 *
 * `play()` is NOT test-only — it runs whenever a story is VIEWED. Anything with
 * a visible side effect (flipping props, opening a picker, stepping a progress
 * bar) must therefore be gated, or every visitor watches the component thrash
 * before it settles. That exact regression shipped once: charts cycled through
 * stacked / polar / inverted / curve on open.
 *
 * The sweep opts in with `?awcCoverage=1` (see scripts/story-coverage.mjs); a
 * human opening the story never has it.
 */
export const drivingCoverage = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has("awcCoverage");
  } catch {
    return false;
  }
};

/** Let the component re-render between mutations, so each path really runs. */
export const settle = (frames = 2) =>
  new Promise<void>((resolve) => {
    let n = frames;
    const tick = () => (n-- > 0 ? requestAnimationFrame(tick) : resolve());
    tick();
  });

/**
 * Flip a set of props on an element, then restore them.
 *
 * Only props the element actually declares are touched, so one list can serve
 * several components. Restoring matters even though this runs last: a story
 * left in a mutated state misleads the next person to open it.
 */
export const exerciseProps = async (
  el: HTMLElement,
  entries: Array<[string, unknown]>,
): Promise<void> => {
  const target = el as unknown as Record<string, unknown>;
  const restore: Array<[string, unknown]> = [];
  for (const [prop, value] of entries) {
    if (!(prop in target)) continue;
    restore.push([prop, target[prop]]);
    target[prop] = value;
    await settle();
  }
  for (const [prop, value] of restore) target[prop] = value;
  await settle();
};
