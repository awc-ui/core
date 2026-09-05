<script lang="ts">
  import type { Artwork } from '@awc-ui/showcase-kit/music';
  import Drill from '$lib/components/Drill.svelte';
  import Art from '$lib/bits/Art.svelte';
  export let href: string;
  export let art: Artwork;
  export let title: string;
  export let meta: string | undefined = undefined;
</script>

<Drill linkClass="shelf-card" {href}>
  <Art {art} className={`shelf-card__art${art.shape === 'wide' ? ' shelf-card__art--wide' : ''}`} />
  <span class="shelf-card__title">{title}</span>
  {#if meta}<span class="shelf-card__meta">{meta}</span>{/if}
</Drill>
