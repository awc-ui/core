/**
 * Everything this build does in the browser, in one module.
 *
 * The dock, the chart configuration that could not travel in an attribute, the
 * shell behaviours, and one enhancement per interactive screen. Every one of
 * them improves a page that is already complete and readable without it: the
 * figures, the tables, the statement and the whole frame are in the HTML.
 * What arrives here is behaviour.
 *
 * The dock import is a bare side-effect import: it defines
 * `<awc-showcase-dock>` and stamps the persisted theme, density and accent onto
 * <html>. It deliberately does NOT touch lang/dir — `data-locale-route` on
 * <html> tells it the language is settled by the URL.
 *
 * FOUR OF THE EIGHT SCREENS ARE STATIC. Home, analytics, the account drill and
 * the instrument drill hold no state in any of the five builds, so they have no
 * enhancement here and need none. Each `enhance*()` below looks for its own
 * marker and returns quietly on the seven pages that are not its own.
 */

import '@awc-ui/showcase-kit/dock';
import { configureCharts } from './charts.mjs';
import { enhanceShell } from './shell.mjs';
import { enhanceTransactions } from './transactions.mjs';
import { enhanceExchange } from './exchange.mjs';
import { enhanceTrade } from './trade.mjs';
import { enhanceCards } from './cards.mjs';

configureCharts();
enhanceShell();

// The statement: the month, the three facets, the search, the count and the
// reset — and the filter panel's phone placement.
enhanceTransactions();

// The exchange desk: the pair, the amount, the re-priced quote, the swap gate
// and the rate history beside it.
enhanceExchange();

// The investing screen: the ticket's estimate, and the holdings table's phone
// replacement.
enhanceTrade();

// The cards screen: the card picker, the freeze switch and the three controls,
// and the snackbar all of them raise.
enhanceCards();
