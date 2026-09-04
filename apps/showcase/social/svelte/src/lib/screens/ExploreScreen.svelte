<!--
  Explore — everything on Lyra, as a grid.

  A MASONRY-ISH GRID WITHOUT MASONRY. One in seven tiles spans two columns and
  two rows, which stops a uniform grid reading as a contact sheet. The span
  comes from the kit and is derived from the post's INDEX rather than drawn at
  random, so all five builds lay out identically.

  EVERY TILE IS SQUARE-CROPPED, whatever the picture's own ratio — the one place
  this app deliberately throws away an aspect ratio. The full ratio comes back
  the moment the reader opens the post.

  THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, and the field says so: a selector
  cannot see the dictionary, so a caption search would work in English and
  silently return nothing in Arabic.
-->
<script lang="ts">
  import { exploreTiles, getTotals, postKindIcon, topicFacets } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Media from '$lib/bits/Media.svelte';
  import TopicChip from '$lib/bits/TopicChip.svelte';

  const totals = getTotals();

  let topic: string | null = null;
  let search = '';

  $: facets = topicFacets(search || undefined);
  $: tiles = exploreTiles(topic ?? undefined, search || undefined);
  $: filtered = topic !== null || search !== '';

  /* `md-search` carries `{ value }` on every one of its events — unlike
     `md-text-field`, whose `mdInput` detail IS the bare string. Different
     components, different shapes. `mdSearch` rather than `mdInput` because it
     is debounced and distinct-until-changed. */
  function onSearch(event: CustomEvent<{ value: string }>) {
    search = event.detail?.value ?? '';
  }

  /* Typed as a plain `Event` and narrowed here: `mdSelect` bubbles from the
     chip to this `<div>`, and Svelte only knows the standard event map for a
     plain element — the alternative is a cast at the call site, which hides
     the same thing somewhere less obvious. */
  function onFacet(event: Event) {
    const detail = (event as CustomEvent<{ selected: boolean }>).detail;
    const value = (event.target as HTMLElement | null)?.dataset?.topic;
    if (!value) return;
    topic = detail.selected ? value : null;
  }
</script>

<Screen title={$t('social.screen.explore.title')} subtitle={$t('social.screen.explore.subtitle')}>
  <svelte:fragment slot="aside"><Count value={tiles.length} /></svelte:fragment>
  <svelte:fragment slot="skeleton"><PanelSkeleton height="720px" /></svelte:fragment>

  <Panel title={$t('social.panel.topics')}>
    <div class="stack">
      <!-- The wrapper is what makes it fill the panel: `md-search` carries a
           360px minimum and a 720px maximum and centres itself in a wider
           parent, so `full-width` alone left it marooned in the middle. -->
      <div class="explore-search">
        <md-search
          on:mdSearch={onSearch}
          layout="docked"
          trigger="bar"
          variant="contained"
          full-width
          debounce="250"
          label={$t('social.action.search')}
          placeholder={$t('social.count.people')}
          value={search}
        ></md-search>
      </div>

      <div class="facet-row" on:mdSelect={onFacet}>
        {#each facets as facet (facet.id)}
          <TopicChip id={facet.id} selected={topic === facet.id} />
        {/each}
      </div>

      <div class="row row--between facet-foot">
        <span class="muted">
          {$t('social.common.showing', { shown: tiles.length, total: totals.feedCount })}
        </span>
        <!-- The reset exists only while there is something to reset; a
             permanently-inert control in a filter bar is furniture. -->
        {#if filtered}
          <md-button
            on:mdClick={() => { topic = null; search = ''; }}
            variant="text"
            size="sm"
            icon="restart_alt"
          >
            {$t('social.action.clearFilters')}
          </md-button>
        {/if}
      </div>
    </div>
  </Panel>

  {#if tiles.length === 0}
    <EmptyState message={$t('social.empty.explore')} hint={$t('social.empty.exploreHint')} />
  {:else}
    <ul class="explore-grid">
      {#each tiles as tile (tile.post.id)}
        <li class="explore-tile" data-span={tile.span === 2 ? '2' : undefined}>
          <!-- The link's accessible name is the picture's alt plus whose it is.
               A grid of forty links all named "Post" is one a screen reader
               cannot navigate. -->
          <Drill
            href={route.post(tile.post.id)}
            linkClass="explore-tile__link"
            aria-label={`${$t(tile.post.media[0].altKey)} — ${tile.author.displayName}`}
          >
            <Media media={tile.post.media[0]} className="explore-tile__img" />
            {#if postKindIcon[tile.post.kind]}
              <span class="explore-tile__badge on-media material-symbols-outlined" aria-hidden="true">
                {postKindIcon[tile.post.kind]}
              </span>
            {/if}
          </Drill>
        </li>
      {/each}
    </ul>
  {/if}
</Screen>
