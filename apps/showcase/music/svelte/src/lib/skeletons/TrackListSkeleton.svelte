<script lang="ts">
  import TrackRowSkeleton from './TrackRowSkeleton.svelte';
  export let rows: number;
  export let albums = false;
</script>
<div class="track-list" data-albums={albums ? '' : undefined}>
  {#each Array(rows) as _, i (i)}<TrackRowSkeleton {albums} />{/each}
</div>
