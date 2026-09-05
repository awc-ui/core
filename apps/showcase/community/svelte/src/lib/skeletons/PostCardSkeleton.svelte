<!-- `media` is a real property of the post it stands for: roughly a third of
     this feed carries pictures, so a placeholder where every card had one would
     promise a feed that does not exist. -->
<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
  export let media = false;
  export let lines = 3;
</script>

<div class="skel-card">
  <div class="row" style="align-items: center">
    <SkelCircle size={40} />
    <div class="stack" style="flex: 1; gap: 6px">
      <SkelLine w="38%" h={15} />
      <SkelLine w="22%" h={12} />
    </div>
  </div>
  <div class="stack" style="gap: 8px; margin-block-start: 12px">
    {#each Array(lines) as _, i}
      <SkelLine w={i === lines - 1 ? '64%' : '100%'} />
    {/each}
  </div>
  {#if media}<SkelBar width="100%" height="240px" radius="12px" />{/if}
  <div class="row" style="margin-block-start: 12px; gap: 24px">
    {#each Array(3) as _}
      <SkelBar width="84px" height="20px" radius="4px" />
    {/each}
  </div>
</div>
