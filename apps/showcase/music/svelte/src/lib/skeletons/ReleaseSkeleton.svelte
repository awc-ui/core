<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import TrackListSkeleton from './TrackListSkeleton.svelte';
  import ShelfSkeleton from './ShelfSkeleton.svelte';
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
</script>
<div class="stack">
  <PanelSkeleton head={false}>
    <div class="release-head">
      <SkelBar width="200px" height="200px" radius="16px" />
      <div class="stack">
        <SkelLine w="260px" h={28} />
        <SkelLine w="180px" h={16} />
        <SkelLine w="120px" h={16} />
        <SkelBar width="140px" height="40px" radius="20px" />
      </div>
    </div>
  </PanelSkeleton>
  <PanelSkeleton><TrackListSkeleton rows={3} /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton count={2} /></PanelSkeleton>
</div>
