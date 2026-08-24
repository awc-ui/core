<!--
  The frame every screen sits in: masthead, section nav, breadcrumb trail,
  screen heading, and the showcase dock.

  Not a single string is written here — `$t` resolves all of them, including the
  ones that look like constants (the brand name, the base-currency note). The
  reporting date is formatted through the translator's `formatDate`, which is
  pinned to `timeZone: 'UTC'`, so 2026-03-31 is 31 March in every locale and on
  every machine that builds this.
-->
<script lang="ts">
  import { isPlainClick, navigate, pathname } from '$lib/router';
  import { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
  import { t } from '$lib/showcase';
  import { route, withBase } from '$lib/routes';
  import type { Crumb } from '$lib/types';
  import Dock from './Dock.svelte';

  export let title: string;
  export let subtitle: string | undefined = undefined;
  export let crumbs: Crumb[] = [];

  $: sections = [
    { path: route.overview(), icon: 'dashboard', label: $t('nav.overview') },
    { path: route.watchlist(), icon: 'warning', label: $t('nav.watchlist') },
    { path: route.stress(), icon: 'stacked_line_chart', label: $t('nav.stress') },
  ];

  /**
   * The screen path. Already unprefixed — the router strips the mount on the
   * way in from `location`, which is the same thing this component used to do
   * by hand against SvelteKit's `base`.
   */
  $: here = $pathname;

  // The overview owns `/` and would otherwise match every path.
  const isCurrent = (path: string, at: string) => (path === '/' ? at === '/' : at.startsWith(path));

  /**
   * `href` on `md-button` and `md-breadcrumb-item` is a REAL anchor, which is
   * why both work with JavaScript off and honour ⌘-click. Left alone it also
   * means every nav click is a full page reload in a client-routed app,
   * tearing down and rebuilding the document and re-registering every
   * component. These handlers veto the navigation and route in place instead.
   *
   * MODIFIER KEYS PASS THROUGH. Cancelling unconditionally would route a
   * ⌘-click in place instead of opening a new tab — the link would look like a
   * link, carry a real href, and then quietly refuse to behave like one.
   * `originalEvent` is the MouseEvent or KeyboardEvent that produced the
   * selection, so `isPlainClick` covers the Enter path too.
   *
   * The `href` in the detail is the anchor's own, so it is PREFIXED with the
   * mount. `navigate()` normalises either flavour — see `$lib/router`.
   */
  function intercept(event: Event) {
    const detail = (event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>)
      .detail;
    const href = detail?.href;
    if (!href) return;
    if (!isPlainClick(detail?.originalEvent)) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<div class="shell">
  <!--
    Identity, sections and reporting context share one bar. The nav is INSIDE
    the masthead rather than on its own row beneath it — it is still a real
    <nav> with its own accessible name, so nothing is lost to assistive tech by
    the two being visually joined.
  -->
  <header class="shell__masthead">
    <p class="shell__brand">{$t('app.brand')}</p>
    <span class="muted">{$t('app.title')}</span>

    <!-- mdClick bubbles from the button to the nav, so one listener is enough.
         The current section is `tonal` rather than `text`: without it three
         identical buttons give no feedback at all when one of them is the page
         you are already on. -->
    <nav class="shell__nav" aria-label={$t('nav.label')} on:mdClick={intercept}>
      {#each sections as section (section.path)}
        <md-button
          variant={isCurrent(section.path, here) ? 'tonal' : 'text'}
          size="sm"
          icon={section.icon}
          href={withBase(section.path)}
          aria-current={isCurrent(section.path, here) ? 'page' : undefined}
        >
          {section.label}
        </md-button>
      {/each}
    </nav>

    <div class="shell__meta">
      <span>{$t('app.reportingDate', { date: $t.formatDate(REPORTING_DATE, 'medium') })}</span>
      <span>{$t('app.reportingQuarter', { quarter: REPORTING_QUARTER })}</span>
      <span>{$t('app.baseCurrency', { currency: BASE_CURRENCY })}</span>
    </div>
  </header>

  <!-- The trail has its own row above the heading.

       It appears on the drill path (sector → counterparty → facility), where it
       is the only thing showing where you are and the only way back up. Not on
       the three section screens: the nav already highlights the section, so a
       trail reading "Overview / Watchlist" would only say it twice.

       The ROW is always rendered even when empty, because a row that comes and
       goes is what was moving the heading and every panel under it by 52px on
       each navigation. Its height is reserved in the shared stylesheet. -->
  <div class="shell__trail">
    {#if crumbs.length > 1}
      <!-- mdSelect is cancelable and bubbles from the item to the strip, so one
           listener on the strip is enough. The trail still works with JS off
           because the items carry real hrefs. -->
      <md-breadcrumbs
        label={$t('nav.breadcrumb')}
        max-items="4"
        items-before-collapse="1"
        items-after-collapse="2"
        on:mdSelect={intercept}
      >
        {#each crumbs as crumb, index (`${crumb.label}-${index}`)}
          <md-breadcrumb-item href={crumb.href ? withBase(crumb.href) : undefined}>
            {crumb.label}
          </md-breadcrumb-item>
        {/each}
      </md-breadcrumbs>
    {/if}
  </div>

  <div class="screen-head">
    <div class="screen-head__text">
      <h1>{title}</h1>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
    {#if $$slots.aside}
      <div class="screen-head__aside"><slot name="aside" /></div>
    {/if}
  </div>

  <slot />
</div>

<Dock />
