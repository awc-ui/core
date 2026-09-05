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

  THERE IS NO FAB IN THIS VERTICAL, and its absence is a decision rather than
  an omission. Lyra puts one here because posting is unambiguously its primary
  action and it has a Create DESTINATION for the FAB to point at. Cygnus puts
  the composer inline at the top of the feed — which is where this kind of app
  has always put it, and why `route` has no `create()` to route to. A FAB would
  therefore either duplicate a control already on screen, or point at a screen
  that does not exist. `md-navigation-rail` renders nothing for an empty
  `slot="fab"`, so leaving it out costs no layout.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';
import { useShell } from '~/composables/useShell';
import { isPlainActivation, usePathname, useRouter } from '~/lib/router';
import { DESTINATIONS, destinationIndex, route, withBase } from '~/lib/routes';

const t = useT();
const router = useRouter();
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

</script>

<template>
  <md-navigation-rail
    class="shell__rail"
    :label="t('music.nav.label')"
    :variant="railExpanded ? 'expanded' : 'standard'"
    :active-index="activeIndex"
    label-visibility="all"
    @click="intercept"
  >

    <md-navigation-rail-tab
      v-for="destination in DESTINATIONS"
      :key="destination.value"
      :icon="destination.icon"
      :label="t(destination.labelKey)"
      :value="destination.value"
      :href="withBase(destination.path)"
    ></md-navigation-rail-tab>
  </md-navigation-rail>
</template>
