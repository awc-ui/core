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
const { isFollowing, setFollowing } = useEngagement();
const { message, say, close } = useSnackbar();

const shown = ref(FEED_PAGE);
const items = feedItems();
const rail = storyRail();
const suggestions = suggestedPeople(5);
const visible = computed(() => items.slice(0, shown.value));

const moreListeners = { mdClick: () => { shown.value = items.length; } };

function follow(person: (typeof suggestions)[number], next: boolean) {
  setFollowing(person, next);
  say(next ? 'social.msg.followed' : 'social.msg.unfollowed', { name: person.displayName });
}
</script>

<template>
  <Screen :title="t('social.screen.feed.title')" :subtitle="t('social.screen.feed.subtitle')">
    <template #skeleton><PanelSkeleton height="640px" :lines="6" /></template>

    <StoryRail :rings="rail" />

    <div class="feed-layout">
      <div class="feed">
        <EmptyState
          v-if="visible.length === 0"
          :message="t('social.empty.feed')"
          :hint="t('social.empty.feedHint')"
        />
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
        <div v-else class="feed__end">
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
