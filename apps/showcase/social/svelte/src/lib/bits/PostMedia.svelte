<!--
  A post's pictures: one image, or a pager over several.

  THE PAGER IS BUTTONS AND DOTS, not a swipe handler. A swipe is not reachable
  from a keyboard and this app is measured for that; the buttons are real
  controls with real names, and the dots are a live region announcing which of
  how many.

  `href` PUTS THE ANCHOR AROUND THE IMAGE ONLY, and that is the whole reason it
  is a prop here rather than a wrapper at the call site. The feed card wrapped
  this component in a link, which put the two pager buttons inside an anchor —
  so paging to the next picture navigated to the post instead. A control inside
  a link is broken twice over: the click bubbles, and a keyboard press fires
  both.
-->
<script lang="ts">
  import { postKindIcon, type Post } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';
  import Drill from '$lib/components/Drill.svelte';
  import Media from './Media.svelte';

  export let post: Post;
  export let eager = false;
  export let href: string | undefined = undefined;

  let index = 0;
  /* Reset when the post changes: a pager left on picture 4 of a post that has
     since been replaced by one with two pictures is the bug this avoids. */
  $: if (post) index = 0;

  $: total = post.media.length;
  $: media = post.media[Math.min(index, total - 1)];
</script>

<div class="post-media">
  {#if href}
    <Drill {href} linkClass="post-media__link"><Media {media} {eager} /></Drill>
  {:else}
    <Media {media} {eager} />
  {/if}

  <!-- `on-media` carries the contrast pair: anything sitting on a photograph
       needs a colour that does not depend on the theme behind it. -->
  {#if post.kind === 'video' && media.durationSec !== null}
    <span class="post-media__duration on-media">
      <span class="material-symbols-outlined" aria-hidden="true">{postKindIcon.video}</span>
      {$t('social.hint.videoDuration', { seconds: $t.formatNumber(media.durationSec) })}
    </span>
  {/if}

  {#if total > 1}
    <md-icon-button
      on:mdClick={() => (index = Math.max(0, index - 1))}
      class="post-media__nav post-media__nav--prev"
      icon="chevron_left"
      aria-label={$t('social.action.previous')}
      soft-disabled={index === 0 || undefined}
    ></md-icon-button>
    <md-icon-button
      on:mdClick={() => (index = Math.min(total - 1, index + 1))}
      class="post-media__nav post-media__nav--next"
      icon="chevron_right"
      aria-label={$t('social.action.next')}
      soft-disabled={index === total - 1 || undefined}
    ></md-icon-button>
    <div class="post-media__dots" role="status">
      <span class="visually-hidden">
        {$t('social.postKind.carouselCount', { index: index + 1, total })}
      </span>
      {#each post.media as item, i (item.id)}
        <span class="post-media__dot" data-on={i === index ? '' : undefined}></span>
      {/each}
    </div>
  {/if}
</div>
