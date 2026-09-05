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
 * THREE OF THE FOUR DRILLS ARE MATCHED BY NAME rather than by id — a person by
 * handle, a group and an event by slug. Each has a public name that IS its
 * address in the thing being modelled; `/g/grp-04/` would be the one detail
 * that made this app feel unlike it. A handle contains a dot and a slug
 * contains hyphens, both of which Angular's matcher treats as ordinary path
 * characters. A post keeps its id, because a post has no name.
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
    path: 'friends',
    loadComponent: () => import('./screens/friends.component').then((m) => m.FriendsScreen),
  },
  {
    path: 'groups',
    loadComponent: () => import('./screens/groups.component').then((m) => m.GroupsScreen),
  },
  {
    path: 'events',
    loadComponent: () => import('./screens/events.component').then((m) => m.EventsScreen),
  },
  {
    path: 'profile',
    loadComponent: () => import('./screens/profile.component').then((m) => m.ProfileScreen),
  },
  {
    path: 'p/:postId',
    loadComponent: () => import('./screens/post.component').then((m) => m.PostScreen),
  },
  {
    path: 'people/:handle',
    loadComponent: () => import('./screens/person.component').then((m) => m.PersonScreen),
  },
  {
    path: 'g/:slug',
    loadComponent: () => import('./screens/group.component').then((m) => m.GroupScreen),
  },
  {
    path: 'e/:slug',
    loadComponent: () => import('./screens/event.component').then((m) => m.EventScreen),
  },
  {
    path: '**',
    loadComponent: () => import('./screens/not-found.component').then((m) => m.NotFoundScreen),
  },
];
