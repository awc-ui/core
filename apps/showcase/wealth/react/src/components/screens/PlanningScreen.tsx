/**
 * Screen 6 — `/planning/`. Client objectives, and whether they land.
 *
 * WHAT THIS SCREEN IS FOR. An advisor looking at a book of objectives asks two
 * questions: which of these land, and what would it take to make the ones that
 * don't? The first is a filtered read of the fixture. The second is a what-if,
 * and it is the only genuinely live thing on the screen: two sliders feed the
 * kit's own projection formula and the chart, the figures and the meter all
 * move together.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THE WHAT-IF IS BUILT ON
 *
 * The app may construct an INPUT to the kit. It may never derive an OUTPUT.
 *
 * So a scenario is a `Goal` record with two fields replaced — a contribution
 * and a horizon — handed to `goalProjection()`, which is the same function that
 * produced the fixture's own `projectedAmount`. Every number this screen shows
 * comes back out of that call. Nothing is added, subtracted, divided or
 * compared against a threshold in this file: where a ratio is wanted, the
 * component is given `value` and `max` and works it out itself (`md-meter`,
 * `md-progress-indicator`), which is exactly what those two props are for.
 *
 * WHY THE SCENARIO CARRIES A SYNTHETIC ID. `goalProjection` memoises on
 * `goal.id`, so a modified goal reusing its own id would be served the
 * unmodified projection out of the cache. The id here encodes both varied
 * inputs, which keeps the cache correct rather than defeating it: same inputs,
 * same key, same answer. This is a workaround for a helper the kit does not yet
 * have — see the note in the handover.
 *
 * WHY THE HORIZON SLIDER SELECTS AN INDEX, NOT A NUMBER OF MONTHS. Shifting a
 * target DATE means adding months to an ISO date, which is arithmetic, which
 * belongs in the kit. `goalProjection` already computes a date for every sample
 * point it returns, so the slider picks one of those points: the horizon is
 * `points[i].month` and the adjusted target date is `points[i].date`, both
 * straight out of the kit. It also makes the two series share an x grid exactly
 * — a scenario asked for `maxPoints = i + 1` over `points[i].month` months
 * lands on precisely the baseline's first `i + 1` marks — so the band and the
 * line are measured at the same dates by construction, not by luck. The series
 * are still joined on `month` rather than on position, so a future change to
 * the kit's sampling degrades to a gap in the band instead of a misalignment.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT DECISIONS
 *
 * `md-meter` vs `md-progress-indicator` is the load-bearing one, and both
 * manuals draw the line in the same place: a meter is a STATE ("how full"), a
 * progress indicator is an ACTIVITY ("how far along"). So funding — the goal's
 * own funded percentage, and the scenario's projection against its target — is
 * a meter, every time. The determinate progress bar is the review of the
 * household's open proposals, `completedStepCount` of `stepCount`: a multi-step
 * job with a measurable position, which is the progress indicator's canonical
 * case, one indicator per activity.
 *
 * `md-loading-indicator` is wired to React's deferred render, not to a timer.
 * The sliders update at pointer speed; the projection, the chart and the
 * readout are recomputed as a deferred value, and the indicator appears exactly
 * while that work has not landed. On a fast machine it will rarely be seen —
 * which is the correct behaviour for an honest loading state, and the reason it
 * is not faked with a delay.
 *
 * `md-color-picker` is `variant="inline"` inside an accordion panel rather than
 * a popover: the panel surface is an `md-card`, which clips, and a popover
 * anchored inside one is asking to be sliced in half the way `md-badge` was.
 * It earns its place because the kit has no goal-type palette — `status.ts`
 * gives asset classes one (`ASSET_CLASS_PALETTE`) and objectives none — so the
 * category's colour in the chart legend is genuinely the reader's to assign.
 * `presets` are read from the live theme tokens, so the house colours are one
 * tap away and follow the dock's accent preset.
 *
 * The goal cards are NOT `interactive`. `md-card`'s manual is explicit: a card
 * whose content holds a focusable control (these hold chips) drops
 * `role="button"` and its tabindex, leaving mouse-only activation and no
 * keyboard path. Either the card is the control or its children are — so
 * selection is an `md-select` naming the objective, which is one labelled
 * control instead of twelve identically-named ones.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { useShowcase, useT } from '@/lib/showcase';
import { crumbsFor, route } from '@/lib/routes';
import { usePathname } from '@/lib/router';
import { Screen, EmptyState, Panel } from '../Shell';
import { KpiSkeleton, PanelSkeleton } from '../skeletons';
import { Count, DateText, Drill, Fact, KpiTile, Money, Percent } from '../bits';
import { AreaChart, useCustomEvent, type ChartSeries } from '../elements';
import {
  ActionButton,
  AdviceInFlight,
  flag,
  GoalCard,
  MandateAssumptions,
  SelectField,
  SliderControl,
  useCompact,
  useRoleColors,
} from './planning-parts';
import './planning.css';

/* --------------------------------------------------------------- constants */

