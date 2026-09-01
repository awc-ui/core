<!--
  What sits behind one holding — a `md-table-row`'s `expanded` slot.

  The fixture books a position as a single lot, so this is that lot: what was
  paid, what it is worth in its own currency before the FX, when it was opened,
  and where the instrument has been over twelve months. The household name is a
  drill, because the next question after "what is this?" is "whose is it?".

  The panel runs the full width of the row. The facts sit in `.dl`, an auto-fit
  grid that spreads them across whatever width it is given, and the
  twelve-month series spans the whole panel beneath them. A twelve-point series
  stretched this wide is a flatter line than a narrow one would be — that is
  the trade the full width buys, and it is deliberate.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  getInstrumentById,
  getPortfolioById,
  plColor,
  type Position,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import Sparkline from '~/components/Sparkline.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Signed from '~/components/bits/Signed.vue';

const props = defineProps<{ position: Position }>();

const t = useT();

const instrument = computed(() => getInstrumentById(props.position.instrumentId));
const mandate = computed(() => getPortfolioById(props.position.portfolioId));

// The formatter closes over the translator; `v-awc` re-assigns object props on
// every update, so a locale switch re-labels the tooltip without extra wiring
// (the React source keys this on `state.locale` instead).
const priceLabels = computed(
  () => instrument.value?.priceSeriesDates.map((date) => t.value.formatDate(date, 'monthYear')) ?? [],
);

function priceFormatter(value: number | null): string {
  const inst = instrument.value;
  return value === null || !inst
    ? t.value('wealth.common.na')
    : t.value.formatCurrency(value, { currency: inst.currency, maximumFractionDigits: 2 });
}
</script>

<template>
  <div
    style="
      display: flex;
      flex-direction: column;
      gap: var(--md-sys-spacing-gap-lg, 24px);
      inline-size: 100%;
    "
  >
    <dl class="dl">
      <Fact :label="t('wealth.table.quantity')">
        <Num :value="position.quantity" />
      </Fact>
      <Fact :label="t('wealth.table.costPerUnit')">
        <Money :value="position.costPerUnit" :currency="position.currency" :digits="2" />
      </Fact>
      <Fact :label="t('wealth.table.costBasis')">
        <Money :value="position.costBasisEur" />
      </Fact>
      <Fact :label="t('wealth.table.marketValue')">
        <!-- The LOCAL amount here, beside the EUR one in the row above it —
             this is the pair a currency question is actually asked of. -->
        <Money :value="position.marketValue" :currency="position.currency" />
      </Fact>
      <Fact :label="t('wealth.table.opened')">
        <DateText :value="position.openedDate" />
      </Fact>
      <Fact :label="t('wealth.table.sector')">{{ t(position.sectorKey) }}</Fact>
      <Fact :label="t('wealth.table.region')">{{ t(position.regionKey) }}</Fact>
      <Fact v-if="instrument" :label="t('wealth.table.twelveMonth')">
        <Signed :value="instrument.twelveMonthReturn" kind="percent" />
      </Fact>
      <!-- The mandate reference is a proper noun, and it is the thing an
           operations question is asked with — "which book is this in?". -->
      <Fact v-if="mandate" :label="t('wealth.panel.mandate')">{{ mandate.reference }}</Fact>
    </dl>

    <div v-if="instrument && instrument.priceSeries.length > 1" style="inline-size: 100%">
      <Sparkline
        :data="instrument.priceSeries"
        :labels="priceLabels"
        :value-formatter="priceFormatter"
        variant="area"
        curve="monotone"
        :color="plColor(instrument.twelveMonthReturn)"
        show-marks="extremes"
        height="56px"
      />
    </div>
  </div>
</template>
