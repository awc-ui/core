/**
 * The profile's three tabs.
 *
 * ALL THREE GRIDS ARE IN THE DOCUMENT and two are hidden, so switching is one
 * attribute per panel. `md-tabs` reports the new tab's `value` on
 * `mdTabChange`, and the panels are matched by `data-tab-panel` rather than by
 * position — a fourth tab inserted in the middle would otherwise silently show
 * the wrong grid.
 */

export function enhanceProfile(root = document) {
  const tabs = root.querySelector('.profile-tabs:not([data-bound])');
  if (!tabs) return;
  tabs.setAttribute('data-bound', '');

  const panels = [...root.querySelectorAll('[data-tab-panel]')];
  tabs.addEventListener('mdTabChange', (event) => {
    const value = event.detail?.value ?? 'posts';
    for (const panel of panels) {
      panel.toggleAttribute('hidden', panel.getAttribute('data-tab-panel') !== value);
    }
  });
}
