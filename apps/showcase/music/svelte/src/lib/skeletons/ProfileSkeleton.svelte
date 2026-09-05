<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import TrackListSkeleton from './TrackListSkeleton.svelte';
  import ShelfSkeleton from './ShelfSkeleton.svelte';
  import ProjectListSkeleton from './ProjectListSkeleton.svelte';
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
</script>
<div class="stack">
  <PanelSkeleton head={false}>
    <div class="release-head">
      <SkelBar width="200px" height="200px" radius="16px" />
      <div class="stack">
        <SkelLine w="220px" h={28} />
        <SkelLine w="140px" h={16} />
        <div class="row">
          {#each Array(4) as _, i (i)}
            <div class="track-row__text"><SkelLine w="70px" h={16} /><SkelLine w="46px" h={20} /></div>
          {/each}
        </div>
      </div>
    </div>
  </PanelSkeleton>

  <PanelSkeleton>
    <div class="stack">
      {#each Array(6) as _, i (i)}
        <div class="queue-row">
          <SkelLine w="16px" h={14} />
          <div class="track-row__text"><SkelLine w="26%" h={20} /><SkelLine w="16%" h={16} /></div>
        </div>
      {/each}
    </div>
  </PanelSkeleton>

  <PanelSkeleton><TrackListSkeleton rows={6} albums /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton count={5} wide /></PanelSkeleton>
  <PanelSkeleton><ProjectListSkeleton count={4} /></PanelSkeleton>
</div>
