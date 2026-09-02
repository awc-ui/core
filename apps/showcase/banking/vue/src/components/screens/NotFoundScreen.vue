<!--
  Nothing is served at this address.

  Reachable in a client-routed app in a way it is not in a static export: any
  path under the mount lands here rather than 404ing at the host, so it offers
  a way back rather than being a dead end.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/EmptyState.vue';

const t = useT();
</script>

<template>
  <Screen :title="t('banking.screen.notFound.title')" :subtitle="t('banking.screen.notFound.body')">
    <template #aside>
      <!-- `href` on the component, never a component inside an `<a>` (§7.3). -->
      <md-button
        variant="tonal"
        size="sm"
        icon="account_balance_wallet"
        :href="withBase(route.home())"
      >
        {{ t('banking.nav.home') }}
      </md-button>
    </template>
    <EmptyState :message="t('banking.screen.notFound.body')" />
  </Screen>
</template>
