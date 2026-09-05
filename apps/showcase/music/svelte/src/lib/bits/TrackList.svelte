<!--
  The COLUMN COUNT lives on the list, not the row: rows in one list must all use
  the same grid template or the durations form a ragged edge.
-->
<script lang="ts">
  import type { Track } from '@awc-ui/showcase-kit/music';
  import TrackRow from '$lib/bits/TrackRow.svelte';

  export let tracks: readonly Track[];
  export let numbered = false;
  export let showArtist = true;
  export let showAlbum = false;
</script>

<div class="track-list" data-albums={showAlbum ? '' : undefined}>
  {#each tracks as track, at (track.id)}
    <TrackRow {track} index={numbered ? track.trackNumber : at + 1} {showArtist} {showAlbum} />
  {/each}
</div>
