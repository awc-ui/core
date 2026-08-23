<!--
  A KPI tile: label, figure, its own eight-point sparkline, and a footnote.

  The sparkline's `valueFormatter` is a closure over the translator, so it is
  rebuilt whenever the locale changes — the `objectProps` action inside
  `Sparkline` re-assigns it, which is what keeps the tooltip in the page's
  language rather than the one it first rendered in.
-->
<script lang="ts">
  import Sparkline from '$lib/components/Sparkline.svelte';

  export let label: string;
  export let value: string;
  export let hint: string | undefined = undefined;
  /** Historical values for the sparkline, oldest first. */
  export let trend: number[] | undefined = undefined;
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  export let trendLabels: string[] | undefined = undefined;
  export let formatTrend: ((value: number | null) => string) | undefined = undefined;
  export let color = 'primary';
</script>

<md-card variant="filled" full-width>
  <div class="kpi">
    <p class="kpi__label">{label}</p>
    <p class="kpi__value">{value}</p>
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
    {#if hint || $$slots.badge}
      <div class="kpi__foot">
        <span>{hint ?? ''}</span>
        <slot name="badge" />
      </div>
    {/if}
  </div>
</md-card>
