<!--
  Nothing is served at this address.

  Reachable in a client-routed app in a way it is not in a static export: any
  path under the mount lands here rather than 404ing at the host, so it offers
  a way back rather than being a dead end.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  import { route, withBase } from '$lib/routes';
  import Screen from '$lib/components/Screen.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<Screen title={$t('banking.screen.notFound.title')} subtitle={$t('banking.screen.notFound.body')}>
  <svelte:fragment slot="aside">
    <!-- `href` on the component, never a component inside an `<a>` (§7.3). -->
    <md-button variant="tonal" size="sm" icon="account_balance_wallet" href={withBase(route.home())}>
      {$t('banking.nav.home')}
    </md-button>
  </svelte:fragment>

  <EmptyState message={$t('banking.screen.notFound.body')} />
</Screen>
