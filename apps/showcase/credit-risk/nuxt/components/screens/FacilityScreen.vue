<!--
  Screen 4 — the facility, and the bottom of the drill path.

  Terms, then the three things a credit officer checks after them: covenant
  headroom, collateral net of haircuts, and the balance profile to maturity.

  COLLATERAL. `valuation` is in the collateral's own currency, `valuationEur` is
  the converted twin and `netValue` — always EUR — is already
  `valuationEur × (1 − haircut)`. The table shows all three so the haircut is
  visible rather than implied, and the panel header compares total net value
  against the facility's EAD, which is the coverage ratio that actually matters.

  SCHEDULE. See `drawdownSchedule()` in `@awc-ui/showcase-kit/credit-risk`: term
  loans amortise straight-line to maturity, committed revolving lines hold and
  retire in one step. Both shapes come out of the fixture's own dates, so the
  table is a projection of the data rather than an invention on top of it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  BASE_CURRENCY,
  getCollateralFor,
  getCounterpartyById,
  getCovenantsFor,
  getFacilityById,
  type Facility,
} from '@awc-ui/showcase-kit/data';
import { drawdownSchedule, TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';
import EmptyState from '../EmptyState.vue';
import Fact from '../bits/Fact.vue';
import Chip from '../bits/Chip.vue';
import CovenantMeter from '../bits/CovenantMeter.vue';
import RatioMeter from '../bits/RatioMeter.vue';

const props = defineProps<{ facilityId: string }>();

const t = useT();
const facility = computed(() => getFacilityById(props.facilityId) as Facility);
const counterparty = computed(() => getCounterpartyById(facility.value.counterpartyId));
const covenants = computed(() => getCovenantsFor(facility.value.id));
const collateral = computed(() => getCollateralFor(facility.value.id));
const schedule = computed(() => drawdownSchedule(facility.value));
const netCollateral = computed(() => collateral.value.reduce((sum, item) => sum + item.netValue, 0));
const coverage = computed(() =>
  facility.value.ead > 0 ? netCollateral.value / facility.value.ead : 0,
);
const local = computed(() => ({ currency: facility.value.currency }));

const breaches = computed(() => covenants.value.filter((c) => c.status === 'breach').length);
const watch = computed(() => covenants.value.filter((c) => c.status === 'watch').length);

const crumbs = computed(() => [
  { label: t.value('nav.overview'), href: route.overview() },
  ...(counterparty.value
    ? [
        {
          label: t.value(`sector.${counterparty.value.sectorId}`),
          href: route.sector(counterparty.value.sectorId),
        },
        {
          label: counterparty.value.legalName,
          href: route.counterparty(counterparty.value.id),
        },
      ]
    : []),
  { label: facility.value.id },
]);
</script>

<template>
  <Shell
    :title="`${facility.id} · ${t(facility.typeKey)}`"
    :subtitle="facility.counterpartyName"
    :crumbs="crumbs"
  >
    <template #aside>
      <Chip kind="facility" :value="facility.status" />
      <md-chip
        variant="assist"
        appearance="outlined"
        :icon="facility.secured ? 'lock' : 'lock_open'"
        :label="facility.secured ? t('common.secured') : t('common.unsecured')"
      ></md-chip>
    </template>

    <section class="grid-2">
      <Panel :title="t('table.facility')" :subtitle="t(facility.typeKey)">
        <dl class="dl dl--numeric">
          <Fact :label="t('table.currency')">{{ facility.currency }}</Fact>
          <Fact :label="t('table.commitment')">
            {{ t.formatCurrency(facility.commitment, { ...local, notation: 'compact' }) }}
          </Fact>
          <Fact :label="t('table.drawn')">
            {{ t.formatCurrency(facility.drawn, { ...local, notation: 'compact' }) }}
          </Fact>
          <Fact :label="t('table.undrawn')">
            {{ t.formatCurrency(facility.undrawn, { ...local, notation: 'compact' }) }}
          </Fact>
          <Fact :label="t('table.ead')">{{ t.formatCurrency(facility.ead, { notation: 'compact' }) }}</Fact>
          <Fact :label="t('table.ccf')">
            {{ t.formatPercent(facility.ccf, { maximumFractionDigits: 0 }) }}
          </Fact>
          <Fact :label="t('table.margin')">
            {{ t('unit.bps', { value: t.formatNumber(facility.marginBps) }) }}
          </Fact>
          <Fact :label="t('table.maturity')">{{ t.formatDate(facility.maturityDate, 'long') }}</Fact>
          <Fact :label="t('table.tenor')">
            {{ t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) }) }}
          </Fact>
        </dl>
        <RatioMeter
          :label="t('kpi.utilisation')"
          :fraction="facility.utilisation"
          :color="utilisationColor(facility.utilisation)"
        />
      </Panel>

      <Panel
        :title="t('screen.covenants.title')"
        :subtitle="t('screen.covenants.subtitle', { breaches, watch })"
      >
        <EmptyState v-if="covenants.length === 0" :message="t('empty.covenants')" />
        <div v-else class="stack">
          <CovenantMeter v-for="covenant in covenants" :key="covenant.id" :covenant="covenant" />
        </div>
      </Panel>
    </section>

    <Panel :title="t('screen.collateral.title')" :subtitle="t('screen.collateral.subtitle')">
      <template #actions>
        <md-chip
          v-if="collateral.length > 0"
          variant="assist"
          appearance="filled"
          :color="coverage >= 1 ? 'success' : coverage >= 0.5 ? 'warning' : 'error'"
          :label="`${t('kpi.collateralCoverage')} ${t.formatPercent(coverage, { maximumFractionDigits: 0 })}`"
        ></md-chip>
      </template>

      <EmptyState v-if="collateral.length === 0" :message="t('empty.collateral')" />
      <md-table-container v-else variant="outlined">
        <md-table
          :label="t('screen.collateral.title')"
          :column-template="TABLES.collateral.columns"
          :min-width="TABLES.collateral.minWidth"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{{ t('table.collateral') }}</md-table-cell>
              <md-table-cell head scope="col">{{ t('table.currency') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.valuation') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>
                {{ t('table.valuation') }} ({{ BASE_CURRENCY }})
              </md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.haircut') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.netValue') }}</md-table-cell>
              <md-table-cell head scope="col">{{ t('table.lastValuation') }}</md-table-cell>
              <md-table-cell head scope="col">{{ t('table.basis') }}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row v-for="item in collateral" :key="item.id" :value="item.id">
              <md-table-cell>{{ t(item.typeKey) }}</md-table-cell>
              <md-table-cell>{{ item.currency }}</md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(item.valuation, { currency: item.currency, notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(item.valuationEur, { notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatPercent(item.haircutPct, { maximumFractionDigits: 0 }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(item.netValue, { notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell>{{ t.formatDate(item.lastValuationDate, 'medium') }}</md-table-cell>
              <md-table-cell>{{ t(item.valuationBasisKey) }}</md-table-cell>
            </md-table-row>
          </md-table-body>
          <md-table-foot>
            <md-table-row rowgroup="foot">
              <!-- head + scope="row" makes this a rowheader, which is what
                   associates the net-collateral figure below with the word
                   "Total". `scope` without `head` is inert. -->
              <md-table-cell head scope="row">{{ t('common.total') }}</md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(netCollateral, { notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
            </md-table-row>
          </md-table-foot>
        </md-table>
      </md-table-container>
    </Panel>

    <Panel
      :title="t('table.tenor')"
      :subtitle="t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) })"
    >
      <md-table-container variant="outlined">
        <md-table
          :label="t('table.tenor')"
          :column-template="TABLES.schedule.columns"
          :min-width="TABLES.schedule.minWidth"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{{ t('table.quarter') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.commitment') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.drawn') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.undrawn') }}</md-table-cell>
              <!-- No dictionary key for "movement in the drawn balance"; the
                   delta sign is composed onto the translated noun the same way
                   table.elDelta composes it in the dictionary itself. -->
              <md-table-cell head scope="col" numeric>Δ {{ t('table.drawn') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('table.utilisation') }}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row v-for="(row, index) in schedule" :key="row.quarter" :value="row.quarter">
              <md-table-cell>{{ row.quarter }}</md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(row.commitment, { ...local, notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(row.drawn, { ...local, notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(row.undrawn, { ...local, notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell numeric>
                <span
                  :style="
                    row.movement < 0
                      ? 'color: var(--md-sys-color-success)'
                      : row.movement > 0
                        ? 'color: var(--md-sys-color-error)'
                        : undefined
                  "
                >
                  <!-- The opening row has nothing to move against, so it reads
                       n/a. A genuine zero movement in a later quarter is a real
                       number and is printed as one. Movements are money in the
                       facility's own currency, like the columns beside them — a
                       bare number here would read as euros. -->
                  {{
                    index === 0
                      ? t('common.na')
                      : t.formatCurrency(row.movement, { ...local, notation: 'compact' })
                  }}
                </span>
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatPercent(row.utilisation, { maximumFractionDigits: 0 }) }}
              </md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    </Panel>
  </Shell>
</template>
