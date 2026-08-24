<!--
  Deliberately NOT one file per chip.

  The React build has a `bits.tsx` full of one-line components because a React
  component is a function call and costs nothing to declare. A Vue SFC is a
  separate file, and four of them that each render a single `<md-chip>` with a
  different colour lookup would be more ceremony than the thing they wrap.

  Every kind resolves BOTH halves of a domain value through the kit: the colour
  through the status maps in `@awc-ui/showcase-kit/credit-risk`, the label
  through the dictionary key that travels beside the value. Nothing here
  contains English, so nothing here can render English into a Romanian page.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type {
  CovenantStatus,
  FacilityStatus,
  RatingBand,
  SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import {
  bandColor,
  covenantColor,
  facilityColor,
  severityColor,
} from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{
  kind: 'rating' | 'covenant' | 'facility' | 'severity';
  /** The domain value: a RatingLabel, CovenantStatus, FacilityStatus or SignalSeverity. */
  value: string;
  /** Rating only: the band that decides the colour, and the numeric grade. */
  band?: string;
  grade?: number;
}>();

const t = useT();

const color = computed(() => {
  if (props.kind === 'rating') return bandColor[props.band as RatingBand];
  if (props.kind === 'covenant') return covenantColor[props.value as CovenantStatus];
  if (props.kind === 'facility') return facilityColor[props.value as FacilityStatus];
  return severityColor[props.value as SignalSeverity];
});

// The facility chip is the only outlined one — a facility status sits in a table
// beside a rating chip, and two filled chips per row is a wall of colour that
// stops any of them meaning anything.
const appearance = computed(() => (props.kind === 'facility' ? 'outlined' : 'filled'));

const label = computed(() => {
  if (props.kind === 'rating') {
    const name = t.value(`rating.${props.value}`);
    return props.grade == null ? name : `${name} · ${props.grade}`;
  }
  if (props.kind === 'covenant') return t.value(`covenantStatus.${props.value}`);
  if (props.kind === 'facility') return t.value(`facilityStatus.${props.value}`);
  return t.value(`severity.${props.value}`);
});

const title = computed(() =>
  props.kind === 'rating' ? t.value(`ratingBand.${props.band}`) : undefined,
);
</script>

<template>
  <md-chip variant="assist" :appearance="appearance" :color="color" :label="label" :title="title"></md-chip>
</template>
