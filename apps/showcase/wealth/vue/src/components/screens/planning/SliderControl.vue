<!--
  One what-if control: a label, the current value in words, and the slider.

  `controlled`, because the value is the screen's. The slider's manual is blunt
  about the consequence of forgetting the handler — the thumb follows the
  pointer and then springs back on commit — so `mdInput` writes on every move
  and `mdChange` writes again on release, through one handler.

  There is no `value-indicator`: its bubble renders the raw number, which for
  the horizon slider is a sample INDEX and for the contribution an unformatted
  amount. The formatted value sits in the head row instead (the `display`
  slot), where it is localised, and in `value-text`, which is what a screen
  reader announces.
-->
<script setup lang="ts">
import { flag } from './parts';

defineProps<{
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  stops?: boolean;
}>();

const emit = defineEmits<{ change: [value: number] }>();

function handle(event: Event) {
  const next = (event as CustomEvent<{ value: number }>).detail?.value;
  if (typeof next === 'number') emit('change', next);
}

const listeners = { mdInput: handle, mdChange: handle };
</script>

<template>
  <div class="plan-control">
    <div class="plan-control__head">
      <span class="plan-control__label">{{ label }}</span>
      <span class="plan-control__value"><slot name="display" /></span>
    </div>
    <div class="plan-control__rail">
      <md-slider
        v-awc="{ on: listeners }"
        controlled
        size="sm"
        :aria-label="label"
        :value="value"
        :min="min"
        :max="max"
        :step="step"
        :stops.attr="flag(stops)"
        :value-text="valueText"
      ></md-slider>
    </div>
  </div>
</template>
