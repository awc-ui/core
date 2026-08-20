/**
 * Programmatically trigger a centered ripple wave on an `<md-ripple>` element
 * inside a component's shadow root. Used to give visual feedback for keyboard
 * activations (Enter / Space), since `md-ripple` only listens to `pointerdown`.
 *
 * Pass a CSS selector to scope to a specific ripple when a component renders
 * more than one (e.g. split-button leading vs. trailing).
 */
/** Matches `md-ripple` release fade — also used by `md-menu-item` before `menu.close()`. */
export const RIPPLE_RELEASE_FADE_MS = 150;

/** Upper bound for grow + fade when awaiting ripple completion. */
export const RIPPLE_MAX_SETTLE_MS = 600;

export interface RippleElement extends HTMLElement {
  trigger?: () => Promise<void>;
  whenSettled?: () => Promise<void>;
}

export function triggerRipple(host: HTMLElement, selector: string = 'md-ripple'): void {
  const ripple = host.shadowRoot?.querySelector(selector) as RippleElement | null;
  ripple?.trigger?.();
}

/**
 * Wait until the host's `<md-ripple>` wave has finished (grow + release fade).
 * Falls back to {@link RIPPLE_RELEASE_FADE_MS} when no ripple is present.
 */
export async function waitForHostRipple(
  host: HTMLElement,
  selector: string = 'md-ripple',
): Promise<void> {
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ripple = host.shadowRoot?.querySelector(selector) as RippleElement | null;
  if (typeof ripple?.whenSettled === 'function') {
    await ripple.whenSettled();
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, RIPPLE_RELEASE_FADE_MS));
    return;
  }
  /* Match md-menu-item: at least one release-fade beat even if the wave settled instantly. */
  const elapsed =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  if (elapsed < RIPPLE_RELEASE_FADE_MS) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, RIPPLE_RELEASE_FADE_MS - elapsed),
    );
  }
}
