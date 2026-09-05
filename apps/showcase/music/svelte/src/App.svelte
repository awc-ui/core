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

  import AlbumScreen from '$lib/screens/AlbumScreen.svelte';
  import ArtistScreen from '$lib/screens/ArtistScreen.svelte';
  import HomeScreen from '$lib/screens/HomeScreen.svelte';
  import LibraryScreen from '$lib/screens/LibraryScreen.svelte';
  import MixerScreen from '$lib/screens/MixerScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import ProfileScreen from '$lib/screens/ProfileScreen.svelte';
  import ProjectScreen from '$lib/screens/ProjectScreen.svelte';
  import StudioScreen from '$lib/screens/StudioScreen.svelte';
  import TrackScreen from '$lib/screens/TrackScreen.svelte';

  /*
   * The four parameterised routes. `[^/]+` rather than `.+` so
   * `/album/drift-season/edit/` does not silently render an album called
   * `drift-season/edit`.
   */
  const ALBUM = /^\/album\/([^/]+)\/$/;
  const ARTIST = /^\/artist\/([^/]+)\/$/;
  const TRACK = /^\/t\/([^/]+)\/$/;
  const PROJECT = /^\/project\/([^/]+)\/$/;

  /* The path is percent-encoded on the way into the URL. Decoding is what makes
     a lookup miss mean "no such thing" rather than "the slug had a character
     in it". */
  $: album = ALBUM.exec($pathname);
  $: artist = ARTIST.exec($pathname);
  $: track = TRACK.exec($pathname);
  $: project = PROJECT.exec($pathname);
</script>

<!-- The chrome is OUTSIDE the routed screen, so the app bar, the rail and the
     transport are mounted once and survive every navigation. -->
<AppFrame>
  {#if $pathname === route.home()}
    <HomeScreen />
  {:else if $pathname === route.library()}
    <LibraryScreen />
  {:else if $pathname === route.studio()}
    <StudioScreen />
  {:else if $pathname === route.mixer()}
    <MixerScreen />
  {:else if $pathname === route.profile()}
    <ProfileScreen />
  {:else if album}
    <AlbumScreen slug={decodeURIComponent(album[1])} />
  {:else if artist}
    <ArtistScreen handle={decodeURIComponent(artist[1])} />
  {:else if track}
    <TrackScreen trackId={decodeURIComponent(track[1])} />
  {:else if project}
    <ProjectScreen slug={decodeURIComponent(project[1])} />
  {:else}
    <NotFoundScreen />
  {/if}
</AppFrame>
