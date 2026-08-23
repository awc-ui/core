/**
 * Everything this build does in the browser, in one module.
 *
 * Four enhancements and the dock. Every one of them improves a page that is
 * already complete and readable without it — the tables, the figures, the
 * covenant meters and the whole watchlist are in the HTML. What arrives here is
 * behaviour: sortable headers, paging, working filters, the scenario switch,
 * chart axes, and the control bar.
 *
 * The dock import is a bare side-effect import: it defines
 * `<awc-showcase-dock>` and stamps the persisted theme, density and accent onto
 * <html>. It deliberately does NOT touch lang/dir here — `data-locale-route` on
 * <html> tells it the language is settled by the URL.
 */

import '@awc-ui/showcase-kit/dock';
import { configureCharts } from './charts.mjs';
import { enhancePagedTables } from './table.mjs';
import { enhanceWatchlistFilters } from './filters.mjs';
import { enhanceScenarioSelector } from './scenario.mjs';
import { enhanceChartDrilldowns } from './drill.mjs';

configureCharts();
enhancePagedTables();
enhanceWatchlistFilters();
enhanceScenarioSelector();
enhanceChartDrilldowns();
