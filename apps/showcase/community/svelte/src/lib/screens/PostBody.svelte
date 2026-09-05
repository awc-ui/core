<!--
  The body, clamped to four lines with a "see more".

  `LONG_BODY` only decides whether to RENDER the control — the clamp itself is
  CSS. It is deliberately generous: a button on a post that turns out not to be
  clipped is a small oddity; one missing from a post that IS clipped hides the
  end of somebody's writing.
-->
<script lang="ts">
  import type { Post } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';

  const LONG_BODY = 180;

  export let post: Post;
  let expanded = false;

  $: text = $t(post.bodyKey);
  $: long = text.length > LONG_BODY;
</script>

<!-- `data-clamped` and not a class: the clamp is a STATE of this paragraph. -->
<p class="post-card__body" data-clamped={long && !expanded ? '' : undefined}>{text}</p>
{#if long}
  <button type="button" class="post-card__more" on:click={() => (expanded = !expanded)}>
    {$t(expanded ? 'community.action.seeLess' : 'community.action.seeMore')}
  </button>
{/if}
