<!--
  The route table. Nine patterns, resolved in the browser — wrapped in the ONE
  `AppFrame`, rendered here rather than inside each screen so the app bar, the
  rail and the dock are the same DOM elements across navigations (the rail's
  active indicator has to slide, not jump).

  THREE OF THE FOUR DRILLS ARE MATCHED BY NAME rather than by id — a person by
  handle, a group and an event by slug. Each has a public name that IS its
  address in the thing being modelled; `/g/grp-04/` would be the one detail that
  made this app feel unlike it. A post keeps its id, because a post has no name.

  THE 404 FOR AN UNKNOWN ID is each drill screen's own guard, not this file's.

  NO WRAPPER ELEMENT AROUND THE SCREEN.
  `scripts/verify-showcase-parity.mjs` measures the vertical gaps between the
  shell's children, and a real element around the route output becomes one.
-->
<script lang="ts">
  import { pathname } from '$lib/router';
  import { route } from '$lib/routes';
  import AppFrame from '$lib/components/AppFrame.svelte';
  import EventScreen from '$lib/screens/EventScreen.svelte';
  import EventsScreen from '$lib/screens/EventsScreen.svelte';
  import FeedScreen from '$lib/screens/FeedScreen.svelte';
  import FriendsScreen from '$lib/screens/FriendsScreen.svelte';
  import GroupScreen from '$lib/screens/GroupScreen.svelte';
  import GroupsScreen from '$lib/screens/GroupsScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import PersonScreen from '$lib/screens/PersonScreen.svelte';
  import PostScreen from '$lib/screens/PostScreen.svelte';
  import ProfileScreen from '$lib/screens/ProfileScreen.svelte';

  /**
   * The four parameterised routes. `[^/]+` rather than `.+` so `/p/pst-01/edit/`
   * does not silently render a post called `pst-01/edit`.
   */
  const POST = /^\/p\/([^/]+)\/$/;
  const PERSON = /^\/people\/([^/]+)\/$/;
  const GROUP = /^\/g\/([^/]+)\/$/;
  const EVENT = /^\/e\/([^/]+)\/$/;

  /* The path is percent-encoded on the way into the URL; the fixture ids are
     plain ASCII today, but decoding is what makes a lookup miss mean "no such
     post" rather than "the id had a character in it". */
  $: postMatch = POST.exec($pathname);
  $: personMatch = PERSON.exec($pathname);
  $: groupMatch = GROUP.exec($pathname);
  $: eventMatch = EVENT.exec($pathname);
</script>

<AppFrame>
  {#if $pathname === route.feed()}
    <FeedScreen />
  {:else if $pathname === route.friends()}
    <FriendsScreen />
  {:else if $pathname === route.groups()}
    <GroupsScreen />
  {:else if $pathname === route.events()}
    <EventsScreen />
  {:else if $pathname === route.profile()}
    <ProfileScreen />
  {:else if postMatch}
    <PostScreen postId={decodeURIComponent(postMatch[1])} />
  {:else if personMatch}
    <PersonScreen handle={decodeURIComponent(personMatch[1])} />
  {:else if groupMatch}
    <GroupScreen slug={decodeURIComponent(groupMatch[1])} />
  {:else if eventMatch}
    <EventScreen slug={decodeURIComponent(eventMatch[1])} />
  {:else}
    <NotFoundScreen />
  {/if}
</AppFrame>
