<!--
  The severity marker beside the counterparty's name, at the head of the row.

  IT CARRIES A LABEL, and that is the whole difference from the dot that used to
  sit inside the severity cell. That one was decorative on purpose: the chip
  immediately beside it held the same word, so naming both announced the
  severity twice per row. Here the dot stands alone at the other end of the row,
  so an unlabelled one would leave its colour as the only carrier of meaning —
  exactly the failure `md-status-dot`'s `label` exists to prevent.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { SignalSeverity } from '@awc-ui/showcase-kit/data';
import { severityDot } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ severity: SignalSeverity }>();

const t = useT();
const state = computed(() => severityDot[props.severity]);
const label = computed(() => t.value(`severity.${props.severity}`));
</script>

<template>
  <md-status-dot inline :state="state" size="small" :label="label"></md-status-dot>
</template>
