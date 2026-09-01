<!--
  What sits behind one holding.

  The fixture books a position as a single lot, so this is that lot: what was
  paid, what it is worth in its own currency before the FX, when it was opened,
  and where the instrument has been over twelve months. The household name is a
  drill, because the next question after "what is this?" is "whose is it?".

  The panel runs the full width of the row: the facts sit in `.dl`, an auto-fit
  grid that spreads them across whatever width it is given, and the
  twelve-month series spans the whole panel beneath them. A twelve-point series
  stretched this wide is a flatter line than a narrow one would be — that is
  the trade the full width buys, and it is deliberate.
-->
<script lang="ts">
  import {
    getInstrumentById,
    getPortfolioById,
    plColor,
    type Instrument,
    type Position,
  } from '@awc-ui/showcase-kit/wealth';
  import { t, type T } from '$lib/showcase';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Signed from '$lib/bits/Signed.svelte';

  export let position: Position;

  $: instrument = getInstrumentById(position.instrumentId);
  $: mandate = getPortfolioById(position.portfolioId);

  /*
   * Closures over the translator, rebuilt when the locale changes — the
   * `objectProps` action inside `Sparkline` re-assigns them, which is what
   * keeps the tooltip in the page's language rather than the one it first
   * rendered in. (The React build keys the same re-assignment on
   * `state.locale`; here the `$t` dependency does the keying.)
   */
  function priceLabels(picked: Instrument, translator: T): string[] {
    return picked.priceSeriesDates.map((date) => translator.formatDate(date, 'monthYear'));
  }

  function priceFormatter(picked: Instrument, translator: T): (value: number | null) => string {
    return (value) =>
      value === null
        ? translator('wealth.common.na')
        : translator.formatCurrency(value, {
            currency: picked.currency,
            maximumFractionDigits: 2,
          });
  }
</script>

<div
  style="
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-lg, 24px);
    inline-size: 100%;
  "
>
  <dl class="dl">
    <Fact label={$t('wealth.table.quantity')}>
      <Num value={position.quantity} />
    </Fact>
    <Fact label={$t('wealth.table.costPerUnit')}>
      <Money value={position.costPerUnit} currency={position.currency} digits={2} />
    </Fact>
    <Fact label={$t('wealth.table.costBasis')}>
      <Money value={position.costBasisEur} />
    </Fact>
    <Fact label={$t('wealth.table.marketValue')}>
      <!-- The LOCAL amount here, beside the EUR one in the row above it —
           this is the pair a currency question is actually asked of. -->
      <Money value={position.marketValue} currency={position.currency} />
    </Fact>
    <Fact label={$t('wealth.table.opened')}>
      <DateText value={position.openedDate} />
    </Fact>
    <Fact label={$t('wealth.table.sector')}>{$t(position.sectorKey)}</Fact>
    <Fact label={$t('wealth.table.region')}>{$t(position.regionKey)}</Fact>
    {#if instrument}
      <Fact label={$t('wealth.table.twelveMonth')}>
        <Signed value={instrument.twelveMonthReturn} kind="percent" />
      </Fact>
    {/if}
    {#if mandate}
      <!-- The mandate reference is a proper noun, and it is the thing an
           operations question is asked with — "which book is this in?". -->
      <Fact label={$t('wealth.panel.mandate')}>{mandate.reference}</Fact>
    {/if}
  </dl>

  {#if instrument && instrument.priceSeries.length > 1}
    <div style="inline-size: 100%">
      <Sparkline
        data={instrument.priceSeries}
        labels={priceLabels(instrument, $t)}
        valueFormatter={priceFormatter(instrument, $t)}
        variant="area"
        curve="monotone"
        color={plColor(instrument.twelveMonthReturn)}
        show-marks="extremes"
        height="56px"
      />
    </div>
  {/if}
</div>
