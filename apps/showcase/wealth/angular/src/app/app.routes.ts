import type { Routes } from '@angular/router';

/**
 * The six screens.
 *
 * Paths are declared without trailing slashes because that is what Angular's
 * router matches, while every link in the app keeps the kit's slashed form. See
 * `lib/routes.ts` for why the two shapes differ at all, and why a cold deep link
 * at the slashed form needs no conversion.
 *
 * Every screen is loaded lazily, and in this build that is the whole of the code
 * splitting: a reader who only opens the overview never downloads the proposal
 * builder. The cost is one chunk request on the first visit to each section —
 * paid once per session, because the router keeps the loaded component for the
 * life of the document.
 *
 * A WILDCARD ROUTE, unlike the credit-risk Angular build — a deliberate
 * difference, because the two verticals' reference builds disagree. Credit-risk
 * has no not-found screen anywhere, so its Angular build leaves unknown paths
 * to the host's 404. Wealth's React build ships `NotFoundScreen` and renders it
 * for any unmatched path that reaches the app, so this build does the same:
 * under `ng serve` (which rewrites every path to the shell) and after any
 * in-app navigation to a dead path, the reader gets the same "nothing is served
 * at this address" screen as in React. On the static host, cold requests for
 * unknown paths still 404 before the app runs — only the 13 fanned-out
 * documents exist on disk.
 *
 * The unknown-HOUSEHOLD 404 is the household screen's own guard, not this
 * file's: a component taking a plain string from a URL must not trust its
 * caller.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./screens/overview.component').then((m) => m.OverviewScreen),
  },
  {
    path: 'holdings',
    loadComponent: () => import('./screens/holdings.component').then((m) => m.HoldingsScreen),
  },
  {
    path: 'households/:id',
    loadComponent: () => import('./screens/household.component').then((m) => m.HouseholdScreen),
  },
  {
    path: 'proposals',
    loadComponent: () => import('./screens/proposals.component').then((m) => m.ProposalsScreen),
  },
  {
    path: 'trade',
    loadComponent: () => import('./screens/trade.component').then((m) => m.TradeScreen),
  },
  {
    path: 'planning',
    loadComponent: () => import('./screens/planning.component').then((m) => m.PlanningScreen),
  },
  {
    path: '**',
    loadComponent: () => import('./screens/not-found.component').then((m) => m.NotFoundScreen),
  },
];
