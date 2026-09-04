<!--
  The route table. Seven patterns, resolved in the browser — wrapped in the ONE
  `AppFrame`, rendered here rather than inside each screen so the app bar, the
  rail and the dock are the same DOM elements across navigations (the rail's
  active indicator has to slide, not jump).

  A PERSON IS MATCHED BY HANDLE, not by id, which is the one thing about this
  router that differs from the three verticals next door. The kit's note on
  `route.person` says why: a handle is a person's public address, and
  `/people/per-07/` would be the single detail that made this app feel unlike
  the thing it models.

  THE 404 FOR AN UNKNOWN ID is each drill screen's own guard, not this file's. A
  component taking a plain string from a URL must not trust its caller.

  NO WRAPPER ELEMENT AROUND THE SCREEN. `<component :is>` renders the matched
  screen directly inside `AppFrame`'s `<main>`;
  `scripts/verify-showcase-parity.mjs` measures the vertical gaps between the
  shell's children, and a real `<div>` around the route output becomes one.
-->
<script setup lang="ts">
import { computed, type Component } from 'vue';
import { usePathname } from '~/lib/router';
import { route } from '~/lib/routes';
import AppFrame from '~/components/AppFrame.vue';
import ActivityScreen from '~/components/screens/ActivityScreen.vue';
import CreateScreen from '~/components/screens/CreateScreen.vue';
import ExploreScreen from '~/components/screens/ExploreScreen.vue';
import FeedScreen from '~/components/screens/FeedScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import PersonScreen from '~/components/screens/PersonScreen.vue';
import PostScreen from '~/components/screens/PostScreen.vue';
import ProfileScreen from '~/components/screens/ProfileScreen.vue';

/**
 * The two parameterised routes. `[^/]+` rather than `.+` so `/p/post-01/edit/`
 * does not silently render a post called `post-01/edit`.
 */
const POST = /^\/p\/([^/]+)\/$/;
const PERSON = /^\/people\/([^/]+)\/$/;

const pathname = usePathname();

interface Match {
  screen: Component;
  props: Record<string, string>;
}

/** Spelled out so the no-props branches do not infer `{ postId?: undefined }`. */
const at = (screen: Component, props: Record<string, string> = {}): Match => ({ screen, props });

const matched = computed<Match>(() => {
  const path = pathname.value;
  if (path === route.feed()) return at(FeedScreen);
  if (path === route.explore()) return at(ExploreScreen);
  if (path === route.create()) return at(CreateScreen);
  if (path === route.activity()) return at(ActivityScreen);
  if (path === route.profile()) return at(ProfileScreen);

  const post = POST.exec(path);
  // The path is percent-encoded on the way into the URL; the fixture ids are
  // plain ASCII today, but decoding is what makes a lookup miss mean "no such
  // post" rather than "the id had a character in it".
  if (post) return at(PostScreen, { postId: decodeURIComponent(post[1]) });

  const person = PERSON.exec(path);
  if (person) return at(PersonScreen, { handle: decodeURIComponent(person[1]) });

  return at(NotFoundScreen);
});
</script>

<template>
  <AppFrame>
    <component :is="matched.screen" v-bind="matched.props" />
  </AppFrame>
</template>
