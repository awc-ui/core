<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import TrackListSkeleton from './TrackListSkeleton.svelte';
  import ShelfSkeleton from './ShelfSkeleton.svelte';
</script>
<div class="stack">
  <PanelSkeleton><TrackListSkeleton rows={12} albums /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton count={5} wide /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton count={3} wide /></PanelSkeleton>
  <!-- Sixteen, because the library lists every album. -->
  <PanelSkeleton><ShelfSkeleton count={16} /></PanelSkeleton>
</div>
