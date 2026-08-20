/**
 * AWC UI — global scroll-reveal kickoff.
 *
 * Wires up `data-awc-reveal` and `data-awc-reveal-stagger` so that
 * landing-page sections fade + spring into view when they scroll into the
 * viewport. Respects `prefers-reduced-motion` (CSS already handles that
 * branch). Idle init keeps it off the critical path.
 */

const init = () => {
  const targets = document.querySelectorAll<HTMLElement>(
    '[data-awc-reveal], [data-awc-reveal-stagger]',
  );
  if (targets.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );

  targets.forEach((el) => observer.observe(el));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
