<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
  export let rows = 3;
  export let avatars = false;
</script>

<div class="skel-card">
  <SkelLine w="46%" h={16} />
  <div class="stack" style="gap: 12px; margin-block-start: 8px">
    {#each Array(rows) as _, i}
      <div class="row" style="gap: 8px; align-items: center">
        {#if avatars}
          <SkelCircle size={28} />
        {:else}
          <SkelBar width="20px" height="20px" radius="4px" />
        {/if}
        <SkelLine w={`${58 + ((i * 13) % 26)}%`} h={13} />
      </div>
    {/each}
  </div>
</div>
