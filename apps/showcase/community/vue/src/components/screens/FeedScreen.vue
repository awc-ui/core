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
import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/community';
import { computed, ref } from 'vue';
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
const search = ref('');
const filter = ref<DiscoveryFilter>('all');
const copy = computed(() => discoveryCopy(t.value.locale));
const allItems = feedItems();
const items = computed(() => discoverFeed(allItems, search.value, filter.value, t.value));
function onSearch(event: CustomEvent<string>) {
  search.value = event.detail ?? '';
  shown.value = FEED_PAGE;
}
function setFilter(value: DiscoveryFilter) {
  filter.value = value;
  shown.value = FEED_PAGE;
}
</script>

<template>
  <Screen :title="t('community.screen.feed.title')" :subtitle="t('community.screen.feed.subtitle')">
    <template #skeleton><FeedSkeleton /></template>

    <section class="discovery-hero" :aria-label="copy.eyebrow">
      <div>
        <span class="discovery-hero__eyebrow">{{ copy.eyebrow }}</span>
        <h2>{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
      </div>
      <div class="discovery-hero__stat">
        <span class="material-symbols-outlined" aria-hidden="true">diversity_3</span
        ><strong class="discovery-hero__number">{{ t.formatNumber(allItems.length) }}</strong
        ><span class="discovery-hero__caption">{{ copy.stat }}</span>
      </div>
    </section>

    <div class="columns">
      <div class="columns__main">
        <div class="discovery-tools">
          <md-text-field v-awc="{ on: { mdInput: onSearch } }" :label="copy.search" :value="search"
            ><span slot="leading-icon" class="material-symbols-outlined" aria-hidden="true"
              >search</span
            ></md-text-field
          >
          <div class="discovery-tools__filters" role="group" :aria-label="copy.eyebrow">
            <md-button
              :variant="filter === 'all' ? 'tonal' : 'text'"
              size="sm"
              icon="auto_awesome"
              :aria-pressed="filter === 'all'"
              @click="setFilter('all')"
              >{{ copy.all }}</md-button
            >
            <md-button
              :variant="filter === 'friends' ? 'tonal' : 'text'"
              size="sm"
              icon="people"
              :aria-pressed="filter === 'friends'"
              @click="setFilter('friends')"
              >{{ copy.second }}</md-button
            >
            <md-button
              :variant="filter === 'groups' ? 'tonal' : 'text'"
              size="sm"
              icon="groups"
              :aria-pressed="filter === 'groups'"
              @click="setFilter('groups')"
              >{{ copy.third }}</md-button
            >
          </div>
          <div class="discovery-tools__row">
            <p class="discovery-tools__count" role="status">
              {{ discoveryCount(items.length, t.locale) }}
            </p>
            <md-button
              class="discovery-tools__reset"
              size="sm"
              variant="text"
              icon="restart_alt"
              :disabled="!search && filter === 'all'"
              @click="
                search = '';
                setFilter('all');
              "
              >{{ copy.clear }}</md-button
            >
          </div>
        </div>
        <Panel>
          <Composer :viewer="viewer" @message="say" />
        </Panel>

        <EmptyState v-if="items.length === 0" :message="copy.empty" :hint="copy.hint" />
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
        <div v-else class="feed__end" :hidden="items.length === 0">
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
