<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
</script>

{#each [6, 4] as count}
  <div class="skel-card">
    <SkelLine w="24%" h={16} />
    <div class="card-grid" style="margin-block-start: 12px">
      {#each Array(count) as _}
        <div class="stack" style="gap: 8px">
          <SkelBar width="100%" height="120px" radius="12px" />
          <SkelLine w="62%" h={17} />
          <div class="row" style="gap: 8px">
            <SkelBar width="72px" height="28px" radius="9999px" />
            <SkelBar width="84px" height="28px" radius="9999px" />
          </div>
          <SkelLine w="100%" h={12} />
          <SkelLine w="80%" h={12} />
          <SkelBar width="100%" height="32px" radius="9999px" />
        </div>
      {/each}
    </div>
  </div>
{/each}
