<!--
  ONE COMPONENT, USED FIVE TIMES: the router renders it for a path matching
  nothing, and each drill screen renders it when the id in its own URL does not
  resolve. Written per screen, four of the five ended up a bare message with NO
  WAY BACK — a dead end with no control is worse than a 404.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  import { navigate } from '$lib/router';
  import { route } from '$lib/routes';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<Screen title={$t('music.screen.notFound.title')} subtitle={$t('music.screen.notFound.subtitle')}>
  <EmptyState message={$t('music.screen.notFound.subtitle')} />
  <div class="row">
    <md-button class="notfound__home" variant="filled" icon="home" on:click={() => navigate(route.home())}>
      {$t('music.nav.home')}
    </md-button>
  </div>
</Screen>
