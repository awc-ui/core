<!--
  One picture, in a box whose height is reserved before it decodes.

  THIS IS THE WHOLE REASON THIS COMPONENT EXISTS. A feed that lets images size
  themselves reflows every post below the one that just arrived — the single
  most recognisable failure of a photo feed. The aspect ratio is known at build
  time, travels on the record, and is applied from a CLASS (`data-aspect`)
  rather than an inline style, because `style-src-attr 'none'` refuses the
  latter outright.
-->
<script lang="ts">
  import type { Media } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let media: Media;
  export let className: string | undefined = undefined;
  export let eager = false;
</script>

<img
  class={className ? `media ${className}` : 'media'}
  data-aspect={media.aspect}
  src={media.src}
  alt={$t(media.altKey)}
  loading={eager ? 'eager' : 'lazy'}
  decoding="async"
  draggable={false}
/>
