<!-- `resolve()` in the kit is the same join `feedItems()` does. -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { resolve, type Post } from '@awc-ui/showcase-kit/community';
  import PostCard from './PostCard.svelte';
  export let posts: Post[];
  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();
</script>

{#each posts as post (post.id)}
  <PostCard item={resolve(post)} on:message={(e) => dispatch('message', e.detail)} />
{/each}
