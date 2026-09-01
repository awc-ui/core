/**
 * The route table. Eight patterns, resolved in the browser.
 *
 * Six are exact paths and two take an id. The paths are not spelled out here —
 * they come from `route.*` in `@awc-ui/showcase-kit/banking`, so the strings
 * this file matches on and the strings the rail links to are the same strings.
 * A literal `'/transactions/'` here would agree with the kit right up until
 * somebody renamed the route.
 *
 * ORDER MATTERS FOR ONE PAIR. `/invest/` and `/invest/<id>/` share a prefix, so
 * the exact match is tested before the pattern; the pattern's `[^/]+` would
 * otherwise never see a trailing-slash-only path but WOULD match a future
 * `/invest/settings/`. Testing exact-first keeps that from becoming a lookup
 * for an instrument called "settings".
 *
 * THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. Each
 * drill screen looks its id up and renders the empty state when the fixture
 * does not know it — a component taking a plain string from a URL must not
 * trust its caller.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside the shell's child list and shift every measured gap
 * when the other four ports are compared against this one.
 */

import { usePathname } from '@/lib/router';
import { route } from '@/lib/routes';
import { AccountScreen } from '@/components/screens/AccountScreen';
import { AnalyticsScreen } from '@/components/screens/AnalyticsScreen';
import { CardsScreen } from '@/components/screens/CardsScreen';
import { ExchangeScreen } from '@/components/screens/ExchangeScreen';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { InstrumentScreen } from '@/components/screens/InstrumentScreen';
import { InvestScreen } from '@/components/screens/InvestScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { TransactionsScreen } from '@/components/screens/TransactionsScreen';

/**
 * The two parameterised routes. `[^/]+` rather than `.+` so
 * `/accounts/acc-eur/statement/` does not silently render account
 * `acc-eur/statement`.
 */
const ACCOUNT = /^\/accounts\/([^/]+)\/$/;
const INSTRUMENT = /^\/invest\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.home()) return <HomeScreen />;
  if (pathname === route.transactions()) return <TransactionsScreen />;
  if (pathname === route.exchange()) return <ExchangeScreen />;
  if (pathname === route.invest()) return <InvestScreen />;
  if (pathname === route.analytics()) return <AnalyticsScreen />;
  if (pathname === route.cards()) return <CardsScreen />;

  const account = ACCOUNT.exec(pathname);
  if (account) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // account" rather than "the id had a character in it".
    return <AccountScreen accountId={decodeURIComponent(account[1])} />;
  }

  const instrument = INSTRUMENT.exec(pathname);
  if (instrument) {
    return <InstrumentScreen instrumentId={decodeURIComponent(instrument[1])} />;
  }

  return <NotFoundScreen />;
}
