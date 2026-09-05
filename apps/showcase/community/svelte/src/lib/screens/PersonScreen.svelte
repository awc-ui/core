<!-- THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN rather than a read-only
     copy: both URLs resolve, and offering to befriend yourself is the state
     `friendAction.self` exists to prevent. -->
<script lang="ts">
  import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ProfileSkeleton from '$lib/skeletons/ProfileSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import FriendButton from '$lib/bits/FriendButton.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import AboutPanel from './AboutPanel.svelte';
  import PhotoPanel from './PhotoPanel.svelte';
  import Timeline from './Timeline.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import ProfileScreen from './ProfileScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { friendshipFor, friendships, setFriendship } from '$lib/engagement';
  import { t } from '$lib/showcase';

  export let handle: string;
  const { message, say, close } = createSnackbar();

  $: person = getPersonByHandle(handle);
  $: isSelf = person?.id === getViewer().id;
  $: summary = person ? profileSummary(person.id) : null;
</script>

{#if !person}
  <NotFoundScreen />
{:else if isSelf}
  <ProfileScreen />
{:else if summary}
  <Screen
    title={person.displayName}
    subtitle={$t('community.screen.person.subtitle')}
    crumbLabel={person.displayName}
  >
    <svelte:fragment slot="skeleton"><ProfileSkeleton /></svelte:fragment>
    <svelte:fragment slot="aside"><Count value={summary.posts.length} /></svelte:fragment>

    <div class="columns">
      <div class="columns__main">
        <ProfileHeader {summary}>
          <svelte:fragment slot="action">
            <FriendButton
              {person}
              state={friendshipFor($friendships, person)}
              size="md"
              on:act={(e) => {
                const was = friendshipFor($friendships, person);
                setFriendship(person, e.detail);
                say(
                  e.detail === 'outgoing'
                    ? 'community.msg.friendRequested'
                    : e.detail === 'friend'
                      ? 'community.msg.friendAccepted'
                      : was === 'friend'
                        ? 'community.msg.friendRemoved'
                        : 'community.msg.requestCancelled',
                  { name: person.displayName },
                );
              }}
            />
          </svelte:fragment>
        </ProfileHeader>
        {#if summary.posts.length === 0}
          <EmptyState message={$t('community.empty.posts')} />
        {:else}
          <Timeline posts={summary.posts} on:message={(e) => say(e.detail.key, e.detail.params)} />
        {/if}
      </div>
      <aside class="columns__rail">
        <AboutPanel {summary} />
        <PhotoPanel {summary} />
      </aside>
    </div>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
