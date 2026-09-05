<script setup lang="ts">
import { computed } from 'vue';
import { RSVP_CHOICES, rsvpIcon, type CommunityEvent } from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import Count from '~/components/bits/Count.vue';
import RsvpChip from '~/components/bits/RsvpChip.vue';
import TimeText from '~/components/bits/TimeText.vue';
import EventDate from './EventDate.vue';
import { route } from '~/lib/routes';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ event: CommunityEvent }>();
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();

const t = useT();
const { rsvpFor, setRsvp } = useEngagement();
const rsvp = computed(() => rsvpFor(props.event));

function answer(choice: (typeof RSVP_CHOICES)[number]) {
  const next = rsvp.value === choice ? 'none' : choice;
  setRsvp(props.event, next);
  emit(
    'message',
    next === 'going'
      ? 'community.msg.rsvpGoing'
      : next === 'interested'
        ? 'community.msg.rsvpInterested'
        : next === 'declined'
          ? 'community.msg.rsvpDeclined'
          : null,
    { name: props.event.name },
  );
}
</script>

<template>
  <div class="event-row" :data-event="props.event.id">
    <EventDate :at="props.event.startsAt" />
    <div class="event-row__text">
      <Drill link-class="event-row__name" :to="route.event(props.event.slug)">{{
        props.event.name
      }}</Drill>
      <span class="event-row__meta">
        <TimeText :at="props.event.startsAt" />
        <span aria-hidden="true">·</span>
        <span class="material-symbols-outlined" aria-hidden="true">{{
          props.event.online ? 'videocam' : 'place'
        }}</span>
        {{
          props.event.online
            ? t('community.hint.online')
            : t(props.event.placeKey ?? 'community.common.na')
        }}
      </span>
      <!-- `__counts`, not `__meta`: this line is a sentence rather than a row of
           items, so it must not carry the flex gap. -->
      <span class="event-row__counts">
        <Count :value="props.event.goingCount" />
        {{ t('community.count.going').toLocaleLowerCase(t.locale)
        }}{{
          props.event.friendsGoingCount > 0
            ? ` · ${
                props.event.friendsGoingCount === 1
                  ? t('community.hint.friendsGoingOne')
                  : t('community.hint.friendsGoing', {
                      count: t.formatNumber(props.event.friendsGoingCount),
                    })
              }`
            : ''
        }}
      </span>
      <span class="row"><RsvpChip :rsvp="rsvp" /></span>
    </div>

    <!-- THREE CHOICES, NOT FIVE. `invited` is a state somebody else put the
         reader in, and `none` is the absence of an answer rather than one. -->
    <span class="event-row__action row">
      <md-icon-button
        v-for="choice in RSVP_CHOICES"
        :key="choice"
        :icon="rsvpIcon[choice]"
        :data-rsvp="choice"
        :data-on="rsvp === choice ? '' : undefined"
        :color="rsvp === choice ? 'primary' : undefined"
        :aria-label="t(`community.rsvp.${choice}`)"
        :aria-pressed="rsvp === choice"
        @click="answer(choice)"
      />
    </span>
  </div>
</template>
