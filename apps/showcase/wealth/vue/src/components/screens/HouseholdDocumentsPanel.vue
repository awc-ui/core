<!--
  The household's advice documents.

  A proposal IS the document in this domain — a draft advice paper moving
  through five review steps — so this list is `getProposalsFor()` and not a
  second, invented entity. `md-list` rather than a table (§5.5: a short
  vertical set of records), rows are `type="text"`, and the drill is the
  trailing `md-icon-button`: routing from the icon button's own `mdClick`
  keeps the navigation in the SPA, where a row-level `href` would hand it to
  `window.location` and reload the whole application.
-->
<script setup lang="ts">
import type { Proposal } from '@awc-ui/showcase-kit/wealth';
import { useRouter } from '~/lib/router';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import ProposalStatusChip from '~/components/bits/ProposalStatusChip.vue';
import ProposalTypeChip from '~/components/bits/ProposalTypeChip.vue';

defineProps<{ proposals: Proposal[] }>();

const t = useT();
const router = useRouter();

// Delegated to the list: `mdClick` bubbles and is composed, and the retargeted
// `event.target` is the `md-icon-button` host carrying the `data-id`.
const listListeners = {
  mdClick(event: Event) {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id) return;
    router.push(route.proposals());
  },
};
</script>

<template>
  <EmptyState v-if="proposals.length === 0" :message="t('wealth.empty.proposals')" />
  <md-list
    v-else
    v-awc="{ on: listListeners }"
    :label="t('wealth.kpi.proposals')"
    interaction-mode="multi-action"
    list-style="segmented"
  >
    <md-list-item
      v-for="proposal in proposals"
      :key="proposal.id"
      :headline="t(proposal.typeKey)"
      :overline="proposal.id"
      :supporting-text="`${t('wealth.common.of', {
        count: proposal.completedStepCount,
        total: proposal.stepCount,
      })} · ${t('wealth.unit.days', { value: t.formatNumber(proposal.daysOpen) })}`"
      leading-icon="description"
      lines="3"
    >
      <!-- One trailing element, for the same reason as the members list:
           the slot stacks its children, so the chips and the drill would
           sit on two lines and double the row height. -->
      <span slot="trailing" class="row">
        <ProposalTypeChip :type="proposal.type" />
        <ProposalStatusChip :status="proposal.status" />
        <md-icon-button
          :data-id="proposal.id"
          icon="open_in_new"
          :aria-label="`${t('wealth.action.review')} — ${proposal.id}`"
        ></md-icon-button>
      </span>
    </md-list-item>
  </md-list>
</template>
