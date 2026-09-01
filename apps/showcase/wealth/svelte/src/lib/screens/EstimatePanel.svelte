<!--
  The live readout beside the ticket.

  Its own component, mirroring the React source — there it had to be top-level
  so the sparkline was not remounted on every keystroke; here the split simply
  keeps the file tree comparable across the ports.

  The sparkline's `valueFormatter` closes over the translator, so it is rebuilt
  whenever the locale changes — the `objectProps` action inside `Sparkline`
  re-assigns it, which is what keeps the tooltip in the page's language.
-->
<script lang="ts">
  import {
    BASE_CURRENCY,
    type Instrument,
    type OrderEstimate,
    type Portfolio,
  } from '@awc-ui/showcase-kit/wealth';
  import { t, type T } from '$lib/showcase';
  import Panel from '$lib/components/Panel.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import { tx } from './trade-strings';

  export let estimate: OrderEstimate | null;
  export let instrument: Instrument | undefined;
  export let portfolio: Portfolio | undefined;
  export let typedQuantity: number;

  /* Twelve month-end closes, straight off the instrument. Labels and formatter
     are derived reactively so a locale switch re-formats both. */
  $: sparkLabels = instrument
    ? instrument.priceSeriesDates.map((date) => $t.formatDate(date, 'monthYear'))
    : undefined;

  $: sparkFormatter = formatterFor(instrument, $t);
  function formatterFor(inst: Instrument | undefined, translate: T) {
    if (!inst) return undefined;
    return (value: number | null) =>
      value === null
        ? translate('wealth.common.na')
        : translate.formatCurrency(value, {
            currency: inst.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
  }
</script>

{#if !estimate || !instrument}
  <Panel title={$tx('wealth.trade.estimate')}>
    <p class="muted">{$tx('wealth.trade.estimateEmpty')}</p>
  </Panel>
{:else}
  <Panel title={$tx('wealth.trade.estimate')} subtitle={instrument.name}>
    <div class="stack">
      <div>
        <p class="estimate__value">
          <Money
            value={estimate.estimatedValue}
            currency={estimate.currency}
            digits={estimate.currency === BASE_CURRENCY ? 0 : 2}
          />
        </p>
        {#if estimate.currency !== BASE_CURRENCY}
          <p class="estimate__sub">
            <Money value={estimate.estimatedValueEur} /> · {BASE_CURRENCY}
          </p>
        {/if}
      </div>

      <!--
        The wrapper is what makes `data`, `labels` and `valueFormatter` land as
        JS properties; an `md-sparkline` written out here would stringify all
        three.
      -->
      <div class="estimate__spark">
        <Sparkline
          data={instrument.priceSeries}
          labels={sparkLabels}
          valueFormatter={sparkFormatter}
          variant="line"
          color="primary"
          curve="monotone"
          show-marks="extremes"
          height="56px"
        />
      </div>

      <dl class="dl">
        <Fact label={$t('wealth.table.price')}>
          <Money value={estimate.referencePrice} currency={estimate.currency} digits={2} />
        </Fact>
        <Fact label={$t('wealth.table.quantity')}>
          <Num value={estimate.effectiveQuantity} />
        </Fact>
        <Fact label={$t('wealth.table.weight')}>
          <Signed value={estimate.weightImpact} kind="percent" />
        </Fact>
        <Fact label={$t('wealth.kpi.cash')}>
          {#if portfolio}
            <Money value={portfolio.cashBalance} compact />
          {:else}
            {$t('wealth.common.na')}
          {/if}
        </Fact>
      </dl>

      <p class="estimate__sub">
        {$tx('wealth.trade.lots', {
          lots: $t.formatNumber(estimate.lots, { maximumFractionDigits: 0 }),
          size: $t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
        })}
      </p>

      <!--
        The lot rule, made visible. `orderEstimate` rounds DOWN to a whole
        number of lots, so a typed 1,750 of a bond that trades in 1,000 becomes
        1,000 — and a reader who is not told that reads the estimate as wrong
        rather than as rounded.
      -->
      {#if typedQuantity !== estimate.effectiveQuantity}
        <p class="estimate__sub">
          {$tx('wealth.trade.snapped', {
            typed: $t.formatNumber(typedQuantity, { maximumFractionDigits: 0 }),
          })}
        </p>
      {/if}

      {#if estimate.exceedsCash}
        <p class="pl-down">{$t('wealth.order.exceedsCash')}</p>
      {/if}
    </div>
  </Panel>
{/if}
