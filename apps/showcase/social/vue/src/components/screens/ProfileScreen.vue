<!--
  Your own profile: posts, saved, tagged.

  THREE TABS, AND `md-tabs` IS THE RIGHT COMPONENT HERE — the one place in this
  app it is. The house rule is that destinations are a rail or a bar and never
  tabs; these are not destinations. They are three views of the SAME thing (the
  viewer's relationship to a set of posts), inside one screen, with one URL,
  which is exactly what `md-tabs` is specified for.

  SAVED IS THE ONLY TAB THAT MOVES. Its contents come from the engagement store
  rather than the fixture, so a post saved on the feed appears here without a
  reload — which is the point of holding that state above the router.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { getPosts, getViewer, profileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import { useEngagement } from '~/composables/useEngagement';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import ProfileHeader from './ProfileHeader.vue';
import PostGrid from './PostGrid.vue';

type Tab = 'posts' | 'saved' | 'tagged';

const t = useT();
const { savedIds } = useEngagement();
const tab = ref<Tab>('posts');

const viewer = getViewer();
const summary = profileSummary(viewer.id);
const all = getPosts();

const saved = computed(() => all.filter((post) => savedIds(all).has(post.id)));
/* Nothing in the fixture models "tagged in" — inventing a field for one tab
   would be data added to serve a layout. The tab exists because a profile has
   one, and its empty state is the honest answer. */
const tagged = computed<typeof all>(() => []);

const shown = computed(() =>
  tab.value === 'posts' ? summary.posts : tab.value === 'saved' ? saved.value : tagged.value,
);

const tabListeners = {
  mdTabChange: (event: CustomEvent<{ value?: string }>) => {
    tab.value = (event.detail?.value ?? 'posts') as Tab;
  },
};
</script>

<template>
  <Screen :title="t('social.screen.profile.title')" :subtitle="t('social.screen.profile.subtitle')">
    <template #aside><Count :value="summary.posts.length" exact /></template>
    <template #skeleton><PanelSkeleton height="680px" :lines="4" /></template>

    <ProfileHeader :summary="summary" />

    <Panel>
      <md-tabs v-awc="{ on: tabListeners }" variant="primary">
        <md-tab value="posts" :label="t('social.panel.posts')" icon="grid_on"></md-tab>
        <md-tab value="saved" :label="t('social.panel.saved')" icon="bookmark"></md-tab>
        <md-tab value="tagged" :label="t('social.panel.tagged.short')" icon="sell"></md-tab>
      </md-tabs>

      <PostGrid :posts="shown">
        <template #empty>
          <EmptyState
            v-if="tab === 'saved'"
            :message="t('social.empty.saved')"
            :hint="t('social.empty.savedHint')"
          />
          <EmptyState v-else-if="tab === 'tagged'" :message="t('social.empty.tagged')" />
          <EmptyState v-else :message="t('social.empty.posts')" />
        </template>
      </PostGrid>
    </Panel>
  </Screen>
</template>
