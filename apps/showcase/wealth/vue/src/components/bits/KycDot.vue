<!--
  Every dot in this directory carries a `label`.

  `md-status-dot`'s colour is the only thing it renders, so an unlabelled one
  leaves colour as the sole carrier of meaning — which is exactly the failure
  the `label` prop exists to prevent. The only case for dropping it is a dot
  sitting immediately beside a chip that already says the same word, where
  naming both announces the state twice per row.
-->
<script setup lang="ts">
import { kycDot, type KycStatus } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ status: KycStatus }>();

const t = useT();
</script>

<template>
  <md-status-dot
    inline
    :state="kycDot[status]"
    size="small"
    :label="t(`wealth.kycStatus.${status}`)"
  ></md-status-dot>
</template>
