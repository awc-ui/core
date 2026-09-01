<!--
  Screen 6 — `/planning/`. Client objectives, and whether they land.

  WHAT THIS SCREEN IS FOR. An advisor looking at a book of objectives asks two
  questions: which of these land, and what would it take to make the ones that
  don't? The first is a filtered read of the fixture. The second is a what-if,
  and it is the only genuinely live thing on the screen: two sliders feed the
  kit's own projection formula and the chart, the figures and the meter all
  move together.

  ──────────────────────────────────────────────────────────────────────────
  THE ONE RULE THE WHAT-IF IS BUILT ON

  The app may construct an INPUT to the kit. It may never derive an OUTPUT.

  So a scenario is a `Goal` record with two fields replaced — a contribution
  and a horizon — handed to `goalProjection()`, which is the same function that
  produced the fixture's own `projectedAmount`. Every number this screen shows
  comes back out of that call. Nothing is added, subtracted, divided or
  compared against a threshold in this file: where a ratio is wanted, the
  component is given `value` and `max` and works it out itself (`md-meter`,
  `md-progress-indicator`), which is exactly what those two props are for.

  WHY THE SCENARIO CARRIES A SYNTHETIC ID. `goalProjection` memoises on
  `goal.id`, so a modified goal reusing its own id would be served the
  unmodified projection out of the cache. The id here encodes both varied
  inputs, which keeps the cache correct rather than defeating it: same inputs,
  same key, same answer. A workaround for a helper the kit does not yet have —
  flagged in the handover.

  WHY THE HORIZON SLIDER SELECTS AN INDEX, NOT A NUMBER OF MONTHS. Shifting a
  target DATE means adding months to an ISO date, which is arithmetic, which
  belongs in the kit. `goalProjection` already computes a date for every sample
  point it returns, so the slider picks one of those points: the horizon is
  `points[i].month` and the adjusted target date is `points[i].date`, both
  straight out of the kit. It also makes the two series share an x grid exactly
  — a scenario asked for `maxPoints = i + 1` over `points[i].month` months
  lands on precisely the baseline's first `i + 1` marks. The series are still
  joined on `month` rather than on position, so a future change to the kit's
  sampling degrades to a gap in the band instead of a misalignment.

  ──────────────────────────────────────────────────────────────────────────
  COMPONENT DECISIONS (the React source carries the full post-mortems)

  `md-meter` vs `md-progress-indicator`: a meter is a STATE ("how full"), a
  progress indicator is an ACTIVITY ("how far along"). Funding is a meter,
  every time; the review of the household's open proposals is the determinate
  progress bar, one indicator per activity.

  `md-loading-indicator` is wired to the recompute, not to a timer. The React
  source defers the whole scenario with `useDeferredValue`; Vue has no
  deferred-render primitive, so the same contract is kept with a scheduled
  hand-off — `wanted` is what the sliders say, `shown` is what the chart and
  readout are measured at, and a `requestAnimationFrame` promotes one to the
  other. The indicator is on exactly while the two differ. On a fast machine it
  is rarely seen, which is the correct behaviour for an honest loading state
  and the reason it is not faked with a delay. Deferring the whole scenario
  rather than the chart alone keeps the figures and the plot showing one
  consistent state instead of two.

  `md-color-picker` is `variant="inline"` inside an accordion panel rather than
  a popover: the panel surface is an `md-card`, which clips, and a popover
  anchored inside one is asking to be sliced in half. It earns its place
  because the kit has no goal-type palette — the category's colour in the chart
  legend is genuinely the reader's to assign. `presets` are read from the live
  theme tokens, so the house colours follow the dock's accent preset.

  The goal cards are NOT `interactive` — see GoalCard.vue. Selection is an
  `md-select` naming the objective: one labelled control instead of twelve
  identically-named ones.
