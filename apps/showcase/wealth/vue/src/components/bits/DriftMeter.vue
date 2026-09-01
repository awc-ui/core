<!--
  Allocation drift, as a meter.

  `drift` is a SIGNED fraction and can be negative — underweight. `md-meter`
  has no negative range, so the bar shows the DISTANCE from target scaled into
  0…10 percentage points and the direction is carried by the colour, the
  status chip and the signed text beside it. Reading the bar alone never says a
  breached class is fine: at a breach the bar is full AND red.
-->
<script setup lang="ts">
import { driftColor } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

defineProps<{ drift: number }>();

const t = useT();
</script>

<template>
  <md-meter
    :value="Math.min(10, Math.abs(drift) * 100)"
    min="0"
    max="10"
    :color="driftColor(drift)"
    thickness="8"
    :label="t('wealth.table.drift')"
    show-label
    :value-text="t.formatPercent(drift, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })"
    show-value
  ></md-meter>
</template>
