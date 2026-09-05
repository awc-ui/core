/**
 * Every page this build writes, as `{ path, render }`.
 *
 * ONE LIST, TWO CONSUMERS. `scripts/build.mjs` writes a file per entry per
 * locale and `scripts/lint.mjs` renders every entry in every locale looking for
 * the smells a template-literal renderer produces. Written twice, the two would
 * agree until the first screen was added to one of them.
 *
 * THE DRILLS COME FROM THE FIXTURE, not from a hard-coded table: a post added
 * to the kit adds a page here without a second edit, which is the same contract
 * the four SPA builds' fan-out scripts follow.
 *
 * THE VIEWER'S OWN HANDLE IS WRITTEN TOO, and it renders their own profile.
 * The four SPA builds all resolve `/people/petra.novak/` — their fan-out writes
 * a shell for every person and `personScreen` delegates to `profileScreen` at
 * runtime — so omitting the file here would make one of the five ports answer
 * 404 for a URL the other four serve. A port that differs from its reference on
 * which URLs exist is worse than a duplicate page, and it is exactly the kind
 * of difference that only shows up when somebody follows a link.
 */

import {
  getEvents,
  getGroups,
  getPeople,
  getPosts,
  route,
} from '@awc-ui/showcase-kit/community';
import { feedScreen } from './screens/feed.mjs';
import { friendsScreen } from './screens/friends.mjs';
import { groupsScreen } from './screens/groups.mjs';
import { eventsScreen } from './screens/events.mjs';
import { profileScreen } from './screens/profile.mjs';
import { postScreen } from './screens/post.mjs';
import { personScreen } from './screens/person.mjs';
import { groupScreen } from './screens/group.mjs';
import { eventScreen } from './screens/event.mjs';

export function routes() {
  return [
    { path: route.feed(), render: (t, locale) => feedScreen(t, locale) },
    { path: route.friends(), render: (t, locale) => friendsScreen(t, locale) },
    { path: route.groups(), render: (t, locale) => groupsScreen(t, locale) },
    { path: route.events(), render: (t, locale) => eventsScreen(t, locale) },
    { path: route.profile(), render: (t, locale) => profileScreen(t, locale) },
    ...getPosts().map((post) => ({
      path: route.post(post.id),
      render: (t, locale) => postScreen(t, locale, post.id),
    })),
    ...getPeople().map((person) => ({
      path: route.person(person.handle),
      render: (t, locale) => personScreen(t, locale, person.handle),
    })),
    ...getGroups().map((group) => ({
      path: route.group(group.slug),
      render: (t, locale) => groupScreen(t, locale, group.slug),
    })),
    ...getEvents().map((event) => ({
      path: route.event(event.slug),
      render: (t, locale) => eventScreen(t, locale, event.slug),
    })),
  ];
}
