/**
 * Everything this build does in the browser, in one module.
 *
 * The dock, the chart configuration that could not travel in an attribute, and
 * the shell behaviours (the rail toggle, the FAB). Every one of them improves a
 * page that is already complete and readable without it — the figures, the
 * tables and the whole frame are in the HTML. What arrives here is behaviour.
 *
 * The dock import is a bare side-effect import: it defines
 * `<awc-showcase-dock>` and stamps the persisted theme, density and accent onto
 * <html>. It deliberately does NOT touch lang/dir here — `data-locale-route` on
 * <html> tells it the language is settled by the URL.
 *
 * THE SCREENS PHASE ADDS ITS ENHANCEMENTS HERE — one `enhance*()` per
 * interactive behaviour (table sorting/paging, filters, and so on), each
 * idempotent via a `data-bound` marker and each DETACHING rather than hiding
 * DOM, so the live document keeps the exact element census the React build has.
 */

import '@awc-ui/showcase-kit/dock';
import { configureCharts } from './charts.mjs';
import { enhanceShell } from './shell.mjs';
import { enhanceBookTable } from './book-table.mjs';
import { enhancePerformancePeriods } from './performance.mjs';
import { enhanceQuickActions } from './quick-actions.mjs';
import { enhanceHoldings } from './holdings.mjs';
import { enhancePlanning } from './planning.mjs';
import { enhanceProposals } from './proposals.mjs';
import { enhanceRatings } from './ratings.mjs';

configureCharts();
enhanceShell();

// Overview screen. Each looks for its own marker and returns quietly on the
// other twelve pages.
enhanceBookTable();
enhancePerformancePeriods();
enhanceQuickActions();

// Holdings screen: the filter bar, both tables' sort and paging, and the export.
enhanceHoldings();

// Planning screen: the four filters and the sort, the objective picker, the
// what-if sliders (which call the kit's own goalProjection), the colour
// picker's live-token presets, and the compact bottom sheet.
enhancePlanning();

// Every screen with an md-rating. `getLabel` is a function prop with no
// attribute form, so without this the control falls back to the component's
// English defaults — on the Romanian and Arabic pages too.
enhanceRatings();

// Proposals screen: the builder's instrument universe. `md-transfer-list` takes
// it as a JS property, so unlike the enhancements above this one is not an
// improvement on a complete control — without it the step has an empty one.
enhanceProposals();
