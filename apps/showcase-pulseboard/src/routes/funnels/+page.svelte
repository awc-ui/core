<script>
  import { chartProps } from '$lib/chartProps.js';
  import { periods, cohortWeeks, cohortsByPeriod, funnelByPeriod } from '$lib/data.js';

  let period = '30d';

  function onPeriodChange(event) {
    const [value] = event.detail;
    if (value) period = value;
  }

  $: cohorts = cohortsByPeriod[period];
  $: funnel = funnelByPeriod[period];
  $: periodLabel = periods.find((p) => p.value === period)?.label ?? '';
</script>

<svelte:head>
  <title>Funnels — Pulseboard</title>
</svelte:head>

<md-app-bar
  variant="medium"
  headline="Funnels"
  subtitle="Signup-to-paid journey · Driftline workspace"
>
  <md-icon-button slot="trailing" icon="ios_share" aria-label="Export funnel"></md-icon-button>
</md-app-bar>

<main class="page">
  <div class="toolbar-row">
    <md-segmented-button-set aria-label="Reporting period" on:mdChange={onPeriodChange}>
      {#each periods as p (p.value)}
        <md-segmented-button value={p.value} label={p.label} selected={p.value === period}></md-segmented-button>
      {/each}
    </md-segmented-button-set>
    <span class="toolbar-hint">Showing the last {periodLabel.toLowerCase()} of signups</span>
  </div>

  <section class="funnel-grid">
    <md-card variant="outlined" full-width class="chart-card">
      <md-line-chart
        label="Cohort retention"
        subtitle="Share of each cohort still active, week by week"
        curve="monotone"
        show-marks
        legend="top-end"
        height="360px"
        use:chartProps={{
          xAxis: { data: cohortWeeks, scale: 'category' },
          yAxis: { label: '% retained', min: 0, max: 100 },
          series: cohorts,
        }}
      ></md-line-chart>
    </md-card>

    <md-card variant="outlined" full-width class="steps-card">
      <h2 class="steps-title">Conversion by step</h2>
      <p class="steps-subtitle">Of everyone who visited in the period</p>
      <ol class="steps">
        {#each funnel as step (step.step)}
          <li class="step">
            <div class="step-head">
              <span class="step-name">{step.step}</span>
              <span class="step-count">{step.count}</span>
            </div>
            <md-meter
              value={step.pct}
              max="100"
              color={step.color}
              label={`${step.step}: ${step.pct}% of visitors`}
              value-text={`${step.pct}%`}
            ></md-meter>
            <span class="step-pct">{step.pct}% of visitors</span>
          </li>
        {/each}
      </ol>
    </md-card>
  </section>

  <md-card variant="filled" full-width class="insight-card">
    <h2 class="insight-title">Where the funnel leaks</h2>
    <p class="insight-body">
      The largest drop is between account creation and onboarding completion.
      In the {periodLabel.toLowerCase()} window, roughly one in three new
      accounts never finishes the four-step onboarding — the cohort curves
      above show those users rarely return after week one.
    </p>
  </md-card>
</main>

<style>
  .page {
    padding: 24px;
    display: grid;
    gap: 24px;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .toolbar-hint {
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .funnel-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
  }

  @media (max-width: 960px) {
    .funnel-grid {
      grid-template-columns: 1fr;
    }
  }

  .chart-card {
    padding: 20px;
    display: block;
  }

  .steps-card {
    padding: 24px;
    display: block;
  }

  .steps-title {
    margin: 0;
    font: var(--md-sys-typescale-title-medium-font);
  }

  .steps-subtitle {
    margin: 4px 0 20px;
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 18px;
  }

  .step {
    display: grid;
    gap: 6px;
  }

  .step-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .step-name {
    font: var(--md-sys-typescale-label-large-font);
  }

  .step-count {
    font: var(--md-sys-typescale-title-small-font);
  }

  .step-pct {
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .insight-card {
    padding: 24px;
    display: block;
  }

  .insight-title {
    margin: 0 0 8px;
    font: var(--md-sys-typescale-title-medium-font);
  }

  .insight-body {
    margin: 0;
    font: var(--md-sys-typescale-body-medium-font);
    color: var(--md-sys-color-on-surface-variant);
    max-inline-size: 72ch;
  }
</style>
