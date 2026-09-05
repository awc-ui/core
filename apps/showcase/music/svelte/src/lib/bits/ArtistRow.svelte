<script lang="ts">
  import type { Artist } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Drill from '$lib/components/Drill.svelte';
  import Art from '$lib/bits/Art.svelte';
  export let artist: Artist;
  $: listeners = $t('music.label.listeners', {
    count: $t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
  });
</script>

<Drill linkClass="artist-row" href={route.artist(artist.handle)}>
  <Art art={artist.art} className="artist-row__art" />
  <span class="track-row__text">
    <span class="track-row__title">{artist.name}</span>
    <span class="track-row__meta">{listeners}</span>
  </span>
</Drill>
