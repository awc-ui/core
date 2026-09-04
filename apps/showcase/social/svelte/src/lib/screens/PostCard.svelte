<!--
  One post in the feed. The most-repeated component in the app.

  THE HEADER, THE PICTURE, THE ACTIONS, THE CAPTION, THE COMMENTS — in that
  order: the picture is the content, so nothing but a name goes above it; the
  actions sit directly under it because that is where the thumb is after
  looking; and the caption comes after the actions because it is prose, and
  prose that pushed the actions down would move the target every time a caption
  ran long.

  THE WHOLE CARD IS NOT A LINK. Only the name, the picture and the comment count
  navigate. Wrapping the card would swallow the four action buttons inside it —
  a control inside a link is reachable but announces the link's name, and
  pressing it with a keyboard fires both.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { engagement, getPersonById, type FeedItem } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import { likes, saves, isLiked, isSaved, toggleLike, toggleSave } from '$lib/engagement';
  import Drill from '$lib/components/Drill.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import PersonName from '$lib/bits/PersonName.svelte';
  import PostActions from '$lib/bits/PostActions.svelte';
  import PostMedia from '$lib/bits/PostMedia.svelte';
  import When from '$lib/bits/When.svelte';

  export let item: FeedItem;
  export let eager = false;

  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();

  $: post = item.post;
  $: liked = isLiked($likes, post);
  $: saved = isSaved($saves, post);
  /* The kit does the arithmetic of turning an override plus a shipped count
     into the number on screen — five builds must not each write
     `likeCount + (liked && !post.liked ? 1 : 0)` slightly differently. */
  $: counts = engagement(post, liked, saved);
  $: likesWord = $t('social.count.likes').toLocaleLowerCase($t.locale);

  /* Liking announces; UNliking does not. A snackbar is for something the reader
     may want to undo or verify, and taking a like back is already its own
     confirmation — the heart empties. Saving is the other way round: the post
     goes somewhere the reader cannot see from here. */
  const onLike = () =>
    dispatch('message', { key: toggleLike(post) ? 'social.msg.liked' : null });
  const onSave = () =>
    dispatch('message', { key: toggleSave(post) ? 'social.msg.saved' : 'social.msg.unsaved' });
  const onShare = () => dispatch('message', { key: 'social.msg.linkCopied' });
</script>

<article class="post-card">
  <header class="post-card__head">
    <!-- ONE link around the avatar and the name, with `PersonName` inside it
         rather than `PersonLink` — the latter is an anchor, and an anchor
         inside an anchor is invalid HTML that a framework builds without
         complaint and a screen reader reads as two overlapping links. -->
    <Drill href={route.person(item.author.handle)} linkClass="post-card__author">
      <Avatar person={item.author} size="small" ring />
      <span class="post-card__names">
        <PersonName person={item.author} />
        {#if post.locationKey}
          <span class="post-card__place">{$t(post.locationKey)}</span>
        {/if}
      </span>
    </Drill>
    <When at={post.postedAt} />
    <!-- No overflow menu. Every action behind one — report, copy link, mute —
         would be a control that does nothing in a fixture-backed demo. -->
  </header>

  <!-- The href goes INTO `PostMedia`, which puts the anchor around the image
       only. Wrapping the whole thing put the pager buttons inside the link. -->
  <PostMedia {post} {eager} href={route.post(post.id)} />

  <PostActions {liked} {saved} on:like={onLike} on:save={onSave} on:share={onShare} />

  <div class="post-card__body">
    <p class="post-card__counts"><Count value={counts.likeCount} /> {likesWord}</p>

    <!-- The caption is ONE paragraph led by the author's handle, which is how
         every app of this shape writes it — the name is part of the sentence,
         not a label above it. -->
    <p class="post-card__caption">
      <Drill href={route.person(item.author.handle)} linkClass="post-card__handle">
        {item.author.handle}
      </Drill>
      {$t(post.captionKey)}
    </p>

    {#if post.commentsDisabled}
      <p class="post-card__muted">{$t('social.hint.commentsOff')}</p>
    {:else}
      {#if item.hiddenComments > 0}
        <Drill href={route.post(post.id)} linkClass="post-card__more">
          {$t('social.action.viewComments', { count: $t.formatNumber(post.commentCount) })}
        </Drill>
      {/if}
      {#each item.preview as comment (comment.id)}
        <p class="post-card__comment">
          <!-- The record carries an author ID, not a handle — resolving it here
               is what stops `per-07` appearing where a name belongs. -->
          <Drill
            href={route.person(getPersonById(comment.authorId)?.handle ?? '')}
            linkClass="post-card__handle"
          >
            {getPersonById(comment.authorId)?.handle ?? comment.authorId}
          </Drill>
          {$t(comment.bodyKey)}
        </p>
      {/each}
    {/if}
  </div>
</article>
