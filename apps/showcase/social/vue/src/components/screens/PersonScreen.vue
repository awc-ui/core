<!--
  Somebody else's profile. The second of the two drills.

  THE SAME HEADER AND GRID AS YOUR OWN, plus a follow button and minus the saved
  and tagged tabs — which are yours, not theirs, and would be either empty or a
  privacy claim this app is not making.

  ADDRESSED BY HANDLE, which is what makes this screen's URL something a reader
  could actually type.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import { useEngagement } from '~/composables/useEngagement';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import FollowButton from '~/components/bits/FollowButton.vue';
import ProfileHeader from './ProfileHeader.vue';
import PostGrid from './PostGrid.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import ProfileScreen from './ProfileScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';

const props = defineProps<{ handle: string }>();
const t = useT();
const { isFollowing, setFollowing } = useEngagement();
const { message, say, close } = useSnackbar();

const person = computed(() => getPersonByHandle(props.handle));
/*
 * THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN, rather than a read-only
 * copy of it. Both URLs resolve — `/people/mara.ilves/` is a reasonable thing
 * to be linked — and answering with a page offering to follow yourself would be
 * the state `followAction.self` exists to prevent.
 */
const isSelf = computed(() => person.value?.id === getViewer().id);
const summary = computed(() => (person.value ? profileSummary(person.value.id) : null));

function toggle(next: boolean) {
  if (!person.value) return;
  setFollowing(person.value, next);
  say(next ? 'social.msg.followed' : 'social.msg.unfollowed', { name: person.value.displayName });
}
</script>

<template>
  <NotFoundScreen v-if="!person" />
  <ProfileScreen v-else-if="isSelf" />
  <Screen
    v-else-if="summary"
    :title="person.displayName"
    :subtitle="t('social.screen.person.subtitle')"
    :crumb-label="person.displayName"
  >
    <template #aside><Count :value="summary.posts.length" exact /></template>
    <template #skeleton><PanelSkeleton height="680px" :lines="4" /></template>

    <ProfileHeader :summary="summary">
      <template #action>
        <FollowButton
          :person="person"
          :following="isFollowing(person)"
          size="md"
          @toggle="toggle"
        />
      </template>
    </ProfileHeader>

    <Panel :title="t('social.panel.posts')">
      <template #actions><Count :value="summary.posts.length" exact /></template>
      <PostGrid :posts="summary.posts">
        <template #empty><EmptyState :message="t('social.empty.posts')" /></template>
      </PostGrid>
    </Panel>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
