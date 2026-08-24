<!-- A `dt`/`dd` pair inside a `.dl` grid. -->
<script lang="ts">
  export let label: string;
</script>

<div>
  <dt>{label}</dt>
  <dd><slot /></dd>
</div>
