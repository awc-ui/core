<!--
  Screen 3 — the obligor. Header, then three tabs.

  TABS. `md-tabs` owns the strip and `md-tab-panels` follows it by `for`; the
  panels are matched to the tabs by DOM order, so the two lists must stay the
  same length and the same order. All three panels are rendered — the panel
  component hides the inactive ones — which is what we want: the prerendered HTML
  carries the rating history and the group tree even if the visitor never opens
  those tabs.

  GROUP STRUCTURE. `getGroupTree()` genuinely nests (grp-nordwerk is three deep:
  cp-04 → cp-05 → cp-07), so the org chart is a real hierarchy rather than a flat
  list with a header. Each node's second line carries that entity's own exposure,
  which is the number that makes the tree worth drawing.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  getCounterpartyById,
  getGroupTree,
  getRatingHistory,
  REPORTING_QUARTER,
  type Counterparty,
  type GroupTreeNode,
} from '@awc-ui/showcase-kit/data';
import { utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import type { OrgNode } from '~/lib/types';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';
import Chart from '../Chart.vue';
import OrgChart from '../OrgChart.vue';
import EmptyState from '../EmptyState.vue';
import FacilityTable from '../FacilityTable.vue';
import Fact from '../bits/Fact.vue';
import Chip from '../bits/Chip.vue';
import Dot from '../bits/Dot.vue';
import RatioMeter from '../bits/RatioMeter.vue';

const props = defineProps<{ counterpartyId: string }>();

const t = useT();
const cp = computed(() => getCounterpartyById(props.counterpartyId) as Counterparty);
const history = computed(() => getRatingHistory(props.counterpartyId));
const tree = computed(() => (cp.value.groupId ? getGroupTree(cp.value.groupId) : null));
const tabsId = computed(() => `cp-tabs-${cp.value.id}`);
const percent = computed(
  () => (v: number | null) => t.value.formatPercent(v ?? 0, { maximumFractionDigits: 2 }),
);

const orgNodes = computed<OrgNode[]>(() => {
  const toNode = (node: GroupTreeNode): OrgNode => ({
    id: node.counterparty.id,
    name: node.counterparty.legalName,
    title: `${t.value.formatCurrency(node.counterparty.ead, { notation: 'compact' })} · ${t.value(
      `rating.${node.counterparty.ratingLabel}`,
    )}`,
    avatarInitials: node.counterparty.legalName.slice(0, 2).toUpperCase(),
    children: node.children.map(toNode),
  });
  return tree.value ? [toNode(tree.value.root)] : [];
});

const crumbs = computed(() => [
  { label: t.value('nav.overview'), href: route.overview() },
  { label: t.value(`sector.${cp.value.sectorId}`), href: route.sector(cp.value.sectorId) },
  { label: cp.value.legalName },
]);
</script>

<template>
  <Shell
    :title="cp.legalName"
    :subtitle="
      t('screen.counterparty.subtitle', {
        id: cp.id,
        sector: t(`sector.${cp.sectorId}`),
        country: t(`country.${cp.country}`),
      })
    "
    :crumbs="crumbs"
  >
    <template #aside>
      <Dot kind="watch" :value="cp.watchlist" />
      <Chip kind="rating" :value="cp.ratingLabel" :band="cp.ratingBand" :grade="cp.grade" />
      <md-chip
        v-if="cp.watchlist"
        variant="assist"
        appearance="filled"
        color="error"
        icon="warning"
        :label="t('common.of', { count: cp.signalCount, total: cp.signalCount })"
        :title="t('screen.watchlist.title')"
      ></md-chip>
    </template>

    <section class="grid-2">
      <Panel :title="t('kpi.ead')" :subtitle="t('app.reportingQuarter', { quarter: REPORTING_QUARTER })">
        <dl class="dl dl--numeric">
          <Fact :label="t('kpi.ead')">{{ t.formatCurrency(cp.ead, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('kpi.limit')">{{ t.formatCurrency(cp.limit, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('kpi.drawn')">{{ t.formatCurrency(cp.drawn, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('kpi.undrawn')">{{ t.formatCurrency(cp.undrawn, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('table.pd')">{{ t.formatPercent(cp.pd, { maximumFractionDigits: 2 }) }}</Fact>
          <Fact :label="t('table.lgd')">{{ t.formatPercent(cp.lgd, { maximumFractionDigits: 0 }) }}</Fact>
          <Fact :label="t('kpi.expectedLoss')">
            {{ t.formatCurrency(cp.expectedLoss, { notation: 'compact' }) }}
          </Fact>
          <Fact :label="t('kpi.rwa')">{{ t.formatCurrency(cp.rwa, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('table.rwaDensity')">
            {{ t.formatPercent(cp.rwaDensity, { maximumFractionDigits: 0 }) }}
          </Fact>
        </dl>
        <RatioMeter
          :label="t('kpi.utilisation')"
          :fraction="cp.utilisation"
          :color="utilisationColor(cp.utilisation)"
        />
      </Panel>

      <Panel :title="t('table.manager')" :subtitle="cp.relationshipManager">
        <dl class="dl">
          <Fact :label="t('table.onboarded')">{{ t.formatDate(cp.onboardedDate, 'medium') }}</Fact>
          <Fact :label="t('table.lastReview')">{{ t.formatDate(cp.lastReviewDate, 'medium') }}</Fact>
          <Fact :label="t('table.nextReview')">{{ t.formatDate(cp.nextReviewDate, 'medium') }}</Fact>
          <Fact :label="t('table.band')">{{ t(`ratingBand.${cp.ratingBand}`) }}</Fact>
          <Fact :label="t('table.facilities')">{{ t.formatNumber(cp.facilityCount) }}</Fact>
          <Fact :label="t('table.group')">{{ tree ? tree.name : t('common.none') }}</Fact>
        </dl>
      </Panel>
    </section>

    <Panel>
      <md-tabs :id="tabsId" :aria-label="t('nav.label')" variant="primary" tab-width="auto" divider="full">
        <md-tab :label="t('nav.facilities')" icon="account_balance_wallet" inline-icon></md-tab>
        <md-tab :label="t('rating.history')" icon="timeline" inline-icon></md-tab>
        <md-tab :label="t('nav.groups')" icon="account_tree" inline-icon></md-tab>
      </md-tabs>

      <md-tab-panels :for="tabsId" sizing="stable">
        <md-tab-panel>
          <FacilityTable :counterparty-id="cp.id" />
        </md-tab-panel>

        <md-tab-panel>
          <div class="stack">
            <Chart
              tag="md-line-chart"
              :series="[{ label: t('table.pd'), data: history.map((o) => o.pd) }]"
              :x-axis="{ data: history.map((o) => o.quarter), scale: 'category' }"
              :y-axis="{ label: t('table.pd'), min: 0 }"
              :value-formatter="percent"
              curve="monotone"
              show-marks
              grid="horizontal"
              axis-ticks
              legend="none"
              height="300px"
              :label="t('rating.history')"
              :subtitle="t('rating.historyHint', { quarter: REPORTING_QUARTER })"
              :summary="t('chart.summary.line', { label: t('rating.history'), count: 1 })"
            />
            <div class="row">
              <md-chip
                v-for="observation in history"
                :key="observation.quarter"
                variant="assist"
                appearance="outlined"
                :label="`${observation.quarter} · ${t(`rating.${observation.label}`)}`"
                :title="t('rating.gradeLabel', { grade: observation.grade })"
              ></md-chip>
            </div>
          </div>
        </md-tab-panel>

        <md-tab-panel>
          <div v-if="tree" class="stack">
            <dl class="dl">
              <Fact :label="t('table.group')">{{ tree.name }}</Fact>
              <Fact :label="t('kpi.counterparties')">{{ t.formatNumber(tree.memberCount) }}</Fact>
              <Fact :label="t('kpi.ead')">
                {{ t.formatCurrency(tree.totals.ead, { notation: 'compact' }) }}
              </Fact>
              <Fact :label="t('kpi.expectedLoss')">
                {{ t.formatCurrency(tree.totals.expectedLoss, { notation: 'compact' }) }}
              </Fact>
              <Fact :label="t('kpi.rwa')">
                {{ t.formatCurrency(tree.totals.rwa, { notation: 'compact' }) }}
              </Fact>
              <Fact :label="t('kpi.weightedAvgPd')">
                {{ t.formatPercent(tree.totals.weightedAvgPd, { maximumFractionDigits: 2 }) }}
              </Fact>
            </dl>
            <OrgChart
              :nodes="orgNodes"
              :label="t('screen.groups.title')"
              :expand-label="t('action.expand')"
              :collapse-label="t('action.collapse')"
              orientation="vertical"
            />
          </div>
          <EmptyState v-else :message="t('screen.groups.subtitle')" />
        </md-tab-panel>
      </md-tab-panels>
    </Panel>
  </Shell>
</template>
