<!-- The SAME CARD as the feed with `showComments` on: a post is a post, and the
     only thing the drill adds is that the conversation is open. -->
<script lang="ts">
  import { getPersonById, getPostById, resolve } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import PostSkeleton from '$lib/skeletons/PostSkeleton.svelte';
  import PostCard from './PostCard.svelte';
  import RightRail from './RightRail.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { t } from '$lib/showcase';

  export let postId: string;
  const { message, say, close } = createSnackbar();

  $: post = getPostById(postId);
  $: author = post ? getPersonById(post.authorId) : undefined;
</script>

{#if !post || !author}
  <NotFoundScreen />
{:else}
  <Screen
    title={$t('community.screen.post.title')}
    subtitle={$t('community.screen.post.subtitle', { name: author.displayName })}
  >
    <svelte:fragment slot="skeleton"><PostSkeleton /></svelte:fragment>

    <div class="columns">
      <div class="columns__main">
        <PostCard
          item={resolve(post)}
          showComments
          on:message={(e) => say(e.detail.key, e.detail.params)}
        />
      </div>
      <aside class="columns__rail"><RightRail /></aside>
    </div>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
