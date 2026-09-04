/**
 * The route table. Seven patterns, resolved in the browser.
 *
 * Five are exact paths and two take a parameter. The paths are not spelled out
 * here — they come from `route.*` in `@awc-ui/showcase-kit/social`, so the
 * strings this file matches on and the strings the rail links to are the same
 * strings. A literal `'/explore/'` here would agree with the kit right up until
 * somebody renamed the route.
 *
 * A PERSON IS MATCHED BY HANDLE, not by id, which is the one thing about this
 * router that differs from the three verticals next door. The kit's note on
 * `route.person` says why: a handle is a person's public address, and
 * `/people/per-07/` would be the single detail that made this app feel unlike
 * the thing it models.
 *
 * THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. Both
 * drill screens look their parameter up and render the not-found state when the
 * fixture does not know it — a component taking a plain string from a URL must
 * not trust its caller.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside the shell's child list and shift every measured gap
 * when the other four ports are compared against this one.
 */

import { usePathname } from '@/lib/router';
import { route } from '@/lib/routes';
import { ActivityScreen } from '@/components/screens/ActivityScreen';
import { CreateScreen } from '@/components/screens/CreateScreen';
import { ExploreScreen } from '@/components/screens/ExploreScreen';
import { FeedScreen } from '@/components/screens/FeedScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { PersonScreen } from '@/components/screens/PersonScreen';
import { PostScreen } from '@/components/screens/PostScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

/**
 * The two parameterised routes. `[^/]+` rather than `.+` so `/p/post-01/edit/`
 * does not silently render a post called `post-01/edit`.
 */
const POST = /^\/p\/([^/]+)\/$/;
const PERSON = /^\/people\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.feed()) return <FeedScreen />;
  if (pathname === route.explore()) return <ExploreScreen />;
  if (pathname === route.create()) return <CreateScreen />;
  if (pathname === route.activity()) return <ActivityScreen />;
  if (pathname === route.profile()) return <ProfileScreen />;

  const post = POST.exec(pathname);
  if (post) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // post" rather than "the id had a character in it".
    return <PostScreen postId={decodeURIComponent(post[1])} />;
  }

  const person = PERSON.exec(pathname);
  if (person) {
    return <PersonScreen handle={decodeURIComponent(person[1])} />;
  }

  return <NotFoundScreen />;
}
