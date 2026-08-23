<!-- The severity, as a chip. The dot that goes with it leads the row. -->
<script lang="ts">
  import Chips from './Chips.svelte';

  export let severity: string;
</script>

<Chips kind="severity" value={severity} />
