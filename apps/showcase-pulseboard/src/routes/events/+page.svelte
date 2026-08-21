<script>
  import { onMount } from 'svelte';
  import { chartProps } from '$lib/chartProps.js';
  import { events, eventCategories } from '$lib/data.js';

  let loading = true;
  let query = '';
  let selectedCategories = [];

  onMount(() => {
    // Simulated fetch so the skeleton loading state is visible.
    const timer = setTimeout(() => (loading = false), 1400);
    return () => clearTimeout(timer);
  });

  function onSearch(event) {
    query = event.detail.value.toLowerCase();
  }

  function onClear() {
    query = '';
  }

  function onChipSelect(category, event) {
    if (event.detail.selected) {
      selectedCategories = [...selectedCategories, category];
    } else {
      selectedCategories = selectedCategories.filter((c) => c !== category);
    }
  }

  $: filtered = events.filter((e) => {
    const matchesQuery = !query || e.name.toLowerCase().includes(query);
    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(e.category);
    return matchesQuery && matchesCategory;
  });

  $: suggestions = query
    ? events.filter((e) => e.name.toLowerCase().includes(query)).slice(0, 5)
    : [];

  const formatCount = new Intl.NumberFormat('en-US');
</script>

<svelte:head>
  <title>Events — Pulseboard</title>
</svelte:head>

<md-app-bar
  variant="medium"
  headline="Events"
  subtitle="14 tracked events · last 24 hours"
>
  <md-icon-button slot="trailing" icon="add" aria-label="Track a new event"></md-icon-button>
</md-app-bar>

<main class="page">
  <div class="filter-row">
    <md-search
      layout="docked"
      trigger="bar"
      placeholder="Search events"
      input-aria-label="Search tracked events"
      debounce="150"
      max-block-size="40vh"
      class="event-search"
      on:mdSearch={onSearch}
      on:mdClear={onClear}
    >
      <div slot="results" class="search-results">
        {#if suggestions.length === 0}
          <p class="search-empty">Type to match an event name.</p>
        {:else}
          <ul class="suggestion-list">
            {#each suggestions as s (s.name)}
              <li class="suggestion">
                <span class="suggestion-name">{s.name}</span>
                <span class="suggestion-cat">{s.category}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </md-search>

    <div class="chip-row" role="group" aria-label="Filter by category">
      {#each eventCategories as category (category)}
        <md-chip
          variant="filter"
          label={category}
          selected={selectedCategories.includes(category)}
          on:mdSelect={(e) => onChipSelect(category, e)}
        ></md-chip>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="summary-skeleton" aria-label="Loading event summary">
      <md-skeleton variant="text" lines="2" width="320px"></md-skeleton>
    </div>
  {:else}
    <p class="summary-line">
      {filtered.length} of {events.length} events shown
      {#if selectedCategories.length > 0}
        · filtered to {selectedCategories.join(', ')}
      {/if}
      {#if query}
        · matching “{query}”
      {/if}
    </p>
  {/if}

  <md-card variant="outlined" full-width class="table-card">
    <md-table-container max-height="62vh">
      <md-table
        column-template="2fr 1fr 0.8fr 1.2fr 1fr 0.8fr"
        sticky-header
        striped
        loading={loading}
        loading-mode="skeleton"
        loading-rows="7"
        label="Tracked events"
        empty={!loading && filtered.length === 0}
      >
        <md-table-head>
          <md-table-row rowgroup="head">
            <md-table-cell head scope="col">Event</md-table-cell>
            <md-table-cell head scope="col">Category</md-table-cell>
            <md-table-cell head scope="col" numeric>Count (24h)</md-table-cell>
            <md-table-cell head scope="col">7-day trend</md-table-cell>
            <md-table-cell head scope="col">Last seen</md-table-cell>
            <md-table-cell head scope="col">Status</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {#if !loading}
            {#each filtered as e (e.name)}
              <md-table-row value={e.name}>
                <md-table-cell><code class="event-name">{e.name}</code></md-table-cell>
                <md-table-cell>{e.category}</md-table-cell>
                <md-table-cell numeric>{formatCount.format(e.count)}</md-table-cell>
                <md-table-cell>
                  <md-sparkline
                    variant="line"
                    color={e.category === 'Error' ? 'error' : 'primary'}
                    height="28px"
                    use:chartProps={{ data: e.trend }}
                  ></md-sparkline>
                </md-table-cell>
                <md-table-cell>{e.lastSeen}</md-table-cell>
                <md-table-cell>
                  <span class="status" data-status={e.status}>{e.status}</span>
                </md-table-cell>
              </md-table-row>
            {/each}
          {/if}
        </md-table-body>
      </md-table>
    </md-table-container>
  </md-card>
</main>

<style>
  .page {
    padding: 24px;
    display: grid;
    gap: 20px;
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .event-search {
    inline-size: min(420px, 100%);
  }

  .search-results {
    padding: 8px 16px;
  }

  .search-empty {
    margin: 8px 0;
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .suggestion-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }

  .suggestion {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 4px;
  }

  .suggestion-name {
    font: var(--md-sys-typescale-body-medium-font);
    font-family: ui-monospace, 'Roboto Mono', monospace;
  }

  .suggestion-cat {
    font: var(--md-sys-typescale-label-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .chip-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .summary-skeleton {
    min-block-size: 40px;
  }

  .summary-line {
    margin: 0;
    font: var(--md-sys-typescale-body-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .table-card {
    display: block;
    overflow: hidden;
  }

  .event-name {
    font-family: ui-monospace, 'Roboto Mono', monospace;
    font-size: 0.85rem;
    background: var(--md-sys-color-surface-container-high);
    padding: 2px 6px;
    border-radius: 6px;
  }

  .status {
    font: var(--md-sys-typescale-label-medium-font);
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface-variant);
  }

  .status[data-status='Healthy'] {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .status[data-status='Watch'] {
    background: var(--md-sys-color-tertiary-container);
    color: var(--md-sys-color-on-tertiary-container);
  }
</style>
