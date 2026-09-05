<!--
  The card is the real `.shelf-card`, so the art keeps its aspect ratio and the
  grid its `auto-fill` columns. Only the art's height is stated — 165px square,
  measured — and the wide banner is half, because the art is 2:1.
-->
<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  export let count = 6;
  export let wide = false;
</script>
<div class="shelf">
  {#each Array(count) as _, i (i)}
    <div class="shelf-card">
      <SkelBar height={wide ? '83px' : '165px'} radius="12px" />
      <SkelLine w="72%" h={20} />
      <SkelLine w="46%" h={16} />
    </div>
  {/each}
</div>
