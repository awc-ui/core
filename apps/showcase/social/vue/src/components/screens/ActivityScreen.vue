<!--
  Activity — what happened to you, newest first.

  GROUPED BY AGE, NOT PAGED. Four buckets from the kit, and empty ones are
  dropped rather than rendered as a heading over nothing. A notification list is
  read by recency and nothing else, so age is the only structure worth imposing.

  THE SENTENCE IS A TRANSLATED TEMPLATE, not a name concatenated with a verb.
  `{name} liked your post` is one dictionary entry per kind, so Arabic puts the
  verb where Arabic puts the verb — building it here from a name and a label
  would hard-code English word order into all three locales.

  READ AND UNREAD ARE BOTH IN THE LIST. Marking everything read is one button
  and it changes the badge in the rail; filtering the read ones out would make
  the button look like it deleted them.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { activityGroups, getTotals } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Drill from '~/components/Drill.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import ActivityIcon from '~/components/bits/ActivityIcon.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import Media from '~/components/bits/Media.vue';
import When from '~/components/bits/When.vue';

const t = useT();
const totals = getTotals();
const groups = activityGroups();

/* Read state is this screen's own override, and is NOT hoisted into the
   engagement store — unlike a like, it means nothing anywhere else. */
const allRead = ref(false);
const unread = computed(() => (allRead.value ? 0 : totals.unreadActivityCount));

const markListeners = { mdClick: () => { allRead.value = true; } };
</script>

<template>
  <Screen
    :title="t('social.screen.activity.title')"
    :subtitle="t('social.screen.activity.subtitle')"
  >
    <template v-if="unread > 0" #aside><Count :value="unread" /></template>
    <template v-if="unread > 0" #actions>
      <md-button v-awc="{ on: markListeners }" variant="text" size="sm" icon="done_all">
        {{ t('social.action.markAllRead') }}
      </md-button>
    </template>
    <template #skeleton><PanelSkeleton height="560px" :lines="10" /></template>

    <EmptyState v-if="groups.length === 0" :message="t('social.empty.activity')" />
    <Panel v-for="group in groups" :key="group.bucket" :title="t(group.labelKey)">
      <template #actions><Count :value="group.rows.length" /></template>
      <md-list :label="t(group.labelKey)" interaction-mode="multi-action" list-style="segmented">
        <md-list-item
          v-for="row in group.rows"
          :key="row.activity.id"
          :data-unread="!row.activity.read && !allRead ? '' : undefined"
          :headline="t(`social.activity.${row.activity.kind}`, { name: row.actor.displayName })"
          :supporting-text="`@${row.actor.handle}`"
          lines="2"
        >
          <span slot="leading" class="activity-leading">
            <Avatar :person="row.actor" size="small" />
            <ActivityIcon :kind="row.activity.kind" />
          </span>
          <span slot="trailing" class="activity-trailing">
            <When :at="row.activity.at" />
            <!-- A follow has no post to show, so the thumbnail slot is genuinely
                 empty rather than filled with a placeholder. -->
            <Drill
              v-if="row.post"
              link-class="activity-thumb"
              :to="route.post(row.post.id)"
            >
              <Media :media="row.post.media[0]" class-name="activity-thumb__img" />
            </Drill>
          </span>
        </md-list-item>
      </md-list>
    </Panel>
  </Screen>
</template>
