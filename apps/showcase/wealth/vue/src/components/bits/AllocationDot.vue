<!-- Labelled, like every dot here — see KycDot.vue for the rule. -->
<script setup lang="ts">
import { allocationDot, type AllocationStatus } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ status: AllocationStatus }>();

const t = useT();
</script>

<template>
  <md-status-dot
    inline
    :state="allocationDot[status]"
    size="small"
    :label="t(`wealth.allocationStatus.${status}`)"
  ></md-status-dot>
</template>
