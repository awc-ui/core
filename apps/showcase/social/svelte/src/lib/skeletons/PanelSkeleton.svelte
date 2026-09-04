<!-- A panel's shape: a head, then one block the size the real content will be. -->
<script lang="ts">
  export let height: string | undefined = undefined;
  export let lines = 0;
</script>

<div class="skel-card panel">
  <div class="panel__inner">
    <div class="panel__head">
      <div class="skel" style="block-size: 20px; inline-size: 140px" />
      <div class="skel" style="block-size: 20px; inline-size: 60px" />
    </div>
    {#if height}
      <div class="skel" style="block-size: {height}; inline-size: 100%" />
    {/if}
    {#if lines > 0}
      {#each Array.from({ length: lines }) as _, i (i)}
        <div
          class="skel"
          style="block-size: 16px; inline-size: {i === lines - 1 ? '60%' : '100%'}"
        />
      {/each}
    {/if}
  </div>
</div>
