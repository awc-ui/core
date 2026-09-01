import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  getGoals,
  getHouseholdById,
  getHouseholds,
  getPortfolioFor,
  getProposals,
  goalProjection,
  goalSummary,
  REPORTING_DATE,
  type Goal,
  type GoalFilter,
  type GoalProjectionPoint,
  type GoalStatus,
  type GoalType,
  type Household,
  type Portfolio,
  type Proposal,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { crumbsFor, type CrumbSpec } from '../lib/routes';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ChartComponent, type ChartSeries } from '../components/chart.component';
import { KpiSkeletonComponent, PanelSkeletonComponent } from '../components/skeletons.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  DotComponent,
  FactComponent,
  FundedMeterComponent,
  KpiTileComponent,
  MoneyComponent,
  PercentComponent,
} from '../components/bits.component';

/**
 * Screen 6 — `/planning/`. Client objectives, and whether they land. Ported
 * from the React build's `PlanningScreen.tsx` + `planning-parts.tsx`.
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
 * have — flagged in the React build's handover; the same flag stands here.
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
 * THE DEFERRED RECOMPUTE, WITHOUT `useDeferredValue`
 *
 * In the React reference the sliders update at pointer speed while the
 * projection, the chart and the readout follow as a DEFERRED value, and
 * `md-loading-indicator` is on exactly while the deferred value has not caught
 * up. Angular has no deferred-render primitive, so the same split is made by
 * hand: the LIVE inputs (`contribution`, `horizonIndex`) drive the sliders and
 * their head-row readouts synchronously, while everything measured — the
 * scenario, the chart, the facts, the meter — reads a `shown` copy that a
 * zero-delay macrotask catches up to after each slider event. The indicator is
 * on while the two disagree. On a fast machine it is rarely seen, which is the
 * correct behaviour for an honest loading state, and the reason it is not
 * faked with a delay. One case falls through synchronously, as in React: a
 * `shown` value from the PREVIOUS objective would be measured against the
 * wrong baseline, so a goal change catches up immediately with no beat.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT DECISIONS (all carried over from the React reference)
 *
 * `md-meter` vs `md-progress-indicator` is the load-bearing one: a meter is a
 * STATE ("how full"), a progress indicator is an ACTIVITY ("how far along").
 * So funding is a meter, every time; the review of the household's open
 * proposals — `completedStepCount` of `stepCount`, a multi-step job with a
 * measurable position — is the determinate progress indicator's canonical
 * case, one indicator per activity.
 *
 * `md-color-picker` is `variant="inline"` inside an accordion panel rather
 * than a popover: the panel surface is an `md-card`, which clips, and a
 * popover anchored inside one is asking to be sliced in half the way
 * `md-badge` was. It earns its place because the kit has no goal-type palette
 * — `status.ts` gives asset classes one and objectives none — so the
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
 *
 * PROPERTY BINDINGS AND STABLE REFERENCES. The React chart wrappers diff their
 * object props by JSON signature, so fresh literals per render are free there.
 * Angular dirty-checks a property binding by REFERENCE, so every object handed
 * to `<awc-chart>` below is built behind a single-slot memo keyed on the
 * values it was built from — `ShowcaseComponent.memo()` covers the
 * locale-only ones, and `lastMemo()` (local) covers the ones that also change
 * with the slider, without growing a cache entry per slider position.
 */

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

/**
 * Anything that is not a plain hex is dropped rather than handed to the
 * picker, which would flag its hex field invalid and keep its old colour.
 */
const PLAIN_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The two live inputs of the what-if, plus the objective they belong to. */
interface Scenario {
  goalId: string;
  contribution: number;
  horizonIndex: number;
}

/**
 * The chart's series, with the fields the planning plot needs. `range`,
 * `fill`, `dash` and `color` are all real `MdChartSeries` fields — see
 * `utils/charts/types.ts` — but the shared `ChartSeries` declares only the
 * four this app had needed so far, and `chart.component.ts` belongs to the
 * scaffold. The local widening is the alternative to editing it — the same
 * trade the React reference makes with a cast, and the overview makes for
 * `dash`; the handover asks for the interface to be widened.
 */
type PlanSeries = ChartSeries & {
  range?: ([number, number] | null)[];
  fill?: boolean;
  dash?: 'solid' | 'dashed' | 'dotted';
  color?: string;
};

/**
 * A single-slot memo: rebuild when the key changes, hand back the same
 * reference until it does. `ShowcaseComponent.memo()` keeps one entry PER KEY,
 * which is right for a locale-keyed value and wrong for a slider — a drag
 * would leave an entry per position it passed through. One slot is exactly
 * React `useMemo`'s retention.
 */
function lastMemo<V>(): (key: string, build: () => V) => V {
  let key: string | null = null;
  let value!: V;
  return (k, build) => {
    if (key !== k) {
      value = build();
      key = k;
    }
    return value;
  };
}

/* ---------------------------------------------------------- slider control */

/**
 * One what-if control: a label, the current value in words, and the slider.
 *
 * `controlled`, because the value is this screen's. The manual is blunt about
 * the consequence of forgetting the handler — the thumb follows the pointer
 * and then springs back on commit — so `mdInput` writes on every move and
 * `mdChange` writes again on release, through the same handler.
 *
 * There is no `value-indicator`: its bubble renders the raw number, which for
 * the horizon slider is a sample INDEX and for the contribution an unformatted
 * amount. The formatted value sits in the head row instead (projected content,
 * so the screen can put a `span[awcMoney]` or a `time[awcDate]` there), and in
 * `value-text`, which is what a screen reader announces.
 */
