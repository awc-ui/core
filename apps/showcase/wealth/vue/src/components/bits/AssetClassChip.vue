<!--
  Filled and tonal, driven by a ROLE NAME.

  An asset class is a category, not a health state — equity is not `success` —
  but `assetClassRole` names the same palette entries the chart uses, and a
  role name is what buys the whole family: `color="primary"` gives the chip a
  container AND a legible label on it, which is what makes a filled chip
  possible at all. The donut slice and the chip stay the same hue, one tonal
  and one full strength.

  `cash` resolves to `undefined` and takes the neutral surface treatment — see
  the note on `assetClassRole` in the kit for why it has no role of its own.
-->
<script setup lang="ts">
import { assetClassRole, type AssetClass } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ assetClass: AssetClass }>();

const t = useT();
</script>

<template>
  <md-chip
    variant="assist"
    appearance="filled"
    :color="assetClassRole[assetClass]"
    :label="t(`wealth.assetClass.${assetClass}`)"
  ></md-chip>
</template>
