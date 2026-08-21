<script>
  import { onMount } from 'svelte';
  import { sprint } from '$lib/data.js';

  let chartEl;

  onMount(() => {
    let cancelled = false;
    (async () => {
      await customElements.whenDefined('md-bar-chart');
      if (cancelled || !chartEl) return;
      chartEl.series = [
        { label: 'Remaining', data: sprint.remaining.map((v) => (v == null ? 12 : v)) },
        { label: 'Ideal', data: sprint.ideal },
      ];
      chartEl.xAxis = { data: sprint.days };
      chartEl.yAxis = { label: 'Story points', min: 0 };
      chartEl.valueFormatter = (v) => `${v ?? 0} pts`;
    })();
    return () => {
      cancelled = true;
    };
  });

  const pct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100);
</script>

<svelte:head>
  <title>Cairn — Sprint</title>
</svelte:head>

<main class="screen">
  <div class="screen-head">
    <div>
      <h1 class="screen-title">{sprint.name}</h1>
      <p class="screen-sub">{sprint.window} · {sprint.committedPoints} points committed</p>
    </div>
    <div class="summary">
      <md-progress-indicator
        variant="circular"
        value={sprint.completedPoints}
        max={sprint.committedPoints}
        size="56"
        label="Sprint completion"
      ></md-progress-indicator>
      <div class="summary-text">
        <span class="summary-pct">{pct}%</span>
        <span class="summary-sub">{sprint.completedPoints} of {sprint.committedPoints} pts done</span>
      </div>
    </div>
  </div>

  <md-card variant="outlined">
    <div class="chart-wrap">
      <md-bar-chart
        bind:this={chartEl}
        label="Burndown"
        subtitle="Story points remaining per day, against the ideal line"
        legend="top-end"
        corner-radius="4"
        height="340px"
        aria-label="Sprint burndown chart"
      ></md-bar-chart>
    </div>
  </md-card>

  <section aria-label="Sprint goals" class="goals-section">
    <h2 class="section-title">Sprint goals</h2>
    <div class="goals">
      {#each sprint.goals as goal (goal.name)}
        <md-card variant="filled">
          <div class="goal">
            <div class="goal-head">
              <span class="goal-name">{goal.name}</span>
              <span class="goal-count">{goal.done}/{goal.total} {goal.unit}</span>
            </div>
            <p class="goal-detail">{goal.detail}</p>
            <md-progress-indicator
              variant="linear"
              value={goal.done}
              max={goal.total}
              label={`Progress on ${goal.name}`}
            ></md-progress-indicator>
          </div>
        </md-card>
      {/each}
    </div>
  </section>
</main>

<style>
  .screen {
    padding: var(--md-sys-spacing-inset-xl);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-lg);
    max-inline-size: 1240px;
    margin-inline: auto;
  }

  .screen-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-lg);
    flex-wrap: wrap;
  }

  .screen-title {
    margin: 0;
    font: var(--md-sys-typescale-headline-medium-font);
  }

  .screen-sub {
    margin: 4px 0 0;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-body-medium-font);
  }

  .summary {
    display: flex;
    align-items: center;
    gap: var(--md-sys-spacing-gap-md);
  }

  .summary-text {
    display: flex;
    flex-direction: column;
  }

  .summary-pct {
    font: var(--md-sys-typescale-title-large-font);
  }

  .summary-sub {
    font: var(--md-sys-typescale-label-medium-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .chart-wrap {
    padding: var(--md-sys-spacing-inset-lg);
  }

  .goals-section {
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-md);
  }

  .section-title {
    margin: 0;
    font: var(--md-sys-typescale-title-large-font);
  }

  .goals {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--md-sys-spacing-gap-md);
  }

  .goal {
    padding: var(--md-sys-spacing-inset-lg);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .goal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-md);
  }

  .goal-name {
    font: var(--md-sys-typescale-title-medium-font);
  }

  .goal-count {
    font: var(--md-sys-typescale-label-large-font);
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }

  .goal-detail {
    margin: 0;
    font: var(--md-sys-typescale-body-medium-font);
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
