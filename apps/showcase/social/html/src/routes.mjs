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
 *
 * Skipping it was the first version, on the reasoning that `/profile/` is
 * already that page and a second file with the same contents is a duplicate for
 * a crawler. That was the wrong trade: the four SPA builds all resolve
 * `/people/mara.ilves/` — their fan-out writes a shell for every person and
 * `personScreen` delegates to `profileScreen` at runtime — so omitting the file
 * here would make one of the five ports answer 404 for a URL the other four
 * serve. A port that differs from its reference on which URLs exist is a worse
 * problem than a duplicate page, and it is exactly the kind of difference that
 * only shows up when somebody follows a link.
 */

import { getPeople, getPosts, route } from '@awc-ui/showcase-kit/social';
import { feedScreen } from './screens/feed.mjs';
import { exploreScreen } from './screens/explore.mjs';
import { createScreen } from './screens/create.mjs';
import { activityScreen } from './screens/activity.mjs';
import { profileScreen } from './screens/profile.mjs';
import { postScreen } from './screens/post.mjs';
import { personScreen } from './screens/person.mjs';

export function routes() {
  return [
    { path: route.feed(), render: (t, locale) => feedScreen(t, locale) },
    { path: route.explore(), render: (t, locale) => exploreScreen(t, locale) },
    { path: route.create(), render: (t, locale) => createScreen(t, locale) },
    { path: route.activity(), render: (t, locale) => activityScreen(t, locale) },
    { path: route.profile(), render: (t, locale) => profileScreen(t, locale) },
    ...getPosts().map((post) => ({
      path: route.post(post.id),
      render: (t, locale) => postScreen(t, locale, post.id),
    })),
    ...getPeople().map((person) => ({
      path: route.person(person.handle),
      render: (t, locale) => personScreen(t, locale, person.handle),
    })),
  ];
}
