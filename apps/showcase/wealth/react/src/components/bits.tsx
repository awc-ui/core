/**
 * The small, repeated pieces: formatted figures, the chips that carry a domain
 * state, the meters, and the KPI tile.
 *
 * Every one of them takes a domain value and resolves BOTH halves of it through
 * the kit: the COLOUR through the status maps in `@awc-ui/showcase-kit/wealth`,
 * the LABEL through the dictionary key that travels beside the value
 * (`household.strategyKey`, `goal.statusKey`, `order.sideKey`). Nothing here
 * contains English, so nothing here can render English into a translated page.
 *
 * THIS IS THE CONTRACT FOR SCREENS. If you are writing one of the six screens:
 *
 *   - Never call `Intl` and never call `toFixed`. Money goes through `<Money>`,
 *     ratios through `<Percent>`, signed figures through `<Signed>`, dates
 *     through `<DateText>`. They are pinned to the dock's locale and to UTC.
 *   - Never write `status === 'breach' ? 'error' : …`. Use the chip or the dot.
 *   - Never hardcode a chip's `color`. Every mapping is already in the kit.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 */

import type { CSSProperties, ReactNode } from 'react';
import {
  allocationColor,
  allocationDot,
  assetClassRole,
  driftColor,
  goalColor,
  goalDot,
  kycColor,
  kycDot,
  mandateColor,
  orderColor,
  orderDot,
  orderSideColor,
  plColor,
  priorityColor,
  proposalColor,
  riskProfileColor,
  riskToleranceColor,
  segmentColor,
  strategyColor,
  type AllocationStatus,
  type AssetClass,
  type Currency,
  type GoalStatus,
  type KycStatus,
  type Mandate,
  type OrderSide,
  type OrderStatus,
  type Priority,
  type ProposalStatus,
  type RiskProfile,
  type RiskTolerance,
  type Segment,
  type Strategy,
} from '@awc-ui/showcase-kit/wealth';
import { Link } from '@/lib/router';
import { useShowcase, useT } from '@/lib/showcase';
import { Sparkline } from './elements';

/* ------------------------------------------------------------- formatting */

/**
 * A money amount.
 *
 * `currency` defaults to EUR because every aggregate in the fixture is in EUR;
 * pass a position's or an order's own `currency` for a local amount. `compact`
 * gives €3.2m — the right choice for a KPI tile or a chart axis, the wrong one
 * for a table cell where the reader is comparing figures digit by digit.
 */
export function Money({
  value,
  currency = 'EUR',
  compact = false,
  digits,
}: {
  value: number;
  currency?: Currency | string;
  compact?: boolean;
  /** Force a fraction-digit count. Default: 0 standard, 1 compact. */
  digits?: number;
}) {
  const t = useT();
  // A SIGNED money figure is `<Signed>`, not a flag here: the kit's
  // CurrencyOptions has no `signDisplay`, so composing the `+` is a real piece
  // of work rather than one more option, and it belongs next to the colour
  // decision that goes with it.
  return (
    <span className="num">
      {t.formatCurrency(value, {
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })}
    </span>
  );
}

/**
 * A ratio, as a percentage.
 *
 * The value is a FRACTION — `0.0135` renders as `1.35%`. Every ratio in the
 * fixture is stored that way, so pass it straight in and never multiply by 100
 * first.
 */
export function Percent({
  value,
  digits = 2,
  sign = false,
}: {
  value: number;
  digits?: number;
  /** Prefix a `+` on positives. Use it for drift, excess return and P/L. */
  sign?: boolean;
}) {
  const t = useT();
  return (
    <span className="num">
      {t.formatPercent(value, {
        maximumFractionDigits: digits,
        minimumFractionDigits: Math.min(digits, 1),
        signDisplay: sign ? 'exceptZero' : undefined,
      })}
    </span>
  );
}

/**
 * A signed figure — profit and loss, an excess return, a drift.
 *
 * THE COLOUR IS NEVER THE ONLY CARRIER. The sign is always in the text
 * (`signDisplay: 'exceptZero'`), and an optional glyph repeats it, so the cell
 * still says which way it went in monochrome, in a screenshot, and to a reader
 * who cannot distinguish the two hues. That is the WCAG 1.4.1 rule, and a
 * financial table is exactly where it gets broken.
 *
 * `plColor` has a dead band: a move smaller than the rounding scale is neither
 * green nor red, which is what stops a table of near-flat positions reading as
 * a chequerboard.
 */
