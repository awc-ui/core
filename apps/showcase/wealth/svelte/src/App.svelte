<!--
  The frame, then the route table. Six patterns, resolved in the browser.

  `AppFrame` WRAPS the outlet rather than living inside each screen, and that
  is the wealth vertical's one structural difference from the credit-risk
  Svelte build: the app bar, the navigation rail and the compact bar must be
  the SAME DOM elements across a navigation, or the rail's active indicator has
  nothing to animate from and its expansion collapses on every click. The
  `{#if}` chain below swaps only what renders inside `<main>`.

  The route strings are not spelled out here — they come from `route.*` in
  `@awc-ui/showcase-kit/wealth`, so the paths this file matches on and the
  paths the rail links to are the same strings.

  THE 404 FOR AN UNKNOWN HOUSEHOLD ID is the screen's own guard, not this
  file's — `HouseholdScreen` looks its id up and renders the empty state when
  the fixture does not know it. That mirrors the React build (the source of
  truth for this vertical) and keeps the screens copy-paste comparable; the
  credit-risk Svelte build made the opposite choice for its own reasons.

  NO WRAPPER ELEMENT around the matched screen: Svelte's `{#if}` emits no DOM
  of its own, so the screen's blocks are direct children of `.shell__main` and
  the parity check's measured gaps see the same child list as the React build.
-->
<script lang="ts">
  import { pathname } from '$lib/router';
  import { route } from '$lib/routes';
  import AppFrame from '$lib/components/AppFrame.svelte';
  import OverviewScreen from '$lib/screens/OverviewScreen.svelte';
  import HoldingsScreen from '$lib/screens/HoldingsScreen.svelte';
  import HouseholdScreen from '$lib/screens/HouseholdScreen.svelte';
  import ProposalsScreen from '$lib/screens/ProposalsScreen.svelte';
  import TradeScreen from '$lib/screens/TradeScreen.svelte';
  import PlanningScreen from '$lib/screens/PlanningScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';

  /**
   * The one parameterised route. `[^/]+` rather than `.+` so
   * `/households/hh-01/positions/` does not silently render household
   * `hh-01/positions`.
   */
  const HOUSEHOLD = /^\/households\/([^/]+)\/$/;

  $: household = HOUSEHOLD.exec($pathname);
  /*
   * The segment is percent-encoded on the way into the URL. The fixture ids
   * are plain ASCII today, but decoding is what makes a lookup miss mean "no
   * such household" rather than "the id had a character in it".
   */
  $: householdId = household ? decodeURIComponent(household[1]) : '';
</script>

<AppFrame>
  {#if $pathname === route.overview()}
    <OverviewScreen />
  {:else if $pathname === route.holdings()}
    <HoldingsScreen />
  {:else if $pathname === route.proposals()}
    <ProposalsScreen />
  {:else if $pathname === route.trade()}
    <TradeScreen />
  {:else if $pathname === route.planning()}
    <PlanningScreen />
  {:else if household}
    <HouseholdScreen {householdId} />
  {:else}
    <NotFoundScreen />
  {/if}
</AppFrame>
