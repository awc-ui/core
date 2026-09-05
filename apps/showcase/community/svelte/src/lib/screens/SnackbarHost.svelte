<!--
  The one snackbar.

  FOUR SCREENS RAISE ONE, so the wiring is written once. Each holds its own
  instance — a snackbar is `position: fixed` and paints over the viewport, so
  two mounted at once are two overlays fighting for the same corner.

  THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A screen that
  built "Following Ada Lindqvist" itself would have composed a sentence in
  English word order and handed it to the Arabic build intact.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/showcase';
  import type { SnackbarMessage } from './snackbar';

  export let message: SnackbarMessage | null;

  const dispatch = createEventDispatcher<{ close: void }>();
  $: text = message ? $t(message.key, message.params) : '';
</script>

<!-- The component closes itself on the timeout and on the dismiss button; this
     listens so the screen's own state follows, or the next identical message
     would set `open` to a value it already has and never re-open. -->
<md-snackbar
  on:mdClose={() => dispatch('close')}
  class="app-snackbar"
  position="bottom"
  closeable
  auto-hide
  open={message !== null || undefined}
  message={text}
  dismiss-label={$t('community.action.close')}
></md-snackbar>
