<!--
  Somebody else's profile.

  THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN rather than a read-only copy
  of it: both URLs resolve, and answering with a page that offered to befriend
  yourself is the state `friendAction.self` exists to prevent.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import EmptyState from '~/components/EmptyState.vue';
import ProfileSkeleton from '~/components/skeletons/ProfileSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import FriendButton from '~/components/bits/FriendButton.vue';
import ProfileHeader from './ProfileHeader.vue';
import AboutPanel from './AboutPanel.vue';
import PhotoPanel from './PhotoPanel.vue';
import Timeline from './Timeline.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import ProfileScreen from './ProfileScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ handle: string }>();
const t = useT();
const { friendshipFor, setFriendship } = useEngagement();
const { message, say, close } = useSnackbar();

const person = computed(() => getPersonByHandle(props.handle));
const isSelf = computed(() => person.value?.id === getViewer().id);
const summary = computed(() => (person.value ? profileSummary(person.value.id) : null));
</script>

<template>
  <NotFoundScreen v-if="!person" />
  <ProfileScreen v-else-if="isSelf" />
  <Screen
    v-else-if="summary"
    :title="person.displayName"
    :subtitle="t('community.screen.person.subtitle')"
    :crumb-label="person.displayName"
  >
    <template #skeleton><ProfileSkeleton /></template>
    <template #aside><Count :value="summary.posts.length" /></template>

    <div class="columns">
      <div class="columns__main">
        <ProfileHeader :summary="summary">
          <template #action>
            <FriendButton
              :person="person"
              :state="friendshipFor(person)"
              size="md"
              @act="
                (next) => {
                  const was = friendshipFor(person!);
                  setFriendship(person!, next);
                  say(
                    next === 'outgoing'
                      ? 'community.msg.friendRequested'
                      : next === 'friend'
                        ? 'community.msg.friendAccepted'
                        : was === 'friend'
                          ? 'community.msg.friendRemoved'
                          : 'community.msg.requestCancelled',
                    { name: person!.displayName },
                  );
                }
              "
            />
          </template>
        </ProfileHeader>
        <EmptyState v-if="summary.posts.length === 0" :message="t('community.empty.posts')" />
        <Timeline v-else :posts="summary.posts" @message="say" />
      </div>
      <aside class="columns__rail">
        <AboutPanel :summary="summary" />
        <PhotoPanel :summary="summary" />
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
