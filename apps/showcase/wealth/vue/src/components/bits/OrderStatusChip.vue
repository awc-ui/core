<script setup lang="ts">
import { orderColor, type OrderStatus } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ status: OrderStatus }>();
</script>

<template>
  <StateChip :label-key="`wealth.orderStatus.${status}`" :color="orderColor[status]" />
</template>
