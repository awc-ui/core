<script>
  import { onMount } from 'svelte';

  let chart;

  onMount(() => {
    // Objects/arrays have no attribute form — set the chart data as JS properties.
    if (chart) {
      chart.xAxis = { data: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'], scale: 'category' };
      chart.series = [{ label: 'Sessions', data: [320, 410, 380, 520, 490, 610, 580, 700] }];
      chart.yAxis = { min: 0 };
    }
  });

  // Dark mode: data-theme="dark" on <html> swaps the token palette.
  function onThemeChange(e) {
    document.documentElement.setAttribute('data-theme', e.detail.selected ? 'dark' : 'light');
  }
</script>

<svelte:head>
  <title>AWC UI Starter — SvelteKit</title>
</svelte:head>

<md-app-bar headline="Acme Analytics" subtitle="Overview">
  <md-switch slot="trailing" icons aria-label="Dark mode" on:mdChange={onThemeChange}></md-switch>
</md-app-bar>

<main style="padding:24px;font-family:system-ui,sans-serif;display:grid;gap:20px;max-width:840px;margin:0 auto">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
    <md-card variant="elevated">
      <div style="padding:16px;display:grid;gap:4px">
        <span style="font:var(--md-sys-typescale-label-large);color:var(--md-sys-color-on-surface-variant)">Revenue</span>
        <span style="font:var(--md-sys-typescale-headline-medium)">$48.2k</span>
        <span style="font:var(--md-sys-typescale-body-small);color:var(--md-sys-color-primary)">+12% vs last month</span>
      </div>
    </md-card>
    <md-card variant="filled">
      <div style="padding:16px;display:grid;gap:4px">
        <span style="font:var(--md-sys-typescale-label-large);color:var(--md-sys-color-on-surface-variant)">Active users</span>
        <span style="font:var(--md-sys-typescale-headline-medium)">1,284</span>
        <span style="font:var(--md-sys-typescale-body-small);color:var(--md-sys-color-primary)">+4.6% vs last month</span>
      </div>
    </md-card>
  </div>

  <md-card variant="outlined">
    <div style="padding:16px">
      <md-line-chart
        bind:this={chart}
        label="Sessions"
        subtitle="Last 8 weeks"
        curve="monotone"
        area
        legend="none"
        height="260px"
      ></md-line-chart>
    </div>
  </md-card>

  <md-table-container>
    <md-table column-template="2fr 1fr 1fr" label="Recent invoices" striped>
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell head scope="col">Client</md-table-cell>
          <md-table-cell head scope="col" numeric>Amount</md-table-cell>
          <md-table-cell head scope="col">Status</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        <md-table-row value="inv-1">
          <md-table-cell>Acme Corp</md-table-cell>
          <md-table-cell numeric>$1,200</md-table-cell>
          <md-table-cell>Paid</md-table-cell>
        </md-table-row>
        <md-table-row value="inv-2">
          <md-table-cell>Globex</md-table-cell>
          <md-table-cell numeric>$860</md-table-cell>
          <md-table-cell>Pending</md-table-cell>
        </md-table-row>
        <md-table-row value="inv-3">
          <md-table-cell>Initech</md-table-cell>
          <md-table-cell numeric>$2,400</md-table-cell>
          <md-table-cell>Paid</md-table-cell>
        </md-table-row>
      </md-table-body>
    </md-table>
  </md-table-container>
</main>