export function Signed({
  value,
  kind = 'money',
  currency = 'EUR',
  compact = false,
  digits,
}: {
  value: number;
  /** `money` formats with a currency; `percent` treats the value as a fraction. */
  kind?: 'money' | 'percent';
  currency?: Currency | string;
  compact?: boolean;
  digits?: number;
}) {
  const t = useT();
  // The dead band is a fraction for percentages and a currency unit for money —
  // half a cent is not a move, but half a euro on a €40m book is not either.
  const color = plColor(value, kind === 'percent' ? 0.0005 : 1);
  const className = color === 'success' ? 'pl-up' : color === 'error' ? 'pl-down' : 'pl-flat';

  const text =
    kind === 'percent'
      ? t.formatPercent(value, {
          maximumFractionDigits: digits ?? 2,
          minimumFractionDigits: Math.min(digits ?? 2, 1),
          signDisplay: 'exceptZero',
        })
      : `${value > 0 ? '+' : ''}${t.formatCurrency(value, {
          currency,
          notation: compact ? 'compact' : 'standard',
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        })}`;

  /*
   * `<bdi>`, NOT `<span>`, and this one was found by looking at the page.
   *
   * The money branch composes its `+` by hand, because the kit's
   * `CurrencyOptions` has no `signDisplay` to hand to `Intl`. A leading `+` is a
   * bidi-NEUTRAL character, so under `dir="rtl"` the algorithm resolves it
   * against the paragraph direction and moves it to the other end: `+€1.5m`
   * renders as `€1.5m+`, which reads as a different number. `<bdi>` isolates
   * the run and auto-detects its direction from its own first strong character,
   * so the sign stays where it was written. The percent branch does not need it
   * — `Intl` places that sign itself and gets the bidi right — but one wrapper
   * for both keeps the two from drifting.
   */
  return <bdi className={`num ${className}`}>{text}</bdi>;
}

/**
 * A count, as a small chip.
 *
 * This is what goes in a KPI tile's `trailing` slot and beside a panel title —
 * NOT `md-badge`. A badge has to sit on a host it can overlap, and dropped into
 * a card's foot it anchors to the card's corner and is clipped in half. A chip
 * is a standalone element that takes its own space, which is what a count in a
 * row of facts actually is.
 */
export function Count({ value, color = 'primary' }: { value: number; color?: string }) {
  const t = useT();
  return (
    <md-chip
      variant="assist"
      appearance="outlined"
      color={color}
      label={t.formatNumber(value, { maximumFractionDigits: 0 })}
    />
  );
}

/** A plain number: a quantity, a count, a basis-point figure. */
export function Num({ value, digits = 0 }: { value: number; digits?: number }) {
  const t = useT();
  return (
    <span className="num">
      {t.formatNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: digits })}
    </span>
  );
}

/**
 * A calendar date.
 *
 * Rendered inside a `<time>` with a machine-readable `dateTime`, so the ISO
 * value survives even though the visible text is localised. `formatDate` is
 * pinned to UTC in the kit, so 2026-06-30 is 30 June west of Greenwich too.
 */
export function DateText({
  value,
  style = 'medium',
}: {
  value: string;
  style?: 'short' | 'medium' | 'long' | 'monthYear';
}) {
  const t = useT();
  return <time dateTime={value}>{t.formatDate(value, style)}</time>;
}

/** A full UTC instant from the audit trail. The date part is what is shown. */
export function TimestampText({ value }: { value: string }) {
  const t = useT();
  const date = value.slice(0, 10);
  return <time dateTime={value}>{t.formatDate(date, 'medium')}</time>;
}

/* ----------------------------------------------------------------- layout */

/** A `dt`/`dd` pair inside a `.dl` grid. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A drill link into the next screen down. Always an `<a>` with a real href. */
export function Drill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="drill" href={href}>
      {children}
    </Link>
  );
}

/** A status dot beside a name, without the dot pushing the baseline around. */
export function NameCell({ dot, children }: { dot?: ReactNode; children: ReactNode }) {
  return (
    <span className="with-dot">
      {dot}
      <span>{children}</span>
    </span>
  );
}

/* -------------------------------------------------------- search highlight */

/**
 * The regex metacharacters, so a query can be dropped into a pattern.
 *
 * WITHOUT THIS, TYPING `(` THROWS. The query is whatever the reader has typed
 * so far, and half the punctuation on a keyboard is syntax to `RegExp`.
 * `$&` in the replacement is the character that matched, so each one comes back
 * escaped and matches itself literally.
 */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

