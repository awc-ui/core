<!-- The 56px square is the date block, the one element on that screen a reader
     navigates by — so the one the placeholder most needs to promise. -->
<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
</script>

{#each [2, 3, 3] as count}
  <div class="skel-card">
    <SkelLine w="22%" h={16} />
    <div class="event-list" style="margin-block-start: 12px">
      {#each Array(count) as _}
        <div class="event-row">
          <SkelBar width="56px" height="58px" radius="12px" />
          <div class="stack" style="gap: 6px">
            <SkelLine w="46%" h={15} />
            <SkelLine w="34%" h={12} />
            <SkelLine w="40%" h={12} />
            <SkelBar width="104px" height="30px" radius="9999px" />
          </div>
          <div class="row" style="gap: 4px">
            {#each Array(3) as _}
              <SkelCircle size={32} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/each}
