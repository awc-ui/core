<!--
  The limit price, mounted only for the order types that carry one.

  Its own component, as in the React source, because it comes and goes: the
  seeded write must read the CURRENT limit price at the moment the field
  mounts, and a fresh component instance's init-time `objectProps` application
  is what guarantees that. `value` is seeded rather than controlled — see the
  note at the top of `TradeTicket.svelte` about `md-number-field` treating a
  programmatic write as a commit.

  Both value events, for the reason given beside the quantity field: typing
  reports through `mdInput`, and the clamp that a commit applies arrives only
  as `mdChange`.
-->
<script lang="ts">
  import { BASE_CURRENCY, type Instrument } from '@awc-ui/showcase-kit/wealth';
  import { objectProps } from '$lib/elements';
  import { t } from '$lib/showcase';
  import { tx } from './trade-strings';

  export let seed: number;
  export let value: number | null;
  export let instrument: Instrument | undefined;
  export let locale: string;
  export let onChange: (value: number | null) => void;

  /*
   * `propsFor` reads `value` through a call the compiler does not trace, so
   * `seed` is the ONLY dependency — the app writes into the field on mount and
   * on a seed bump, never while the user is typing.
   */
  $: fieldProps = propsFor(seed);
  function propsFor(_seed: number): { value: number | null } {
    return { value };
  }

  function onValue(event: Event) {
    onChange((event as CustomEvent<{ value: number | null }>).detail.value);
  }
</script>

<!--
  `format-options` takes a JSON attribute as well as the object property, and
  the attribute form re-renders with the instrument — so the field is always
  denominated in the security's own currency rather than the mandate's
  reporting currency.
-->
<md-number-field
  use:objectProps={fieldProps}
  name="limit"
  variant="outlined"
  required
  label={$t('wealth.table.limitPrice')}
  {locale}
  min={0}
  step={0.01}
  small-step={0.01}
  large-step={1}
  increment-label={$t('wealth.action.next')}
  decrement-label={$t('wealth.action.back')}
  value-missing-label={$tx('wealth.trade.needLimit')}
  format-options={JSON.stringify({
    style: 'currency',
    currency: instrument?.currency ?? BASE_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}
  supporting-text={instrument
    ? `${$t('wealth.table.price')} · ${$t.formatCurrency(instrument.price, {
        currency: instrument.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : ''}
  reserve-supporting-space
  on:mdInput={onValue}
  on:mdChange={onValue}
></md-number-field>
