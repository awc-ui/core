<!--
  Step 4 — the summary and the code that signs it.

  Two cards: what is being signed on the left, what it holds on the right. The
  code stays at the foot of the summary card — it belongs to the thing it
  signs, and carrying it there is also what closes most of the height gap
  between the two columns from the short side.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ASSET_CLASS_ORDER, type AssetClass, type Instrument, type InstrumentType, type ProposalType } from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import { CODE_LENGTH, CONVICTION_MAX, STEP_MESSAGE, STEP_SIGN, SUMMARY_LIST_LIMIT } from './proposal-shared';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import ProposalTypeChip from '~/components/bits/ProposalTypeChip.vue';

const props = defineProps<{
  title: string;
  householdName: string;
  clientName: string;
  type: ProposalType;
  goalLabel: string;
  reviewDate: string;
  reviewTime: string;
  horizon: number;
  conviction: number;
  excluded: InstrumentType[];
  esg: boolean;
  weights: Record<AssetClass, number>;
  instruments: Instrument[];
  mandateValue: number;
  fieldError: (step: number, field: string) => string;
  inError: boolean;
}>();

const emit = defineEmits<{ (e: 'code', value: string): void }>();

const c = useCopy();

const codeError = computed(() => props.fieldError(STEP_SIGN, 'code'));

const weightedClasses = computed(() =>
  ASSET_CLASS_ORDER.filter((cls) => (props.weights[cls] || 0) > 0),
);

const otpListeners = {
  mdInput(event: Event) {
    emit('code', (event as CustomEvent<string>).detail);
  },
};
</script>

<template>
  <md-step
    :label="c('wealth.proposal.step.sign')"
    :description="c('wealth.proposal.step.signHint')"
    :error="inError"
    :error-text="inError ? c(STEP_MESSAGE[STEP_SIGN]) : ''"
  >
    <div class="grid-wide">
      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <p class="field-label">{{ c('wealth.proposal.summary.title') }}</p>
          <p class="muted">{{ c('wealth.proposal.summary.hint') }}</p>

          <dl class="dl">
            <Fact :label="c('wealth.proposal.field.title')">{{ title || '—' }}</Fact>
            <Fact :label="c('wealth.table.household')">{{ householdName || '—' }}</Fact>
            <Fact :label="c('wealth.proposal.field.client')">{{ clientName || '—' }}</Fact>
            <Fact :label="c('wealth.proposal.field.type')">
              <ProposalTypeChip :type="type" />
            </Fact>
            <Fact :label="c('wealth.proposal.field.objective')">{{ goalLabel }}</Fact>
            <Fact :label="c('wealth.proposal.summary.meeting')">
              <template v-if="reviewDate">
                <DateText :value="reviewDate" />{{ reviewTime ? ` · ${reviewTime}` : '' }}
              </template>
              <template v-else>—</template>
            </Fact>
            <Fact :label="c('wealth.proposal.summary.horizon')">
              {{ c('wealth.unit.months', { value: horizon }) }}
            </Fact>
            <Fact :label="c('wealth.proposal.field.conviction')">
              {{ c('wealth.proposal.summary.conviction', { value: conviction, max: CONVICTION_MAX }) }}
            </Fact>
            <Fact :label="c('wealth.proposal.field.esg')">
              {{ esg ? c('wealth.proposal.summary.esgOn') : c('wealth.proposal.summary.esgOff') }}
            </Fact>
            <Fact :label="c('wealth.proposal.summary.mandateValue')">
              <Money :value="mandateValue" />
            </Fact>
          </dl>

          <div class="alloc-summary">
            <span v-for="cls in weightedClasses" :key="cls">
              <AssetClassChip :asset-class="cls" />
              <Percent :value="weights[cls]" :digits="1" />
            </span>
          </div>

          <div v-if="excluded.length > 0" class="row">
            <span class="muted">{{ c('wealth.proposal.summary.excluded') }}</span>
            <md-chip
              v-for="entry in excluded"
              :key="entry"
              variant="assist"
              appearance="outlined"
              color="warning"
              icon="block"
              :label="c(`wealth.instrumentType.${entry}`)"
            ></md-chip>
          </div>

          <div class="sign-block">
            <!--
              A one-time code goes in `md-otp-field`, never a row of text
              fields (§5.2). `incomplete-label` is what makes a half-typed
              code invalid rather than merely empty.

              NO `error` HERE, deliberately. A partly-typed code is not a
              mistake, it is a code that is not finished yet — painting it red
              turned all six cells red from the first digit. The message still
              appears, as supporting text, in the line the hint was already
              occupying, so nothing moves and nothing shouts. What actually
              enforces the rule is `next-disabled` on the stepper.
            -->
            <md-otp-field
              v-awc="{ on: otpListeners }"
              name="confirmationCode"
              :length="CODE_LENGTH"
              validation-type="numeric"
              :group-size="3"
              :label="c('wealth.proposal.field.code')"
              :supporting-text="codeError || c('wealth.proposal.field.codeHint')"
              :cell-label-template="c('wealth.proposal.field.codeCell')"
              :value-missing-label="c('wealth.proposal.error.code')"
              :incomplete-label="c('wealth.proposal.error.code')"
              reserve-supporting-space
              required
            ></md-otp-field>
          </div>
        </div>
      </md-card>

      <md-card variant="outlined" full-width class="surface-card step-card">
        <div class="stack">
          <div class="row row--between">
            <p class="field-label">{{ c('wealth.proposal.summary.instruments') }}</p>
            <Count :value="instruments.length" />
          </div>
          <!-- A vertical set of records, not a table (§5.5). `lines` matches
               what is actually passed — a headline and one supporting line. -->
          <md-list :aria-label="c('wealth.proposal.summary.instruments')">
            <md-list-item
              v-for="instrument in instruments.slice(0, SUMMARY_LIST_LIMIT)"
              :key="instrument.id"
              :lines="2"
              :headline="instrument.name"
              :supporting-text="
                c('wealth.proposal.instruments.meta', {
                  ticker: instrument.ticker,
                  assetClass: c(instrument.assetClassKey),
                  currency: instrument.currency,
                })
              "
            ></md-list-item>
          </md-list>
          <p v-if="instruments.length > SUMMARY_LIST_LIMIT" class="muted">
            {{ c('wealth.common.more', { count: instruments.length - SUMMARY_LIST_LIMIT }) }}
          </p>
        </div>
      </md-card>
    </div>
  </md-step>
</template>
