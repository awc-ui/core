<!--
  Screen 6 — stress testing.

  Three scenarios, EAD invariant across all of them, EL and RWA strictly
  monotone. The comparison charts therefore always plot all three side by side
  rather than only the selected one: the point of the screen is the SHAPE of the
  deterioration, and a single-scenario chart hides it. The segmented selector
  drives the per-sector table and the highlighted deltas underneath.

  Baseline's `expectedLossDelta` is exactly zero by construction — its EL equals
  the portfolio EL — so the delta column reads `n/a` there rather than a
  formatted `+0`, which would look like a rounded-away number.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getSectors,
  getStressScenarioById,
  getStressScenarios,
  type ScenarioId,
} from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';
import Chart from '../Chart.vue';
import Drill from '../Drill.vue';
import Fact from '../bits/Fact.vue';

const t = useT();
const scenarios = getStressScenarios();
const sectors = getSectors();

const scenarioId = ref<ScenarioId>('adverse');

const scenario = computed(() => getStressScenarioById(scenarioId.value) ?? scenarios[0]);
const money = computed(() => (v: number | null) => t.value.formatCurrency(v ?? 0, { notation: 'compact' }));
const sectorLabels = computed(() => sectors.map((s) => t.value(s.nameKey)));

const selectorListeners = {
  mdChange(event: Event) {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) scenarioId.value = value as ScenarioId;
  },
};

const describe = computed(() => {
  const s = scenario.value;
  return t.value(s.descriptionKey, {
    pd: t.value.formatNumber(s.pdMultiplier, { maximumFractionDigits: 2 }),
    lgd: t.value.formatPercent(s.lgdUplift, { maximumFractionDigits: 0 }),
  });
});

const elSeries = computed(() =>
  scenarios.map((s) => ({
    id: s.id,
    label: t.value(s.nameKey),
    data: s.bySector.map((row) => row.expectedLoss),
  })),
);
const rwaSeries = computed(() =>
  scenarios.map((s) => ({
    id: s.id,
    label: t.value(s.nameKey),
    data: s.bySector.map((row) => row.rwa),
  })),
);
</script>

<template>
  <Shell :title="t('screen.stress.title')" :subtitle="t('screen.stress.subtitle')">
    <template #aside>
      <md-segmented-button-set v-awc="{ on: selectorListeners }" :aria-label="t('table.scenario')">
        <md-segmented-button
          v-for="s in scenarios"
          :key="s.id"
          :value="s.id"
          :label="t(s.nameKey)"
          :selected="s.id === 'adverse' || undefined"
        ></md-segmented-button>
      </md-segmented-button-set>
    </template>

    <Panel :title="t(scenario.nameKey)" :subtitle="describe">
      <dl class="dl dl--numeric">
        <Fact :label="t('table.pdMultiplier')">
          {{ t('unit.times', { value: t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 }) }) }}
        </Fact>
        <Fact :label="t('table.lgdUplift')">
          {{ t.formatPercent(scenario.lgdUplift, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }) }}
        </Fact>
        <Fact :label="t('kpi.ead')">
          {{ t.formatCurrency(scenario.totals.ead, { notation: 'compact' }) }}
        </Fact>
        <Fact :label="t('kpi.expectedLoss')">
          {{ t.formatCurrency(scenario.totals.expectedLoss, { notation: 'compact' }) }}
        </Fact>
        <Fact :label="t('table.elDelta')">
          {{
            scenario.totals.expectedLossDelta === 0
              ? t('common.na')
              : t.formatCurrency(scenario.totals.expectedLossDelta, { notation: 'compact' })
          }}
        </Fact>
        <Fact :label="t('kpi.rwa')">
          {{ t.formatCurrency(scenario.totals.rwa, { notation: 'compact' }) }}
        </Fact>
        <Fact :label="t('table.rwaDelta')">
          {{
            scenario.totals.rwaDelta === 0
              ? t('common.na')
              : t.formatCurrency(scenario.totals.rwaDelta, { notation: 'compact' })
          }}
        </Fact>
        <Fact :label="t('kpi.weightedAvgPd')">
          {{ t.formatPercent(scenario.totals.weightedAvgPd, { maximumFractionDigits: 2 }) }}
        </Fact>
        <Fact :label="t('kpi.rwaDensity')">
          {{ t.formatPercent(scenario.totals.rwaDensity, { maximumFractionDigits: 1 }) }}
        </Fact>
      </dl>
    </Panel>

    <!-- Both charts carry their own header; the panels stay untitled so the
         heading is not printed twice. -->
    <section class="grid-2">
      <Panel>
        <Chart
          tag="md-bar-chart"
          :series="elSeries"
          :x-axis="{ data: sectorLabels }"
          :y-axis="{ label: t('kpi.expectedLoss'), min: 0 }"
          :value-formatter="money"
          legend="top-end"
          axis-ticks
          height="340px"
          :label="t('kpi.expectedLoss')"
          :subtitle="t('scenario.compare')"
        />
      </Panel>

      <Panel>
        <Chart
          tag="md-bar-chart"
          :series="rwaSeries"
          :x-axis="{ data: sectorLabels }"
          :y-axis="{ label: t('kpi.rwa'), min: 0 }"
          :value-formatter="money"
          legend="top-end"
          axis-ticks
          height="340px"
          :label="t('kpi.rwa')"
          :subtitle="t('scenario.compare')"
        />
      </Panel>
    </section>

    <Panel
      :title="t('table.sector')"
      :subtitle="`${t(scenario.nameKey)} · ${t('scenario.vsBaseline')}`"
    >
      <md-table-container variant="outlined">
        <md-table
          :label="t('screen.stress.title')"
          :column-template="TABLES.stress.columns"
          :min-width="TABLES.stress.minWidth"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{{ t('table.sector') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.ead') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.pd') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.lgd') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.expectedLoss') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.elDelta') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.rwa') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.rwaDelta') }}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row v-for="row in scenario.bySector" :key="row.sectorId" :value="row.sectorId">
              <md-table-cell>
                <Drill :to="route.sector(row.sectorId)">{{ t(`sector.${row.sectorId}`) }}</Drill>
              </md-table-cell>
              <md-table-cell numeric>{{ t.formatCurrency(row.ead, { notation: 'compact' }) }}</md-table-cell>
              <md-table-cell numeric>
                {{ t.formatPercent(row.weightedAvgPd, { maximumFractionDigits: 2 }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatPercent(row.weightedAvgLgd, { maximumFractionDigits: 1 }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(row.expectedLoss, { notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                <span :style="row.expectedLossDelta > 0 ? 'color: var(--md-sys-color-error)' : undefined">
                  {{
                    row.expectedLossDelta === 0
                      ? t('common.na')
                      : t.formatCurrency(row.expectedLossDelta, { notation: 'compact' })
                  }}
                </span>
              </md-table-cell>
              <md-table-cell numeric>{{ t.formatCurrency(row.rwa, { notation: 'compact' }) }}</md-table-cell>
              <md-table-cell numeric>
                <span :style="row.rwaDelta > 0 ? 'color: var(--md-sys-color-warning)' : undefined">
                  {{
                    row.rwaDelta === 0
                      ? t('common.na')
                      : t.formatCurrency(row.rwaDelta, { notation: 'compact' })
                  }}
                </span>
              </md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    </Panel>
  </Shell>
</template>
