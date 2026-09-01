<!--
  Screen 6 — `/planning/`. Client objectives, and whether they land.

  Ported 1:1 from the React build's `PlanningScreen.tsx` (+ `planning-parts.tsx`,
  which became `planning-parts/` beside this file). The React file's header
  comments are the reasoning of record; the short version:

  THE ONE RULE THE WHAT-IF IS BUILT ON — the app may construct an INPUT to the
  kit; it may never derive an OUTPUT. A scenario is a `Goal` record with two
  fields replaced, handed to `goalProjection()`. Nothing is added, subtracted,
  divided or compared against a threshold in this file: where a ratio is
  wanted, the component gets `value` and `max` and works it out itself
  (`md-meter`, `md-progress-indicator`).

  WHY THE SCENARIO CARRIES A SYNTHETIC ID — `goalProjection` memoises on
  `goal.id`, so a modified goal reusing its own id would be served the
  unmodified projection out of the cache. The id encodes both varied inputs:
  same inputs, same key, same answer.

  WHY THE HORIZON SLIDER SELECTS AN INDEX, NOT A NUMBER OF MONTHS — shifting a
  target DATE means date arithmetic, which belongs in the kit. The slider picks
  one of `goalProjection`'s own sample points, so the horizon is
  `points[i].month` and the adjusted date is `points[i].date`, both straight
  out of the kit — and the two series share an x grid by construction. They are
  still joined on `month`, not position, so a sampling change degrades to a gap
  in the band instead of a misalignment.

  THE DEFERRED RECOMPUTE — React wires `md-loading-indicator` to
  `useDeferredValue`. Svelte has no deferred-render primitive, so the same
  contract is kept by hand: the sliders write `contribution`/`horizonIndex`
  at pointer speed, while the scenario the chart and readout are measured at
  (`shown`) follows one animation frame behind through a scheduled
  `requestAnimationFrame`. `recomputing` is true exactly while `shown` has not
  caught up, which is when the indicator renders — an honest loading state, not
  a faked delay. Picking another objective falls through immediately, because a
  lagging scenario from the PREVIOUS objective would be measured against the
  wrong baseline.

  `md-meter` vs `md-progress-indicator`: a meter is a STATE ("how full"), a
  progress indicator an ACTIVITY ("how far along") — so funding is a meter and
  the review of open proposals is the determinate indicator.

  `md-color-picker` is `variant="inline"` inside the accordion rather than a
  popover: the panel surface is an `md-card`, which clips. The goal cards are
  NOT `interactive` (they hold focusable chips — the manual drops the card's
  keyboard path for that), so selection is the panel's `md-select`.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    getGoals,
    getHouseholds,
    goalProjection,
    goalSummary,
    REPORTING_DATE,
    type Goal,
    type GoalFilter,
    type GoalProjectionPoint,
    type GoalStatus,
    type GoalType,
  } from '@awc-ui/showcase-kit/wealth';
  import { state, t, type T } from '$lib/showcase';
  import { pathname } from '$lib/router';
  import { crumbsFor, route } from '$lib/routes';
  import { type ChartSeries } from '$lib/elements';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import { KpiSkeleton, PanelSkeleton } from '$lib/skeletons';
  import { compact, roleColors } from './planning-parts/parts';
  import Controls from './planning-parts/Controls.svelte';
  import GoalCard from './planning-parts/GoalCard.svelte';
  import SelectField from './planning-parts/SelectField.svelte';
  import AdviceInFlight from './planning-parts/AdviceInFlight.svelte';
  import MandateAssumptions from './planning-parts/MandateAssumptions.svelte';
  import './planning.css';

  /* ------------------------------------------------------------- constants */

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

  /* ----------------------------------------------------------- the filters */

  let householdId = ALL;
  let status = ALL;
  let type = ALL;
  let sortBy: NonNullable<GoalFilter['sortBy']> = 'targetDate';

  $: filtered = getGoals({
    householdId: householdId === ALL ? undefined : householdId,
    status: status === ALL ? undefined : (status as GoalStatus),
    type: type === ALL ? undefined : (type as GoalType),
    sortBy,
  });

  $: summary = goalSummary(filtered);
  const total = getGoals().length;
  $: filtering = householdId !== ALL || status !== ALL || type !== ALL;

  function clearFilters() {
    householdId = ALL;
    status = ALL;
    type = ALL;
  }

  // A named handler, because the template's expression grammar is HTML-side
  // Svelte and does not admit a TypeScript `as` cast inline.
  function setSortBy(value: string) {
    sortBy = value as NonNullable<GoalFilter['sortBy']>;
  }

  /*
   * The option lists come from the fixture, not from a local copy of the enum:
   * a filter that offers a status no objective has is a dead row, and a second
   * declaration of the domain's vocabulary is exactly what rule zero is about.
   */
  const households = getHouseholds();

  function optionLists(translate: T): [GoalStatus[], GoalType[]] {
    const all = getGoals();
    const byLabel = (key: (value: string) => string) => (a: string, b: string) =>
      translate(key(a)).localeCompare(translate(key(b)), translate.locale);
    return [
      [...new Set(all.map((g) => g.status))].sort(byLabel((v) => `wealth.goalStatus.${v}`)),
      [...new Set(all.map((g) => g.type))].sort(byLabel((v) => `wealth.goalType.${v}`)),
    ] as [GoalStatus[], GoalType[]];
  }

  let statusOptions: GoalStatus[] = [];
  let typeOptions: GoalType[] = [];
  $: [statusOptions, typeOptions] = optionLists($t);

  /* ------------------------------------------------- the chosen objective */

  let chosenId = '';
  $: selected = filtered.find((goal) => goal.id === chosenId) ?? filtered[0];

  /* ----------------------------------------------------------- the what-if */

  /**
   * The baseline path. `goalProjection` samples it and the samples are what the
   * horizon slider moves between, so this array is the x grid, the date
   * vocabulary and the slider's range all at once.
   */
  $: basePoints = selected ? goalProjection(selected) : [];
  $: lastIndex = Math.max(1, basePoints.length - 1);

  /*
   * The draft is kept keyed to the objective it belongs to rather than reset
   * reactively: picking another objective must show that objective's own plan,
   * and a reset-in-an-effect would render the previous one's numbers first.
   */
  let draft: { goalId: string; contribution: number; horizonIndex: number } | null = null;

  $: active = selected && draft?.goalId === selected.id ? draft : null;
  $: contribution = active ? active.contribution : (selected?.monthlyContribution ?? 0);
  $: horizonIndex = active ? Math.min(active.horizonIndex, lastIndex) : lastIndex;
  $: adjusted =
    Boolean(active) &&
    (contribution !== selected?.monthlyContribution || horizonIndex !== lastIndex);

  function setContribution(value: number) {
    if (!selected) return;
    draft = { goalId: selected.id, contribution: value, horizonIndex };
  }

  function setHorizonIndex(value: number) {
    if (!selected) return;
    draft = { goalId: selected.id, contribution, horizonIndex: Math.round(value) };
  }

  function resetScenario() {
    draft = null;
  }

  /*
   * The sliders move at pointer speed; the projection, the chart and the
   * readout follow as a scheduled render one frame behind, and the loading
   * indicator is on exactly while they have not caught up. Deferring the whole
   * scenario rather than the chart alone keeps the figures and the plot showing
   * one consistent state instead of two. (React: `useDeferredValue`.)
   */
  type Scenario = { goalId: string; contribution: number; horizonIndex: number };

  $: wanted = {
    goalId: selected?.id ?? '',
    contribution,
    horizonIndex,
  } as Scenario;

  /** What the chart and the readout are measured at — the deferred scenario. */
  let shown: Scenario = { goalId: '', contribution: 0, horizonIndex: 0 };
  let rafId: number | undefined;

  $: defer(wanted);

  function defer(next: Scenario) {
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      rafId = undefined;
    }
    // A deferred value from the PREVIOUS objective would be measured against
    // the wrong baseline, so that one case falls through to the current input.
    if (next.goalId !== shown.goalId) {
      shown = next;
      return;
    }
    // Same values, fresh identity (an unrelated reactive re-run): adopt it so
    // `recomputing` stays honest without a scheduled frame.
    if (next.contribution === shown.contribution && next.horizonIndex === shown.horizonIndex) {
      shown = next;
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = undefined;
      shown = next;
    });
  }

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
  });

  $: recomputing = shown !== wanted;

  /** What the chart and the readout are measured at — the deferred horizon. */
  $: horizonPoint = basePoints[shown.horizonIndex] ?? basePoints[basePoints.length - 1];
  /** What the slider itself is at. A control must never lag its own thumb. */
  $: livePoint = basePoints[horizonIndex] ?? horizonPoint;

  /**
   * The scenario, as an input to the kit.
   *
   * Two fields replaced and a cache key that names both of them. Everything
   * downstream — the projected amount, the path, the dates — is whatever
   * `goalProjection` returns for it.
   */
  $: scenarioPoints = ((): GoalProjectionPoint[] => {
    if (!selected || !horizonPoint) return [];
    const scenario: Goal = {
      ...selected,
      id: `${selected.id}~c${shown.contribution}~m${horizonPoint.month}`,
      monthlyContribution: shown.contribution,
      monthsRemaining: horizonPoint.month,
    };
    return goalProjection(scenario, shown.horizonIndex + 1);
  })();

  $: scenarioProjected = scenarioPoints.length
    ? scenarioPoints[scenarioPoints.length - 1].projected
    : 0;

  /* ------------------------------------------------ the category's colour */

  let categoryColors: Partial<Record<GoalType, string>> = {};
  let preview: string | null = null;
  $: presets = roleColors(PRESET_ROLES, `${$state.theme}|${$state.seed}`);

  // `mdInput` previews, `mdChange` commits — the picker's manual is explicit
  // that the first fires per pointer move and only the second is a decision.
  function onPickerInput(event: CustomEvent<unknown>) {
    preview = (event as CustomEvent<{ value: string }>).detail?.value ?? null;
  }

  function onPickerChange(event: CustomEvent<unknown>) {
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (!value || !selected) return;
    categoryColors = { ...categoryColors, [selected.type]: value };
    preview = null;
  }

  $: committedColor = selected ? categoryColors[selected.type] : undefined;
  $: categoryColor = preview ?? committedColor;
  // The band falls back to the `primary` ROLE, which the chart re-themes on its
  // own; the picker starts from that same role resolved to a hex, so the swatch
  // and the plot agree before anything is picked.
  $: bandColor = categoryColor ?? 'primary';
  $: pickerValue = categoryColor ?? presets[0];

  /* ------------------------------------------------------------ the chart */

  $: chart = ((): {
    categories: string[];
    band: ([number, number] | null)[];
    baseline: number[];
    target: number[];
  } | null => {
    if (!selected || basePoints.length === 0) return null;

    // Joined on `month`, not on position: the two series are sampled at the
    // same marks by construction, and a lookup degrades to a gap if the kit's
    // sampling ever changes, where an index would quietly misalign them.
    const projectedByMonth = new Map<number, number>(
      scenarioPoints.map((point) => [point.month, point.projected] as const),
    );

    return {
      categories: basePoints.map((point) => $t.formatDate(point.date, 'monthYear')),
      /*
       * The cone: the envelope between the current plan and the adjusted one,
       * which opens up over the horizon because the difference compounds. The
       * pair is ordered because a band is `[low, high]` — that ordering is the
       * chart's shape requirement, not a figure about the objective. Beyond the
       * adjusted horizon there is no scenario, so the band gaps out there,
       * which is the point of bringing the target date forward.
       */
      band: basePoints.map((point) => {
        const scenario = projectedByMonth.get(point.month);
        if (scenario === undefined) return null;
        return [Math.min(point.projected, scenario), Math.max(point.projected, scenario)] as [
          number,
          number,
        ];
      }),
      baseline: basePoints.map((point) => point.projected),
      target: basePoints.map((point) => point.target),
    };
  })();

  /*
   * `range`, `fill`, `dash` and `color` are all real `MdChartSeries` fields —
   * see `utils/charts/types.ts` — but `ChartSeries` in `elements.ts` only
   * declares the four this app had needed so far, and that file belongs to the
   * shell. The cast is the alternative to editing it; the handover asks for
   * the interface to be widened.
   */
  $: series = (chart
    ? ([
        { label: $t('wealth.table.projected'), range: chart.band, color: bandColor },
        {
          label: $t('wealth.table.current'),
          data: chart.baseline,
          // A line drawn over a band must not fill down to the axis, or it
          // buries the band it is meant to sit inside.
          fill: false,
          color: 'tertiary',
        },
        {
          label: $t('wealth.table.target'),
          data: chart.target,
          fill: false,
          dash: 'dotted',
          color: 'secondary',
        },
      ] as unknown as ChartSeries[])
    : []) as ChartSeries[];

  $: xAxis = {
    data: chart?.categories ?? [],
    scale: 'category',
    // Everything past the adjusted horizon is outside the plan the sliders
    // describe, so it is shaded and named rather than left to be inferred from
    // where the band stops.
    bands:
      horizonPoint && shown.horizonIndex < basePoints.length - 1
        ? [
            {
              from: shown.horizonIndex,
              to: basePoints.length - 1,
              label: $t.formatDate(horizonPoint.date, 'monthYear'),
              labelAlign: 'start',
            },
          ]
        : undefined,
  };

  // A fresh closure per locale, so the `objectProps` update inside `Chart`
  // re-assigns it and the axis follows the language.
  $: money = (value: number | null) =>
    $t.formatCurrency(value ?? 0, { notation: 'compact', maximumFractionDigits: 1 });

  /* ------------------------------------------------------ the sheet, small */

  let sheetOpen = false;
  // Only compact layouts render the sheet, so a resize while it is open must
  // not leave the flag set on a layout that has no sheet to close.
  $: if (!$compact) sheetOpen = false;
