<!--
  A fader's decibel label and a pan position.

  `volumeDb()` returns null at zero rather than `-Infinity`, and this is the one
  place that decision shows: a fader pulled all the way down reads "Silent".
  `panPosition()` returns a side and an amount rather than a signed number,
  because "L 0" and "R 0" are both wrong and a signed float produces one.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { panPosition, volumeDb } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ volume?: number; pan?: number }>();
const t = useT();

const db = computed(() => (props.volume === undefined ? null : volumeDb(props.volume)));
const position = computed(() => (props.pan === undefined ? null : panPosition(props.pan)));
</script>

<template>
  <span v-if="volume !== undefined" class="strip__readout">{{
    db === null
      ? t('music.label.silent')
      : t('music.label.decibels', { value: t.formatNumber(db, { maximumFractionDigits: 1 }) })
  }}</span>
  <span v-else-if="position" class="strip__readout">{{
    position.side === 'centre'
      ? t('music.label.panCentre')
      : t(position.side === 'left' ? 'music.label.panLeft' : 'music.label.panRight', {
          amount: t.formatNumber(position.amount),
        })
  }}</span>
</template>
