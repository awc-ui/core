/**
 * The planning screen's own pieces: two hooks, three thin wrappers around
 * `md-*` elements that need an event listener, and the four render-only blocks.
 *
 * Split out of `PlanningScreen.tsx` because that file is the screen's LAYOUT and
 * its what-if state machine, and neither is easier to follow with three hundred
 * lines of small components in front of it. Nothing here is shared beyond this
 * screen — `bits.tsx` and `elements.tsx` are where the app-wide pieces live, and
 * this file must not grow into a second one of those.
 *
 * The reasoning for each decision is on the piece it belongs to.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  getHouseholdById,
  getPortfolioFor,
  getProposals,
  type Goal,
} from '@awc-ui/showcase-kit/wealth';
import { type T } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { EmptyState } from '../Shell';
import {
  DateText,
  Drill,
  Fact,
  FundedMeter,
  GoalDot,
  GoalStatusChip,
  MandateChip,
  Money,
  Percent,
  PriorityChip,
  RiskProfileChip,
  StrategyChip,
} from '../bits';
import { useCustomEvent } from '../elements';

/* ------------------------------------------------------------------- hooks */

/**
 * The 900px breakpoint the shell already swaps the rail and the bar at.
 *
 * The adjust controls are rendered in exactly ONE place — inline in the panel
 * above it, inside an `md-bottom-sheet` below it. Rendering both and hiding one
 * with CSS would put two identically-labelled sliders in the document, and
 * `md-bottom-sheet` never unmounts its content, so the copy in the sheet would
 * be permanent.
 */
export function useCompact(): boolean {
  const query = '(max-width: 899px)';
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
}

/**
 * Resolve MD3 colour roles to the hex strings the current theme defines.
 *
 * `md-color-picker` needs concrete colours for `value` and `presets` — a
 * `var(--md-sys-color-primary)` reference is not something it can parse. Rather
 * than inline a palette (which §9 forbids and which would ignore the accent
 * preset entirely), the values are read back off the token sheet, which is the
 * one place they are defined. Re-read whenever the dock's state changes, since
 * theme and accent both rewrite these custom properties.
 */
export function useRoleColors(roles: readonly string[], signature: string): string[] {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const styles = window.getComputedStyle(document.documentElement);
    const resolved = roles
      .map((role) => styles.getPropertyValue(`--md-sys-color-${role}`).trim())
      // Anything that is not a plain hex is dropped rather than handed to the
      // picker, which would flag its hex field invalid and keep its old colour.
      .filter((value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value));
    setColors(resolved);
    // `signature` is the dock state; `roles` is a module constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return colors;
}

/* --------------------------------------------------------- small wrappers */

/**
 * NEVER WRITE `false` INTO A BOOLEAN ATTRIBUTE ON AN `md-*` ELEMENT. Omit it.
 *
 * This one cost an hour, so it is written down. React renders `foo={false}` on
 * a custom element as the literal attribute `foo="false"`, and Stencil does
 * parse that string back to the boolean `false` — the prop reads correctly, the
 * disabled class is absent, `pointer-events` is `auto`. The element is still
 * dead.
 *
 * The reason is the platform, not the library. `md-button`, `md-select` and
 * `md-slider` are `formAssociated: true`, and HTML says a form-associated
 * custom element carrying the `disabled` ATTRIBUTE is "actually disabled" — the
 * browser then dispatches no click to it at all. Presence is what counts; the
 * value is never looked at. So `disabled="false"` is a disabled button, and it
 * is a disabled button that looks and reports as enabled. Confirmed in the
 * browser: `pointerdown` and `pointerup` still fire on it, `click` never does.
 *
 * The same shape of bug, without the platform involvement, applies to any
 * attribute a component's CSS selects on — `md-select`'s own stylesheet has a
 * `:host([full-width])` rule, and `[full-width]` matches `full-width="false"`.
 *
 * `undefined` is the fix: React omits the attribute entirely. Every boolean
 * below is written `value || undefined` for that reason.
 */
export const flag = (on: boolean | undefined) => on || undefined;

/**
 * An `md-button` that reports its activation.
 *
 * `mdClick` rather than React's `onClick`: it is the event the component
 * documents, it is cancelable, and it fires for Enter and Space as well as for
 * the pointer. The ref lives inside this component so a screen can render as
 * many of these as it likes without hand-rolling a ref each time.
 */
