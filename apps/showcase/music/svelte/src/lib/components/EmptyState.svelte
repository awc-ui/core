<!--
  The shared empty state.

  `hint` IS A STRING, not the boolean the three consoles use. Theirs share one
  generic second line ("try widening the filters"), which works because their
  empty states are all filter results. These are not — an empty queue, an empty
  history and an empty liked list each want a different sentence — so the caller
  passes the one that fits and omits it where the message is the whole story.

  THE GLYPH AND THE CLASSES MATCH THE OTHER FOUR BUILDS EXACTLY. This was a bare
  `<p>` copied from Corvus, and the parity check caught it: React renders a
  `music_off` ligature and the missing nine characters of text showed up on
  every screen with an empty panel on it.
-->
<script lang="ts">
  export let message: string;
  export let hint: string | undefined = undefined;
</script>

<div class="empty">
  <span class="material-symbols-outlined empty__icon" aria-hidden="true">music_off</span>
  <p class="empty__message">{message}</p>
  {#if hint}<p class="empty__hint">{hint}</p>{/if}
</div>
