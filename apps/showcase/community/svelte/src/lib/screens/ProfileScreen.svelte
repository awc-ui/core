<!-- NO FRIENDSHIP BUTTON — `friendAction.self` is null, and a screen that had
     to render "add yourself as a friend" has gone wrong upstream. -->
<script lang="ts">
  import { getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ProfileSkeleton from '$lib/skeletons/ProfileSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import AboutPanel from './AboutPanel.svelte';
  import PhotoPanel from './PhotoPanel.svelte';
  import Timeline from './Timeline.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { t } from '$lib/showcase';

  const summary = profileSummary(getViewer().id);
  const { message, say, close } = createSnackbar();
</script>

<Screen
  title={$t('community.screen.profile.title')}
  subtitle={$t('community.screen.profile.subtitle')}
>
  <svelte:fragment slot="skeleton"><ProfileSkeleton /></svelte:fragment>
  <svelte:fragment slot="aside"><Count value={summary.posts.length} /></svelte:fragment>

  <div class="columns">
    <div class="columns__main">
      <ProfileHeader {summary} />
      <Timeline posts={summary.posts} on:message={(e) => say(e.detail.key, e.detail.params)} />
    </div>
    <aside class="columns__rail">
      <AboutPanel {summary} />
      <PhotoPanel {summary} />
    </aside>
  </div>

  {#if summary.posts.length === 0}
    <EmptyState message={$t('community.empty.posts')} />
  {/if}
  <SnackbarHost message={$message} on:close={close} />
</Screen>
