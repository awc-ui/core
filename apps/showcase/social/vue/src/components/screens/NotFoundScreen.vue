<!--
  The screen for a post or a person that does not exist.

  IT IS A REAL SCREEN, not a redirect to the feed. A reader who followed a stale
  link needs to be told the thing is gone; silently landing them on the feed
  makes it look as though the link worked and the app forgot where they were
  going.
-->
<script setup lang="ts">
import { route } from '~/lib/routes';
import { useRouter } from '~/lib/router';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/EmptyState.vue';

const t = useT();
const router = useRouter();
const backListeners = { mdClick: () => router.push(route.feed()) };
</script>

<template>
  <Screen
    :title="t('social.screen.notFound.title')"
    :subtitle="t('social.screen.notFound.subtitle')"
  >
    <EmptyState :message="t('social.screen.notFound.subtitle')" />
    <!-- A BUTTON, not a bare link. There is no trail on this screen — the path
         matched nothing, so there is no parent to name — and a lone underlined
         hyperlink under an empty state reads as a stray. -->
    <div class="row">
      <md-button v-awc="{ on: backListeners }" variant="tonal" icon="arrow_back">
        {{ t('social.nav.feed') }}
      </md-button>
    </div>
  </Screen>
</template>
