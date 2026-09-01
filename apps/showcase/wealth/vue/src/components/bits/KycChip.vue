<script setup lang="ts">
import { kycColor, type KycStatus } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ status: KycStatus }>();
</script>

<template>
  <StateChip :label-key="`wealth.kycStatus.${status}`" :color="kycColor[status]" />
</template>