export function ActionButton({
  onAction,
  disabled,
  children,
  ...attributes
}: {
  onAction: () => void;
  disabled?: boolean;
  children?: ReactNode;
  [attribute: string]: unknown;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent(ref, 'mdClick', () => onAction());
  return (
    <md-button ref={ref} disabled={flag(disabled)} {...attributes}>
      {children}
    </md-button>
  );
}

/** An `md-select` bound to state. `mdChange`'s detail is the new value, a string. */
export function SelectField({
  label,
  value,
  onChange,
  children,
  fullWidth = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(ref, 'mdChange', (event) => onChange(event.detail ?? ''));
  return (
    <md-select
      ref={ref}
      variant="outlined"
      label={label}
      value={value}
      full-width={flag(fullWidth)}
    >
      {children}
    </md-select>
  );
}

/**
 * One what-if control: a label, the current value in words, and the slider.
 *
 * `controlled`, because the value is React's. The manual is blunt about the
 * consequence of forgetting the handler — the thumb follows the pointer and
 * then springs back on commit — so `mdInput` writes on every move and
 * `mdChange` writes again on release.
 *
 * There is no `value-indicator`: its bubble renders the raw number, which for
 * the horizon slider is a sample INDEX and for the contribution an unformatted
 * amount. The formatted value sits in the head row instead, where it is
 * localised, and in `value-text`, which is what a screen reader announces.
 */
export function SliderControl({
  label,
  display,
  valueText,
  value,
  min,
  max,
  step,
  stops,
  onChange,
}: {
  label: string;
  display: ReactNode;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  stops?: boolean;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const handle = useCallback(
    (event: CustomEvent<{ value: number }>) => {
      const next = event.detail?.value;
      if (typeof next === 'number') onChange(next);
    },
    [onChange],
  );
  useCustomEvent<CustomEvent<{ value: number }>>(ref, 'mdInput', handle);
  useCustomEvent<CustomEvent<{ value: number }>>(ref, 'mdChange', handle);

  return (
    <div className="plan-control">
      <div className="plan-control__head">
        <span className="plan-control__label">{label}</span>
        <span className="plan-control__value">{display}</span>
      </div>
      <div className="plan-control__rail">
        <md-slider
          ref={ref}
          controlled
          size="sm"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          stops={flag(stops)}
          value-text={valueText}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/** One objective, as a card. Read-only: selection is the panel's `md-select`. */
export function GoalCard({
  goal,
  selected,
  swatch,
  t,
}: {
  goal: Goal;
  selected: boolean;
  swatch?: string;
  t: T;
}) {
  return (
    /*
     * `data-selected`, NOT a toggled `class` — and this one made the card
     * disappear entirely.
     *
     * `class` on a custom element is a plain attribute, so React writes it with
     * `setAttribute('class', …)`, which REPLACES the whole list. Stencil owns
     * that list: the host classes it renders (`md-card`, `md-card--filled`, …)
     * AND the runtime's `hydrated` flag live there. The flag is applied once,
     * at hydration, and the hydratedFlag CSS paints anything without it at
     * `visibility: hidden`. So the moment `selected` flipped, React overwrote
     * the attribute with just `plan-goal--on`, the `hydrated` class went with
     * it, and the card became a correctly-sized, fully-populated, invisible
     * box — measured 698x332 with its real text, `visibility: hidden`, and it
     * never came back, because nothing re-applies that flag.
     *
     * A CONSTANT class is safe (React writes it once, before Stencil adds its
     * own — that is what `Panel` does), but a class that CHANGES is not. A data
     * attribute is a separate attribute, so React can toggle it all it likes
     * without touching anything Stencil owns.
     *
     * `undefined` rather than `false` for the off state: React omits the
     * attribute entirely, so `[data-selected]` matches only when it is on.
     */
    <md-card
      variant={selected ? 'filled' : 'outlined'}
      data-selected={selected ? '' : undefined}
      full-width
      full-height
    >
      {/* `--in-card`: the md-card around this already draws the surface, so the
          body must not draw a second one — see the note in app.css. */}
      <div className="goal-row goal-row--in-card">
        <div className="row row--between">
          <span className="with-dot">
            <GoalDot status={goal.status} />
            {swatch ? <span className="plan-swatch" style={{ background: swatch }} /> : null}
            <span className="strong">{t(goal.typeKey)}</span>
          </span>
          <PriorityChip priority={goal.priority} />
        </div>

        {/* A proper noun, or the objective belongs to the household itself. */}
        <p className="muted">{goal.beneficiaryName ?? t('wealth.common.household')}</p>
        <Drill href={route.household(goal.householdId)}>{goal.householdName}</Drill>

        <FundedMeter fraction={goal.fundedPct} status={goal.status} />

        <div className="row row--between">
          {/*
            * `<bdi>`, for the reason the `Signed` helper in `bits.tsx` carries
            * one: this is a mixed-direction run. The template is English (the
            * wealth block ships English only), the two amounts are formatted
            * numbers, and the word joining them is bidi-neutral — so under
            * `dir="rtl"` the algorithm reorders it to "€900k of €792k" and the
            * sentence says the opposite of what it means. `<bdi>` isolates the
            * run and resolves its direction from its own first strong
            * character, which keeps current-then-target. Verified in the
            * browser at `?dir=rtl`.
            */}
          <bdi className="muted">
            {t('wealth.goal.fundedOf', {
              current: t.formatCurrency(goal.currentAmount, {
                notation: 'compact',
                maximumFractionDigits: 1,
              }),
              target: t.formatCurrency(goal.targetAmount, {
                notation: 'compact',
                maximumFractionDigits: 1,
              }),
            })}
          </bdi>
          <GoalStatusChip status={goal.status} />
        </div>

        <dl className="dl">
          <Fact label={t('wealth.table.targetDate')}>
            <DateText value={goal.targetDate} />
          </Fact>
          <Fact label={t('wealth.table.contribution')}>
            <Money value={goal.monthlyContribution} />
          </Fact>
          <Fact label={t('wealth.table.projected')}>
            <Money value={goal.projectedAmount} compact />
          </Fact>
          <Fact label={t('wealth.table.shortfall')}>
            {goal.projectedShortfall > 0 ? (
              <Money value={goal.projectedShortfall} compact />
            ) : (
              <span className="muted">{t('wealth.common.none')}</span>
            )}
          </Fact>
        </dl>

        <p className="muted">
          <bdi>
            {t('wealth.goal.monthsRemaining', {
              count: t.formatNumber(goal.monthsRemaining, { maximumFractionDigits: 0 }),
            })}
          </bdi>
        </p>
      </div>
    </md-card>
  );
}

/**
 * The household's open advice, each with its review position.
 *
 * The determinate bar is `completedStepCount` of `stepCount` — a count against
 * its total, handed to the component rather than pre-divided into a percentage,
 * which is what `value` / `max` are for.
 */
export function AdviceInFlight({ householdId, t }: { householdId: string; t: T }) {
  const proposals = getProposals({ householdId, open: true });

  if (proposals.length === 0) {
    return <EmptyState message={t('wealth.empty.proposals')} />;
  }

  return (
    <div>
      {proposals.map((proposal) => {
        const position = t('wealth.proposal.stepProgress', {
          // 1-based for the reader; `currentStepIndex` is an array index.
          current: proposal.currentStepIndex + 1,
          total: proposal.stepCount,
        });
        const step = proposal.steps[proposal.currentStepIndex];
        return (
          <div className="plan-progress" key={proposal.id}>
            <div className="row row--between">
              <span className="strong">{t(proposal.typeKey)}</span>
              <bdi className="muted">{position}</bdi>
            </div>
            <md-progress-indicator
              variant="linear"
              value={proposal.completedStepCount}
              max={proposal.stepCount}
              label={position}
            />
            <div className="row row--between">
              <span className="muted">{step ? t(step.nameKey) : t(proposal.statusKey)}</span>
              <span className="muted">
                <Money value={proposal.estimatedValue} compact />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- sub-pieces */

/** The mandate the growth assumption comes from. A standalone accordion item. */
export function MandateAssumptions({ householdId, t }: { householdId: string; t: T }) {
  const household = getHouseholdById(householdId);
  const portfolio = getPortfolioFor(householdId);
  if (!household) return null;

  return (
    <md-accordion-item headline={t('wealth.panel.mandate')} icon="account_balance">
      <div className="row">
        <RiskProfileChip profile={household.riskProfile} />
        <StrategyChip strategy={household.strategy} />
        <MandateChip mandate={household.mandate} />
      </div>
      <dl className="dl">
        <Fact label={t('wealth.table.benchmark')}>{portfolio?.benchmarkName ?? t('wealth.common.na')}</Fact>
        <Fact label={t('wealth.table.aum')}>
          <Money value={household.totalAum} compact />
        </Fact>
        <Fact label={t('wealth.table.ytd')}>
          <Percent value={household.ytdReturn} digits={1} sign />
        </Fact>
        <Fact label={t('wealth.table.nextReview')}>
          <DateText value={household.nextReviewDate} />
        </Fact>
      </dl>
    </md-accordion-item>
  );
}

