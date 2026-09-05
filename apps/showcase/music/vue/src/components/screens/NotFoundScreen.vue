<!--
  ONE COMPONENT, USED FIVE TIMES: the router renders it for a path that matches
  nothing, and each of the four drill screens renders it when the id in its own
  URL does not resolve. Written per screen, four of the five ended up a bare
  message with NO WAY BACK — a dead end with no control is worse than a 404.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import { useRouter } from '~/lib/router';
import { route } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/screens/EmptyState.vue';

const t = useT();
const { push } = useRouter();
</script>

<template>
  <Screen :title="t('music.screen.notFound.title')" :subtitle="t('music.screen.notFound.subtitle')">
    <EmptyState :message="t('music.screen.notFound.subtitle')" />
    <div class="row">
      <md-button class="notfound__home" variant="filled" icon="home" @click="push(route.home())">
        {{ t('music.nav.home') }}
      </md-button>
    </div>
  </Screen>
</template>
