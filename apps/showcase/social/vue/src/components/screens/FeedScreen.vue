<!--
  The feed — the screen this app is judged on.

  POSTS FROM PEOPLE YOU FOLLOW, NEWEST FIRST, and the selection rule is the
  kit's `getFeed()` rather than this screen's: someone who follows YOU does not
  thereby appear here, and that asymmetry is the whole reason `Relationship` has
  four values instead of a boolean.

  ONE COLUMN, CAPPED. A feed is a column of pictures read at one width; letting
  it stretch across a 1600px monitor makes every photograph a letterbox.

  IT PAGES BY REVEALING, NOT BY FETCHING. There is no infinite scroll: a scroll
  handler that appends on intersection is untestable in a parity check,
  unreachable from a keyboard, and would make the document height — which
  `verify-showcase-parity` compares across builds — depend on how far the
  harness happened to scroll.
-->
<script setup lang="ts">
import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/social';
import { computed, ref } from 'vue';
import { FEED_PAGE, feedItems, storyRail, suggestedPeople } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import { useEngagement } from '~/composables/useEngagement';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Drill from '~/components/Drill.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import FollowButton from '~/components/bits/FollowButton.vue';
import PostCard from './PostCard.vue';
import StoryRail from './StoryRail.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';

const t = useT();
const { isFollowing, setFollowing, isSaved } = useEngagement();
const { message, say, close } = useSnackbar();

const shown = ref(FEED_PAGE);
const search = ref('');
const filter = ref<DiscoveryFilter>('all');
const copy = computed(() => discoveryCopy(t.value.locale));
const allItems = feedItems();
const items = computed(() =>
  discoverFeed(allItems, search.value, filter.value, t.value, (item) => isSaved(item.post)),
);
function onSearch(event: CustomEvent<string>) {
  search.value = event.detail ?? '';
  shown.value = FEED_PAGE;
}
function setFilter(value: DiscoveryFilter) {
  filter.value = value;
  shown.value = FEED_PAGE;
}
const rail = storyRail();
const suggestions = suggestedPeople(5);
const visible = computed(() => items.value.slice(0, shown.value));

const moreListeners = {
  mdClick: () => {
    shown.value = items.value.length;
  },
};

function follow(person: (typeof suggestions)[number], next: boolean) {
  setFollowing(person, next);
  say(next ? 'social.msg.followed' : 'social.msg.unfollowed', { name: person.displayName });
}
</script>

<template>
  <Screen :title="t('social.screen.feed.title')" :subtitle="t('social.screen.feed.subtitle')">
    <template #skeleton><PanelSkeleton height="640px" :lines="6" /></template>

    <section class="discovery-hero" :aria-label="copy.eyebrow">
      <div>
        <span class="discovery-hero__eyebrow">{{ copy.eyebrow }}</span>
        <h2>{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
      </div>
      <div class="discovery-hero__stat">
        <span class="material-symbols-outlined" aria-hidden="true">camera</span
        ><strong class="discovery-hero__number">{{ t.formatNumber(allItems.length) }}</strong
        ><span class="discovery-hero__caption">{{ copy.stat }}</span>
      </div>
    </section>

    <StoryRail :rings="rail" />

    <div class="feed-layout">
      <div class="feed">
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
              :variant="filter === 'saved' ? 'tonal' : 'text'"
              size="sm"
              icon="bookmark"
              :aria-pressed="filter === 'saved'"
              @click="setFilter('saved')"
              >{{ copy.second }}</md-button
            >
            <md-button
              :variant="filter === 'carousel' ? 'tonal' : 'text'"
              size="sm"
              icon="view_carousel"
              :aria-pressed="filter === 'carousel'"
              @click="setFilter('carousel')"
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
        <EmptyState v-if="visible.length === 0" :message="copy.empty" :hint="copy.hint" />
        <!-- Only the first decodes eagerly. Everything below the fold is lazy,
             which is what keeps forty images off the first paint. -->
        <PostCard
          v-for="(item, index) in visible"
          :key="item.post.id"
          :item="item"
          :eager="index === 0"
          @message="say"
        />

        <div v-if="shown < items.length" class="feed__more">
          <md-button v-awc="{ on: moreListeners }" variant="tonal" icon="expand_more">
            {{ t('social.action.viewAll') }}
          </md-button>
        </div>
        <div v-else class="feed__end" :hidden="items.length === 0">
          <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <p class="strong">{{ t('social.common.caughtUp') }}</p>
          <p class="muted">{{ t('social.common.caughtUpHint') }}</p>
        </div>
      </div>

      <!-- ASIDE CONTENT, AND IT SAYS SO. `app.css` moves it below the column on
           a phone rather than above it: a reader who opened the app came for
           the posts. -->
      <aside class="feed-aside">
        <Panel :title="t('social.panel.suggested')">
          <template #actions><Count :value="suggestions.length" /></template>
          <!-- PLAIN ROWS, NOT `md-list-item`. Four text slots and a trailing
               action do not fit in a 340px aside: the handle rendered as a
               truncated small-caps overline and "Follows you" wrapped to three
               lines beside the button. -->
          <div class="stack">
            <div v-for="person in suggestions" :key="person.id" class="suggest-row">
              <Avatar :person="person" size="small" />
              <span class="suggest-row__text">
                <Drill link-class="suggest-row__name" :to="route.person(person.handle)">
                  {{ person.displayName }}
                </Drill>
                <span class="suggest-row__meta">{{ t(person.relationshipKey) }}</span>
              </span>
              <FollowButton
                :person="person"
                :following="isFollowing(person)"
                @toggle="(next) => follow(person, next)"
              />
            </div>
          </div>
        </Panel>
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
