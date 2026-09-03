/**
 * Every page this build writes, as `{ path, render }`.
 *
 * ONE LIST, TWO CONSUMERS. `scripts/build.mjs` writes a file per entry per
 * locale and `scripts/lint.mjs` renders every entry in every locale looking for
 * the three smells a template-literal renderer produces. Written twice, the two
 * would agree until the first screen was added to one of them.
 *
 * THE DRILLS COME FROM THE FIXTURE, not from a hard-coded table: an account
 * added to the kit adds a page here without a second edit, which is the same
 * contract the four SPA builds' fan-out scripts follow.
 */

import { getAccounts, getInstruments, route } from '@awc-ui/showcase-kit/banking';
import { homeScreen } from './screens/home.mjs';
import { transactionsScreen } from './screens/transactions.mjs';
import { exchangeScreen } from './screens/exchange.mjs';
import { investScreen } from './screens/invest.mjs';
import { analyticsScreen } from './screens/analytics.mjs';
import { cardsScreen } from './screens/cards.mjs';
import { accountScreen } from './screens/account.mjs';
import { instrumentScreen } from './screens/instrument.mjs';

export function routes() {
  return [
    { path: route.home(), render: (t, locale) => homeScreen(t, locale) },
    { path: route.transactions(), render: (t, locale) => transactionsScreen(t, locale) },
    { path: route.exchange(), render: (t, locale) => exchangeScreen(t, locale) },
    { path: route.invest(), render: (t, locale) => investScreen(t, locale) },
    { path: route.analytics(), render: (t, locale) => analyticsScreen(t, locale) },
    { path: route.cards(), render: (t, locale) => cardsScreen(t, locale) },
    ...getAccounts().map((account) => ({
      path: route.account(account.id),
      render: (t, locale) => accountScreen(t, locale, account.id),
    })),
    /* Every instrument, held or merely watched — the invest screen links to
       both lists, so both need a page behind them. */
    ...getInstruments().map((instrument) => ({
      path: route.instrument(instrument.id),
      render: (t, locale) => instrumentScreen(t, locale, instrument.id),
    })),
  ];
}