-->
<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import {
  getGoals,
  getHouseholds,
  goalProjection,
  goalSummary,
  REPORTING_DATE,
  type Goal,
  type GoalFilter,
  type GoalStatus,
  type GoalType,
} from '@awc-ui/showcase-kit/wealth';
import { useShowcaseState, useT } from '~/composables/useShowcase';
import { crumbsFor, route } from '~/lib/routes';
import { usePathname } from '~/lib/router';
import Chart from '~/components/Chart.vue';
import Drill from '~/components/Drill.vue';
import EmptyState from '~/components/EmptyState.vue';
import Panel from '~/components/Panel.vue';
import Screen from '~/components/Screen.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import type { ChartSeries } from '~/lib/types';
import ActionButton from './planning/ActionButton.vue';
import AdviceInFlight from './planning/AdviceInFlight.vue';
import GoalCard from './planning/GoalCard.vue';
import MandateAssumptions from './planning/MandateAssumptions.vue';
import PlanningSkeleton from './planning/PlanningSkeleton.vue';
import SelectField from './planning/SelectField.vue';
import WhatIfControls from './planning/WhatIfControls.vue';
import { useCompact, useRoleColors } from './planning/parts';
import './planning.css';

/* --------------------------------------------------------------- constants */

/** `md-select`'s empty value means "nothing chosen", so the "all" row needs one of its own. */
const ALL = 'all';

/** The `sortBy` values `GoalFilter` documents, with the dictionary key for each. */
const SORT_OPTIONS: { value: NonNullable<GoalFilter['sortBy']>; labelKey: string }[] = [
  { value: 'targetDate', labelKey: 'wealth.table.targetDate' },
  { value: 'targetAmount', labelKey: 'wealth.table.targetAmount' },
  { value: 'fundedPct', labelKey: 'wealth.table.funded' },
  { value: 'priority', labelKey: 'wealth.table.priority' },
];

/**
 * The theme roles offered as colour presets, in the order `md-color-picker`
 * shows them. Role NAMES, not colours — they are resolved from the live token
 * sheet at render time, so the swatches follow the dock's accent preset and
 * dark mode instead of freezing a hex into this file.
 */
const PRESET_ROLES = ['primary', 'tertiary', 'secondary', 'info', 'success'] as const;

/* ------------------------------------------------------------------ screen */

const t = useT();
const state = useShowcaseState();
const pathname = usePathname();
const compact = useCompact();

const crumbs = computed(() => crumbsFor(pathname.value));

/* ------------------------------------------------------------ the filters */

const householdId = ref(ALL);
const status = ref(ALL);
const type = ref(ALL);
const sortBy = ref<NonNullable<GoalFilter['sortBy']>>('targetDate');

const filtered = computed(() =>
  getGoals({
    householdId: householdId.value === ALL ? undefined : householdId.value,
    status: status.value === ALL ? undefined : (status.value as GoalStatus),
    type: type.value === ALL ? undefined : (type.value as GoalType),
    sortBy: sortBy.value,
  }),
);

const summary = computed(() => goalSummary(filtered.value));
const total = getGoals().length;
const filtering = computed(
  () => householdId.value !== ALL || status.value !== ALL || type.value !== ALL,
);

function clearFilters() {
  householdId.value = ALL;
  status.value = ALL;
  type.value = ALL;
}

/*
 * The option lists come from the fixture, not from a local copy of the enum:
 * a filter that offers a status no objective has is a dead row, and a second
 * declaration of the domain's vocabulary is exactly what rule zero is about.
 * Sorted by translated label, per locale — hence the dependency on `t`.
 */
const households = getHouseholds();
const byLabel = (key: (value: string) => string) => (a: string, b: string) =>
  t.value(key(a)).localeCompare(t.value(key(b)), t.value.locale);
const statusOptions = computed<GoalStatus[]>(() =>
  [...new Set(getGoals().map((goal) => goal.status))].sort(
    byLabel((value) => `wealth.goalStatus.${value}`),
  ),
);
const typeOptions = computed<GoalType[]>(() =>
  [...new Set(getGoals().map((goal) => goal.type))].sort(
    byLabel((value) => `wealth.goalType.${value}`),
  ),
);

const onSortBy = (value: string) => {
  sortBy.value = value as NonNullable<GoalFilter['sortBy']>;
};

/* ---------------------------------------------------- the chosen objective */

const chosenId = ref('');
const selected = computed(
  () => filtered.value.find((goal) => goal.id === chosenId.value) ?? filtered.value[0],
);

/* -------------------------------------------------------------- the what-if */

/**
 * The baseline path. `goalProjection` samples it and the samples are what the
 * horizon slider moves between, so this array is the x grid, the date
 * vocabulary and the slider's range all at once.
 */
const basePoints = computed(() => (selected.value ? goalProjection(selected.value) : []));
const lastIndex = computed(() => Math.max(1, basePoints.value.length - 1));