/** `md-select`'s empty value means "nothing chosen", so the "all" row needs one of its own. */
const ALL = 'all';

/**
 * The what-if contribution slider's ceiling, as a multiple of the objective's
 * own monthly contribution, and its increment in euro.
 *
 * These bound a CONTROL; they are not a figure this screen reports. The value
 * the slider produces is fed to the kit and everything downstream of it comes
 * back out of `goalProjection`.
 */
const CONTRIBUTION_HEADROOM = 3;
const CONTRIBUTION_STEP = 500;

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

export function PlanningScreen() {
  const t = useT();
  const { state } = useShowcase();
  const pathname = usePathname();
  const compact = useCompact();

  /* ---------------------------------------------------------- the filters */

  const [householdId, setHouseholdId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [sortBy, setSortBy] = useState<NonNullable<GoalFilter['sortBy']>>('targetDate');

  const filtered = useMemo(
    () =>
      getGoals({
        householdId: householdId === ALL ? undefined : householdId,
        status: status === ALL ? undefined : (status as GoalStatus),
        type: type === ALL ? undefined : (type as GoalType),
        sortBy,
      }),
    [householdId, status, type, sortBy],
  );

  const summary = goalSummary(filtered);
  const total = getGoals().length;
  const filtering = householdId !== ALL || status !== ALL || type !== ALL;

  const clearFilters = useCallback(() => {
    setHouseholdId(ALL);
    setStatus(ALL);
    setType(ALL);
  }, []);

  /*
   * The option lists come from the fixture, not from a local copy of the enum:
   * a filter that offers a status no objective has is a dead row, and a second
   * declaration of the domain's vocabulary is exactly what rule zero is about.
   */
  const households = getHouseholds();
  const [statusOptions, typeOptions] = useMemo(() => {
    const all = getGoals();
    const byLabel = (key: (value: string) => string) => (a: string, b: string) =>
      t(key(a)).localeCompare(t(key(b)), t.locale);
    return [
      [...new Set(all.map((g) => g.status))].sort(byLabel((v) => `wealth.goalStatus.${v}`)),
      [...new Set(all.map((g) => g.type))].sort(byLabel((v) => `wealth.goalType.${v}`)),
    ] as [GoalStatus[], GoalType[]];
  }, [t]);

  /* -------------------------------------------------- the chosen objective */

  const [chosenId, setChosenId] = useState('');
  const selected = filtered.find((goal) => goal.id === chosenId) ?? filtered[0];

  /* ------------------------------------------------------------ the what-if */

  /**
   * The baseline path. `goalProjection` samples it and the samples are what the
   * horizon slider moves between, so this array is the x grid, the date
   * vocabulary and the slider's range all at once.
   */
  const basePoints = useMemo(() => (selected ? goalProjection(selected) : []), [selected]);
  const lastIndex = Math.max(1, basePoints.length - 1);

  /*
   * The draft is kept keyed to the objective it belongs to rather than reset in
   * an effect: picking another objective must show that objective's own plan,
   * and an effect would render the previous one's numbers for a frame first.
   */
  const [draft, setDraft] = useState<{
    goalId: string;
    contribution: number;
    horizonIndex: number;
  } | null>(null);

  const active = selected && draft?.goalId === selected.id ? draft : null;
  const contribution = active ? active.contribution : (selected?.monthlyContribution ?? 0);
  const horizonIndex = active ? Math.min(active.horizonIndex, lastIndex) : lastIndex;
  const adjusted = Boolean(active) && (contribution !== selected?.monthlyContribution || horizonIndex !== lastIndex);

  const setContribution = useCallback(
    (value: number) => {
      if (!selected) return;
      setDraft({ goalId: selected.id, contribution: value, horizonIndex });
    },
    [selected, horizonIndex],
  );

  const setHorizonIndex = useCallback(
    (value: number) => {
      if (!selected) return;
      setDraft({ goalId: selected.id, contribution, horizonIndex: Math.round(value) });
    },
    [selected, contribution],
  );

  const resetScenario = useCallback(() => setDraft(null), []);

  /*
   * The sliders move at pointer speed; the projection, the chart and the
   * readout follow as a deferred render, and the loading indicator is on
   * exactly while they have not caught up. Deferring the whole scenario rather
   * than the chart alone keeps the figures and the plot showing one consistent
   * state instead of two.
   */
  const wanted = useMemo(
    () => ({ goalId: selected?.id ?? '', contribution, horizonIndex }),
    [selected?.id, contribution, horizonIndex],
  );
  const deferred = useDeferredValue(wanted);
  // A deferred value from the PREVIOUS objective would be measured against the
  // wrong baseline, so that one case falls through to the current input.
  const shown = deferred.goalId === wanted.goalId ? deferred : wanted;
  const recomputing = shown !== wanted;

  /** What the chart and the readout are measured at — the deferred horizon. */
  const horizonPoint = basePoints[shown.horizonIndex] ?? basePoints[basePoints.length - 1];
  /** What the slider itself is at. A control must never lag its own thumb. */
  const livePoint = basePoints[horizonIndex] ?? horizonPoint;

  /**
   * The scenario, as an input to the kit.
   *
   * Two fields replaced and a cache key that names both of them. Everything
   * downstream — the projected amount, the path, the dates — is whatever
   * `goalProjection` returns for it.
   */
  const scenarioPoints = useMemo(() => {
    if (!selected || !horizonPoint) return [];
    const scenario: Goal = {
      ...selected,
      id: `${selected.id}~c${shown.contribution}~m${horizonPoint.month}`,
      monthlyContribution: shown.contribution,
      monthsRemaining: horizonPoint.month,
    };
    return goalProjection(scenario, shown.horizonIndex + 1);
  }, [selected, horizonPoint, shown.contribution, shown.horizonIndex]);

  const scenarioProjected = scenarioPoints.length
    ? scenarioPoints[scenarioPoints.length - 1].projected
    : 0;

  /* ------------------------------------------------- the category's colour */

  const [categoryColors, setCategoryColors] = useState<Partial<Record<GoalType, string>>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const presets = useRoleColors(PRESET_ROLES, `${state.theme}|${state.seed}`);

  // `mdInput` previews, `mdChange` commits — the picker's manual is explicit
  // that the first fires per pointer move and only the second is a decision.
  const pickerRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ value: string }>>(pickerRef, 'mdInput', (event) =>
    setPreview(event.detail?.value ?? null),
  );
  useCustomEvent<CustomEvent<{ value: string }>>(pickerRef, 'mdChange', (event) => {
    const value = event.detail?.value;
    if (!value || !selected) return;
    setCategoryColors((current) => ({ ...current, [selected.type]: value }));
    setPreview(null);
  });

  const committedColor = selected ? categoryColors[selected.type] : undefined;
  const categoryColor = preview ?? committedColor;
  // The band falls back to the `primary` ROLE, which the chart re-themes on its
  // own; the picker starts from that same role resolved to a hex, so the swatch
  // and the plot agree before anything is picked.
  const bandColor = categoryColor ?? 'primary';
  const pickerValue = categoryColor ?? presets[0];

  /* ------------------------------------------------------------- the chart */

  const chart = useMemo(() => {
    if (!selected || basePoints.length === 0) return null;

    // Joined on `month`, not on position: the two series are sampled at the
    // same marks by construction, and a lookup degrades to a gap if the kit's
    // sampling ever changes, where an index would quietly misalign them.
    const projectedByMonth = new Map<number, number>(
      scenarioPoints.map((point) => [point.month, point.projected] as const),
    );

    return {
      categories: basePoints.map((point) => t.formatDate(point.date, 'monthYear')),
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
        return [Math.min(point.projected, scenario), Math.max(point.projected, scenario)];
      }),
      baseline: basePoints.map((point) => point.projected),
      target: basePoints.map((point) => point.target),
    };
  }, [selected, basePoints, scenarioPoints, t]);

  const series = useMemo<ChartSeries[]>(() => {
    if (!chart) return [];
    /*
     * `range`, `fill`, `dash` and `color` are all real `MdChartSeries` fields —
     * see `utils/charts/types.ts` — but `ChartSeries` in `elements.tsx` only
     * declares the four this app had needed so far, and that file belongs to
     * the shell. The cast is the alternative to editing it; the handover asks
     * for the interface to be widened.
     */
    return [
      { label: t('wealth.table.projected'), range: chart.band, color: bandColor },
      {
        label: t('wealth.table.current'),
        data: chart.baseline,
        // A line drawn over a band must not fill down to the axis, or it buries
        // the band it is meant to sit inside.
        fill: false,
        color: 'tertiary',
      },
      {
        label: t('wealth.table.target'),
        data: chart.target,
        fill: false,
        dash: 'dotted',
        color: 'secondary',
      },
    ] as unknown as ChartSeries[];
  }, [chart, bandColor, t]);

  const money = useCallback(
    (value: number | null) =>
      t.formatCurrency(value ?? 0, { notation: 'compact', maximumFractionDigits: 1 }),
    [t],
  );

  /* ------------------------------------------------------- the sheet, small */

  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  useCustomEvent(sheetRef, 'mdClose', () => setSheetOpen(false));
  // Only compact layouts render the sheet, so a resize while it is open must
  // not leave the flag set on a layout that has no sheet to close.
  useEffect(() => {
    if (!compact) setSheetOpen(false);
  }, [compact]);

  /* --------------------------------------------------------------- controls */

  const controls = selected ? (
    <div className="stack">
      <SliderControl
        label={t('wealth.table.contribution')}
        display={<Money value={contribution} />}
        valueText={t.formatCurrency(contribution, { maximumFractionDigits: 0 })}
        value={contribution}
        min={0}
        max={Math.max(
          CONTRIBUTION_STEP,
          Math.ceil((selected.monthlyContribution * CONTRIBUTION_HEADROOM) / CONTRIBUTION_STEP) *
            CONTRIBUTION_STEP,
        )}
        step={CONTRIBUTION_STEP}
        onChange={setContribution}
      />

      <SliderControl
        label={t('wealth.table.targetDate')}
        display={livePoint ? <DateText value={livePoint.date} /> : null}
        valueText={t('wealth.goal.monthsRemaining', {
          count: t.formatNumber(livePoint?.month ?? 0, { maximumFractionDigits: 0 }),
        })}
        value={horizonIndex}
        min={1}
        max={lastIndex}
        step={1}
        // The increments ARE the projection's own sample points, so the ticks
        // are meaningful rather than implied precision.
        stops
        onChange={setHorizonIndex}
      />

      <div className="row row--between">
        <bdi className="muted">
          {t('wealth.goal.monthsRemaining', {
            count: t.formatNumber(livePoint?.month ?? 0, { maximumFractionDigits: 0 }),
          })}
        </bdi>
        {/*
          * `action.reset` is a CORE key, not a `wealth.` one. The wealth block
          * has no reset verb, and an invented key renders as the key itself —
          * `createTranslator` falls back to English and then to the string. The
          * core block is the shared chrome and is translated in every locale,
          * so borrowing it is the least-wrong option until
          * `wealth.action.reset` exists. Flagged in the handover.
          */}
        <ActionButton
          variant="text"
          size="sm"
          icon="restart_alt"
          disabled={!adjusted}
          onAction={resetScenario}
        >
          {t('action.reset')}
        </ActionButton>
      </div>
    </div>
  ) : null;

  /* ----------------------------------------------------------------- render */

  return (
    <Screen
      crumbs={crumbsFor(pathname)}
      title={t('wealth.screen.planning.title')}
      subtitle={t('wealth.screen.planning.subtitle', {
        onTrack: summary.onTrack + summary.funded,
        total: summary.count,
      })}
      skeleton={<PlanningSkeleton label={t('wealth.screen.planning.title')} />}
      aside={
        <md-chip
          variant="assist"
          appearance="outlined"
          icon="event"
          label={t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })}
        />
      }
      actions={
        <ActionButton
          variant="text"
          size="sm"
          icon="filter_list_off"
          disabled={!filtering}
          onAction={clearFilters}
        >
          {t('wealth.action.clearFilters')}
        </ActionButton>
      }
    >
      <section className="kpi-grid">
        <KpiTile
          label={t('wealth.table.targetAmount')}
          value={<Money value={summary.targetTotal} compact />}
          hint={t('wealth.kpi.goals')}
          trailing={<Count value={summary.count} />}
        />
        <KpiTile
          label={t('wealth.table.funded')}
          value={<Percent value={summary.fundedPct} digits={0} />}
          hint={<Money value={summary.fundedTotal} compact />}
        />
        <KpiTile
          label={t('wealth.kpi.goalsOnTrack')}
          value={t.formatNumber(summary.onTrack + summary.funded, { maximumFractionDigits: 0 })}
          hint={t('wealth.kpi.goalsAtRisk')}
          trailing={
            <Count
              value={summary.atRisk + summary.behind}
              color={summary.atRisk + summary.behind > 0 ? 'warning' : 'primary'}
            />
          }
        />
        <KpiTile
          label={t('wealth.table.shortfall')}
          value={<Money value={summary.shortfallTotal} compact />}
          hint={t('wealth.table.contribution')}
          trailing={
            <span className="num">
              <Money value={summary.monthlyContributionTotal} compact />
            </span>
          }
        />
      </section>

      <Panel
        title={t('wealth.panel.objectives')}
        subtitle={t('wealth.common.showing', { shown: summary.count, total })}
      >
        <div className="plan-filters">
          <SelectField
            label={t('wealth.table.household')}
            value={householdId}
            onChange={setHouseholdId}
          >
            <md-select-option value={ALL}>{t('wealth.common.all')}</md-select-option>
            {households.map((household) => (
              <md-select-option key={household.id} value={household.id}>
                {household.name}
              </md-select-option>
            ))}
          </SelectField>

          <SelectField label={t('wealth.table.type')} value={type} onChange={setType}>
            <md-select-option value={ALL}>{t('wealth.common.all')}</md-select-option>
            {typeOptions.map((value) => (
              <md-select-option key={value} value={value}>
                {t(`wealth.goalType.${value}`)}
              </md-select-option>
            ))}
          </SelectField>

          <SelectField label={t('wealth.table.status')} value={status} onChange={setStatus}>
            <md-select-option value={ALL}>{t('wealth.common.all')}</md-select-option>
            {statusOptions.map((value) => (
              <md-select-option key={value} value={value}>
                {t(`wealth.goalStatus.${value}`)}
              </md-select-option>
            ))}
          </SelectField>

          <SelectField
            label={t('wealth.action.sortBy')}
            value={sortBy}
            onChange={(value) => setSortBy(value as NonNullable<GoalFilter['sortBy']>)}
          >
            {SORT_OPTIONS.map((option) => (
              <md-select-option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </md-select-option>
            ))}
          </SelectField>

        </div>

        {filtered.length === 0 ? (
          <EmptyState message={t('wealth.empty.goals')} hint />
        ) : (
          <div className="grid-3 plan-goals">
            {filtered.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                selected={selected?.id === goal.id}
                swatch={categoryColors[goal.type]}
                t={t}
              />
            ))}
          </div>
        )}
      </Panel>

      {selected ? (
        <div className="grid-wide">
          <Panel
            title={t('wealth.panel.projection')}
            subtitle={t('wealth.goal.assumedGrowth', {
              value: t.formatPercent(selected.assumedAnnualGrowth, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              }),
            })}
            actions={
              <div className="row row--end">
                {/* THE BOX IS ALWAYS HERE, only its contents come and go.
                    Rendering the whole span conditionally added a 24px item to
                    this flex row the moment a projection recomputed, so the
                    select and the buttons beside it jumped left and back again
                    — a spinner that moves the controls it is reporting on. */}
                <span className="plan-busy" aria-hidden={!recomputing}>
                  {recomputing ? (
                    <md-loading-indicator label={t('wealth.panel.projection')} />
                  ) : null}
                </span>
                <SelectField
                  label={t('wealth.table.goal')}
                  value={selected.id}
                  onChange={setChosenId}
                  fullWidth={false}
                >
                  {filtered.map((goal) => (
                    <md-select-option key={goal.id} value={goal.id}>
                      {`${t(goal.typeKey)} · ${goal.householdName}`}
                    </md-select-option>
                  ))}
                </SelectField>
                {compact ? (
                  <ActionButton
                    variant="tonal"
                    size="sm"
                    icon="tune"
                    onAction={() => setSheetOpen(true)}
                  >
                    {t('wealth.panel.projection')}
                  </ActionButton>
                ) : null}
              </div>
            }
          >
            <div className="stack">
              <AreaChart
                label={`${t(selected.typeKey)} · ${selected.householdName}`}
                series={series}
                xAxis={{
                  data: chart?.categories ?? [],
                  scale: 'category',
                  // Everything past the adjusted horizon is outside the plan the
                  // sliders describe, so it is shaded and named rather than left
                  // to be inferred from where the band stops.
                  bands:
                    horizonPoint && shown.horizonIndex < basePoints.length - 1
                      ? [
                          {
                            from: shown.horizonIndex,
                            to: basePoints.length - 1,
                            label: t.formatDate(horizonPoint.date, 'monthYear'),
                            labelAlign: 'start',
                          },
                        ]
                      : undefined,
                }}
                // Area encodes magnitude, so the value axis starts at zero.
                yAxis={{ min: 0 }}
                valueFormatter={money}
                locale={state.locale}
                // NOT the default `normal`: these three series are measured
                // against each other, and stacking would add the target line on
                // top of the projection.
                stack="none"
                curve="monotone"
                legend="bottom"
                height="340px"
                // The chart is redrawn on every slider move; an entrance
                // animation per move is noise, not motion design.
                animation="none"
              />

              <dl className="dl">
                <Fact label={t('wealth.table.contribution')}>
                  <Money value={shown.contribution} />
                </Fact>
                <Fact label={t('wealth.table.targetDate')}>
                  {horizonPoint ? <DateText value={horizonPoint.date} /> : null}
                </Fact>
                <Fact label={t('wealth.table.projected')}>
                  <Money value={scenarioProjected} compact />
                </Fact>
                <Fact label={t('wealth.table.targetAmount')}>
                  <Money value={selected.targetAmount} compact />
                </Fact>
              </dl>

              {/*
                * Projected against target, as a STATE — the component is given
                * the amount and the target and works the ratio out itself, so
                * no division happens in this file. The bar clamps at the
                * target; `value-text` carries the unclamped amount, so an
                * over-funded projection still reads as the number it is.
                *
                * `secondary`, not a goal-status colour: the kit can classify
                * the fixture's own projection, not this scenario's, and
                * borrowing the baseline's colour would claim a verdict nothing
                * computed.
                */}
              <md-meter
                value={scenarioProjected}
                min="0"
                max={selected.targetAmount}
                color="secondary"
                thickness="10"
                label={t('wealth.table.projected')}
                show-label
                show-value
                locale={state.locale}
                value-text={t.formatCurrency(scenarioProjected, {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                })}
              />

              {compact ? null : controls}
            </div>
          </Panel>

          <div className="stack">
            <Panel>
              <md-accordion variant="outlined" heading-level="3" default-expanded="0">
                <md-accordion-item
                  headline={t('wealth.goal.assumedGrowth', {
                    value: t.formatPercent(selected.assumedAnnualGrowth, {
                      maximumFractionDigits: 1,
                      minimumFractionDigits: 1,
                    }),
                  })}
                  icon="functions"
                >
                  <dl className="dl">
                    <Fact label={t('wealth.table.current')}>
                      <Money value={selected.currentAmount} />
                    </Fact>
                    <Fact label={t('wealth.table.contribution')}>
                      <Money value={selected.monthlyContribution} />
                    </Fact>
                    <Fact label={t('wealth.table.targetAmount')}>
                      <Money value={selected.targetAmount} />
                    </Fact>
                    <Fact label={t('wealth.table.targetDate')}>
                      <DateText value={selected.targetDate} />
                    </Fact>
                    <Fact label={t('wealth.table.funded')}>
                      <Percent value={selected.fundedPct} digits={0} />
                    </Fact>
                    <Fact label={t('wealth.table.projected')}>
                      <Money value={selected.projectedAmount} compact />
                    </Fact>
                  </dl>
                  <p className="muted">
                    <bdi>
                    {t('wealth.goal.projectedAt', {
                      value: t.formatCurrency(selected.projectedAmount, {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }),
                    })}
                    </bdi>
                  </p>
                  <p className="muted">{t('wealth.common.since', { date: t.formatDate(selected.createdDate, 'medium') })}</p>
                </md-accordion-item>

                <MandateAssumptions householdId={selected.householdId} t={t} />

                <md-accordion-item headline={t(selected.typeKey)} icon="palette">
                  {/*
                    * The category's colour in the chart legend.
                    *
                    * `status.ts` has a palette for asset classes and none for
                    * objective types, so there is nothing to derive this from —
                    * it is the reader's choice, which is what a colour picker
                    * is for. `presets` are the live theme roles, so the house
                    * colours are one tap away and follow the accent preset; the
                    * hex field stays on because a swatch alone is not an
                    * accessible carrier of the value.
                    */}
                  <md-color-picker
                    ref={pickerRef}
                    class="plan-picker"
                    variant="inline"
                    format="hex"
                    show-inputs="false"
                    value={pickerValue}
                    presets={presets.join(',')}
                    aria-label={t(selected.typeKey)}
                  />
                </md-accordion-item>
              </md-accordion>
            </Panel>

            <Panel
              title={t('wealth.panel.review')}
              subtitle={selected.householdName}
              actions={
                <Drill href={route.household(selected.householdId)}>
                  {t('wealth.action.openHousehold')}
                </Drill>
              }
            >
              <AdviceInFlight householdId={selected.householdId} t={t} />
            </Panel>
          </div>
        </div>
      ) : null}

      {compact && selected ? (
        /*
         * NO `slot="actions"` ROW, and that is a finding rather than a
         * preference. The dock is a floating bar pinned to the bottom of the
         * viewport, and at 420px it sits ON TOP of a bottom sheet's actions
         * row — an action button there is visible, enabled, and unclickable,
         * because the dock takes the pointer. Verified with
         * `elementsFromPoint`, which returns AWC-SHOWCASE-DOCK above the
         * button.
         *
         * Nothing is lost. There is nothing to commit here: the sliders apply
         * live, so a sheet action would only ever have meant "close". The
         * component already offers four ways out that are nowhere near the
         * dock — the `closeable` ✕ in the header, the drag handle, the scrim
         * and Escape — and all four emit `mdClose`, which is what the state
         * below listens to.
         */
        <md-bottom-sheet
          ref={sheetRef}
          open={flag(sheetOpen)}
          variant="standard"
          closeable
          headline={t('wealth.panel.projection')}
          aria-label={t('wealth.panel.projection')}
          top-divider
        >
          <div className="plan-sheet-body">{controls}</div>
        </md-bottom-sheet>
      ) : null}
    </Screen>
  );
}

