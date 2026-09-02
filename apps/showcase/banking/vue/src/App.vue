<!--
  The route table. Eight patterns, resolved in the browser — wrapped in the ONE
  `AppFrame`, which is rendered here rather than inside each screen so the app
  bar, the rail and the dock are the same DOM elements across navigations (the
  rail's active indicator has to slide, not jump).

  ORDER MATTERS FOR ONE PAIR. `/invest/` and `/invest/<id>/` share a prefix, so
  the exact match is tested before the pattern — otherwise a future
  `/invest/settings/` becomes a lookup for an instrument called "settings".

  THE 404 FOR AN UNKNOWN ID is each drill screen's own guard, not this file's.
  A component taking a plain string from a URL must not trust its caller.

  NO WRAPPER ELEMENT AROUND THE SCREEN. `<component :is>` renders the matched
  screen itself, directly inside `AppFrame`'s `<main>`.
  `scripts/verify-showcase-parity.mjs` measures the vertical gaps between the
  shell's children, and a real `<div>` around the route output becomes one.
-->
<script setup lang="ts">
import { computed, type Component } from 'vue';
import { usePathname } from '~/lib/router';
import { route } from '~/lib/routes';
import AppFrame from '~/components/AppFrame.vue';
import AccountScreen from '~/components/screens/AccountScreen.vue';
import AnalyticsScreen from '~/components/screens/AnalyticsScreen.vue';
import CardsScreen from '~/components/screens/CardsScreen.vue';
import ExchangeScreen from '~/components/screens/ExchangeScreen.vue';
import HomeScreen from '~/components/screens/HomeScreen.vue';
import InstrumentScreen from '~/components/screens/InstrumentScreen.vue';
import InvestScreen from '~/components/screens/InvestScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import TransactionsScreen from '~/components/screens/TransactionsScreen.vue';

const ACCOUNT = /^\/accounts\/([^/]+)\/$/;
const INSTRUMENT = /^\/invest\/([^/]+)\/$/;

const pathname = usePathname();

interface Match {
  screen: Component;
  props: Record<string, string>;
}

/** Spelled out so the no-props branches do not infer `{ accountId?: undefined }`. */
const at = (screen: Component, props: Record<string, string> = {}): Match => ({ screen, props });

const matched = computed<Match>(() => {
  const path = pathname.value;
  if (path === route.home()) return at(HomeScreen);
  if (path === route.transactions()) return at(TransactionsScreen);
  if (path === route.exchange()) return at(ExchangeScreen);
  if (path === route.invest()) return at(InvestScreen);
  if (path === route.analytics()) return at(AnalyticsScreen);
  if (path === route.cards()) return at(CardsScreen);

  const account = ACCOUNT.exec(path);
  if (account) return at(AccountScreen, { accountId: decodeURIComponent(account[1]) });

  const instrument = INSTRUMENT.exec(path);
  if (instrument) return at(InstrumentScreen, { instrumentId: decodeURIComponent(instrument[1]) });

  return at(NotFoundScreen);
});
</script>

<template>
  <AppFrame>
    <component :is="matched.screen" v-bind="matched.props" />
  </AppFrame>
</template>
