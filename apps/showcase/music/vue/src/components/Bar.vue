<!--
  The same five destinations, docked at the bottom, below 900px.

  FIVE IS THE CEILING. `md-navigation-bar` is specified for 3–5 and its manual
  says so twice; the kit's `DESTINATIONS` is sized for that, which is why the
  household drill is not a destination.

  The click is vetoed in the CAPTURE phase (`@click.capture`), and that is not
  a style choice: `md-navigation-tab` reads `event.defaultPrevented` before it
  acts, and with `href` set it navigates by `window.location.assign()` — a full
  page load of a single-page application. A bubbling listener would run after
  that has already been decided. The manual names this exact hook for SPA
  routing.

  There is no ⌘-click concession here as there is on the rail: the bar tab is
  not an anchor at all (`href` does not render one), so the browser has nothing
  to open in a new tab either way.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';
import { usePathname, useRouter } from '~/lib/router';
import { DESTINATIONS, destinationIndex, withBase } from '~/lib/routes';

const t = useT();
const router = useRouter();
const here = usePathname();

const activeIndex = computed(() => destinationIndex(here.value));

function intercept(event: MouseEvent) {
  const tab = event
    .composedPath()
    .find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-TAB',
    );
  const value = tab?.dataset.value;
  const destination = DESTINATIONS.find((d) => d.value === value);
  if (!destination) return;
  event.preventDefault();
  router.push(destination.path);
}
</script>

<template>
  <md-navigation-bar
    class="shell__bar"
    :aria-label="t('music.nav.label')"
    :active-index="activeIndex"
    label-behavior="always"
    @click.capture="intercept"
  >
    <md-navigation-tab
      v-for="destination in DESTINATIONS"
      :key="destination.value"
      :data-value="destination.value"
      :icon="destination.icon"
      :active-icon="destination.activeIcon"
      :label="t(destination.labelKey)"
      :href="withBase(destination.path)"
    ></md-navigation-tab>
    <!-- `value` is not a prop on md-navigation-tab (the rail tab has one; this
         one reports an index), so the routing key rides on a data attribute —
         which `dataset` reads back without any coupling to the component. -->
  </md-navigation-bar>
</template>
