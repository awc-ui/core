<!--
  Nothing is served at this address.

  Reachable in a client-routed app in a way it is not in a static export: any
  path under the mount lands here rather than 404ing at the host, so it has to
  offer a way back rather than being a dead end. The rail and the bar are still
  rendered by `AppFrame`, so every destination is one click away — the button
  is for the reader who is looking for one.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import { route, withBase } from '~/lib/routes';
import EmptyState from '~/components/EmptyState.vue';
import Screen from '~/components/Screen.vue';

const t = useT();
</script>

<template>
  <Screen
    :title="t('wealth.screen.notFound.title')"
    :subtitle="t('wealth.screen.notFound.subtitle')"
  >
    <template #aside>
      <!-- `href` on the component, never a component inside an `<a>`. -->
      <md-button variant="tonal" size="sm" icon="dashboard" :href="withBase(route.overview())">
        {{ t('wealth.nav.overview') }}
      </md-button>
    </template>
    <EmptyState :message="t('wealth.empty.generic')" />
  </Screen>
</template>
