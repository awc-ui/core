<!-- The household's audit trail, newest first — as the kit already returns it. -->
<script setup lang="ts">
import type { Activity } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import ActivityCategoryChip from '~/components/bits/ActivityCategoryChip.vue';
import DateText from '~/components/bits/DateText.vue';

defineProps<{ activity: Activity[] }>();

const t = useT();
</script>

<template>
  <EmptyState v-if="activity.length === 0" :message="t('wealth.empty.activity')" />
  <md-list v-else :label="t('wealth.panel.activity')">
    <md-list-item
      v-for="entry in activity"
      :key="entry.id"
      :headline="t(entry.actionKey)"
      :overline="`${t(entry.targetTypeKey)} · ${entry.targetLabel}`"
      :supporting-text="entry.actorName"
      leading-icon="history"
      lines="3"
    >
      <span slot="trailing" class="row">
        <ActivityCategoryChip :category="entry.category" />
      </span>
      <span slot="trailing-supporting-text">
        <DateText :value="entry.date" date-style="short" />
      </span>
    </md-list-item>
  </md-list>
</template>
