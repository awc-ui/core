<!--
  A KPI tile: label, figure, its own sparkline, and a footnote.

  The primary figure goes in the `value` SLOT (it is usually a `<Money>` or
  `<Percent>`, not a string); a plain string may use the `value` prop instead.
  `trailing` is a small node at the end of the foot row — a `<Count>` chip, a
  dot. NOT a bare `md-badge`: a badge anchors absolutely against the nearest
  positioned ancestor and translates itself past that ancestor's corner, so
  dropped in here it lands on the card's top-right corner and is sliced in half
  by the card's own `overflow: hidden`.

  The sparkline's `valueFormatter` is a closure over the translator, so it is
  rebuilt whenever the locale changes — the `objectProps` action inside
  `Sparkline` re-assigns it, which is what keeps the tooltip in the page's
  language rather than the one it first rendered in.
-->
<script lang="ts">
  import Sparkline from '$lib/components/Sparkline.svelte';

  export let label: string;
  /** A plain-string figure. For formatted nodes, fill the `value` slot instead. */
  export let value: string | undefined = undefined;
  export let hint: string | undefined = undefined;
  /** Historical values for the sparkline, oldest first. */
  export let trend: number[] | undefined = undefined;
  /** Tooltip x labels — month ends, already formatted. */
  export let trendLabels: string[] | undefined = undefined;
  export let formatTrend: ((value: number | null) => string) | undefined = undefined;
  /** One of the md colour roles. Use a `status.ts` map, not a guess. */
  export let color = 'primary';
</script>

<md-card variant="filled" full-width>
  <div class="kpi">
    <p class="kpi__label">{label}</p>
    <p class="kpi__value"><slot name="value">{value ?? ''}</slot></p>
    {#if trend && trend.length > 1}
      <div class="kpi__spark">
        <Sparkline
          data={trend}
          labels={trendLabels}
          valueFormatter={formatTrend}
          variant="area"
          {color}
          curve="monotone"
          show-marks="extremes"
          height="34px"
        />
      </div>
    {/if}
    {#if hint || $$slots.hint || $$slots.trailing}
      <div class="kpi__foot">
        <span><slot name="hint">{hint ?? ''}</slot></span>
        <slot name="trailing" />
      </div>
    {/if}
  </div>
</md-card>
