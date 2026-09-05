import { claimAll } from './claim.mjs';
/**
 * The post body's "see more".
 *
 * The clamp is CSS keyed off `data-clamped`, so expanding is one attribute —
 * and both labels were written into the button at build time, because this
 * module has no dictionary.
 */
export function enhanceBodies(root = document) {
  for (const button of claimAll(root, '.post-card__more', 'seeMore')) {
    const body = button.previousElementSibling;
    button.addEventListener('click', () => {
      const clamped = body?.hasAttribute('data-clamped');
      body?.toggleAttribute('data-clamped', !clamped);
      button.textContent =
        button.getAttribute(clamped ? 'data-less' : 'data-more') ?? button.textContent;
    });
  }
}
