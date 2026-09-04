<!--
  The row under a post: like, comment, share, save.

  THE HEART IS THE ONLY COLOURED CONTROL, and only when it is on. Four coloured
  icons is four things shouting; one is a state.

  Every button carries a real accessible name saying what pressing it will DO —
  "Like" when off, "Unlike" when on — rather than naming the icon. The counts
  are beside them as text, not inside the names, because a screen reader
  reading "Like, 1,240" on every post in a feed is noise.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/showcase';

  export let liked: boolean;
  export let saved: boolean;

  const dispatch = createEventDispatcher<{ like: void; save: void; comment: void; share: void }>();
</script>

<div class="post-actions">
  <md-icon-button
    on:mdClick={() => dispatch('like')}
    class="post-actions__like"
    icon={liked ? 'favorite' : 'favorite_border'}
    color={liked ? 'error' : undefined}
    data-on={liked ? '' : undefined}
    aria-label={$t(liked ? 'social.action.unlike' : 'social.action.like')}
  ></md-icon-button>
  <md-icon-button
    on:mdClick={() => dispatch('comment')}
    icon="mode_comment"
    aria-label={$t('social.action.comment')}
  ></md-icon-button>
  <md-icon-button
    on:mdClick={() => dispatch('share')}
    icon="send"
    aria-label={$t('social.action.share')}
  ></md-icon-button>
  <span class="post-actions__spacer"></span>
  <md-icon-button
    on:mdClick={() => dispatch('save')}
    icon={saved ? 'bookmark' : 'bookmark_border'}
    data-on={saved ? '' : undefined}
    aria-label={$t(saved ? 'social.action.unsave' : 'social.action.save')}
  ></md-icon-button>
</div>
