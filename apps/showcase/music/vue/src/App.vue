<!--
  The route table. Nine patterns, resolved in the browser.

  Five are exact paths and four take a parameter. The paths are not spelled out
  here — they come from `route.*` in `@awc-ui/showcase-kit/music`, so the
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
import { computed } from 'vue';
import { usePathname } from '~/lib/router';
/* THE FRAME'S IMPORT IS LOAD-BEARING. Vue resolves a component in a template by
   name from the setup scope; without this line `<AppFrame>` is an unknown
   element that renders as a literal `<appframe>` tag — the whole shell, the
   rail and the transport silently absent, with no error anywhere. */
import AppFrame from '~/components/AppFrame.vue';
import { route } from '~/lib/routes';

import AlbumScreen from '~/components/screens/AlbumScreen.vue';
import ArtistScreen from '~/components/screens/ArtistScreen.vue';
import HomeScreen from '~/components/screens/HomeScreen.vue';
import LibraryScreen from '~/components/screens/LibraryScreen.vue';
import MixerScreen from '~/components/screens/MixerScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import ProfileScreen from '~/components/screens/ProfileScreen.vue';
import ProjectScreen from '~/components/screens/ProjectScreen.vue';
import StudioScreen from '~/components/screens/StudioScreen.vue';
import TrackScreen from '~/components/screens/TrackScreen.vue';

/*
 * The four parameterised routes. `[^/]+` rather than `.+` so
 * `/album/drift-season/edit/` does not silently render an album called
 * `drift-season/edit`.
 */
const ALBUM = /^\/album\/([^/]+)\/$/;
const ARTIST = /^\/artist\/([^/]+)\/$/;
const TRACK = /^\/t\/([^/]+)\/$/;
const PROJECT = /^\/project\/([^/]+)\/$/;

const pathname = usePathname();

const at = (component: unknown, props: Record<string, string> = {}) => ({ component, props });

const screen = computed(() => {
  const path = pathname.value;

  if (path === route.home()) return at(HomeScreen);
  if (path === route.library()) return at(LibraryScreen);
  if (path === route.studio()) return at(StudioScreen);
  if (path === route.mixer()) return at(MixerScreen);
  if (path === route.profile()) return at(ProfileScreen);

  /* The path is percent-encoded on the way into the URL. Decoding is what makes
     a lookup miss mean "no such thing" rather than "the slug had a character
     in it". */
  const album = ALBUM.exec(path);
  if (album) return at(AlbumScreen, { slug: decodeURIComponent(album[1]!) });

  const artist = ARTIST.exec(path);
  if (artist) return at(ArtistScreen, { handle: decodeURIComponent(artist[1]!) });

  const track = TRACK.exec(path);
  if (track) return at(TrackScreen, { trackId: decodeURIComponent(track[1]!) });

  const project = PROJECT.exec(path);
  if (project) return at(ProjectScreen, { slug: decodeURIComponent(project[1]!) });

  return at(NotFoundScreen);
});
</script>

<template>
  <!-- The chrome is OUTSIDE the routed screen, so the app bar, the rail and the
       bar are mounted once and survive every navigation — which is what lets
       the rail's active indicator slide rather than jump, and what keeps its
       expanded state from resetting on each click. -->
  <AppFrame>
    <component :is="screen.component" v-bind="screen.props" />
  </AppFrame>
</template>
