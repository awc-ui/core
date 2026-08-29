/**
 * Domain value → component vocabulary.
 *
 * `md-chip`, `md-meter`, `md-badge`, `md-status-dot` and `md-step` each take a
 * fixed enumeration (`color`, `state`). Mapping wealth states onto them in ONE
 * place keeps a breached allocation the same red everywhere, and keeps the
 * mapping auditable — the alternative is a `status === 'breach' ? 'error' : …`
 * ternary in nine files that drift apart.
 *
 * Nothing here produces a visible string. The label always comes from the
 * dictionary key beside the value (`kycStatus.${status}` and friends).
 *
 * The chart palette at the bottom is here for the same reason: an asset class
 * must be the same colour in the donut on the overview, the bar on the
 * household screen and the meter beside the drift figure, or the three stop
 * being readable together.
 */

import type {
  AllocationStatus,
  AssetClass,
  GoalStatus,
  KycStatus,
  Mandate,
  OrderSide,
  OrderStatus,
  Priority,
  ProposalStatus,
  RiskProfile,
  RiskTolerance,
  Segment,
  StepState,
  Strategy,
} from './types';

/** The `color` enumeration shared by md-chip, md-meter, md-badge and md-progress-indicator. */
export type MdColor = 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning' | 'info';

/** The `state` enumeration of md-status-dot. */
export type MdDotState = 'online' | 'away' | 'busy' | 'offline' | 'invisible' | 'neutral';

/** The `state` enumeration of md-step. */
export type MdStepState = 'complete' | 'active' | 'pending' | 'error';

/* --------------------------------------------------------------------- KYC */

export const kycColor: Record<KycStatus, MdColor> = {
  verified: 'success',
  'review-due': 'warning',
  pending: 'info',
  expired: 'error',
};

export const kycDot: Record<KycStatus, MdDotState> = {
  verified: 'online',
  'review-due': 'away',
  pending: 'neutral',
  expired: 'busy',
};

/* ------------------------------------------------------------ risk profile */

/**
 * Risk is not good or bad, so these are the NEUTRAL roles rather than the
 * success/warning/error ladder — a dynamic mandate is not an error.
 */
export const riskProfileColor: Record<RiskProfile, MdColor> = {
  defensive: 'info',
  balanced: 'primary',
  growth: 'secondary',
  dynamic: 'tertiary',
};

export const riskToleranceColor: Record<RiskTolerance, MdColor> = {
  low: 'info',
  medium: 'primary',
  high: 'tertiary',
};

export const strategyColor: Record<Strategy, MdColor> = {
  conservative: 'info',
  balanced: 'primary',
  growth: 'secondary',
  aggressive: 'tertiary',
};

export const mandateColor: Record<Mandate, MdColor> = {
  discretionary: 'primary',
  advisory: 'secondary',
  'execution-only': 'info',
};

export const segmentColor: Record<Segment, MdColor> = {
  affluent: 'info',
  'private-wealth': 'primary',
  'family-office': 'tertiary',
};

/* -------------------------------------------------------------- allocation */

export const allocationColor: Record<AllocationStatus, MdColor> = {
  'in-band': 'success',
  drifted: 'warning',
  breach: 'error',
};

export const allocationDot: Record<AllocationStatus, MdDotState> = {
  'in-band': 'online',
  drifted: 'away',
  breach: 'busy',
};

/**
 * Signed drift → colour, for a cell that carries the number rather than the
 * status. Same 2% / 5% thresholds the fixture classifies on, applied to the
 * absolute value so an overweight and an underweight of the same size read the
 * same — which is the point: a rebalance desk cares how far, not which way.
 */
export function driftColor(drift: number): MdColor {
  const distance = Math.abs(drift);
  if (distance >= 0.05) return 'error';
  if (distance >= 0.02) return 'warning';
  return 'success';
}

/* ------------------------------------------------------------------- goals */

export const goalColor: Record<GoalStatus, MdColor> = {
  funded: 'success',
  'on-track': 'success',
  'at-risk': 'warning',
  behind: 'error',
};

export const goalDot: Record<GoalStatus, MdDotState> = {
  funded: 'online',
  'on-track': 'online',
  'at-risk': 'away',
  behind: 'busy',
};

/** Priority is emphasis, not health — hence `primary`, not `success`. */
export const priorityColor: Record<Priority, MdColor> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

/* --------------------------------------------------------------- proposals */

export const proposalColor: Record<ProposalStatus, MdColor> = {
  draft: 'info',
  'in-review': 'primary',
  compliance: 'warning',
  'client-review': 'secondary',
  approved: 'success',
  rejected: 'error',
};

