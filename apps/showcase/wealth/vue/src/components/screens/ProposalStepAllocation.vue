<!--
  Step 3 — the draft allocation and the instruments that implement it.

  Two cards STACKED, not side by side: full width fits all five weights on one
  line, which is the row a reader actually wants — five weights that have to
  add up, readable in a single pass, with the total that judges them directly
  underneath.
-->
<script setup lang="ts">
import { driftColor, ASSET_CLASS_ORDER, type AllocationRow, type AssetClass, type Portfolio } from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import { draftMaths, STEP_ALLOCATION, STEP_MESSAGE, type TransferItem } from './proposal-shared';
import ProposalFieldNote from './ProposalFieldNote.vue';
import ProposalWeightField from './ProposalWeightField.vue';
import Count from '~/components/bits/Count.vue';
import Fact from '~/components/bits/Fact.vue';
import Money from '~/components/bits/Money.vue';
import RatioMeter from '~/components/bits/RatioMeter.vue';

const props = defineProps<{
  householdId: string;
  allocation: AllocationRow[];
  mandateTargets: Record<AssetClass, number>;
  weights: Record<AssetClass, number>;
  portfolio: Portfolio | undefined;
  proposedCount: number;
  transferItems: TransferItem[];
  proposed: string[];
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}>();

const emit = defineEmits<{
  (e: 'weight', cls: AssetClass, value: number): void;
  (e: 'chosen', value: string[]): void;
}>();

const c = useCopy();

const err = (field: string) => props.fieldError(STEP_ALLOCATION, field);

const actualFor = (cls: AssetClass): number =>
  props.allocation.find((row) => row.assetClass === cls)?.actualWeight ?? 0;

const transferListeners = {
  mdChange(event: Event) {
    emit('chosen', (event as CustomEvent<string[]>).detail);
  },
};
</script>

<template>
  <md-step
    :label="c('wealth.proposal.step.allocation')"
    :description="c('wealth.proposal.step.allocationHint')"
    editable
    :error="inError"
    :error-text="inError ? c(STEP_MESSAGE[STEP_ALLOCATION]) : ''"
  >
    <div class="stack form-stack">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <p class="field-label">{{ c('wealth.proposal.alloc.title') }}</p>
          <p class="muted">{{ c('wealth.proposal.alloc.hint') }}</p>
          <!-- Re-keyed on the household so each field takes the new mandate's
               target as an initial value. Within one household nothing ever
               writes to these elements. -->
          <div :key="`weights-${householdId}`" class="grid-3 weight-grid">
            <ProposalWeightField
              v-for="cls in ASSET_CLASS_ORDER"
              :key="cls"
              :asset-class="cls"
              :initial="mandateTargets[cls]"
              :actual="actualFor(cls)"
              @change="emit('weight', cls, $event)"
            />
          </div>
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <!-- A read-only value inside a known range — `md-meter`, not
               `md-progress-indicator`: nothing here is loading (§5.5). The
               colour comes from the kit's `driftColor`: the distance from a
               balanced book IS a drift, and it uses the same 2% / 5% bands the
               fixture classifies an allocation on. -->
          <RatioMeter
            :label="c('wealth.proposal.alloc.total')"
            :fraction="draftMaths.total(weights)"
            :color="driftColor(draftMaths.imbalance(weights))"
            :max="1"
          />
          <ProposalFieldNote :error="err('weights')">
            {{ c('wealth.proposal.alloc.zeroed') }}
          </ProposalFieldNote>
          <dl class="dl">
            <Fact :label="c('wealth.proposal.summary.instruments')">
              <Count :value="proposedCount" />
            </Fact>
            <Fact :label="c('wealth.kpi.aum.short')">
              <Money v-if="portfolio" :value="portfolio.marketValue" compact />
              <template v-else>—</template>
            </Fact>
          </dl>
        </div>
      </md-card>

      <div class="stack">
        <p class="field-label">{{ c('wealth.proposal.instruments.title') }}</p>
        <!--
          Assigning a subset out of a bounded pool with both sides visible —
          §5.3's row for `md-transfer-list`. `items` and `value` are JS
          properties (`value` has no attribute at all), so they go through
          `v-awc`. The four mover glyphs are left at their defaults because the
          stylesheet mirrors them under `dir="rtl"` and passing pre-mirrored
          names would flip them twice.
        -->
        <md-transfer-list
          v-awc="{ props: { items: transferItems, value: proposed }, on: transferListeners }"
          :source-title="c('wealth.proposal.transfer.source')"
          :target-title="c('wealth.proposal.transfer.target')"
          :source-search-placeholder="c('wealth.proposal.transfer.searchSource')"
          :target-search-placeholder="c('wealth.proposal.transfer.searchTarget')"
          :count-template="c('wealth.proposal.transfer.count')"
          :empty-text="c('wealth.proposal.transfer.empty')"
          empty-icon="inventory_2"
          :move-right-label="c('wealth.proposal.transfer.moveRight')"
          :move-left-label="c('wealth.proposal.transfer.moveLeft')"
          :move-all-right-label="c('wealth.proposal.transfer.moveAllRight')"
          :move-all-left-label="c('wealth.proposal.transfer.moveAllLeft')"
          density="-1"
          full-width
          style="--md-transfer-list-height: 360px"
        ></md-transfer-list>
        <ProposalFieldNote :error="err('instruments')">
          {{ c('wealth.proposal.instruments.hint') }}
        </ProposalFieldNote>
      </div>
    </div>
  </md-step>
</template>
