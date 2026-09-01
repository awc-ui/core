<!--
  The route table. Six patterns, resolved in the browser — wrapped in the ONE
  `AppFrame`, which is rendered here rather than inside each screen so the app
  bar, the rail and the dock are the same DOM elements across navigations (the
  rail's active indicator has to slide, not jump; see AppFrame.vue).

  THE 404 FOR AN UNKNOWN HOUSEHOLD ID is the screen's own guard, not this
  file's. `HouseholdScreen` looks its id up and renders the empty state when
  the fixture does not know it — a component taking a plain string from a URL
  must not trust its caller.

  NO WRAPPER ELEMENT AROUND THE SCREEN. `<component :is>` renders the matched
  screen itself, directly inside `AppFrame`'s `<main>`.
  `scripts/verify-showcase-parity.mjs` measures the vertical gaps between the
  shell's children, and a real `<div>` around the route output becomes one of
  them.
-->
<script setup lang="ts">
import { computed, type Component } from 'vue';
import { usePathname } from '~/lib/router';
import { route } from '~/lib/routes';
import AppFrame from '~/components/AppFrame.vue';
import HoldingsScreen from '~/components/screens/HoldingsScreen.vue';
import HouseholdScreen from '~/components/screens/HouseholdScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import OverviewScreen from '~/components/screens/OverviewScreen.vue';
import PlanningScreen from '~/components/screens/PlanningScreen.vue';
import ProposalsScreen from '~/components/screens/ProposalsScreen.vue';
import TradeScreen from '~/components/screens/TradeScreen.vue';

/**
 * The one parameterised route. `[^/]+` rather than `.+` so
 * `/households/hh-01/positions/` does not silently render household
 * `hh-01/positions`.
 */
const HOUSEHOLD = /^\/households\/([^/]+)\/$/;

const pathname = usePathname();

interface Match {
  screen: Component;
  /** The dynamic segment, under the name the screen's prop has. */
  props: Record<string, string>;
}

/** Spelled out so the no-props branches do not infer `{ householdId?: undefined }`. */
const at = (screen: Component, props: Record<string, string> = {}): Match => ({ screen, props });

const matched = computed<Match>(() => {
  const path = pathname.value;
  if (path === route.overview()) return at(OverviewScreen);
  if (path === route.holdings()) return at(HoldingsScreen);
  if (path === route.proposals()) return at(ProposalsScreen);
  if (path === route.trade()) return at(TradeScreen);
  if (path === route.planning()) return at(PlanningScreen);

  const household = HOUSEHOLD.exec(path);
  if (household) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // household" rather than "the id had a character in it".
    return at(HouseholdScreen, { householdId: decodeURIComponent(household[1]) });
  }

  return at(NotFoundScreen);
});
</script>

<template>
  <AppFrame>
    <component :is="matched.screen" v-bind="matched.props" />
  </AppFrame>
</template>
