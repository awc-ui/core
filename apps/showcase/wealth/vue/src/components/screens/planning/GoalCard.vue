<!--
  One objective, as a card. Read-only: selection is the panel's `md-select` —
  the card's content holds a focusable chip, and `md-card`'s manual is explicit
  that such a card drops `role="button"` and its tabindex, leaving mouse-only
  activation. Either the card is the control or its children are.

  `data-selected`, NOT a toggled `class` — the React source records what a
  toggled class did to this exact card. `class` on a custom element is a plain
  attribute written wholesale (Vue's patchClass no less than React's
  setAttribute), and Stencil owns that list: its host classes AND the runtime's
  `hydrated` flag live there. The flag is applied once, at hydration, and the
  hydratedFlag CSS paints anything without it `visibility: hidden` — so the
  first toggle wiped it and the card became a correctly-sized, fully-populated,
  permanently invisible box. A CONSTANT class is safe; a class that CHANGES is
  not. A data attribute is a separate attribute, toggled freely, and
  `undefined` for the off state removes it so `[data-selected]` matches only
  when it is on.
-->
<script setup lang="ts">
import type { Goal } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Drill from '~/components/Drill.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import FundedMeter from '~/components/bits/FundedMeter.vue';
import GoalDot from '~/components/bits/GoalDot.vue';
import GoalStatusChip from '~/components/bits/GoalStatusChip.vue';
import Money from '~/components/bits/Money.vue';
import PriorityChip from '~/components/bits/PriorityChip.vue';

defineProps<{ goal: Goal; selected: boolean; swatch?: string }>();

const t = useT();
</script>

<template>
  <md-card
    :variant="selected ? 'filled' : 'outlined'"
    :data-selected="selected ? '' : undefined"
    full-width
    full-height
  >
    <!-- `--in-card`: the md-card around this already draws the surface, so the
         body must not draw a second one — see the note in app.css. -->
    <div class="goal-row goal-row--in-card">
      <div class="row row--between">
        <span class="with-dot">
          <GoalDot :status="goal.status" />
          <span v-if="swatch" class="plan-swatch" :style="{ background: swatch }" />
          <span class="strong">{{ t(goal.typeKey) }}</span>
        </span>
        <PriorityChip :priority="goal.priority" />
      </div>

      <!-- A proper noun, or the objective belongs to the household itself. -->
      <p class="muted">{{ goal.beneficiaryName ?? t('wealth.common.household') }}</p>
      <Drill :to="route.household(goal.householdId)">{{ goal.householdName }}</Drill>

      <FundedMeter :fraction="goal.fundedPct" :status="goal.status" />

      <div class="row row--between">
        <!--
          `<bdi>`, for the reason the `Signed` bit carries one: this is a
          mixed-direction run. The template is English (the wealth block ships
          English only), the two amounts are formatted numbers, and the word
          joining them is bidi-neutral — so under `dir="rtl"` the algorithm
          reorders it and the sentence says the opposite of what it means.
          `<bdi>` isolates the run and keeps current-then-target.
        -->
        <bdi class="muted">{{
          t('wealth.goal.fundedOf', {
            current: t.formatCurrency(goal.currentAmount, {
              notation: 'compact',
              maximumFractionDigits: 1,
            }),
            target: t.formatCurrency(goal.targetAmount, {
              notation: 'compact',
              maximumFractionDigits: 1,
            }),
          })
        }}</bdi>
        <GoalStatusChip :status="goal.status" />
      </div>

      <dl class="dl">
        <Fact :label="t('wealth.table.targetDate')">
          <DateText :value="goal.targetDate" />
        </Fact>
        <Fact :label="t('wealth.table.contribution')">
          <Money :value="goal.monthlyContribution" />
        </Fact>
        <Fact :label="t('wealth.table.projected')">
          <Money :value="goal.projectedAmount" compact />
        </Fact>
        <Fact :label="t('wealth.table.shortfall')">
          <Money v-if="goal.projectedShortfall > 0" :value="goal.projectedShortfall" compact />
          <span v-else class="muted">{{ t('wealth.common.none') }}</span>
        </Fact>
      </dl>

      <p class="muted">
        <bdi>{{
          t('wealth.goal.monthsRemaining', {
            count: t.formatNumber(goal.monthsRemaining, { maximumFractionDigits: 0 }),
          })
        }}</bdi>
      </p>
    </div>
  </md-card>
</template>
