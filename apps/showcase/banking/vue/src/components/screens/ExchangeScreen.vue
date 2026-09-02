<!--
  The exchange desk: a ticket, a rate history, and the pairs the desk quotes.

  THE TICKET IS THE SCREEN. Everything else is context for the number in it.

  WHY THE QUOTE IS NOT COMPUTED HERE. `quote()` in the kit prices the trade —
  the mid rate, the spread the desk keeps, the fee off the SOURCE side, and the
  net. Doing it per port would mean five implementations of the same rounding,
  and the fee convention in particular is easy to get subtly wrong.

  AN INVALID PAIR IS UNREACHABLE, not refused: each select drops the other's
  current value, and the send side is limited to currencies with an account
  behind them — you cannot send what you do not hold.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getFxPairs,
  getSpendingAccounts,
  quote,
  rateSeries,
  type Currency,
} from '@awc-ui/showcase-kit/banking';
import { useShowcaseState, useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';

const t = useT();
const state = useShowcaseState();
const accounts = getSpendingAccounts();
const pairs = getFxPairs();

const from = ref<Currency>('EUR');
const to = ref<Currency>('GBP');
/* A NUMBER: `md-number-field` deals in numbers, emits one already parsed and
   renders its own steppers. `null` is empty — distinct from 0, which is a real
   amount a reader can type. */
const amount = ref<number | null>(250);
const done = ref(false);

const QUOTED: Currency[] = ['EUR', 'USD', 'GBP', 'RON'];
const heldCurrencies = QUOTED.filter((code) => accounts.some((a) => a.currency === code));
const sendOptions = computed(() => heldCurrencies.filter((code) => code !== to.value));
const receiveOptions = computed(() => QUOTED.filter((code) => code !== from.value));

const valid = computed(() => amount.value !== null && amount.value > 0);
const priced = computed(() =>
  valid.value && from.value !== to.value ? quote(from.value, to.value, amount.value as number) : null,
);

const charted = computed(() =>
  pairs.find(
    (p) =>
      (p.base === from.value && p.quote === to.value) || (p.base === to.value && p.quote === from.value),
  ),
);
const history = computed(() => (charted.value ? rateSeries(charted.value.id) : []));

/* Both events: `mdInput` for typing, `mdChange` for a commit (blur, steppers,
   wheel). The detail is `{ value, formattedValue, reason }` and `value` is
   already a number — no parsing here. */
const amountListeners = {
  mdInput: (event: Event) => {
    amount.value = (event as CustomEvent<{ value: number | null }>).detail.value;
    done.value = false;
  },
  mdChange: (event: Event) => {
    amount.value = (event as CustomEvent<{ value: number | null }>).detail.value;
  },
};

const pickCurrency = (target: { value: Currency }) => ({
  mdChange: (event: Event) => {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    if (value) target.value = value as Currency;
    done.value = false;
  },
});
const fromListeners = pickCurrency(from as { value: Currency });
const toListeners = pickCurrency(to as { value: Currency });

/* Only when the receive currency is one you hold: otherwise the swap would set
   a send currency deliberately absent from that select's own options. */
const canSwap = computed(() => accounts.some((a) => a.currency === to.value));
const swap = () => {
  if (!canSwap.value) return;
  const previous = from.value;
  from.value = to.value;
  to.value = previous;
  done.value = false;
};

/* No same-currency branch: the option lists make that state unreachable. */
const reason = computed(() =>
  !valid.value ? t.value('banking.hint.amountNeeded') : !priced.value ? t.value('banking.hint.noPair') : null,
);

/** Always a string, so both boxes keep the same height and the row cannot
 *  drift out of alignment. A currency with no account says so in words. */
const balanceIn = (currency: Currency) => {
  const account = accounts.find((a) => a.currency === currency);
  return account
    ? t.value.formatCurrency(account.balance, {
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : t.value('banking.hint.noAccount');
};

const formatOptions = computed(() =>
  JSON.stringify({ style: 'currency', currency: from.value, maximumFractionDigits: 2 }),
);
</script>

<template>
  <Screen :title="t('banking.screen.exchange.title')" :subtitle="t('banking.screen.exchange.subtitle')">
    <div class="grid-2">
      <Panel :title="t('banking.panel.ticket')">
        <div class="stack">
          <!-- Both selects carry supporting text: only one having any made the
               row bottom-align two boxes of different heights. -->
          <div class="ticket">
            <md-select
              v-awc="{ on: fromListeners }"
              :label="t('banking.table.send')"
              :value="from"
              :supporting-text="balanceIn(from)"
            >
              <md-select-option v-for="code in sendOptions" :key="code" :value="code" :label="code" />
            </md-select>

            <md-tooltip :text="t('banking.hint.cannotSwap')" :disabled="canSwap || undefined">
              <!-- `class`, not `className`: on a custom element React passes the
                   prop through verbatim; Vue is fine either way, but the two
                   ports stay written the same. -->
              <md-icon-button
                class="ticket__swap"
                icon="swap_horiz"
                :aria-label="t('banking.action.swap')"
                :soft-disabled="!canSwap || undefined"
                @click="swap"
              ></md-icon-button>
            </md-tooltip>

            <md-select
              v-awc="{ on: toListeners }"
              :label="t('banking.table.receive')"
              :value="to"
              :supporting-text="balanceIn(to)"
            >
              <md-select-option v-for="code in receiveOptions" :key="code" :value="code" :label="code" />
            </md-select>
          </div>

          <md-number-field
            v-awc="{ on: amountListeners }"
            :label="t('banking.table.amount')"
            :value="amount"
            :min="0"
            :step="10"
            small-step="1"
            large-step="100"
            :locale="state.locale"
            :format-options="formatOptions"
          ></md-number-field>

          <div v-if="priced" class="stack">
            <div class="quote-line">
              <span>{{ t('banking.table.rate') }}</span>
              <span class="num">
                1 {{ from }} = {{ t.formatNumber(priced.rate, { maximumFractionDigits: 4 }) }} {{ to }}
              </span>
            </div>
            <div class="quote-line">
              <span>{{ t('banking.table.spread') }}</span>
              <span class="num">{{ t('banking.unit.bps', { value: t.formatNumber(priced.spreadBps) }) }}</span>
            </div>
            <div class="quote-line">
              <span>{{ t('banking.table.fee') }}</span>
              <!-- A zero fee is said in words: "Fee €0.00" reads as a charge
                   that happens to round to nothing. The row stays, because its
                   absence is indistinguishable from having missed it. -->
              <span class="num">
                <template v-if="priced.feeFrom === 0">{{ t('banking.common.free') }}</template>
                <Money v-else :value="priced.feeFrom" :currency="from" />
              </span>
            </div>
            <div class="quote-line quote-line--total">
              <span>{{ t('banking.table.receive') }}</span>
              <span class="num"><Money :value="priced.net" :currency="to" /></span>
            </div>
          </div>

          <div class="row">
            <!-- The tooltip exists only while the gate does: once the ticket is
                 priced the button is live, and an explanation would be a lie. -->
            <md-tooltip :text="reason ?? ''" :disabled="reason === null || undefined">
              <md-button
                variant="filled"
                icon="check"
                :soft-disabled="reason !== null || done || undefined"
                @click="done = true"
              >
                {{ t('banking.action.confirm') }}
              </md-button>
            </md-tooltip>
            <span v-if="done" class="muted">{{ t('banking.msg.exchanged') }}</span>
          </div>
        </div>
      </Panel>

      <Panel
        :title="t('banking.panel.rateHistory')"
        :subtitle="charted ? `${charted.base}/${charted.quote}` : t('banking.common.na')"
      >
        <template v-if="charted" #actions>
          <Signed :value="charted.thirtyDayChangePct" kind="percent" />
        </template>
        <Chart
          v-if="history.length > 0"
          tag="md-line-chart"
          class="chart-md"
          :series="[{ id: 'rate', label: `${charted?.base}/${charted?.quote}`, data: history.map((p) => p.rate) }]"
          :x-axis="{ data: history.map((p) => t.formatDate(p.date, 'short')), scale: 'category' }"
          :value-formatter="(v) => t.formatNumber(v ?? 0, { maximumFractionDigits: 4 })"
          :summary="t('banking.panel.rateHistory')"
          curve="monotone"
          grid="horizontal"
        />
      </Panel>
    </div>

    <Panel :title="t('banking.panel.details')" :subtitle="t('banking.screen.exchange.subtitle')">
      <div class="grid-3">
        <md-card v-for="pair in pairs" :key="pair.id" variant="outlined" full-width class="surface-card">
          <div class="row row--between">
            <span class="strong">{{ pair.base }}/{{ pair.quote }}</span>
            <Signed :value="pair.thirtyDayChangePct" kind="percent" />
          </div>
          <dl class="dl">
            <div>
              <dt>{{ t('banking.table.rate') }}</dt>
              <dd class="num">{{ t.formatNumber(pair.rate, { maximumFractionDigits: 4 }) }}</dd>
            </div>
            <div>
              <dt>{{ t('banking.table.spread') }}</dt>
              <dd class="num">{{ t('banking.unit.bps', { value: t.formatNumber(pair.spreadBps) }) }}</dd>
            </div>
            <div>
              <dt>{{ t('banking.table.fee') }}</dt>
              <dd class="num">
                <template v-if="pair.feePct === 0">{{ t('banking.common.free') }}</template>
                <Percent v-else :value="pair.feePct" />
              </dd>
            </div>
          </dl>
        </md-card>
      </div>
    </Panel>

    <Panel :title="t('banking.panel.accounts')">
      <div class="row">
        <span v-for="account in accounts" :key="account.id" class="row">
          <md-chip variant="assist" appearance="outlined" color="secondary" :label="account.currency"></md-chip>
          <Money :value="account.balance" :currency="account.currency" />
        </span>
      </div>
    </Panel>
  </Screen>
</template>
