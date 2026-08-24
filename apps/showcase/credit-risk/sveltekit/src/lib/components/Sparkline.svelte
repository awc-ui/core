<script lang="ts">
  import { objectProps } from '$lib/elements';

  export let data: (number | null)[] = [];
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  export let labels: string[] | undefined = undefined;
  export let valueFormatter: ((value: number | null) => string) | undefined = undefined;

  $: props = { data, labels, valueFormatter };
</script>

<md-sparkline use:objectProps={props} {...$$restProps}></md-sparkline>
