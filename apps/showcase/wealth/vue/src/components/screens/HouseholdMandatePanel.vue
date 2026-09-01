<!--
  The mandate: its terms as facts, its clauses as an accordion.

  `md-accordion` and not a second tab strip — these are independent sections a
  reader opens on demand, which is §5.5's "progressive disclosure of sections",
  where tabs are peer views of one thing. `exclusive` is off, because comparing
  the fee clause against the rebalancing clause means having both open, and
  `heading-level="3"` puts the clause headers under the panel's own `h2`
  (`md-accordion-item` renders a REAL `<h3>`, not an ARIA role).

  THE RATING IS A CONTROL, NOT A READOUT. `md-rating` is §5.3's "subjective
  score", and the score an advisor records at a review is exactly that — it is
  not in the fixture, because it is a judgement made here rather than a fact
  about the book. It gates the review action through `soft-disabled` plus an
  `md-tooltip` (§9.2: keep a contextually-unavailable control focusable and say
  what is missing, rather than dropping it out of the tab order in silence).
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  REPORTING_DATE,
  type AllocationRow,
  type Household,
  type Portfolio,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import MandateChip from '~/components/bits/MandateChip.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import RiskProfileChip from '~/components/bits/RiskProfileChip.vue';
import Signed from '~/components/bits/Signed.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';
import ActionButton from './HouseholdActionButton.vue';

const props = defineProps<{
  household: Household;
  portfolio?: Portfolio;
  allocation: AllocationRow[];
  /** From the kit's `driftedMandates()`, not counted here. */
  breachCount: number;
  score: number;
  reviewed: boolean;
}>();

const emit = defineEmits<{
  (e: 'score', next: number): void;
  (e: 'reviewed'): void;
}>();

const t = useT();

/*
 * `getLabel` is a FUNCTION prop and has no attribute form, so it rides through
 * `v-awc` beside the `mdChange` listener — one directive, both halves. It
 * drives both the visible value label and `aria-valuetext`, which makes it the
 * one hook that decides what a screen reader says at each step — so it
 * resolves through the dictionary rather than through a template literal, and
 * the `computed` re-creates it only when the locale changes (the React source
 * keys the same assignment on `t.locale`).
 */
const ratingProps = computed(() => ({
  getLabel: (value: number) =>
    t.value('wealth.common.of', { count: t.value.formatNumber(value), total: 5 }),
}));

// `md-rating`'s `mdChange` carries the value itself, not an object.
const ratingListeners = {
  mdChange(event: Event) {
    emit('score', (event as CustomEvent<number>).detail);
  },
};
</script>