/* ---------------------------------------------------------------- skeleton */

/**
 * The placeholder for THIS screen, rather than the generic one.
 *
 * `<Screen>` falls back to `ScreenSkeleton` — a KPI row and two panels — and on
 * this screen that got two things wrong at once. Its tiles carry a sparkline
 * and these do not, which made the KPI row 194px against a real 152 and rode
 * everything below it 42px up the page; and it stopped after two half-width
 * panels where this screen has a full-width objectives board and a wide/narrow
 * split under it. Measured on a first visit through the rail: the content
 * region went from 612px of placeholder to 2766px of screen.
 *
 * Every block below mirrors the real one — same wrapper, same class, same
 * count — so only the contents of the boxes change when the data lands:
 *
 *   .kpi-grid      four tiles, no spark        152px
 *   the panel      filters + twelve goals     1766px
 *   .grid-wide     projection | assumptions    816px
 *
 * `PanelSkeleton` draws 90px of its own chrome — a 16px card inset, a 16px
 * panel inset, a 14px head and the 12px gap under it — so each `height` below
 * is the real block MINUS 90. That is why they are not round numbers.
 *
 * ONE ANNOUNCEMENT. `md-skeleton` is a polite live region by default, so a
 * screenful of them is a dozen announcements for one event. The first KPI tile
 * carries the screen's name and is the only one that speaks.
 */
