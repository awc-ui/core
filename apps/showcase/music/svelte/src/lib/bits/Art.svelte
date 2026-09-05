<!--
  Cover art. `altKey` is mandatory on every `Artwork` and this is the only place
  an `<img>` is written, so there is exactly one function that could forget to
  resolve it — generated artwork is not self-explanatory the way a photo is.
-->
<script lang="ts">
  import type { Artwork } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  export let art: Artwork;
  export let className: string | undefined = undefined;
  export let eager = false;
</script>

<img
  class={className}
  src={art.src}
  alt={$t(art.altKey)}
  loading={eager ? 'eager' : 'lazy'}
  decoding="async"
  draggable="false"
/>