/*
 * The draft is kept keyed to the objective it belongs to rather than reset by
 * a watcher: picking another objective must show that objective's own plan,
 * and a watcher would render the previous one's numbers for a frame first.
 */
const draft = ref<{ goalId: string; contribution: number; horizonIndex: number } | null>(null);

const active = computed(() =>
  selected.value && draft.value?.goalId === selected.value.id ? draft.value : null,
);
const contribution = computed(() =>
  active.value ? active.value.contribution : (selected.value?.monthlyContribution ?? 0),
);
const horizonIndex = computed(() =>
  active.value ? Math.min(active.value.horizonIndex, lastIndex.value) : lastIndex.value,
);
const adjusted = computed(
  () =>
    Boolean(active.value) &&
    (contribution.value !== selected.value?.monthlyContribution ||
      horizonIndex.value !== lastIndex.value),
);

function setContribution(value: number) {
  if (!selected.value) return;
  draft.value = { goalId: selected.value.id, contribution: value, horizonIndex: horizonIndex.value };
}

function setHorizonIndex(value: number) {
  if (!selected.value) return;
  draft.value = {
    goalId: selected.value.id,
    contribution: contribution.value,
    horizonIndex: Math.round(value),
  };
}

function resetScenario() {
  draft.value = null;
}

/*
 * The sliders move at pointer speed; the projection, the chart and the readout
 * follow one scheduled frame behind, and the loading indicator is on exactly
 * while they have not caught up. This is the React source's `useDeferredValue`
 * contract rebuilt on `requestAnimationFrame`: `shown` is promoted to `wanted`
 * after the frame the slider moved in has painted. `shallowRef`, so the
 * caught-up test below stays an identity comparison — a deep ref would wrap
 * the object in a proxy and `shown !== wanted` would never be false again.
 */
interface Scenario {
  goalId: string;
  contribution: number;
  horizonIndex: number;
}
// Keyed on its VALUES, like the React source's `useMemo`: a re-evaluation that
// lands on the same three values keeps the previous object, so a filter change
// that leaves the scenario untouched does not flash the spinner for a frame.
const wanted = computed<Scenario>((previous) => {
  const next: Scenario = {
    goalId: selected.value?.id ?? '',
    contribution: contribution.value,
    horizonIndex: horizonIndex.value,
  };
  if (
    previous &&
    previous.goalId === next.goalId &&
    previous.contribution === next.contribution &&
    previous.horizonIndex === next.horizonIndex
  ) {
    return previous;
  }
  return next;
});
const deferred = shallowRef(wanted.value);
let frame: number | undefined;
watch(wanted, (next) => {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = undefined;
    deferred.value = next;
  });
});
onScopeDispose(() => {
  if (frame !== undefined) cancelAnimationFrame(frame);
});
// A deferred value from the PREVIOUS objective would be measured against the
// wrong baseline, so that one case falls through to the current input.
const shown = computed(() =>
  deferred.value.goalId === wanted.value.goalId ? deferred.value : wanted.value,
);
const recomputing = computed(() => shown.value !== wanted.value);

/** What the chart and the readout are measured at — the deferred horizon. */
const horizonPoint = computed(
  () => basePoints.value[shown.value.horizonIndex] ?? basePoints.value[basePoints.value.length - 1],
);
/** What the slider itself is at. A control must never lag its own thumb. */
const livePoint = computed(() => basePoints.value[horizonIndex.value] ?? horizonPoint.value);

/**
 * The scenario, as an input to the kit.
 *
 * Two fields replaced and a cache key that names both of them. Everything
 * downstream — the projected amount, the path, the dates — is whatever
 * `goalProjection` returns for it.
 */
const scenarioPoints = computed(() => {
  if (!selected.value || !horizonPoint.value) return [];
  const scenario: Goal = {
    ...selected.value,
    id: `${selected.value.id}~c${shown.value.contribution}~m${horizonPoint.value.month}`,
    monthlyContribution: shown.value.contribution,
    monthsRemaining: horizonPoint.value.month,
  };
  return goalProjection(scenario, shown.value.horizonIndex + 1);
});

const scenarioProjected = computed(() =>
  scenarioPoints.value.length ? scenarioPoints.value[scenarioPoints.value.length - 1].projected : 0,
);

