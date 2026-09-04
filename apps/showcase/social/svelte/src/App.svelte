<!--
  The route table. Seven patterns, resolved in the browser — wrapped in the ONE
  `AppFrame`, rendered here rather than inside each screen so the app bar, the
  rail and the dock are the same DOM elements across navigations (the rail's
  active indicator has to slide, not jump).

  A PERSON IS MATCHED BY HANDLE, not by id. The kit's note on `route.person`
  says why: a handle is a person's public address, and `/people/per-07/` would
  be the single detail that made this app feel unlike the thing it models.

  THE 404 FOR AN UNKNOWN ID is each drill screen's own guard, not this file's.

  NO WRAPPER ELEMENT AROUND THE SCREEN.
  `scripts/verify-showcase-parity.mjs` measures the vertical gaps between the
  shell's children, and a real element around the route output becomes one.
-->
<script lang="ts">
  import { pathname } from '$lib/router';
  import { route } from '$lib/routes';
  import AppFrame from '$lib/components/AppFrame.svelte';
  import ActivityScreen from '$lib/screens/ActivityScreen.svelte';
  import CreateScreen from '$lib/screens/CreateScreen.svelte';
  import ExploreScreen from '$lib/screens/ExploreScreen.svelte';
  import FeedScreen from '$lib/screens/FeedScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import PersonScreen from '$lib/screens/PersonScreen.svelte';
  import PostScreen from '$lib/screens/PostScreen.svelte';
  import ProfileScreen from '$lib/screens/ProfileScreen.svelte';

  /**
   * The two parameterised routes. `[^/]+` rather than `.+` so `/p/post-01/edit/`
   * does not silently render a post called `post-01/edit`.
   */
  const POST = /^\/p\/([^/]+)\/$/;
  const PERSON = /^\/people\/([^/]+)\/$/;

  /* The path is percent-encoded on the way into the URL; the fixture ids are
     plain ASCII today, but decoding is what makes a lookup miss mean "no such
     post" rather than "the id had a character in it". */
  $: postMatch = POST.exec($pathname);
  $: personMatch = PERSON.exec($pathname);
</script>

<AppFrame>
  {#if $pathname === route.feed()}
    <FeedScreen />
  {:else if $pathname === route.explore()}
    <ExploreScreen />
  {:else if $pathname === route.create()}
    <CreateScreen />
  {:else if $pathname === route.activity()}
    <ActivityScreen />
  {:else if $pathname === route.profile()}
    <ProfileScreen />
  {:else if postMatch}
    <PostScreen postId={decodeURIComponent(postMatch[1])} />
  {:else if personMatch}
    <PersonScreen handle={decodeURIComponent(personMatch[1])} />
  {:else}
    <NotFoundScreen />
  {/if}
</AppFrame>
