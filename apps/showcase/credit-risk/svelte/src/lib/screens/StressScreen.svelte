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
<script lang="ts">
  import {
    getSectors,
    getStressScenarioById,
    getStressScenarios,
    type ScenarioId,
  } from '@awc-ui/showcase-kit/data';
  import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Shell from '$lib/components/Shell.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Fact from '$lib/bits/Fact.svelte';

  const scenarios = getStressScenarios();
  const sectors = getSectors();

  let scenarioId: ScenarioId = 'adverse';

  $: scenario = getStressScenarioById(scenarioId) ?? scenarios[0];
  $: money = (v: number | null) => $t.formatCurrency(v ?? 0, { notation: 'compact' });
  $: sectorLabels = sectors.map((s) => $t(s.nameKey));

  function onScenarioChange(event: Event) {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) scenarioId = value as ScenarioId;
  }

  function describe(id: ScenarioId) {
    const s = getStressScenarioById(id);
    if (!s) return '';
    return $t(s.descriptionKey, {
      pd: $t.formatNumber(s.pdMultiplier, { maximumFractionDigits: 2 }),
      lgd: $t.formatPercent(s.lgdUplift, { maximumFractionDigits: 0 }),
    });
  }
</script>

<Shell title={$t('screen.stress.title')} subtitle={$t('screen.stress.subtitle')}>
  <svelte:fragment slot="aside">
    <md-segmented-button-set aria-label={$t('table.scenario')} on:mdChange={onScenarioChange}>
      {#each scenarios as s (s.id)}
        <md-segmented-button
          value={s.id}
          label={$t(s.nameKey)}
          selected={s.id === 'adverse' || undefined}
        ></md-segmented-button>
      {/each}
    </md-segmented-button-set>
  </svelte:fragment>

  <Panel title={$t(scenario.nameKey)} subtitle={describe(scenario.id)}>
    <dl class="dl dl--numeric">
      <Fact label={$t('table.pdMultiplier')}>
        {$t('unit.times', {
          value: $t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 }),
        })}
      </Fact>
      <Fact label={$t('table.lgdUplift')}>
        {$t.formatPercent(scenario.lgdUplift, {
          maximumFractionDigits: 0,
          signDisplay: 'exceptZero',
        })}
      </Fact>
      <Fact label={$t('kpi.ead')}>{$t.formatCurrency(scenario.totals.ead, { notation: 'compact' })}</Fact>
      <Fact label={$t('kpi.expectedLoss')}>
        {$t.formatCurrency(scenario.totals.expectedLoss, { notation: 'compact' })}
      </Fact>
      <Fact label={$t('table.elDelta')}>
        {scenario.totals.expectedLossDelta === 0
          ? $t('common.na')
          : $t.formatCurrency(scenario.totals.expectedLossDelta, { notation: 'compact' })}
      </Fact>
      <Fact label={$t('kpi.rwa')}>{$t.formatCurrency(scenario.totals.rwa, { notation: 'compact' })}</Fact>
      <Fact label={$t('table.rwaDelta')}>
        {scenario.totals.rwaDelta === 0
          ? $t('common.na')
          : $t.formatCurrency(scenario.totals.rwaDelta, { notation: 'compact' })}
      </Fact>
      <Fact label={$t('kpi.weightedAvgPd')}>
        {$t.formatPercent(scenario.totals.weightedAvgPd, { maximumFractionDigits: 2 })}
      </Fact>
      <Fact label={$t('kpi.rwaDensity')}>
        {$t.formatPercent(scenario.totals.rwaDensity, { maximumFractionDigits: 1 })}
      </Fact>
    </dl>
  </Panel>

  <!-- Both charts carry their own header; the panels stay untitled so the
       heading is not printed twice. -->
  <section class="grid-2">
    <Panel>
      <Chart
        tag="md-bar-chart"
        series={scenarios.map((s) => ({
          id: s.id,
          label: $t(s.nameKey),
          data: s.bySector.map((row) => row.expectedLoss),
        }))}
        xAxis={{ data: sectorLabels }}
        yAxis={{ label: $t('kpi.expectedLoss'), min: 0 }}
        valueFormatter={money}
        legend="top-end"
        axis-ticks
        height="340px"
        label={$t('kpi.expectedLoss')}
        subtitle={$t('scenario.compare')}
      />
    </Panel>

    <Panel>
      <Chart
        tag="md-bar-chart"
        series={scenarios.map((s) => ({
          id: s.id,
          label: $t(s.nameKey),
          data: s.bySector.map((row) => row.rwa),
        }))}
        xAxis={{ data: sectorLabels }}
        yAxis={{ label: $t('kpi.rwa'), min: 0 }}
        valueFormatter={money}
        legend="top-end"
        axis-ticks
        height="340px"
        label={$t('kpi.rwa')}
        subtitle={$t('scenario.compare')}
      />
    </Panel>
  </section>

  <Panel
    title={$t('table.sector')}
    subtitle="{$t(scenario.nameKey)} · {$t('scenario.vsBaseline')}"
  >
    <md-table-container variant="outlined">
      <md-table
        label={$t('screen.stress.title')}
        column-template={TABLES.stress.columns}
        min-width={TABLES.stress.minWidth}
        striped
      >
        <md-table-head>
          <md-table-row rowgroup="head">
            <md-table-cell head scope="col">{$t('table.sector')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.ead')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.pd')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.lgd')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.expectedLoss')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.elDelta')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.rwa')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.rwaDelta')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {#each scenario.bySector as row (row.sectorId)}
            <md-table-row value={row.sectorId}>
              <md-table-cell>
                <Drill href={route.sector(row.sectorId)}>{$t(`sector.${row.sectorId}`)}</Drill>
              </md-table-cell>
              <md-table-cell numeric>{$t.formatCurrency(row.ead, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>
                {$t.formatPercent(row.weightedAvgPd, { maximumFractionDigits: 2 })}
              </md-table-cell>
              <md-table-cell numeric>
                {$t.formatPercent(row.weightedAvgLgd, { maximumFractionDigits: 1 })}
              </md-table-cell>
              <md-table-cell numeric>
                {$t.formatCurrency(row.expectedLoss, { notation: 'compact' })}
              </md-table-cell>
              <md-table-cell numeric>
                <span style={row.expectedLossDelta > 0 ? 'color: var(--md-sys-color-error)' : undefined}>
                  {row.expectedLossDelta === 0
                    ? $t('common.na')
                    : $t.formatCurrency(row.expectedLossDelta, { notation: 'compact' })}
                </span>
              </md-table-cell>
              <md-table-cell numeric>{$t.formatCurrency(row.rwa, { notation: 'compact' })}</md-table-cell>
              <md-table-cell numeric>
                <span style={row.rwaDelta > 0 ? 'color: var(--md-sys-color-warning)' : undefined}>
                  {row.rwaDelta === 0
                    ? $t('common.na')
                    : $t.formatCurrency(row.rwaDelta, { notation: 'compact' })}
                </span>
              </md-table-cell>
            </md-table-row>
          {/each}
        </md-table-body>
      </md-table>
    </md-table-container>
  </Panel>
</Shell>
