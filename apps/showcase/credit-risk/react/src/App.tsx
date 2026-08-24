/**
 * The route table. Six patterns, resolved in the browser.
 *
 * This is what `app/**\/page.tsx` was in the Next build — the same six screens
 * behind the same six paths — minus the two things only a build step could do:
 * `generateStaticParams()` and `dynamicParams = false`. NEITHER IS LOST:
 *
 * - The ENUMERATION moved to `scripts/fan-out-routes.mjs`, which reads the same
 *   fixture selectors (`getSectors`, `getCounterparties`, `getFacilities`) and
 *   writes one `index.html` per route so a cold deep link resolves on a static
 *   host. Add a row to the fixture and the page appears, with no edit here —
 *   exactly the property `generateStaticParams` had.
 * - The 404 FOR AN UNKNOWN ID is the screens' own guard. `SectorScreen`,
 *   `CounterpartyScreen` and `FacilityScreen` each look their id up and render
 *   the empty state when the fixture does not know it. In the Next build that
 *   branch was unreachable — `notFound()` fired first — and was kept because a
 *   component taking a plain string must not trust its caller. Here it is the
 *   live path, which is why the guard was worth keeping.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside `.shell`'s child list and shift every measured gap —
 * see the header of `scripts/verify-showcase-parity.mjs`.
 */

import { usePathname } from '@/lib/router';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { CounterpartyScreen } from '@/components/screens/CounterpartyScreen';
import { FacilityScreen } from '@/components/screens/FacilityScreen';
import { OverviewScreen } from '@/components/screens/OverviewScreen';
import { SectorScreen } from '@/components/screens/SectorScreen';
import { StressScreen } from '@/components/screens/StressScreen';
import { WatchlistScreen } from '@/components/screens/WatchlistScreen';

/**
 * The three drill routes share one shape: a collection, one id, a trailing
 * slash. `[^/]+` rather than `.+` so `/facilities/fac-001/covenants/` does not
 * silently render facility `fac-001/covenants`.
 */
const DRILL = /^\/(sectors|counterparties|facilities)\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === '/') return <OverviewScreen />;
  if (pathname === '/watchlist/') return <WatchlistScreen />;
  if (pathname === '/stress/') return <StressScreen />;

  const drill = DRILL.exec(pathname);
  if (drill) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // row" rather than "the id had a character in it".
    const id = decodeURIComponent(drill[2]);
    if (drill[1] === 'sectors') return <SectorScreen sectorId={id} />;
    if (drill[1] === 'counterparties') return <CounterpartyScreen counterpartyId={id} />;
    return <FacilityScreen facilityId={id} />;
  }

  return <NotFoundScreen />;
}
