<!--
  One instrument: its price, the position in it, and the trades behind that.

  THE HOLDING BLOCK IS CONDITIONAL, and that is the shape of the screen: a
  watched instrument has a price and a chart and nothing else, while a held one
  adds a position. Rendering an empty position block for a watched instrument
  would say the reader holds zero of it, which is a different claim from not
  holding it at all.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  crumbsFor,
  getHoldingFor,
  getInstrumentById,
  getTrades,
  instrumentKindColor,
  tradeSideColor,
  tradeStatusColor,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import { usePathname } from '~/lib/router';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import StateChip from '~/components/bits/StateChip.vue';

const props = defineProps<{ instrumentId: string }>();

const t = useT();
const pathname = usePathname();

const instrument = computed(() => getInstrumentById(props.instrumentId));
const holding = computed(() => getHoldingFor(props.instrumentId));
const trades = computed(() => getTrades({ instrumentId: props.instrumentId }));
const crumbs = computed(() => crumbsFor(pathname.value, instrument.value?.name ?? null));

/*
 * Hoisted out of the template because a `v-else` branch does not narrow a ref
 * for the template compiler — inside the arrow, `instrument` is still
 * `Instrument | undefined`. Reading `.currency` here, where the computed can
 * see the guard, is clearer than asserting non-null in the markup.
 */
const priceFormatter = computed(() => {
  const currency = instrument.value?.currency ?? 'EUR';
  return (value: number | null) =>
    t.value.formatCurrency(value ?? 0, { currency, maximumFractionDigits: 2 });
});
</script>

<template>
  <Screen
    v-if="!instrument"
    :crumbs="crumbs"
    :title="t('banking.screen.notFound.title')"
    :subtitle="t('banking.screen.notFound.body')"
  >
    <EmptyState :message="t('banking.screen.notFound.body')" />
  </Screen>

  <Screen
    v-else
    :crumbs="crumbs"
    :title="instrument.name"
    :subtitle="t('banking.screen.instrument.subtitle')"
  >
    <template #aside>
      <StateChip :label-key="instrument.kindKey" :color="instrumentKindColor[instrument.kind]" />
    </template>

    <Panel>
      <div class="instrument-head">
        <md-avatar :initials="instrument.initials" size="large"></md-avatar>
        <div class="stack">
          <span class="strong">{{ instrument.ticker }}</span>
          <span class="muted">
            {{ instrument.sectorKey ? t(instrument.sectorKey) : t(instrument.kindKey) }}
          </span>
        </div>
        <div class="instrument-head__figures">
          <span class="kpi__value"><Money :value="instrument.price" :currency="instrument.currency" /></span>
          <Signed :value="instrument.dayChangePct" kind="percent" />
        </div>
      </div>

      <dl class="dl">
        <div>
          <dt>{{ t('banking.table.day') }}</dt>
          <dd><Signed :value="instrument.dayChangePct" kind="percent" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.week') }}</dt>
          <dd><Signed :value="instrument.weekChangePct" kind="percent" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.year') }}</dt>
          <dd><Signed :value="instrument.yearChangePct" kind="percent" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.currency') }}</dt>
          <dd>{{ instrument.currency }}</dd>
        </div>
      </dl>
    </Panel>

    <Panel :title="t('banking.panel.performance')">
      <Chart
        tag="md-area-chart"
        class="chart-lg"
        :series="[{ id: instrument.id, label: instrument.ticker, data: instrument.history.map((p) => p.price) }]"
        :x-axis="{ data: instrument.history.map((p) => t.formatDate(p.date, 'short')), scale: 'category' }"
        :value-formatter="priceFormatter"
        :summary="t('banking.panel.performance')"
        curve="monotone"
        grid="horizontal"
      />
    </Panel>

    <Panel v-if="holding" :title="t('banking.panel.holdings')">
      <dl class="dl">
        <div>
          <dt>{{ t('banking.table.quantity') }}</dt>
          <dd><Num :value="holding.quantity" :digits="instrument.kind === 'crypto' ? 4 : 2" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.value') }}</dt>
          <dd><Money :value="holding.marketValueEur" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.costBasis') }}</dt>
          <dd><Money :value="holding.costBasisEur" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.pl') }}</dt>
          <dd><Signed :value="holding.unrealisedPlEur" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.plPct') }}</dt>
          <dd><Signed :value="holding.unrealisedPlPct" kind="percent" /></dd>
        </div>
        <div>
          <dt>{{ t('banking.table.allocation') }}</dt>
          <dd><Percent :value="holding.allocation" :digits="1" /></dd>
        </div>
      </dl>
    </Panel>

    <Panel :title="t('banking.panel.tradeHistory')">
      <template #actions><Count :value="trades.length" /></template>
      <EmptyState v-if="trades.length === 0" :message="t('banking.empty.trades')" />
      <md-list v-else :label="t('banking.panel.tradeHistory')" interaction-mode="multi-action" list-style="segmented">
        <md-list-item
          v-for="trade in trades"
          :key="trade.id"
          :headline="t.formatDate(trade.date, 'medium')"
          :overline="trade.id"
          :supporting-text="`${t('banking.table.price')} ${t.formatCurrency(trade.priceEur)}`"
          lines="3"
        >
          <span slot="trailing" class="row">
            <StateChip :label-key="trade.sideKey" :color="tradeSideColor[trade.side]" />
            <StateChip :label-key="trade.statusKey" :color="tradeStatusColor[trade.status]" />
            <Money :value="trade.amountEur" />
          </span>
        </md-list-item>
      </md-list>
    </Panel>
  </Screen>
</template>
