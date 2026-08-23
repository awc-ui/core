<!--
  Screen 4 — the facility, and the bottom of the drill path.

  Terms, then the three things a credit officer checks after them: covenant
  headroom, collateral net of haircuts, and the balance profile to maturity.

  COLLATERAL. `valuation` is in the collateral's own currency, `valuationEur` is
  the converted twin and `netValue` — always EUR — is already
  `valuationEur × (1 − haircut)`. The table shows all three so the haircut is
  visible rather than implied, and the panel header compares total net value
  against the facility's EAD, which is the coverage ratio that actually matters.

  SCHEDULE. See `drawdownSchedule()` in `@awc-ui/showcase-kit/credit-risk`: term
  loans amortise straight-line to maturity, committed revolving lines hold and
  retire in one step. Both shapes come out of the fixture's own dates, so the
  table is a projection of the data rather than an invention on top of it.
-->
<script lang="ts">
  import {
    BASE_CURRENCY,
    getCollateralFor,
    getCounterpartyById,
    getCovenantsFor,
    getFacilityById,
    type Facility,
  } from '@awc-ui/showcase-kit/data';
  import { drawdownSchedule, TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Shell from '$lib/components/Shell.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import CovenantMeter from '$lib/bits/CovenantMeter.svelte';
  import RatioMeter from '$lib/bits/RatioMeter.svelte';

  export let facilityId: string;

  $: facility = getFacilityById(facilityId) as Facility;
  $: counterparty = getCounterpartyById(facility.counterpartyId);
  $: covenants = getCovenantsFor(facility.id);
  $: collateral = getCollateralFor(facility.id);
  $: schedule = drawdownSchedule(facility);
  $: netCollateral = collateral.reduce((sum, item) => sum + item.netValue, 0);
  $: coverage = facility.ead > 0 ? netCollateral / facility.ead : 0;
  $: local = { currency: facility.currency } as const;

  $: crumbs = [
    { label: $t('nav.overview'), href: route.overview() },
    ...(counterparty
      ? [
          { label: $t(`sector.${counterparty.sectorId}`), href: route.sector(counterparty.sectorId) },
          { label: counterparty.legalName, href: route.counterparty(counterparty.id) },
        ]
      : []),
    { label: facility.id },
  ];
</script>

<Shell title="{facility.id} · {$t(facility.typeKey)}" subtitle={facility.counterpartyName} {crumbs}>
  <svelte:fragment slot="aside">
    <Chips kind="facility" value={facility.status} />
    <md-chip
      variant="assist"
      appearance="outlined"
      icon={facility.secured ? 'lock' : 'lock_open'}
      label={facility.secured ? $t('common.secured') : $t('common.unsecured')}
    ></md-chip>
  </svelte:fragment>

  <section class="grid-2">
    <Panel title={$t('table.facility')} subtitle={$t(facility.typeKey)}>
      <dl class="dl dl--numeric">
        <Fact label={$t('table.currency')}>{facility.currency}</Fact>
        <Fact label={$t('table.commitment')}>
          {$t.formatCurrency(facility.commitment, { ...local, notation: 'compact' })}
        </Fact>
        <Fact label={$t('table.drawn')}>
          {$t.formatCurrency(facility.drawn, { ...local, notation: 'compact' })}
        </Fact>
        <Fact label={$t('table.undrawn')}>
          {$t.formatCurrency(facility.undrawn, { ...local, notation: 'compact' })}
        </Fact>
        <Fact label={$t('table.ead')}>{$t.formatCurrency(facility.ead, { notation: 'compact' })}</Fact>
        <Fact label={$t('table.ccf')}>
          {$t.formatPercent(facility.ccf, { maximumFractionDigits: 0 })}
        </Fact>
        <Fact label={$t('table.margin')}>
          {$t('unit.bps', { value: $t.formatNumber(facility.marginBps) })}
        </Fact>
        <Fact label={$t('table.maturity')}>{$t.formatDate(facility.maturityDate, 'long')}</Fact>
        <Fact label={$t('table.tenor')}>
          {$t('unit.months', { value: $t.formatNumber(facility.monthsToMaturity) })}
        </Fact>
      </dl>
      <RatioMeter
        label={$t('kpi.utilisation')}
        fraction={facility.utilisation}
        color={utilisationColor(facility.utilisation)}
      />
    </Panel>

    <Panel
      title={$t('screen.covenants.title')}
      subtitle={$t('screen.covenants.subtitle', {
        breaches: covenants.filter((c) => c.status === 'breach').length,
        watch: covenants.filter((c) => c.status === 'watch').length,
      })}
    >
      {#if covenants.length === 0}
        <EmptyState message={$t('empty.covenants')} />
      {:else}
        <div class="stack">
          {#each covenants as covenant (covenant.id)}
            <CovenantMeter {covenant} />
          {/each}
        </div>
      {/if}
    </Panel>
  </section>

  <Panel title={$t('screen.collateral.title')} subtitle={$t('screen.collateral.subtitle')}>
    <svelte:fragment slot="actions">
      {#if collateral.length > 0}
        <md-chip
          variant="assist"
          appearance="filled"
          color={coverage >= 1 ? 'success' : coverage >= 0.5 ? 'warning' : 'error'}
          label="{$t('kpi.collateralCoverage')} {$t.formatPercent(coverage, {
            maximumFractionDigits: 0,
          })}"
        ></md-chip>
      {/if}
    </svelte:fragment>

    {#if collateral.length === 0}
      <EmptyState message={$t('empty.collateral')} />
    {:else}
      <md-table-container variant="outlined">
        <md-table
          label={$t('screen.collateral.title')}
          column-template={TABLES.collateral.columns}
          min-width={TABLES.collateral.minWidth}
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{$t('table.collateral')}</md-table-cell>
              <md-table-cell head scope="col">{$t('table.currency')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('table.valuation')}</md-table-cell>
              <md-table-cell head scope="col" numeric>
                {$t('table.valuation')} ({BASE_CURRENCY})
              </md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('table.haircut')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('table.netValue')}</md-table-cell>
              <md-table-cell head scope="col">{$t('table.lastValuation')}</md-table-cell>
              <md-table-cell head scope="col">{$t('table.basis')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            {#each collateral as item (item.id)}
              <md-table-row value={item.id}>
                <md-table-cell>{$t(item.typeKey)}</md-table-cell>
                <md-table-cell>{item.currency}</md-table-cell>
                <md-table-cell numeric>
                  {$t.formatCurrency(item.valuation, {
                    currency: item.currency,
                    notation: 'compact',
                  })}
                </md-table-cell>
                <md-table-cell numeric>
                  {$t.formatCurrency(item.valuationEur, { notation: 'compact' })}
                </md-table-cell>
                <md-table-cell numeric>
                  {$t.formatPercent(item.haircutPct, { maximumFractionDigits: 0 })}
                </md-table-cell>
                <md-table-cell numeric>
                  {$t.formatCurrency(item.netValue, { notation: 'compact' })}
                </md-table-cell>
                <md-table-cell>{$t.formatDate(item.lastValuationDate, 'medium')}</md-table-cell>
                <md-table-cell>{$t(item.valuationBasisKey)}</md-table-cell>
              </md-table-row>
            {/each}
          </md-table-body>
          <md-table-foot>
            <md-table-row rowgroup="foot">
              <!-- head + scope="row" makes this a rowheader, which is what
                   associates the net-collateral figure below with the word
                   "Total". `scope` without `head` is inert. -->
              <md-table-cell head scope="row">{$t('common.total')}</md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell numeric>
                {$t.formatCurrency(netCollateral, { notation: 'compact' })}
              </md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
            </md-table-row>
          </md-table-foot>
        </md-table>
      </md-table-container>
    {/if}
  </Panel>

  <Panel
    title={$t('table.tenor')}
    subtitle={$t('unit.months', { value: $t.formatNumber(facility.monthsToMaturity) })}
  >
    <md-table-container variant="outlined">
      <md-table
        label={$t('table.tenor')}
        column-template={TABLES.schedule.columns}
        min-width={TABLES.schedule.minWidth}
        striped
      >
        <md-table-head>
          <md-table-row rowgroup="head">
            <md-table-cell head scope="col">{$t('table.quarter')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.commitment')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.drawn')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.undrawn')}</md-table-cell>
            <!-- No dictionary key for "movement in the drawn balance"; the delta
                 sign is composed onto the translated noun the same way
                 table.elDelta composes it in the dictionary itself. -->
            <md-table-cell head scope="col" numeric>Δ {$t('table.drawn')}</md-table-cell>
            <md-table-cell head scope="col" numeric>{$t('table.utilisation')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {#each schedule as row, index (row.quarter)}
            <md-table-row value={row.quarter}>
              <md-table-cell>{row.quarter}</md-table-cell>
              <md-table-cell numeric>
                {$t.formatCurrency(row.commitment, { ...local, notation: 'compact' })}
              </md-table-cell>
              <md-table-cell numeric>
                {$t.formatCurrency(row.drawn, { ...local, notation: 'compact' })}
              </md-table-cell>
              <md-table-cell numeric>
                {$t.formatCurrency(row.undrawn, { ...local, notation: 'compact' })}
              </md-table-cell>
              <md-table-cell numeric>
                <span
                  style={row.movement < 0
                    ? 'color: var(--md-sys-color-success)'
                    : row.movement > 0
                      ? 'color: var(--md-sys-color-error)'
                      : undefined}
                >
                  <!-- The opening row has nothing to move against, so it reads
                       n/a. A genuine zero movement in a later quarter is a real
                       number and is printed as one. Movements are money in the
                       facility's own currency, like the columns beside them — a
                       bare number here would read as euros. -->
                  {index === 0
                    ? $t('common.na')
                    : $t.formatCurrency(row.movement, { ...local, notation: 'compact' })}
                </span>
              </md-table-cell>
              <md-table-cell numeric>
                {$t.formatPercent(row.utilisation, { maximumFractionDigits: 0 })}
              </md-table-cell>
            </md-table-row>
          {/each}
        </md-table-body>
      </md-table>
    </md-table-container>
  </Panel>
</Shell>
