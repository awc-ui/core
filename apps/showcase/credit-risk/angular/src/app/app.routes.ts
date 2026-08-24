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
 * splitting: a reader who only opens the overview never downloads the facility
 * screen's collateral and schedule tables. The cost is one chunk request on the
 * first visit to each section — paid once per session, because the router keeps
 * the loaded component for the life of the document.
 *
 * NO WILDCARD ROUTE, deliberately, and the same as the server-rendered twin. An
 * unknown path is answered by the HOST here, with a 404, because the only
 * documents on disk are the 95 the fan-out wrote. A host configured with a
 * history rewrite would hand such a path to the app instead, and Angular would
 * log "Cannot match any routes" and render nothing — a case that cannot arise
 * from any link this app produces, since every one of them is built from the
 * kit's fixture.
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