</script>

<Screen
  crumbs={crumbsFor($pathname)}
  title={$t('wealth.screen.planning.title')}
  subtitle={$t('wealth.screen.planning.subtitle', {
    onTrack: summary.onTrack + summary.funded,
    total: summary.count,
  })}
>
  <svelte:fragment slot="aside">
    <md-chip
      variant="assist"
      appearance="outlined"
      icon="event"
      label={$t('wealth.app.reportingDate', { date: $t.formatDate(REPORTING_DATE, 'medium') })}
    ></md-chip>
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <md-button
      variant="text"
      size="sm"
      icon="filter_list_off"
      disabled={!filtering || undefined}
      on:mdClick={clearFilters}
    >
      {$t('wealth.action.clearFilters')}
    </md-button>
  </svelte:fragment>

  <section class="kpi-grid">
    <KpiTile label={$t('wealth.table.targetAmount')} hint={$t('wealth.kpi.goals')}>
      <svelte:fragment slot="value"><Money value={summary.targetTotal} compact /></svelte:fragment>
      <svelte:fragment slot="trailing"><Count value={summary.count} /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('wealth.table.funded')}>
      <svelte:fragment slot="value"><Percent value={summary.fundedPct} digits={0} /></svelte:fragment>
      <svelte:fragment slot="hint"><Money value={summary.fundedTotal} compact /></svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.kpi.goalsOnTrack')}
      value={$t.formatNumber(summary.onTrack + summary.funded, { maximumFractionDigits: 0 })}
      hint={$t('wealth.kpi.goalsAtRisk')}
    >
      <svelte:fragment slot="trailing">
        <Count
          value={summary.atRisk + summary.behind}
          color={summary.atRisk + summary.behind > 0 ? 'warning' : 'primary'}
        />
      </svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('wealth.table.shortfall')} hint={$t('wealth.table.contribution')}>
      <svelte:fragment slot="value"><Money value={summary.shortfallTotal} compact /></svelte:fragment>
      <svelte:fragment slot="trailing">
        <span class="num"><Money value={summary.monthlyContributionTotal} compact /></span>
      </svelte:fragment>
    </KpiTile>
  </section>

  <Panel
    title={$t('wealth.panel.objectives')}
    subtitle={$t('wealth.common.showing', { shown: summary.count, total })}
  >
    <div class="plan-filters">
      <SelectField
        label={$t('wealth.table.household')}
        value={householdId}
        onChange={(value) => (householdId = value)}
      >
        <md-select-option value={ALL}>{$t('wealth.common.all')}</md-select-option>
        {#each households as household (household.id)}
          <md-select-option value={household.id}>{household.name}</md-select-option>
        {/each}
      </SelectField>

      <SelectField label={$t('wealth.table.type')} value={type} onChange={(value) => (type = value)}>
        <md-select-option value={ALL}>{$t('wealth.common.all')}</md-select-option>
        {#each typeOptions as value (value)}
          <md-select-option {value}>{$t(`wealth.goalType.${value}`)}</md-select-option>
        {/each}
      </SelectField>

      <SelectField
        label={$t('wealth.table.status')}
        value={status}
        onChange={(value) => (status = value)}
      >
        <md-select-option value={ALL}>{$t('wealth.common.all')}</md-select-option>
        {#each statusOptions as value (value)}
          <md-select-option {value}>{$t(`wealth.goalStatus.${value}`)}</md-select-option>
        {/each}
      </SelectField>

      <SelectField
        label={$t('wealth.action.sortBy')}
        value={sortBy}
        onChange={setSortBy}
      >
        {#each SORT_OPTIONS as option (option.value)}
          <md-select-option value={option.value}>{$t(option.labelKey)}</md-select-option>
        {/each}
      </SelectField>
    </div>

    {#if filtered.length === 0}
      <EmptyState message={$t('wealth.empty.goals')} hint />
    {:else}
      <div class="grid-3 plan-goals">
        {#each filtered as goal (goal.id)}
          <GoalCard
            {goal}
            selected={selected?.id === goal.id}
            swatch={categoryColors[goal.type]}
          />
        {/each}
      </div>
    {/if}
  </Panel>

  {#if selected}
    <div class="grid-wide">
      <Panel
        title={$t('wealth.panel.projection')}
        subtitle={$t('wealth.goal.assumedGrowth', {
          value: $t.formatPercent(selected.assumedAnnualGrowth, {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          }),
        })}
      >
        <svelte:fragment slot="actions">
          <div class="row row--end">
            <!-- THE BOX IS ALWAYS HERE, only its contents come and go.
                 Rendering the whole span conditionally added a 24px item to
                 this flex row the moment a projection recomputed, so the
                 select and the buttons beside it jumped left and back again
                 — a spinner that moves the controls it is reporting on. -->
            <span class="plan-busy" aria-hidden={!recomputing}>
              {#if recomputing}
                <md-loading-indicator label={$t('wealth.panel.projection')}></md-loading-indicator>
              {/if}
            </span>
            <SelectField
              label={$t('wealth.table.goal')}
              value={selected.id}
              onChange={(value) => (chosenId = value)}
              fullWidth={false}
            >
              {#each filtered as goal (goal.id)}
                <md-select-option value={goal.id}>
                  {`${$t(goal.typeKey)} · ${goal.householdName}`}
                </md-select-option>
              {/each}
            </SelectField>
            {#if $compact}
              <md-button variant="tonal" size="sm" icon="tune" on:mdClick={() => (sheetOpen = true)}>
                {$t('wealth.panel.projection')}
              </md-button>
            {/if}
          </div>
        </svelte:fragment>

        <div class="stack">
          <Chart
            tag="md-area-chart"
            label={`${$t(selected.typeKey)} · ${selected.householdName}`}
            {series}
            {xAxis}
            yAxis={{ min: 0 }}
            valueFormatter={money}
            locale={$state.locale}
            stack="none"
            curve="monotone"
            legend="bottom"
            height="340px"
            animation="none"
          />
          <!-- `yAxis={{ min: 0 }}`: area encodes magnitude, so the value axis
               starts at zero. `stack="none"`, NOT the default `normal`: these
               three series are measured against each other, and stacking would
               add the target line on top of the projection. `animation="none"`:
               the chart is redrawn on every slider move; an entrance animation
               per move is noise, not motion design. -->

          <dl class="dl">
            <Fact label={$t('wealth.table.contribution')}>
              <Money value={shown.contribution} />
            </Fact>
            <Fact label={$t('wealth.table.targetDate')}>
              {#if horizonPoint}<DateText value={horizonPoint.date} />{/if}
            </Fact>
            <Fact label={$t('wealth.table.projected')}>
              <Money value={scenarioProjected} compact />
            </Fact>
            <Fact label={$t('wealth.table.targetAmount')}>
              <Money value={selected.targetAmount} compact />
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
            value={scenarioProjected}
            min="0"
            max={selected.targetAmount}
            color="secondary"
            thickness="10"
            label={$t('wealth.table.projected')}
            show-label
            show-value
            locale={$state.locale}
            value-text={$t.formatCurrency(scenarioProjected, {
              notation: 'compact',
              maximumFractionDigits: 1,
            })}
          ></md-meter>

          {#if !$compact}
            <Controls
              {selected}
              {contribution}
              {horizonIndex}
              {lastIndex}
              {livePoint}
              {adjusted}
              onContribution={setContribution}
              onHorizonIndex={setHorizonIndex}
              onReset={resetScenario}
            />
          {/if}
        </div>
      </Panel>

      <div class="stack">
        <Panel>
          <md-accordion variant="outlined" heading-level="3" default-expanded="0">
            <md-accordion-item
              headline={$t('wealth.goal.assumedGrowth', {
                value: $t.formatPercent(selected.assumedAnnualGrowth, {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                }),
              })}
              icon="functions"
            >
              <dl class="dl">
                <Fact label={$t('wealth.table.current')}>
                  <Money value={selected.currentAmount} />
                </Fact>
                <Fact label={$t('wealth.table.contribution')}>
                  <Money value={selected.monthlyContribution} />
                </Fact>
                <Fact label={$t('wealth.table.targetAmount')}>
                  <Money value={selected.targetAmount} />
                </Fact>
                <Fact label={$t('wealth.table.targetDate')}>
                  <DateText value={selected.targetDate} />
                </Fact>
                <Fact label={$t('wealth.table.funded')}>
                  <Percent value={selected.fundedPct} digits={0} />
                </Fact>
                <Fact label={$t('wealth.table.projected')}>
                  <Money value={selected.projectedAmount} compact />
                </Fact>
              </dl>
              <p class="muted">
                <bdi>
                  {$t('wealth.goal.projectedAt', {
                    value: $t.formatCurrency(selected.projectedAmount, {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }),
                  })}
                </bdi>
              </p>
              <p class="muted">
                {$t('wealth.common.since', { date: $t.formatDate(selected.createdDate, 'medium') })}
              </p>
            </md-accordion-item>

            <MandateAssumptions householdId={selected.householdId} />

            <md-accordion-item headline={$t(selected.typeKey)} icon="palette">
              <!--
                The category's colour in the chart legend.

                `status.ts` has a palette for asset classes and none for
                objective types, so there is nothing to derive this from — it
                is the reader's choice, which is what a colour picker is for.
                `presets` are the live theme roles, so the house colours are
                one tap away and follow the accent preset; the hex field stays
                on because a swatch alone is not an accessible carrier of the
                value.
              -->
              <md-color-picker
                class="plan-picker"
                variant="inline"
                format="hex"
                show-inputs="false"
                value={pickerValue}
                presets={presets.join(',')}
                aria-label={$t(selected.typeKey)}
                on:mdInput={onPickerInput}
                on:mdChange={onPickerChange}
              ></md-color-picker>
            </md-accordion-item>
          </md-accordion>
        </Panel>

        <Panel title={$t('wealth.panel.review')} subtitle={selected.householdName}>
          <svelte:fragment slot="actions">
            <Drill href={route.household(selected.householdId)}>
              {$t('wealth.action.openHousehold')}
            </Drill>
          </svelte:fragment>
          <AdviceInFlight householdId={selected.householdId} />
        </Panel>
      </div>
    </div>
  {/if}

  {#if $compact && selected}
    <!--
      NO `slot="actions"` ROW, and that is a finding rather than a preference.
      The dock is a floating bar pinned to the bottom of the viewport, and at
      420px it sits ON TOP of a bottom sheet's actions row — an action button
      there is visible, enabled, and unclickable, because the dock takes the
      pointer. Verified with `elementsFromPoint`, which returns
      AWC-SHOWCASE-DOCK above the button.

      Nothing is lost. There is nothing to commit here: the sliders apply
      live, so a sheet action would only ever have meant "close". The component
      already offers four ways out that are nowhere near the dock — the
      `closeable` ✕ in the header, the drag handle, the scrim and Escape — and
      all four emit `mdClose`, which is what the handler below listens to.
    -->
    <md-bottom-sheet
      open={sheetOpen || undefined}
      variant="standard"
      closeable
      headline={$t('wealth.panel.projection')}
      aria-label={$t('wealth.panel.projection')}
      top-divider
      on:mdClose={() => (sheetOpen = false)}
    >
      <div class="plan-sheet-body">
        <Controls
          {selected}
          {contribution}
          {horizonIndex}
          {lastIndex}
          {livePoint}
          {adjusted}
          onContribution={setContribution}
          onHorizonIndex={setHorizonIndex}
          onReset={resetScenario}
        />
      </div>
    </md-bottom-sheet>
  {/if}

  <!--
    The placeholder for THIS screen, rather than the generic one — measured off
    the React build (its `PlanningSkeleton` carries the full reasoning): the
    generic `ScreenSkeleton`'s tiles carry a sparkline and these do not (194px
    against a real 152), and it stops after two half-width panels where this
    screen has a full-width objectives board and a wide/narrow split under it.

      .kpi-grid      four tiles, no spark        152px
      the panel      filters + twelve goals     1766px
      .grid-wide     projection | assumptions    816px

    `PanelSkeleton` draws 90px of its own chrome — a 16px card inset, a 16px
    panel inset, a 14px head and the 12px gap under it — so each `height` below
    is the real block MINUS 90. That is why they are not round numbers.

    ONE ANNOUNCEMENT: the first KPI tile carries the screen's name and is the
    only shape that speaks. `foot` is the tile's own last line — 32 where a
    chip sits beside the hint, 16 where the hint is text alone.
  -->
  <svelte:fragment slot="skeleton">
    <section class="kpi-grid">
      <KpiSkeleton announce label={$t('wealth.screen.planning.title')} spark={false} />
      <KpiSkeleton spark={false} foot="16px" />
      <KpiSkeleton spark={false} />
      <KpiSkeleton spark={false} foot="16px" />
    </section>

    <!-- The objectives board: a filter row and twelve goal cards in a
         `.grid-3`. One block rather than twelve card outlines, following the
         rule `TableSkeleton` states — a grid of uniform tiles is the same grey
         rectangle with more elements in the accessibility tree. -->
    <PanelSkeleton height="1676px" />

    <!-- The projection beside its assumptions. `.grid-wide` is a 2fr/1fr pair
         and the row is as tall as the taller cell, so the chart panel is what
         sets the 816px; the two on the right are their own heights. -->
    <div class="grid-wide">
      <PanelSkeleton height="726px" />
      <div class="stack">
        <PanelSkeleton height="442px" />
        <PanelSkeleton height="74px" />
      </div>
    </div>
  </svelte:fragment>
</Screen>
