<!-- THREE COLUMNS ON A WIDE SCREEN — this vertical's signature layout. It pages
     by REVEALING, not by fetching: a scroll handler that appends on
     intersection is untestable in a parity check and would make the document
     height depend on how far the harness scrolled. -->
<script lang="ts">
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
  const items = feedItems();
  let shown = FEED_PAGE;
  const { message, say, close } = createSnackbar();
</script>

<Screen title={$t('community.screen.feed.title')} subtitle={$t('community.screen.feed.subtitle')}>
  <svelte:fragment slot="skeleton"><FeedSkeleton /></svelte:fragment>

  <div class="columns">
    <div class="columns__main">
      <Panel>
        <Composer {viewer} on:message={(e) => say(e.detail.key, e.detail.params)} />
      </Panel>

      {#if items.length === 0}
        <EmptyState
          message={$t('community.empty.feed')}
          hint={$t('community.empty.feedHint')}
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
        <div class="feed__end">
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