/**
 * The mark's colours are a CONTAINER/ON-CONTAINER PAIR, never a literal.
 *
 * The user-agent default for `<mark>` is black on yellow, which is a hardcoded
 * colour that survives into the dark theme and lands a light-mode highlight in
 * the middle of a dark table. A token pair is contrast-checked in both themes
 * and follows a re-themed palette. `tertiary` is the accent role this console
 * does not spend on a health state, so a hit reads as "this is what you asked
 * for" rather than as a warning about the row.
 *
 * The weight is a SECOND CARRIER. Colour alone would fail WCAG 1.4.1; the
 * `<mark>` element itself carries the same fact into the accessibility tree,
 * which is the whole reason it is `<mark>` and not a `<span class>`.
 */
const HIGHLIGHT_STYLE: CSSProperties = {
  background: 'var(--md-sys-color-tertiary-container)',
  color: 'var(--md-sys-color-on-tertiary-container)',
  fontWeight: 500,
  // Inline padding only: padding-block would grow the line box and shift the
  // baseline of the one cell in the row that happens to contain a match.
  paddingInline: '1px',
  borderRadius: 'var(--md-sys-shape-corner-extra-small)',
};

/**
 * The run of `text` a search query matched, wrapped in `<mark>`.
 *
 * FILTERING IS THE KIT'S; SHOWING WHY A ROW SURVIVED IS THE VIEW'S. The
 * selectors match case-insensitively on a TRIMMED query (`fold(search.trim())`
 * in `selectors.ts`), so this splits on the same trimmed needle with the `i`
 * flag — a table that highlighted a different substring from the one that kept
 * the row would be worse than no highlight at all.
 *
 * NEVER BUILT AS AN HTML STRING. Interpolating the query into markup and
 * setting `innerHTML` is an injection with a text field for a source, and the
 * fixture holds names with `&` and `.` that would break it even with a
 * co-operative reader. `split()` with ONE capture group returns the pieces as
 * strings and React makes the nodes: every match is escaped by construction,
 * and a query that occurs three times in one cell is marked three times.
 *
 * The kit matches its fields JOINED BY A SPACE, so a query that straddles two
 * of them ("VWCE Vanguard") keeps the row and marks nothing. That is the honest
 * outcome — no single cell contains that text.
 */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const needle = query?.trim() ?? '';
  if (!needle) return <>{text}</>;

  const parts = text.split(
    new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'),
  );

  return (
    <>
      {parts.map((part, index) =>
        // One capture group makes the result alternate: even indices are the
        // text between matches, odd indices are the matches themselves.
        index % 2 === 1 ? (
          <mark key={index} style={HIGHLIGHT_STYLE}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/* --------------------------------------------------------------- KPI tile */

export function KpiTile({
  label,
  value,
  hint,
  trend,
  trendLabels,
  formatTrend,
  color = 'primary',
  trailing,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Historical values for the sparkline, oldest first. */
  trend?: number[];
  /** Tooltip x labels — month ends, already formatted. */
  trendLabels?: string[];
  formatTrend?: (value: number | null) => string;
  /** One of the md colour roles. Use a `status.ts` map, not a guess. */
  color?: string;
  /**
   * A small node at the end of the foot row — a chip, a dot, a count.
   *
   * NOT a bare `md-badge`. A badge anchors absolutely against the nearest
   * POSITIONED ancestor and translates itself past that ancestor's corner, so
   * dropped in here it lands on the card's top-right corner and is sliced in
   * half by the card's own `overflow: hidden`. A badge needs a host to sit on
   * and a `.badge-anchor` wrapper around it; see the pattern in `app.css`.
   */
  trailing?: ReactNode;
}) {
  const { state } = useShowcase();
  return (
    <md-card variant="filled" full-width>
      <div className="kpi">
        <p className="kpi__label">{label}</p>
        <p className="kpi__value">{value}</p>
        {trend && trend.length > 1 ? (
          <div className="kpi__spark">
            <Sparkline
              data={trend}
              labels={trendLabels}
              valueFormatter={formatTrend}
              locale={state.locale}
              variant="area"
              color={color}
              curve="monotone"
              show-marks="extremes"
              height="34px"
            />
          </div>
        ) : null}
        {hint || trailing ? (
          <div className="kpi__foot">
            <span>{hint}</span>
            {trailing}
          </div>
        ) : null}
      </div>
    </md-card>
  );
}

/* ------------------------------------------------------------------ chips */

/**
 * The base every chip below is built from.
 *
 * `variant="assist"` throughout: these are informational, not filters and not
 * removable user input. A screen that wants a toggleable facet wants
 * `variant="filter"` and owns its own state.
 */
function StateChip({
  labelKey,
  color,
  appearance = 'filled',
  icon,
  title,
}: {
  labelKey: string;
  color: string;
  appearance?: 'filled' | 'outlined' | 'elevated';
  icon?: string;
  title?: string;
}) {
  const t = useT();
  return (
    <md-chip
      variant="assist"
      appearance={appearance}
      color={color}
      icon={icon}
      label={t(labelKey)}
      title={title}
    />
  );
}

export function StrategyChip({ strategy }: { strategy: Strategy }) {
  return <StateChip labelKey={`wealth.strategy.${strategy}`} color={strategyColor[strategy]} />;
}

export function MandateChip({ mandate }: { mandate: Mandate }) {
  return (
    <StateChip
      labelKey={`wealth.mandate.${mandate}`}
      color={mandateColor[mandate]}
      appearance="outlined"
    />
  );
}

export function SegmentChip({ segment }: { segment: Segment }) {
  return (
    <StateChip
      labelKey={`wealth.segment.${segment}`}
      color={segmentColor[segment]}
      appearance="outlined"
    />
  );
}

export function RiskProfileChip({ profile }: { profile: RiskProfile }) {
  return (
    <StateChip labelKey={`wealth.riskProfile.${profile}`} color={riskProfileColor[profile]} />
  );
}

export function RiskToleranceChip({ tolerance }: { tolerance: RiskTolerance }) {
  return (
    <StateChip
      labelKey={`wealth.riskTolerance.${tolerance}`}
      color={riskToleranceColor[tolerance]}
      appearance="outlined"
    />
  );
}

export function KycChip({ status }: { status: KycStatus }) {
  return <StateChip labelKey={`wealth.kycStatus.${status}`} color={kycColor[status]} />;
}

export function ClientRoleChip({ role }: { role: string }) {
  return <StateChip labelKey={`wealth.clientRole.${role}`} color="secondary" appearance="outlined" />;
}

export function AssetClassChip({ assetClass }: { assetClass: AssetClass }) {
  const t = useT();
  /*
   * Filled and tonal, driven by a ROLE NAME.
   *
   * This used to tint `--md-chip-outline-color` with the chart palette, on the
   * reasoning that an asset class is a category rather than a health state and
   * so has no semantic role. The category part is still true — equity is not
   * `success` — but the conclusion was wrong: `assetClassRole` names the same
   * palette entries the chart uses, and a role name is what buys the whole
   * family. One `var()` could only paint an outline; `color="primary"` gives
   * the chip a container AND a legible label on it, which is what makes a
   * filled chip possible at all. The donut slice and the chip stay the same
   * hue, one tonal and one full strength.
   *
   * `cash` resolves to `undefined` and takes the neutral surface treatment —
   * see the note on `assetClassRole` for why it has no role of its own.
   */
  return (
    <md-chip
      variant="assist"
      appearance="filled"
      color={assetClassRole[assetClass]}
      label={t(`wealth.assetClass.${assetClass}`)}
    />
  );
}

export function InstrumentTypeChip({ type }: { type: string }) {
  return <StateChip labelKey={`wealth.instrumentType.${type}`} color="info" appearance="outlined" />;
}

export function AllocationChip({ status }: { status: AllocationStatus }) {
  return (
    <StateChip labelKey={`wealth.allocationStatus.${status}`} color={allocationColor[status]} />
  );
}

export function GoalStatusChip({ status }: { status: GoalStatus }) {
  return <StateChip labelKey={`wealth.goalStatus.${status}`} color={goalColor[status]} />;
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <StateChip
      labelKey={`wealth.priority.${priority}`}
      color={priorityColor[priority]}
      appearance="outlined"
    />
  );
}

export function ProposalStatusChip({ status }: { status: ProposalStatus }) {
  return <StateChip labelKey={`wealth.proposalStatus.${status}`} color={proposalColor[status]} />;
}

export function ProposalTypeChip({ type }: { type: string }) {
  return <StateChip labelKey={`wealth.proposalType.${type}`} color="secondary" appearance="outlined" />;
}

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  return <StateChip labelKey={`wealth.orderStatus.${status}`} color={orderColor[status]} />;
}

/**
 * Buy or sell.
 *
 * Deliberately NOT green/red: `success` and `error` mean "went well" and "went
 * wrong" everywhere else in this console, and a sell is neither. The mapping is
 * in the kit and the reasoning with it.
 */
export function OrderSideChip({ side }: { side: OrderSide }) {
  return <StateChip labelKey={`wealth.orderSide.${side}`} color={orderSideColor[side]} />;
}

export function ActivityCategoryChip({ category }: { category: string }) {
  return (
    <StateChip
      labelKey={`wealth.activityCategory.${category}`}
      color="secondary"
      appearance="outlined"
    />
  );
}

/* ------------------------------------------------------------------- dots */

/**
 * Every dot below carries a `label`.
 *
 * `md-status-dot`'s colour is the only thing it renders, so an unlabelled one
 * leaves colour as the sole carrier of meaning — which is exactly the failure
 * the `label` prop exists to prevent. The only case for dropping it is a dot
 * sitting immediately beside a chip that already says the same word, where
 * naming both announces the state twice per row.
 */
export function KycDot({ status }: { status: KycStatus }) {
  const t = useT();
  return (
    <md-status-dot
      inline
      state={kycDot[status]}
      size="small"
      label={t(`wealth.kycStatus.${status}`)}
    />
  );
}

export function AllocationDot({ status }: { status: AllocationStatus }) {
  const t = useT();
  return (
    <md-status-dot
      inline
      state={allocationDot[status]}
      size="small"
      label={t(`wealth.allocationStatus.${status}`)}
    />
  );
}

export function GoalDot({ status }: { status: GoalStatus }) {
  const t = useT();
  return (
    <md-status-dot
      inline
      state={goalDot[status]}
      size="small"
      label={t(`wealth.goalStatus.${status}`)}
    />
  );
}

export function OrderDot({ status }: { status: OrderStatus }) {
  const t = useT();
  return (
    <md-status-dot
      inline
      state={orderDot[status]}
      size="small"
      label={t(`wealth.orderStatus.${status}`)}
    />
  );
}

/* ----------------------------------------------------------------- meters */

/**
 * A fraction against a cap, as a labelled linear meter.
 *
 * `md-meter` is for a read-only value in a known range — a funded percentage, a
 * weight, a coverage ratio. It is NOT a progress indicator: nothing here is
 * loading.
 */
export function RatioMeter({
  label,
  fraction,
  color,
  max = 1,
  thickness = 10,
}: {
  label: string;
  /** A fraction. Clamped into 0…`max` for the bar; the text keeps the real value. */
  fraction: number;
  color: string;
  max?: number;
  thickness?: number;
}) {
  const t = useT();
  return (
    <md-meter
      value={Math.max(0, Math.min(max, fraction)) * 100}
      min="0"
      max={max * 100}
      color={color}
      thickness={thickness}
      label={label}
      show-label
      show-value
      value-text={t.formatPercent(fraction, { maximumFractionDigits: 1 })}
    />
  );
}

/**
 * A goal's funded percentage.
 *
 * The bar is clamped at 100% but the TEXT is not, so an over-funded objective
 * reads "112%" beside a full bar rather than silently looking merely complete.
 */
export function FundedMeter({ fraction, status }: { fraction: number; status: GoalStatus }) {
  const t = useT();
  return (
    <md-meter
      value={Math.max(0, Math.min(1, fraction)) * 100}
      min="0"
      max="100"
      color={goalColor[status]}
      thickness="8"
      label={t('wealth.table.funded')}
      show-label
      show-value
      value-text={t.formatPercent(fraction, { maximumFractionDigits: 0 })}
    />
  );
}

/**
 * Allocation drift, as a meter.
 *
 * `drift` is a SIGNED fraction and can be negative — underweight. `md-meter`
 * has no negative range, so the bar shows the DISTANCE from target scaled into
 * 0…10 percentage points and the direction is carried by the colour, the
 * status chip and the signed text beside it. Reading the bar alone never says a
 * breached class is fine: at a breach the bar is full AND red.
 */
export function DriftMeter({ drift }: { drift: number }) {
  const t = useT();
  const distance = Math.abs(drift);
  return (
    <md-meter
      value={Math.min(10, distance * 100)}
      min="0"
      max="10"
      color={driftColor(drift)}
      thickness="8"
      label={t('wealth.table.drift')}
      show-label
      value-text={t.formatPercent(drift, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}
      show-value
    />
  );
}
