<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import TrackListSkeleton from './TrackListSkeleton.svelte';
  import ShelfSkeleton from './ShelfSkeleton.svelte';
  import ArtistRowSkeleton from './ArtistRowSkeleton.svelte';
</script>
<div class="stack">
  <PanelSkeleton><TrackListSkeleton rows={6} albums /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton /></PanelSkeleton>
  <PanelSkeleton><ShelfSkeleton count={4} wide /></PanelSkeleton>
  <!-- ARTIST ROWS, not cards. `.stack` and not a bare div: the real list's 12px
       gap is 24px over four rows. -->
  <PanelSkeleton>
    <div class="stack">{#each Array(4) as _, i (i)}<ArtistRowSkeleton />{/each}</div>
  </PanelSkeleton>
</div>
