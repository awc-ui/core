<script lang="ts">
  import { artistById, type Album } from '@awc-ui/showcase-kit/music';
  import { route } from '$lib/routes';
  import ShelfCard from '$lib/bits/ShelfCard.svelte';
  export let album: Album;
  $: meta = artistById(album.artistId)?.name ?? '';
</script>

<ShelfCard href={route.album(album.slug)} art={album.art} title={album.title} {meta} />
