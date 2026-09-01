<!--
  Buy or sell.

  Deliberately NOT green/red: `success` and `error` mean "went well" and "went
  wrong" everywhere else in this console, and a sell is neither. The mapping is
  in the kit and the reasoning with it.
-->
<script setup lang="ts">
import { orderSideColor, type OrderSide } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ side: OrderSide }>();
</script>

<template>
  <StateChip :label-key="`wealth.orderSide.${side}`" :color="orderSideColor[side]" />
</template>
