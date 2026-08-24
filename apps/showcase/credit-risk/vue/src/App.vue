<!--
  The route table. Six patterns, resolved in the browser.

  This is what `pages/**` was in the Nuxt twin — the same six screens behind the
  same six paths — minus the one thing only a server could do: answer an
  unmatched path with a 404 before any component runs. That is now
  `NotFoundScreen`, matched here like any other route.

  Each Nuxt page was a two-line wrapper that pulled its dynamic segment out of
  `useRoute().params` and handed it to a screen. There is no `params` here, so
  the segment comes out of the path itself and the six wrappers collapse into the
  table below. The screens are untouched: they still take a plain `sector-id` /
  `counterparty-id` / `facility-id` string.

  THE 404 FOR AN UNKNOWN ID is the screens' own guard, and it is the one place
  this build does more than the twin rather than less. `SectorScreen`,
  `CounterpartyScreen` and `FacilityScreen` each look their id up and render
  `MissingScreen` when the fixture does not know it. The Nuxt versions cast the
  miss away and dereferenced it, which on a server costs the one request that
  asked; here it would throw inside the browser's render and take the whole
  application down. Each screen's own header records the change.

  NO WRAPPER ELEMENT. `<component :is>` renders the matched screen itself, with
  nothing around it. `scripts/verify-showcase-parity.mjs` measures the vertical
  gaps between `.shell`'s children, and a real `<div>` around the route output
  becomes one of them — the exact bug its header records against the html and
  astro builds.
-->
<script setup lang="ts">
import { computed, type Component } from 'vue';
import { usePathname } from '~/lib/router';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import CounterpartyScreen from '~/components/screens/CounterpartyScreen.vue';
import FacilityScreen from '~/components/screens/FacilityScreen.vue';
import OverviewScreen from '~/components/screens/OverviewScreen.vue';
import SectorScreen from '~/components/screens/SectorScreen.vue';
import StressScreen from '~/components/screens/StressScreen.vue';
import WatchlistScreen from '~/components/screens/WatchlistScreen.vue';

/**
 * The three drill routes share one shape: a collection, one id, a trailing
 * slash. `[^/]+` rather than `.+` so `/facilities/fac-001/covenants/` does not
 * silently render facility `fac-001/covenants`.
 */
const DRILL = /^\/(sectors|counterparties|facilities)\/([^/]+)\/$/;

const pathname = usePathname();

interface Match {
  screen: Component;
  /** The dynamic segment, under the name the screen's prop has. Empty for the three section screens. */
  props: Record<string, string>;
}

/** Spelled out so the no-props branches do not infer `{ sectorId?: undefined }`. */
const at = (screen: Component, props: Record<string, string> = {}): Match => ({ screen, props });

const matched = computed<Match>(() => {
  const path = pathname.value;
  if (path === '/') return at(OverviewScreen);
  if (path === '/watchlist/') return at(WatchlistScreen);
  if (path === '/stress/') return at(StressScreen);

  const drill = DRILL.exec(path);
  if (drill) {
    // The path is percent-encoded on the way into the URL; the fixture ids are
    // plain ASCII today, but decoding is what makes a lookup miss mean "no such
    // row" rather than "the id had a character in it".
    const id = decodeURIComponent(drill[2]);
    if (drill[1] === 'sectors') return at(SectorScreen, { sectorId: id });
    if (drill[1] === 'counterparties') return at(CounterpartyScreen, { counterpartyId: id });
    return at(FacilityScreen, { facilityId: id });
  }

  return at(NotFoundScreen);
});
</script>

<template>
  <component :is="matched.screen" v-bind="matched.props" />
</template>
