<!--
  One picture, in a box whose height is reserved before it decodes.

  A feed that lets images size themselves reflows every post below the one that
  just arrived. The ratio is known at build time, travels on the record, and is
  applied from a CLASS (`data-aspect`) rather than an inline style, because the
  deployed policy is `style-src-attr 'none'` and would refuse the latter.
-->
<script setup lang="ts">
import type { Media } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ media: Media; className?: string; eager?: boolean }>(),
  { eager: false },
);
const t = useT();
</script>

<template>
  <img
    :class="props.className"
    :data-aspect="props.media.aspect"
    :src="props.media.src"
    :alt="t(props.media.altKey)"
    :loading="props.eager ? 'eager' : 'lazy'"
    decoding="async"
    :draggable="false"
  />
</template>
