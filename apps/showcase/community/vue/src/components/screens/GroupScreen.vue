<!--
  One group.

  A PRIVATE GROUP THE VIEWER IS NOT IN SHOWS ITS ABOUT AND NOTHING ELSE, which
  is the whole reason `GroupPrivacy` exists as data rather than as a chip. The
  posts are withheld and the screen SAYS they are withheld — an empty feed with
  no explanation reads as a dead group.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getGroupBySlug, groupSummary, joinAction } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import EmptyState from '~/components/EmptyState.vue';
import CoverSkeleton from '~/components/skeletons/CoverSkeleton.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import Media from '~/components/bits/Media.vue';
import PrivacyChip from '~/components/bits/PrivacyChip.vue';
import RoleChip from '~/components/bits/RoleChip.vue';
import EventRailRow from './EventRailRow.vue';
import Timeline from './Timeline.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { route } from '~/lib/routes';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ slug: string }>();
const t = useT();
const { roleFor, setRole } = useEngagement();
const { message, say, close } = useSnackbar();

const found = computed(() => getGroupBySlug(props.slug));
const summary = computed(() => (found.value ? groupSummary(found.value.id) : null));
const role = computed(() => (found.value ? roleFor(found.value) : 'none'));
const action = computed(() => joinAction[role.value]);
const member = computed(() => ['admin', 'moderator', 'member'].includes(role.value));
const hidden = computed(() => summary.value?.group.privacy === 'private' && !member.value);

function press() {
  if (!found.value) return;
  const was = role.value;
  const next =
    was === 'none' ? (found.value.privacy === 'private' ? 'pending' : 'member') : 'none';
  setRole(found.value, next);
  say(
    next === 'member'
      ? 'community.msg.joined'
      : next === 'pending'
        ? 'community.msg.requested'
        : was === 'pending'
          ? 'community.msg.requestCancelled'
          : 'community.msg.left',
    { name: found.value.name },
  );
}
</script>

<template>
  <NotFoundScreen v-if="!summary" />
  <Screen
    v-else
    :title="summary.group.name"
    :subtitle="t('community.screen.group.subtitle')"
    :crumb-label="summary.group.name"
  >
    <template #skeleton><CoverSkeleton timeline /></template>
    <template #aside><Count :value="summary.group.memberCount" compact /></template>

    <div class="columns">
      <div class="columns__main">
        <Panel>
          <Media :media="summary.group.cover" class-name="event-cover" eager />
          <h2 class="profile-head__name">{{ summary.group.name }}</h2>
          <div class="row">
            <PrivacyChip :group="summary.group" />
            <RoleChip :role="role" />
            <span class="person-row__meta">
              <Count :value="summary.group.memberCount" compact />
              {{ t('community.count.members').toLocaleLowerCase(t.locale) }}
            </span>
            <md-button v-if="action" :variant="action.variant" :icon="action.icon" @click="press">
              {{ t(action.labelKey) }}
            </md-button>
          </div>
          <p>{{ t(summary.group.descriptionKey) }}</p>
          <p v-if="summary.group.joinedAt" class="person-row__meta">
            {{ t('community.hint.joinedGroup', { date: '' })
            }}<DateText :at="summary.group.joinedAt" format="long" />
          </p>
        </Panel>

        <EmptyState v-if="hidden" :message="t('community.hint.privateGroup')" />
        <EmptyState
          v-else-if="summary.posts.length === 0"
          :message="t('community.empty.posts')"
        />
        <Timeline v-else :posts="summary.posts" @message="say" />
      </div>

      <aside class="columns__rail">
        <Panel v-if="summary.events.length > 0" :title="t('community.panel.groupEvents')">
          <template #actions><Count :value="summary.events.length" /></template>
          <!-- The RAIL variant: a 300px column cannot hold the list row's three
               tracks, and a rail states what is coming up rather than offering
               to answer it. -->
          <div class="rail-block">
            <EventRailRow v-for="event in summary.events" :key="event.id" :event="event" />
          </div>
        </Panel>

        <Panel :title="t('community.panel.members')">
          <template #actions><Count :value="summary.contributors.length" /></template>
          <EmptyState
            v-if="summary.contributors.length === 0"
            :message="t('community.empty.members')"
          />
          <div v-else class="rail-block">
            <Drill
              v-for="person in summary.contributors"
              :key="person.id"
              link-class="rail-row"
              :to="route.person(person.handle)"
            >
              <Avatar :person="person" size="small" />
              <span class="rail-row__text">
                <span class="rail-row__name">{{ person.displayName }}</span>
              </span>
            </Drill>
          </div>
        </Panel>
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
