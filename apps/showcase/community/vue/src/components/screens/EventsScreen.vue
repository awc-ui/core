<!--
  Events — grouped by age, soonest first, past last.

  The buckets come from the kit and empty ones are dropped rather than rendered
  as a heading over nothing. `past` is LAST rather than first: a list read top to
  bottom should begin with what is about to happen.
-->
<script setup lang="ts">
import { eventGroups, getEvents, getTotals } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import EventsSkeleton from '~/components/skeletons/EventsSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import EventRow from './EventRow.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useT } from '~/composables/useShowcase';

const t = useT();
const totals = getTotals();
const { message, say, close } = useSnackbar();
const groups = eventGroups(getEvents());
</script>

<template>
  <Screen
    :title="t('community.screen.events.title')"
    :subtitle="t('community.screen.events.subtitle')"
  >
    <template #skeleton><EventsSkeleton /></template>
    <template #aside><Count :value="totals.goingCount" /></template>

    <EmptyState v-if="groups.length === 0" :message="t('community.empty.events')" />
    <Panel v-for="group in groups" v-else :key="group.bucket" :title="t(group.labelKey)">
      <template #actions><Count :value="group.events.length" /></template>
      <div class="event-list">
        <EventRow
          v-for="event in group.events"
          :key="event.id"
          :event="event"
          @message="say"
        />
      </div>
    </Panel>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
