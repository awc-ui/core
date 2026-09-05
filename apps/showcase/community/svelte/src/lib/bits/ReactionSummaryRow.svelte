<!-- IT RENDERS NOTHING AT ZERO rather than "0 reactions". A post nobody has
     reacted to should look like one, not like a counter stuck at zero. -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { reactionIcon, type ReactionSummary } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';

  export let summary: ReactionSummary;
  export let commentCount: number;
  export let shareCount: number;
  const dispatch = createEventDispatcher<{ openComments: void }>();
</script>

{#if summary.total > 0 || commentCount > 0 || shareCount > 0}
  <div class="reactions">
    {#if summary.total > 0}
      <span class="reactions__glyphs" aria-hidden="true">
        {#each summary.top as kind (kind)}
          <span class="reactions__glyph">
            <span class="material-symbols-outlined">{reactionIcon[kind]}</span>
          </span>
        {/each}
      </span>
      <!-- The number is announced with its unit; the glyphs are decoration and
           are hidden from the accessibility tree. -->
      <span class="reactions__count"
        >{$t('community.reaction.summary', { count: $t.formatNumber(summary.total) })}</span
      >
    {/if}
    <span class="reactions__spacer" />
    {#if commentCount > 0}
      <button
        type="button"
        class="reactions__count comment__act"
        on:click={() => dispatch('openComments')}
      >
        {$t('community.action.viewComments', { count: $t.formatNumber(commentCount) })}
      </button>
    {/if}
    {#if shareCount > 0}
      <span class="reactions__count">
        {$t.formatNumber(shareCount)}
        {$t('community.count.shares').toLocaleLowerCase($t.locale)}
      </span>
    {/if}
  </div>
{/if}
