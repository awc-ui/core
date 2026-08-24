<!--
  Screen 5 — early-warning signals.

  `getWatchlist()` returns rows already denormalised with the counterparty name,
  sector, grade and EAD, and already sorted highest severity first then largest
  exposure — so the table needs no join and no comparator, and the filters can be
  a plain `Array.filter` over the selector's output rather than a second ordering
  that could disagree with it.

  FILTERS. Severity is a multiselect segmented set (`mdChange` gives the value of
  every selected segment, in DOM order); sector is a clearable select. An empty
  severity selection means "all", which is the same thing the set reports when
  the user clears the last segment — so no separate "all" segment is needed, and
  the reset button restores exactly that state.

  `frozen-header`, NOT `sticky-header`. This is the only table in the app inside
  a bounded container, so the only one that scrolls vertically, and the two props
  give different architectures for that. `sticky-header` pins the header inside
  the scroll port, which means the scroll port — and therefore the scrollbar —
  spans the header too. `frozen-header` renders the header OUTSIDE the scrolling
  area so the bar runs beside the rows only.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getRatingGrade,
  getSectors,
  getWatchlist,
  type SectorId,
  type SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';
import Drill from '../Drill.vue';
import EmptyState from '../EmptyState.vue';
import Chip from '../bits/Chip.vue';
import SeverityChip from '../bits/SeverityChip.vue';
import SeverityDot from '../bits/SeverityDot.vue';

const SEVERITIES: SignalSeverity[] = ['high', 'medium', 'low'];

const t = useT();
const sectors = getSectors();
const signals = getWatchlist();
const allCounterparties = new Set(signals.map((s) => s.counterpartyId)).size;

const severities = ref<SignalSeverity[]>([]);
const sectorId = ref<SectorId | ''>('');
const severitySet = ref<HTMLElement | null>(null);
const sectorSelect = ref<HTMLElement | null>(null);

const rows = computed(() =>
  signals.filter(
    (signal) =>
      (severities.value.length === 0 || severities.value.includes(signal.severity)) &&
      (sectorId.value === '' || signal.sectorId === sectorId.value),
  ),
);
const counterparties = computed(() => new Set(rows.value.map((s) => s.counterpartyId)).size);

const head = computed(() => [
  { label: t.value('table.counterparty') },
  { label: t.value('table.sector') },
  { label: t.value('table.rating') },
  { label: t.value('table.signal') },
  { label: t.value('table.severity') },
  { label: t.value('table.ead'), numeric: true },
  { label: t.value('table.opened') },
  { label: t.value('table.daysOpen'), numeric: true },
  { label: t.value('table.owner') },
]);

const severityListeners = {
  mdChange(event: Event) {
    severities.value = ((event as CustomEvent<string[]>).detail ?? []) as SignalSeverity[];
  },
};
const sectorListeners = {
  mdChange(event: Event) {
    sectorId.value = ((event as CustomEvent<string>).detail ?? '') as SectorId | '';
  },
};

function clearFilters() {
  severities.value = [];
  sectorId.value = '';
  // The custom elements own their own visual state, so the reset has to be
  // pushed back into them; Vue does not re-render an attribute it never set.
  severitySet.value?.querySelectorAll('md-segmented-button').forEach((segment) => {
    (segment as unknown as { selected: boolean }).selected = false;
  });
  if (sectorSelect.value) (sectorSelect.value as unknown as { value: string }).value = '';
}
</script>

<template>
  <Shell
    :title="t('screen.watchlist.title')"
    :subtitle="
      t('screen.watchlist.subtitle', {
        signals: signals.length,
        counterparties: allCounterparties,
      })
    "
  >
    <template #aside>
      <md-chip
        variant="assist"
        appearance="filled"
        color="error"
        icon="crisis_alert"
        :label="t('common.showing', { shown: rows.length, total: signals.length })"
      ></md-chip>
    </template>

    <Panel :title="t('action.filter')" :subtitle="t('table.severity')">
      <div class="row">
        <md-segmented-button-set
          ref="severitySet"
          v-awc="{ on: severityListeners }"
          multiselect
          :aria-label="t('table.severity')"
        >
          <md-segmented-button
            v-for="severity in SEVERITIES"
            :key="severity"
            :value="severity"
            :label="t(`severity.${severity}`)"
          ></md-segmented-button>
        </md-segmented-button-set>

        <md-select
          ref="sectorSelect"
          v-awc="{ on: sectorListeners }"
          :label="t('table.sector')"
          :placeholder="t('common.all')"
          clearable
          :clear-label="t('action.clearFilters')"
        >
          <md-select-option
            v-for="sector in sectors"
            :key="sector.id"
            :value="sector.id"
            :label="t(sector.nameKey)"
          >
            {{ t(sector.nameKey) }}
          </md-select-option>
        </md-select>

        <md-button variant="text" size="sm" icon="filter_alt_off" @click="clearFilters">
          {{ t('action.clearFilters') }}
        </md-button>
      </div>
    </Panel>

    <Panel
      :title="t('table.signal')"
      :subtitle="t('common.of', { count: counterparties, total: rows.length })"
    >
      <EmptyState v-if="rows.length === 0" :message="t('empty.signals')" hint />
      <md-table-container v-else variant="outlined" max-height="60vh">
        <md-table
          :label="t('screen.watchlist.title')"
          :column-template="TABLES.watchlist.columns"
          :min-width="TABLES.watchlist.minWidth"
          frozen-header
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
            <md-table-row v-for="signal in rows" :key="signal.id" :value="signal.id">
              <md-table-cell>
                <!-- The severity marker leads the row, beside the obligor's
                     name — the same shape the counterparty table uses for its
                     watchlist dot, so a reader scanning the first column sees
                     the severity without crossing a nine-column table. -->
                <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                  <SeverityDot :severity="signal.severity" />
                  <Drill :to="route.counterparty(signal.counterpartyId)">
                    {{ signal.counterpartyName }}
                  </Drill>
                </span>
              </md-table-cell>
              <md-table-cell>
                <Drill :to="route.sector(signal.sectorId)">{{ t(`sector.${signal.sectorId}`) }}</Drill>
              </md-table-cell>
              <md-table-cell>
                <!-- The signal row carries the grade but not the band, so the
                     band comes from the rating scale rather than from a second
                     set of thresholds invented here. -->
                <Chip
                  kind="rating"
                  :value="signal.ratingLabel"
                  :band="getRatingGrade(signal.grade)?.band ?? 'speculative'"
                />
              </md-table-cell>
              <md-table-cell>{{ t(signal.typeKey) }}</md-table-cell>
              <md-table-cell>
                <SeverityChip :severity="signal.severity" />
              </md-table-cell>
              <md-table-cell numeric>
                {{ t.formatCurrency(signal.ead, { notation: 'compact' }) }}
              </md-table-cell>
              <md-table-cell>{{ t.formatDate(signal.openedDate, 'medium') }}</md-table-cell>
              <md-table-cell numeric>
                <span :title="t('signal.openFor', { days: signal.daysOpen })">
                  {{ t.formatNumber(signal.daysOpen) }}
                </span>
              </md-table-cell>
              <md-table-cell>{{ signal.owner }}</md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    </Panel>
  </Shell>
</template>
