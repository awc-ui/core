<!--
  The shape a screen gets when it has not described its own.

  IT IS NOT THE COMMON CASE, and that is the point. Every real screen passes
  its own measured `skeleton` slot to `<Screen>`, because "a KPI row and two
  panels" is none of their real layouts. What is left on this fallback is the
  not-found screen and the household guard — pages with nothing much to stand
  in for. Treat a screen reaching this as one that has not been measured yet.
-->
<script lang="ts">
  import KpiSkeleton from './KpiSkeleton.svelte';
  import PanelSkeleton from './PanelSkeleton.svelte';

  export let kpis = 4;
  export let panels = 2;
  export let label: string | undefined = undefined;
</script>

{#if kpis > 0}
  <section class="kpi-grid">
    {#each Array.from({ length: kpis }) as _, i (i)}
      <KpiSkeleton announce={i === 0} {label} />
    {/each}
  </section>
{/if}

<section class="grid-2">
  {#each Array.from({ length: panels }) as _, i (i)}
    <PanelSkeleton lines={8} />
  {/each}
</section>
