<!--
  One covenant, as a headroom meter.

  `headroomPct` is a SIGNED fraction of the threshold and can be negative — a
  breach. `md-meter` has no negative range, so the bar shows headroom clamped
  into 0…50% of threshold and the sign is carried by the colour, the status chip
  and the signed percentage text. Reading the bar alone never tells you a
  breached covenant is fine: at a breach the bar is empty AND red.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Covenant } from '@awc-ui/showcase-kit/data';
import { covenantColor } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import Chip from './Chip.vue';

const props = defineProps<{ covenant: Covenant }>();

const t = useT();
const headroomText = computed(() =>
  t.value.formatPercent(props.covenant.headroomPct, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }),
);
const value = computed(() => Math.max(0, Math.min(50, props.covenant.headroomPct * 100)));
</script>

<template>
  <div class="covenant">
    <div class="covenant__head">
      <h3 class="covenant__name">{{ t(`${covenant.nameKey}.abbr`) }}</h3>
      <Chip kind="covenant" :value="covenant.status" />
    </div>
    <md-meter
      :value="value"
      min="0"
      max="50"
      :color="covenantColor[covenant.status]"
      thickness="8"
      :label="t('table.headroom')"
      show-label
      :value-text="headroomText"
      show-value
    ></md-meter>
    <div class="covenant__figures">
      <span>{{ t('table.direction') }}: {{ t(`covenantDirection.${covenant.direction}`) }}</span>
      <span class="num">
        {{ t('table.threshold') }}:
        {{ t.formatNumber(covenant.threshold, { maximumFractionDigits: 2 }) }}
      </span>
      <span class="num">
        {{ t('table.current') }}:
        {{ t.formatNumber(covenant.currentValue, { maximumFractionDigits: 2 }) }}
      </span>
      <span>{{ t('table.nextTest') }}: {{ t.formatDate(covenant.nextTestDate, 'medium') }}</span>
      <span>{{ t(covenant.frequencyKey) }}</span>
    </div>
  </div>
</template>
