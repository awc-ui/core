import type { Routes } from '@angular/router';

/**
 * The seven screens.
 *
 * Paths are declared without trailing slashes because that is what Angular's
 * router matches, while every link in the app keeps the kit's slashed form. See
 * `lib/routes.ts` for why the two shapes differ, and why a cold deep link at
 * the slashed form needs no conversion.
 *
 * Every screen is loaded lazily, and in this build that is the whole of the
 * code splitting. Paid once per session — the router keeps the loaded component
 * for the life of the document.
 *
 * A PERSON IS MATCHED BY HANDLE, not by id, which is the one thing about this
 * router that differs from the three verticals next door. The kit's note on
 * `route.person` says why: a handle is a person's public address, and
 * `/people/per-07/` would be the single detail that made this app feel unlike
 * the thing it models. A handle contains a dot, which Angular's matcher treats
 * as an ordinary path character.
 *
 * A WILDCARD ROUTE renders the not-found screen for any unmatched path that
 * reaches the app. On the static host, cold requests for unknown paths still
 * 404 before the app runs — only the fanned-out documents exist on disk.
 *
 * The unknown-ID 404 is each drill screen's own guard, not this file's: a
 * component taking a plain string from a URL must not trust its caller.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./screens/feed.component').then((m) => m.FeedScreen),
  },
  {
    path: 'explore',
    loadComponent: () => import('./screens/explore.component').then((m) => m.ExploreScreen),
  },
  {
    path: 'create',
    loadComponent: () => import('./screens/create.component').then((m) => m.CreateScreen),
  },
  {
    path: 'activity',
    loadComponent: () => import('./screens/activity.component').then((m) => m.ActivityScreen),
  },
  {
    path: 'profile',
    loadComponent: () => import('./screens/profile.component').then((m) => m.ProfileScreen),
  },
  {
    path: 'p/:id',
    loadComponent: () => import('./screens/post.component').then((m) => m.PostScreen),
  },
  {
    path: 'people/:handle',
    loadComponent: () => import('./screens/person.component').then((m) => m.PersonScreen),
  },
  {
    path: '**',
    loadComponent: () => import('./screens/not-found.component').then((m) => m.NotFoundScreen),
  },
];
