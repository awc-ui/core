<!-- The tree comes from the kit, not from a walk written here: `commentTree()`
     returns nodes with their children attached, which puts the boundary of a
     reply-run in the DATA — and that boundary is where the collapse goes. -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { commentTree } from '@awc-ui/showcase-kit/community';
  import ThreadBranch from './ThreadBranch.svelte';
  import { t } from '$lib/showcase';

  export let postId: string;
  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();

  let added: string[] = [];
  let draft = '';

  $: roots = commentTree(postId);

  /* `mdInput`, whose detail IS the bare string — not the native `input` event.
     Svelte's `on:mdInput` attaches a real listener to the element, so a custom
     event reaches it; binding `on:input` would silently never fire. */
  function onInput(event: Event) {
    draft = String((event as CustomEvent<string>).detail ?? '');
  }

  function post() {
    if (draft.trim() === '') return;
    added = [...added, draft.trim()];
    draft = '';
    dispatch('message', { key: 'community.msg.commentPosted' });
  }
</script>

<div class="thread">
  {#if roots.length === 0 && added.length === 0}
    <div class="empty">
      <p>{$t('community.empty.comments')}</p>
      <p>{$t('community.empty.commentsHint')}</p>
    </div>
  {:else}
    {#each roots as node (node.comment.id)}
      <ThreadBranch {node} />
    {/each}
  {/if}

  {#each added as body, index (index)}
    <div class="comment" data-mine="">
      <div>
        <div class="comment__bubble">
          <span class="comment__author">{$t('community.common.you')}</span>
          <p class="comment__body">{body}</p>
        </div>
      </div>
    </div>
  {/each}

  <div class="comment-compose">
    <!-- OUTLINED and `auto-grow`: a filled field reserves 28px above the
         textarea for its label and 8px below, which on a one-row box puts the
         label near the bottom under a strip of nothing. -->
    <md-text-field
      variant="outlined"
      label={$t('community.action.comment')}
      value={draft}
      multiline="auto-grow"
      rows="1"
      full-width
      on:mdInput={onInput}
    ></md-text-field>
    <md-button
      variant="filled"
      icon="send"
      soft-disabled={draft.trim() === '' || undefined}
      on:mdClick={post}
    >
      {$t('community.action.post')}
    </md-button>
  </div>
</div>
