<!--
  The frame every screen sits in: masthead, section nav, breadcrumb trail,
  screen heading, and the showcase dock.

  Not a single string is written here — the translator resolves all of them,
  including the ones that look like constants (the brand name, the base-currency
  note). The reporting date is formatted through `formatDate`, which is pinned to
  `timeZone: 'UTC'`, so 2026-03-31 is 31 March in every locale and on every
  machine that builds this.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
import { useT } from '~/composables/useShowcase';
import { usePathname, useRouter } from '~/lib/router';
import { BASE_PATH, route, withBase } from '~/lib/routes';
import type { Crumb } from '~/lib/types';
import DockBar from './DockBar.vue';

defineProps<{
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
}>();

const t = useT();
const router = useRouter();

const sections = computed(() => [
  { path: route.overview(), icon: 'dashboard', label: t.value('nav.overview') },
  { path: route.watchlist(), icon: 'warning', label: t.value('nav.watchlist') },
  { path: route.stress(), icon: 'stacked_line_chart', label: t.value('nav.stress') },
]);

/** The screen path. `usePathname()` strips `BASE_PATH` for us, so this is already bare. */
const here = usePathname();

// The overview owns `/` and would otherwise match every path.
const isCurrent = (path: string) =>
  path === '/' ? here.value === '/' : here.value.startsWith(path);

/**
 * `href` on `md-button` and `md-breadcrumb-item` is a REAL anchor, which is why
 * both work with JavaScript off and honour ⌘-click. Left alone it also means
 * every nav click is a full page reload in a client-routed app, tearing down and
 * rebuilding the document and re-registering every component. These handlers
 * veto the navigation and route in place instead.
 *
 * MODIFIER KEYS PASS THROUGH. Cancelling unconditionally would route a ⌘-click
 * in place instead of opening a new tab — the link would look like a link, carry
 * a real href, and then quietly refuse to behave like one. `originalEvent` is
 * the MouseEvent or KeyboardEvent that produced the selection, so one check
 * covers the Enter path too.
 *
 * Both events bubble (mdClick from the button to the nav, mdSelect from the item
 * to the strip), so one listener per container is enough.
 */
function intercept(event: Event) {
  const detail = (event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>)
    .detail;
  const href = detail?.href;
  if (!href) return;
  const original = detail?.originalEvent;
  if (original?.metaKey || original?.ctrlKey || original?.shiftKey) return;
  event.preventDefault();
  // The router owns paths WITHOUT the base, and these hrefs carry it.
  router.push(href.startsWith(BASE_PATH) ? href.slice(BASE_PATH.length) || '/' : href);
}

const navListeners = { mdClick: intercept };
const trailListeners = { mdSelect: intercept };
</script>

<template>
  <div class="shell">
    <!--
      Identity, sections and reporting context share one bar. The nav is INSIDE
      the masthead rather than on its own row beneath it — it is still a real
      <nav> with its own accessible name, so nothing is lost to assistive tech by
      the two being visually joined.
    -->
    <header class="shell__masthead">
      <p class="shell__brand">{{ t('app.brand') }}</p>
      <span class="muted">{{ t('app.title') }}</span>

      <!-- The current section is `tonal` rather than `text`: without it three
           identical buttons give no feedback at all when one of them is the page
           you are already on. -->
      <nav v-awc="{ on: navListeners }" class="shell__nav" :aria-label="t('nav.label')">
        <md-button
          v-for="section in sections"
          :key="section.path"
          :variant="isCurrent(section.path) ? 'tonal' : 'text'"
          size="sm"
          :icon="section.icon"
          :href="withBase(section.path)"
          :aria-current="isCurrent(section.path) ? 'page' : undefined"
        >
          {{ section.label }}
        </md-button>
      </nav>

      <div class="shell__meta">
        <span>{{ t('app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') }) }}</span>
        <span>{{ t('app.reportingQuarter', { quarter: REPORTING_QUARTER }) }}</span>
        <span>{{ t('app.baseCurrency', { currency: BASE_CURRENCY }) }}</span>
      </div>
    </header>

    <!-- The trail has its own row above the heading.

         It appears on the drill path (sector → counterparty → facility), where
         it is the only thing showing where you are and the only way back up. Not
         on the three section screens: the nav already highlights the section, so
         a trail reading "Overview / Watchlist" would only say it twice.

         The ROW is always rendered even when empty, because a row that comes and
         goes is what was moving the heading and every panel under it by 52px on
         each navigation. Its height is reserved in the shared stylesheet. -->
    <div class="shell__trail">
      <md-breadcrumbs
        v-if="crumbs && crumbs.length > 1"
        v-awc="{ on: trailListeners }"
        :label="t('nav.breadcrumb')"
        max-items="4"
        items-before-collapse="1"
        items-after-collapse="2"
      >
        <md-breadcrumb-item
          v-for="(crumb, index) in crumbs"
          :key="`${crumb.label}-${index}`"
          :href="crumb.href ? withBase(crumb.href) : undefined"
        >
          {{ crumb.label }}
        </md-breadcrumb-item>
      </md-breadcrumbs>
    </div>

    <div class="screen-head">
      <div class="screen-head__text">
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.aside" class="screen-head__aside"><slot name="aside" /></div>
    </div>

    <slot />
  </div>

  <DockBar />
</template>
