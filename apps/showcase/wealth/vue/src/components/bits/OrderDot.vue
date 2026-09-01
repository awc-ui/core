<!-- Labelled, like every dot here — see KycDot.vue for the rule. -->
<script setup lang="ts">
import { orderDot, type OrderStatus } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ status: OrderStatus }>();

const t = useT();
</script>

<template>
  <md-status-dot
    inline
    :state="orderDot[status]"
    size="small"
    :label="t(`wealth.orderStatus.${status}`)"
  ></md-status-dot>
</template>