/**
 * `md-step` has four states and the fixture has four, but they are not the same
 * four: a proposal step that is `current` is `md-step`'s `active`, and a
 * `blocked` one is its `error`.
 */
export const stepState: Record<StepState, MdStepState> = {
  complete: 'complete',
  current: 'active',
  pending: 'pending',
  blocked: 'error',
};

/* ------------------------------------------------------------------ orders */

export const orderColor: Record<OrderStatus, MdColor> = {
  draft: 'info',
  staged: 'secondary',
  submitted: 'primary',
  'partially-filled': 'warning',
  filled: 'success',
  cancelled: 'info',
  rejected: 'error',
};

export const orderDot: Record<OrderStatus, MdDotState> = {
  draft: 'neutral',
  staged: 'neutral',
  submitted: 'away',
  'partially-filled': 'away',
  filled: 'online',
  cancelled: 'offline',
  rejected: 'busy',
};

/**
 * Buy and sell.
 *
 * DELIBERATELY NOT green/red. `success` and `error` mean "this went well" and
 * "this went wrong" everywhere else in the console, and a sell is neither — a
 * sell chip in the same red as a rejected order and a breached covenant reads
 * as a problem. Direction is carried by two neutral roles plus the word itself.
 */
export const orderSideColor: Record<OrderSide, MdColor> = {
  buy: 'primary',
  sell: 'tertiary',
};

/* ------------------------------------------------------- profit and  loss */

/**
 * A signed money or return figure → colour.
 *
 * Zero is `primary`, not `success`: flat is not a win. The dead band keeps a
 * rounding-scale move (±0.05%) from being coloured at all, which is what stops a
 * table of near-flat positions looking like a chequerboard.
 */
export function plColor(value: number, deadBand = 0.0005): MdColor {
  if (value > deadBand) return 'success';
  if (value < -deadBand) return 'error';
  return 'primary';
}

/** Trend glyph for a signed figure. Material Symbols names. */
export function plIcon(value: number, deadBand = 0.0005): string {
  if (value > deadBand) return 'trending_up';
  if (value < -deadBand) return 'trending_down';
  return 'trending_flat';
}

/* ------------------------------------------------------------ chart series */

/**
 * The asset-class palette, as CSS custom-property references.
 *
 * These are token references, not colours — `var(--md-sys-color-primary)` and
 * friends — so the whole palette follows the theme, the accent preset the dock
 * applies, and dark mode, without a second definition anywhere. Feed them to a
 * chart's `colors` prop or a `--md-*` custom property; never inline a hex.
 *
 * The order matches `ASSET_CLASS_ORDER`, so a donut, a stacked bar and a legend
 * built from the same array agree slice for slice.
 */
export const assetClassColor: Record<AssetClass, string> = {
  equity: 'var(--md-sys-color-primary)',
  'fixed-income': 'var(--md-sys-color-tertiary)',
  'real-assets': 'var(--md-sys-color-secondary)',
  alternatives: 'var(--md-sys-color-info)',
  cash: 'var(--md-sys-color-outline)',
};

/**
 * The same palette named as ROLES, for components that take a `color` prop.
 *
 * `assetClassColor` above hands out `var(--md-sys-color-…)` references, which is
 * what a chart needs — it wants a colour to paint a slice with. A component
 * that takes `color="primary"` wants the role NAME instead, because it resolves
 * the whole family from it: `--md-sys-color-primary`, `-primary-container` and
 * `-on-primary-container`. Feeding it a `var()` gets one colour where it needed
 * three, which is why an asset-class chip could only ever tint its outline.
 *
 * The two maps are the same palette by construction — equity is `primary` in
 * both — so a filled chip and its donut slice stay the same hue, one tonal and
 * one full strength.
 *
 * `cash` has no entry on purpose. Its colour is `outline`, which is a boundary
 * role and has no container family for a filled surface to use; a chip with no
 * `color` falls back to the neutral surface treatment, which is the right
 * answer for the one class that is not an investment.
 */
export const assetClassRole: Partial<Record<AssetClass, MdColor>> = {
  equity: 'primary',
  'fixed-income': 'tertiary',
  'real-assets': 'secondary',
  alternatives: 'info',
};

/** The order every allocation view renders asset classes in. */
export const ASSET_CLASS_ORDER: readonly AssetClass[] = [
  'equity',
  'fixed-income',
  'real-assets',
  'alternatives',
  'cash',
] as const;

/** The same palette as a plain array, in `ASSET_CLASS_ORDER`. */
export const ASSET_CLASS_PALETTE: readonly string[] = ASSET_CLASS_ORDER.map(
  (cls) => assetClassColor[cls],
);
