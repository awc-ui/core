/** Private bridge for capturing tab geometry before its rail changes layout. */
const transitionPreparations = new WeakMap<HTMLElement, () => void>();

export function registerRailTabTransition(
  element: HTMLElement,
  callback: () => void,
): () => void {
  transitionPreparations.set(element, callback);
  return () => {
    // A disconnected instance must not unregister a newer connection's callback.
    if (transitionPreparations.get(element) === callback) {
      transitionPreparations.delete(element);
    }
  };
}

export function prepareRailTabTransition(element: HTMLElement): void {
  transitionPreparations.get(element)?.();
}

export interface RailTransitionTiming {
  duration: number;
  easing: string;
  /** The actual width transition, including its shortened reversal clock. */
  source?: Animation;
}

export function parseRailMotionDuration(raw: string, fallback = 200): number {
  const value = raw.trim();
  if (!/^(?:\d*\.)?\d+(?:ms|s)?$/.test(value)) return fallback;
  const duration = Number.parseFloat(value) * (value.endsWith('s') && !value.endsWith('ms') ? 1000 : 1);
  return Number.isFinite(duration) && duration >= 0 ? duration : fallback;
}

/**
 * CSS shortens a transition when it reverses. Reading the authored token alone
 * would restart a destination's animation for the full duration while its rail
 * had already finished closing. Use the browser's actual width-animation clock.
 */
export function getRailTransitionTiming(
  destination: HTMLElement,
  fallback: RailTransitionTiming,
): RailTransitionTiming {
  const rail = destination.closest('md-navigation-rail') as HTMLElement | null;
  if (!rail) return fallback;
  const surface = rail.hasAttribute('modal')
    ? rail.shadowRoot?.querySelector<HTMLElement>('[part="container"]') ?? rail
    : rail;
  // Flush the target layout before reading its generated CSS transitions.
  surface.getBoundingClientRect();
  const animations = typeof surface.getAnimations === 'function' ? surface.getAnimations() : [];
  const source = animations.find((animation) => {
    const property = (animation as Animation & { transitionProperty?: string }).transitionProperty;
    return (property === 'width' || property === 'inline-size') && animation.playState !== 'finished';
  });
  if (source?.effect) {
    const effect = source.effect as KeyframeEffect;
    const timing = effect.getTiming();
    const duration = effect.getComputedTiming().duration;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
      // CSS transitions may put their curve on the first keyframe instead of
      // the effect; preserve that curve instead of silently substituting linear.
      const keyframeEasing = effect.getKeyframes?.()[0]?.easing;
      return {
        duration,
        easing: keyframeEasing && keyframeEasing !== 'linear'
          ? keyframeEasing : timing.easing || fallback.easing,
        source,
      };
    }
  }
  // A zero-duration transition does not appear in getAnimations().
  const css = getComputedStyle(surface);
  const properties = css.transitionProperty?.split(',').map((value) => value.trim()) ?? [];
  const index = properties.findIndex((value) => ['all', 'width', 'inline-size'].includes(value));
  const durations = css.transitionDuration?.split(',') ?? [];
  if (properties.includes('none') || (index >= 0 && durations.length && parseRailMotionDuration(durations[index % durations.length]) === 0)) {
    return { ...fallback, duration: 0 };
  }
  return fallback;
}

/** Align with a width transition that may still be waiting for its first frame. */
export function synchronizeRailAnimation(
  animation: Animation,
  source: Animation | undefined,
  isCurrent: () => boolean,
): void {
  if (!source) return;
  const align = () => {
    if (isCurrent() && typeof source.startTime === 'number') animation.startTime = source.startTime;
  };
  align();
  if (source.startTime === null && source.ready) {
    void source.ready.then(align, () => undefined);
  }
}
