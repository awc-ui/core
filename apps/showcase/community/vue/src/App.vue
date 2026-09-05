<!--
  The route table. Nine patterns, resolved in the browser.

  Five are exact paths and four take a parameter. The paths are not spelled out
  here — they come from `route.*` in `@awc-ui/showcase-kit/community`, so the
  strings this file matches on and the strings the rail links to are the same
  strings.

  THREE OF THE FOUR DRILLS ARE MATCHED BY NAME rather than by id — a person by
  handle, a group and an event by slug. Each of those has a public name that IS
  its address in the thing being modelled. A post keeps its id, because a post
  has no name.

  THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. All four
  drill screens look their parameter up and render the not-found state when the
  fixture does not know it — a component taking a plain string from a URL must
  not trust its caller.

  `AppFrame` WRAPS THE ROUTED SCREEN rather than being rendered inside each one:
  the chrome then mounts once and outlives every navigation.
-->
<script setup lang="ts">
import { computed, h } from 'vue';
import AppFrame from '~/components/AppFrame.vue';
import { usePathname } from '~/lib/router';
import { route } from '~/lib/routes';
import EventScreen from '~/components/screens/EventScreen.vue';
import EventsScreen from '~/components/screens/EventsScreen.vue';
import FeedScreen from '~/components/screens/FeedScreen.vue';
import FriendsScreen from '~/components/screens/FriendsScreen.vue';
import GroupScreen from '~/components/screens/GroupScreen.vue';
import GroupsScreen from '~/components/screens/GroupsScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import PersonScreen from '~/components/screens/PersonScreen.vue';
import PostScreen from '~/components/screens/PostScreen.vue';
import ProfileScreen from '~/components/screens/ProfileScreen.vue';

const pathname = usePathname();

/** `[^/]+` rather than `.+` so `/p/pst-01/edit/` is not a post called that. */
const POST = /^\/p\/([^/]+)\/$/;
const PERSON = /^\/people\/([^/]+)\/$/;
const GROUP = /^\/g\/([^/]+)\/$/;
const EVENT = /^\/e\/([^/]+)\/$/;

/* eslint-disable @typescript-eslint/no-explicit-any */
const at = (component: any, props?: Record<string, unknown>) => () => h(component, props);

const screen = computed(() => {
  const path = pathname.value;

  if (path === route.feed()) return at(FeedScreen);
  if (path === route.friends()) return at(FriendsScreen);
  if (path === route.groups()) return at(GroupsScreen);
  if (path === route.events()) return at(EventsScreen);
  if (path === route.profile()) return at(ProfileScreen);

  /* Decoded on the way out of the URL: the ids and slugs are plain ASCII today,
     but decoding is what makes a lookup miss mean "no such thing" rather than
     "the id had a character in it". */
  const post = POST.exec(path);
  if (post) return at(PostScreen, { postId: decodeURIComponent(post[1]) });

  const person = PERSON.exec(path);
  if (person) return at(PersonScreen, { handle: decodeURIComponent(person[1]) });

  const group = GROUP.exec(path);
  if (group) return at(GroupScreen, { slug: decodeURIComponent(group[1]) });

  const event = EVENT.exec(path);
  if (event) return at(EventScreen, { slug: decodeURIComponent(event[1]) });

  return at(NotFoundScreen);
});
</script>

<template>
  <!-- The chrome is OUTSIDE the routed screen, so the app bar, the rail and the
       bar are mounted once and survive every navigation — which is what lets
       the rail's active indicator slide rather than jump, and what keeps its
       expanded state from resetting on each click. -->
  <AppFrame>
    <component :is="screen()" />
  </AppFrame>
</template>
