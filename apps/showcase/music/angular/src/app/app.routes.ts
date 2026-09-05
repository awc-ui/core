import type { Routes } from '@angular/router';

/**
 * The nine screens.
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
 * THREE OF THE FOUR DRILLS ARE MATCHED BY SLUG rather than by id — an album, an
 * artist and a project each have a name that is how a person refers to them,
 * and `/project/prj-04/` would be the one detail that made this app feel
 * unlike a music app. A handle contains a dot and a slug contains hyphens,
 * both of which Angular's matcher treats as ordinary path characters. A TRACK
 * keeps its id: track titles collide across albums and within a discography,
 * so a slug would not be unique.
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
    loadComponent: () => import('./screens/home.component').then((m) => m.HomeScreen),
  },
  {
    path: 'library',
    loadComponent: () => import('./screens/library.component').then((m) => m.LibraryScreen),
  },
  {
    path: 'studio',
    loadComponent: () => import('./screens/studio.component').then((m) => m.StudioScreen),
  },
  {
    path: 'mixer',
    loadComponent: () => import('./screens/mixer.component').then((m) => m.MixerScreen),
  },
  {
    path: 'profile',
    loadComponent: () => import('./screens/profile.component').then((m) => m.ProfileScreen),
  },
  {
    path: 'album/:slug',
    loadComponent: () => import('./screens/album.component').then((m) => m.AlbumScreen),
  },
  {
    path: 'artist/:handle',
    loadComponent: () => import('./screens/artist.component').then((m) => m.ArtistScreen),
  },
  {
    path: 't/:trackId',
    loadComponent: () => import('./screens/track.component').then((m) => m.TrackScreen),
  },
  {
    path: 'project/:slug',
    loadComponent: () => import('./screens/project.component').then((m) => m.ProjectScreen),
  },
  {
    path: '**',
    loadComponent: () => import('./screens/not-found.component').then((m) => m.NotFoundScreen),
  },
];
