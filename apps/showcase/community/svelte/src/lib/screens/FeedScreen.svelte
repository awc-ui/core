<!-- THREE COLUMNS ON A WIDE SCREEN — this vertical's signature layout. It pages
     by REVEALING, not by fetching: a scroll handler that appends on
     intersection is untestable in a parity check and would make the document
     height depend on how far the harness scrolled. -->
<script lang="ts">
  import { discoveryCopy, discoveryCount, discoverFeed, type DiscoveryFilter } from '@awc-ui/showcase-kit/community';
import { FEED_PAGE, feedItems, getViewer } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import FeedSkeleton from '$lib/skeletons/FeedSkeleton.svelte';
  import PostCard from './PostCard.svelte';
  import RightRail from './RightRail.svelte';
  import Composer from './Composer.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { t } from '$lib/showcase';

  const viewer = getViewer();
  const allItems = feedItems();
  let search = '';
  let filter: DiscoveryFilter = 'all';
  $: copy = discoveryCopy($t.locale);
  $: items = discoverFeed(allItems, search, filter, $t);
  function onSearch(event: CustomEvent<string>) { search = event.detail ?? ''; shown = FEED_PAGE; }
  function setFilter(value: DiscoveryFilter) { filter = value; shown = FEED_PAGE; }
  let shown = FEED_PAGE;
  const { message, say, close } = createSnackbar();
</script>

<Screen title={$t('community.screen.feed.title')} subtitle={$t('community.screen.feed.subtitle')}>
  <svelte:fragment slot="skeleton"><FeedSkeleton /></svelte:fragment>

  <section class="discovery-hero" aria-label={copy.eyebrow}>
    <div><span class="discovery-hero__eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p></div>
    <div class="discovery-hero__stat"><span class="material-symbols-outlined" aria-hidden="true">diversity_3</span><strong class="discovery-hero__number">{$t.formatNumber(allItems.length)}</strong><span class="discovery-hero__caption">{copy.stat}</span></div>
  </section>

  <div class="columns">
    <div class="columns__main">
      <div class="discovery-tools">
        <md-text-field label={copy.search} value={search} on:mdInput={onSearch}><span slot="leading-icon" class="material-symbols-outlined" aria-hidden="true">search</span></md-text-field>
        <div class="discovery-tools__filters" role="group" aria-label={copy.eyebrow}><md-button variant={filter === 'all' ? 'tonal' : 'text'} size="sm" icon="auto_awesome" aria-pressed={filter === 'all'} on:mdClick={() => setFilter('all')}>{copy.all}</md-button>
<md-button variant={filter === 'friends' ? 'tonal' : 'text'} size="sm" icon="people" aria-pressed={filter === 'friends'} on:mdClick={() => setFilter('friends')}>{copy.second}</md-button>
<md-button variant={filter === 'groups' ? 'tonal' : 'text'} size="sm" icon="groups" aria-pressed={filter === 'groups'} on:mdClick={() => setFilter('groups')}>{copy.third}</md-button></div>
        <div class="discovery-tools__row"><p class="discovery-tools__count" role="status">{discoveryCount(items.length, $t.locale)}</p><md-button class="discovery-tools__reset" size="sm" variant="text" icon="restart_alt" disabled={!search && filter === 'all'} on:mdClick={() => {search = ''; setFilter('all');}}>{copy.clear}</md-button></div>
      </div>
      <Panel>
        <Composer {viewer} on:message={(e) => say(e.detail.key, e.detail.params)} />
      </Panel>

      {#if items.length === 0}
        <EmptyState
          message={copy.empty}
          hint={copy.hint}
        />
      {:else}
        {#each items.slice(0, shown) as item (item.post.id)}
          <PostCard {item} on:message={(e) => say(e.detail.key, e.detail.params)} />
        {/each}
      {/if}

      {#if shown < items.length}
        <div class="feed__more">
          <md-button variant="tonal" icon="expand_more" on:mdClick={() => (shown = items.length)}>
            {$t('community.action.viewAll')}
          </md-button>
        </div>
      {:else}
        <div class="feed__end" hidden={items.length === 0}>
          <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <p class="strong">{$t('community.common.caughtUp')}</p>
          <p class="muted">{$t('community.common.caughtUpHint')}</p>
        </div>
      {/if}
    </div>

    <aside class="columns__rail" aria-label={$t('community.panel.contacts')}>
      <RightRail />
    </aside>
  </div>

  <SnackbarHost message={$message} on:close={close} />
</Screen>
