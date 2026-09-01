<script setup lang="ts">
import { proposalColor, type ProposalStatus } from '@awc-ui/showcase-kit/wealth';
import StateChip from './StateChip.vue';

defineProps<{ status: ProposalStatus }>();
</script>

<template>
  <StateChip :label-key="`wealth.proposalStatus.${status}`" :color="proposalColor[status]" />
</template>
