<!--
  A duration or a position, as mm:ss.

  `clock()` from the kit, NOT `Intl`: the digits stay Latin in every locale so
  the scrubber's readouts and the ruler's bar numbers cannot end up in two
  different numbering systems on one screen.
-->
<script setup lang="ts">
import { clock } from '@awc-ui/showcase-kit/music';
defineProps<{ seconds: number }>();
</script>

<template>
  <span class="tabular">{{ clock(seconds) }}</span>
</template>
