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
  reload while the other four routed in place. The click is resolved through
  `composedPath()` because it starts inside the tab's shadow root and
  retargeting hides the anchor from a plain `event.target`.

  `active-index` is CONTROLLED from the pathname, so the indicator is a
  function of the URL and never of what was clicked last. Back and forward move
  it correctly for free.

  THE FAB is the one on the screen, and the rail is where M3 puts it: at the
  top, above the destinations, in `slot="fab"` — the only slot it belongs in.
  The rail drives its `extended` state from its own expansion, so `extended` is
  never set here. It routes to the exchange screen, a real destination with a real ticket: `mdClick` on `md-fab` is
  dispatched cancelable but the component never reads `defaultPrevented` —
  there is no veto hook — so this listens and routes rather than pretending to
  intercept.
-->
<script lang="ts">
  import { DESTINATIONS, getTotals } from '@awc-ui/showcase-kit/banking';
  import { isPlainClick, navigate, pathname } from '$lib/router';
  import { destinationIndex, route, withBase } from '$lib/routes';
  import { railExpanded } from '$lib/shell';
  import { t } from '$lib/showcase';

  const totals = getTotals();

  $: activeIndex = destinationIndex($pathname);

  function onClick(event: MouseEvent) {
    if (!isPlainClick(event)) return;
    const tab = event
      .composedPath()
      .find(
        (node): node is HTMLElement & { value?: string } =>
          node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-RAIL-TAB',
      );
    /*
     * The PROPERTY first, the attribute only as a fallback.
     *
     * Svelte binds `value={…}` on a custom element by assigning the property
     * when the element has one, and writes no attribute — so `getAttribute`
     * returned null here, no destination matched, and the handler bailed before
     * it could route. Every rail click in this build did nothing. React and Vue
     * happen to write the attribute as well, which is why only this build broke
     * and why the parity check could not see it: it compares the resolved
     * property, which was correct all along.
     */
    const value = tab?.value ?? tab?.getAttribute('value');
    const destination = DESTINATIONS.find((d) => d.value === value);
    if (!destination) return;
    event.preventDefault();
    navigate(destination.path);
  }
</script>

<md-navigation-rail
  class="shell__rail"
  label={$t('banking.nav.label')}
  variant={$railExpanded ? 'expanded' : 'standard'}
  active-index={activeIndex}
  label-visibility="all"
  on:click={onClick}
>
  <md-fab
    slot="fab"
    icon="currency_exchange"
    label={$t('banking.action.exchange')}
    on:mdClick={() => navigate(route.exchange())}
  ></md-fab>

  {#each DESTINATIONS as destination (destination.value)}
    <md-navigation-rail-tab
      icon={destination.icon}
      label={$t(destination.labelKey)}
      value={destination.value}
      href={withBase(destination.path)}
      badge-value={destination.value === 'transactions' && totals.pendingCount > 0
        ? String(totals.pendingCount)
        : undefined}
    ></md-navigation-rail-tab>
  {/each}
</md-navigation-rail>
