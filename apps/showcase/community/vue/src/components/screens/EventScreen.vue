<!--
  One event.

  A PAST EVENT SAYS SO AND KEEPS NO BUTTONS. There is no answering an event that
  has happened, so the row is replaced by a line of text rather than by three
  controls that do nothing. Measured against the REPORTING INSTANT, not the
  clock, so a past event stays past in every screenshot.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  REPORTING_INSTANT,
  RSVP_CHOICES,
  eventSummary,
  getEventBySlug,
  rsvpIcon,
} from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import CoverSkeleton from '~/components/skeletons/CoverSkeleton.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import Media from '~/components/bits/Media.vue';
import RsvpChip from '~/components/bits/RsvpChip.vue';
import TimeText from '~/components/bits/TimeText.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { route } from '~/lib/routes';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ slug: string }>();
const t = useT();
const { rsvpFor, setRsvp } = useEngagement();
const { message, say, close } = useSnackbar();

const found = computed(() => getEventBySlug(props.slug));
const summary = computed(() => (found.value ? eventSummary(found.value.id) : null));
const rsvp = computed(() => (found.value ? rsvpFor(found.value) : 'none'));
const past = computed(() =>
  found.value ? Date.parse(found.value.startsAt) < Date.parse(REPORTING_INSTANT) : false,
);

function answer(choice: (typeof RSVP_CHOICES)[number]) {
  if (!found.value) return;
  const next = rsvp.value === choice ? 'none' : choice;
  setRsvp(found.value, next);
  say(
    next === 'going'
      ? 'community.msg.rsvpGoing'
      : next === 'interested'
        ? 'community.msg.rsvpInterested'
        : next === 'declined'
          ? 'community.msg.rsvpDeclined'
          : null,
    { name: found.value.name },
  );
}
</script>

<template>
  <NotFoundScreen v-if="!summary" />
  <Screen
    v-else
    :title="summary.event.name"
    :subtitle="t('community.screen.event.subtitle')"
    :crumb-label="summary.event.name"
  >
    <template #skeleton><CoverSkeleton /></template>
    <template #aside><RsvpChip :rsvp="rsvp" /></template>

    <div class="columns">
      <div class="columns__main">
        <Panel>
          <Media :media="summary.event.cover" class-name="event-cover" eager />
          <h2 class="profile-head__name">{{ summary.event.name }}</h2>

          <div class="profile-facts">
            <p class="profile-fact">
              <span class="material-symbols-outlined" aria-hidden="true">schedule</span
              ><DateText :at="summary.event.startsAt" format="long" />,
              <TimeText :at="summary.event.startsAt" /> {{ t('community.common.to') }}
              <TimeText :at="summary.event.endsAt" />
            </p>
            <p class="profile-fact">
              <span class="material-symbols-outlined" aria-hidden="true">{{
                summary.event.online ? 'videocam' : 'place'
              }}</span
              >{{
                summary.event.online
                  ? t('community.hint.online')
                  : t(summary.event.placeKey ?? 'community.common.na')
              }}
            </p>
            <p v-if="summary.group" class="profile-fact">
              <span class="material-symbols-outlined" aria-hidden="true">groups</span
              ><Drill link-class="post-card__group" :to="route.group(summary.group.slug)">{{
                summary.group.name
              }}</Drill>
            </p>
          </div>

          <p v-if="past" class="muted">{{ t('community.hint.eventOver') }}</p>
          <div v-else class="row">
            <md-button
              v-for="choice in RSVP_CHOICES"
              :key="choice"
              :variant="rsvp === choice ? 'filled' : 'outlined'"
              :icon="rsvpIcon[choice]"
              :data-rsvp="choice"
              :data-on="rsvp === choice ? '' : undefined"
              @click="answer(choice)"
            >
              {{ t(`community.rsvp.${choice}`) }}
            </md-button>
          </div>

          <p>{{ t(summary.event.descriptionKey) }}</p>
        </Panel>
      </div>

      <aside class="columns__rail">
        <Panel :title="t('community.panel.hostedBy')">
          <Drill link-class="rail-row" :to="route.person(summary.host.handle)">
            <Avatar :person="summary.host" size="medium" />
            <span class="rail-row__text">
              <span class="rail-row__name">{{ summary.host.displayName }}</span>
            </span>
          </Drill>
        </Panel>

        <Panel :title="t('community.panel.attendance')">
          <dl class="stat-row">
            <div>
              <dt>{{ t('community.count.going') }}</dt>
              <dd><Count :value="summary.event.goingCount" /></dd>
            </div>
            <div>
              <dt>{{ t('community.count.interested') }}</dt>
              <dd><Count :value="summary.event.interestedCount" /></dd>
            </div>
          </dl>
          <template v-if="summary.friendsGoing.length > 0">
            <p class="muted">
              {{
                summary.friendsGoing.length === 1
                  ? t('community.hint.friendsGoingOne')
                  : t('community.hint.friendsGoing', {
                      count: t.formatNumber(summary.friendsGoing.length),
                    })
              }}
            </p>
            <div class="rail-block">
              <Drill
                v-for="person in summary.friendsGoing"
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
          </template>
        </Panel>
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