<template>
  <EmptyState v-if="!portfolio" :message="t('wealth.common.na')" />
  <div v-else class="stack">
    <dl class="dl">
      <Fact :label="t('wealth.table.id')">{{ portfolio.reference }}</Fact>
      <Fact :label="t('wealth.table.benchmark')">{{ portfolio.benchmarkName }}</Fact>
      <Fact :label="t('wealth.table.inception')">
        <DateText :value="portfolio.inceptionDate" />
      </Fact>
      <Fact :label="t('wealth.table.fee')">
        {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
      </Fact>
      <Fact :label="t('wealth.kpi.cash')">
        <Money :value="portfolio.cashBalance" compact />
      </Fact>
      <Fact :label="reviewed ? t('wealth.table.lastReview') : t('wealth.table.nextReview')">
        <!-- Recording the review stamps the REPORTING DATE, never a clock:
             this console has no `Date.now()` anywhere, and the reporting date
             is the only "today" the fixture admits. -->
        <DateText :value="reviewed ? REPORTING_DATE : portfolio.nextReviewDate" />
      </Fact>
    </dl>

    <md-accordion variant="outlined" heading-level="3" default-expanded="0">
      <md-accordion-item :headline="t('wealth.table.strategy')" icon="pie_chart">
        <div class="stack">
          <!--
            THREE LABELLED FACTS, not a bare row of chips.

            `RiskProfile` and `Strategy` are DIFFERENT fields — the appetite
            the household agreed, and the strategy its mandate runs off it —
            and they genuinely differ for half the book (`defensive` runs
            `conservative`, `dynamic` runs `aggressive`), so both belong here.
            But they share the words "balanced" and "growth", and
            `riskProfileColor` maps position-for-position onto
            `strategyColor`: on the four households where the words collide
            the two chips came out BYTE-IDENTICAL side by side — same label,
            same role, same width, nothing to say which was which. Colour can
            never separate them; only the `dt` can, for a reader and for a
            screen reader alike.

            A chip inside a `<Fact>` is the shape the proposal wizard already
            uses for this same pair — see the builder's strategy step.
          -->
          <dl class="dl">
            <Fact :label="t('wealth.table.strategy')">
              <StrategyChip :strategy="portfolio.strategy" />
            </Fact>
            <Fact :label="t('wealth.table.riskProfile')">
              <RiskProfileChip :profile="household.riskProfile" />
            </Fact>
            <Fact :label="t('wealth.table.mandate')">
              <MandateChip :mandate="household.mandate" />
            </Fact>
          </dl>
          <dl class="dl">
            <Fact v-for="row in allocation" :key="row.assetClass" :label="t(row.assetClassKey)">
              <Percent :value="row.targetWeight" :digits="0" />
            </Fact>
          </dl>
        </div>
      </md-accordion-item>

      <md-accordion-item :headline="t('wealth.table.fee')" icon="receipt_long">
        <dl class="dl">
          <Fact :label="t('wealth.table.fee')">
            {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
          </Fact>
          <Fact :label="t('wealth.table.costBasis')">
            <Money :value="portfolio.costBasis" compact />
          </Fact>
          <Fact :label="t('wealth.table.marketValue')">
            <Money :value="portfolio.marketValue" compact />
          </Fact>
          <Fact :label="t('wealth.table.unrealisedPl')">
            <Signed :value="portfolio.unrealisedPl" compact />
          </Fact>
          <Fact :label="t('wealth.table.plPct')">
            <Signed :value="portfolio.unrealisedPlPct" kind="percent" />
          </Fact>
        </dl>
      </md-accordion-item>

      <md-accordion-item :headline="t('wealth.panel.rebalance')" icon="balance">
        <dl class="dl">
          <Fact :label="t('wealth.table.lastRebalance')">
            <DateText :value="portfolio.lastRebalanceDate" />
          </Fact>
          <Fact :label="t('wealth.table.nextReview')">
            <DateText :value="portfolio.nextReviewDate" />
          </Fact>
          <Fact :label="t('wealth.table.lastContact')">
            <DateText :value="household.lastContactDate" />
          </Fact>
          <Fact :label="t('wealth.kpi.driftBreaches')">
            <Num :value="breachCount" />
          </Fact>
        </dl>
      </md-accordion-item>

      <md-accordion-item :headline="t('wealth.table.riskProfile')" icon="shield">
        <div class="stack">
          <dl class="dl">
            <Fact :label="t('wealth.kpi.maxDrawdown')">
              <Signed :value="portfolio.maxDrawdown" kind="percent" />
            </Fact>
            <Fact :label="t('wealth.kpi.twoYearReturn')">
              <Percent :value="portfolio.twoYearReturn" />
            </Fact>
            <Fact :label="t('wealth.kpi.benchmark')">
              <Percent :value="portfolio.benchmarkTwoYearReturn" />
            </Fact>
          </dl>

          <div class="row">
            <span class="muted">{{ t('wealth.table.riskTolerance') }}</span>
            <!-- The event listener and the function prop on one element,
                 through the one directive — the React source needed two refs
                 merged in a callback ref for the same pair. -->
            <md-rating
              v-awc="{ props: ratingProps, on: ratingListeners }"
              :value="score"
              max="5"
              precision="1"
              size="sm"
              show-value-label
              :rating-label="t('wealth.table.riskTolerance')"
            ></md-rating>
          </div>

          <div class="row">
            <!-- The tooltip exists only while the gate does: once a score is
                 recorded the button is live, and an explanation of why it is
                 off would be a lie. A tooltip is a DESCRIPTION and never a
                 name — the button's own label is its name. -->
            <md-tooltip :text="t('wealth.table.riskTolerance')" :disabled="score > 0 || undefined">
              <ActionButton
                icon="task_alt"
                variant="tonal"
                :soft-disabled="score === 0 || reviewed"
                @activate="emit('reviewed')"
              >
                {{ t('wealth.action.review') }}
              </ActionButton>
            </md-tooltip>
            <span v-if="reviewed" class="muted">{{ t('wealth.activity.review-completed') }}</span>
          </div>
        </div>
      </md-accordion-item>
    </md-accordion>
  </div>
</template>
