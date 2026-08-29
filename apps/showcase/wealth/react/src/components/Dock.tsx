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
 * `frameworks` is the kit's list for THIS vertical, which is five ids, not the
 * credit-risk console's ten. Only `react` is built today; the switcher renders
 * the rest because the roster belongs to the route table, not to whichever
 * ports happen to exist this week.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this build's own
 * mount — the dock swaps the segment inside the path it finds, and only falls
 * back to `base-path` when the current segment is not in the URL. That is also
 * why switching to another framework from here needs no code in the dock: it
 * rewrites `location.pathname` and re-appends the state query.
 */

import '@awc-ui/showcase-kit/dock';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '@/lib/routes';
import { useT } from '@/lib/showcase';

export function Dock() {
  const t = useT();
  return (
    <awc-showcase-dock
      frameworks={FRAMEWORKS.join(',')}
      framework={FRAMEWORK}
      base-path={SHOWCASE_BASE}
      position="bottom"
      /*
       * `label` IS REQUIRED HERE, even though it looks optional.
       *
       * The dock falls back to `t('app.title')` for its own heading, and that
       * key belongs to the first vertical — so an unlabelled dock in this app
       * announces itself as "Credit Risk Console" under a wealth console. It is
       * a shared component with one fallback and two consumers; naming it is
       * the consumer's job.
       */
      label={t('wealth.app.title')}
    />
  );
}
