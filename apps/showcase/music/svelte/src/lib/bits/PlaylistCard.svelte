<script lang="ts">
  import type { Playlist } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import ShelfCard from '$lib/bits/ShelfCard.svelte';
  export let playlist: Playlist;
  $: meta = $t('music.count.tracks', { count: $t.formatNumber(playlist.trackIds.length) });
</script>

<ShelfCard href={route.library()} art={playlist.art} title={playlist.title} {meta} />
