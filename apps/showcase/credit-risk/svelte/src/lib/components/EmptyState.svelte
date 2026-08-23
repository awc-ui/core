<!--
  The shared empty state.

  `hint` defaults to false because most empty states here are facts, not filter
  results: "this facility is unsecured" is the whole story, and telling the
  reader to widen the filters underneath it would be nonsense. Pass `hint` only
  where a filter or a search actually produced the emptiness.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let message: string;
  export let hint = false;
</script>

<div class="empty">
  <p>{message}</p>
  {#if hint}<p>{$t('empty.hint')}</p>{/if}
</div>
