<!--
  The route table. Six patterns, resolved in the browser.

  This is what `src/routes/**/+page.svelte` was in the SvelteKit build in this
  pair — the same six screens behind the same six paths — minus the two things
  only a server or a build step could do:

  - THE 404 FOR AN UNKNOWN ID was a `throw error(404)` in each dynamic
    `+page.ts`, and before that it was a file the prerenderer simply never
    wrote. It is the three `getXById` calls below. They are not decoration:
    `SectorScreen`, `CounterpartyScreen` and `FacilityScreen` each do
    `getXById(id) as X` and would dereference `undefined` on a bogus segment.
    Keeping the lookup here rather than inside each screen is what let all six
    screens be copied across untouched — the routing call sites are the only
    thing that differs between the two builds in this pair, and this is one.
  - THE ENUMERATION that `entries()` once fed the prerenderer moved to
    `scripts/fan-out-routes.mjs`, which reads the same three fixture selectors
    and writes one `index.html` per route so a cold deep link resolves on a
    static host. Add a row to the fixture and the page appears with no edit
    here — the property `entries()` had, kept.

  NO WRAPPER ELEMENT. Svelte's `{#if}` emits no DOM of its own, so the matched
  screen's `.shell` is a direct child of the mount — which is `display: contents`
  and therefore transparent to layout. `scripts/verify-showcase-parity.mjs`
  measures the vertical gaps between `.shell`'s children and the height of the
  document, and a real `<div>` anywhere in that chain becomes one of them.

  THE THREE DRILL BRANCHES DO NOT REMOUNT between two ids of the same kind.
  Svelte keeps the component and updates the prop, and every screen derives its
  data with `$:`, so `/counterparties/cp-01/` → `/counterparties/cp-02/` is a
  prop change rather than a teardown. That is deliberate — the tables keep their
  sort and page while the data under them changes, the same as in the build
  these were copied from.
-->
<script lang="ts">
  import {
    getCounterpartyById,
    getFacilityById,
    getSectorById,
  } from '@awc-ui/showcase-kit/data';
  import { pathname } from '$lib/router';
  import OverviewScreen from '$lib/screens/OverviewScreen.svelte';
  import WatchlistScreen from '$lib/screens/WatchlistScreen.svelte';
  import StressScreen from '$lib/screens/StressScreen.svelte';
  import SectorScreen from '$lib/screens/SectorScreen.svelte';
  import CounterpartyScreen from '$lib/screens/CounterpartyScreen.svelte';
  import FacilityScreen from '$lib/screens/FacilityScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';

  /**
   * The three drill routes share one shape: a collection, one id, a trailing
   * slash. `[^/]+` rather than `.+` so `/facilities/fac-001/covenants/` does not
   * silently render facility `fac-001/covenants`.
   */
  const DRILL = /^\/(sectors|counterparties|facilities)\/([^/]+)\/$/;

  $: match = DRILL.exec($pathname);
  /*
   * The segment is percent-encoded on the way into the URL. The fixture ids are
   * plain ASCII today, but decoding is what makes a lookup miss mean "no such
   * row" rather than "the id had a character in it".
   */
  $: id = match ? decodeURIComponent(match[2]) : '';
  $: collection = match ? match[1] : '';
</script>

{#if $pathname === '/'}
  <OverviewScreen />
{:else if $pathname === '/watchlist/'}
  <WatchlistScreen />
{:else if $pathname === '/stress/'}
  <StressScreen />
{:else if collection === 'sectors' && getSectorById(id)}
  <SectorScreen sectorId={id} />
{:else if collection === 'counterparties' && getCounterpartyById(id)}
  <CounterpartyScreen counterpartyId={id} />
{:else if collection === 'facilities' && getFacilityById(id)}
  <FacilityScreen facilityId={id} />
{:else}
  <NotFoundScreen />
{/if}
