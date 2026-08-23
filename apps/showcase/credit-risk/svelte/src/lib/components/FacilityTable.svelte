<!--
  Facilities booked to one counterparty.

  CURRENCY IS THE TRAP HERE. `commitment` and `drawn` are denominated in the
  facility's OWN currency; `commitmentEur`/`drawnEur` are the converted twins and
  `ead` is always EUR. The commitment column therefore formats with
  `{ currency: facility.currency }` and shows the EUR equivalent underneath,
  while the EAD column formats in the base currency with no override. Mixing the
  two would quietly report a RON line as if it were euros.
-->
<script lang="ts">
  import { getFacilitiesFor, type Facility } from '@awc-ui/showcase-kit/data';
  import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Drill from './Drill.svelte';
  import EmptyState from './EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';

  export let counterpartyId: string;

  $: rows = getFacilitiesFor(counterpartyId) as Facility[];
  $: head = [
    { label: $t('table.facility') },
    { label: $t('table.type') },
    { label: $t('table.currency') },
    { label: $t('table.commitment'), numeric: true },
    { label: $t('table.ead'), numeric: true },
    { label: $t('table.utilisation'), numeric: true },
    { label: $t('table.margin'), numeric: true },
    { label: $t('table.maturity') },
    { label: $t('table.status') },
  ];
</script>

{#if rows.length === 0}
  <EmptyState message={$t('empty.facilities')} />
{:else}
  <md-table-container variant="outlined">
    <!--
      md-table ratchets its height by default (keep-height) so paging cannot make
      the page jump. That baseline is measured once and never recomputed, so a
      density change strands the taller height and leaves dead space below the
      rows — 176px at rung -4. Nothing pages here, so the ratchet earns little;
      live density switching matters more.
    -->
    <md-table
      label={$t('screen.facilities.title')}
      column-template={TABLES.facilities.columns}
      min-width={TABLES.facilities.minWidth}
      keep-height="false"
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
        {#each rows as facility (facility.id)}
          <md-table-row value={facility.id}>
            <md-table-cell>
              <Drill href={route.facility(facility.id)}>{facility.id}</Drill>
            </md-table-cell>
            <md-table-cell>{$t(facility.typeKey)}</md-table-cell>
            <md-table-cell>{facility.currency}</md-table-cell>
            <md-table-cell numeric>
              <span class="num">
                {$t.formatCurrency(facility.commitment, {
                  currency: facility.currency,
                  notation: 'compact',
                })}
              </span>
              {#if facility.currency !== 'EUR'}
                <br />
                <span class="muted num" style="font: var(--md-sys-typescale-label-small-font)">
                  {$t.formatCurrency(facility.commitmentEur, { notation: 'compact' })}
                </span>
              {/if}
            </md-table-cell>
            <md-table-cell numeric>{$t.formatCurrency(facility.ead, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              {$t.formatPercent(facility.utilisation, { maximumFractionDigits: 0 })}
            </md-table-cell>
            <md-table-cell numeric>
              {$t('unit.bps', { value: $t.formatNumber(facility.marginBps) })}
            </md-table-cell>
            <md-table-cell>{$t.formatDate(facility.maturityDate, 'medium')}</md-table-cell>
            <md-table-cell>
              <Chips kind="facility" value={facility.status} />
            </md-table-cell>
          </md-table-row>
        {/each}
      </md-table-body>
    </md-table>
  </md-table-container>
{/if}
