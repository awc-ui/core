<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
</script>

{#each [4, 2, 6] as count}
  <div class="skel-card">
    <SkelLine w="28%" h={16} />
    <div class="person-grid" style="margin-block-start: 12px">
      {#each Array(count) as _}
        <div class="row" style="align-items: flex-start; gap: 12px">
          <SkelCircle size={40} />
          <div class="stack" style="flex: 1; gap: 6px">
            <SkelLine w="72%" h={15} />
            <SkelLine w="52%" h={12} />
            <SkelBar height="32px" radius="9999px" />
          </div>
        </div>
      {/each}
    </div>
  </div>
{/each}