function PlanningSkeleton({ label }: { label: string }) {
  return (
    <>
      {/* No `spark`: these tiles carry a figure and a hint, and the sparkline
          belongs to the overview's and the household's. `foot` is the tile's
          own last line — 32 where a chip sits beside the hint (the objective
          count, the at-risk count), 16 where the hint is text alone. */}
      <section className="kpi-grid">
        <KpiSkeleton announce label={label} spark={false} />
        <KpiSkeleton spark={false} foot="16px" />
        <KpiSkeleton spark={false} />
        <KpiSkeleton spark={false} foot="16px" />
      </section>

      {/* The objectives board: a filter row and twelve goal cards in a
          `.grid-3`. One block rather than twelve card outlines, following the
          rule `TableSkeleton` states — a grid of uniform tiles is the same grey
          rectangle with more elements in the accessibility tree. */}
      <PanelSkeleton height="1676px" />

      {/* The projection beside its assumptions. `.grid-wide` is a 2fr/1fr pair
          and the row is as tall as the taller cell, so the chart panel is what
          sets the 816px; the two on the right are their own heights. */}
      <div className="grid-wide">
        <PanelSkeleton height="726px" />
        <div className="stack">
          <PanelSkeleton height="442px" />
          <PanelSkeleton height="74px" />
        </div>
      </div>
    </>
  );
}
