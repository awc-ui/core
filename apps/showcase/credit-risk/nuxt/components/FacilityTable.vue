<!--
  Facilities booked to one counterparty.

  CURRENCY IS THE TRAP HERE. `commitment` and `drawn` are denominated in the
  facility's OWN currency; `commitmentEur`/`drawnEur` are the converted twins and
  `ead` is always EUR. The commitment column therefore formats with
  `{ currency: facility.currency }` and shows the EUR equivalent underneath,
  while the EAD column formats in the base currency with no override. Mixing the
  two would quietly report a RON line as if it were euros.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getFacilitiesFor, type Facility } from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Drill from './Drill.vue';
import EmptyState from './EmptyState.vue';
import Chip from './bits/Chip.vue';

const props = defineProps<{ counterpartyId: string }>();

const t = useT();
const rows = computed<Facility[]>(() => getFacilitiesFor(props.counterpartyId));
const head = computed(() => [
  { label: t.value('table.facility') },
  { label: t.value('table.type') },
  { label: t.value('table.currency') },
  { label: t.value('table.commitment'), numeric: true },
  { label: t.value('table.ead'), numeric: true },
  { label: t.value('table.utilisation'), numeric: true },
  { label: t.value('table.margin'), numeric: true },
  { label: t.value('table.maturity') },
  { label: t.value('table.status') },
]);
</script>

<template>
  <EmptyState v-if="rows.length === 0" :message="t('empty.facilities')" />
  <md-table-container v-else variant="outlined">
    <md-table
      :label="t('screen.facilities.title')"
      :column-template="TABLES.facilities.columns"
      :min-width="TABLES.facilities.minWidth"
      keep-height="false"
      striped
    >
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell
            v-for="cell in head"
            :key="cell.label"
            head
            scope="col"
            :numeric="cell.numeric || undefined"
          >
            {{ cell.label }}
          </md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        <md-table-row v-for="facility in rows" :key="facility.id" :value="facility.id">
          <md-table-cell>
            <Drill :to="route.facility(facility.id)">{{ facility.id }}</Drill>
          </md-table-cell>
          <md-table-cell>{{ t(facility.typeKey) }}</md-table-cell>
          <md-table-cell>{{ facility.currency }}</md-table-cell>
          <md-table-cell numeric>
            <span class="num">
              {{
                t.formatCurrency(facility.commitment, {
                  currency: facility.currency,
                  notation: 'compact',
                })
              }}
            </span>
            <template v-if="facility.currency !== 'EUR'">
              <br />
              <span class="muted num" style="font: var(--md-sys-typescale-label-small-font)">
                {{ t.formatCurrency(facility.commitmentEur, { notation: 'compact' }) }}
              </span>
            </template>
          </md-table-cell>
          <md-table-cell numeric>{{ t.formatCurrency(facility.ead, { notation: 'compact' }) }}</md-table-cell>
          <md-table-cell numeric>
            {{ t.formatPercent(facility.utilisation, { maximumFractionDigits: 0 }) }}
          </md-table-cell>
          <md-table-cell numeric>
            {{ t('unit.bps', { value: t.formatNumber(facility.marginBps) }) }}
          </md-table-cell>
          <md-table-cell>{{ t.formatDate(facility.maturityDate, 'medium') }}</md-table-cell>
          <md-table-cell>
            <Chip kind="facility" :value="facility.status" />
          </md-table-cell>
        </md-table-row>
      </md-table-body>
    </md-table>
  </md-table-container>
</template>
