<!--
  Groups — the ones you are in, and the ones you might be.

  TWO SECTIONS AND THE JOIN BUTTON IS THE DIFFERENCE. `joinAction` in the kit
  decides which control each role gets, including the two that offer nothing: an
  admin cannot leave their own group here (there is no ownership transfer behind
  it, so the control would be a dead end).
-->
<script setup lang="ts">
import { getDiscoverGroups, getJoinedGroups, getTotals } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import GroupsSkeleton from '~/components/skeletons/GroupsSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import GroupCard from './GroupCard.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useT } from '~/composables/useShowcase';

const t = useT();
const totals = getTotals();
const { message, say, close } = useSnackbar();
const joined = getJoinedGroups();
const discover = getDiscoverGroups();
</script>

<template>
  <Screen
    :title="t('community.screen.groups.title')"
    :subtitle="t('community.screen.groups.subtitle')"
  >
    <template #skeleton><GroupsSkeleton /></template>
    <template #aside><Count :value="totals.groupCount" /></template>

    <Panel :title="t('community.panel.yourGroups')">
      <template #actions><Count :value="joined.length" /></template>
      <EmptyState
        v-if="joined.length === 0"
        :message="t('community.empty.groups')"
        :hint="t('community.empty.groupsHint')"
      />
      <div v-else class="card-grid">
        <GroupCard v-for="group in joined" :key="group.id" :group="group" @message="say" />
      </div>
    </Panel>

    <Panel :title="t('community.panel.discover')">
      <template #actions><Count :value="discover.length" /></template>
      <div class="card-grid">
        <GroupCard v-for="group in discover" :key="group.id" :group="group" @message="say" />
      </div>
    </Panel>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
