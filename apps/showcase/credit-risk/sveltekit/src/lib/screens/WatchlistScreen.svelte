<!--
  Screen 5 — early-warning signals.

  `getWatchlist()` returns rows already denormalised with the counterparty name,
  sector, grade and EAD, and already sorted highest severity first then largest
  exposure — so the table needs no join and no comparator, and the filters can be
  a plain `Array.filter` over the selector's output rather than a second ordering
  that could disagree with it.

  FILTERS. Severity is a multiselect segmented set (`mdChange` gives the value of
  every selected segment, in DOM order); sector is a clearable select. An empty
  severity selection means "all", which is the same thing the set reports when
  the user clears the last segment — so no separate "all" segment is needed, and
  the reset button restores exactly that state.

  `frozen-header`, NOT `sticky-header`. This is the only table in the app inside
  a bounded container, so the only one that scrolls vertically, and the two props
  give different architectures for that. `sticky-header` pins the header inside
  the scroll port, which means the scroll port — and therefore the scrollbar —
  spans the header too. `frozen-header` renders the header OUTSIDE the scrolling
  area so the bar runs beside the rows only.
-->
<script lang="ts">
  import {
    getRatingGrade,
    getSectors,
    getWatchlist,
    type SectorId,
    type SignalSeverity,
  } from '@awc-ui/showcase-kit/data';
  import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Shell from '$lib/components/Shell.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import SeverityChip from '$lib/bits/SeverityChip.svelte';
  import SeverityDot from '$lib/bits/SeverityDot.svelte';

  const SEVERITIES: SignalSeverity[] = ['high', 'medium', 'low'];

  const sectors = getSectors();
  const signals = getWatchlist();
  const allCounterparties = new Set(signals.map((s) => s.counterpartyId)).size;

  let severities: SignalSeverity[] = [];
  let sectorId: SectorId | '' = '';
  let severitySet: HTMLElement;
  let sectorSelect: HTMLElement;

  $: rows = signals.filter(
    (signal) =>
      (severities.length === 0 || severities.includes(signal.severity)) &&
      (sectorId === '' || signal.sectorId === sectorId),
  );
  $: counterparties = new Set(rows.map((signal) => signal.counterpartyId)).size;

  $: head = [
    { label: $t('table.counterparty') },
    { label: $t('table.sector') },
    { label: $t('table.rating') },
    { label: $t('table.signal') },
    { label: $t('table.severity') },
    { label: $t('table.ead'), numeric: true },
    { label: $t('table.opened') },
    { label: $t('table.daysOpen'), numeric: true },
    { label: $t('table.owner') },
  ];

  function onSeverityChange(event: Event) {
    severities = ((event as CustomEvent<string[]>).detail ?? []) as SignalSeverity[];
  }

  function onSectorChange(event: Event) {
    sectorId = ((event as CustomEvent<string>).detail ?? '') as SectorId | '';
  }

  function clearFilters() {
    severities = [];
    sectorId = '';
    // The custom elements own their own visual state, so the reset has to be
    // pushed back into them; Svelte does not re-render an attribute it never set.
    severitySet?.querySelectorAll('md-segmented-button').forEach((segment) => {
      (segment as unknown as { selected: boolean }).selected = false;
    });
    if (sectorSelect) (sectorSelect as unknown as { value: string }).value = '';
  }
</script>

<Shell
  title={$t('screen.watchlist.title')}
  subtitle={$t('screen.watchlist.subtitle', {
    signals: signals.length,
    counterparties: allCounterparties,
  })}
>
  <svelte:fragment slot="aside">
    <md-chip
      variant="assist"
      appearance="filled"
      color="error"
      icon="crisis_alert"
      label={$t('common.showing', { shown: rows.length, total: signals.length })}
    ></md-chip>
  </svelte:fragment>

  <Panel title={$t('action.filter')} subtitle={$t('table.severity')}>
    <div class="row">
      <md-segmented-button-set
        bind:this={severitySet}
        multiselect
        aria-label={$t('table.severity')}
        on:mdChange={onSeverityChange}
      >
        {#each SEVERITIES as severity (severity)}
          <md-segmented-button value={severity} label={$t(`severity.${severity}`)}></md-segmented-button>
        {/each}
      </md-segmented-button-set>

      <md-select
        bind:this={sectorSelect}
        label={$t('table.sector')}
        placeholder={$t('common.all')}
        clearable
        clear-label={$t('action.clearFilters')}
        on:mdChange={onSectorChange}
      >
        {#each sectors as sector (sector.id)}
          <md-select-option value={sector.id} label={$t(sector.nameKey)}>
            {$t(sector.nameKey)}
          </md-select-option>
        {/each}
      </md-select>

      <md-button variant="text" size="sm" icon="filter_alt_off" on:click={clearFilters}>
        {$t('action.clearFilters')}
      </md-button>
    </div>
  </Panel>

  <Panel title={$t('table.signal')} subtitle={$t('common.of', { count: counterparties, total: rows.length })}>
    {#if rows.length === 0}
      <EmptyState message={$t('empty.signals')} hint />
    {:else}
      <md-table-container variant="outlined" max-height="60vh">
        <md-table
          label={$t('screen.watchlist.title')}
          column-template={TABLES.watchlist.columns}
          min-width={TABLES.watchlist.minWidth}
          frozen-header
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              {#each head as cell (cell.label)}
                <md-table-cell head scope="col" numeric={cell.numeric || undefined}>
                  {cell.label}
                </md-table-cell>
              {/each}
            </md-table-row>
          </md-table-head>
          <md-table-body>
            {#each rows as signal (signal.id)}
              <md-table-row value={signal.id}>
                <md-table-cell>
                  <!-- The severity marker leads the row, beside the obligor's
                       name — the same shape the counterparty table uses for its
                       watchlist dot, so a reader scanning the first column sees
                       the severity without crossing a nine-column table. -->
                  <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                    <SeverityDot severity={signal.severity} />
                    <Drill href={route.counterparty(signal.counterpartyId)}>
                      {signal.counterpartyName}
                    </Drill>
                  </span>
                </md-table-cell>
                <md-table-cell>
                  <Drill href={route.sector(signal.sectorId)}>{$t(`sector.${signal.sectorId}`)}</Drill>
                </md-table-cell>
                <md-table-cell>
                  <!-- The signal row carries the grade but not the band, so the
                       band comes from the rating scale rather than from a second
                       set of thresholds invented here. -->
                  <Chips
                    kind="rating"
                    value={signal.ratingLabel}
                    band={getRatingGrade(signal.grade)?.band ?? 'speculative'}
                  />
                </md-table-cell>
                <md-table-cell>{$t(signal.typeKey)}</md-table-cell>
                <md-table-cell>
                  <SeverityChip severity={signal.severity} />
                </md-table-cell>
                <md-table-cell numeric>
                  {$t.formatCurrency(signal.ead, { notation: 'compact' })}
                </md-table-cell>
                <md-table-cell>{$t.formatDate(signal.openedDate, 'medium')}</md-table-cell>
                <md-table-cell numeric>
                  <span title={$t('signal.openFor', { days: signal.daysOpen })}>
                    {$t.formatNumber(signal.daysOpen)}
                  </span>
                </md-table-cell>
                <md-table-cell>{signal.owner}</md-table-cell>
              </md-table-row>
            {/each}
          </md-table-body>
        </md-table>
      </md-table-container>
    {/if}
  </Panel>
</Shell>
