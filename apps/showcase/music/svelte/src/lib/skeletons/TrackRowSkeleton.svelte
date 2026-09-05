<!--
  A track row in the REAL row's grid, so the columns are the screen's own.
  MEASURED: title 20, artist 16, album 16, duration 16, buttons 40, row 56.
-->
<script lang="ts">
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
  export let albums = false;
</script>

<div class="track-row">
  <SkelLine w="100%" h={12} />
  <div class="track-row__text">
    <SkelLine w="54%" h={20} />
    <SkelLine w="32%" h={16} />
  </div>
  {#if albums}<SkelLine w="46%" h={16} />{/if}
  <SkelLine w="32px" h={16} />
  <div class="row"><SkelCircle size={40} /><SkelCircle size={40} /></div>
</div>
