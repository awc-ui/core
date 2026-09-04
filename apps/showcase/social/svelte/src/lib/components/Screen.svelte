<!--
  The frame every screen's CONTENT sits in: breadcrumb trail row, screen
  heading, optional toolbar, and the placeholder system.

  The app bar, rail and compact bar are NOT here — they live in
  `AppFrame.svelte`, above the route outlet, so they survive navigation. This
  component is rendered by each screen and torn down with it.

  SLOTS: the default slot is the screen body; `aside` puts chips, dots or
  counts beside the heading; `actions` renders screen-level actions inside an
  `md-toolbar` (one tab stop, arrow-key movement — emphasise at most one
  control, the FAB in the rail is already the screen's loudest); `skeleton` is
  the measured placeholder shown while the screen settles — omit it and the
  screen gets `<ScreenSkeleton>`, which is only right for pages with nothing
  much to stand in for (the not-found screen, the household guard).

  THE PLACEHOLDER IS PAINTED OVER THE REAL CONTENT, never in its place. The
  children go into the tree from the FIRST render inside `.screen-body` with
  `data-placeholder` set while not ready (kit CSS makes it visibility:hidden —
  the box is kept, the components' lazy chunks load during the beat, and the
  reveal is a visibility flip with 0px of movement at every width, density and
  locale, by construction rather than by arithmetic). The skeleton is
  absolutely positioned over it in `.screen-stage__placeholder`. The children
  render ONCE, never as a second copy: element ids in this app are literals
  (`md-menu` resolves `anchor` with `getElementById`), so two mounted copies
  would double every id.
-->
<script lang="ts" context="module">
  /**
   * Screens already visited in this session. Module scope, so it outlives
   * every component and every navigation.
   */
  const seen = new Set<string>();

  /**
   * `?skeleton=` — an inspection handle on a state that is otherwise 550ms
   * long.
   *
   *   ?skeleton=hold   the placeholder stays up and never resolves
   *   ?skeleton=4000   the placeholder lasts 4000ms instead of 550
   *
   * Either form also defeats the once-per-screen rule, so the placeholder
   * shows again every time you navigate rather than only on a first visit.
   *
   * Read once, at module scope: it is a URL flag for looking at the app, not
   * state, and re-reading it per render would invite someone to treat it as
   * something that can change.
   */
  const SKELETON_FLAG = (() => {
    if (typeof location === 'undefined') return null;
    const raw = new URLSearchParams(location.search).get('skeleton');
    if (raw === null) return null;
    if (raw === 'hold' || raw === '') return { hold: true, ms: 0 };
    const ms = Number.parseInt(raw, 10);
    return Number.isFinite(ms) && ms > 0 ? { hold: false, ms } : { hold: true, ms: 0 };
  })();
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pathname } from '$lib/router';
  import { t } from '$lib/showcase';
  import { SKELETON_MS } from '$lib/skeletons';
  import ScreenSkeleton from '$lib/skeletons/ScreenSkeleton.svelte';
  import { crumbsFor } from '$lib/routes';
  import Breadcrumbs from './Breadcrumbs.svelte';

  export let title: string;
  export let subtitle: string | undefined = undefined;
  /**
   * The proper noun for the last crumb, where the trail has one.
   *
   * Only the person drill needs it: a post's own crumb is a translated label,
   * because a post has no name. The PATH decides the shape of the trail; this
   * supplies the one part the kit cannot know.
   */
  export let crumbLabel: string | null = null;

  /*
   * DERIVED FROM THE PATH, not passed in by the screen. A screen that declared
   * its own parent could disagree with the kit's route table, and the two drill
   * screens are exactly where that would go unnoticed. `crumbsFor` returns an
   * empty array on the five destinations, which is also how a top-level screen
   * gets an empty row without saying anything.
   */
  $: crumbs = crumbsFor($pathname, crumbLabel);

  /**
   * False for a beat the FIRST time a screen is opened, true immediately
   * after. The skeleton shows once per screen, where it is honest about a
   * first paint, and never again — an SPA's whole proposition is that the
   * second visit is instant. Keyed on the PATHNAME, not on mount: two visits
   * to the same screen TYPE — one household then another — reuse the component
   * instance, so a mount-only gate would never re-run for the second.
   */
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $: beat($pathname);

  function beat(path: string) {
    if (timer !== undefined) clearTimeout(timer);
    // Held open on purpose — nothing to schedule, and nothing is ever marked
    // seen, so every navigation shows the placeholder again.
    if (SKELETON_FLAG?.hold) {
      ready = false;
      return;
    }
    if (!SKELETON_FLAG && seen.has(path)) {
      ready = true;
      return;
    }
    ready = false;
    timer = setTimeout(() => {
      seen.add(path);
      ready = true;
    }, SKELETON_FLAG?.ms ?? SKELETON_MS);
  }

  // Cleared on the way out, so a fast click-through does not leave a pending
  // timeout that flips a screen the reader has already left.
  onDestroy(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
</script>

<!-- The trail row is ALWAYS rendered, even when empty. A row that comes and
     goes moves the heading and every panel under it on each navigation, which
     is what "jumpy" means; its height is reserved in `.shell__trail`.

     A trail of ONE is shown rather than dropped: the single crumb is
     link-less, so it reads as the current page rather than as somewhere else
     to go, and a consistently-placed trail is worth more than avoiding one
     repetition of a word. -->
<div class="shell__trail">
  {#if crumbs.length > 0}
    <Breadcrumbs {crumbs} />
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

{#if $$slots.actions}
  <div class="screen-toolbar">
    <!-- `floating`, not `docked`: a docked toolbar is `position: sticky`
         against the BOTTOM edge, where the navigation bar and the dock already
         are. `vibrant` puts the pill on primary-container and applies the MD3
         expressive toolbar-only token map to the icon buttons inside it —
         scoped to slotted children, so it touches nothing else. This is the
         app's ONLY `md-toolbar`; every screen's actions pass through here. -->
    <md-toolbar variant="floating" color="vibrant" aria-label={$t('social.nav.toolbar')}>
      <slot name="actions" />
    </md-toolbar>
  </div>
{/if}

<div class="screen-stage">
  <div class="screen-body" data-placeholder={ready ? undefined : ''}>
    <slot />
  </div>
  {#if !ready}
    <div class="screen-stage__placeholder">
      <slot name="skeleton">
        <ScreenSkeleton label={title} />
      </slot>
    </div>
  {/if}
</div>
