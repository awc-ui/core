<!-- A REAL SCREEN, not a redirect to the feed: landing a reader on the feed
     makes it look as though a stale link worked. -->
<script lang="ts">
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { navigate } from '$lib/router';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
</script>

<Screen
  title={$t('community.screen.notFound.title')}
  subtitle={$t('community.screen.notFound.subtitle')}
>
  <EmptyState message={$t('community.screen.notFound.subtitle')} />
  <div class="row">
    <md-button variant="tonal" icon="arrow_back" on:mdClick={() => navigate(route.feed())}>
      {$t('community.nav.feed')}
    </md-button>
  </div>
</Screen>
