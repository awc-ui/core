<!-- Your own profile. NO FRIENDSHIP BUTTON — `friendAction.self` is null, and a
     screen that had to render "add yourself as a friend" has gone wrong
     somewhere upstream. -->
<script setup lang="ts">
import { getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/EmptyState.vue';
import ProfileSkeleton from '~/components/skeletons/ProfileSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import ProfileHeader from './ProfileHeader.vue';
import AboutPanel from './AboutPanel.vue';
import PhotoPanel from './PhotoPanel.vue';
import Timeline from './Timeline.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useT } from '~/composables/useShowcase';

const t = useT();
const { message, say, close } = useSnackbar();
const summary = profileSummary(getViewer().id);
</script>

<template>
  <Screen
    :title="t('community.screen.profile.title')"
    :subtitle="t('community.screen.profile.subtitle')"
  >
    <template #skeleton><ProfileSkeleton /></template>
    <template #aside><Count :value="summary.posts.length" /></template>

    <div class="columns">
      <div class="columns__main">
        <ProfileHeader :summary="summary" />
        <Timeline :posts="summary.posts" @message="say" />
      </div>
      <aside class="columns__rail">
        <AboutPanel :summary="summary" />
        <PhotoPanel :summary="summary" />
      </aside>
    </div>

    <EmptyState v-if="summary.posts.length === 0" :message="t('community.empty.posts')" />
    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
