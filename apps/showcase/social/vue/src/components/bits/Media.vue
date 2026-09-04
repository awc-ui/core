<!--
  One picture, in a box whose height is reserved before it decodes.

  THIS IS THE WHOLE REASON THIS COMPONENT EXISTS. A feed that lets images size
  themselves reflows every post below the one that just arrived — the single
  most recognisable failure of a photo feed. The aspect ratio is known at build
  time, travels on the record, and is applied from a CLASS (`data-aspect`)
  rather than an inline style, because `style-src-attr 'none'` refuses the
  latter outright.

  `loading` and `decoding` are set for the same reason: a grid of forty images
  that all decode synchronously blocks the main thread on first paint.
-->
<script setup lang="ts">
import type { Media } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

withDefaults(defineProps<{ media: Media; className?: string; eager?: boolean }>(), {
  eager: false,
});
const t = useT();
</script>

<template>
  <img
    :class="className ? `media ${className}` : 'media'"
    :data-aspect="media.aspect"
    :src="media.src"
    :alt="t(media.altKey)"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    :draggable="false"
  />
</template>
