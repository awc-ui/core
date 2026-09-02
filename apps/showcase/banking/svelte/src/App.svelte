<!--
  The route table. Eight patterns, resolved in the browser — inside the ONE
  `AppFrame`, so the app bar, the rail and the dock are the same DOM elements
  across navigations (the rail's active indicator has to slide, not jump).

  ORDER MATTERS FOR ONE PAIR. `/invest/` and `/invest/<id>/` share a prefix, so
  the exact match is tested before the pattern — otherwise a future
  `/invest/settings/` becomes a lookup for an instrument called "settings".

  NO WRAPPER ELEMENT around the matched screen: Svelte's `{#if}` emits no DOM
  of its own, so the screen's blocks are direct children of `.shell__main` and
  the parity check's measured gaps see the same child list as the React build.
-->
<script lang="ts">
  import { pathname } from '$lib/router';
  import { route } from '$lib/routes';
  import AppFrame from '$lib/components/AppFrame.svelte';
  import HomeScreen from '$lib/screens/HomeScreen.svelte';
  import TransactionsScreen from '$lib/screens/TransactionsScreen.svelte';
  import ExchangeScreen from '$lib/screens/ExchangeScreen.svelte';
  import InvestScreen from '$lib/screens/InvestScreen.svelte';
  import AnalyticsScreen from '$lib/screens/AnalyticsScreen.svelte';
  import CardsScreen from '$lib/screens/CardsScreen.svelte';
  import AccountScreen from '$lib/screens/AccountScreen.svelte';
  import InstrumentScreen from '$lib/screens/InstrumentScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';

  const ACCOUNT = /^\/accounts\/([^/]+)\/$/;
  const INSTRUMENT = /^\/invest\/([^/]+)\/$/;

  /*
   * The segment is percent-encoded on the way into the URL. The fixture ids are
   * plain ASCII today, but decoding is what makes a lookup miss mean "no such
   * account" rather than "the id had a character in it".
   */
  $: account = ACCOUNT.exec($pathname);
  $: accountId = account ? decodeURIComponent(account[1]) : '';
  $: instrument = $pathname === route.invest() ? null : INSTRUMENT.exec($pathname);
  $: instrumentId = instrument ? decodeURIComponent(instrument[1]) : '';
</script>

<AppFrame>
  {#if $pathname === route.home()}
    <HomeScreen />
  {:else if $pathname === route.transactions()}
    <TransactionsScreen />
  {:else if $pathname === route.exchange()}
    <ExchangeScreen />
  {:else if $pathname === route.invest()}
    <InvestScreen />
  {:else if $pathname === route.analytics()}
    <AnalyticsScreen />
  {:else if $pathname === route.cards()}
    <CardsScreen />
  {:else if account}
    <AccountScreen {accountId} />
  {:else if instrument}
    <InstrumentScreen {instrumentId} />
  {:else}
    <NotFoundScreen />
  {/if}
</AppFrame>
