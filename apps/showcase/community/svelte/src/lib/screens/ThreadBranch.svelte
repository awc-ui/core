<!--
  One comment and its replies, with the collapse control between them.

  The control counts the WHOLE subtree, not the direct children: "3 more
  replies" that reveals three rows and then two more nested under them has
  undercounted.

  ONE TOGGLE AT A TIME. `hiddenCount` is a property of the DATA and does not
  change when the reader expands, so keying both buttons off it independently
  showed "View 1 more reply" directly above "Hide replies".
-->
<script lang="ts">
  import {
    REPLY_PAGE,
    reactionSummary,
    subtreeSize,
    type ThreadNode,
  } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import When from '$lib/bits/When.svelte';
  import ThreadBranch from './ThreadBranch.svelte';
  import { commentReactionFor, commentReactions, setCommentReaction } from '$lib/engagement';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let node: ThreadNode;
  let expanded = false;

  $: mine = commentReactionFor($commentReactions, node.comment);
  $: summary = reactionSummary(node.comment.reactions, node.comment.viewerReaction, mine);
  $: shown = expanded ? node.children : node.children.slice(0, REPLY_PAGE);
  $: hiddenCount = node.children
    .slice(REPLY_PAGE)
    .reduce((total, child) => total + 1 + subtreeSize(child), 0);
  $: self =
    node.author.friendship === 'self' ? route.profile() : route.person(node.author.handle);
</script>

<div class="thread__branch">
  <div class="comment" data-comment={node.comment.id} data-depth={String(node.comment.depth)}>
    <Drill linkClass="comment__avatar" href={self}>
      <Avatar person={node.author} size="small" />
    </Drill>

    <div>
      <div class="comment__bubble">
        <!-- "Replying to X" AT DEPTH 2 ONLY: at depth 1 the indent is
             unambiguous, at depth 2 siblings may sit between. -->
        {#if node.comment.depth === 2 && node.replyingTo}
          <span class="comment__replying"
            >{$t('community.hint.replyingTo', { name: node.replyingTo.displayName })}</span
          >
        {/if}
        <Drill linkClass="comment__author" href={self}>{node.author.displayName}</Drill>
        <p class="comment__body">{$t(node.comment.bodyKey)}</p>
      </div>

      <div class="comment__foot">
        <When at={node.comment.postedAt} />
        <button
          type="button"
          class="comment__act"
          data-on={mine ? '' : undefined}
          aria-pressed={mine !== null}
          on:click={() => setCommentReaction(node.comment, mine ? null : 'like')}
        >
          {$t('community.reaction.like')}
        </button>
        {#if summary.total > 0}
          <span class="comment__likes">
            <span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
            <Count value={summary.total} />
            <span class="visually-hidden">{$t('community.count.reactions')}</span>
          </span>
        {/if}
      </div>
    </div>
  </div>

  {#if node.children.length > 0}
    <div class="thread__children">
      {#each shown as child (child.comment.id)}
        <ThreadBranch node={child} />
      {/each}
      {#if expanded}
        <button type="button" class="thread__toggle" on:click={() => (expanded = false)}>
          {$t('community.action.hideReplies')}
        </button>
      {:else if hiddenCount > 0}
        <button type="button" class="thread__toggle" on:click={() => (expanded = true)}>
          {hiddenCount === 1
            ? $t('community.action.viewRepliesOne')
            : $t('community.action.viewReplies', { count: $t.formatNumber(hiddenCount) })}
        </button>
      {/if}
    </div>
  {/if}
</div>
