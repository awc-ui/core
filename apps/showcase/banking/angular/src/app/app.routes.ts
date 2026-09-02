import type { Routes } from '@angular/router';

/**
 * The eight screens.
 *
 * Paths are declared without trailing slashes because that is what Angular's
 * router matches, while every link in the app keeps the kit's slashed form. See
 * `lib/routes.ts` for why the two shapes differ, and why a cold deep link at
 * the slashed form needs no conversion.
 *
 * Every screen is loaded lazily, and in this build that is the whole of the
 * code splitting: a reader who only opens the home screen never downloads the
 * invest screen's table. Paid once per session — the router keeps the loaded
 * component for the life of the document.
 *
 * ORDER MATTERS FOR ONE PAIR. `invest` and `invest/:id` share a prefix, so the
 * exact path is declared first; Angular matches in order, and the parameterised
 * route would otherwise swallow the index.
 *
 * A WILDCARD ROUTE, matching the React build, which ships a not-found screen
 * and renders it for any unmatched path that reaches the app. On the static
 * host, cold requests for unknown paths still 404 before the app runs — only
 * the fanned-out documents exist on disk.
 *
 * The unknown-ID 404 is each drill screen's own guard, not this file's: a
 * component taking a plain string from a URL must not trust its caller.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./screens/home.component').then((m) => m.HomeScreen),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./screens/transactions.component').then((m) => m.TransactionsScreen),
  },
  {
    path: 'exchange',
    loadComponent: () => import('./screens/exchange.component').then((m) => m.ExchangeScreen),
  },
  {
    path: 'invest',
    pathMatch: 'full',
    loadComponent: () => import('./screens/invest.component').then((m) => m.InvestScreen),
  },
  {
    path: 'invest/:id',
    loadComponent: () => import('./screens/instrument.component').then((m) => m.InstrumentScreen),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./screens/analytics.component').then((m) => m.AnalyticsScreen),
  },
  {
    path: 'cards',
    loadComponent: () => import('./screens/cards.component').then((m) => m.CardsScreen),
  },
  {
    path: 'accounts/:id',
    loadComponent: () => import('./screens/account.component').then((m) => m.AccountScreen),
  },
  {
    path: '**',
    loadComponent: () => import('./screens/not-found.component').then((m) => m.NotFoundScreen),
  },
];
