<!--
  The screen for a post or a person that does not exist.

  IT IS A REAL SCREEN, not a redirect to the feed. A reader who followed a stale
  link needs to be told the thing is gone; silently landing them on the feed
  makes it look as though the link worked and the app forgot where they were
  going.
-->
<script lang="ts">
  import { navigate } from '$lib/router';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<Screen
  title={$t('social.screen.notFound.title')}
  subtitle={$t('social.screen.notFound.subtitle')}
>
  <EmptyState message={$t('social.screen.notFound.subtitle')} />
  <!-- A BUTTON, not a bare link. There is no trail on this screen — the path
       matched nothing, so there is no parent to name — and a lone underlined
       hyperlink under an empty state reads as a stray. -->
  <div class="row">
    <md-button on:mdClick={() => navigate(route.feed())} variant="tonal" icon="arrow_back">
      {$t('social.nav.feed')}
    </md-button>
  </div>
</Screen>
