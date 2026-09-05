<!--
  The shared empty state.

  `hint` IS A STRING HERE, not the boolean the other verticals use. Theirs share
  one generic second line ("try widening the filters"), which works because
  their empty states are all filter results. These are not: an empty feed wants
  "follow a few more people", an empty saved tab wants "save a post and it will
  be here", and an empty comment thread wants "be the first to say something".
  One shared sentence would be wrong for two of the three, so the caller passes
  the one that fits and omits it where the message is the whole story.
-->
<script lang="ts">
  export let message: string;
  export let hint: string | undefined = undefined;
</script>

<div class="empty">
  <p>{message}</p>
  {#if hint}<p>{hint}</p>{/if}
</div>
