<script setup lang="ts">
import type { Adjustment } from "@awc-ui/showcase-kit/design";
defineProps<{ adjustments: readonly Adjustment[] }>();
</script>
<template>
  <span
    v-if="adjustments.length"
    :data-adj="adjustments[adjustments.length - 1].kind"
    :data-v="String(adjustments[adjustments.length - 1].value)"
    ><ImageEffects :adjustments="adjustments.slice(0, -1)"
      ><slot /></ImageEffects></span
  ><slot v-else />
</template>
