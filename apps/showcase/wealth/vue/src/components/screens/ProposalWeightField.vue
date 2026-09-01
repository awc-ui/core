<!--
  One asset class's proposed weight.

  UNCONTROLLED, like every field in the builder: `value` is the mandate's own
  target, authored as an initial value; the element owns the text from then on
  and state is mirrored out of `mdInput`. The grid around these fields is
  re-keyed on the household, which is how a new mandate's targets arrive as
  initial values rather than as writes that would reformat under the caret.

  A number with steppers and locale formatting — §5.2 rules out
  `md-text-field type="number"` here. `style: percent` keeps the VALUE a
  fraction, which is the fixture's convention for every ratio, so 0.35 in state
  renders as 35% on screen with no multiplication anywhere.
-->
<script setup lang="ts">
import type { AssetClass } from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Percent from '~/components/bits/Percent.vue';

defineProps<{
  assetClass: AssetClass;
  /** The mandate's target for this class — the field's initial value. */
  initial: number;
  actual: number;
}>();

const emit = defineEmits<{ (e: 'change', value: number): void }>();

const c = useCopy();

const fieldListeners = {
  mdInput(event: Event) {
    const detail = (event as CustomEvent<{ value: number | null }>).detail;
    emit('change', detail.value === null ? 0 : detail.value);
  },
};
</script>

<template>
  <div class="stack weight-field">
    <AssetClassChip :asset-class="assetClass" />
    <md-number-field
      v-awc="{ on: fieldListeners }"
      variant="outlined"
      :name="`weight-${assetClass}`"
      :label="c('wealth.proposal.field.weight')"
      :value="initial"
      :min="0"
      :max="1"
      :step="0.01"
      :small-step="0.005"
      :large-step="0.05"
      snap-on-step
      :locale="c.locale"
      format-options='{"style":"percent","maximumFractionDigits":1}'
      :increment-label="c('wealth.proposal.field.weight')"
      :decrement-label="c('wealth.proposal.field.weight')"
    ></md-number-field>
    <p class="muted">
      {{ c('wealth.table.actual') }} <Percent :value="actual" :digits="1" />
      {{ ' · ' }}
      {{ c('wealth.proposal.alloc.mandateTarget') }} <Percent :value="initial" :digits="1" />
    </p>
  </div>
</template>
