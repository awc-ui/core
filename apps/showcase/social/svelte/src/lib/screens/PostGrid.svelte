<!--
  A square grid of posts, three across.

  PINNED POSTS LEAD, and they say so with a badge — otherwise a grid ordered by
  anything but date looks like a grid that has lost its order. The ordering is
  `getPersonPosts()` in the kit, so all five builds pin the same two.
-->
<script lang="ts">
  import { postKindIcon, type Post } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Drill from '$lib/components/Drill.svelte';
  import Media from '$lib/bits/Media.svelte';

  export let posts: Post[];
</script>

{#if posts.length === 0}
  <slot name="empty" />
{:else}
  <ul class="post-grid">
    {#each posts as post (post.id)}
      <li class="post-grid__cell">
        <Drill
          href={route.post(post.id)}
          linkClass="post-grid__link"
          aria-label={$t(post.media[0].altKey)}
        >
          <Media media={post.media[0]} className="post-grid__img" />
          {#if post.pinned}
            <span class="post-grid__pin on-media">
              <span class="material-symbols-outlined" aria-hidden="true">push_pin</span>
              {$t('social.hint.gridSpan')}
            </span>
          {/if}
          {#if postKindIcon[post.kind]}
            <span class="post-grid__badge on-media material-symbols-outlined" aria-hidden="true">
              {postKindIcon[post.kind]}
            </span>
          {/if}
        </Drill>
      </li>
    {/each}
  </ul>
{/if}