@Component({
  selector: 'awc-plan-slider-control',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="plan-control">
      <div class="plan-control__head">
        <span class="plan-control__label">{{ label }}</span>
        <span class="plan-control__value"><ng-content /></span>
      </div>
      <div class="plan-control__rail">
        <md-slider
          controlled
          size="sm"
          [attr.aria-label]="label"
          [attr.value]="value"
          [attr.min]="min"
          [attr.max]="max"
          [attr.step]="step"
          [attr.stops]="stops ? '' : null"
          [attr.value-text]="valueText"
          (mdInput)="onSlide($event)"
          (mdChange)="onSlide($event)"
        ></md-slider>
      </div>
    </div>
  `,
})
export class SliderControlComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) valueText!: string;
  @Input({ required: true }) value!: number;
  @Input({ required: true }) min!: number;
  @Input({ required: true }) max!: number;
  @Input({ required: true }) step!: number;
  /** The increments ARE the projection's own sample points on the horizon slider. */
  @Input() stops = false;

  @Output() changed = new EventEmitter<number>();

  protected onSlide(event: Event): void {
    const next = (event as CustomEvent<{ value: number }>).detail?.value;
    if (typeof next === 'number') this.changed.emit(next);
  }
}

/* ---------------------------------------------------------------- goal card */

/**
 * One objective, as a card. Read-only: selection is the panel's `md-select`.
 *
 * An ATTRIBUTE selector on `md-card` itself, so this component IS the card the
 * `.grid-3` lays out — no wrapper element between the grid and the surface,
 * exactly the DOM the React build renders.
 *
 * `data-selected`, NOT a toggled `class` — and in the React build this one
 * made the card disappear entirely. `class` on a custom element is a plain
 * attribute; a framework that REPLACES the whole list when the binding changes
 * wipes Stencil's `hydrated` flag with it, and the hydratedFlag CSS paints
 * anything without it `visibility: hidden`, permanently. Angular's `[class.x]`
 * bindings would actually toggle single tokens safely, but the selector in
 * `planning.css` is `[data-selected]` and every build must key the state the
 * same way, so the data attribute is bound here and no class ever changes.
 * `null` for the off state removes the attribute, so `[data-selected]` matches
 * only when it is on.
 */
@Component({
  selector: 'md-card[awcGoalCard]',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    'full-width': '',
    'full-height': '',
    '[attr.variant]': "selected ? 'filled' : 'outlined'",
    '[attr.data-selected]': "selected ? '' : null",
  },
  imports: [
    RouterLink,
    ChipComponent,
    DateTextComponent,
    DotComponent,
    FactComponent,
    FundedMeterComponent,
    MoneyComponent,
  ],
  template: `
    <!-- --in-card: the md-card around this already draws the surface, so the
         body must not draw a second one — see the note in app.css. -->
    <div class="goal-row goal-row--in-card">
      <div class="row row--between">
        <span class="with-dot">
          <md-status-dot awcDot kind="goal" [value]="goal.status"></md-status-dot>
          @if (swatch) {
            <span class="plan-swatch" [style.background]="swatch"></span>
          }
          <span class="strong">{{ t(goal.typeKey) }}</span>
        </span>
        <md-chip awcChip kind="priority" [value]="goal.priority"></md-chip>
      </div>

      <!-- A proper noun, or the objective belongs to the household itself. -->
      <p class="muted">{{ goal.beneficiaryName ?? t('wealth.common.household') }}</p>
      <a class="drill" [routerLink]="appPath(route.household(goal.householdId))">{{
        goal.householdName
      }}</a>

      <awc-funded-meter [fraction]="goal.fundedPct" [status]="goal.status" />

      <div class="row row--between">
        <!--
          <bdi>, for the reason the Signed bit carries one: this is a
          mixed-direction run. The template is English (the wealth block ships
          English only), the two amounts are formatted numbers, and the word
          joining them is bidi-neutral — so under dir="rtl" the algorithm
          reorders it to "€900k of €792k" and the sentence says the opposite of
          what it means. <bdi> isolates the run and resolves its direction from
          its own first strong character, which keeps current-then-target.
        -->
        <bdi class="muted">{{
          t('wealth.goal.fundedOf', {
            current: t.formatCurrency(goal.currentAmount, {
              notation: 'compact',
              maximumFractionDigits: 1
            }),
            target: t.formatCurrency(goal.targetAmount, {
              notation: 'compact',
              maximumFractionDigits: 1
            })
          })
        }}</bdi>
        <md-chip awcChip kind="goal" [value]="goal.status"></md-chip>
      </div>

      <dl class="dl">
        <div awcFact [label]="t('wealth.table.targetDate')">
          <time awcDate [value]="goal.targetDate"></time>
        </div>
        <div awcFact [label]="t('wealth.table.contribution')">
          <span awcMoney [value]="goal.monthlyContribution"></span>
        </div>
        <div awcFact [label]="t('wealth.table.projected')">
          <span awcMoney [value]="goal.projectedAmount" [compact]="true"></span>
        </div>
        <div awcFact [label]="t('wealth.table.shortfall')">
          @if (goal.projectedShortfall > 0) {
            <span awcMoney [value]="goal.projectedShortfall" [compact]="true"></span>
          } @else {
            <span class="muted">{{ t('wealth.common.none') }}</span>
          }
        </div>
      </dl>

      <p class="muted">
        <bdi>{{
          t('wealth.goal.monthsRemaining', {
            count: t.formatNumber(goal.monthsRemaining, { maximumFractionDigits: 0 })
          })
        }}</bdi>
      </p>
    </div>
  `,
})
export class GoalCardComponent extends ShowcaseComponent {
  @Input({ required: true }) goal!: Goal;
  @Input() selected = false;
  /** The reader-assigned category colour, if one has been picked. */
  @Input() swatch?: string;
}

/* --------------------------------------------------------- advice in flight */

/**
 * The household's open advice, each with its review position.
 *
 * The determinate bar is `completedStepCount` of `stepCount` — a count against
 * its total, handed to the component rather than pre-divided into a
 * percentage, which is what `value` / `max` are for.
 */
@Component({
  selector: 'awc-advice-in-flight',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [EmptyStateComponent, MoneyComponent],
  template: `
    @if (proposals.length === 0) {
      <awc-empty-state [message]="t('wealth.empty.proposals')" />
    } @else {
      <div>
        @for (proposal of proposals; track proposal.id) {
          <div class="plan-progress">
            <div class="row row--between">
              <span class="strong">{{ t(proposal.typeKey) }}</span>
              <bdi class="muted">{{ position(proposal) }}</bdi>
            </div>
            <md-progress-indicator
              variant="linear"
              [attr.value]="proposal.completedStepCount"
              [attr.max]="proposal.stepCount"
              [attr.label]="position(proposal)"
            ></md-progress-indicator>
            <div class="row row--between">
              <span class="muted">{{ stepName(proposal) }}</span>
              <span class="muted">
                <span awcMoney [value]="proposal.estimatedValue" [compact]="true"></span>
              </span>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class AdviceInFlightComponent extends ShowcaseComponent {
  @Input({ required: true }) householdId!: string;

  protected get proposals(): Proposal[] {
    return getProposals({ householdId: this.householdId, open: true });
  }

  /** 1-based for the reader; `currentStepIndex` is an array index. */
  protected position(proposal: Proposal): string {
    return this.t('wealth.proposal.stepProgress', {
      current: proposal.currentStepIndex + 1,
      total: proposal.stepCount,
    });
  }

  protected stepName(proposal: Proposal): string {
    const step = proposal.steps[proposal.currentStepIndex];
    return step ? this.t(step.nameKey) : this.t(proposal.statusKey);
  }
}

/* ------------------------------------------------------ mandate assumptions */

/**
 * The mandate the growth assumption comes from. A standalone accordion item —
 * an ATTRIBUTE selector on `md-accordion-item` itself, so the accordion sees a
 * direct item child rather than a wrapper it cannot manage. The React
 * reference returns `null` for an unknown household; here the SCREEN guards
 * with the same kit lookup, because a host element cannot remove itself.
 */
@Component({
  selector: 'md-accordion-item[awcMandateAssumptions]',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    icon: 'account_balance',
    '[attr.headline]': "t('wealth.panel.mandate')",
  },
  imports: [ChipComponent, DateTextComponent, FactComponent, MoneyComponent, PercentComponent],
  template: `
    @if (household; as household) {
      <div class="row">
        <md-chip awcChip kind="riskProfile" [value]="household.riskProfile"></md-chip>
        <md-chip awcChip kind="strategy" [value]="household.strategy"></md-chip>
        <md-chip awcChip kind="mandate" [value]="household.mandate"></md-chip>
      </div>
      <dl class="dl">
        <div awcFact [label]="t('wealth.table.benchmark')">
          {{ portfolio?.benchmarkName ?? t('wealth.common.na') }}
        </div>
        <div awcFact [label]="t('wealth.table.aum')">
          <span awcMoney [value]="household.totalAum" [compact]="true"></span>
        </div>
        <div awcFact [label]="t('wealth.table.ytd')">
          <span awcPercent [value]="household.ytdReturn" [digits]="1" [sign]="true"></span>
        </div>
        <div awcFact [label]="t('wealth.table.nextReview')">
          <time awcDate [value]="household.nextReviewDate"></time>
        </div>
      </dl>
    }
  `,
})
export class MandateAssumptionsComponent extends ShowcaseComponent {
  @Input({ required: true }) householdId!: string;

  protected get household(): Household | undefined {
    return getHouseholdById(this.householdId);
  }

  protected get portfolio(): Portfolio | undefined {
    return getPortfolioFor(this.householdId);
  }
}

/* ------------------------------------------------------------------ screen */

@Component({
  selector: 'awc-planning-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    ChartComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    CountComponent,
    DateTextComponent,
    FactComponent,
    KpiTileComponent,
    MoneyComponent,
    PercentComponent,
    SliderControlComponent,
    GoalCardComponent,
    AdviceInFlightComponent,
    MandateAssumptionsComponent,
  ],
  template: `
    <!--
      THE WHAT-IF CONTROLS ARE DECLARED ONCE and instantiated in exactly ONE
      place — inline in the projection panel above the 900px breakpoint, inside
      an md-bottom-sheet below it. Rendering both and hiding one with CSS would
      put two identically-labelled sliders in the document, and md-bottom-sheet
      never unmounts its content, so the copy in the sheet would be permanent.
      The ng-template lives at the template root so both outlets can reach it.
    -->
    <ng-template #controlsTpl>
      @if (selected; as goal) {
        <div class="stack">
          <awc-plan-slider-control
            [label]="t('wealth.table.contribution')"
            [valueText]="t.formatCurrency(contribution, { maximumFractionDigits: 0 })"
            [value]="contribution"
            [min]="0"
            [max]="contributionMax"
            [step]="contributionStep"
            (changed)="setContribution($event)"
          >
            <span awcMoney [value]="contribution"></span>
          </awc-plan-slider-control>

          <awc-plan-slider-control
            [label]="t('wealth.table.targetDate')"
            [valueText]="monthsRemainingText"
            [value]="horizonIndex"
            [min]="1"
            [max]="lastIndex"
            [step]="1"
            [stops]="true"
            (changed)="setHorizonIndex($event)"
          >
            @if (livePoint; as point) {
              <time awcDate [value]="point.date"></time>
            }
          </awc-plan-slider-control>

          <div class="row row--between">
            <bdi class="muted">{{ monthsRemainingText }}</bdi>
            <!--
              action.reset is a CORE key, not a wealth. one. The wealth block
              has no reset verb, and an invented key renders as the key itself
              — createTranslator falls back to English and then to the string.
              The core block is the shared chrome and is translated in every
              locale, so borrowing it is the least-wrong option until
              wealth.action.reset exists. Flagged in the handover.
            -->
            <md-button
              variant="text"
              size="sm"
              icon="restart_alt"
              [attr.disabled]="adjusted ? null : ''"
              (mdClick)="resetScenario()"
            >{{ t('action.reset') }}</md-button>
          </div>
        </div>
      }
    </ng-template>

    <awc-screen
      [title]="t('wealth.screen.planning.title')"
      [subtitle]="
        t('wealth.screen.planning.subtitle', {
          onTrack: summary.onTrack + summary.funded,
          total: summary.count
        })
      "
      [crumbs]="crumbs"
      [hasActions]="true"
      [customSkeleton]="true"
    >
      <md-chip
        aside
        variant="assist"
        appearance="outlined"
        icon="event"
        [attr.label]="
          t('wealth.app.reportingDate', { date: t.formatDate(reportingDate, 'medium') })
        "
      ></md-chip>

      <md-button
        actions
        variant="text"
        size="sm"
        icon="filter_list_off"
        [attr.disabled]="filtering ? null : ''"
        (mdClick)="clearFilters()"
      >{{ t('wealth.action.clearFilters') }}</md-button>

      <section class="kpi-grid">
        <awc-kpi-tile [label]="t('wealth.table.targetAmount')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcMoney [value]="summary.targetTotal" [compact]="true"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.goals') }}</ng-container>
          <ng-container ngProjectAs="[trailing]">
            <md-chip awcCount [value]="summary.count"></md-chip>
          </ng-container>
        </awc-kpi-tile>

        <awc-kpi-tile [label]="t('wealth.table.funded')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcPercent [value]="summary.fundedPct" [digits]="0"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">
            <span awcMoney [value]="summary.fundedTotal" [compact]="true"></span>
          </ng-container>
        </awc-kpi-tile>

        <awc-kpi-tile [label]="t('wealth.kpi.goalsOnTrack')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">{{
            t.formatNumber(summary.onTrack + summary.funded, { maximumFractionDigits: 0 })
          }}</ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.goalsAtRisk') }}</ng-container>
          <ng-container ngProjectAs="[trailing]">
            <md-chip
              awcCount
              [value]="summary.atRisk + summary.behind"
              [color]="summary.atRisk + summary.behind > 0 ? 'warning' : 'primary'"
            ></md-chip>
          </ng-container>
        </awc-kpi-tile>

        <awc-kpi-tile [label]="t('wealth.table.shortfall')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcMoney [value]="summary.shortfallTotal" [compact]="true"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.table.contribution') }}</ng-container>
          <ng-container ngProjectAs="[trailing]">
            <span class="num">
              <span awcMoney [value]="summary.monthlyContributionTotal" [compact]="true"></span>
            </span>
          </ng-container>
        </awc-kpi-tile>
      </section>

      <awc-panel
        [title]="t('wealth.panel.objectives')"
        [subtitle]="t('wealth.common.showing', { shown: summary.count, total: total })"
      >
        <div class="plan-filters">
          <md-select
            variant="outlined"
            full-width
            [attr.label]="t('wealth.table.household')"
            [attr.value]="householdId"
            (mdChange)="onHousehold($event)"
          >
            <md-select-option [attr.value]="all">{{ t('wealth.common.all') }}</md-select-option>
            @for (household of households; track household.id) {
              <md-select-option [attr.value]="household.id">{{ household.name }}</md-select-option>
            }
          </md-select>

          <md-select
            variant="outlined"
            full-width
            [attr.label]="t('wealth.table.type')"
            [attr.value]="type"
            (mdChange)="onType($event)"
          >
            <md-select-option [attr.value]="all">{{ t('wealth.common.all') }}</md-select-option>
            @for (value of options.types; track value) {
              <md-select-option [attr.value]="value">{{
                t('wealth.goalType.' + value)
              }}</md-select-option>
            }
          </md-select>

          <md-select
            variant="outlined"
            full-width
            [attr.label]="t('wealth.table.status')"
            [attr.value]="status"
            (mdChange)="onStatus($event)"
          >
            <md-select-option [attr.value]="all">{{ t('wealth.common.all') }}</md-select-option>
            @for (value of options.statuses; track value) {
              <md-select-option [attr.value]="value">{{
                t('wealth.goalStatus.' + value)
              }}</md-select-option>
            }
          </md-select>

          <md-select
            variant="outlined"
            full-width
            [attr.label]="t('wealth.action.sortBy')"
            [attr.value]="sortBy"
            (mdChange)="onSort($event)"
          >
            @for (option of sortOptions; track option.value) {
              <md-select-option [attr.value]="option.value">{{
                t(option.labelKey)
              }}</md-select-option>
            }
          </md-select>
        </div>

        @if (filtered.length === 0) {
          <awc-empty-state [message]="t('wealth.empty.goals')" [hint]="true" />
        } @else {
          <div class="grid-3 plan-goals">
            @for (goal of filtered; track goal.id) {
              <md-card
                awcGoalCard
                [goal]="goal"
                [selected]="selected?.id === goal.id"
                [swatch]="categoryColors[goal.type]"
              ></md-card>
            }
          </div>
        }
      </awc-panel>

      @if (selected; as goal) {
        <div class="grid-wide">
          <awc-panel [title]="t('wealth.panel.projection')" [subtitle]="assumedGrowthText">
            <div actions class="row row--end">
              <!-- THE BOX IS ALWAYS HERE, only its contents come and go.
                   Rendering the whole span conditionally added a 24px item to
                   this flex row the moment a projection recomputed, so the
                   select and the buttons beside it jumped left and back again
                   — a spinner that moves the controls it is reporting on. -->
              <span class="plan-busy" [attr.aria-hidden]="!recomputing">
                @if (recomputing) {
                  <md-loading-indicator
                    [attr.label]="t('wealth.panel.projection')"
                  ></md-loading-indicator>
                }
              </span>
              <md-select
                variant="outlined"
                [attr.label]="t('wealth.table.goal')"
                [attr.value]="goal.id"
                (mdChange)="onGoalPick($event)"
              >
                @for (option of filtered; track option.id) {
                  <md-select-option [attr.value]="option.id">{{
                    t(option.typeKey) + ' · ' + option.householdName
                  }}</md-select-option>
                }
              </md-select>
              @if (compact()) {
                <md-button variant="tonal" size="sm" icon="tune" (mdClick)="sheetOpen = true">{{
                  t('wealth.panel.projection')
                }}</md-button>
              }
            </div>

            <div class="stack">
              <!-- stack="none", NOT the default: these three series are
                   measured against each other, and stacking would add the
                   target line on top of the projection. animation="none": the
                   chart is redrawn on every slider move, and an entrance
                   animation per move is noise, not motion design. The value
                   axis starts at zero because area encodes magnitude. -->
              <awc-chart
                tag="md-area-chart"
                [label]="t(goal.typeKey) + ' · ' + goal.householdName"
                [series]="series"
                [xAxis]="xAxis"
                [yAxis]="yAxis"
                [valueFormatter]="money"
                stack="none"
                curve="monotone"
                legend="bottom"
                height="340px"
                animation="none"
              />

              <dl class="dl">
                <div awcFact [label]="t('wealth.table.contribution')">
                  <span awcMoney [value]="shownState.contribution"></span>
                </div>
                <div awcFact [label]="t('wealth.table.targetDate')">
                  @if (horizonPoint; as point) {
                    <time awcDate [value]="point.date"></time>
                  }
                </div>
                <div awcFact [label]="t('wealth.table.projected')">
                  <span awcMoney [value]="scenarioProjected" [compact]="true"></span>
                </div>
                <div awcFact [label]="t('wealth.table.targetAmount')">
                  <span awcMoney [value]="goal.targetAmount" [compact]="true"></span>
                </div>
              </dl>

              <!--
                Projected against target, as a STATE — the component is given
                the amount and the target and works the ratio out itself, so no
                division happens in this file. The bar clamps at the target;
                value-text carries the unclamped amount, so an over-funded
                projection still reads as the number it is.

                secondary, not a goal-status colour: the kit can classify the
                fixture's own projection, not this scenario's, and borrowing
                the baseline's colour would claim a verdict nothing computed.
              -->
              <md-meter
                [attr.value]="scenarioProjected"
                min="0"
                [attr.max]="goal.targetAmount"
                color="secondary"
                thickness="10"
                [attr.label]="t('wealth.table.projected')"
                show-label
                show-value
                [attr.locale]="t.locale"
                [attr.value-text]="
                  t.formatCurrency(scenarioProjected, {
                    notation: 'compact',
                    maximumFractionDigits: 1
                  })
                "
              ></md-meter>

              @if (!compact()) {
                <ng-container [ngTemplateOutlet]="controlsTpl" />
              }
            </div>
          </awc-panel>

          <div class="stack">
            <awc-panel>
              <md-accordion variant="outlined" heading-level="3" default-expanded="0">
                <md-accordion-item [attr.headline]="assumedGrowthText" icon="functions">
                  <dl class="dl">
                    <div awcFact [label]="t('wealth.table.current')">
                      <span awcMoney [value]="goal.currentAmount"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.contribution')">
                      <span awcMoney [value]="goal.monthlyContribution"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.targetAmount')">
                      <span awcMoney [value]="goal.targetAmount"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.targetDate')">
                      <time awcDate [value]="goal.targetDate"></time>
                    </div>
                    <div awcFact [label]="t('wealth.table.funded')">
                      <span awcPercent [value]="goal.fundedPct" [digits]="0"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.projected')">
                      <span awcMoney [value]="goal.projectedAmount" [compact]="true"></span>
                    </div>
                  </dl>
                  <p class="muted">
                    <bdi>{{
                      t('wealth.goal.projectedAt', {
                        value: t.formatCurrency(goal.projectedAmount, {
                          notation: 'compact',
                          maximumFractionDigits: 1
                        })
                      })
                    }}</bdi>
                  </p>
                  <p class="muted">{{
                    t('wealth.common.since', { date: t.formatDate(goal.createdDate, 'medium') })
                  }}</p>
                </md-accordion-item>

                @if (mandateHousehold) {
                  <md-accordion-item
                    awcMandateAssumptions
                    [householdId]="goal.householdId"
                  ></md-accordion-item>
                }

                <md-accordion-item [attr.headline]="t(goal.typeKey)" icon="palette">
                  <!--
                    The category's colour in the chart legend.

                    status.ts has a palette for asset classes and none for
                    objective types, so there is nothing to derive this from —
                    it is the reader's choice, which is what a colour picker is
                    for. presets are the live theme roles, so the house colours
                    are one tap away and follow the accent preset; the hex
                    field stays on because a swatch alone is not an accessible
                    carrier of the value. mdInput previews, mdChange commits —
                    the picker's manual is explicit that the first fires per
                    pointer move and only the second is a decision.
                  -->
                  <md-color-picker
                    class="plan-picker"
                    variant="inline"
                    format="hex"
                    show-inputs="false"
                    [attr.value]="pickerValue ?? null"
                    [attr.presets]="presets.join(',')"
                    [attr.aria-label]="t(goal.typeKey)"
                    (mdInput)="onPickerInput($event)"
                    (mdChange)="onPickerChange($event)"
                  ></md-color-picker>
                </md-accordion-item>
              </md-accordion>
            </awc-panel>

            <awc-panel [title]="t('wealth.panel.review')" [subtitle]="goal.householdName">
              <a actions class="drill" [routerLink]="appPath(route.household(goal.householdId))">{{
                t('wealth.action.openHousehold')
              }}</a>
              <awc-advice-in-flight [householdId]="goal.householdId" />
            </awc-panel>
          </div>
        </div>
      }

      @if (compact() && selected) {
        <!--
          NO slot="actions" ROW, and that is a finding rather than a
          preference. The dock is a floating bar pinned to the bottom of the
          viewport, and at 420px it sits ON TOP of a bottom sheet's actions row
          — an action button there is visible, enabled, and unclickable,
          because the dock takes the pointer. Verified in the React reference
          with elementsFromPoint, which returns AWC-SHOWCASE-DOCK above the
          button.

          Nothing is lost. There is nothing to commit here: the sliders apply
          live, so a sheet action would only ever have meant "close". The
          component already offers four ways out that are nowhere near the dock
          — the closeable ✕ in the header, the drag handle, the scrim and
          Escape — and all four emit mdClose, which is what the handler below
          listens to.
        -->
        <md-bottom-sheet
          [attr.open]="sheetOpen ? '' : null"
          variant="standard"
          closeable
          [attr.headline]="t('wealth.panel.projection')"
          [attr.aria-label]="t('wealth.panel.projection')"
          top-divider
          (mdClose)="sheetOpen = false"
        >
          <div class="plan-sheet-body">
            <ng-container [ngTemplateOutlet]="controlsTpl" />
          </div>
        </md-bottom-sheet>
      }

      <!--
        The placeholder for THIS screen, rather than the generic one.

        The generic fallback — a KPI row and two panels — got two things wrong
        at once on this screen: its tiles carry a sparkline and these do not
        (194px against a real 152, riding everything below 42px up the page),
        and it stopped after two half-width panels where this screen has a
        full-width objectives board and a wide/narrow split under it.

        Every block below mirrors the real one — same wrapper, same class, same
        count — so only the contents of the boxes change when the data lands:

          .kpi-grid      four tiles, no spark        152px
          the panel      filters + twelve goals     1766px
          .grid-wide     projection | assumptions    816px

        PanelSkeleton draws 90px of its own chrome — a 16px card inset, a 16px
        panel inset, a 14px head and the 12px gap under it — so each height
        below is the real block MINUS 90. That is why they are not round
        numbers. Exactly ONE shape announces: the first KPI tile, with the
        screen's name.
      -->
      <ng-container ngProjectAs="[skeleton]">
        <!-- No spark: these tiles carry a figure and a hint, and the sparkline
             belongs to the overview's and the household's. foot is the tile's
             own last line — 32 where a chip sits beside the hint (the
             objective count, the at-risk count), 16 where the hint is text
             alone. -->
        <section class="kpi-grid">
          <awc-kpi-skeleton
            [announce]="true"
            [label]="t('wealth.screen.planning.title')"
            [spark]="false"
          />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
          <awc-kpi-skeleton [spark]="false" />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
        </section>

        <!-- The objectives board: a filter row and twelve goal cards in a
             .grid-3. One block rather than twelve card outlines, following the
             rule TableSkeleton states — a grid of uniform tiles is the same
             grey rectangle with more elements in the accessibility tree. -->
        <awc-panel-skeleton height="1676px" />

        <!-- The projection beside its assumptions. .grid-wide is a 2fr/1fr
             pair and the row is as tall as the taller cell, so the chart panel
             is what sets the 816px; the two on the right are their own
             heights. -->
        <div class="grid-wide">
          <awc-panel-skeleton height="726px" />
          <div class="stack">
            <awc-panel-skeleton height="442px" />
            <awc-panel-skeleton height="74px" />
          </div>
        </div>
      </ng-container>
    </awc-screen>
  `,
})
export class PlanningScreen extends ShowcaseComponent implements OnInit, OnDestroy {
  protected readonly crumbs: CrumbSpec[] = crumbsFor(this.route.planning());
  protected readonly reportingDate = REPORTING_DATE;
  protected readonly all = ALL;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly contributionStep = CONTRIBUTION_STEP;

  /* ---------------------------------------------------------- the filters */

  protected householdId = ALL;
  protected status = ALL;
  protected type = ALL;
  protected sortBy: NonNullable<GoalFilter['sortBy']> = 'targetDate';

  protected readonly households = getHouseholds();
  protected readonly total = getGoals().length;

  private readonly filteredMemo = lastMemo<Goal[]>();
  protected get filtered(): Goal[] {
    return this.filteredMemo(
      `${this.householdId}|${this.status}|${this.type}|${this.sortBy}`,
      () =>
        getGoals({
          householdId: this.householdId === ALL ? undefined : this.householdId,
          status: this.status === ALL ? undefined : (this.status as GoalStatus),
          type: this.type === ALL ? undefined : (this.type as GoalType),
          sortBy: this.sortBy,
        }),
    );
  }

  private readonly summaryMemo = lastMemo<ReturnType<typeof goalSummary>>();
  protected get summary() {
    return this.summaryMemo(
      `${this.householdId}|${this.status}|${this.type}|${this.sortBy}`,
      () => goalSummary(this.filtered),
    );
  }

  protected get filtering(): boolean {
    return this.householdId !== ALL || this.status !== ALL || this.type !== ALL;
  }

  /*
   * The option lists come from the fixture, not from a local copy of the enum:
   * a filter that offers a status no objective has is a dead row, and a second
   * declaration of the domain's vocabulary is exactly what rule zero is about.
   * Sorted by localised label, so `memo()`'s locale key is the invalidation.
   */
  protected get options(): { statuses: GoalStatus[]; types: GoalType[] } {
    return this.memo('options', () => {
      const all = getGoals();
      const byLabel = (key: (value: string) => string) => (a: string, b: string) =>
        this.t(key(a)).localeCompare(this.t(key(b)), this.t.locale);
      return {
        statuses: [...new Set(all.map((g) => g.status))].sort(
          byLabel((v) => `wealth.goalStatus.${v}`),
        ) as GoalStatus[],
        types: [...new Set(all.map((g) => g.type))].sort(
          byLabel((v) => `wealth.goalType.${v}`),
        ) as GoalType[],
      };
    });
  }

  protected clearFilters(): void {
    this.householdId = ALL;
    this.status = ALL;
    this.type = ALL;
    this.catchUp();
  }

  protected onHousehold(event: Event): void {
    this.householdId = (event as CustomEvent<string>).detail ?? '';
    this.catchUp();
  }

  protected onType(event: Event): void {
    this.type = (event as CustomEvent<string>).detail ?? '';
    this.catchUp();
  }

  protected onStatus(event: Event): void {
    this.status = (event as CustomEvent<string>).detail ?? '';
    this.catchUp();
  }

  protected onSort(event: Event): void {
    this.sortBy = ((event as CustomEvent<string>).detail ??
      'targetDate') as NonNullable<GoalFilter['sortBy']>;
    this.catchUp();
  }

  /* ------------------------------------------------ the chosen objective */

  protected chosenId = '';

  protected get selected(): Goal | undefined {
    return this.filtered.find((goal) => goal.id === this.chosenId) ?? this.filtered[0];
  }

  protected onGoalPick(event: Event): void {
    this.chosenId = (event as CustomEvent<string>).detail ?? '';
    this.catchUp();
  }

  protected get mandateHousehold(): Household | undefined {
    const sel = this.selected;
    return sel ? getHouseholdById(sel.householdId) : undefined;
  }

  protected get assumedGrowthText(): string {
    const sel = this.selected;
    if (!sel) return '';
    return this.t('wealth.goal.assumedGrowth', {
      value: this.t.formatPercent(sel.assumedAnnualGrowth, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }),
    });
  }

  /* ---------------------------------------------------------- the what-if */

  /**
   * The baseline path. `goalProjection` samples it and the samples are what
   * the horizon slider moves between, so this array is the x grid, the date
   * vocabulary and the slider's range all at once.
   */
  private readonly basePointsMemo = lastMemo<GoalProjectionPoint[]>();
  protected get basePoints(): GoalProjectionPoint[] {
    const sel = this.selected;
    return this.basePointsMemo(sel?.id ?? '', () => (sel ? goalProjection(sel) : []));
  }

  protected get lastIndex(): number {
    return Math.max(1, this.basePoints.length - 1);
  }

  /*
   * The draft is kept keyed to the objective it belongs to rather than reset
   * on selection change: picking another objective must show that objective's
   * own plan, and `active` below simply stops matching when the goal moves on.
   */
  private draft: Scenario | null = null;

  private get active(): Scenario | null {
    const sel = this.selected;
    return sel && this.draft?.goalId === sel.id ? this.draft : null;
  }

  protected get contribution(): number {
    return this.active ? this.active.contribution : (this.selected?.monthlyContribution ?? 0);
  }

  protected get horizonIndex(): number {
    return this.active ? Math.min(this.active.horizonIndex, this.lastIndex) : this.lastIndex;
  }

  protected get adjusted(): boolean {
    return (
      this.active !== null &&
      (this.contribution !== this.selected?.monthlyContribution ||
        this.horizonIndex !== this.lastIndex)
    );
  }

  protected get contributionMax(): number {
    const sel = this.selected;
    if (!sel) return CONTRIBUTION_STEP;
    return Math.max(
      CONTRIBUTION_STEP,
      Math.ceil((sel.monthlyContribution * CONTRIBUTION_HEADROOM) / CONTRIBUTION_STEP) *
        CONTRIBUTION_STEP,
    );
  }

  protected setContribution(value: number): void {
    if (!this.selected) return;
    this.draft = { goalId: this.selected.id, contribution: value, horizonIndex: this.horizonIndex };
    this.deferRecompute();
  }

  protected setHorizonIndex(value: number): void {
    if (!this.selected) return;
    this.draft = {
      goalId: this.selected.id,
      contribution: this.contribution,
      horizonIndex: Math.round(value),
    };
    this.deferRecompute();
  }

  protected resetScenario(): void {
    this.draft = null;
    this.deferRecompute();
  }

  /*
   * The deferred copy of the inputs — what the chart, the facts and the meter
   * are measured at, one macrotask behind the sliders. See the header comment;
   * this is the hand-made `useDeferredValue`.
   */
  private shown: Scenario = { goalId: '', contribution: 0, horizonIndex: 0 };
  protected recomputing = false;
  private beatTimer: ReturnType<typeof setTimeout> | null = null;

  private wanted(): Scenario {
    return {
      goalId: this.selected?.id ?? '',
      contribution: this.contribution,
      horizonIndex: this.horizonIndex,
    };
  }

  /**
   * A deferred value from the PREVIOUS objective would be measured against the
   * wrong baseline, so that one case falls through to the current input — the
   * same guard the React reference applies to its deferred value.
   */
  protected get shownState(): Scenario {
    return this.shown.goalId === (this.selected?.id ?? '') ? this.shown : this.wanted();
  }

  /** Synchronous catch-up — a goal or filter change carries no busy beat. */
  private catchUp(): void {
    this.shown = this.wanted();
    this.recomputing = false;
  }

  /** Slider-driven catch-up: the measured views lag by one macrotask. */
  private deferRecompute(): void {
    this.recomputing = true;
    if (this.beatTimer !== null) return;
    // Zero-delay, not a debounce: the deferred copy catches up as soon as the
    // browser yields, exactly like React's deferred render — never later. The
    // timeout is zone-patched, so the catch-up renders on its own.
    this.beatTimer = setTimeout(() => {
      this.beatTimer = null;
      this.shown = this.wanted();
      this.recomputing = false;
    }, 0);
  }

  /** What the chart and the readout are measured at — the deferred horizon. */
  protected get horizonPoint(): GoalProjectionPoint | undefined {
    const points = this.basePoints;
    return points[this.shownState.horizonIndex] ?? points[points.length - 1];
  }

  /** What the slider itself is at. A control must never lag its own thumb. */
  protected get livePoint(): GoalProjectionPoint | undefined {
    return this.basePoints[this.horizonIndex] ?? this.horizonPoint;
  }

  protected get monthsRemainingText(): string {
    return this.t('wealth.goal.monthsRemaining', {
      count: this.t.formatNumber(this.livePoint?.month ?? 0, { maximumFractionDigits: 0 }),
    });
  }

  /**
   * The scenario, as an input to the kit.
   *
   * Two fields replaced and a cache key that names both of them. Everything
   * downstream — the projected amount, the path, the dates — is whatever
   * `goalProjection` returns for it.
   */
  private readonly scenarioMemo = lastMemo<GoalProjectionPoint[]>();
  protected get scenarioPoints(): GoalProjectionPoint[] {
    const sel = this.selected;
    const shown = this.shownState;
    const point = this.horizonPoint;
    return this.scenarioMemo(
      `${sel?.id ?? ''}|${shown.contribution}|${shown.horizonIndex}|${point?.month ?? -1}`,
      () => {
        if (!sel || !point) return [];
        const scenario: Goal = {
          ...sel,
          id: `${sel.id}~c${shown.contribution}~m${point.month}`,
          monthlyContribution: shown.contribution,
          monthsRemaining: point.month,
        };
        return goalProjection(scenario, shown.horizonIndex + 1);
      },
    );
  }

  protected get scenarioProjected(): number {
    const points = this.scenarioPoints;
    return points.length ? points[points.length - 1].projected : 0;
  }

  /* ----------------------------------------------- the category's colour */

  protected categoryColors: Partial<Record<GoalType, string>> = {};
  private preview: string | null = null;

  /**
   * The MD3 colour roles resolved to the hex strings the current theme
   * defines. `md-color-picker` needs concrete colours for `value` and
   * `presets` — a `var(--md-sys-color-primary)` reference is not something it
   * can parse — so the values are read back off the token sheet, which is the
   * one place they are defined. Keyed on theme|seed: both rewrite these custom
   * properties, and the dock's state signal is what re-runs this getter.
   */
  private readonly presetsMemo = lastMemo<string[]>();
  protected get presets(): string[] {
    const state = this.showcase.state();
    return this.presetsMemo(`${state.theme}|${state.seed}`, () => {
      if (typeof window === 'undefined') return [];
      const styles = window.getComputedStyle(document.documentElement);
      return PRESET_ROLES.map((role) =>
        styles.getPropertyValue(`--md-sys-color-${role}`).trim(),
      ).filter((value) => PLAIN_HEX.test(value));
    });
  }

  protected onPickerInput(event: Event): void {
    this.preview = (event as CustomEvent<{ value: string }>).detail?.value ?? null;
  }

  protected onPickerChange(event: Event): void {
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (!value || !this.selected) return;
    this.categoryColors = { ...this.categoryColors, [this.selected.type]: value };
    this.preview = null;
  }

  private get categoryColor(): string | undefined {
    const committed = this.selected ? this.categoryColors[this.selected.type] : undefined;
    return this.preview ?? committed;
  }

  /**
   * The band falls back to the `primary` ROLE, which the chart re-themes on
   * its own; the picker starts from that same role resolved to a hex, so the
   * swatch and the plot agree before anything is picked.
   */
  protected get bandColor(): string {
    return this.categoryColor ?? 'primary';
  }

  protected get pickerValue(): string | undefined {
    return this.categoryColor ?? this.presets[0];
  }

  /* ------------------------------------------------------------ the chart */

  private readonly chartMemo = lastMemo<{
    categories: string[];
    band: ([number, number] | null)[];
    baseline: number[];
    target: number[];
  } | null>();

  private get chartData() {
    const sel = this.selected;
    const shown = this.shownState;
    return this.chartMemo(
      `${this.t.locale}|${sel?.id ?? ''}|${shown.contribution}|${shown.horizonIndex}`,
      () => {
        if (!sel || this.basePoints.length === 0) return null;

        // Joined on `month`, not on position: the two series are sampled at
        // the same marks by construction, and a lookup degrades to a gap if
        // the kit's sampling ever changes, where an index would quietly
        // misalign them.
        const projectedByMonth = new Map<number, number>(
          this.scenarioPoints.map((point) => [point.month, point.projected] as const),
        );

        return {
          categories: this.basePoints.map((point) => this.t.formatDate(point.date, 'monthYear')),
          /*
           * The cone: the envelope between the current plan and the adjusted
           * one, which opens up over the horizon because the difference
           * compounds. The pair is ordered because a band is `[low, high]` —
           * that ordering is the chart's shape requirement, not a figure about
           * the objective. Beyond the adjusted horizon there is no scenario,
           * so the band gaps out there, which is the point of bringing the
           * target date forward.
           */
          band: this.basePoints.map((point) => {
            const scenario = projectedByMonth.get(point.month);
            if (scenario === undefined) return null;
            return [Math.min(point.projected, scenario), Math.max(point.projected, scenario)] as [
              number,
              number,
            ];
          }),
          baseline: this.basePoints.map((point) => point.projected),
          target: this.basePoints.map((point) => point.target),
        };
      },
    );
  }

  private readonly seriesMemo = lastMemo<ChartSeries[]>();
  protected get series(): ChartSeries[] {
    const sel = this.selected;
    const shown = this.shownState;
    return this.seriesMemo(
      `${this.t.locale}|${sel?.id ?? ''}|${shown.contribution}|${shown.horizonIndex}|${this.bandColor}`,
      () => {
        const chart = this.chartData;
        if (!chart) return [];
        const series: PlanSeries[] = [
          { label: this.t('wealth.table.projected'), range: chart.band, color: this.bandColor },
          {
            label: this.t('wealth.table.current'),
            data: chart.baseline,
            // A line drawn over a band must not fill down to the axis, or it
            // buries the band it is meant to sit inside.
            fill: false,
            color: 'tertiary',
          },
          {
            label: this.t('wealth.table.target'),
            data: chart.target,
            fill: false,
            dash: 'dotted',
            color: 'secondary',
          },
        ];
        return series;
      },
    );
  }

  private readonly xAxisMemo = lastMemo<Record<string, unknown>>();
  protected get xAxis(): Record<string, unknown> {
    const sel = this.selected;
    const shown = this.shownState;
    return this.xAxisMemo(`${this.t.locale}|${sel?.id ?? ''}|${shown.horizonIndex}`, () => {
      const point = this.horizonPoint;
      return {
        data: this.chartData?.categories ?? [],
        scale: 'category',
        // Everything past the adjusted horizon is outside the plan the sliders
        // describe, so it is shaded and named rather than left to be inferred
        // from where the band stops.
        bands:
          point && shown.horizonIndex < this.basePoints.length - 1
            ? [
                {
                  from: shown.horizonIndex,
                  to: this.basePoints.length - 1,
                  label: this.t.formatDate(point.date, 'monthYear'),
                  labelAlign: 'start',
                },
              ]
            : undefined,
      };
    });
  }

  protected get yAxis(): Record<string, unknown> {
    return this.memo('yAxis', () => ({ min: 0 }));
  }

  protected get money() {
    return this.memo('money', () => (value: number | null) =>
      this.t.formatCurrency(value ?? 0, { notation: 'compact', maximumFractionDigits: 1 }),
    );
  }

  /* ------------------------------------------------------ the sheet, small */

  protected sheetOpen = false;

  /*
   * The 900px breakpoint the shell already swaps the rail and the bar at, as
   * state. Starts `false` and settles in `ngOnInit`, so the first frame is the
   * same on every machine — the same first-frame semantics as the React hook.
   * Only compact layouts render the sheet, so a resize while it is open must
   * not leave the flag set on a layout that has no sheet to close.
   */
  protected readonly compact = signal(false);
  private mq: MediaQueryList | null = null;
  private readonly syncCompact = () => {
    const matches = this.mq?.matches ?? false;
    this.compact.set(matches);
    if (!matches) this.sheetOpen = false;
  };

  ngOnInit(): void {
    this.catchUp();
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.mq = window.matchMedia('(max-width: 899px)');
    this.syncCompact();
    this.mq.addEventListener('change', this.syncCompact);
  }

  ngOnDestroy(): void {
    if (this.beatTimer !== null) clearTimeout(this.beatTimer);
    this.mq?.removeEventListener('change', this.syncCompact);
  }
}
