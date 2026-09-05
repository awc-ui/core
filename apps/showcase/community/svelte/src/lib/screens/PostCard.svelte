<!--
  One post. The most-repeated component in the app and the most complex, and
  both for the same reason: four kinds share it, and one of them contains
  another post.

  THE ORDER IS BYLINE, BODY, ATTACHMENT, AGGREGATE, ACTIONS, COMMENTS — the body
  comes SECOND, which is the whole inversion from Lyra. There the picture is the
  post and the caption trails it; here the writing is the post.

  THE WHOLE CARD IS NOT A LINK: wrapping it would swallow the reaction picker,
  its six option buttons and the comment box.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { reactionSummary, type FeedItem } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import ReactButton from '$lib/bits/ReactButton.svelte';
  import ReactionSummaryRow from '$lib/bits/ReactionSummaryRow.svelte';
  import Byline from './Byline.svelte';
  import PostBody from './PostBody.svelte';
  import PostAttachment from './PostAttachment.svelte';
  import CommentThread from './CommentThread.svelte';
  import { reactionFor, reactions, setReaction } from '$lib/engagement';
  import { t } from '$lib/showcase';

  export let item: FeedItem;
  export let showComments = false;

  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();
  const say = (key: string | null, params?: Record<string, string | number>) =>
    dispatch('message', { key, params });

  let open = showComments;

  $: mine = reactionFor($reactions, item.post);
  /* The kit does the arithmetic of turning an override plus a shipped count
     into the numbers on screen — including the SWITCH case, where a reader
     moves between reactions and two counts have to move. */
  $: summary = reactionSummary(item.post.reactions, item.post.viewerReaction, mine);
</script>

<Panel>
  <article class="post-card" data-post={item.post.id}>
    {#if item.shared}
      <p class="post-card__meta">
        {$t(
          item.shared.group ? 'community.hint.sharedGroupPost' : 'community.hint.sharedPost',
          { name: item.author.displayName, group: item.shared.group?.name ?? '' },
        )}
      </p>
    {/if}

    <Byline {item} />
    <PostBody post={item.post} />
    <PostAttachment {item} />

    <ReactionSummaryRow
      {summary}
      commentCount={item.post.commentCount}
      shareCount={item.post.shareCount}
      on:openComments={() => (open = true)}
    />

    <div class="post-actions">
      <ReactButton
        {mine}
        on:pick={(e) => {
          setReaction(item.post, e.detail);
          /* Reacting announces; taking it back does not — un-reacting is
             already its own confirmation, the button goes grey. */
          say(e.detail ? 'community.reaction.summary' : null, {
            count: summary.total + (e.detail ? 1 : 0),
          });
        }}
      />
      <md-button variant="text" icon="mode_comment" aria-expanded={open} on:mdClick={() => (open = !open)}>
        {$t('community.action.comment')}
      </md-button>
      <md-button variant="text" icon="share" on:mdClick={() => say('community.msg.linkCopied')}>
        {$t('community.action.share')}
      </md-button>
    </div>

    {#if open}
      {#if item.post.commentsDisabled}
        <p class="muted">{$t('community.hint.commentsOff')}</p>
      {:else}
        <CommentThread postId={item.post.id} on:message={(e) => dispatch('message', e.detail)} />
      {/if}
    {/if}
  </article>
</Panel>