/* --------------------------------------------------- the category's colour */

const categoryColors = ref<Partial<Record<GoalType, string>>>({});
const preview = ref<string | null>(null);
const presets = useRoleColors(PRESET_ROLES, () => `${state.value.theme}|${state.value.seed}`);

// `mdInput` previews, `mdChange` commits — the picker's manual is explicit
// that the first fires per pointer move and only the second is a decision.
const pickerListeners = {
  mdInput: (event: Event) => {
    preview.value = (event as CustomEvent<{ value: string }>).detail?.value ?? null;
  },
  mdChange: (event: Event) => {
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (!value || !selected.value) return;
    categoryColors.value = { ...categoryColors.value, [selected.value.type]: value };
    preview.value = null;
  },
};

const committedColor = computed(() =>
  selected.value ? categoryColors.value[selected.value.type] : undefined,
);
const categoryColor = computed(() => preview.value ?? committedColor.value);
// The band falls back to the `primary` ROLE, which the chart re-themes on its
// own; the picker starts from that same role resolved to a hex, so the swatch
// and the plot agree before anything is picked.
const bandColor = computed(() => categoryColor.value ?? 'primary');
const pickerValue = computed(() => categoryColor.value ?? presets.value[0]);

/* ---------------------------------------------------------------- the chart */

const chart = computed(() => {
  if (!selected.value || basePoints.value.length === 0) return null;

  // Joined on `month`, not on position: the two series are sampled at the
  // same marks by construction, and a lookup degrades to a gap if the kit's
  // sampling ever changes, where an index would quietly misalign them.
  const projectedByMonth = new Map<number, number>(
    scenarioPoints.value.map((point) => [point.month, point.projected] as const),
  );

  return {
    categories: basePoints.value.map((point) => t.value.formatDate(point.date, 'monthYear')),
    /*
     * The cone: the envelope between the current plan and the adjusted one,
     * which opens up over the horizon because the difference compounds. The
     * pair is ordered because a band is `[low, high]` — that ordering is the
     * chart's shape requirement, not a figure about the objective. Beyond the
     * adjusted horizon there is no scenario, so the band gaps out there,
     * which is the point of bringing the target date forward.
     */
    band: basePoints.value.map((point) => {
      const scenario = projectedByMonth.get(point.month);
      if (scenario === undefined) return null;
      return [Math.min(point.projected, scenario), Math.max(point.projected, scenario)];
    }),
    baseline: basePoints.value.map((point) => point.projected),
    target: basePoints.value.map((point) => point.target),
  };
});

const series = computed<ChartSeries[]>(() => {
  if (!chart.value) return [];
  /*
   * `range`, `fill`, `dash` and `color` are all real `MdChartSeries` fields —
   * see `utils/charts/types.ts` in core — but `ChartSeries` in `lib/types.ts`
   * only declares the fields this app had needed so far, and that file belongs
   * to the shell. The cast is the alternative to editing it; the handover asks
   * for the interface to be widened.
   */
  return [
    { label: t.value('wealth.table.projected'), range: chart.value.band, color: bandColor.value },
    {
      label: t.value('wealth.table.current'),
      data: chart.value.baseline,
      // A line drawn over a band must not fill down to the axis, or it buries
      // the band it is meant to sit inside.
      fill: false,
      color: 'tertiary',
    },
    {
      label: t.value('wealth.table.target'),
      data: chart.value.target,
      fill: false,
      dash: 'dotted',
      color: 'secondary',
    },
  ] as unknown as ChartSeries[];
});

const chartXAxis = computed(() => ({
  data: chart.value?.categories ?? [],
  scale: 'category',
  // Everything past the adjusted horizon is outside the plan the sliders
  // describe, so it is shaded and named rather than left to be inferred from
  // where the band stops.
  bands:
    horizonPoint.value && shown.value.horizonIndex < basePoints.value.length - 1
      ? [
          {
            from: shown.value.horizonIndex,
            to: basePoints.value.length - 1,
            label: t.value.formatDate(horizonPoint.value.date, 'monthYear'),
            labelAlign: 'start',
          },
        ]
      : undefined,
}));

// Stable identity; it reads `t.value` at call time, so a locale switch is
// picked up without a rebind (and `v-awc` re-assigns it each update anyway).
const money = (value: number | null) =>
  t.value.formatCurrency(value ?? 0, { notation: 'compact', maximumFractionDigits: 1 });

