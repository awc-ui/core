<!-- The ratio is known at build time and applied from a CLASS, because the
     deployed policy is `style-src-attr 'none'` and refuses inline styles. -->
<script lang="ts">
  import type { Media } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';
  export let media: Media;
  export let className: string | undefined = undefined;
  export let eager = false;
</script>

<img
  class={className}
  data-aspect={media.aspect}
  src={media.src}
  alt={$t(media.altKey)}
  loading={eager ? 'eager' : 'lazy'}
  decoding="async"
  draggable={false}
/>
