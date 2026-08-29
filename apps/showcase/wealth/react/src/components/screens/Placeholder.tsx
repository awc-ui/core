/**
 * The stand-in body every screen carries until its own agent fills it in.
 *
 * It exists so the app runs end to end before a single screen is written: the
 * shell, the router, the rail, the bar, the crumbs and the dock can all be
 * exercised on day one, and each screen agent then deletes exactly one import
 * and one element.
 *
 * `md-skeleton` rather than a paragraph of grey text, because a skeleton is
 * what the library ships for "this is content-shaped and not here yet" — and
 * because it makes the unfinished state obvious in a screenshot instead of
 * looking like a rendering bug.
 */

import { useT } from '@/lib/showcase';
import { Panel } from '../Shell';

export function PlaceholderBody() {
  const t = useT();
  return (
    <Panel title={t('wealth.empty.generic')} subtitle={t('wealth.screen.placeholder')}>
      <div className="stack">
        {/*
          `announce={false}` on both: `md-skeleton` is a live region by default,
          and this is not loading — nothing is on its way. Announcing "Loading"
          for a screen that is simply unbuilt would be a lie told politely.
          `aria-label` is localised because the component's default is the
          English word.
        */}
        <md-skeleton
          variant="rectangular"
          height="180px"
          full-width
          announce={false}
          aria-label={t('wealth.screen.placeholder')}
        />
        <md-skeleton
          variant="text"
          lines="3"
          full-width
          announce={false}
          aria-label={t('wealth.screen.placeholder')}
        />
      </div>
    </Panel>
  );
}
