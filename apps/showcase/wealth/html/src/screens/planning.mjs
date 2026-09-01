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
 * THE ONE RULE THE WHAT-IF IS BUILT ON — AND HOW A STATIC BUILD KEEPS IT
 *
 * The app may construct an INPUT to the kit. It may never derive an OUTPUT.
 *
 * A scenario is a `Goal` record with two fields replaced — a contribution and a
 * horizon — handed to `goalProjection()`, the same function that produced the
 * fixture's own `projectedAmount`. Nothing is added, subtracted, divided or
 * compared against a threshold: where a ratio is wanted the component is given
 * `value` and `max` and works it out itself (`md-meter`,
 * `md-progress-indicator`), which is what those two props are for.
 *
 * The other four builds hold that rule by calling `goalProjection` from a
 * render. THIS build holds it the same way, and that is the one decision on
 * this screen worth reading twice: `src/client/planning.mjs` imports
 * `goalProjection` and `goalSummary` from `@awc-ui/showcase-kit/wealth` and
 * calls them for real. Both functions take their data as an ARGUMENT — neither
 * touches the fixture — so the bundler tree-shakes the 200 kB of generated
 * records away and keeps ~11 kB of formulas. Precomputing every (contribution ×
 * horizon) pair into the page instead would have been ~200 kB of JSON per page
 * AND a second definition of what the answer is; shipping the kit's own
 * function is smaller and cannot drift.
 *
 * What the page therefore carries in `data-plan` is INPUT, not output: the
 * twelve `Goal` records as the fixture wrote them, the four sort orders exactly
 * as `getGoals({ sortBy })` returned them, and the slider ceilings. Everything
 * the reader ever sees comes back out of a kit call over those.
 *
 * WHY THE SCENARIO CARRIES A SYNTHETIC ID. `goalProjection` memoises on
 * `goal.id`, so a modified goal reusing its own id would be served the
 * unmodified projection out of the cache. The id encodes both varied inputs,
 * which keeps the cache correct rather than defeating it.
 *
 * WHY THE HORIZON SLIDER SELECTS AN INDEX, NOT A NUMBER OF MONTHS. Shifting a
 * target DATE means adding months to an ISO date, which is arithmetic, which
 * belongs in the kit. `goalProjection` already computes a date for every sample
 * point it returns, so the slider picks one of those points: the horizon is
 * `points[i].month` and the adjusted target date is `points[i].date`, both
 * straight out of the kit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS IN THE FILE AND WHAT IS BEHAVIOUR
 *
 * The document is React's FIRST RENDER, complete: no filters, sort by target
 * date, the first objective selected, its contribution and horizon at the
 * fixture's own values — which is the state where the scenario IS the baseline,
 * so the band the chart draws is zero-width and the figures are the goal's own.
 * All twelve objective cards, all four KPI tiles, the whole assumptions column
 * and the review panel are written out in the page's language.
 *
 * `src/client/planning.mjs` adds the four things a file cannot hold:
 *   - the four filters and the sort (cards DETACHED, never hidden; the order
 *     comes from the baked `getGoals({ sortBy })` id lists, so no comparator is
 *     re-implemented here);
 *   - the objective picker, which swaps the assumptions column for the chosen
 *     objective's `<template data-goal-side>` and re-feeds the chart;
 *   - the two sliders, which call `goalProjection` per move;
 *   - the colour picker's presets, which are LIVE THEME TOKENS and so cannot
 *     exist at build time at all.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT DECISIONS, carried over from the React screen with their reasons
 *
 * `md-meter` vs `md-progress-indicator` is the load-bearing one: a meter is a
 * STATE ("how full"), a progress indicator is an ACTIVITY ("how far along"). So
 * funding — the goal's funded percentage, and the scenario's projection against
 * its target — is a meter, every time. The determinate progress bar is the
 * review of the household's open proposals, `completedStepCount` of
 * `stepCount`: a multi-step job with a measurable position.
 *
 * `md-color-picker` is `variant="inline"` inside an accordion panel rather than
 * a popover: the panel surface is an `md-card`, which clips, and a popover
 * anchored inside one is asking to be sliced in half. It earns its place
 * because the kit has no goal-type palette — `status.ts` gives asset classes
 * one and objectives none — so the category's colour in the chart legend is
 * genuinely the reader's to assign.
 *
 * THE GOAL CARDS ARE NOT `interactive`, and their selected state is a DATA
 * ATTRIBUTE. `md-card`'s manual is explicit: a card whose content holds a
 * focusable control (these hold chips) drops `role="button"` and its tabindex,
 * leaving mouse-only activation and no keyboard path. So selection is an
 * `md-select` naming the objective — one labelled control instead of twelve
 * identically-named ones — and it is carried on `data-selected`, never on a
 * toggled `class`: the class list on an `md-*` element belongs to Stencil (its
 * host classes AND the runtime's `hydrated` flag live there), and rewriting it
 * paints the card `visibility: hidden` for good.
 *
 * NO BOOLEAN ATTRIBUTE IS EVER WRITTEN AS THE STRING "false". `attrs()` omits
 * `false` / `null` / `undefined` outright and writes a bare attribute for
 * `true`, which is `flag()` from the React build enforced by the helper rather
 * than remembered at each call site: `md-button`, `md-select` and `md-slider`
 * are form-associated, and HTML says such an element carrying the `disabled`
 * ATTRIBUTE is "actually disabled" whatever the value says.
 */

import {
  crumbsFor,
  getGoals,
  getHouseholdById,
  getHouseholds,
  getPortfolioFor,
  getProposals,
  goalProjection,
  goalSummary,
  REPORTING_DATE,
  route,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html } from '../lib/html.mjs';
import { areaChart } from '../lib/charts.mjs';
import {
  count,
  dateText,
  drill,
  fact,
  fundedMeter,
  goalStatusChip,
  goalStatusDot,
  kpiTile,
  mandateChip,
  money,
  percent,
  priorityChip,
  riskProfileChip,
  strategyChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

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
const SORT_OPTIONS = [
  { value: 'targetDate', labelKey: 'wealth.table.targetDate' },
  { value: 'targetAmount', labelKey: 'wealth.table.targetAmount' },
  { value: 'fundedPct', labelKey: 'wealth.table.funded' },
  { value: 'priority', labelKey: 'wealth.table.priority' },
];

/**
 * The theme roles offered as colour presets, in the order `md-color-picker`
 * shows them. Role NAMES, not colours — the client resolves them from the live
 * token sheet, so the swatches follow the dock's accent preset and dark mode
 * instead of freezing a hex into this file. There is nothing to render here:
 * a build has no computed style to read.
 */
const PRESET_ROLES = ['primary', 'tertiary', 'secondary', 'info', 'success'];

/** The chart's height, matching the React screen's `height="340px"`. */
const CHART_LG = '340px';

/** The slider ceiling for one objective. Bounds the CONTROL, reports nothing. */
const contributionMax = (goal) =>
  Math.max(
    CONTRIBUTION_STEP,
    Math.ceil((goal.monthlyContribution * CONTRIBUTION_HEADROOM) / CONTRIBUTION_STEP) *
      CONTRIBUTION_STEP,
  );

/* ------------------------------------------------------------------ pieces */

/**
 * An `md-button` that reports its activation.
 *
 * Bare, never wrapped: `md-toolbar` and the action rows wire roving focus over
 * their DIRECT children. The client listens to the component's own `mdClick`,
 * never the native `click`.
 */
function actionButton(t, { icon, label, variant = 'text', disabled = false, attributes = {} }) {
  return html`<md-button${attrs({
    variant,
    size: 'sm',
    icon,
    // `true` writes the bare attribute, `false` omits it — never `="false"`.
    disabled: disabled || undefined,
    ...attributes,
  })}>${label}</md-button>`;
}

/** An `md-select` carrying its options. `mdChange`'s detail is the new value. */
function selectField({ label, value, children, fullWidth = true, attributes = {} }) {
  return html`<md-select${attrs({
    variant: 'outlined',
    label,
    value,
    'full-width': fullWidth || undefined,
    ...attributes,
  })}>${children}</md-select>`;
}

/**
 * One what-if control: a label, the current value in words, and the slider.
 *
 * `controlled`, because the value belongs to the page, not the component. The
 * manual is blunt about the consequence of forgetting the handler — the thumb
 * follows the pointer and then springs back on commit — so the client writes on
 * `mdInput` (every move) and again on `mdChange` (release).
 *
 * There is no `value-indicator`: its bubble renders the raw number, which for
 * the horizon slider is a sample INDEX and for the contribution an unformatted
 * amount. The formatted value sits in the head row, where it is localised, and
 * in `value-text`, which is what a screen reader announces.
 */
function sliderControl({ label, display, valueText, value, min, max, step, stops, attributes = {} }) {
  return html`<div class="plan-control">
    <div class="plan-control__head">
      <span class="plan-control__label">${label}</span>
      <span class="plan-control__value">${display}</span>
    </div>
    <div class="plan-control__rail">
      <md-slider${attrs({
        controlled: true,
        size: 'sm',
        'aria-label': label,
        value,
        min,
        max,
        step,
        stops: stops || undefined,
        'value-text': valueText,
        ...attributes,
      })}></md-slider>
    </div>
  </div>`;
}

/**
 * One objective, as a card. Read-only: selection is the projection panel's
 * `md-select`, and it lands here as `data-selected` — a separate attribute the
 * client can toggle without ever touching the class list Stencil owns.
 *
 * The facets ride as `data-*` too, so the client filters on the fixture's own
 * values rather than on localised cell text.
 */
function goalCard(t, locale, goal, { selected = false } = {}) {
  return html`<md-card${attrs({
    variant: selected ? 'filled' : 'outlined',
    'data-selected': selected || undefined,
    'full-width': true,
    'full-height': true,
    'data-goal': goal.id,
    'data-household': goal.householdId,
    'data-type': goal.type,
    'data-status': goal.status,
  })}>
    <!-- goal-row--in-card: the md-card around this already draws the surface,
         so the body must not draw a second one — see the note in app.css. -->
    <div class="goal-row goal-row--in-card">
      <div class="row row--between">
        <span class="with-dot">
          ${goalStatusDot(t, goal.status)}
          <!-- The category's colour, once the reader has assigned one. Nothing
               is picked on a first render, so React has no swatch here either;
               the client inserts it on commit. -->
          <span class="strong">${t(goal.typeKey)}</span>
        </span>
        ${priorityChip(t, goal.priority)}
      </div>

      <!-- A proper noun, or the objective belongs to the household itself. -->
      <p class="muted">${goal.beneficiaryName ?? t('wealth.common.household')}</p>
      ${drill(locale, route.household(goal.householdId), goal.householdName)}

      ${fundedMeter(t, { fraction: goal.fundedPct, status: goal.status })}

      <div class="row row--between">
        <!--
          A bdi element, for the reason signed() in lib/bits.mjs carries one:
          this is a mixed-direction run. The template is the page's language,
          the two amounts are formatted numbers, and the word joining them is
          bidi-neutral — so under dir="rtl" the algorithm reorders it to
          "€900k of €792k" and the sentence says the opposite of what it means.
          bdi isolates the run and resolves its direction from its own first
          strong character, which keeps current-then-target.
        -->
        <bdi class="muted">${t('wealth.goal.fundedOf', {
          current: t.formatCurrency(goal.currentAmount, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }),
          target: t.formatCurrency(goal.targetAmount, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }),
        })}</bdi>
        ${goalStatusChip(t, goal.status)}
      </div>

      <dl class="dl">
        ${fact(t('wealth.table.targetDate'), dateText(t, goal.targetDate))}
        ${fact(t('wealth.table.contribution'), money(t, goal.monthlyContribution))}
        ${fact(t('wealth.table.projected'), money(t, goal.projectedAmount, { compact: true }))}
        ${fact(
          t('wealth.table.shortfall'),
          goal.projectedShortfall > 0
            ? money(t, goal.projectedShortfall, { compact: true })
            : html`<span class="muted">${t('wealth.common.none')}</span>`,
        )}
      </dl>

      <p class="muted"><bdi>${t('wealth.goal.monthsRemaining', {
        count: t.formatNumber(goal.monthsRemaining, { maximumFractionDigits: 0 }),
      })}</bdi></p>
    </div>
  </md-card>`;
}

/**
 * The household's open advice, each with its review position.
 *
 * The determinate bar is `completedStepCount` of `stepCount` — a count against
 * its total, handed to the component rather than pre-divided into a percentage,
 * which is what `value` / `max` are for.
 */
function adviceInFlight(t, householdId) {
  const proposals = getProposals({ householdId, open: true });

  if (proposals.length === 0) {
    return emptyState(t, t('wealth.empty.proposals'));
  }

  return html`<div>
    ${proposals.map((proposal) => {
      const position = t('wealth.proposal.stepProgress', {
        // 1-based for the reader; `currentStepIndex` is an array index.
        current: proposal.currentStepIndex + 1,
        total: proposal.stepCount,
      });
      const step = proposal.steps[proposal.currentStepIndex];
      return html`<div class="plan-progress">
        <div class="row row--between">
          <span class="strong">${t(proposal.typeKey)}</span>
          <bdi class="muted">${position}</bdi>
        </div>
        <md-progress-indicator${attrs({
          variant: 'linear',
          value: proposal.completedStepCount,
          max: proposal.stepCount,
          label: position,
        })}></md-progress-indicator>
        <div class="row row--between">
          <span class="muted">${step ? t(step.nameKey) : t(proposal.statusKey)}</span>
          <span class="muted">${money(t, proposal.estimatedValue, { compact: true })}</span>
        </div>
      </div>`;
    })}
  </div>`;
}

/** The mandate the growth assumption comes from. A standalone accordion item. */
function mandateAssumptions(t, householdId) {
  const household = getHouseholdById(householdId);
  const portfolio = getPortfolioFor(householdId);
  if (!household) return null;

  return html`<md-accordion-item${attrs({
    headline: t('wealth.panel.mandate'),
    icon: 'account_balance',
  })}>
    <div class="row">
      ${riskProfileChip(t, household.riskProfile)}
      ${strategyChip(t, household.strategy)}
      ${mandateChip(t, household.mandate)}
    </div>
    <dl class="dl">
      ${fact(t('wealth.table.benchmark'), portfolio?.benchmarkName ?? t('wealth.common.na'))}
      ${fact(t('wealth.table.aum'), money(t, household.totalAum, { compact: true }))}
      ${fact(t('wealth.table.ytd'), percent(t, household.ytdReturn, { digits: 1, sign: true }))}
      ${fact(t('wealth.table.nextReview'), dateText(t, household.nextReviewDate))}
    </dl>
  </md-accordion-item>`;
}

/* ------------------------------------------------------------- the columns */

/** The assumptions accordion and the review panel — everything that changes with the chosen objective. */
function sideColumn(t, locale, goal) {
  const growth = t('wealth.goal.assumedGrowth', {
    value: t.formatPercent(goal.assumedAnnualGrowth, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }),
  });

  return html`${panel({
      children: html`<md-accordion variant="outlined" heading-level="3" default-expanded="0">
        <md-accordion-item${attrs({ headline: growth, icon: 'functions' })}>
          <dl class="dl">
            ${fact(t('wealth.table.current'), money(t, goal.currentAmount))}
            ${fact(t('wealth.table.contribution'), money(t, goal.monthlyContribution))}
            ${fact(t('wealth.table.targetAmount'), money(t, goal.targetAmount))}
            ${fact(t('wealth.table.targetDate'), dateText(t, goal.targetDate))}
            ${fact(t('wealth.table.funded'), percent(t, goal.fundedPct, { digits: 0 }))}
            ${fact(t('wealth.table.projected'), money(t, goal.projectedAmount, { compact: true }))}
          </dl>
          <p class="muted"><bdi>${t('wealth.goal.projectedAt', {
            value: t.formatCurrency(goal.projectedAmount, {
              notation: 'compact',
              maximumFractionDigits: 1,
            }),
          })}</bdi></p>
          <p class="muted">${t('wealth.common.since', {
            date: t.formatDate(goal.createdDate, 'medium'),
          })}</p>
        </md-accordion-item>

        ${mandateAssumptions(t, goal.householdId)}

        <md-accordion-item${attrs({ headline: t(goal.typeKey), icon: 'palette' })}>
          <!--
            The category's colour in the chart legend.

            status.ts has a palette for asset classes and none for objective
            types, so there is nothing to derive this from — it is the reader's
            choice, which is what a colour picker is for. NEITHER value NOR
            presets IS WRITTEN HERE: both are MD3 role colours read off the
            live token sheet, which a build has no way to resolve (and freezing
            a hex would ignore the dock's accent preset and dark mode outright).
            The client resolves the roles carried in the panel's data-plan
            payload and assigns both. show-inputs="false" keeps the plate and
            sliders and drops the numeric entry; the hex field stays on,
            because a swatch alone is not an accessible carrier of the value.
          -->
          <md-color-picker${attrs({
            'data-plan-picker': true,
            class: 'plan-picker',
            variant: 'inline',
            format: 'hex',
            'show-inputs': 'false',
            'aria-label': t(goal.typeKey),
          })}></md-color-picker>
        </md-accordion-item>
      </md-accordion>`,
    })}

    ${panel({
      title: t('wealth.panel.review'),
      subtitle: goal.householdName,
      actions: drill(locale, route.household(goal.householdId), t('wealth.action.openHousehold')),
      children: adviceInFlight(t, goal.householdId),
    })}`;
}

/**
 * The four figures the scenario is read for, and the projection against the
 * target as a meter.
 *
 * On a first render the scenario IS the baseline — the contribution slider sits
 * at the objective's own contribution and the horizon at its own target date —
 * so every figure here is the goal's own, which is exactly what React renders
 * before anything is dragged.
 */
function figures(t, goal) {
  const points = goalProjection(goal);
  const last = points[points.length - 1];

  return html`<dl class="dl" data-plan-facts>
      ${fact(t('wealth.table.contribution'), money(t, goal.monthlyContribution))}
      ${fact(t('wealth.table.targetDate'), dateText(t, last.date))}
      ${fact(t('wealth.table.projected'), money(t, last.projected, { compact: true }))}
      ${fact(t('wealth.table.targetAmount'), money(t, goal.targetAmount, { compact: true }))}
    </dl>

    <!--
      Projected against target, as a STATE — the component is given the amount
      and the target and works the ratio out itself, so no division happens in
      this file. The bar clamps at the target; value-text carries the
      unclamped amount, so an over-funded projection still reads as the number
      it is.

      The colour is secondary, not a goal-status colour: the kit can classify the fixture's
      own projection, not this scenario's, and borrowing the baseline's colour
      would claim a verdict nothing computed.
    -->
    <md-meter${attrs({
      'data-plan-meter': true,
      value: last.projected,
      min: '0',
      max: goal.targetAmount,
      color: 'secondary',
      thickness: '10',
      label: t('wealth.table.projected'),
      'show-label': true,
      'show-value': true,
      locale: t.locale,
      'value-text': t.formatCurrency(last.projected, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    })}></md-meter>`;
}

/**
 * The two sliders and the reset, in ONE place.
 *
 * Rendered inline in the projection panel here, which is the desktop layout and
 * the one a reader with no JavaScript gets. Below 900px the client MOVES this
 * very node into the bottom sheet cloned from `<template data-plan-sheet>` and
 * moves it back on the way up — moved, never duplicated, because two
 * identically-labelled sliders in one document is exactly what the React build
 * refuses to render (and `md-bottom-sheet` never unmounts its content, so a
 * copy parked in there would be permanent).
 */
function controls(t, goal) {
  const points = goalProjection(goal);
  const lastIndex = Math.max(1, points.length - 1);
  const last = points[points.length - 1];
  const months = t('wealth.goal.monthsRemaining', {
    count: t.formatNumber(last.month, { maximumFractionDigits: 0 }),
  });

  return html`<div class="stack" data-plan-controls>
    ${sliderControl({
      label: t('wealth.table.contribution'),
      display: money(t, goal.monthlyContribution),
      valueText: t.formatCurrency(goal.monthlyContribution, { maximumFractionDigits: 0 }),
      value: goal.monthlyContribution,
      min: 0,
      max: contributionMax(goal),
      step: CONTRIBUTION_STEP,
      attributes: { 'data-plan-contribution': true },
    })}

    ${sliderControl({
      label: t('wealth.table.targetDate'),
      display: dateText(t, last.date),
      valueText: months,
      value: lastIndex,
      min: 1,
      max: lastIndex,
      step: 1,
      // The increments ARE the projection's own sample points, so the ticks are
      // meaningful rather than implied precision.
      stops: true,
      attributes: { 'data-plan-horizon': true },
    })}

    <div class="row row--between">
      <bdi class="muted" data-plan-months>${months}</bdi>
      <!--
        action.reset is a CORE key, not a wealth. one. The wealth block has no
        reset verb, and an invented key renders as the key itself. The core
        block is the shared chrome and is translated in every locale, so
        borrowing it is the least-wrong option until wealth.action.reset
        exists. Flagged in the handover, exactly as the React screen flags it.
      -->
      ${actionButton(t, {
        icon: 'restart_alt',
        label: t('action.reset'),
        // Nothing has been adjusted on a first render, so the reset is off —
        // omitted as a bare `disabled`, never written as the string "false".
        disabled: true,
        attributes: { 'data-plan-reset': true },
      })}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ screen */

export function planningScreen(t, locale) {
  const path = route.planning();

  /*
   * The default filter: nothing narrowed, sorted by target date — `GoalFilter`'s
   * own default, and React's initial state.
   */
  const filtered = getGoals({ sortBy: 'targetDate' });
  const all = getGoals();
  const summary = goalSummary(filtered);
  const total = all.length;
  const selected = filtered[0];

  const households = getHouseholds();

  /*
   * The option lists come from the fixture, not from a local copy of the enum:
   * a filter that offers a status no objective has is a dead row. Sorted by the
   * TRANSLATED label, in the page's own locale, exactly as React sorts them.
   */
  const byLabel = (key) => (a, b) => t(key(a)).localeCompare(t(key(b)), t.locale);
  const statusOptions = [...new Set(all.map((g) => g.status))].sort(
    byLabel((v) => `wealth.goalStatus.${v}`),
  );
  const typeOptions = [...new Set(all.map((g) => g.type))].sort(
    byLabel((v) => `wealth.goalType.${v}`),
  );

  /*
   * INPUT FOR THE CLIENT, never output.
   *
   * `goals` is the fixture's own records, `orders` is what `getGoals({ sortBy })`
   * returned for each of the four sorts — so filtering is a subset of a kit
   * order and no comparator is re-implemented in the browser. `contributionMax`
   * bounds a control. Nothing derived from any of it is stored.
   */
  const payload = {
    all: ALL,
    goals: all,
    orders: Object.fromEntries(
      SORT_OPTIONS.map((option) => [
        option.value,
        getGoals({ sortBy: option.value }).map((goal) => goal.id),
      ]),
    ),
    contributionMax: Object.fromEntries(all.map((goal) => [goal.id, contributionMax(goal)])),
    contributionStep: CONTRIBUTION_STEP,
    presetRoles: PRESET_ROLES,
  };

  const aside = html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'outlined',
    icon: 'event',
    label: t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') }),
  })}></md-chip>`;

  const actions = actionButton(t, {
    icon: 'filter_list_off',
    label: t('wealth.action.clearFilters'),
    // Nothing is filtered on a first render.
    disabled: true,
    attributes: { 'data-plan-clear': true },
  });

  const children = html`${kpiRow(t, summary)}

    ${objectivesPanel(t, locale, { filtered, summary, total, households, statusOptions, typeOptions, payload })}

    ${projection(t, locale, { filtered, selected })}

    ${compactTemplates(t)}

    <!-- One assumptions column per objective. The live one is in the document;
         these are what the picker swaps in. A template's content is inert, so
         the live DOM holds exactly one of them — the census React takes. -->
    ${all.map(
      (goal) => html`<template${attrs({ 'data-goal-side': goal.id })}>${sideColumn(t, locale, goal)}</template>`,
    )}`;

  return screen(t, {
    locale,
    here: path,
    title: t('wealth.screen.planning.title'),
    subtitle: t('wealth.screen.planning.subtitle', {
      onTrack: summary.onTrack + summary.funded,
      total: summary.count,
    }),
    crumbs: crumbsFor(path),
    aside,
    actions,
    children,
  });
}

/* ----------------------------------------------------------------- KPI row */

/**
 * The four opening figures, every one of them straight off `goalSummary`.
 *
 * No sparklines: there is no history behind an objective's funding in the
 * fixture, and drawing a flat line would invent one. `trailing` is a `count()`
 * chip rather than an `md-badge`, which would anchor to the card's corner and
 * be clipped in half.
 */
function kpiRow(t, summary) {
  const atRisk = summary.atRisk + summary.behind;

  return html`<section class="kpi-grid" data-plan-kpis>
    ${kpiTile(t, {
      label: t('wealth.table.targetAmount'),
      value: money(t, summary.targetTotal, { compact: true }),
      hint: t('wealth.kpi.goals'),
      trailing: count(t, summary.count),
    })}
    ${kpiTile(t, {
      label: t('wealth.table.funded'),
      value: percent(t, summary.fundedPct, { digits: 0 }),
      hint: money(t, summary.fundedTotal, { compact: true }),
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.goalsOnTrack'),
      value: t.formatNumber(summary.onTrack + summary.funded, { maximumFractionDigits: 0 }),
      hint: t('wealth.kpi.goalsAtRisk'),
      // The one colour choice this screen makes: a count of nothing is not a
      // warning. It is a test for zero, not a status mapping — every status
      // colour on this page comes from the kit's own maps.
      trailing: count(t, atRisk, { color: atRisk > 0 ? 'warning' : 'primary' }),
    })}
    ${kpiTile(t, {
      label: t('wealth.table.shortfall'),
      value: money(t, summary.shortfallTotal, { compact: true }),
      hint: t('wealth.table.contribution'),
      trailing: html`<span class="num">${money(t, summary.monthlyContributionTotal, {
        compact: true,
      })}</span>`,
    })}
  </section>`;
}

/* -------------------------------------------------------- objectives board */

function objectivesPanel(
  t,
  locale,
  { filtered, summary, total, households, statusOptions, typeOptions, payload },
) {
  const allOption = html`<md-select-option${attrs({ value: ALL })}>${t('wealth.common.all')}</md-select-option>`;

  return panel({
    title: t('wealth.panel.objectives'),
    subtitle: t('wealth.common.showing', { shown: summary.count, total }),
    attributes: {
      'data-plan-objectives': true,
      // `{shown} of {total}` with the shown count still open — the client fills
      // %shown% as the filters narrow, without re-translating.
      'data-count-template': t('wealth.common.showing', { shown: '%shown%', total }),
      // The kit records, the kit's four sort orders, the slider ceilings.
      'data-plan': JSON.stringify(payload),
    },
    children: html`<div class="plan-filters">
      ${selectField({
        label: t('wealth.table.household'),
        value: ALL,
        attributes: { 'data-filter-household': true },
        children: html`${allOption}
          ${households.map(
            (household) => html`<md-select-option${attrs({ value: household.id })}>${household.name}</md-select-option>`,
          )}`,
      })}

      ${selectField({
        label: t('wealth.table.type'),
        value: ALL,
        attributes: { 'data-filter-type': true },
        children: html`${allOption}
          ${typeOptions.map(
            (value) => html`<md-select-option${attrs({ value })}>${t(`wealth.goalType.${value}`)}</md-select-option>`,
          )}`,
      })}

      ${selectField({
        label: t('wealth.table.status'),
        value: ALL,
        attributes: { 'data-filter-status': true },
        children: html`${allOption}
          ${statusOptions.map(
            (value) => html`<md-select-option${attrs({ value })}>${t(`wealth.goalStatus.${value}`)}</md-select-option>`,
          )}`,
      })}

      ${selectField({
        label: t('wealth.action.sortBy'),
        value: SORT_OPTIONS[0].value,
        attributes: { 'data-filter-sort': true },
        children: SORT_OPTIONS.map(
          (option) => html`<md-select-option${attrs({ value: option.value })}>${t(option.labelKey)}</md-select-option>`,
        ),
      })}
    </div>

    <div class="grid-3 plan-goals" data-plan-goals>
      ${filtered.map((goal, index) => goalCard(t, locale, goal, { selected: index === 0 }))}
    </div>

    <!-- What a filter that matches nothing swaps the grid for. React renders one
         or the other, never both, so this waits in a template rather than
         sitting hidden in the document. The hint is on: this emptiness is
         always the reader's own filter. -->
    <template data-plan-goals-empty>${emptyState(t, t('wealth.empty.goals'), { hint: true })}</template>`,
  });
}

/* --------------------------------------------------------- the projection */

function projection(t, locale, { filtered, selected }) {
  if (!selected) return null;

  const points = goalProjection(selected);

  /*
   * The chart, at the unadjusted scenario.
   *
   * THE BAND IS ZERO-WIDTH HERE and that is not a placeholder: with the sliders
   * at the objective's own contribution and its own target date the scenario
   * and the baseline are the same path, so `[low, high]` is `[p, p]` at every
   * mark. That is precisely what React draws before anything is dragged. The
   * pair is ORDERED because a band is `[low, high]` — the chart's shape
   * requirement, not a figure about the objective.
   */
  const band = points.map((point) => [point.projected, point.projected]);

  const series = [
    // `primary` until the reader assigns the category a colour: the chart
    // re-themes a role on its own, and the picker starts from that same role
    // resolved to a hex, so the swatch and the plot agree before anything is
    // picked.
    { label: t('wealth.table.projected'), range: band, color: 'primary' },
    {
      label: t('wealth.table.current'),
      data: points.map((point) => point.projected),
      // A line drawn over a band must not fill down to the axis, or it buries
      // the band it is meant to sit inside.
      fill: false,
      color: 'tertiary',
    },
    {
      label: t('wealth.table.target'),
      data: points.map((point) => point.target),
      fill: false,
      dash: 'dotted',
      color: 'secondary',
    },
  ];

  const growth = t('wealth.goal.assumedGrowth', {
    value: t.formatPercent(selected.assumedAnnualGrowth, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }),
  });

  return html`<div class="grid-wide" data-plan-projection>
    ${panel({
      title: t('wealth.panel.projection'),
      subtitle: growth,
      actions: html`<div class="row row--end">
        <!-- THE BOX IS ALWAYS HERE, only its contents come and go. Rendering the
             whole span conditionally added a 24px item to this flex row the
             moment a projection recomputed, so the select and the buttons
             beside it jumped left and back again — a spinner that moves the
             controls it is reporting on. It is empty on this build: see the
             note in src/client/planning.mjs for why there is nothing honest to
             put in it. -->
        <span class="plan-busy" aria-hidden="true"></span>
        ${selectField({
          label: t('wealth.table.goal'),
          value: selected.id,
          fullWidth: false,
          attributes: { 'data-plan-goal-select': true },
          children: filtered.map(
            (goal) => html`<md-select-option${attrs({ value: goal.id })}>${t(goal.typeKey)} · ${goal.householdName}</md-select-option>`,
          ),
        })}
      </div>`,
      children: html`<div class="stack">
        ${areaChart({
          series,
          config: {
            // No `bands` on the x axis: the horizon starts at the objective's own
            // target date, so there is no stretch beyond the plan to shade. The
            // client adds one the moment the horizon is brought forward.
            xAxis: {
              data: points.map((point) => t.formatDate(point.date, 'monthYear')),
              scale: 'category',
            },
            // Area encodes magnitude, so the value axis starts at zero.
            yAxis: { min: 0 },
            format: 'currency',
          },
          attributes: {
            'data-plan-chart': true,
            label: `${t(selected.typeKey)} · ${selected.householdName}`,
            locale: t.locale,
            // NOT the default `normal`: these three series are measured against
            // each other, and stacking would add the target line on top of the
            // projection.
            stack: 'none',
            curve: 'monotone',
            legend: 'bottom',
            height: CHART_LG,
            // The chart is redrawn on every slider move; an entrance animation
            // per move is noise, not motion design.
            animation: 'none',
          },
        })}

        ${figures(t, selected)}

        ${controls(t, selected)}
      </div>`,
    })}

    <div class="stack" data-plan-side>${sideColumn(t, locale, selected)}</div>
  </div>`;
}

/* ---------------------------------------------------------- compact layout */

/**
 * The two elements that exist ONLY below 900px, parked inert.
 *
 * React gates them behind `useMediaQuery('(max-width: 899px)')` and mounts or
 * unmounts them; this build ships them in `<template>`s and the client clones
 * them in and out on the same query — the overview's quick-actions idiom — so
 * the desktop document holds exactly the elements React's does.
 *
 * NO `slot="actions"` ROW ON THE SHEET, and that is a finding rather than a
 * preference. The dock is a floating bar pinned to the bottom of the viewport,
 * and at 420px it sits ON TOP of a bottom sheet's actions row — an action
 * button there is visible, enabled, and unclickable, because the dock takes the
 * pointer. Nothing is lost: the sliders apply live, so a sheet action would
 * only ever have meant "close", and the component already offers four ways out
 * that are nowhere near the dock — the `closeable` ✕, the drag handle, the
 * scrim and Escape — all of which emit `mdClose`.
 */
function compactTemplates(t) {
  const title = t('wealth.panel.projection');

  return html`<template data-plan-sheet>
      <md-bottom-sheet${attrs({
        variant: 'standard',
        closeable: true,
        headline: title,
        'aria-label': title,
        'top-divider': true,
      })}>
        <!-- Empty: the client MOVES the one control stack in here, so the
             document never holds two of them. -->
        <div class="plan-sheet-body"></div>
      </md-bottom-sheet>
    </template>

    <template data-plan-tune>
      <md-button${attrs({
        variant: 'tonal',
        size: 'sm',
        icon: 'tune',
        'data-plan-tune': true,
      })}>${title}</md-button>
    </template>`;
}
