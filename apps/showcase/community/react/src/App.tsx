/**
 * The route table. Nine patterns, resolved in the browser.
 *
 * Five are exact paths and four take a parameter. The paths are not spelled out
 * here — they come from `route.*` in `@awc-ui/showcase-kit/community`, so the
 * strings this file matches on and the strings the rail links to are the same
 * strings. A literal `'/friends/'` here would agree with the kit right up until
 * somebody renamed the route.
 *
 * THREE OF THE FOUR DRILLS ARE MATCHED BY NAME rather than by id — a person by
 * handle, a group and an event by slug. Each of those has a public name that IS
 * its address in the thing being modelled, and `/g/grp-04/` would be the detail
 * that made this app feel unlike it. A post keeps its id, because a post has no
 * name.
 *
 * THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. All four
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

import { EventScreen } from '@/components/screens/EventScreen';
import { EventsScreen } from '@/components/screens/EventsScreen';
import { FeedScreen } from '@/components/screens/FeedScreen';
import { FriendsScreen } from '@/components/screens/FriendsScreen';
import { GroupScreen } from '@/components/screens/GroupScreen';
import { GroupsScreen } from '@/components/screens/GroupsScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { PersonScreen } from '@/components/screens/PersonScreen';
import { PostScreen } from '@/components/screens/PostScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

/**
 * The four parameterised routes. `[^/]+` rather than `.+` so `/p/pst-01/edit/`
 * does not silently render a post called `pst-01/edit`.
 */
const POST = /^\/p\/([^/]+)\/$/;
const PERSON = /^\/people\/([^/]+)\/$/;
const GROUP = /^\/g\/([^/]+)\/$/;
const EVENT = /^\/e\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.feed()) return <FeedScreen />;
  if (pathname === route.friends()) return <FriendsScreen />;
  if (pathname === route.groups()) return <GroupsScreen />;
  if (pathname === route.events()) return <EventsScreen />;
  if (pathname === route.profile()) return <ProfileScreen />;

  /*
   * The path is percent-encoded on the way into the URL. The fixture's ids and
   * slugs are plain ASCII today, but decoding is what makes a lookup miss mean
   * "no such thing" rather than "the id had a character in it".
   */
  const post = POST.exec(pathname);
  if (post) return <PostScreen postId={decodeURIComponent(post[1])} />;

  const person = PERSON.exec(pathname);
  if (person) return <PersonScreen handle={decodeURIComponent(person[1])} />;

  const group = GROUP.exec(pathname);
  if (group) return <GroupScreen slug={decodeURIComponent(group[1])} />;

  const event = EVENT.exec(pathname);
  if (event) return <EventScreen slug={decodeURIComponent(event[1])} />;

  return <NotFoundScreen />;
}
