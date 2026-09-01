<!--
  Nothing is served at this address.

  Reachable in a client-routed app in a way it is not in a static export: any
  path under the mount lands here rather than 404ing at the host (where the
  host rewrites), so it has to offer a way back rather than being a dead end.
  The rail and the bar are still rendered by `AppFrame`, so every destination
  is one click away — the button is for the reader who is looking for one.
-->
<script lang="ts">
  import { route, withBase } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<!-- No crumbs, exactly as in the React build: the trail band stays reserved
     and empty — an address that resolves to nothing has no place in a trail. -->
<Screen
  title={$t('wealth.screen.notFound.title')}
  subtitle={$t('wealth.screen.notFound.subtitle')}
>
  <svelte:fragment slot="aside">
    <!-- `href` on the component, never a component inside an `<a>`. -->
    <md-button variant="tonal" size="sm" icon="dashboard" href={withBase(route.overview())}>
      {$t('wealth.nav.overview')}
    </md-button>
  </svelte:fragment>
  <EmptyState message={$t('wealth.empty.generic')} />
</Screen>
