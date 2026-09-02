<!--
  A vault's progress towards its goal.

  Always `primary`: saving towards something is not a state that can go wrong,
  so there is no colour to earn. A vault at 12% is not a problem.
-->
<script lang="ts">
  import RatioMeter from './RatioMeter.svelte';

  export let fraction: number;
  export let label: string;
</script>

<RatioMeter {label} {fraction} color="primary" thickness={8} />
