<!--
  Somebody else's profile. The second of the two drills.

  THE SAME HEADER AND GRID AS YOUR OWN, plus a follow button and minus the saved
  and tagged tabs — which are yours, not theirs.

  ADDRESSED BY HANDLE, which is what makes this screen's URL something a reader
  could actually type.
-->
<script lang="ts">
  import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';
  import { follows, isFollowing, setFollowing } from '$lib/engagement';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import FollowButton from '$lib/bits/FollowButton.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import PostGrid from './PostGrid.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import ProfileScreen from './ProfileScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';

  export let handle: string;

  const { message, say, close } = createSnackbar();

  $: person = getPersonByHandle(handle);
  /* THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN, rather than a read-only
     copy of it. Both URLs resolve, and answering with a page offering to follow
     yourself would be the state `followAction.self` exists to prevent. */
  $: isSelf = person?.id === getViewer().id;
  $: summary = person ? profileSummary(person.id) : null;

  function toggle(next: boolean) {
    if (!person) return;
    setFollowing(person, next);
    say(next ? 'social.msg.followed' : 'social.msg.unfollowed', { name: person.displayName });
  }
</script>

{#if !person}
  <NotFoundScreen />
{:else if isSelf}
  <ProfileScreen />
{:else if summary}
  <Screen
    title={person.displayName}
    subtitle={$t('social.screen.person.subtitle')}
    crumbLabel={person.displayName}
  >
    <svelte:fragment slot="aside"><Count value={summary.posts.length} exact /></svelte:fragment>
    <svelte:fragment slot="skeleton"><PanelSkeleton height="680px" lines={4} /></svelte:fragment>

    <ProfileHeader {summary}>
      <svelte:fragment slot="action">
        <FollowButton
          {person}
          following={isFollowing($follows, person)}
          size="md"
          on:toggle={(e) => toggle(e.detail)}
        />
      </svelte:fragment>
    </ProfileHeader>

    <Panel title={$t('social.panel.posts')}>
      <svelte:fragment slot="actions"><Count value={summary.posts.length} exact /></svelte:fragment>
      <PostGrid posts={summary.posts}>
        <svelte:fragment slot="empty">
          <EmptyState message={$t('social.empty.posts')} />
        </svelte:fragment>
      </PostGrid>
    </Panel>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
