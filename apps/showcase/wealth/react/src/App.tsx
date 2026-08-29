/**
 * The route table. Six patterns, resolved in the browser.
 *
 * Five of them are exact paths and one takes an id. The paths are not spelled
 * out here — they come from `route.*` in `@awc-ui/showcase-kit/wealth`, so the
 * strings this file matches on and the strings the rail links to are the same
 * strings. A literal `'/holdings/'` here would agree with the kit right up
 * until somebody renamed the route.
 *
 * THE 404 FOR AN UNKNOWN HOUSEHOLD ID is the screen's own guard, not this
 * file's. `HouseholdScreen` looks its id up and renders the empty state when
 * the fixture does not know it — a component taking a plain string from a URL
 * must not trust its caller.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside the shell's child list and shift every measured gap
 * when the other four ports are compared against this one.
 */

import { usePathname } from '@/lib/router';
import { route } from '@/lib/routes';
import { HoldingsScreen } from '@/components/screens/HoldingsScreen';
import { HouseholdScreen } from '@/components/screens/HouseholdScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { OverviewScreen } from '@/components/screens/OverviewScreen';
import { PlanningScreen } from '@/components/screens/PlanningScreen';
import { ProposalsScreen } from '@/components/screens/ProposalsScreen';
import { TradeScreen } from '@/components/screens/TradeScreen';

/**
 * The one parameterised route. `[^/]+` rather than `.+` so
 * `/households/hh-01/positions/` does not silently render household
 * `hh-01/positions`.
 */
const HOUSEHOLD = /^\/households\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.overview()) return <OverviewScreen />;
  if (pathname === route.holdings()) return <HoldingsScreen />;
  if (pathname === route.proposals()) return <ProposalsScreen />;
  if (pathname === route.trade()) return <TradeScreen />;
  if (pathname === route.planning()) return <PlanningScreen />;

  const household = HOUSEHOLD.exec(pathname);
  if (household) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // household" rather than "the id had a character in it".
    return <HouseholdScreen householdId={decodeURIComponent(household[1])} />;
  }

  return <NotFoundScreen />;
}
