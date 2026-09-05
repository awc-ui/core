<!--
  The feed — the screen this app is judged on.

  THREE COLUMNS ON A WIDE SCREEN, which is this vertical's signature layout and
  the thing Lyra has no equivalent of. `.columns` in app.css carries the
  measurements and the two breakpoints.

  IT PAGES BY REVEALING, NOT BY FETCHING. There is no infinite scroll: a scroll
  handler that appends on intersection is untestable in a parity check,
  unreachable from a keyboard, and would make the document height — which
  `verify-showcase-parity` compares across five builds — depend on how far the
  harness happened to scroll.
-->
<script setup lang="ts">
import { ref } from 'vue';
import { FEED_PAGE, feedItems, getViewer } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import FeedSkeleton from '~/components/skeletons/FeedSkeleton.vue';
import PostCard from './PostCard.vue';
import RightRail from './RightRail.vue';
import Composer from './Composer.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useT } from '~/composables/useShowcase';

const t = useT();
const { message, say, close } = useSnackbar();
const shown = ref(FEED_PAGE);

const viewer = getViewer();
const items = feedItems();
</script>

<template>
  <Screen
    :title="t('community.screen.feed.title')"
    :subtitle="t('community.screen.feed.subtitle')"
  >
    <template #skeleton><FeedSkeleton /></template>

    <div class="columns">
      <div class="columns__main">
        <Panel>
          <Composer :viewer="viewer" @message="say" />
        </Panel>

        <EmptyState
          v-if="items.length === 0"
          :message="t('community.empty.feed')"
          :hint="t('community.empty.feedHint')"
        />
        <PostCard
          v-for="item in items.slice(0, shown)"
          v-else
          :key="item.post.id"
          :item="item"
          @message="say"
        />

        <div v-if="shown < items.length" class="feed__more">
          <md-button variant="tonal" icon="expand_more" @click="shown = items.length">
            {{ t('community.action.viewAll') }}
          </md-button>
        </div>
        <div v-else class="feed__end">
          <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <p class="strong">{{ t('community.common.caughtUp') }}</p>
          <p class="muted">{{ t('community.common.caughtUpHint') }}</p>
        </div>
      </div>

      <aside class="columns__rail" :aria-label="t('community.panel.contacts')">
        <RightRail />
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
