<!-- A REAL SCREEN, not a redirect to the feed. A reader who followed a stale
     link needs to be told the thing is gone; landing them on the feed makes it
     look as though the link worked. -->
<script setup lang="ts">
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/EmptyState.vue';
import { route } from '~/lib/routes';
import { useRouter } from '~/lib/router';
import { useT } from '~/composables/useShowcase';

const t = useT();
const router = useRouter();
</script>

<template>
  <Screen
    :title="t('community.screen.notFound.title')"
    :subtitle="t('community.screen.notFound.subtitle')"
  >
    <EmptyState :message="t('community.screen.notFound.subtitle')" />
    <div class="row">
      <md-button variant="tonal" icon="arrow_back" @click="router.push(route.feed())">
        {{ t('community.nav.feed') }}
      </md-button>
    </div>
  </Screen>
</template>
