<!--
  Top-level destinations at desktop width.

  `href` IS SET ON EVERY DESTINATION, and that has two consequences worth
  knowing. It makes each tab a real anchor, so ⌘-click opens a tab and "copy
  link address" copies something that resolves. And because a link cannot be an
  ARIA `tab`, the rail drops the `tablist` role from its destinations region —
  documented behaviour, and the right trade: these ARE links.

  Routing is driven from the NATIVE click rather than from `mdTabChange`. The
  anchor is what navigates, so only `preventDefault()` on the click can stop a
  full page reload — and `mdTabChange` does not fire when you re-activate the
  destination you are already on, which would leave that one click doing a
  reload while the other four routed in place. A native event needs no `v-awc`:
  plain `@click` is a real listener.

  `active-index` is CONTROLLED from the pathname, so the indicator is a
  function of the URL and never of what was clicked last. Back and forward move
  it correctly for free.

  The one FAB on the screen lives here, in `slot="fab"`, which is where M3 puts
  it: at the top, above the destinations. The rail drives its `extended` state
  from its own expansion, so `extended` is never set here. `mdClick` on md-fab
  is dispatched cancelable but the component never reads `defaultPrevented` —
  there is no veto hook — so the FAB listens and routes rather than pretending
  to intercept. It routes to the exchange screen, which is a real destination with a
  real ticket on it, unlike
  the React source does; the label already names the real action.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getTotals } from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import { useShell } from '~/composables/useShell';
import { isPlainActivation, usePathname, useRouter } from '~/lib/router';
import { DESTINATIONS, destinationIndex, route, withBase } from '~/lib/routes';

const t = useT();
const router = useRouter();
const totals = getTotals();
const { railExpanded } = useShell();
const here = usePathname();

const activeIndex = computed(() => destinationIndex(here.value));

function intercept(event: MouseEvent) {
  if (!isPlainActivation(event)) return;
  const tab = event
    .composedPath()
    .find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-RAIL-TAB',
    );
  const value = tab?.getAttribute('value');
  const destination = DESTINATIONS.find((d) => d.value === value);
  if (!destination) return;
  event.preventDefault();
  router.push(destination.path);
}

const fabListeners = { mdClick: () => router.push(route.exchange()) };
</script>

<template>
  <md-navigation-rail
    class="shell__rail"
    :label="t('banking.nav.label')"
    :variant="railExpanded ? 'expanded' : 'standard'"
    :active-index="activeIndex"
    label-visibility="all"
    @click="intercept"
  >
    <md-fab
      v-awc="{ on: fabListeners }"
      slot="fab"
      icon="currency_exchange"
      :label="t('banking.action.exchange')"
    ></md-fab>

    <md-navigation-rail-tab
      v-for="destination in DESTINATIONS"
      :key="destination.value"
      :icon="destination.icon"
      :label="t(destination.labelKey)"
      :value="destination.value"
      :href="withBase(destination.path)"
      :badge-value="
        destination.value === 'transactions' && totals.pendingCount > 0
          ? String(totals.pendingCount)
          : undefined
      "
    ></md-navigation-rail-tab>
  </md-navigation-rail>
</template>
