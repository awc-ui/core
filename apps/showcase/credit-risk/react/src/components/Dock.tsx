/**
 * `<awc-showcase-dock>` — the same bar on every screen.
 *
 * The bare import is the registration: the module defines the element and
 * immediately stamps the persisted/URL state onto <html>. It survives bundling
 * because the kit marks `./dist/dock/index.mjs` in `sideEffects` — Rollup would
 * otherwise drop an import whose only value is what it does. Nothing here
 * listens for `awc-showcase-change`; `ShowcaseProvider` owns the single
 * subscription, and a second listener would double-render every screen.
 *
 * `frameworks` lists SEVEN ids, not six: `react` — this build — is the
 * client-routed SPA, and `next` is the runtime server-rendered one that used to
 * occupy this segment. Both are real entries in the switcher, which is the
 * whole point of splitting them.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this build's own
 * mount — the dock swaps the segment inside the path it finds, and only falls
 * back to `base-path` when the current segment is not in the URL. That is also
 * why switching to another framework from here needs no code in the dock: it
 * rewrites `location.pathname` and re-appends the state query.
 */

import '@awc-ui/showcase-kit/dock';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '@/lib/routes';

export function Dock() {
  return (
    <awc-showcase-dock
      frameworks={FRAMEWORKS.join(',')}
      framework={FRAMEWORK}
      base-path={SHOWCASE_BASE}
      position="bottom"
    />
  );
}
