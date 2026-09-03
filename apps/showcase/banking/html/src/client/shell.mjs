/**
 * The two pieces of shell behaviour a static document cannot carry.
 *
 * 1. THE RAIL TOGGLE. The app bar's leading `menu` affordance switches the
 *    rail between its `standard` and `expanded` variants — the React shell
 *    holds this in provider state; here it is an attribute flip on the one
 *    rail in the document. It does not survive a navigation, which matches
 *    the React default (collapsed) rather than fighting it: the rail's labels
 *    cost 140px of the width a twelve-column holdings table wants.
 *
 * 2. THE FAB. `md-fab` has no `href` prop and its `mdClick` has no veto hook,
 *    so the build stamps the target on `data-fab-href` and this listens and
 *    navigates — a full page load, which is this build's routing. With
 *    JavaScript off the FAB is inert, which is honest: it is an md-* element
 *    and renders nothing without the runtime anyway.
 *
 * Both are idempotent via `data-bound`, the house rule for every enhancement
 * in this build.
 */

export function enhanceShell(root = document) {
  const appBar = root.querySelector('.shell__appbar');
  const rail = root.querySelector('.shell__rail');
  if (appBar && rail && !appBar.hasAttribute('data-bound')) {
    appBar.setAttribute('data-bound', '');
    appBar.addEventListener('mdLeadingClick', () => {
      const expanded = rail.getAttribute('variant') === 'expanded';
      rail.setAttribute('variant', expanded ? 'standard' : 'expanded');
    });
  }

  const fab = root.querySelector('md-fab[data-fab-href]');
  if (fab && !fab.hasAttribute('data-bound')) {
    fab.setAttribute('data-bound', '');
    fab.addEventListener('mdClick', () => {
      window.location.assign(fab.getAttribute('data-fab-href'));
    });
  }
}
