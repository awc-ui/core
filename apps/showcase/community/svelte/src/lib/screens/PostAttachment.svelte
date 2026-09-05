<!--
  Photos, a link card or a shared post — whichever this kind carries.

  ONE COMPONENT AND NOT THREE BRANCHES AT THE CALL SITE, because a shared post
  renders its own attachment too. It recurses by importing itself, which Svelte
  supports and which is bounded by the fixture: a share can never contain a
  share, and the generator asserts it.
-->
<script lang="ts">
  import type { FeedItem } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import Media from '$lib/bits/Media.svelte';
  import Byline from './Byline.svelte';
  import PostBody from './PostBody.svelte';
  import PostAttachment from './PostAttachment.svelte';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let item: FeedItem;
  export let nested = false;

  $: inner = item.shared
    ? ({
        post: item.shared.post,
        author: item.shared.author,
        group: item.shared.group,
        shared: null,
        preview: [],
        hiddenComments: 0,
      } as FeedItem)
    : null;
</script>

{#if item.post.media.length > 0}
  <div class="post-photos" data-count={String(item.post.media.length)}>
    {#each item.post.media as media, index (media.id)}
      <Drill
        linkClass="post-photos__cell"
        href={route.post(item.post.id)}
        aria-label={$t(media.altKey)}
      >
        <Media {media} eager={!nested && index === 0} />
      </Drill>
    {/each}
  </div>
{:else if item.post.link}
  <!-- NOT AN ANCHOR — nothing here navigates off the app, so a live href would
       put a real outbound request behind a fictional article; and a non-anchor
       can sit inside the post's own link target without nesting anchors. -->
  <md-tooltip text={$t('community.hint.linkNotReal')}>
    <div class="link-card">
      <Media media={item.post.link.image} className="link-card__image" />
      <div class="link-card__text">
        <span class="link-card__domain">{item.post.link.domain}</span>
        <p class="link-card__title">{$t(item.post.link.titleKey)}</p>
        <p class="link-card__about">{$t(item.post.link.descriptionKey)}</p>
      </div>
    </div>
  </md-tooltip>
{:else if inner}
  <!-- The inner post is rendered whole but NEVER its actions or comments: those
       belong to the original, and pressing them here would react to a post the
       reader is not looking at. -->
  <div class="shared-post">
    <Byline item={inner} compact />
    <PostBody post={inner.post} />
    <PostAttachment item={inner} nested />
  </div>
{/if}
