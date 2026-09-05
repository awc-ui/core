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

  THERE IS NO FAB IN THIS VERTICAL, and its absence is a decision rather than
  an omission. Lyra puts one here because posting is unambiguously its primary
  action and it has a Create DESTINATION for the FAB to point at. Corvus puts
  the composer inline at the top of the feed — which is where this kind of app
  has always put it, and why `route` has no `create()` to route to. A FAB would
  therefore either duplicate a control already on screen, or point at a screen
  that does not exist. `md-navigation-rail` renders nothing for an empty
  `slot="fab"`, so leaving it out costs no layout.
-->
<script lang="ts">
  import { DESTINATIONS } from '@awc-ui/showcase-kit/music';
  import { isPlainClick, navigate, pathname } from '$lib/router';
  import { destinationIndex, route, withBase } from '$lib/routes';
  import { railExpanded } from '$lib/shell';
  import { t } from '$lib/showcase';


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
  label={$t('music.nav.label')}
  variant={$railExpanded ? 'expanded' : 'standard'}
  active-index={activeIndex}
  label-visibility="all"
  on:click={onClick}
>
  {#each DESTINATIONS as destination (destination.value)}
    <md-navigation-rail-tab
      icon={destination.icon}
      label={$t(destination.labelKey)}
      value={destination.value}
      href={withBase(destination.path)}
    ></md-navigation-rail-tab>
  {/each}
</md-navigation-rail>
