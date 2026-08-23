import type { Routes } from '@angular/router';

/**
 * The six screens.
 *
 * Paths are declared without trailing slashes because that is what Angular's
 * router matches; `scripts/prerender-routes.mjs` writes the same shape, and the
 * builder still emits each one as a directory with an `index.html`. See
 * `lib/routes.ts` for why the two shapes differ at all.
 *
 * Every screen is loaded lazily. It costs nothing at prerender time and means a
 * reader who only opens the overview never downloads the facility screen's
 * collateral and schedule tables.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./screens/overview.component').then((m) => m.OverviewScreen),
  },
  {
    path: 'watchlist',
    loadComponent: () => import('./screens/watchlist.component').then((m) => m.WatchlistScreen),
  },
  {
    path: 'stress',
    loadComponent: () => import('./screens/stress.component').then((m) => m.StressScreen),
  },
  {
    path: 'sectors/:sector',
    loadComponent: () => import('./screens/sector.component').then((m) => m.SectorScreen),
  },
  {
    path: 'counterparties/:id',
    loadComponent: () =>
      import('./screens/counterparty.component').then((m) => m.CounterpartyScreen),
  },
  {
    path: 'facilities/:id',
    loadComponent: () => import('./screens/facility.component').then((m) => m.FacilityScreen),
  },
];
