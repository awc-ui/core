<!--
  Your own profile: posts, saved, tagged.

  THREE TABS, AND `md-tabs` IS THE RIGHT COMPONENT HERE — the one place in this
  app it is. The house rule is that destinations are a rail or a bar and never
  tabs; these are not destinations. They are three views of the SAME thing,
  inside one screen, with one URL, which is what `md-tabs` is specified for.

  SAVED IS THE ONLY TAB THAT MOVES. Its contents come from the engagement store
  rather than the fixture, so a post saved on the feed appears here without a
  reload.
-->
<script lang="ts">
  import { getPosts, getViewer, profileSummary, type Post } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';
  import { saves, savedIds } from '$lib/engagement';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import PostGrid from './PostGrid.svelte';

  type Tab = 'posts' | 'saved' | 'tagged';

  const viewer = getViewer();
  const summary = profileSummary(viewer.id);
  const all = getPosts();

  let tab: Tab = 'posts';

  $: saved = all.filter((post) => savedIds($saves, all).has(post.id));
  /* Nothing in the fixture models "tagged in" — inventing a field for one tab
     would be data added to serve a layout. The tab exists because a profile has
     one, and its empty state is the honest answer. */
  const tagged: Post[] = [];

  $: shown = tab === 'posts' ? summary.posts : tab === 'saved' ? saved : tagged;

  /* The cast lives here, not in the markup: a Svelte template is not TypeScript
     and `as Tab` inside one is a parse error — which cascades into "module has
     no default export" at every import site. */
  function onTab(event: CustomEvent<{ value?: string }>) {
    tab = (event.detail?.value ?? 'posts') as Tab;
  }
</script>

<Screen title={$t('social.screen.profile.title')} subtitle={$t('social.screen.profile.subtitle')}>
  <svelte:fragment slot="aside"><Count value={summary.posts.length} exact /></svelte:fragment>
  <svelte:fragment slot="skeleton"><PanelSkeleton height="680px" lines={4} /></svelte:fragment>

  <ProfileHeader {summary} />

  <Panel>
    <md-tabs on:mdTabChange={onTab} variant="primary">
      <md-tab value="posts" label={$t('social.panel.posts')} icon="grid_on"></md-tab>
      <md-tab value="saved" label={$t('social.panel.saved')} icon="bookmark"></md-tab>
      <md-tab value="tagged" label={$t('social.panel.tagged.short')} icon="sell"></md-tab>
    </md-tabs>

    <PostGrid posts={shown}>
      <svelte:fragment slot="empty">
        {#if tab === 'saved'}
          <EmptyState message={$t('social.empty.saved')} hint={$t('social.empty.savedHint')} />
        {:else if tab === 'tagged'}
          <EmptyState message={$t('social.empty.tagged')} />
        {:else}
          <EmptyState message={$t('social.empty.posts')} />
        {/if}
      </svelte:fragment>
    </PostGrid>
  </Panel>
</Screen>