/* --------------------------------------------------------- the sheet, small */

const sheetOpen = ref(false);
const sheetListeners = {
  mdClose: () => {
    sheetOpen.value = false;
  },
};
// Only compact layouts render the sheet, so a resize while it is open must
// not leave the flag set on a layout that has no sheet to close.
watch(compact, (isCompact) => {
  if (!isCompact) sheetOpen.value = false;
});
</script>

<template>
  <Screen
    :title="t('wealth.screen.planning.title')"
    :subtitle="
      t('wealth.screen.planning.subtitle', {
        onTrack: summary.onTrack + summary.funded,
        total: summary.count,
      })
    "
    :crumbs="crumbs"
  >
    <template #aside>
      <md-chip
        variant="assist"
        appearance="outlined"
        icon="event"
        :label="t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })"
      ></md-chip>
    </template>

    <template #actions>
      <ActionButton
        variant="text"
        size="sm"
        icon="filter_list_off"
        :disabled="!filtering"
        @action="clearFilters"
      >
        {{ t('wealth.action.clearFilters') }}
      </ActionButton>
    </template>

    <template #skeleton>
      <PlanningSkeleton :label="t('wealth.screen.planning.title')" />
    </template>

    <!-- `value=""`: the tile's value is the slotted bit component; the prop is
         required by KpiTile's contract but unused when the slot is filled. -->
    <section class="kpi-grid">
      <KpiTile :label="t('wealth.table.targetAmount')" value="" :hint="t('wealth.kpi.goals')">
        <template #value><Money :value="summary.targetTotal" compact /></template>
        <template #trailing><Count :value="summary.count" /></template>
      </KpiTile>
      <KpiTile
        :label="t('wealth.table.funded')"
        value=""
        :hint="t.formatCurrency(summary.fundedTotal, { notation: 'compact' })"
      >
        <template #value><Percent :value="summary.fundedPct" :digits="0" /></template>
      </KpiTile>
      <KpiTile
        :label="t('wealth.kpi.goalsOnTrack')"
        :value="t.formatNumber(summary.onTrack + summary.funded, { maximumFractionDigits: 0 })"
        :hint="t('wealth.kpi.goalsAtRisk')"
      >
        <template #trailing>
          <Count
            :value="summary.atRisk + summary.behind"
            :color="summary.atRisk + summary.behind > 0 ? 'warning' : 'primary'"
          />
        </template>
      </KpiTile>
      <KpiTile :label="t('wealth.table.shortfall')" value="" :hint="t('wealth.table.contribution')">
        <template #value><Money :value="summary.shortfallTotal" compact /></template>
        <template #trailing>
          <span class="num"><Money :value="summary.monthlyContributionTotal" compact /></span>
        </template>
      </KpiTile>
    </section>

    <Panel
      :title="t('wealth.panel.objectives')"
      :subtitle="t('wealth.common.showing', { shown: summary.count, total })"
    >
      <div class="plan-filters">
        <SelectField
          :label="t('wealth.table.household')"
          :value="householdId"
          @change="householdId = $event"
        >
          <md-select-option :value="ALL">{{ t('wealth.common.all') }}</md-select-option>
          <md-select-option
            v-for="household in households"
            :key="household.id"
            :value="household.id"
            >{{ household.name }}</md-select-option
          >
        </SelectField>

        <SelectField :label="t('wealth.table.type')" :value="type" @change="type = $event">
          <md-select-option :value="ALL">{{ t('wealth.common.all') }}</md-select-option>
          <md-select-option v-for="value in typeOptions" :key="value" :value="value">{{
            t(`wealth.goalType.${value}`)
          }}</md-select-option>
        </SelectField>

        <SelectField :label="t('wealth.table.status')" :value="status" @change="status = $event">
          <md-select-option :value="ALL">{{ t('wealth.common.all') }}</md-select-option>
          <md-select-option v-for="value in statusOptions" :key="value" :value="value">{{
            t(`wealth.goalStatus.${value}`)
          }}</md-select-option>
        </SelectField>

        <SelectField :label="t('wealth.action.sortBy')" :value="sortBy" @change="onSortBy">
          <md-select-option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{
            t(option.labelKey)
          }}</md-select-option>
        </SelectField>
      </div>

      <EmptyState v-if="filtered.length === 0" :message="t('wealth.empty.goals')" hint />
      <div v-else class="grid-3 plan-goals">
        <GoalCard
          v-for="goal in filtered"
          :key="goal.id"
          :goal="goal"
          :selected="selected?.id === goal.id"
          :swatch="categoryColors[goal.type]"
        />
      </div>
    </Panel>

    <div v-if="selected" class="grid-wide">
      <Panel
        :title="t('wealth.panel.projection')"
        :subtitle="
          t('wealth.goal.assumedGrowth', {
            value: t.formatPercent(selected.assumedAnnualGrowth, {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            }),
          })
        "
      >
        <template #actions>
          <div class="row row--end">
            <!-- THE BOX IS ALWAYS HERE, only its contents come and go.
                 Rendering the whole span conditionally added a 24px item to
                 this flex row the moment a projection recomputed, so the
                 select and the buttons beside it jumped left and back again
                 — a spinner that moves the controls it is reporting on. -->
            <span class="plan-busy" :aria-hidden="!recomputing">
              <md-loading-indicator
                v-if="recomputing"
                :label="t('wealth.panel.projection')"
              ></md-loading-indicator>
            </span>
            <SelectField
              :label="t('wealth.table.goal')"
              :value="selected.id"
              :full-width="false"
              @change="chosenId = $event"
            >
              <md-select-option v-for="goal in filtered" :key="goal.id" :value="goal.id">{{
                `${t(goal.typeKey)} · ${goal.householdName}`
              }}</md-select-option>
            </SelectField>
            <ActionButton
              v-if="compact"
              variant="tonal"
              size="sm"
              icon="tune"
              @action="sheetOpen = true"
            >
              {{ t('wealth.panel.projection') }}
            </ActionButton>
          </div>
        </template>

        <div class="stack">
          <Chart
            tag="md-area-chart"
            :label="`${t(selected.typeKey)} · ${selected.householdName}`"
            :series="series"
            :x-axis="chartXAxis"
            :y-axis="{ min: 0 }"
            :value-formatter="money"
            stack="none"
            curve="monotone"
            legend="bottom"
            height="340px"
            animation="none"
          />
          <!-- Area encodes magnitude, so the value axis starts at zero. NOT the
               default `stack="normal"`: these three series are measured against
               each other, and stacking would add the target line on top of the
               projection. `animation="none"` because the chart is redrawn on
               every slider move; an entrance animation per move is noise. -->

          <dl class="dl">
            <Fact :label="t('wealth.table.contribution')">
              <Money :value="shown.contribution" />
            </Fact>
            <Fact :label="t('wealth.table.targetDate')">
              <DateText v-if="horizonPoint" :value="horizonPoint.date" />
            </Fact>
            <Fact :label="t('wealth.table.projected')">
              <Money :value="scenarioProjected" compact />
            </Fact>
            <Fact :label="t('wealth.table.targetAmount')">
              <Money :value="selected.targetAmount" compact />
            </Fact>
          </dl>

          <!--
            Projected against target, as a STATE — the component is given the
            amount and the target and works the ratio out itself, so no
            division happens in this file. The bar clamps at the target;
            `value-text` carries the unclamped amount, so an over-funded
            projection still reads as the number it is.

            `secondary`, not a goal-status colour: the kit can classify the
            fixture's own projection, not this scenario's, and borrowing the
            baseline's colour would claim a verdict nothing computed.
          -->
          <md-meter
            :value="scenarioProjected"
            min="0"
            :max="selected.targetAmount"
            color="secondary"
            thickness="10"
            :label="t('wealth.table.projected')"
            show-label
            show-value
            :locale="state.locale"
            :value-text="
              t.formatCurrency(scenarioProjected, {
                notation: 'compact',
                maximumFractionDigits: 1,
              })
            "
          ></md-meter>

          <WhatIfControls
            v-if="!compact"
            :goal="selected"
            :contribution="contribution"
            :horizon-index="horizonIndex"
            :last-index="lastIndex"
            :live-point="livePoint"
            :adjusted="adjusted"
            @contribution="setContribution"
            @horizon="setHorizonIndex"
            @reset="resetScenario"
          />
        </div>
      </Panel>

      <div class="stack">
        <Panel>
          <md-accordion variant="outlined" heading-level="3" default-expanded="0">
            <md-accordion-item
              :headline="
                t('wealth.goal.assumedGrowth', {
                  value: t.formatPercent(selected.assumedAnnualGrowth, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  }),
                })
              "
              icon="functions"
            >
              <dl class="dl">
                <Fact :label="t('wealth.table.current')">
                  <Money :value="selected.currentAmount" />
                </Fact>
                <Fact :label="t('wealth.table.contribution')">
                  <Money :value="selected.monthlyContribution" />
                </Fact>
                <Fact :label="t('wealth.table.targetAmount')">
                  <Money :value="selected.targetAmount" />
                </Fact>
                <Fact :label="t('wealth.table.targetDate')">
                  <DateText :value="selected.targetDate" />
                </Fact>
                <Fact :label="t('wealth.table.funded')">
                  <Percent :value="selected.fundedPct" :digits="0" />
                </Fact>
                <Fact :label="t('wealth.table.projected')">
                  <Money :value="selected.projectedAmount" compact />
                </Fact>
              </dl>
              <p class="muted">
                <bdi>{{
                  t('wealth.goal.projectedAt', {
                    value: t.formatCurrency(selected.projectedAmount, {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }),
                  })
                }}</bdi>
              </p>
              <p class="muted">
                {{ t('wealth.common.since', { date: t.formatDate(selected.createdDate, 'medium') }) }}
              </p>
            </md-accordion-item>

            <MandateAssumptions :household-id="selected.householdId" />

            <md-accordion-item :headline="t(selected.typeKey)" icon="palette">
              <!--
                The category's colour in the chart legend.

                `status.ts` has a palette for asset classes and none for
                objective types, so there is nothing to derive this from — it
                is the reader's choice, which is what a colour picker is for.
                `presets` are the live theme roles, so the house colours are
                one tap away and follow the accent preset; the hex field stays
                on because a swatch alone is not an accessible carrier of the
                value. (`show-inputs="false"` hides the RGB sliders, not the
                hex field.)
              -->
              <md-color-picker
                v-awc="{ on: pickerListeners }"
                class="plan-picker"
                variant="inline"
                format="hex"
                show-inputs="false"
                :value="pickerValue"
                :presets="presets.join(',')"
                :aria-label="t(selected.typeKey)"
              ></md-color-picker>
            </md-accordion-item>
          </md-accordion>
        </Panel>

        <Panel :title="t('wealth.panel.review')" :subtitle="selected.householdName">
          <template #actions>
            <Drill :to="route.household(selected.householdId)">
              {{ t('wealth.action.openHousehold') }}
            </Drill>
          </template>
          <AdviceInFlight :household-id="selected.householdId" />
        </Panel>
      </div>
    </div>

    <!--
      NO `slot="actions"` ROW, and that is a finding rather than a preference.
      The dock is a floating bar pinned to the bottom of the viewport, and at
      420px it sits ON TOP of a bottom sheet's actions row — an action button
      there is visible, enabled, and unclickable, because the dock takes the
      pointer. Verified (in the React source) with `elementsFromPoint`, which
      returns AWC-SHOWCASE-DOCK above the button.

      Nothing is lost. There is nothing to commit here: the sliders apply
      live, so a sheet action would only ever have meant "close". The
      component already offers four ways out that are nowhere near the dock —
      the `closeable` ✕ in the header, the drag handle, the scrim and Escape —
      and all four emit `mdClose`, which is what the state listens to.

      `open` travels through `v-awc` as a JS property, so closing writes a real
      `false` instead of stranding a pre-upgrade attribute — the same trap
      `flag()` exists for, solved from the property side.
    -->
    <md-bottom-sheet
      v-if="compact && selected"
      v-awc="{ props: { open: sheetOpen }, on: sheetListeners }"
      variant="standard"
      closeable
      :headline="t('wealth.panel.projection')"
      :aria-label="t('wealth.panel.projection')"
      top-divider
    >
      <div class="plan-sheet-body">
        <WhatIfControls
          :goal="selected"
          :contribution="contribution"
          :horizon-index="horizonIndex"
          :last-index="lastIndex"
          :live-point="livePoint"
          :adjusted="adjusted"
          @contribution="setContribution"
          @horizon="setHorizonIndex"
          @reset="resetScenario"
        />
      </div>
    </md-bottom-sheet>
  </Screen>
</template>
