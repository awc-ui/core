import { claim } from './claim.mjs';
/**
 * The one piece of shell behaviour a static document cannot carry.
 *
 * 1. THE RAIL TOGGLE. The app bar's leading `menu` affordance switches the
 *    rail between its `standard` and `expanded` variants — the React shell
 *    holds this in provider state; here it is an attribute flip on the one
 *    rail in the document. It does not survive a navigation, which matches
 *    the React default (collapsed) rather than fighting it: the rail's labels
 *    cost 140px of the width a twelve-column holdings table wants.
 *
 * THERE IS NO FAB IN THIS VERTICAL to wire — Corvus puts its composer inline
 * at the top of the feed, so the rail's `slot="fab"` is empty and there is
 * nothing here to navigate.
 *
 * Idempotent via `data-bound`, the house rule for every enhancement in this
 * build.
 */

export function enhanceShell(root = document) {
  const appBar = root.querySelector('.shell__appbar');
  const rail = root.querySelector('.shell__rail');
  if (appBar && rail && claim(appBar, 'appBar')) {
    appBar.addEventListener('mdLeadingClick', () => {
      const expanded = rail.getAttribute('variant') === 'expanded';
      rail.setAttribute('variant', expanded ? 'standard' : 'expanded');
    });
  }

}
