<script>
  import { chartProps } from '$lib/chartProps.js';
  import { kpis, dauDays, dauSeries, adoptionFeatures, adoptionSeries } from '$lib/data.js';
</script>

<svelte:head>
  <title>Overview — Pulseboard</title>
</svelte:head>

<md-app-bar
  variant="medium"
  headline="Overview"
  subtitle="Driftline workspace · Last 14 days"
>
  <md-icon-button slot="trailing" icon="calendar_month" aria-label="Change date range"></md-icon-button>
  <md-icon-button slot="trailing" icon="ios_share" aria-label="Export report"></md-icon-button>
</md-app-bar>

<main class="page">
  <section class="kpi-grid" aria-label="Key metrics">
    {#each kpis as kpi (kpi.id)}
      <md-card variant="outlined" full-width>
        <div class="kpi">
          <span class="kpi-label">{kpi.label}</span>
          <span class="kpi-value">{kpi.value}</span>
          <span class="kpi-delta" data-direction={kpi.direction}>{kpi.delta}</span>
          <md-sparkline
            variant={kpi.variant}
            color={kpi.color}
            height="36px"
            use:chartProps={{ data: kpi.trend }}
          ></md-sparkline>
        </div>
      </md-card>
    {/each}
  </section>

  <section class="chart-grid" aria-label="Charts">
    <md-card variant="outlined" full-width class="chart-card wide">
      <md-area-chart
        label="Daily active users by platform"
        subtitle="Jul 24 – Aug 20"
        stack="normal"
        curve="monotone"
        legend="top-end"
        height="340px"
        use:chartProps={{
          xAxis: { data: dauDays, scale: 'category' },
          yAxis: { label: 'Users', min: 0 },
          series: dauSeries,
        }}
      ></md-area-chart>
    </md-card>

    <md-card variant="outlined" full-width class="chart-card">
      <md-bar-chart
        label="Feature adoption"
        subtitle="Share of weekly actives using each feature"
        layout="horizontal"
        legend="top-end"
        height="340px"
        use:chartProps={{
          xAxis: { data: adoptionFeatures },
          yAxis: { label: '% of weekly actives', min: 0, max: 100 },
          series: adoptionSeries,
        }}
      ></md-bar-chart>
    </md-card>

    <md-card variant="filled" full-width class="note-card">
      <h2 class="note-title">This week's read</h2>
      <p class="note-body">
        Smart Search adoption on the Pro plan crossed 80% for the first time.
        Offline Mode remains the widest free-to-pro gap at 33 points — the
        growth team is testing an in-product tour for free workspaces starting
        Monday.
      </p>
      <p class="note-meta">Posted by Rhea Okafor · Growth analytics</p>
    </md-card>
  </section>
</main>

<style>
  .page {
    padding: 24px;
    display: grid;
    gap: 24px;
  }

  .kpi-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .kpi {
    display: grid;
    gap: 4px;
    padding: 20px;
  }

  .kpi-label {
    font: var(--md-sys-typescale-label-large-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .kpi-value {
    font: var(--md-sys-typescale-headline-medium-font);
    color: var(--md-sys-color-on-surface);
  }

  .kpi-delta {
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .kpi-delta[data-direction='up'] {
    color: var(--md-sys-color-success, var(--md-sys-color-primary));
  }

  .kpi-delta[data-direction='down'] {
    color: var(--md-sys-color-error);
  }

  .chart-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  }

  .chart-card {
    padding: 20px;
    display: block;
  }

  .chart-card.wide {
    grid-column: 1 / -1;
  }

  .note-card {
    padding: 24px;
    display: block;
  }

  .note-title {
    margin: 0 0 8px;
    font: var(--md-sys-typescale-title-medium-font);
  }

  .note-body {
    margin: 0;
    font: var(--md-sys-typescale-body-medium-font);
    color: var(--md-sys-color-on-surface-variant);
    max-inline-size: 68ch;
  }

  .note-meta {
    margin: 12px 0 0;
    font: var(--md-sys-typescale-label-medium-font);
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
