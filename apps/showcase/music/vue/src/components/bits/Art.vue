<!--
  Cover art.

  `altKey` is mandatory on every `Artwork` in the fixture and this is the only
  place an `<img>` is written, so there is exactly one function that could
  forget to resolve it. Generated abstract artwork is not self-explanatory the
  way a photograph is, which is why the rule exists.
-->
<script setup lang="ts">
import type { Artwork } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ art: Artwork; className?: string; eager?: boolean }>();
const t = useT();
</script>

<template>
  <img
    :class="props.className"
    :src="props.art.src"
    :alt="t(props.art.altKey)"
    :loading="props.eager ? 'eager' : 'lazy'"
    decoding="async"
    :draggable="false"
  />
</template>
